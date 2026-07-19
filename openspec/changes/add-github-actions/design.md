## Context

concord ships as an npm CLI (`@lucinate-ai/concord`, bin `concord`). As of `main` it has three
commands, all CI-friendly (exit `0` clean, `1` on findings, `2` on usage/environment errors, all
take `--json`):

- `check` → `{ baseRef, mergeBase, tip, upToDate, behind, operations, changes[], findings[] }`,
  each finding `{ kind, changeId, domain, requirement, operation, detail, baseBlock?, tipBlock? }`
  with `kind ∈ { drift, removed-upstream, target-missing, name-collision }`.
- `overlap` → `{ changes[], requirements, overlaps[] }`, each overlap
  `{ domain, requirement, claims[] }`, each claim `{ changeId, operations[] }`.
- `ci` → `{ check: CheckResult, overlap: OverlapResult }` — runs both analyses in one invocation
  and returns a single exit code (`1` when there are any findings *or* overlaps). This is the
  natural thing to run in a pipeline: one command, one gate, one JSON document.

What's missing is a supported way for *other* repositories to run this in their pipelines without
hand-writing checkout, install, base-ref selection, and result rendering. concord depends on git
history — it reconstructs the requirement text at `merge-base(HEAD, base)` and at the base tip —
so a shallow checkout silently produces a false "clean" result. That footgun is the main reason a
first-party action is worth shipping.

This change adds a **set of composite GitHub Actions** (one per command) under a top-level
`actions/` directory, plus a **reusable workflow** and the release wiring to make `@v1`
resolvable. It touches no CLI code.

## Goals / Non-Goals

**Goals:**
- One-line adoption for OpenSpec teams: `uses: lucinate-ai/concord/actions/ci@v1`.
- Turn findings and overlaps into PR annotations and a job step summary, so reviewers see them on
  the PR, not just in logs.
- Make the full-history requirement hard to get wrong — the reusable workflow handles checkout;
  the `ci`/`check` actions fail loudly on a shallow clone rather than reporting a false clean.
- Keep the actions thin, pinned consumers of the published CLI; no new runtime dependency in the
  package, no CLI behaviour change.
- One action per command, each exposing only the inputs its command uses, sharing common logic so
  the wrappers stay small.

**Non-Goals:**
- No new `concord` subcommand, flag, or output format. (A native `--format github` annotation
  mode is noted under Open Questions as a possible follow-up.)
- No Docker or JavaScript (bundled) actions — composite only.
- No GitHub Marketplace listing. Subdirectory actions are consumed by the `uses:` path form,
  which needs no listing; Marketplace requires a single root `action.yml` and is out of scope.
- No auto-fixing, rebasing, or writing back to the consumer repo. The actions are read-only.
- No support for non-GitHub CI in this change (the CLI already works anywhere).
- Not adding the actions to concord's own `ci.yml` as a dogfood job here (can follow later).

## Decisions

### D1: Composite actions over Docker or JavaScript actions
**Composite** actions (`runs.using: composite`) run shell steps directly on the runner. They need
no image build and no committed `dist/` bundle (which JS actions require and which drifts from
source). concord is one `npx` away, so the actions' job is orchestration, not code. Composite
keeps each action readable in its `action.yml` plus the shared helpers.

- *Alternative — JavaScript action*: would let us reuse concord's TypeScript to render
  annotations, but requires bundling and committing compiled output and `@actions/core`. Rejected
  as heavier to maintain for what is glue.
- *Alternative — Docker action*: slowest cold start and pointless when the runner has Node. Rejected.

### D2: Separate actions under `actions/`, referenced by path
Rather than a single root `action.yml` with a `command` input, ship one action per command:
`actions/ci`, `actions/check`, `actions/overlap`. Consumers pick the behaviour by path
(`uses: lucinate-ai/concord/actions/ci@v1`) instead of by input, and each action's inputs are
scoped to what its command actually uses (`overlap` has no `base`/`change`). This reads more
clearly in consumer workflows and matches how repos with several actions are usually laid out
(e.g. one repo, many `actions/<name>` folders).

- *Trade-off — no Marketplace listing*: GitHub only publishes a single `action.yml` at the repo
  root to the Marketplace, so nesting under `actions/` forgoes a Marketplace entry. Path
  references work without a listing, so this only costs discoverability, which docs/README cover.
- *Alternative — one root action with a `command` input*: Marketplace-publishable and a single
  interface, but every input has to be documented as "ignored unless command=…", and it couples
  three behaviours into one surface. Rejected in favour of the explicit split the maintainer asked
  for.

### D3: Install concord at run time, pinned by `version`
Each action runs `npx --yes @lucinate-ai/concord@<version> <command> --json` (or an equivalent
`npm i -g` then invoke). `version` defaults to the version published alongside the actions'
release, so `@v1` gives a matched action+CLI pair rather than a floating `latest` that could move
under consumers. Running the *installed* binary (not any concord in the consumer repo) keeps
behaviour predictable.

- *Alternative — resolve concord from the consumer's `node_modules`*: unpredictable and couples
  the actions to the consumer's toolchain. Rejected; installing on demand is deterministic.
  Optional dependency caching can be added later without changing the interface.

### D4: Share logic across the three actions
The heavy lifting lives once under `actions/`, referenced from each `action.yml` via
`$GITHUB_ACTION_PATH`:

- a small shell library / `run` script that performs the shallow-checkout guard, base-ref
  resolution + fetch, concord install, and command invocation, parameterised by the command; and
- a `report.mjs` (Node, already on the runner — no `jq` assumption) that reads the captured
  `--json` and emits annotations, the step summary, and the outputs.

