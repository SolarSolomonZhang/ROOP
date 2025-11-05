import { loadRoopFile } from '../../io.js';
import { parseRoopText, validateRoopText } from '../../parser.js';
import { parseArgs, resolveInputFile, printDiagnostics } from '../utils.js';

export async function validateCommand(argv) {
  const args = parseArgs(argv);
  const file = resolveInputFile(args.file || args._[0]);
  if (!file) {
    throw new Error('Please provide a ROOP file to validate');
  }
  const source = await loadRoopFile(file);
  const diagnostics = validateRoopText(source);
  if (!args.quiet) {
    printDiagnostics(diagnostics);
  }
  if (args.json) {
    console.log(JSON.stringify({ file, diagnostics, valid: diagnostics.length === 0 }, null, 2));
  }
  parseRoopText(source); // ensures parsing doesn't throw
  return diagnostics;
}
