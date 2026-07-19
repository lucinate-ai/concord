# CLI and Output Specification

## Purpose

Expose the checks as a CI-friendly command line: two commands with predictable options, exit codes that gate pipelines, machine-readable JSON, and a human report that shows what drifted and how to fix it.

## Requirements

### Requirement: Check command interface
The CLI SHALL provide a `check` command that verifies every open change against the base branch. It SHALL accept `-C, --cwd <path>` (run as if started there, default `.`), `--dir <path>` (OpenSpec directory relative to the repo root, default `openspec`), `--base <ref>` (base ref override), `--change <id>` (restrict to a single change), and `--json`.

#### Scenario: Restrict to one change
- **WHEN** `concord check --change add-auth` runs and that change has delta specs
- **THEN** only that change's operations are checked

#### Scenario: Unknown change id
- **WHEN** `--change` names a change that does not exist or has no delta specs
- **THEN** the command fails with an error naming the change and the changes directory

### Requirement: Overlap command interface
The CLI SHALL provide an `overlap` command that detects requirements claimed by more than one open change. It SHALL accept `-C, --cwd <path>`, `--dir <path>`, and `--json`, with the same defaults as `check`.

#### Scenario: Default invocation
- **WHEN** `concord overlap` runs at a repo root with an `openspec/` directory
- **THEN** open changes under `openspec/changes/` are analysed

### Requirement: CI-friendly exit codes
Both commands SHALL exit 0 when clean, 1 when findings or overlaps are present, and 2 on usage or environment errors. Known errors (git failures, concord usage errors) SHALL print a concise `concord: <message>` line to stderr rather than a stack trace.

#### Scenario: Findings present
- **WHEN** `concord check` reports one or more findings
- **THEN** the exit code is 1

#### Scenario: Not a git repository
- **WHEN** `concord check` runs where no git repository or base ref is available
- **THEN** the exit code is 2 and a single-line error is printed to stderr

### Requirement: JSON output
With `--json`, each command SHALL print its full result as pretty-printed JSON to stdout: for `check`, the base ref, merge-base, tip, up-to-date flag, behind count, operation count, change ids, and findings (kind, change id, domain, requirement, operation, detail, and base/tip blocks where relevant); for `overlap`, the change ids, claimed-requirement count, and overlap entries with per-change claims. No human-oriented decoration SHALL be mixed into the JSON stream.

#### Scenario: JSON check run in CI
- **WHEN** `concord check --json` runs
- **THEN** stdout contains a single JSON document with the full check result

### Requirement: Human-readable report
Without `--json`, each command SHALL render a coloured terminal report: a header summarising the base state, one entry per finding or overlap with change id, domain, requirement, and operation, a kind-specific fix hint, and a summary line. Drift findings SHALL include a redline diff of the merge-base block against the tip block, keeping two lines of context around each change and collapsing longer unchanged runs to an ellipsis. Clean runs SHALL say what was verified.

#### Scenario: Drift finding rendered
- **WHEN** a drift finding with base and tip blocks is rendered
- **THEN** the report shows deleted baseline lines and added current lines with two lines of surrounding context

#### Scenario: Clean check
- **WHEN** `concord check` finds nothing
- **THEN** the report states the number of operations and changes verified against the base ref

### Requirement: Deterministic ordering
Results SHALL be deterministically ordered: check findings sorted by change id, then domain, then requirement; overlap entries sorted by domain then requirement, with each entry's claims sorted by change id and operation lists sorted alphabetically.

#### Scenario: Repeated runs
- **WHEN** the same repository state is checked twice
- **THEN** findings and overlaps appear in the same order both times
