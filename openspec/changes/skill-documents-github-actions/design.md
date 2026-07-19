## Context

`skills/concord/SKILL.md` is the agent-facing skill. It covers local `concord check` /
`concord overlap` use in depth but treats CI as a single bullet ("In CI, as a gate on every PR
that touches `openspec/`") and never mentions that concord already ships the CI machinery: three
composite actions under `actions/` (`ci`, `check`, `overlap`), a shared `run.sh` + `report.mjs`,
and a reusable workflow at `.github/workflows/concord.yml`. Those are specified in the
`github-actions` capability and already implemented. The skill also omits the `concord ci`
command entirely, even though its "How to invoke" table is the natural place for it and the `ci`
action builds on it.

This change is documentation only. It edits one Markdown file to close the gap so an agent
setting up CI adopts the maintained action instead of writing an unpinned `npx` step.

## Goals / Non-Goals

**Goals:**
- The skill names the three actions (by their `uses:` path form) and what each runs.
- The skill states the two things an agent most often gets wrong: pinning `@v1` and checking out
  with `fetch-depth: 0` for `ci`/`check`.
- The skill mentions `concord ci` as the combined gate in its invocation guidance.
- The wording stays consistent with the existing `github-actions` spec (action paths, defaults,
  full-history requirement) so the skill and the actions don't drift.

**Non-Goals:**
- No change to any `action.yml`, `run.sh`, `report.mjs`, the reusable workflow, or the CLI.
- No new CLI flags, exit codes, or `--json` shapes.
- Not a full copy of every action input into the skill — the skill points at the actions and
  covers the decisions an agent makes, not an exhaustive input reference (that lives in the
  action YAML and the `github-actions` spec).

## Decisions

- **Add a dedicated "Running concord in CI" section rather than expanding the existing bullet.**
  The bullet under "When to run concord" stays as the trigger; a new section carries the how
  (which action, pinning, full history). This keeps the trigger list scannable and gives the CI
  guidance room without bloating the invocation table. Alternative considered: inline it into the
  existing bullet — rejected as too cramped for the pinning/full-history caveats.
- **Refer to actions by their `uses:` path form** (`lucinate-ai/concord/actions/ci@v1`), matching
  how the `github-actions` spec and consumers reference them, rather than inventing a Marketplace
  name (there is none — the actions are nested and consumed by path).
- **Add `concord ci` to the existing invocation guidance** (the two-command list and flags table)
  rather than only describing the action. The command and the action are the same gate at
  different layers; an agent that knows the command understands the action, and `ci` is also
  useful to run locally before pushing. This makes the invocation guidance and the CI section
  reinforce each other.
- **Recommend `actions/ci` as the default** in the skill, matching the "combined gate by default"
  behaviour in the `github-actions` spec.
- **Recommend only the `actions/` composite actions, not the reusable workflow.** concord's
  reusable workflow at `.github/workflows/concord.yml` is technically consumable (`on:
  workflow_call`), but it lives alongside concord's own build workflows and is a second,
  near-identical way to do the same thing. The `actions/` directory is concord's clean external
  surface, and the skill already spells out the `fetch-depth: 0` checkout the reusable workflow
  would otherwise save. Teaching one path keeps the guidance crisp. Alternative considered:
  document both — rejected as redundant and as blurring concord's internal `.github/workflows/`
  with its consumer API.

## Risks / Trade-offs

- [Skill and action docs drift over time — e.g. an input default or the major tag changes] →
  Keep the skill's CI section to stable facts (action paths, `ci` = combined gate, full-history
  requirement, pin the major tag) and point at the action YAML for the exhaustive input list, so
  routine input changes don't require a skill edit.
- [Over-documenting CI could bury the skill's primary local-use guidance] → Keep the CI section
  short and place it after the existing invocation and findings guidance, not before it.
