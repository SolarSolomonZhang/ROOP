import { runCommand } from './run.js';
import { parseArgs } from '../utils.js';

export async function execCommand(argv) {
  const args = parseArgs(argv);
  const files = args._;
  if (files.length === 0) {
    throw new Error('Provide one or more ROOP files to execute');
  }
  const summaries = [];
  for (const file of files) {
    const result = await runCommand(['--file', file, ...(args.task ? ['--task', args.task] : []), ...(args.json ? ['--json'] : [])]);
    summaries.push({ file, result });
  }
  if (args.json) {
    console.log(JSON.stringify(summaries, null, 2));
  }
  return summaries;
}
