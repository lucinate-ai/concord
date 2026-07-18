/** Thin async wrappers over the git CLI. */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class GitError extends Error {
  constructor(
    message: string,
    public readonly args: string[]
  ) {
    super(message);
    this.name = 'GitError';
  }
}

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout.replace(/\n$/, '');
  } catch (error) {
    const stderr =
      error instanceof Error && 'stderr' in error
        ? String((error as { stderr?: unknown }).stderr).trim()
        : String(error);
    throw new GitError(stderr || `git ${args.join(' ')} failed`, args);
  }
}

export async function repoRoot(cwd: string): Promise<string> {
  return git(cwd, ['rev-parse', '--show-toplevel']);
}

export async function revParse(cwd: string, ref: string): Promise<string> {
  return git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]);
}

/**
 * Resolve the base ref the branch will eventually merge into. An explicit
 * ref wins (and must exist); otherwise try origin's default branch, then
 * the conventional names.
 */
export async function resolveBaseRef(cwd: string, explicit?: string): Promise<string> {
  if (explicit) {
    await revParse(cwd, explicit); // throws GitError if missing
    return explicit;
  }
  try {
    const symbolic = await git(cwd, ['rev-parse', '--abbrev-ref', 'origin/HEAD']);
    if (symbolic && symbolic !== 'origin/HEAD') return symbolic;
  } catch {
    // fall through to conventional names
  }
  for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
    try {
      await revParse(cwd, candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new GitError(
    'could not resolve a base ref (tried origin/HEAD, origin/main, origin/master, main, master); pass one with --base',
    []
  );
}

export async function mergeBase(cwd: string, a: string, b: string): Promise<string> {
  return git(cwd, ['merge-base', a, b]);
}

/** Commits on `ref` that are not on `from` — how far the base has moved. */
export async function commitsBetween(cwd: string, from: string, ref: string): Promise<number> {
  const out = await git(cwd, ['rev-list', '--count', `${from}..${ref}`]);
  return Number.parseInt(out, 10);
}

/** File contents at a ref, or null when the path does not exist there. */
export async function showFile(
  cwd: string,
  ref: string,
  path: string
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['show', `${ref}:${path}`], {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}
