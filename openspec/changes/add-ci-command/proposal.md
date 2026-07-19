# Add `concord ci` command

## Why

CI pipelines currently need two invocations (`concord check` and `concord overlap`), must combine two exit codes, and must parse two separate JSON documents. A single gate command makes pipeline wiring one line and one artifact.

## What Changes

- New `concord ci` command that runs the check and overlap analyses in one invocation.
- Accepts the union of the two commands' options: `-C/--cwd`, `--dir`, `--base`, `--change`, `--json`.
- Combined exit code: 0 when both analyses are clean, 1 when either reports findings or overlaps, 2 on usage or environment errors.
- With `--json`, prints a single JSON document containing both results (`check` and `overlap` keys).
- Without `--json`, renders both human reports in sequence with a combined summary.
- Existing `check` and `overlap` commands are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-output`: add a "CI command interface" requirement covering the new command, its options, and its combined JSON output; modify "CI-friendly exit codes" so the 0/1/2 contract covers all three commands, with `ci` exiting 1 when either analysis reports problems.

## Impact

- `src/cli.ts`: register the `ci` command.
- New `src/commands/ci.ts`: compose `runCheck` and `runOverlap` into one result.
- `src/report.ts`: render the combined report.
- `test/`: integration coverage for the combined command (exit codes, JSON shape).
- No new dependencies; no changes to existing command behaviour.
