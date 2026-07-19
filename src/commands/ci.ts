/**
 * `concord ci` — run the check and overlap analyses in one invocation, so a
 * pipeline needs one command, one exit code, and one JSON document. Composes
 * the two existing analyses unchanged; requires git, since check does.
 */

import { runCheck, type CheckResult } from './check.js';
import { runOverlap, type OverlapResult } from './overlap.js';

export interface CiResult {
  check: CheckResult;
  overlap: OverlapResult;
}

export interface CiOptions {
  cwd?: string;
  /** OpenSpec directory relative to the repo root. */
  dir?: string;
  /** Base ref override for the check analysis (defaults to origin's default branch). */
  base?: string;
  /** Restrict the check analysis to a single change id; overlap still sees all. */
  change?: string;
}

export async function runCi(options: CiOptions = {}): Promise<CiResult> {
  const check = await runCheck({
    cwd: options.cwd,
    dir: options.dir,
    base: options.base,
    change: options.change,
  });
  const overlap = await runOverlap({ cwd: options.cwd, dir: options.dir });
  return { check, overlap };
}
