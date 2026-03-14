import { spawn } from 'node:child_process';

const processes = [
  { name: 'frontend', args: ['--filter', '@yotara/frontend', 'dev'] },
  { name: 'api', args: ['--filter', '@yotara/api', 'dev'] },
  { name: 'studio', args: ['--filter', '@yotara/api', 'db:studio'], optional: true },
];
const DRIZZLE_STUDIO_URL = 'https://local.drizzle.studio';

const children = [];
let shuttingDown = false;
let announcedStudioUrl = false;

function prefixOutput(name, chunk, writer) {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.length === 0 && index === lines.length - 1) {
      continue;
    }

    writer(`[${name}] ${line}\n`);

    if (
      name === 'studio' &&
      !announcedStudioUrl &&
      line.includes('Drizzle Studio is up and running on')
    ) {
      announcedStudioUrl = true;
      process.stdout.write(`\n[dev] Drizzle Studio: ${DRIZZLE_STUDIO_URL}\n\n`);
    }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
    process.exit(code);
  }, 1000).unref();
}

for (const processConfig of processes) {
  const child = spawn('pnpm', processConfig.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  children.push(child);

  child.stdout.on('data', (chunk) =>
    prefixOutput(processConfig.name, chunk, process.stdout.write.bind(process.stdout)),
  );
  child.stderr.on('data', (chunk) =>
    prefixOutput(processConfig.name, chunk, process.stderr.write.bind(process.stderr)),
  );

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0 || signal === 'SIGTERM') {
      shutdown(code ?? 0);
      return;
    }

    if (processConfig.optional) {
      process.stderr.write(
        `[${processConfig.name}] exited with code ${code ?? 'unknown'}; continuing\n`,
      );
      return;
    }

    process.stderr.write(`[${processConfig.name}] exited with code ${code ?? 'unknown'}\n`);
    shutdown(code ?? 1);
  });
}

process.stdout.write(`[dev] Starting frontend, api, and Drizzle Studio\n`);
process.stdout.write(`[dev] Drizzle Studio URL: ${DRIZZLE_STUDIO_URL}\n\n`);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
