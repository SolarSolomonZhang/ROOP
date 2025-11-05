import { parseRoopText, validateRoopText } from './parser.js';
import { executeTaskSequence } from './runtime.js';
import { loadRoopFile } from './io.js';

export function parseRoop(source) {
  return parseRoopText(source);
}

export function validateRoop(source) {
  const diagnostics = validateRoopText(source);
  return { valid: diagnostics.length === 0, diagnostics };
}

export async function runRoop(source, options = {}) {
  const program = parseRoopText(source);
  return executeTaskSequence(program, options);
}

export async function runRoopFile(filePath, options = {}) {
  const source = await loadRoopFile(filePath);
  return runRoop(source, { ...options, filePath });
}

export { parseRoopText, validateRoopText, executeTaskSequence };
