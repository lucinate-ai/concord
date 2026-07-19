## Context

concord is a published CLI (`@lucinate-ai/concord`) that detects concurrency hazards in OpenSpec
repos — stale-base drift, invalid delta targets, name collisions, cross-change overlaps — using
only git and the working tree. Its public contract is the two commands (`check`, `overlap`),
their flags, the `--json` result shapes (`CheckResult`, `OverlapResult`), and the exit-code
convention (0 clean / 1 findings / 2 error).

The gap: AI coding agents are the ones authoring, rebasing, and archiving OpenSpec changes, and
they don't reach for concord because nothing tells them it exists or when to use it. Claude Code
plugins are the distribution mechanism that fixes this — a plugin bundles an **agent skill**
(instructions the agent loads when relevant) and is installed with `/plugin`. This change
packages concord as such a plugin, adding only packaging and guidance — no runtime code.

The repo already carries project-scoped OpenSpec skills under `.claude/skills/` and commands
under `.claude/commands/opsx/`. Those are *this project's* local tooling. The plugin components
this change adds live at the **repo root** (`.claude-plugin/`, `skills/`) and are what a
*consumer* gets when they install the plugin — a separate mechanism, no collision.

## Goals / Non-Goals

**Goals:**
- Ship one agent skill that makes an agent run `concord check` / `concord overlap` at the right
  moments and correctly interpret and resolve findings.
- Make the repo an installable Claude Code plugin, self-hosting as its own single-plugin
  marketplace so no second repo is needed.
- Keep the plugin metadata consistent with `package.json` (name, version, author, repo, licence).
- Document install + usage.

**Non-Goals:**
- No change to concord's CLI, flags, `--json` shapes, or exit codes.
- No new runtime dependency, no bundled MCP server, no hooks that auto-run concord (an agent
  deciding *when* to run it via the skill is the design; a forced hook is out of scope here).
- Not publishing to any third-party or Anthropic-reserved marketplace; the repo hosts itself.
- Not re-implementing concord logic inside the skill — the skill is a consumer of the CLI.

## Decisions

**Decision: One skill, at `skills/concord/SKILL.md`.**
Claude Code auto-discovers `skills/<name>/SKILL.md` at the plugin root, so no `skills` path
override is needed in the manifest. A directory skill (vs a flat `commands/*.md`) lets us add
supporting reference files later (e.g. a finding-kinds table) without restructuring. The
frontmatter `name` is set explicitly (`concord`) because marketplace-installed skills otherwise
fall back to the install directory name (a version string) — an explicit `name` keeps the
invocation stable.
*Alternative considered:* a flat `commands/concord.md`. Rejected — no room for supporting files
and it reads as a user slash-command rather than agent-triggered guidance.

**Decision: `when` left at default (both agent- and manually-invokable).**
The skill is primarily meant to fire when the agent recognises a concurrency-risk moment, but a
user may also want to invoke it directly. Leaving `when` unset keeps both paths open.
*Alternative considered:* `when: claude` (agent-only). Rejected — it needlessly blocks a user
running the skill on demand.

**Decision: `allowed-tools` scoped to running concord.**
The skill only needs to shell out to concord (and read files to locate changes), so its
`allowed-tools` is scoped to `Bash` for `concord` / `npx @lucinate-ai/concord` plus read access,
mirroring how the repo's existing OpenSpec skills scope `Bash(openspec:*)`. This keeps the skill
least-privilege.

**Decision: self-hosting marketplace via a `"./"` source.**
`.claude-plugin/marketplace.json` lists a single plugin whose `source` is the repo root, so
`/plugin marketplace add lucinate-ai/concord` + install works against this one repo. Marketplace
`name` = `concord` (or `concord-marketplace`); the listed plugin `name` matches the manifest.
*Alternative considered:* a separate marketplace repo. Rejected as unnecessary overhead for a
single plugin; the docs show the reserved-name list, and our chosen names avoid it.

**Decision: manifest fields mirror `package.json`.**
`name` → `concord` (the manifest name is namespaced/kebab-case; `@lucinate-ai/concord` is the
npm name), `version`, `description`, `homepage`, `repository`, `license: Apache-2.0`, `keywords`,
and `author` as an object with a `name`. A drift between `package.json` and `plugin.json` version
is a maintenance hazard — a task calls out keeping them in step at release time (documented, not
automated, matching concord's manual release posture).

**Decision: skill content is organised around concord's own contract.**
The skill documents the two commands and their flags, the exit-code contract, and one section
per finding kind (`drift`, `removed-upstream`, `target-missing`, `name-collision`, `overlap`)
with a resolution for each — sourced directly from README and AGENTS.md so the guidance can't
drift from the tool. It instructs `--json` for programmatic reasoning and an `npx` fallback when
the binary isn't on `PATH`.

## Risks / Trade-offs

- **Version drift between `package.json` and `plugin.json`** → Mitigation: document the
  two-file bump in the release step (AGENTS.md / tasks); omitting `version` from the manifest is
  a fallback (Claude Code then uses the git SHA), but an explicit version reads better in the
  install UI.
- **Skill guidance drifts from concord's actual output** (e.g. a new finding kind added later)
  → Mitigation: the skill cites README/AGENTS.md as the source of truth and a task adds a note to
  update the skill when finding kinds or flags change; the spec requires all current kinds be
  covered so a reviewer can check completeness.
- **Marketplace name collides with a reserved name** → Mitigation: the reserved-name list is
  known; `concord` / `concord-marketplace` are clear of it.
- **Root `skills/` vs `.claude/skills/` confusion** → Mitigation: design note above; they are
  distinct mechanisms (consumer plugin vs this project's local tooling) and do not interact.
- **`claude` CLI not present in CI to validate the plugin** → Mitigation: validation is a
  best-effort manual/CI step; the primary correctness check is that the manifest and marketplace
  JSON parse and carry the required fields, which a lightweight test or `jq`/`node` check covers
  without the `claude` binary.

## Migration Plan

Additive only — new files, no code or contract changes, nothing to roll back in the product.
Deploy is: land the files, then (at the next release) bump both `package.json` and
`plugin.json` versions together. Rollback is deleting the added files; installed plugins are
unaffected because nothing in concord's runtime changed.

## Open Questions

- Marketplace `name`: `concord` vs `concord-marketplace`? (Leaning `concord-marketplace` to keep
  it distinct from the plugin `name`.) — resolve during implementation; both are valid.
- Should the skill also register a lightweight `commands/` entry (e.g. `/concord-check`) as a
  convenience alias, or keep it skill-only? — default to skill-only for now; add later if users
  ask.
