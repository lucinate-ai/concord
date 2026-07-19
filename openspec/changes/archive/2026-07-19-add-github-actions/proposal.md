## Why

concord is CI-friendly by design (predictable exit codes, `--json`), but every team that
wants it in their pipeline currently has to hand-write the plumbing: full-history checkout,
installing the package, choosing the base ref, running the commands, and turning findings into
something reviewers actually see on a PR. That boilerplate is easy to get subtly wrong — a
shallow checkout silently breaks drift detection — and it has to be reinvented in every repo.
Publishing a reusable GitHub Action removes that friction: any OpenSpec team can adopt concord
in their CI with a few lines, and get PR annotations and a run summary for free.

## What Changes

- Add **separate composite GitHub Actions under a top-level `actions/` directory**, one per
  concord command:
  - `actions/ci` — runs `concord ci` (the combined check+overlap gate: one command, one exit
    code, one JSON document). This is the action most teams will use.
  - `actions/check` — runs `concord check` only (stale-base drift, missing targets, collisions).
  - `actions/overlap` — runs `concord overlap` only (cross-change requirement overlap).

  Each action is a thin composite that installs concord, runs its command with `--json`, and
  turns findings/overlaps into GitHub annotations and a job step summary. Consumers reference them
  by path, e.g. `uses: lucinate-ai/concord/actions/ci@v1`. The three share a common helper
  (installation, shallow-checkout guard, base-ref handling, JSON rendering) so the wrappers stay
  small. Each action exposes only the inputs its command uses (e.g. `overlap` has no base/change
  input) and the same outputs: finding/overlap counts, exit code, and raw JSON.
- Add a **reusable workflow** (`.github/workflows/concord.yml`, `on: workflow_call`) that owns
  the fragile parts — full-history checkout and fetching the PR base branch — and calls the
  `actions/ci` action (with an input to select `check`/`overlap`), so a consumer can adopt concord
  by adding one small caller workflow.
- Add **consumer-facing documentation and copy-paste examples**: a `docs/github-actions.md`
  page, a README section, and example caller workflows for both the actions and the reusable
  workflow.
- Add **release/version wiring**: a release job that moves the floating major-version tag (`v1`)
  so the `@v1` path references keep resolving to the latest compatible release.
- No changes to the `concord` CLI, its commands, exit codes, or JSON — the actions are pure
  consumers of the existing interface, including the `concord ci` command already on `main`.

## Capabilities

### New Capabilities
- `github-actions`: a set of reusable composite GitHub Actions under `actions/` (one per concord
  command — `ci`, `check`, `overlap`) plus a companion reusable workflow, letting external
  repositories run concord in CI, rendering findings and overlaps as PR annotations and a job
  summary, with configurable base ref, directory, scope, and fail-on-findings behaviour, plus the
  floating-tag versioning that makes `@v1` path references usable.

### Modified Capabilities
<!-- None. The action consumes the existing CLI, exit codes, and JSON unchanged. -->

## Impact

- **New files**: `actions/ci/action.yml`, `actions/check/action.yml`, `actions/overlap/action.yml`
  (the three composite actions); a shared helper (e.g. `actions/report.mjs` for rendering and a
  small shared shell library) referenced by each action; `.github/workflows/concord.yml`
  (reusable workflow); `docs/github-actions.md`; example workflows (e.g. under `docs/` or
  `examples/`); a release/tag-maintenance workflow.
- **Consumers**: adopt via `uses: lucinate-ai/concord/actions/ci@v1` (or `.../actions/check@v1`,
  `.../actions/overlap@v1`), or `uses: lucinate-ai/concord/.github/workflows/concord.yml@v1`
  (reusable workflow). The `ci`/`check` actions require a full-history checkout (`fetch-depth: 0`);
  the reusable workflow does this for them.
- **Dependencies**: none added to the package. The actions install concord from npm at run time
  (pinned by the `version` input) and rely only on tools present on GitHub-hosted runners
  (Node, git).
- **Marketplace note**: actions nested under `actions/` are consumed by the `uses:` path form and
  are **not** GitHub Marketplace listings (Marketplace requires a single `action.yml` at the repo
  root). Path references need no listing; the floating `v1` tag is what makes `@v1` resolve.
- **Existing CI**: the repo's own `ci.yml` is unaffected; a new job may be added later to
  smoke-test the action against this repo, but that is out of scope here.
- **Docs**: README gains a "Use it in your CI" section; no CLI behaviour changes.
