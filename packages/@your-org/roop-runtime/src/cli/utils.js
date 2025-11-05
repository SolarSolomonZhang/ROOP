import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function parseArgs(args) {
  const result = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        result[key] = next;
        i += 1;
      } else {
        result[key] = true;
      }
    } else if (token.startsWith('-')) {
      const key = token.slice(1);
      result[key] = true;
    } else {
      result._.push(token);
    }
  }
  return result;
}

export function resolveInputFile(value) {
  if (!value) {
    return null;
  }
  return resolve(process.cwd(), value);
}

export function toFileUrl(filePath) {
  return pathToFileURL(filePath).toString();
}

export function printDiagnostics(diagnostics) {
  if (diagnostics.length === 0) {
    console.log('No diagnostics.');
    return;
  }
  diagnostics.forEach((diag) => {
    console.log(`${diag.line ?? '?'}:${diag.message} [${diag.severity}]`);
  });
}
