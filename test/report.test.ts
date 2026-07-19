/**
 * Unit tests for the human-readable rendering of `concord ci`. renderCi
 * composes the check and overlap reports and appends a combined verdict;
 * these tests pin that verdict and prove both sub-reports are included,
 * including the drift redline — the most involved rendering path.
 *
 * Results are plain objects, so the fixtures are built directly rather than
 * through git: rendering is a pure function of the result shape.
 */

import { stripVTControlCharacters as plain } from 'node:util';
import { describe, expect, it } from 'vitest';

import { renderCi } from '../src/report.js';
import type { CheckResult, Finding } from '../src/commands/check.js';
import type { OverlapResult } from '../src/commands/overlap.js';

function checkResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    baseRef: 'origin/main',
    mergeBase: '31b383ec3417638d9e72c831e91d94287d7bb1c9',
    tip: '31b383ec3417638d9e72c831e91d94287d7bb1c9',
    upToDate: true,
    behind: 0,
    operations: 1,
    changes: ['add-thing'],
    findings: [],
    ...overrides,
  };
}

function overlapResult(overrides: Partial<OverlapResult> = {}): OverlapResult {
  return {
    changes: ['add-thing'],
    requirements: 1,
    overlaps: [],
    ...overrides,
  };
}

const DRIFT_FINDING: Finding = {
  kind: 'drift',
  changeId: 'bob-change',
  domain: 'widgets',
  requirement: 'Widget frobnication',
  operation: 'modified',
  detail: 'requirement changed on origin/main since this branch diverged',
  // the tip changes the SHALL line and appends a scenario, so the redline
  // exercises both a deletion and additions
  baseBlock: '### Requirement: Widget frobnication\nWidgets SHALL frobnicate.',
  tipBlock:
    '### Requirement: Widget frobnication\nWidgets SHALL frobnicate exactly twice.\n\n#### Scenario: Audit\n- **WHEN** audited\n- **THEN** logged',
};

describe('renderCi', () => {
  it('ends with the clean verdict when both analyses pass', () => {
    const lines = renderCi({ check: checkResult(), overlap: overlapResult() }).map(plain);
    expect(lines.at(-1)).toBe('✔ ci clean — no findings, no overlaps');
  });

  it('includes both the check and overlap sub-reports', () => {
    const output = renderCi({ check: checkResult(), overlap: overlapResult() })
      .map(plain)
      .join('\n');
    expect(output).toContain('concord check');
    expect(output).toContain('concord overlap');
  });

  it('reports the combined counts when only the check analysis has findings', () => {
    const lines = renderCi({
      check: checkResult({ findings: [DRIFT_FINDING] }),
      overlap: overlapResult(),
    }).map(plain);
    expect(lines.at(-1)).toBe('✖ ci — 1 finding(s), 0 overlapping requirement(s)');
  });

  it('reports the combined counts when only the overlap analysis has overlaps', () => {
    const lines = renderCi({
      check: checkResult(),
      overlap: overlapResult({
        overlaps: [
          {
            domain: 'widgets',
            requirement: 'Widget frobnication',
            claims: [
              { changeId: 'aaa', operations: ['modified'] },
              { changeId: 'bbb', operations: ['modified'] },
            ],
          },
        ],
      }),
    }).map(plain);
    expect(lines.at(-1)).toBe('✖ ci — 0 finding(s), 1 overlapping requirement(s)');
  });

  it('renders a drift redline showing both the removed and added lines', () => {
    const output = renderCi({
      check: checkResult({ upToDate: false, behind: 1, findings: [DRIFT_FINDING] }),
      overlap: overlapResult(),
    })
      .map(plain)
      .join('\n');
    expect(output).toContain('✖ drift');
    expect(output).toContain('- Widgets SHALL frobnicate.');
    expect(output).toContain('+ Widgets SHALL frobnicate exactly twice.');
    expect(output).toContain('+ #### Scenario: Audit');
  });

  it('renders an appeared-after-divergence drift that has only a tip block', () => {
    // this drift kind carries tipBlock but no baseBlock; the redline should
    // render the whole requirement as added without a base side
    const output = renderCi({
      check: checkResult({
        upToDate: false,
        behind: 1,
        findings: [
          {
            kind: 'drift',
            changeId: 'bob-change',
            domain: 'widgets',
            requirement: 'Widget frobnication',
            operation: 'modified',
            detail: 'requirement appeared on origin/main after this branch diverged',
            tipBlock: '### Requirement: Widget frobnication\nWidgets SHALL frobnicate.',
          },
        ],
      }),
      overlap: overlapResult(),
    })
      .map(plain)
      .join('\n');
    expect(output).toContain('✖ drift');
    expect(output).toContain('+ ### Requirement: Widget frobnication');
  });

  it('renders the fix hint for each non-drift finding kind', () => {
    const findings: Finding[] = [
      {
        kind: 'removed-upstream',
        changeId: 'c',
        domain: 'widgets',
        requirement: 'Legacy mode',
        operation: 'modified',
        detail: 'gone upstream',
      },
      {
        kind: 'target-missing',
        changeId: 'c',
        domain: 'widgets',
        requirement: 'Frobniction',
        operation: 'modified',
        detail: 'no such requirement',
      },
      {
        kind: 'name-collision',
        changeId: 'c',
        domain: 'widgets',
        requirement: 'Widget frobnication',
        operation: 'added',
        detail: 'already exists',
      },
    ];
    const output = renderCi({
      check: checkResult({ findings }),
      overlap: overlapResult(),
    })
      .map(plain)
      .join('\n');
    expect(output).toContain('drop this delta entry or re-target it');
    expect(output).toContain('it must match the spec header exactly');
    expect(output).toContain('convert to a MODIFIED entry against the existing requirement');
    expect(output).toContain('✖ ci — 3 finding(s), 0 overlapping requirement(s)');
  });
});
