/**
 * Discovery of open changes and their delta files in an OpenSpec directory.
 * Deltas are read from the working tree (the branch's current state,
 * including uncommitted edits); spec baselines are read from git refs.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { parseDelta, type DeltaOperation } from './delta.js';

export interface ChangeDelta {
  changeId: string;
  /** Domain path relative to the change's specs/ dir, POSIX-separated. */
  domain: string;
  /** Delta file path relative to the repo root, POSIX-separated. */
  file: string;
  operations: DeltaOperation[];
}

function walkMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

/**
 * Enumerate open changes (everything under `changes/` except `archive/`)
 * and parse each change's delta files.
 */
export function discoverChanges(
  repoRoot: string,
  openspecDir: string,
  filterChange?: string
): ChangeDelta[] {
  const changesDir = join(repoRoot, openspecDir, 'changes');
  if (!existsSync(changesDir) || !statSync(changesDir).isDirectory()) return [];

  const deltas: ChangeDelta[] = [];
  for (const entry of readdirSync(changesDir, { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name)
  )) {
    if (!entry.isDirectory() || entry.name === 'archive') continue;
    if (entry.name.startsWith('.')) continue;
    if (filterChange && entry.name !== filterChange) continue;

    const specsDir = join(changesDir, entry.name, 'specs');
    if (!existsSync(specsDir)) continue;

    for (const file of walkMarkdownFiles(specsDir)) {
      const operations = parseDelta(readFileSync(file, 'utf8'));
      if (operations.length === 0) continue;
      const domainDir = relative(specsDir, join(file, '..'));
      deltas.push({
        changeId: entry.name,
        domain: toPosix(domainDir),
        file: toPosix(relative(repoRoot, file)),
        operations,
      });
    }
  }
  return deltas;
}
