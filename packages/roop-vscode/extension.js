const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { RobotViewProvider } = require('./robotView');

const BLOCK_HEADERS = [
  'when',
  'on',
  'at',
  'if',
  'elseif',
  'else',
  'repeat',
  'while',
  'for',
  'parallel',
  'template task',
  'start task',
  'fallback',
];

let diagnosticCollection;
let robotProvider;
let pendingTimers = new Map();

function activate(context) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('roop');
  context.subscriptions.push(diagnosticCollection);

  registerDocumentHooks(context);
  registerCommands(context);
  registerLanguageFeatures(context);
  registerTasks(context);
  registerRobotView(context);

  vscode.workspace.textDocuments
    .filter((doc) => doc.languageId === 'roop')
    .forEach((doc) => refreshDiagnostics(doc));
}

function deactivate() {}

function registerDocumentHooks(context) {
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === 'roop') {
        refreshDiagnostics(doc);
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId !== 'roop') {
        return;
      }
      const timer = pendingTimers.get(event.document.uri.toString());
      if (timer) {
        clearTimeout(timer);
      }
      const handle = setTimeout(() => {
        pendingTimers.delete(event.document.uri.toString());
        refreshDiagnostics(event.document);
      }, 250);
      pendingTimers.set(event.document.uri.toString(), handle);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId === 'roop') {
        refreshDiagnostics(doc);
        if (robotProvider && autoSimulateEnabled()) {
          robotProvider.simulateFromText(doc.getText(), doc.uri);
        }
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
    })
  );
}

function registerCommands(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('roop.insertTask', insertTaskSkeleton)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('roop.newProject', createExampleProject)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('roop.openDocs', openDocs)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('roop.runTask', () => runRuntimeCommand('run'))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('roop.validateDocument', () => runRuntimeCommand('validate'))
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('roop.scanModules', scanModules)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('roop.generateModuleManifest', generateModuleManifest)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('roopRobot.simulateActiveDocument', () => {
      if (!robotProvider) {
        vscode.window.showInformationMessage('Robot view is not ready yet.');
        return;
      }
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'roop') {
        vscode.window.showWarningMessage('Open a ROOP document to simulate.');
        return;
      }
      robotProvider.simulateFromText(editor.document.getText(), editor.document.uri);
      robotProvider.reveal();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('roopRobot.stop', () => {
      robotProvider?.stop();
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('roopRobot.toggle', () => {
      robotProvider?.toggle();
    })
  );
}

function registerLanguageFeatures(context) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider('roop', new RoopCompletionProvider(), ' ', '"')
  );
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('roop', new RoopFormattingProvider())
  );
}

function registerTasks(context) {
  context.subscriptions.push(
    vscode.tasks.registerTaskProvider('roop', {
      provideTasks: async () => {
        const runtime = resolveRuntimeCli();
        if (!runtime) {
          return [];
        }
        const task = new vscode.Task(
          { type: 'roop', command: 'validate' },
          vscode.TaskScope.Workspace,
          'ROOP: Validate workspace',
          'roop',
          new vscode.ShellExecution(`node "${runtime}" validate --file "${getFirstRoopFile() || ''}"`)
        );
        task.problemMatchers = ['$roop-lsp'];
        return [task];
      },
      resolveTask: (task) => task,
    })
  );
}

function registerRobotView(context) {
  robotProvider = new RobotViewProvider(context.extensionUri, parseStepsForRobot);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('roopRobotView', robotProvider)
  );
  registerRobotAutoSimulation(context);
}

function refreshDiagnostics(document) {
  const diagnostics = [];
  const text = document.getText();
  const lines = text.split(/\r?\n/);
  const taskStack = [];

  lines.forEach((raw, index) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      return;
    }
    const header = BLOCK_HEADERS.find((keyword) =>
      trimmed.toLowerCase().startsWith(`${keyword} `) || trimmed.toLowerCase().startsWith(`${keyword}:`)
    );
    if (header && !trimmed.endsWith(':') && !/^start\s+task/i.test(trimmed)) {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(index, raw.length - trimmed.length, index, raw.length),
          `Expected ':' at the end of '${header}'`,
          vscode.DiagnosticSeverity.Warning
        )
      );
    }
    if (/^start\s+task\b/i.test(trimmed)) {
      taskStack.push(index);
    } else if (/^end\s+task\b/i.test(trimmed)) {
      if (taskStack.length === 0) {
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(index, 0, index, trimmed.length),
            'end task without matching start task',
            vscode.DiagnosticSeverity.Error
          )
        );
      } else {
        taskStack.pop();
      }
    }
  });

  taskStack.forEach((line) => {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(line, 0, line, lines[line].length),
        'Task opened here is never closed',
        vscode.DiagnosticSeverity.Error
      )
    );
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

