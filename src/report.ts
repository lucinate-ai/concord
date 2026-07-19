/** Human-readable rendering for check and overlap results. */

import chalk from 'chalk';

import { canonicalize } from './core/canonical.js';
import { compressContext, diffLines } from './core/diff.js';
import type { CheckResult, Finding } from './commands/check.js';
import type { OverlapResult } from './commands/overlap.js';
import type { CiResult } from './commands/ci.js';

function redline(baseBlock: string | undefined, tipBlock: string | undefined): string[] {
  const baseLines = baseBlock ? canonicalize(baseBlock).split('\n') : [];
  const tipLines = tipBlock ? canonicalize(tipBlock).split('\n') : [];
  return compressContext(diffLines(baseLines, tipLines)).map((line) => {
    switch (line.type) {
      case 'del':
        return chalk.red(`    - ${line.text}`);
      case 'add':
        return chalk.green(`    + ${line.text}`);
      default:
        return chalk.dim(`      ${line.text}`);
    }
  });
}

function fixHint(finding: Finding, baseRef: string): string {
  switch (finding.kind) {
    case 'drift':
      return `re-derive this delta block against ${baseRef}, then merge or rebase so the merge-base advances`;
    case 'removed-upstream':
      return `the requirement is gone on ${baseRef} — drop this delta entry or re-target it`;
    case 'target-missing':
      return `check the requirement name — it must match the spec header exactly (OpenSpec matches trimmed names)`;
    case 'name-collision':
      return `pick a different name, or convert to a MODIFIED entry against the existing requirement`;
  }
}

export function renderCheck(result: CheckResult): string[] {
  const lines: string[] = [];
  const short = result.mergeBase.slice(0, 7);
  const state = result.upToDate
    ? 'branch is level with the base — stale-base drift cannot occur'
    : `merge-base ${short}; base has moved ${result.behind} commit(s) since this branch diverged`;
  lines.push(chalk.bold(`concord check`) + chalk.dim(` — base ${result.baseRef} (${state})`));
  lines.push('');

  if (result.findings.length === 0) {
    lines.push(
      chalk.green(
        `✔ clean — ${result.operations} operation(s) across ${result.changes.length} change(s) verified against ${result.baseRef}`
      )
    );
    return lines;
  }

  for (const finding of result.findings) {
    lines.push(
      chalk.red(`✖ ${finding.kind}`) +
        `  ${finding.changeId} → ${finding.domain} / ${chalk.bold(`"${finding.requirement}"`)} ` +
        chalk.dim(`[${finding.operation.toUpperCase()}]`)
    );
    lines.push(`    ${finding.detail}`);
    if (finding.kind === 'drift' && (finding.baseBlock || finding.tipBlock)) {
      lines.push(
        chalk.dim(`    --- at merge-base (your baseline)   +++ at ${result.baseRef} (current)`)
      );
      lines.push(...redline(finding.baseBlock, finding.tipBlock));
    }
    lines.push(chalk.cyan(`    fix: ${fixHint(finding, result.baseRef)}`));
    lines.push('');
  }

  lines.push(
    chalk.red(
      `${result.findings.length} finding(s) across ${result.changes.length} change(s); ${result.operations} operation(s) checked`
    )
  );
  return lines;
}

export function renderOverlap(result: OverlapResult): string[] {
  const lines: string[] = [];
  lines.push(
    chalk.bold('concord overlap') +
      chalk.dim(
        ` — ${result.changes.length} open change(s), ${result.requirements} claimed requirement(s)`
      )
  );
  lines.push('');

  if (result.overlaps.length === 0) {
    lines.push(chalk.green('✔ no requirement is claimed by more than one open change'));
    return lines;
  }

  for (const overlap of result.overlaps) {
    lines.push(
      chalk.yellow('⚠ overlap') +
        `  ${overlap.domain} / ${chalk.bold(`"${overlap.requirement}"`)}`
    );
    for (const claim of overlap.claims) {
      lines.push(`    - ${claim.changeId} ${chalk.dim(`[${claim.operations.join(', ').toUpperCase()}]`)}`);
    }
    lines.push(
      chalk.cyan(
        '    fix: land one change first, then re-derive the other against the merged spec (or split the requirement)'
      )
    );
    lines.push('');
  }

  lines.push(chalk.yellow(`${result.overlaps.length} overlapping requirement(s)`));
  return lines;
}

export function renderCi(result: CiResult): string[] {
  const findings = result.check.findings.length;
  const overlaps = result.overlap.overlaps.length;
  const summary =
    findings === 0 && overlaps === 0
      ? chalk.green('✔ ci clean — no findings, no overlaps')
      : chalk.red(`✖ ci — ${findings} finding(s), ${overlaps} overlapping requirement(s)`);
  return [
    ...renderCheck(result.check),
    '',
    ...renderOverlap(result.overlap),
    '',
    summary,
  ];
}
