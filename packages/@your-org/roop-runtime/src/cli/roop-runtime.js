#!/usr/bin/env node
import { runCommand } from './commands/run.js';
import { validateCommand } from './commands/validate.js';
import { execCommand } from './commands/exec.js';

async function main() {
  const [command = 'run', ...rest] = process.argv.slice(2);
  try {
    switch (command) {
      case 'run':
        await runCommand(rest);
        break;
      case 'validate':
        await validateCommand(rest);
        break;
      case 'exec':
        await execCommand(rest);
        break;
      case 'help':
      case '--help':
        printHelp();
        break;
      case '--version':
      case 'version':
        printVersion();
        break;
      default:
        console.error(`Unknown command '${command}'.`);
        printHelp();
        process.exitCode = 1;
    }
  } catch (error) {
    process.exitCode = 1;
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
  }
}

function printHelp() {
  console.log(`ROOP Runtime CLI\n\nUsage:\n  roop-runtime run --file path.roop [--task name] [--json]\n  roop-runtime validate --file path.roop\n  roop-runtime exec <file...>\n`);
}

function printVersion() {
  console.log('roop-runtime 0.4.0');
}

main();
