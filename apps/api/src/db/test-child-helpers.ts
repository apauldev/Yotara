import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Shared plumbing for tests that need a *second process* on the same SQLite
 * file. better-sqlite3 is synchronous, so an in-process contender would block
 * the very thread that needs to release the lock and could only ever run out
 * the timeout.
 */

export function spawnNode(
  script: string,
  args: string[],
): { child: ChildProcess; stdout: NodeJS.ReadableStream; stderr: NodeJS.ReadableStream } {
  const child = spawn(process.execPath, ['-e', script, ...args], {
    // The apps/api package root, so the child can require('better-sqlite3').
    cwd: new URL('../../', import.meta.url),
  });
  if (!child.stdout || !child.stderr) {
    throw new Error('child process missing stdio pipes');
  }
  return { child, stdout: child.stdout, stderr: child.stderr };
}

export function waitForLine(
  child: ChildProcess,
  stdout: NodeJS.ReadableStream,
  line: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      if (buffer.includes(line)) {
        cleanup();
        resolve();
      }
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      reject(new Error(`child exited before printing '${line}' (code ${code}, signal ${signal})`));
    };
    const cleanup = () => {
      stdout.off('data', onData);
      child.off('exit', onExit);
    };
    stdout.on('data', onData);
    child.once('exit', onExit);
  });
}

export function waitForExit(
  child: ChildProcess,
): Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string }> {
  return new Promise((resolve) => {
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once('exit', (code, signal) => resolve({ code, signal, stderr }));
  });
}
