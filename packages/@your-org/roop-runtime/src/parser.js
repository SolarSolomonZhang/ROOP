const BLOCK_HEADERS = [
  'when',
  'on',
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

export function parseRoopText(source) {
  const lines = source.split(/\r?\n/);
  const tasks = [];
  let currentTask = null;
  const stack = [];

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) {
      return;
    }

    const startMatch = line.match(/^start\s+task\s+"([^"]+)"/i);
    if (startMatch) {
      if (currentTask) {
        stack.push(currentTask);
      }
      currentTask = {
        name: startMatch[1],
        body: [],
        line: lineNumber,
      };
      tasks.push(currentTask);
      return;
    }

    if (/^end\s+task/i.test(line)) {
      if (stack.length > 0) {
        currentTask = stack.pop();
      } else {
        currentTask = null;
      }
      return;
    }

    if (!currentTask) {
      // Treat stray statements as belonging to an implicit task.
      currentTask = {
        name: 'Main',
        body: [],
        line: lineNumber,
      };
      tasks.push(currentTask);
    }

    currentTask.body.push({
      text: line,
      raw: rawLine,
      line: lineNumber,
      indent: rawLine.match(/^\s*/)[0].length,
    });
  });

  return { tasks };
}

export function validateRoopText(source) {
  const diagnostics = [];
  const lines = source.split(/\r?\n/);
  const taskStack = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const lineNumber = index + 1;

    if (!line || line.startsWith('//')) {
      return;
    }

    const header = BLOCK_HEADERS.find((keyword) =>
      line.toLowerCase().startsWith(`${keyword} `) || line.toLowerCase().startsWith(`${keyword}:`)
    );
    if (header && !line.endsWith(':') && !/^start\s+task/i.test(line)) {
      diagnostics.push({
        line: lineNumber,
        message: `Expected ':' at the end of '${header}' block header`,
        severity: 'warning',
      });
    }

    if (/^start\s+task\b/i.test(line)) {
      taskStack.push({ line: lineNumber, text: line });
    } else if (/^end\s+task\b/i.test(line)) {
      if (taskStack.length === 0) {
        diagnostics.push({
          line: lineNumber,
          message: 'Encountered end task without a matching start task',
          severity: 'error',
        });
      } else {
        taskStack.pop();
      }
    }
  });

  taskStack.forEach((task) => {
    diagnostics.push({
      line: task.line,
      message: `Task opened here is never closed: ${task.text}`,
      severity: 'error',
    });
  });

  return diagnostics;
}
