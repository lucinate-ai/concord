# Design: `concord ci` command

## Context

Concord exposes two analyses as separate commands: `check` (verifies open changes against the base branch via git) and `overlap` (finds requirements claimed by more than one open change, working tree only). CI pipelines that want both as a gate must run two processes, combine exit codes, and parse two JSON documents. Both analyses already exist as composable functions: `runCheck()` in `src/commands/check.ts` and `runOverlap()` in `src/commands/overlap.ts`, each returning a plain result object rendered by `src/report.ts`.

## Goals / Non-Goals

**Goals:**
- One invocation, one exit code, one JSON document for CI gating.
- Zero behaviour change to the existing `check` and `overlap` commands.
- Reuse the existing analysis and rendering code unchanged.

**Non-Goals:**
- No new analysis logic or finding kinds.
- No GitHub Action or PR-comment output (possible follow-up changes).
- No parallelisation of the two analyses; they are cheap and sequential is simpler.

## Decisions

- **Compose, don't re-implement.** A new `runCi()` in `src/commands/ci.ts` calls `runCheck()` then `runOverlap()` and returns `{ check, overlap }`. Alternative considered: a `--all` flag on `check` — rejected because it muddies a single-purpose command and its JSON shape.
- **`ci` requires git.** Since the check analysis needs git history, `concord ci` fails with exit 2 outside a git repository, even though overlap alone would work. Users in plain directories keep using `concord overlap`. Alternative: degrade to overlap-only with a warning — rejected as a silent weakening of the gate.
- **Option routing.** `ci` accepts the union of the two commands' options. `-C/--cwd` and `--dir` apply to both analyses; `--base` and `--change` apply to the check analysis only (overlap has no notion of either). Documented in the command help.
- **JSON shape.** `{ "check": <CheckResult>, "overlap": <OverlapResult> }` — the exact objects the individual commands emit, so existing consumers can reuse their parsers. No top-level summary field; the exit code is the summary.
- **Human output.** Render `renderCheck()` then `renderOverlap()` in sequence, unchanged, followed by one combined summary line so the reader gets a single verdict.
- **Exit code.** `findings.length > 0 || overlaps.length > 0` → 1; errors propagate to the existing top-level handler → 2; otherwise 0. Mirrors the per-command contract.

## Risks / Trade-offs

- [Both analyses call `discoverChanges()`, so delta files are read and parsed twice per `ci` run] → Accepted; discovery is milliseconds on realistic repos. Refactor to share discovery only if profiling ever warrants it.
- [The combined JSON document embeds two result shapes; future changes to either propagate into `ci` output] → Intentional: the shapes are shared on purpose, and the specs pin both.
- [Sequential execution means check errors mask overlap results] → Acceptable for a gate: exit 2 signals "fix the environment", not "specs are clean".
