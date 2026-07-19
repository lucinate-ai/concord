# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Build & Development Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript to dist/ (required before running the CLI)
pnpm test             # Run all tests (vitest)
pnpm test:watch       # Watch mode
pnpm lint             # ESLint over src/ and test/
node bin/concord.js   # Run the built CLI locally
```

Run a single test file: `pnpm vitest run test/check.integration.test.ts`

Requires Node >= 20.19 and pnpm (see `packageManager` in package.json).

## What this is

concord detects concurrency hazards in [OpenSpec](https://github.com/Fission-AI/OpenSpec)
repositories: `concord check` catches base drift (a requirement changed on the base branch
after a change's delta was derived from it — the "silent clobber" case), and
`concord overlap` catches two open changes claiming the same requirement. See README.md for
the pitch and docs/design.md for the full design and prior-art survey.

## Architecture

Strictly layered; keep it that way:

- **`src/core/`** — pure functions, no I/O beyond `discover.ts`'s directory walk:
  - `spec.ts` / `delta.ts` — parse spec files and delta files into requirement blocks and
    operations
  - `canonical.ts` — canonicalisation + SHA-256 (CRLF→LF, strip trailing whitespace, collapse
    blank runs, trim edges; internal spacing is deliberately preserved for aligned tables)
  - `diff.ts` — minimal LCS line diff + context compression for redlines
  - `discover.ts` — enumerate `openspec/changes/*` (excluding `archive/`) from the working tree
- **`src/git.ts`** — thin async wrappers over the git CLI (`merge-base`, `show ref:path`,
  base-ref resolution). Spec baselines come from git refs; deltas come from the working tree.
- **`src/commands/`** — `check.ts` and `overlap.ts` orchestrate core + git and return plain
  result objects (no printing)
- **`src/report.ts`** — chalk rendering of result objects
- **`src/cli.ts`** — commander wiring; `bin/concord.js` is a shim importing `dist/cli.js`

## Critical invariants

- **Parser compatibility with OpenSpec is the point of this tool.** The regexes in
  `src/core/spec.ts` and `src/core/delta.ts` deliberately mirror OpenSpec v1.6.0's own parsers
  (requirement header `/^###\s*Requirement:\s*(.+)\s*$/i`, trim-only name normalisation,
  case-insensitive `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` sections, `- FROM:`/`- TO:`
  rename bullets with optional backticks). Do not "improve" the grammar unilaterally — a block
  concord recognises must be exactly a block OpenSpec would archive. If upstream's grammar
  changes, update both the regexes and the comment pointing at the upstream source.
- **The drift model:** a delta's baseline is the requirement's text at
  `merge-base(HEAD, base)`; the landing target is the text at the base tip. Both sides are
  canonicalised before comparison so reformatting never counts as drift. Merging/rebasing the
  base branch advances the merge-base and legitimately clears findings.
- **Exit codes are a CI contract:** 0 = clean, 1 = findings, 2 = usage/environment error.
  The `--json` output shapes (`CheckResult`, `OverlapResult`) are public API — extend, don't
  break.
- **ESM/NodeNext:** relative imports must carry the `.js` suffix (they resolve post-compile).

## Testing requirements

- Pure logic (parsers, canonicalisation, diff) → unit tests against the function.
- Anything involving git → integration tests that build a **throwaway git repo** in a temp dir
  (see `test/check.integration.test.ts`). Always `git config user.email/user.name` inside the
  test repo — CI runners have no global identity, and `git merge` needs one (this has broken CI
  before). Tests must stay hermetic: no network, no reliance on the host's git config.
- Bug fixes get a regression test that fails without the fix.

## Release

Tag-triggered and automated via `.github/workflows/release.yml`. To cut a release:

1. Run `pnpm bump X.Y.Z` — it updates `version` in every required place in one shot
   (package.json, `.claude-plugin/plugin.json`, and `skills/concord/SKILL.md`; see
   `scripts/bump-version.mjs`). Then commit with a conventional-commit message
   (`chore: release vX.Y.Z`).
2. Tag the commit `vX.Y.Z` (matching package.json exactly — the release job fails on a
   mismatch) and push the tag.

Pushing the tag runs the full CI gate (reused from `ci.yml` via `workflow_call`: openspec
validation + lint/build/test across Node 20/22/24; the concord dogfood job self-skips on tags,
which have no base branch) and, only if it passes:

- **major-tag** stamps the actions' default `version` and force-moves the floating major tag
  (`v1`) so `uses: lucinate-ai/concord/actions/ci@v1` tracks the latest release;
- **release** generates a changelog from conventional commits since the previous tag
  (`scripts/release-notes.mjs`), creates the GitHub release (a pre-release for a `-`-suffixed
  tag), and publishes to npm via **trusted publishing** (OIDC — no `NPM_TOKEN`; provenance is
  automatic).

One-time setup on npmjs.com: under the `@lucinate-ai/concord` package settings, add a trusted
publisher pointing at this repo and the `release.yml` workflow. CI (`.github/workflows/ci.yml`)
also runs on every push and PR; keep it green.

`pnpm bump X.Y.Z` keeps `.claude-plugin/plugin.json`'s `version` and the `metadata.version` in
`skills/concord/SKILL.md` in step with package.json — the Claude Code plugin metadata lives in
separate files and would otherwise drift. If you add another file that carries the version, add it
to `TARGETS` in `scripts/bump-version.mjs`. Separately, whenever concord's finding kinds (`drift`,
`removed-upstream`, `target-missing`, `name-collision`, `overlap`) or CLI flags change, update
`skills/concord/SKILL.md` too so the agent guidance stays true to the tool.

## Style

British English in prose (docs, comments, user-facing strings: "canonicalise", "licence").
Apache-2.0 licence — keep the header-free convention (no per-file licence headers).
