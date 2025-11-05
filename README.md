# ROOP Monorepo

This repository bundles two pieces of tooling for the ROOP domain specific language:

- `packages/@your-org/roop-runtime` – a lightweight, dependency-free Node.js runtime and CLI for executing simple ROOP task files.
- `packages/roop-vscode` – a Visual Studio Code extension that offers syntax colouring, completions, formatting, diagnostics, and a robot preview webview backed by the runtime CLI.

The repository intentionally avoids external npm dependencies so it can be installed and built in restricted environments.

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- VS Code 1.84 or newer (for running the extension)

## Installation

From the repository root simply run:

```bash
npm install
```

Because the workspaces have no external dependencies this command completes instantly.

## Build

```bash
npm run build
```

This copies the runtime sources into a `dist/` directory and prepares the VS Code extension output files.

## Tests

```bash
npm test
```

A small smoke test parses and runs the bundled `hello.roop` example through the runtime.

## Running the runtime manually

```bash
node packages/@your-org/roop-runtime/src/cli/roop-runtime.js run --file packages/@your-org/roop-runtime/src/examples/hello.roop
```

Use `--json` to emit structured output or `--task` to target a single task.

## VS Code extension

1. Run `npm run build` to ensure the runtime `dist/` directory is populated.
2. Launch VS Code with the extension development host:
   ```bash
   code --extensionDevelopmentPath=packages/roop-vscode
   ```
3. Open a `.roop` file. The extension will provide completions, formatting, diagnostics, commands, and the robot preview view.

The extension uses the workspace runtime by default. You can change the location via the `roop.runtime.path` setting.
