## 1. Shared helper

- [ ] 1.1 Add `actions/report.mjs` (Node, no deps) that reads concord JSON — the `ci` shape `{ check, overlap }` and the bare `check`/`overlap` shapes — plus options (dir, annotations on/off, summary on/off).
- [ ] 1.2 Emit GitHub annotation commands: one `::error` per check finding with `file=<dir>/changes/<changeId>/specs/<domain>/spec.md` when that path exists (message = kind, change, domain, requirement, operation); one `::error`/`::warning` per overlap naming the requirement and claiming changes. Skip all annotations when disabled.
- [ ] 1.3 Append a Markdown summary to `$GITHUB_STEP_SUMMARY`: base ref + behind count (for check/ci), a findings table, an overlaps table, or a clean statement (operations/changes verified). Skip when disabled or when `$GITHUB_STEP_SUMMARY` is unset.
- [ ] 1.4 Write `findings`, `overlaps`, `exit-code`, and `result` to `$GITHUB_OUTPUT` (multiline-delimiter form for `result`).
- [ ] 1.5 Add a shared shell library / run script under `actions/` that guards against a shallow checkout, resolves + fetches the base ref (ci/check only), installs concord pinned by `version`, runs `concord <command> --json`, and invokes `report.mjs` — parameterised by command.
- [ ] 1.6 Add a unit test running `report.mjs` over captured JSON fixtures (drift finding, overlap entry, combined `ci`, clean run) asserting the emitted annotations, summary, and outputs.

## 2. Composite actions

- [ ] 2.1 Add `actions/ci/action.yml` (`runs.using: composite`, `name`/`description`/`branding`) that runs `concord ci` via the shared helper; inputs `base`, `dir`, `change`, `version`, `working-directory`, `fail-on-findings`, `annotations`, `summary`; outputs `findings`, `overlaps`, `exit-code`, `result`.
- [ ] 2.2 Add `actions/check/action.yml` — same inputs/outputs as `ci` but runs `concord check` (overlaps output is `0`).
- [ ] 2.3 Add `actions/overlap/action.yml` — runs `concord overlap`; inputs `dir`, `version`, `working-directory`, `fail-on-findings`, `annotations`, `summary` (no `base`/`change`); findings output is `0`.
- [ ] 2.4 Ensure each action sets up Node if needed, calls the shared run script with its command, and applies the exit-code → `fail-on-findings` mapping (exit 2 always fails; exit 1 fails only when enabled).
- [ ] 2.5 Confirm the shallow-checkout guard fires for `ci`/`check` and is skipped for `overlap`.

## 3. Reusable workflow

- [ ] 3.1 Add `.github/workflows/concord.yml` with `on: workflow_call` and inputs `command` (ci|check|overlap, default ci), `base`, `dir`, `change`, `version`, `fail-on-findings`.
- [ ] 3.2 Job: `actions/checkout@v4` with `fetch-depth: 0`, then call the matching `actions/<command>` action passing the inputs through.

## 4. Release and versioning

- [ ] 4.1 Add a release workflow (on published release / `v*.*.*` tag) that force-updates the floating `v1` tag to the release commit.
- [ ] 4.2 Ensure each action's default `version` input is stamped to the released package version at release time (script or release-step check).
- [ ] 4.3 Confirm `package.json` `files` still scopes the npm tarball so `actions/` is not published to npm; add a comment/note guarding future edits.

## 5. Documentation and examples

- [ ] 5.1 Add `docs/github-actions.md`: the three actions and their path references, per-action inputs/outputs, the full-history requirement (ci/check), base-ref behaviour, annotations/summary, and fail-on-findings.
- [ ] 5.2 Add example caller workflows — one using the reusable workflow, one composing `actions/ci` directly with `checkout` (`fetch-depth: 0`), and an `overlap`-only example.
- [ ] 5.3 Add a "Use it in your CI" section to `README.md` linking the docs and showing the minimal reusable-workflow snippet and the `uses: lucinate-ai/concord/actions/ci@v1` form.

## 6. Validation

- [ ] 6.1 Run `pnpm lint`, `pnpm build`, `pnpm test` green (including the new `report.mjs` test).
- [ ] 6.2 Dry-run the actions' logic against this repo: generate `concord ci --json` (and `check`/`overlap`) fixtures and verify `report.mjs` produces the expected annotations and summary.
- [ ] 6.3 Validate the change with `openspec validate add-github-actions --strict` and fix any issues.
