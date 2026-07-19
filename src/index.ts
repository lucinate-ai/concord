export { canonicalize, blockHash, blocksEqual } from './core/canonical.js';
export {
  parseSpec,
  parseRequirementBlocks,
  findRequirement,
  normalizeRequirementName,
  type RequirementBlock,
} from './core/spec.js';
export { parseDelta, claimedNames, type DeltaOperation, type OperationType } from './core/delta.js';
export { discoverChanges, type ChangeDelta } from './core/discover.js';
export { diffLines, compressContext, type DiffLine } from './core/diff.js';
export {
  runCheck,
  type CheckOptions,
  type CheckResult,
  type Finding,
  type FindingKind,
} from './commands/check.js';
export {
  runOverlap,
  type OverlapOptions,
  type OverlapResult,
  type OverlapEntry,
  type OverlapClaim,
} from './commands/overlap.js';
export { runCi, type CiOptions, type CiResult } from './commands/ci.js';
export { renderCheck, renderOverlap, renderCi } from './report.js';
export { GitError } from './git.js';
export { ConcordError } from './errors.js';
