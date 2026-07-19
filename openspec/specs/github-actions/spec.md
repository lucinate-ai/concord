# GitHub Actions Specification

## Purpose

Let external repositories run concord in their own CI. A set of composite GitHub Actions under a
top-level `actions/` directory — one per concord command (`ci`, `check`, `overlap`) — plus a
companion reusable workflow install concord, run the selected command, and render findings and
overlaps as pull request annotations and a job step summary. The actions are thin, pinned
consumers of the published CLI; they add no runtime dependency and change no CLI behaviour.

## Requirements

### Requirement: Separate composite actions per command
The project SHALL publish one composite GitHub Action per concord command under a top-level
`actions/` directory: `actions/ci/action.yml` (runs `concord ci`), `actions/check/action.yml`
(runs `concord check`), and `actions/overlap/action.yml` (runs `concord overlap`). Each SHALL
declare `runs.using: composite` and be referenced by path, e.g.
`uses: lucinate-ai/concord/actions/ci@<ref>`. The actions SHALL run without the consumer
pre-installing concord: each installs the package at run time. Because actions nested in
subdirectories are consumed by the `uses:` path form rather than a GitHub Marketplace listing,
Marketplace publication is out of scope; the actions SHALL still carry a `name`, `description`,
and `branding` block for readability and future use.

#### Scenario: Consumer references the ci action by tag
- **WHEN** a consumer workflow has a step `uses: lucinate-ai/concord/actions/ci@v1`
- **THEN** GitHub resolves `actions/ci/action.yml` in the concord repo at that ref and runs it as a composite action
- **AND** the step succeeds without any prior `npm install` of concord in the consumer repo

#### Scenario: Each command has its own action
- **WHEN** a consumer wants only cross-change overlap detection
- **THEN** they can use `uses: lucinate-ai/concord/actions/overlap@v1` without invoking the check or combined analyses

### Requirement: Shared action logic
The three actions SHALL share their common behaviour — installing concord, guarding against a
shallow checkout, resolving and fetching the base ref, invoking the concord command, and
rendering annotations, the step summary, and outputs — through helper files stored once under
`actions/` (for example a shell library and a `report.mjs`), referenced from each `action.yml`
via `$GITHUB_ACTION_PATH`. Per-command `action.yml` files SHALL remain thin wrappers that select
their command and declare only the inputs and outputs relevant to it.

#### Scenario: Rendering logic is not duplicated
- **WHEN** annotation and summary rendering changes
- **THEN** it is edited in the single shared helper and all three actions pick up the change

### Requirement: Per-action inputs
Each action SHALL accept inputs relevant to its command, each with a documented default. Shared
inputs: `dir` (OpenSpec directory relative to the repo root, default `openspec`), `version` (the
concord npm version or dist-tag to install, default the released package version),
`working-directory` (directory to run in, default `.`), `fail-on-findings` (default `true`),
`annotations` (emit PR annotations, default `true`), and `summary` (write a job step summary,
default `true`). The `ci` and `check` actions SHALL additionally accept `base` (base ref
override, default empty — concord resolves the base itself) and `change` (restrict the check
analysis to a single change id, default empty). The `overlap` action SHALL NOT expose `base` or
`change`, since `concord overlap` uses neither. Inputs SHALL map onto the corresponding concord
flags (`--dir`, `--base`, `--change`, `--json`).

#### Scenario: Overlap action omits base and change
- **WHEN** the `overlap` action runs with `dir: specs-root`
- **THEN** it invokes `concord overlap --dir specs-root --json` and exposes no `base` or `change` input

#### Scenario: Single-change scoping on the ci action
- **WHEN** the `ci` action runs with `change: add-auth`
- **THEN** it invokes `concord ci --change add-auth --json`, restricting the check analysis to that change while overlap still sees all changes

#### Scenario: Combined gate by default
- **WHEN** the `ci` action runs with default inputs
- **THEN** it invokes `concord ci --json`, obtaining check findings and overlaps in one JSON document with one exit code

### Requirement: Pinned concord installation
Each action SHALL install concord from npm at the version given by the `version` input,
defaulting to the package version shipped with the same release as the actions, and SHALL run
that installed binary rather than any concord already present in the consumer repository.
Installation SHALL use only tooling available on GitHub-hosted runners (Node and npm/npx); no
additional action dependency SHALL be added to concord's own package.

#### Scenario: Version input pins the install
- **WHEN** an action runs with `version: 0.2.0`
- **THEN** it installs and runs `@lucinate-ai/concord@0.2.0`

#### Scenario: Default version matches the release
- **WHEN** an action runs without a `version` input from tag `v1`
- **THEN** it installs the concord version published for that release rather than an arbitrary `latest`

### Requirement: Base ref availability
Because `concord ci` and `concord check` reconstruct the merge-base and base tip from git
history, the `ci` and `check` actions SHALL require the consumer to check out with full history
(`fetch-depth: 0`) and SHALL ensure the base branch is fetched before running. When triggered by
a `pull_request` event and no explicit `base` input is given, they SHALL default the base ref to
the pull request's base branch. Their documentation SHALL state that a shallow checkout breaks
drift detection. The `overlap` action needs no git base and SHALL run without these requirements.

#### Scenario: Base branch missing locally
- **WHEN** the `ci` or `check` action runs and the resolved base ref is not present in the local clone
- **THEN** the action fetches that ref from `origin` before invoking concord

#### Scenario: Pull request base default
- **WHEN** the `ci` or `check` action runs on a `pull_request` event with no `base` input
- **THEN** it targets the pull request's base branch as the base ref

