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

Manual for now: bump the version in package.json, then `npm publish --access public`
(`prepublishOnly` runs build + tests; publishing requires the maintainer's npm 2FA, so a human
runs it). Conventional-commit style commit messages (`feat:`, `fix:`, `docs:`, …). CI
(`.github/workflows/ci.yml`) runs lint + build + test across Node 20/22/24 on every push and
PR; keep it green.

## Style

British English in prose (docs, comments, user-facing strings: "canonicalise", "licence").
Apache-2.0 licence — keep the header-free convention (no per-file licence headers).
