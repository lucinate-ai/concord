# concord

**Concurrent OpenSpec for teams.** Catch base drift and overlapping spec changes *before* they
silently clobber each other.

[![npm](https://img.shields.io/npm/v/%40lucinate-ai/concord)](https://www.npmjs.com/package/@lucinate-ai/concord)
[![CI](https://github.com/lucinate-ai/concord/actions/workflows/ci.yml/badge.svg)](https://github.com/lucinate-ai/concord/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

## The problem

[OpenSpec](https://github.com/Fission-AI/OpenSpec) changes express a `MODIFIED` requirement as
the **full new text** of that requirement, which replaces the whole block by name at archive
time. The delta records nothing about the base it was derived from. On a team, that makes
concurrent work dangerous:

1. Alice and Bob both branch off the same spec. Both open changes that `MODIFY` the same
   requirement.
2. Alice lands first.
3. Bob rebases onto main — cleanly, because his branch never touched `openspec/specs/` — then
   archives. His stale block **silently overwrites Alice's change.** No git conflict. No
   validation error. Her requirement edit is simply gone.

OpenSpec's own [parallel-merge plan](https://github.com/Fission-AI/OpenSpec/blob/main/openspec-parallel-merge-plan.md)
names this exact failure mode; as of v1.6.0 a stale archive is halted in one narrow case, and
the rest of the fix (base snapshots, rebase, merge) is roadmap. Until then, teams run on
discipline and sharp-eyed reviewers.

concord closes the gap **today**, with no changes to your specs or workflow.

## What it does

**`concord check`** — verifies every open change against the base branch:

- **drift** — a requirement your delta modifies/removes/renames changed on the base branch
  since your branch diverged: archiving would silently discard that change
- **removed-upstream** — your target was deleted or renamed on the base branch
- **target-missing** — the requirement name doesn't match anything (typo — archive can't apply it)
- **name-collision** — an `ADDED` or `RENAMED`-to name already exists on the base branch

```text
$ concord check
concord check — base main (merge-base dadb152; base has moved 1 commit(s) since this branch diverged)

✖ drift  tighten-frobnication → widgets / "Widget frobnication" [MODIFIED]
    requirement changed on main since this branch diverged — archiving this
    MODIFIED entry would silently discard that change
    --- at merge-base (your baseline)   +++ at main (current)
      ⋯
      - **WHEN** frobbed
      - **THEN** frobnicates
    +
    + #### Scenario: Frob audit
    + - **WHEN** audited
    + - **THEN** every frob is logged
    fix: re-derive this delta block against main, then merge or rebase so the merge-base advances

1 finding(s) across 1 change(s); 1 operation(s) checked
```

**`concord overlap`** — flags any requirement claimed by more than one open change, so two
people discover they're editing the same requirement on day one, not at archive time.

Exit codes are CI-friendly: `0` clean, `1` findings, `2` usage/environment error. Both commands
take `--json`.

## How it works (and why there's nothing to adopt)

For a PR branch, the base a delta block was derived from is simply the requirement's text at
`merge-base(HEAD, main)` — and the version it will land on is the text at the `main` tip.
concord reconstructs both **from git history**, canonicalises them (so whitespace reflow never
counts as drift), and compares. If the requirement moved, you get a loud, early failure with a
redline — instead of a silent overwrite at archive time.

No sidecar files, no lockfiles, no format changes, no server. If your specs are in git, it
already works. Rebasing or merging the base branch (after re-deriving your block) advances the
merge-base and clears the finding — the fix is the git hygiene you'd want anyway.

concord's parsers mirror OpenSpec v1.6.0's own header patterns (requirement headers, delta
sections, `FROM:`/`TO:` renames), so it recognises exactly the blocks OpenSpec would archive.

## Quickstart

```bash
# in a repo with an openspec/ directory
npx @lucinate-ai/concord check
npx @lucinate-ai/concord overlap
```

## Use it in your CI

Run concord in your own pipeline with the first-party GitHub Actions, published from this repo's
`actions/` directory. Add one workflow — the `ci` action runs `concord ci` (drift **and** overlap)
against the PR base, annotating findings on the pull request and writing a job summary. Check out
with `fetch-depth: 0` so `ci`/`check` can reconstruct the merge-base from history:

```yaml
# .github/workflows/concord.yml
name: concord
on:
  pull_request:

jobs:
  concord:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: lucinate-ai/concord/actions/ci@v1
```

There are three actions — `actions/ci`, `actions/check`, `actions/overlap`. See
[docs/github-actions.md](docs/github-actions.md) for inputs, outputs, and examples. You can always
call the CLI by hand instead:

```yaml
- name: Spec drift check
  run: |
    git fetch origin main
    npx @lucinate-ai/concord ci --base origin/main
```

## Use it as a Claude Code plugin

concord ships as a [Claude Code](https://code.claude.com) plugin, so your coding agent knows to
run these checks at the moments a clobber slips through — before archiving a change, after
rebasing onto the base branch, or when a delta touches a requirement that already exists. The
repo is its own marketplace:

```text
/plugin marketplace add lucinate-ai/concord
/plugin install concord@concord-marketplace
```

Once installed, the bundled **concord** agent skill tells the agent when to run `concord check`
/ `concord overlap`, which flags to use, and how to read the exit codes (`0`/`1`/`2`) and each
finding kind (`drift`, `removed-upstream`, `target-missing`, `name-collision`, `overlap`). The
plugin only packages guidance around the existing CLI — it changes none of concord's commands,
`--json` shapes, or exit codes.

## Commands

| Command | What it verifies | Key options |
|---|---|---|
| `concord check` | every open change's delta targets against the base branch | `--base <ref>`, `--change <id>`, `--dir <path>`, `--json`, `-C <cwd>` |
| `concord overlap` | no requirement is claimed by two open changes | `--dir <path>`, `--json`, `-C <cwd>` |
| `concord ci` | check and overlap together — one gate, one exit code, one JSON document | `--base <ref>`, `--change <id>`, `--dir <path>`, `--json`, `-C <cwd>` |

## Roadmap

`check` and `overlap` are the detection layer — the piece that turns silent data loss into a
build failure. The larger aim is the missing **merge layer** for spec-driven development:

- **`concord rebase`** — structured 3-way merge of a delta against the moved base
  (requirement → scenario → clause, keyed by name), so edits to *different scenarios of the
  same requirement* merge automatically and only true overlaps conflict
- **Base snapshots** — recorded base hashes for cases git history can't reconstruct
- **A GitHub Action / bot** — overlap warnings as PR comments across open PRs
- **Semantic invariants** — lint the merged spec for contradictions in the merge queue
- **Adapters** — the engine is format-blind at the core; OpenSpec is the first adapter

See [docs/design.md](docs/design.md) for the full design and the survey of prior art
(kubectl's 3-way apply, Doorstop's suspect links, structured-merge research, legislative
amendment drafting) it builds on.

## Relationship to OpenSpec

concord is an independent companion tool, aligned with the direction OpenSpec's maintainers
have already sketched in their parallel-merge plan. It exists so teams get protection *now*,
brownfield, with zero adoption cost — and its detection layer is intentionally the same shape
as the plan's first phases, so the ideas (and code) are offerable upstream.

## Licence

Apache-2.0
