## MODIFIED Requirements

### Requirement: Skill documents how to invoke concord

The concord agent skill SHALL document the invocations an agent uses: `concord check`,
`concord overlap`, and the combined `concord ci` gate, the `--json` flag for machine-readable
output, and the `--base <ref>`, `--change <id>`, `--dir <path>`, and `-C/--cwd <path>` options.
The skill SHALL state that `concord ci` runs check and overlap together and returns a single
exit code. The skill SHALL instruct the agent to prefer `--json` when it needs to reason over
findings programmatically and to fall back to a documented install/run path (for example
`npx @lucinate-ai/concord`) when the `concord` binary is not on `PATH`.

#### Scenario: Agent needs machine-readable findings

- **WHEN** the agent must enumerate findings to decide what to fix
- **THEN** the skill tells it to run `concord check --json` and read the `findings` array rather
  than parsing the human-rendered output

#### Scenario: concord is not installed

- **WHEN** the `concord` binary is not on `PATH`
- **THEN** the skill provides a documented fallback invocation so the agent can still run the
  checks

#### Scenario: Agent wants a single combined gate

- **WHEN** the agent wants both drift/target checks and cross-change overlap in one run with one
  exit code
- **THEN** the skill tells it to run `concord ci`, which combines `concord check` and
  `concord overlap`

## ADDED Requirements

### Requirement: Skill documents running concord in CI via the shipped actions

The concord agent skill SHALL document that concord ships GitHub Actions for running the checks
in CI, so that an agent wiring up or reviewing CI for an OpenSpec repo adopts the maintained
action rather than hand-rolling a concord step. The skill SHALL name the three composite actions
referenced by path — `lucinate-ai/concord/actions/ci` (runs `concord ci`),
`lucinate-ai/concord/actions/check` (runs `concord check`), and
`lucinate-ai/concord/actions/overlap` (runs `concord overlap`). The skill SHALL state that the
actions self-install a pinned concord and render pull request annotations and a job step summary,
that `ci` is the combined check + overlap gate and the usual default, that references SHOULD pin
the floating major tag (for example `@v1`), and that the `ci` and `check` actions require a
full-history checkout (`fetch-depth: 0`) because a shallow checkout breaks drift detection. The
skill SHALL NOT direct consumers at concord's own `.github/workflows/` reusable workflow, since
the `actions/` directory is concord's external consumer surface.

#### Scenario: Agent sets up CI for an OpenSpec repo

- **WHEN** an agent is adding or reviewing a CI gate for a repo with an `openspec/` directory and
  the skill is available
- **THEN** the skill directs the agent to adopt a shipped concord action from the `actions/`
  directory rather than writing an ad hoc `npx @lucinate-ai/concord` step

#### Scenario: Agent chooses which action to run

- **WHEN** the agent needs to decide between the combined gate and a single command in CI
- **THEN** the skill tells it `actions/ci` runs the combined check + overlap gate and is the
  default, while `actions/check` and `actions/overlap` run a single command each

#### Scenario: Agent configures the action correctly

- **WHEN** the agent adds the `ci` or `check` action to a workflow
- **THEN** the skill tells it to check out with full history (`fetch-depth: 0`) and to pin the
  major version tag (for example `@v1`), noting that a shallow checkout breaks drift detection
