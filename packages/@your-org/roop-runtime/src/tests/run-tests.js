import { parseRoop, validateRoop, runRoop } from '../index.js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const examplePath = join(__dirname, '..', 'examples', 'hello.roop');
  const source = await readFile(examplePath, 'utf8');

  const parsed = parseRoop(source);
  if (!parsed.tasks || parsed.tasks.length === 0) {
    throw new Error('Parser did not return any tasks');
  }

  const validation = validateRoop(source);
  if (!validation.valid) {
    throw new Error('Expected example to be valid');
  }

  await runRoop(source, { quiet: true });
  console.log('All runtime smoke tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
