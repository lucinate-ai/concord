## Why

The concord agent skill teaches an agent to run `concord check` / `concord overlap` locally, and
mentions CI only as a one-line aside ("In CI, as a gate on every PR"). But concord already ships
composite GitHub Actions (`actions/ci`, `actions/check`, `actions/overlap`) that install and run
concord as a PR gate. An agent setting up or reviewing CI for an OpenSpec repo has no way to know
these exist, so it hand-rolls an `npx @lucinate-ai/concord` step — unpinned, with no annotations
or job summary — instead of adopting the maintained action. The skill should point the agent at
the shipped CI path.

## What Changes

- Add a section to `skills/concord/SKILL.md` telling the agent that concord ships GitHub Actions,
  so that when it wires up or reviews CI for an OpenSpec repo it adopts them rather than writing
  its own concord step.
- Document the three composite actions (`lucinate-ai/concord/actions/ci`, `.../check`,
  `.../overlap`), what each runs, that they self-install pinned concord, and that they emit PR
  annotations plus a job step summary.
- Recommend only the `actions/` composite actions — concord's external consumer surface — and not
  concord's own `.github/workflows/` reusable workflow, which is an internal build concern.
- Note the key requirements an agent must get right: pin the `@v1` major tag, check out with full
  history (`fetch-depth: 0`) for the `ci`/`check` actions, and that `ci` is the combined
  check + overlap gate.
- Surface the `concord ci` combined command in the skill's invocation guidance (currently the skill
  lists only `check` and `overlap`), since the `ci` action and the exit-code contract build on it.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `agent-skill`: Add a requirement that the skill document concord's GitHub Actions — when to
  reach for them, which action runs which command, and the pinning/full-history constraints — and
  that its invocation guidance cover the `concord ci` combined command.

## Impact

- `skills/concord/SKILL.md` — new "Running concord in CI" section plus a mention of `concord ci` in
  the invocation guidance. Documentation only; no CLI behaviour, flags, exit codes, or action YAML
  change.
- The skill is packaged into the Claude plugin, so the plugin picks up the revised `SKILL.md`.
