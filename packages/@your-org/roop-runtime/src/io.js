import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function loadRoopFile(filePath) {
  const absolute = resolve(process.cwd(), filePath);
  const buffer = await readFile(absolute);
  return buffer.toString('utf8');
}
