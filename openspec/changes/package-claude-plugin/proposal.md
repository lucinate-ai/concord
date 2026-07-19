## Why

concord already ships an OpenSpec-aware CLI, but AI coding agents don't know it exists or
when to reach for it. Agents routinely author OpenSpec changes, rebase branches, and archive
deltas — the exact moments a stale-base clobber or a cross-change overlap slips through. A
Claude Code **agent skill** teaches an agent to run `concord check` / `concord overlap` at
those moments and act on the findings, and packaging the repo as a **Claude Code plugin** makes
that skill (plus concord's existing slash commands) installable in one step.

## What Changes

- Add a concord **agent skill** (`SKILL.md`) that tells an agent when to run concord (before
  archiving a change, after rebasing onto the base branch, when opening a change that touches an
  existing requirement), how to invoke `concord check` / `concord overlap` (including `--json`
  and the `--base` / `--change` flags), how to read the exit codes (0/1/2) and finding kinds
  (drift, removed-upstream, target-missing, name-collision, overlap), and how to resolve each.
- Add the **Claude Code plugin manifest and directory layout** so the repo is a valid,
  installable plugin: a `.claude-plugin/plugin.json` manifest and a plugin-visible `skills/`
  tree carrying the concord skill.
- Add a **plugin marketplace manifest** (`.claude-plugin/marketplace.json`) so the repo is
  self-hosting: users can `/plugin marketplace add lucinate-ai/concord` then install it.
- Document installation and skill usage in `README.md` / `docs/`.
- No changes to concord's runtime code, CLI surface, `--json` shapes, or exit-code contract.

## Capabilities

### New Capabilities
- `agent-skill`: the packaged instructions that make an AI coding agent invoke concord at the
  right moments and correctly interpret and resolve its findings.
- `claude-plugin`: the plugin manifest, directory layout, and marketplace metadata that make the
  concord repo installable as a Claude Code plugin.

### Modified Capabilities
<!-- None. This change adds packaging and agent guidance only; concord's runtime behaviour
     (drift-detection, overlap-detection, base-resolution, delta-validation, openspec-parsing,
     cli-output) is unchanged. -->

## Impact

- **New files**: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, a plugin
  `skills/<skill-name>/SKILL.md` (and any supporting reference files).
- **Docs**: `README.md` gains an install/usage section; `docs/` may gain a plugin note.
- **No code impact**: `src/`, `bin/`, the CLI flags, `CheckResult`/`OverlapResult` JSON shapes,
  and exit codes are untouched. The skill is a consumer of the existing public contract.
- **Distribution**: the repo doubles as its own single-plugin marketplace; no separate registry
  repo is required.
