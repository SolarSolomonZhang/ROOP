const vscode = require('vscode');

class RobotViewProvider {
  constructor(extensionUri, parseSteps) {
    this.extensionUri = extensionUri;
    this.parseSteps = parseSteps;
    this.view = null;
    this.currentSteps = [];
  }

  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };
    this.render([]);
  }

  render(steps) {
    this.currentSteps = steps;
    if (!this.view) {
      return;
    }
    const webview = this.view.webview;
    const listItems = steps
      .map((step, index) => `<li><span class="type">${step.type}</span><span class="text">${escapeHtml(step.text)}</span><span class="index">${index + 1}</span></li>`)
      .join('');
    webview.html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: var(--vscode-font-family); margin: 0; padding: 1rem; background: var(--vscode-sideBar-background); color: var(--vscode-foreground); }
      h2 { margin-top: 0; }
      ul { list-style: none; padding: 0; }
      li { display: flex; align-items: center; margin-bottom: 0.5rem; padding: 0.5rem; border-radius: 6px; background: rgba(255, 255, 255, 0.04); }
      .type { width: 4rem; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; color: var(--vscode-textLink-foreground); }
      .text { flex: 1; padding: 0 0.5rem; }
      .index { width: 2rem; text-align: right; opacity: 0.6; }
      .empty { opacity: 0.7; font-style: italic; }
    </style>
  </head>
  <body>
    <h2>Robot Preview</h2>
    ${steps.length === 0 ? '<p class="empty">Save a ROOP file to see the simulated steps.</p>' : `<ul>${listItems}</ul>`}
  </body>
</html>`;
  }

  simulateFromText(text, uri) {
    const steps = this.parseSteps(text);
    this.render(steps);
    if (uri) {
      vscode.window.showInformationMessage(`Simulated ${steps.length} step(s) from ${uri.fsPath}`);
    }
  }

  reveal() {
    this.view?.show?.(true);
  }

  stop() {
    this.render([]);
  }

  toggle() {
    if (!this.view) {
      return;
    }
    if (this.view.visible) {
      this.view.hide();
    } else {
      this.view.show(true);
    }
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { RobotViewProvider };
