import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp } from '../server.js';

export async function getOpenApiJson() {
  const app = await buildApp();

  try {
    await app.ready();
    const spec = app.swagger();
    return JSON.stringify(spec, null, 2);
  } finally {
    await app.close();
  }
}

async function main() {
  const output = await getOpenApiJson();
  const target = process.argv[2];

  if (target) {
    await writeFile(resolve(process.cwd(), target), `${output}\n`, 'utf8');
    return;
  }

  process.stdout.write(`${output}\n`);
}

const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  await main();
}
