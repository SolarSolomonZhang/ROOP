import { loadRoopFile } from '../../io.js';
import { parseRoopText, validateRoopText } from '../../parser.js';
import { executeTaskSequence } from '../../runtime.js';
import { parseArgs, resolveInputFile } from '../utils.js';

export async function runCommand(argv) {
  const args = parseArgs(argv);
  const file = resolveInputFile(args.file || args._[0]);
  if (!file) {
    throw new Error('Please provide a ROOP file via --file <path>');
  }

  const source = await loadRoopFile(file);
  const diagnostics = validateRoopText(source);
  if (diagnostics.some((diag) => diag.severity === 'error')) {
    diagnostics.forEach((diag) => {
      console.error(`${file}:${diag.line ?? '?'} - ${diag.severity} ${diag.message}`);
    });
    throw new Error('Validation failed');
  }

  const program = parseRoopText(source);
  const taskName = args.task || null;
  const results = await executeTaskSequence(program, {
    task: taskName,
    quiet: Boolean(args.quiet || args.json),
  });

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
  }

  return results;
}
