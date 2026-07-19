/**
 * Tests for actions/report.mjs — the reporter that turns concord --json into
 * GitHub annotations, a job step summary, and step outputs. Runs the script as
 * a subprocess (as the composite actions do) over captured JSON fixtures.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPORT = fileURLToPath(new URL('../actions/report.mjs', import.meta.url));

const FINDING = {
  kind: 'drift',
  changeId: 'tighten-frob',
  domain: 'widgets',
  requirement: 'Widget frobnication',
  operation: 'modified',
  detail: 'requirement changed on main since this branch diverged',
};

const CHECK_WITH_FINDING = {
  baseRef: 'origin/main',
  mergeBase: 'dadb152',
  tip: 'abc1234',
  upToDate: false,
  behind: 1,
  operations: 2,
  changes: ['tighten-frob'],
  findings: [FINDING],
};

const CHECK_CLEAN = {
  baseRef: 'origin/main',
  mergeBase: 'dadb152',
  tip: 'dadb152',
  upToDate: true,
  behind: 0,
  operations: 3,
  changes: ['add-widgets'],
  findings: [],
};

const OVERLAP_WITH_ENTRY = {
  changes: ['a', 'b'],
  requirements: 1,
  overlaps: [
    {
      domain: 'widgets',
      requirement: 'Widget frobnication',
      claims: [
        { changeId: 'a', operations: ['modified'] },
        { changeId: 'b', operations: ['modified'] },
      ],
    },
  ],
};

const OVERLAP_CLEAN = { changes: ['a'], requirements: 0, overlaps: [] };

let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

interface RunResult {
  annotations: string;
  summary: string;
  outputs: string;
}

function run(
  command: string,
  data: unknown,
  opts: { annotations?: string; summary?: string; exitCode?: string; withDeltaFile?: boolean } = {}
): RunResult {
  dir = mkdtempSync(join(tmpdir(), 'concord-report-'));
  const input = join(dir, 'concord.json');
  writeFileSync(input, JSON.stringify(data));
  const summaryFile = join(dir, 'summary.md');
  const outputFile = join(dir, 'output.txt');
  writeFileSync(summaryFile, '');
  writeFileSync(outputFile, '');

  if (opts.withDeltaFile) {
    const delta = join(dir, 'openspec', 'changes', 'tighten-frob', 'specs', 'widgets', 'spec.md');
    mkdirSync(dirname(delta), { recursive: true });
    writeFileSync(delta, '## MODIFIED Requirements\n');
  }

  const annotations = execFileSync(
    'node',
    [
      REPORT,
      '--command',
      command,
      '--dir',
      'openspec',
      '--exit-code',
      opts.exitCode ?? '1',
      '--annotations',
      opts.annotations ?? 'true',
      '--summary',
      opts.summary ?? 'true',
      '--input',
      input,
    ],
    {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: summaryFile,
        GITHUB_OUTPUT: outputFile,
      },
    }
  );

  return {
    annotations,
    summary: readFileSync(summaryFile, 'utf8'),
    outputs: readFileSync(outputFile, 'utf8'),
  };
}

describe('report.mjs — ci', () => {
  it('annotates findings and overlaps and sets outputs', () => {
    const r = run('ci', { check: CHECK_WITH_FINDING, overlap: OVERLAP_WITH_ENTRY });

    expect(r.annotations).toContain('::error');
    expect(r.annotations).toContain('title=concord drift');
    expect(r.annotations).toContain('[MODIFIED]');
    expect(r.annotations).toContain('::warning');
    expect(r.annotations).toContain('concord overlap');

    expect(r.summary).toContain('### Findings (1)');
    expect(r.summary).toContain('### Overlaps (1)');
    expect(r.summary).toContain('1 commit(s) behind');

    expect(r.outputs).toContain('findings=1');
    expect(r.outputs).toContain('overlaps=1');
    expect(r.outputs).toContain('exit-code=1');
    expect(r.outputs).toContain('result<<');
  });

  it('targets the delta file when it exists', () => {
    const r = run('ci', { check: CHECK_WITH_FINDING, overlap: OVERLAP_CLEAN }, { withDeltaFile: true });
    expect(r.annotations).toContain(
      'file=openspec/changes/tighten-frob/specs/widgets/spec.md'
    );
  });

  it('omits the file property when the delta file is absent', () => {
    const r = run('ci', { check: CHECK_WITH_FINDING, overlap: OVERLAP_CLEAN });
    expect(r.annotations).toContain('::error');
    expect(r.annotations).not.toContain('file=');
  });

  it('reports a clean run', () => {
    const r = run('ci', { check: CHECK_CLEAN, overlap: OVERLAP_CLEAN }, { exitCode: '0' });
    expect(r.annotations.trim()).toBe('');
    expect(r.summary).toContain('✅ No drift or overlap');
    expect(r.outputs).toContain('findings=0');
    expect(r.outputs).toContain('overlaps=0');
    expect(r.outputs).toContain('exit-code=0');
  });

  it('emits no annotations when disabled but still writes outputs', () => {
    const r = run(
      'ci',
      { check: CHECK_WITH_FINDING, overlap: OVERLAP_WITH_ENTRY },
      { annotations: 'false' }
    );
    expect(r.annotations.trim()).toBe('');
    expect(r.outputs).toContain('findings=1');
  });
});

describe('report.mjs — bare check and overlap shapes', () => {
  it('handles a bare check result', () => {
    const r = run('check', CHECK_WITH_FINDING);
    expect(r.annotations).toContain('title=concord drift');
    expect(r.outputs).toContain('findings=1');
    expect(r.outputs).toContain('overlaps=0');
  });

  it('handles a bare overlap result', () => {
    const r = run('overlap', OVERLAP_WITH_ENTRY);
    expect(r.annotations).toContain('concord overlap');
    expect(r.summary).toContain('### Overlaps (1)');
    expect(r.outputs).toContain('overlaps=1');
    expect(r.outputs).toContain('findings=0');
  });
});
