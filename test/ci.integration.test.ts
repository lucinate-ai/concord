/**
 * Integration tests for `concord ci` — the combined check + overlap gate —
 * against real throwaway git repositories, mirroring the check tests.
 * Exit-code contract: the CLI exits 1 exactly when findings or overlaps are
 * non-empty, so the assertions here pin that condition.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runCi } from '../src/commands/ci.js';
import { runCheck } from '../src/commands/check.js';
import { runOverlap } from '../src/commands/overlap.js';

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
  git('commit', '-q', '-m', message);
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

const FROB_DELTA = `## MODIFIED Requirements

### Requirement: Widget frobnication
Widgets SHALL frobnicate exactly twice.

#### Scenario: Basic frob
- **WHEN** frobbed
- **THEN** frobnicates twice
`;

const LEGACY_DELTA = `## MODIFIED Requirements

### Requirement: Legacy mode
Legacy SHALL be celebrated.

#### Scenario: Party
- **WHEN** legacy
- **THEN** party
`;

function initRepo() {
  dir = mkdtempSync(join(tmpdir(), 'concord-ci-'));
  git('init', '-q', '-b', 'main');
  // hermetic identity: CI runners have no global git config
  git('config', 'user.email', 'concord-test@example.invalid');
  git('config', 'user.name', 'concord-test');
  write('openspec/specs/widgets/spec.md', SPEC_V0);
  commitAll('spec v0');
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('runCi', () => {
  it('is clean when both analyses pass (exit-0 contract)', async () => {
    initRepo();
    write('openspec/changes/good-change/specs/widgets/spec.md', FROB_DELTA);

    const result = await runCi({ cwd: dir });
    expect(result.check.upToDate).toBe(true);
    expect(result.check.findings).toHaveLength(0);
    expect(result.overlap.changes).toEqual(['good-change']);
    expect(result.overlap.overlaps).toHaveLength(0);
  });

  it('surfaces findings when only the check analysis has problems (exit-1 contract)', async () => {
    initRepo();
    write(
      'openspec/changes/typo-change/specs/widgets/spec.md',
      '## MODIFIED Requirements\n\n### Requirement: Widget frobniction\nTypo.\n'
    );

    const result = await runCi({ cwd: dir });
    expect(result.check.findings).toHaveLength(1);
    expect(result.check.findings[0].kind).toBe('target-missing');
    expect(result.overlap.overlaps).toHaveLength(0);
  });

  it('surfaces overlaps when only the overlap analysis has problems (exit-1 contract)', async () => {
    initRepo();
    write('openspec/changes/aaa-change/specs/widgets/spec.md', FROB_DELTA);
    write('openspec/changes/bbb-change/specs/widgets/spec.md', FROB_DELTA);

    const result = await runCi({ cwd: dir });
    expect(result.check.findings).toHaveLength(0);
    expect(result.overlap.overlaps).toHaveLength(1);
    expect(result.overlap.overlaps[0]).toMatchObject({
      domain: 'widgets',
      requirement: 'Widget frobnication',
    });
    expect(result.overlap.overlaps[0].claims.map((c) => c.changeId)).toEqual([
      'aaa-change',
      'bbb-change',
    ]);
  });

  it("matches the individual commands' results for the same repo state", async () => {
    initRepo();
    write('openspec/changes/aaa-change/specs/widgets/spec.md', FROB_DELTA);
    write('openspec/changes/bbb-change/specs/widgets/spec.md', FROB_DELTA);

    const ci = await runCi({ cwd: dir });
    expect(ci.check).toEqual(await runCheck({ cwd: dir }));
    expect(ci.overlap).toEqual(await runOverlap({ cwd: dir }));
  });

  it('restricts the check analysis with --change but overlap still sees all changes', async () => {
    initRepo();
    write('openspec/changes/aaa-change/specs/widgets/spec.md', FROB_DELTA);
    write('openspec/changes/bbb-change/specs/widgets/spec.md', LEGACY_DELTA);

    const result = await runCi({ cwd: dir, change: 'aaa-change' });
    expect(result.check.changes).toEqual(['aaa-change']);
    expect(result.check.operations).toBe(1);
    expect(result.overlap.changes).toEqual(['aaa-change', 'bbb-change']);
  });
});
