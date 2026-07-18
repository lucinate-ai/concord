/**
 * `concord overlap` — detect two or more open changes claiming the same
 * requirement. OpenSpec deltas replace whole requirement blocks by name at
 * archive time, so any requirement touched by more than one open change is
 * a future conflict (or a silent clobber): surface it on day one instead.
 */

import { repoRoot } from '../git.js';
import { discoverChanges } from '../core/discover.js';
import type { OperationType } from '../core/delta.js';

export interface OverlapClaim {
  changeId: string;
  operations: OperationType[];
}

export interface OverlapEntry {
  domain: string;
  requirement: string;
  claims: OverlapClaim[];
}

export interface OverlapResult {
  changes: string[];
  requirements: number;
  overlaps: OverlapEntry[];
}

export interface OverlapOptions {
  cwd?: string;
  dir?: string;
}

export async function runOverlap(options: OverlapOptions = {}): Promise<OverlapResult> {
  const cwd = options.cwd ?? process.cwd();
  const dir = options.dir ?? 'openspec';

  let root: string;
  try {
    root = await repoRoot(cwd);
  } catch {
    root = cwd; // overlap detection needs no git history — allow plain dirs
  }

  const deltas = discoverChanges(root, dir);
  const changeIds = new Set<string>();

  // domain → requirement name → changeId → operation types
  const claims = new Map<string, Map<string, Map<string, Set<OperationType>>>>();
  for (const delta of deltas) {
    changeIds.add(delta.changeId);
    for (const op of delta.operations) {
      const names = op.to ? [op.name, op.to] : [op.name];
      for (const name of names) {
        const byName =
          claims.get(delta.domain) ?? new Map<string, Map<string, Set<OperationType>>>();
        const byChange = byName.get(name) ?? new Map<string, Set<OperationType>>();
        const ops = byChange.get(delta.changeId) ?? new Set<OperationType>();
        ops.add(op.type);
        byChange.set(delta.changeId, ops);
        byName.set(name, byChange);
        claims.set(delta.domain, byName);
      }
    }
  }

  const overlaps: OverlapEntry[] = [];
  let requirements = 0;
  for (const [domain, byName] of claims) {
    for (const [requirement, byChange] of byName) {
      requirements++;
      if (byChange.size < 2) continue;
      overlaps.push({
        domain,
        requirement,
        claims: [...byChange.entries()]
          .map(([changeId, ops]) => ({ changeId, operations: [...ops].sort() }))
          .sort((a, b) => a.changeId.localeCompare(b.changeId)),
      });
    }
  }
  overlaps.sort(
    (a, b) =>
      a.domain.localeCompare(b.domain) || a.requirement.localeCompare(b.requirement)
  );

  return {
    changes: [...changeIds].sort(),
    requirements,
    overlaps,
  };
}