`report.mjs`:
- emits one `::error …::` (or `::warning::`) workflow command per finding/overlap. For check
  findings it sets `file=<dir>/changes/<changeId>/specs/<domain>/spec.md` when that path exists,
  so the annotation lands on the delta block; concord's JSON has no line number, so annotations
  are file-level. Overlap annotations are file-less messages naming the requirement and claimants.
- appends a Markdown summary (base ref, behind count, a findings table, an overlaps table, or a
  clean statement) to `$GITHUB_STEP_SUMMARY`.
- writes `findings`, `overlaps`, `exit-code`, and `result` to `$GITHUB_OUTPUT`.

It accepts the `ci` shape `{ check, overlap }` as well as the bare `check`/`overlap` shapes, so
one renderer serves all three actions.

Note: a composite action cannot reliably `uses:` a sibling composite action by relative path
(relative `uses:` resolves against the *consumer's* workspace), so sharing is done through helper
*files* invoked with `bash`/`node`, not through a nested action.

### D5: Base ref resolution and full-history guarantee (ci/check only)
The `ci` and `check` actions do not re-implement concord's base resolution; they only make sure
the base ref *exists locally*. On `pull_request` with no `base` input, they default
`--base origin/<base_ref>` using `github.base_ref` and run `git fetch --no-tags origin <base_ref>`
first. On other events with no `base`, they let concord resolve the base itself (origin's default
branch). Before running, they check `git rev-parse --is-shallow-repository`; if shallow, they fail
with a message pointing at `fetch-depth: 0` rather than letting concord report a misleading clean
result. The `overlap` action skips all of this — overlap needs no git history.

- *Alternative — always `git fetch --unshallow`*: convenient but can be very slow on big repos and
  masks the consumer's misconfiguration. Rejected in favour of failing fast; the reusable workflow
  removes the need by checking out full history up front.

### D6: `fail-on-findings` and exit-code mapping
concord's exit codes drive the step result. The `ci` action gets this for free: `concord ci`
already returns `1` for any findings *or* overlaps and `2` for environment errors, so the action
reads that single code — no combining of separate runs. The `check`/`overlap` actions map their
own command's code the same way:
- `2` (environment/usage) always fails the step, regardless of `fail-on-findings`.
- `1` (findings/overlaps) fails the step when `fail-on-findings: true` (default), else the step
  succeeds and the counts are still emitted as outputs for the consumer to gate on.
- `0` succeeds.

### D7: Reusable workflow as the recommended path
`.github/workflows/concord.yml` (`on: workflow_call`) owns `actions/checkout@v4` with
`fetch-depth: 0` and calls one of the composite actions (default `actions/ci`), exposing a
`command` input to select `check`/`overlap` plus the pass-through inputs. Consumers add a ~10-line
caller workflow and never touch checkout depth — the most common failure mode is designed out.
The individual actions remain available for teams composing them into a larger job.

### D8: Versioning — floating `v1` tag maintained on release
Consumers pin `@v1` on their `actions/<command>` path references; a release job (triggered on
published GitHub releases / `v*.*.*` tags) force-updates the `v1` tag to the release commit. This
is the standard pattern for path-referenced actions. Each action's default `version` input is
stamped to the released package version so the actions and CLI move together.

## Risks / Trade-offs

- **No Marketplace listing** (subdirectory actions) → Document the `uses:` path form in the README
  and `docs/`; discoverability is the only loss, and path references need no listing.
- **Shallow checkout gives a false clean** → The `ci`/`check` actions refuse to run against a
  shallow clone and the reusable workflow sets `fetch-depth: 0`; docs call this out prominently.
- **Annotations are file-level, not line-level** (concord JSON carries no line numbers) → Attach
  to the delta file and put full detail in the message and the step summary; revisit if the CLI
  later emits locations.
- **Three action.yml files can drift** → Keep them thin wrappers over the shared helper; cover the
  helper (`report.mjs`) with tests over captured JSON fixtures.
- **`npx` install adds latency per run** → Acceptable for a lint-style check; document optional
  dependency caching. Pinning `version` keeps installs cache-friendly.
- **Floating `v1` can ship a regression to all consumers at once** → Keep the actions thin and the
  helper tested; consumers who want strict pinning can use `@vX.Y.Z` or a commit SHA.
- **`actions/` folder shipped to npm** → `package.json` `files` already scopes the published
  tarball to `dist`/`bin`, so `actions/` is excluded; add a note so future edits keep it that way.

## Migration Plan

This is additive — no existing behaviour changes, nothing to roll back in consumers.

1. Land the shared helper, the three `actions/<command>/action.yml` files, the reusable workflow,
   docs, and examples.
2. Validate the actions against this repo (a temporary workflow or a local run of `report.mjs` on
   captured `--json` fixtures) before advertising them.
3. Cut a release and create/point the `v1` tag.
4. Announce in the README ("Use it in your CI"). Consumers opt in; there is no forced migration.
5. Rollback: if a release regresses, move `v1` back to the previous good tag; consumers pinned to
   a SHA/exact tag are unaffected.

## Open Questions

- Should concord gain a native `--format github` (or `--annotate`) output mode so the actions stop
  post-processing JSON? Cleaner long term, but a CLI change; deferred to a separate change.
- Should the reusable workflow default to `ci` (proposed) or run all three as separate jobs? `ci`
  is the single-gate answer and is proposed as the default; confirm with maintainers.
- Should any action optionally post/update a single PR comment as an alternative to annotations?
  Nice-to-have; would need `pull-requests: write` and a token. Out of scope for now.
- Do we also ship a `.github/workflow-templates/` starter so the reusable workflow appears in the
  "New workflow" gallery for org repos? Low cost; can follow.