#### Scenario: Shallow checkout is surfaced
- **WHEN** the repository was checked out shallowly and drift cannot be computed
- **THEN** the `ci`/`check` action fails with an error that names the full-history (`fetch-depth: 0`) requirement rather than reporting a false clean result

### Requirement: Pull request annotations
When `annotations` is `true`, an action SHALL translate concord's JSON into GitHub workflow
annotation commands so findings appear on the pull request and in the run's checks. For the `ci`
action the JSON is a single `{ check, overlap }` document; for `check` or `overlap` it is that
command's own result. Each check finding SHALL produce one annotation carrying its kind, change
id, domain, requirement, and operation, targeted at the change's delta file
(`<dir>/changes/<changeId>/specs/<domain>/spec.md`) where that path exists. Each overlap entry
SHALL produce one annotation naming the requirement and the changes that claim it. Annotations
SHALL NOT be the only signal — the exit code still gates the job.

#### Scenario: Drift finding annotated
- **WHEN** the `ci` or `check` action's JSON reports a `drift` finding for change `tighten-frob`, domain `widgets`
- **THEN** the action emits an annotation whose message names the kind, change, domain, requirement, and operation
- **AND** the annotation is attached to `openspec/changes/tighten-frob/specs/widgets/spec.md` when that file exists

#### Scenario: Overlap entry annotated
- **WHEN** the `ci` or `overlap` action's JSON reports a requirement claimed by two changes
- **THEN** the action emits one annotation naming the requirement and both claiming change ids

#### Scenario: Annotations disabled
- **WHEN** an action runs with `annotations: false`
- **THEN** no workflow annotation commands are emitted, but findings still affect the exit code and summary

### Requirement: Job step summary
When `summary` is `true`, an action SHALL write a Markdown summary to `$GITHUB_STEP_SUMMARY`
describing the run: the base ref and how far the branch is behind (for `ci`/`check`), and a table
of findings (kind, change, domain, requirement, operation) and/or overlaps (requirement,
claiming changes) as applicable to the command. A clean run SHALL write a summary stating that
nothing drifted or overlapped and how many operations and changes were verified.

#### Scenario: Findings summarised
- **WHEN** the run produces findings
- **THEN** the step summary contains a table row per finding with its kind, change, domain, requirement, and operation

#### Scenario: Clean run summarised
- **WHEN** the run is clean
- **THEN** the step summary states that no drift or overlap was found and how many operations and changes were verified

### Requirement: Action outputs and failure control
Each action SHALL expose outputs: `findings` (number of check findings; `0` for the `overlap`
action), `overlaps` (number of overlap entries; `0` for the `check` action), `exit-code` (the
concord exit code), and `result` (the raw concord JSON — the `{ check, overlap }` document for
`ci`). For the `ci` action, concord already returns a single exit code that is `1` when there are
any findings or overlaps, so the action reads that directly rather than combining separate runs.
When `fail-on-findings` is `true` (the default), the action step SHALL fail (non-zero) if any
findings or overlaps are present; when `false`, the step SHALL succeed regardless while still
setting the outputs, so consumers can gate on them themselves. Environment or usage errors
(concord exit code 2) SHALL always fail the step regardless of `fail-on-findings`.

#### Scenario: Findings or overlaps fail the job by default
- **WHEN** the `ci` action runs with default inputs and concord reports findings or overlaps (exit code 1)
- **THEN** the action step fails and `findings`/`overlaps` reflect the counts

#### Scenario: Non-blocking mode
- **WHEN** an action runs with `fail-on-findings: false` and concord reports findings
- **THEN** the step succeeds and sets `findings`, `overlaps`, and `result` for the consumer to act on

#### Scenario: Environment error always fails
- **WHEN** concord exits 2 (for example, no base ref resolvable)
- **THEN** the action step fails even if `fail-on-findings` is `false`

### Requirement: Reusable workflow entry point
The project SHALL provide a reusable workflow at `.github/workflows/concord.yml` with
`on: workflow_call`, so a consumer can adopt concord by adding one small caller workflow with
`uses: lucinate-ai/concord/.github/workflows/concord.yml@<ref>`. The reusable workflow SHALL
check out the consumer's repository with full history (`fetch-depth: 0`) and SHALL call one of
the composite actions, defaulting to `actions/ci`. It SHALL accept inputs that mirror the
actions' (`command` to select `ci`/`check`/`overlap`, `base`, `dir`, `change`, `version`,
`fail-on-findings`) and forward them.

#### Scenario: Consumer adopts via the reusable workflow
- **WHEN** a consumer adds a caller workflow that uses `lucinate-ai/concord/.github/workflows/concord.yml@v1` on `pull_request`
- **THEN** their repository is checked out with `fetch-depth: 0` and the `ci` action runs against the PR base without the consumer writing checkout or install steps

#### Scenario: Reusable workflow selects an action
- **WHEN** the caller sets `command: overlap` and `dir: specs`
- **THEN** the reusable workflow invokes the `overlap` action with `dir: specs`

### Requirement: Floating major version tag
The project SHALL maintain a floating major-version tag (for example `v1`) that points at the
latest compatible release, so consumers pinning `@v1` on their `actions/<command>` path
references receive patch and minor updates without editing their workflows. A release process
SHALL move this tag on each compatible release.

#### Scenario: Major tag tracks the latest compatible release
- **WHEN** a new compatible release `v1.2.0` is published
- **THEN** the `v1` tag is updated to point at that release's commit

#### Scenario: Consumers pin the major tag
- **WHEN** a consumer references `uses: lucinate-ai/concord/actions/ci@v1`
- **THEN** they resolve to the newest release within major version 1
