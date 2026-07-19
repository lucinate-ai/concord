# Delta: CLI and Output — add `concord ci`

## ADDED Requirements

### Requirement: CI command interface
The CLI SHALL provide a `ci` command that runs the check and overlap analyses in a single invocation. It SHALL accept `-C, --cwd <path>` and `--dir <path>` (applying to both analyses, with the same defaults as the individual commands), `--base <ref>` and `--change <id>` (applying to the check analysis only), and `--json`. With `--json` it SHALL print a single JSON document with a `check` key and an `overlap` key, each holding the full result the corresponding individual command would emit. Without `--json` it SHALL render the check report, then the overlap report, then a combined summary line. The command SHALL require a git repository, since the check analysis depends on git history.

#### Scenario: Combined clean run
- **WHEN** `concord ci` runs and both analyses are clean
- **THEN** both reports are rendered with a combined summary
- **AND** the exit code is 0

#### Scenario: Combined JSON output
- **WHEN** `concord ci --json` runs
- **THEN** stdout contains a single JSON document whose `check` and `overlap` values match the individual commands' JSON output

#### Scenario: Check-only options routed
- **WHEN** `concord ci --change add-auth` runs
- **THEN** the check analysis is restricted to that change
- **AND** the overlap analysis still considers all open changes

## MODIFIED Requirements

### Requirement: CI-friendly exit codes
All commands SHALL exit 0 when clean, 1 when findings or overlaps are present, and 2 on usage or environment errors. The `ci` command SHALL exit 1 when either analysis reports problems. Known errors (git failures, concord usage errors) SHALL print a concise `concord: <message>` line to stderr rather than a stack trace.

#### Scenario: Findings present
- **WHEN** `concord check` reports one or more findings
- **THEN** the exit code is 1

#### Scenario: Combined command with problems in one analysis
- **WHEN** `concord ci` runs and exactly one of the two analyses reports findings or overlaps
- **THEN** the exit code is 1

#### Scenario: Not a git repository
- **WHEN** `concord check` or `concord ci` runs where no git repository or base ref is available
- **THEN** the exit code is 2 and a single-line error is printed to stderr