function insertTaskSkeleton() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  const snippet = new vscode.SnippetString(
    'start task "${1:TaskName}":\n  say "${2:Hello world}"\nend task\n'
  );
  editor.insertSnippet(snippet);
}

async function createExampleProject() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('Open a workspace folder before creating a project.');
    return;
  }
  const targetFolder = folders[0].uri;
  const projectDir = vscode.Uri.joinPath(targetFolder, 'roop-example');
  await vscode.workspace.fs.createDirectory(projectDir);

  const example = vscode.Uri.joinPath(projectDir, 'hello.roop');
  const manifest = vscode.Uri.joinPath(projectDir, 'module.roopmodule.json');
  await vscode.workspace.fs.writeFile(example, Buffer.from(`start task "Hello":\n  say "Hello from ROOP"\nend task\n`));
  await vscode.workspace.fs.writeFile(
    manifest,
    Buffer.from(
      JSON.stringify(
        {
          schemaVersion: '1.0',
          module: {
            id: 'example.module',
            name: 'Example Module',
            version: '0.1.0',
            vendor: 'Example',
            category: 'demo',
          },
          capabilities: [
            {
              verb: 'say',
              parameters: [{ name: 'message', type: 'string' }],
              returns: { type: 'void' },
            },
          ],
        },
        null,
        2
      )
    )
  );
  vscode.window.showInformationMessage('Example ROOP project created.', 'Open files').then((choice) => {
    if (choice) {
      vscode.commands.executeCommand('vscode.openFolder', projectDir, { forceNewWindow: false });
    }
  });
}

async function openDocs() {
  const docPath = getDocsPath();
  if (!docPath) {
    vscode.window.showWarningMessage('Unable to locate language reference.');
    return;
  }
  const uri = vscode.Uri.file(docPath);
  await vscode.commands.executeCommand('markdown.showPreview', uri);
}

async function runRuntimeCommand(command) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'roop') {
    vscode.window.showWarningMessage('Open a ROOP document to run this command.');
    return;
  }
  const runtime = resolveRuntimeCli();
  if (!runtime) {
    vscode.window.showErrorMessage('Unable to find the ROOP runtime CLI. Configure roop.runtime.path.');
    return;
  }
  const args = [command, '--file', editor.document.uri.fsPath];
  const output = vscode.window.createOutputChannel('ROOP Runtime');
  output.show(true);
  output.appendLine(`Running: node ${runtime} ${args.join(' ')}`);

  const child = spawn(process.execPath, [runtime, ...args], {
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
  });

  child.stdout.on('data', (chunk) => output.append(chunk.toString()));
  child.stderr.on('data', (chunk) => output.append(chunk.toString()));
  child.on('close', (code) => {
    output.appendLine(`Process exited with code ${code}`);
  });
}

async function scanModules() {
  const matches = await vscode.workspace.findFiles('**/*.roopmodule.json');
  if (matches.length === 0) {
    vscode.window.showInformationMessage('No module manifests found.');
    return;
  }
  const items = matches.map((uri) => uri.fsPath);
  vscode.window.showInformationMessage(`Found ${items.length} module manifest(s).`, 'Show in output').then((choice) => {
    if (choice) {
      const channel = vscode.window.createOutputChannel('ROOP Modules');
      channel.clear();
      channel.show(true);
      items.forEach((item) => channel.appendLine(item));
    }
  });
}

