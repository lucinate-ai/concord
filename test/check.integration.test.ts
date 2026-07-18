/**
 * Integration tests against real throwaway git repositories, reproducing the
 * concurrent-change scenarios concord exists to catch — including the
 * silent-clobber case: a delta derived from a requirement that has since
 * changed on the base branch.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runCheck } from '../src/commands/check.js';

let dir: string;

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

function write(rel: string, content: string) {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function commitAll(message: string) {
  git('add', '-A');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', message);
}

const SPEC_V0 = `# Widgets Specification

## Purpose

Widgets.

## Requirements

### Requirement: Widget frobnication
Widgets SHALL frobnicate.

#### Scenario: Basic frob
- **WHEN** frobbed
- **THEN** frobnicates

### Requirement: Legacy mode
Legacy SHALL be tolerated.

#### Scenario: Old client
- **WHEN** an old client connects
- **THEN** it is tolerated
`;

/** Spec after "Alice" lands her change on main: frobnication gains a scenario. */
const SPEC_ALICE = SPEC_V0.replace(
  '- **THEN** frobnicates\n',
  '- **THEN** frobnicates\n\n#### Scenario: Alice frob audit\n- **WHEN** audited\n- **THEN** frobs are logged\n'
);

const BOB_DELTA = `## MODIFIED Requirements

### Requirement: Widget frobnication
Widgets SHALL frobnicate exactly twice.

#### Scenario: Basic frob
- **WHEN** frobbed
- **THEN** frobnicates twice
`;

function initRepo() {
  dir = mkdtempSync(join(tmpdir(), 'concord-check-'));
  git('init', '-q', '-b', 'main');
  write('openspec/specs/widgets/spec.md', SPEC_V0);
  commitAll('spec v0');
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('runCheck', () => {
  it('detects drift when the base moved under a MODIFIED entry (the silent-clobber case)', async () => {
    initRepo();
    // Bob branches and writes a delta derived from spec v0
    git('checkout', '-q', '-b', 'bob');
    write('openspec/changes/bob-change/specs/widgets/spec.md', BOB_DELTA);
    commitAll('bob delta');
    // Alice lands her edit to the same requirement on main
    git('checkout', '-q', 'main');
    write('openspec/specs/widgets/spec.md', SPEC_ALICE);
    commitAll('alice edit');
    git('checkout', '-q', 'bob');

    const result = await runCheck({ cwd: dir });
    expect(result.upToDate).toBe(false);
    expect(result.behind).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      kind: 'drift',
      changeId: 'bob-change',
      domain: 'widgets',
      requirement: 'Widget frobnication',
      operation: 'modified',
    });
    expect(result.findings[0].tipBlock).toContain('Alice frob audit');
  });

  it('clears the drift once the branch merges the base and the block is re-derived', async () => {
    initRepo();
    git('checkout', '-q', '-b', 'bob');
    write('openspec/changes/bob-change/specs/widgets/spec.md', BOB_DELTA);
    commitAll('bob delta');
    git('checkout', '-q', 'main');
    write('openspec/specs/widgets/spec.md', SPEC_ALICE);
    commitAll('alice edit');
    git('checkout', '-q', 'bob');
    git('merge', '-q', '--no-edit', 'main'); // merge-base advances to main tip

    const result = await runCheck({ cwd: dir });
    expect(result.upToDate).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('flags a requirement removed upstream since the branch diverged', async () => {
    initRepo();
    git('checkout', '-q', '-b', 'bob');
    write(
      'openspec/changes/bob-change/specs/widgets/spec.md',
      '## MODIFIED Requirements\n\n### Requirement: Legacy mode\nLegacy SHALL be celebrated.\n\n#### Scenario: Party\n- **WHEN** legacy\n- **THEN** party\n'
    );
    commitAll('bob delta');
    git('checkout', '-q', 'main');
    write('openspec/specs/widgets/spec.md', SPEC_V0.slice(0, SPEC_V0.indexOf('### Requirement: Legacy mode')).trimEnd() + '\n');
    commitAll('remove legacy mode');
    git('checkout', '-q', 'bob');

    const result = await runCheck({ cwd: dir });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].kind).toBe('removed-upstream');
  });

  it('flags a target that never existed (name typo)', async () => {
    initRepo();
    write(
      'openspec/changes/typo-change/specs/widgets/spec.md',
      '## MODIFIED Requirements\n\n### Requirement: Widget frobniction\nTypo.\n'
    );

    const result = await runCheck({ cwd: dir });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].kind).toBe('target-missing');
  });

  it('flags an ADDED name that already exists and a RENAMED target collision', async () => {
    initRepo();
    write(
      'openspec/changes/clash-change/specs/widgets/spec.md',
      '## ADDED Requirements\n\n### Requirement: Widget frobnication\nDuplicate.\n\n## RENAMED Requirements\n- FROM: `### Requirement: Legacy mode`\n- TO: `### Requirement: Widget frobnication`\n'
    );

    const result = await runCheck({ cwd: dir });
    const kinds = result.findings.map((f) => f.kind);
    expect(kinds).toEqual(['name-collision', 'name-collision']);
  });

  it('is clean when the branch is level with the base and names all resolve', async () => {
    initRepo();
    write('openspec/changes/good-change/specs/widgets/spec.md', BOB_DELTA);

    const result = await runCheck({ cwd: dir });
    expect(result.upToDate).toBe(true);
    expect(result.operations).toBe(1);
    expect(result.findings).toHaveLength(0);
  });

  it('honours an explicit --base ref', async () => {
    initRepo();
    git('checkout', '-q', '-b', 'release');
    write('openspec/changes/rel-change/specs/widgets/spec.md', BOB_DELTA);
    commitAll('rel delta');

    const result = await runCheck({ cwd: dir, base: 'main' });
    expect(result.baseRef).toBe('main');
    expect(result.findings).toHaveLength(0);
  });
});
