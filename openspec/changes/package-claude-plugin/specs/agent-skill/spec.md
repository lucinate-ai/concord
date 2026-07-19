## ADDED Requirements

### Requirement: Skill instructs agents when to run concord

The concord agent skill SHALL tell an AI coding agent to run concord at the moments a
concurrency hazard can be introduced or discovered, so checks happen without the user having to
ask. The skill SHALL name at least these triggers: before archiving an OpenSpec change, after
rebasing or merging the base branch into a change branch, and when opening or editing a change
whose delta targets a requirement that already exists on the base branch.

#### Scenario: Agent is about to archive a change

- **WHEN** an agent is following an OpenSpec archive flow and the skill is available
- **THEN** the skill directs the agent to run `concord check` for that change first and to not
  archive while a drift or target finding is unresolved

#### Scenario: Agent has just rebased a change branch

- **WHEN** an agent rebases or merges the base branch into a change branch
- **THEN** the skill directs the agent to re-run `concord check`, because the merge-base has
  moved and previously-clear or previously-failing findings may have changed

### Requirement: Skill documents how to invoke concord

The concord agent skill SHALL document the invocations an agent uses: `concord check` and
`concord overlap`, the `--json` flag for machine-readable output, and the `--base <ref>`,
`--change <id>`, `--dir <path>`, and `-C/--cwd <path>` options. The skill SHALL instruct the
agent to prefer `--json` when it needs to reason over findings programmatically and to fall back
to a documented install/run path (for example `npx @lucinate-ai/concord`) when the `concord`
binary is not on `PATH`.

#### Scenario: Agent needs machine-readable findings

- **WHEN** the agent must enumerate findings to decide what to fix
- **THEN** the skill tells it to run `concord check --json` and read the `findings` array rather
  than parsing the human-rendered output

#### Scenario: concord is not installed

- **WHEN** the `concord` binary is not on `PATH`
- **THEN** the skill provides a documented fallback invocation so the agent can still run the
  checks

### Requirement: Skill explains exit codes and finding kinds

The concord agent skill SHALL document concord's exit-code contract (0 = clean, 1 = findings,
2 = usage/environment error) and each finding kind it can emit: `drift`, `removed-upstream`,
`target-missing`, `name-collision`, and cross-change `overlap`. For each kind the skill SHALL
state what it means and how the agent should resolve it.

#### Scenario: check reports drift

- **WHEN** `concord check` exits 1 with a `drift` finding
- **THEN** the skill tells the agent the delta's target changed on the base branch since the
  branch diverged, that archiving would silently discard that change, and that the fix is to
  re-derive the delta block against the base and merge or rebase so the merge-base advances

#### Scenario: check exits 2

- **WHEN** `concord check` exits 2
- **THEN** the skill tells the agent this is a usage or environment error (not a spec finding)
  and to fix the invocation or environment rather than treating it as a drift/overlap result

### Requirement: Skill is a valid, discoverable skill file

The concord agent skill SHALL be a `SKILL.md` file whose frontmatter carries a kebab-case
`name` and a `description` that states what the skill does and when to use it, so an agent can
decide to load it. The description SHALL mention concord, OpenSpec, drift, and overlap so the
skill is selected for the situations it covers.

#### Scenario: Agent scans available skills

- **WHEN** an agent lists available skills while working in an OpenSpec repo
- **THEN** the concord skill's description makes clear it applies to detecting spec drift and
  overlap, so the agent can select it for that work