async function generateModuleManifest(uri) {
  const folder = uri?.fsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) {
    vscode.window.showErrorMessage('Open a workspace folder first.');
    return;
  }
  const target = path.join(folder, 'new-module.roopmodule.json');
  if (fs.existsSync(target)) {
    vscode.window.showWarningMessage('new-module.roopmodule.json already exists.');
    return;
  }
  fs.writeFileSync(
    target,
    JSON.stringify(
      {
        schemaVersion: '1.0',
        module: {
          id: 'new.module',
          name: 'New Module',
          version: '0.0.1',
          vendor: 'Unknown',
          category: 'custom',
        },
        capabilities: [],
      },
      null,
      2
    )
  );
  vscode.window.showInformationMessage('Created new-module.roopmodule.json');
  vscode.window.showTextDocument(vscode.Uri.file(target));
}

function registerRobotAutoSimulation(context) {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.languageId === 'roop' && robotProvider && autoSimulateEnabled()) {
        robotProvider.simulateFromText(document.getText(), document.uri);
      }
    })
  );
}

class RoopCompletionProvider {
  constructor() {
    this.keywords = [
      'start task',
      'end task',
      'when',
      'on',
      'if',
      'elseif',
      'else',
      'repeat',
      'while',
      'for',
      'parallel',
      'say',
      'move',
      'wait',
      'ask',
      'log',
    ];
  }

  provideCompletionItems(document, position) {
    const range = document.getWordRangeAtPosition(position) || new vscode.Range(position, position);
    return this.keywords.map((keyword) => {
      const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
      item.range = range;
      return item;
    });
  }
}

class RoopFormattingProvider {
  provideDocumentFormattingEdits(document) {
    const indentSize = vscode.workspace.getConfiguration('roop.format').get('indentSize', 2);
    const edits = [];
    let indentLevel = 0;

    for (let i = 0; i < document.lineCount; i += 1) {
      const line = document.lineAt(i);
      const trimmed = line.text.trim();
      if (!trimmed) {
        continue;
      }
      if (/^end\s+task\b/i.test(trimmed) && indentLevel > 0) {
        indentLevel -= 1;
      }
      const expectedIndent = ' '.repeat(indentLevel * indentSize);
      if (!line.text.startsWith(expectedIndent)) {
        edits.push(vscode.TextEdit.replace(new vscode.Range(i, 0, i, line.firstNonWhitespaceCharacterIndex), expectedIndent));
      }
      if (shouldIncreaseIndent(trimmed)) {
        indentLevel += 1;
      }
    }

    return edits;
  }
}

function shouldIncreaseIndent(trimmed) {
  return BLOCK_HEADERS.some((header) => trimmed.toLowerCase().startsWith(`${header} `) || trimmed.toLowerCase().startsWith(`${header}:`));
}

function resolveRuntimeCli() {
  const config = vscode.workspace.getConfiguration('roop');
  const configuredPath = config.get('runtime.path');
  if (!configuredPath) {
    return null;
  }
  const candidates = [
    path.join(configuredPath, 'dist', 'cli', 'roop-runtime.js'),
    path.join(configuredPath, 'src', 'cli', 'roop-runtime.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function getFirstRoopFile() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return null;
  }
  const folder = folders[0];
  const files = fs.readdirSync(folder.uri.fsPath);
  const match = files.find((name) => name.endsWith('.roop'));
  if (!match) {
    return null;
  }
  return path.join(folder.uri.fsPath, match);
}

function getDocsPath() {
  const extension = vscode.extensions.getExtension('loop-robotics.roop-language-support');
  if (!extension) {
    return null;
  }
  const candidate = path.join(extension.extensionPath, 'language-reference.md');
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  return null;
}

function parseStepsForRobot(text) {
  const lines = text.split(/\r?\n/);
  const steps = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      return;
    }
    if (/^say\b/i.test(trimmed)) {
      steps.push({ type: 'say', text: trimmed });
    } else if (/^move\b/i.test(trimmed)) {
      steps.push({ type: 'move', text: trimmed });
    } else if (/^wait\b/i.test(trimmed)) {
      steps.push({ type: 'wait', text: trimmed });
    } else if (/^ask\b/i.test(trimmed)) {
      steps.push({ type: 'ask', text: trimmed });
    }
  });
  return steps;
}

function autoSimulateEnabled() {
  return vscode.workspace.getConfiguration('roopRobot').get('autoSimulateOnSave', true);
}

module.exports = {
  activate,
  deactivate,
};
