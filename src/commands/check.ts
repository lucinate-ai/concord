/**
 * `concord check` — drift and target-integrity checks for open OpenSpec
 * changes, with no stored state.
 *
 * The trick: for a PR branch, the base a delta block was derived from is the
 * requirement's text at merge-base(HEAD, baseRef); the version it will land
 * on is the text at the baseRef tip. If a requirement a delta MODIFIES,
 * REMOVES or RENAMES changed between those two commits, the base has moved
 * underneath the author — exactly the situation where archiving would
 * silently clobber the upstream edit. Rebasing or merging the base branch
 * advances the merge-base, which clears the finding once the author has
 * re-derived the block.
 */

import {
  mergeBase,
  repoRoot,
  resolveBaseRef,
  revParse,
  showFile,
  commitsBetween,
} from '../git.js';
import { discoverChanges } from '../core/discover.js';
import { parseSpec, findRequirement } from '../core/spec.js';
import { blocksEqual } from '../core/canonical.js';
import type { OperationType } from '../core/delta.js';
import { ConcordError } from '../errors.js';

export type FindingKind =
  | 'drift'
  | 'removed-upstream'
  | 'target-missing'
  | 'name-collision';

export interface Finding {
  kind: FindingKind;
  changeId: string;
  domain: string;
  requirement: string;
  operation: OperationType;
  detail: string;
  /** Requirement text at the merge-base (what the author derived from). */
  baseBlock?: string;
  /** Requirement text at the baseRef tip (what archive would overwrite). */
  tipBlock?: string;
}

export interface CheckResult {
  baseRef: string;
  mergeBase: string;
  tip: string;
  upToDate: boolean;
  /** Commits on baseRef since the merge-base. */
  behind: number;
  operations: number;
  changes: string[];
  findings: Finding[];
}

export interface CheckOptions {
  cwd?: string;
  /** OpenSpec directory relative to the repo root. */
  dir?: string;
  /** Base ref override (defaults to origin's default branch). */
  base?: string;
  /** Restrict to a single change id. */
  change?: string;
}

export async function runCheck(options: CheckOptions = {}): Promise<CheckResult> {
  const cwd = options.cwd ?? process.cwd();
  const dir = options.dir ?? 'openspec';

  const root = await repoRoot(cwd);
  const baseRef = await resolveBaseRef(root, options.base);
  const tip = await revParse(root, baseRef);
  const base = await mergeBase(root, 'HEAD', baseRef);
  const upToDate = base === tip;
  const behind = upToDate ? 0 : await commitsBetween(root, base, baseRef);

  const deltas = discoverChanges(root, dir, options.change);
  if (options.change && deltas.length === 0) {
    throw new ConcordError(
      `change '${options.change}' not found under ${dir}/changes/ (or it has no delta specs)`
    );
  }

  const findings: Finding[] = [];
  let operations = 0;
  const changeIds = new Set<string>();

  for (const delta of deltas) {
    changeIds.add(delta.changeId);
    const specPath = `${dir}/specs/${delta.domain}/spec.md`;

    const tipContent = await showFile(root, baseRef, specPath);
    const baseContent = upToDate ? tipContent : await showFile(root, base, specPath);
    const tipReqs = tipContent ? parseSpec(tipContent) : [];
    const baseReqs = baseContent ? parseSpec(baseContent) : [];

    for (const op of delta.operations) {
      operations++;
      const common = {
        changeId: delta.changeId,
        domain: delta.domain,
        operation: op.type,
      };

      if (op.type === 'added') {
        if (findRequirement(tipReqs, op.name)) {
          findings.push({
            ...common,
            kind: 'name-collision',
            requirement: op.name,
            detail: `ADDED requirement already exists on ${baseRef} — archiving would duplicate or clobber it`,
          });
        }
        continue;
      }

      // modified / removed / renamed all target an existing requirement
      const tipBlock = findRequirement(tipReqs, op.name);
      const baseBlock = findRequirement(baseReqs, op.name);

      if (!tipBlock) {
        findings.push({
          ...common,
          kind: baseBlock ? 'removed-upstream' : 'target-missing',
          requirement: op.name,
          detail: baseBlock
            ? `requirement existed when this branch diverged but is gone from ${baseRef} — removed or renamed upstream`
            : `no requirement with this name exists on ${baseRef} (${specPath}) — archive cannot apply this ${op.type.toUpperCase()} entry`,
          baseBlock: baseBlock?.raw,
        });
        continue;
      }

      if (!upToDate) {
        if (!baseBlock) {
          findings.push({
            ...common,
            kind: 'drift',
            requirement: op.name,
            detail: `requirement appeared on ${baseRef} after this branch diverged — the delta cannot have been derived from it`,
            tipBlock: tipBlock.raw,
          });
        } else if (!blocksEqual(baseBlock.raw, tipBlock.raw)) {
          findings.push({
            ...common,
            kind: 'drift',
            requirement: op.name,
            detail: `requirement changed on ${baseRef} since this branch diverged — archiving this ${op.type.toUpperCase()} entry would silently discard that change`,
            baseBlock: baseBlock.raw,
            tipBlock: tipBlock.raw,
          });
        }
      }

      if (op.type === 'renamed' && op.to && findRequirement(tipReqs, op.to)) {
        findings.push({
          ...common,
          kind: 'name-collision',
          requirement: op.to,
          detail: `RENAMED target name already exists on ${baseRef} — archiving would create a duplicate`,
        });
      }
    }
  }

  findings.sort(
    (a, b) =>
      a.changeId.localeCompare(b.changeId) ||
      a.domain.localeCompare(b.domain) ||
      a.requirement.localeCompare(b.requirement)
  );

  return {
    baseRef,
    mergeBase: base,
    tip,
    upToDate,
    behind,
    operations,
    changes: [...changeIds].sort(),
    findings,
  };
}
