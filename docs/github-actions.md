# concord GitHub Actions

Run concord in your own CI. There are three composite actions, one per concord command, plus a
reusable workflow that wires up checkout for you.

| Action | Command | Use it for |
| --- | --- | --- |
| `lucinate-ai/concord/actions/ci@v1` | `concord ci` | The combined gate — drift **and** overlap in one step. Start here. |
| `lucinate-ai/concord/actions/check@v1` | `concord check` | Stale-base drift, missing targets, name collisions only. |
| `lucinate-ai/concord/actions/overlap@v1` | `concord overlap` | Cross-change requirement overlap only. |

Each action installs concord from npm at run time, runs its command with `--json`, turns findings
and overlaps into pull request annotations and a job step summary, and sets outputs you can gate
on. Findings (or overlaps) fail the job by default.

## Quick start (reusable workflow)

The reusable workflow handles the full-history checkout for you. Add one file to your repo:

```yaml
# .github/workflows/concord.yml
name: concord
on:
  pull_request:

jobs:
  concord:
    uses: lucinate-ai/concord/.github/workflows/concord.yml@v1
```

That's it — on every PR it checks out with full history and runs `concord ci` against the PR base.

To run a single command, set `command`:

```yaml
jobs:
  concord:
    uses: lucinate-ai/concord/.github/workflows/concord.yml@v1
    with:
      command: overlap
```

## Using an action directly

If you want to compose concord into a larger job, use the action directly. **You must check out
with full history** — `concord ci`/`check` reconstruct the base from git history, and a shallow
clone silently breaks drift detection (the action fails with a clear error rather than reporting a
false "clean").

```yaml
name: concord
on:
  pull_request:

jobs:
  concord:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0            # required for ci/check
      - uses: lucinate-ai/concord/actions/ci@v1
```

`overlap` needs no git history, so it works without `fetch-depth: 0`.

## The full-history requirement

`concord check` (and therefore `ci`) reconstructs each targeted requirement at
`merge-base(HEAD, base)` and at the base tip, purely from git history. A shallow checkout does not
contain that history, so:

- Always set `fetch-depth: 0` on `actions/checkout` for the `ci` and `check` actions (the reusable
  workflow does this for you).
- On `pull_request` events the actions default the base ref to the PR base branch and fetch it.
- If the checkout is shallow, the `ci`/`check` actions fail with a message pointing here, rather
  than passing on an incomplete history.

## Inputs

Shared by all three actions:

| Input | Default | Description |
| --- | --- | --- |
| `dir` | `openspec` | OpenSpec directory relative to the repo root. |
| `version` | `latest`\* | concord npm version or dist-tag to install. |
| `working-directory` | `.` | Directory to run in, relative to the workspace. |
| `fail-on-findings` | `true` | Fail the step when findings or overlaps are present. |
| `annotations` | `true` | Emit PR annotations. |
| `summary` | `true` | Write a job step summary. |

`ci` and `check` also accept:

| Input | Default | Description |
| --- | --- | --- |
| `base` | *(auto)* | Base ref override. Defaults to the PR base on `pull_request`, else origin's default branch. |
| `change` | *(all)* | Restrict the check analysis to a single change id. |

`overlap` has no `base` or `change` input — `concord overlap` uses neither.

\* When you pin the action ref to a release tag (e.g. `@v1`), `version` is stamped to that
release's concord version. Pin `version` explicitly (e.g. `version: 0.2.0`) for strict
reproducibility.

## Outputs

All three actions set:

| Output | Description |
| --- | --- |
| `findings` | Number of check findings (`0` for the `overlap` action). |
| `overlaps` | Number of overlapping requirements (`0` for the `check` action). |
| `exit-code` | concord exit code: `0` clean, `1` findings/overlaps, `2` error. |
| `result` | Raw concord JSON (the `{ check, overlap }` document for `ci`). |

Gate on the outputs yourself by setting `fail-on-findings: false`:

```yaml
      - id: concord
        uses: lucinate-ai/concord/actions/ci@v1
        with:
          fail-on-findings: false
      - if: steps.concord.outputs.findings != '0'
        run: echo "::notice::${{ steps.concord.outputs.findings }} finding(s)"
```

Environment or usage errors (concord exit code `2`) always fail the step, regardless of
`fail-on-findings`.

## Annotations and the job summary

- **Annotations** — each check finding becomes a PR annotation (attached to the change's delta file
  `openspec/changes/<change>/specs/<domain>/spec.md` when it exists), and each overlap becomes a
  warning naming the requirement and the changes that claim it. Set `annotations: false` to turn
  them off; findings still affect the exit code and summary.
- **Job summary** — a Markdown table of findings and overlaps (or a clean statement) is written to
  the run's step summary. Set `summary: false` to turn it off.

## Versioning

Pin the action ref to the floating major tag `@v1` to get compatible updates automatically, or pin
an exact release (`@v1.2.0`) or commit SHA for strict reproducibility. The `v1` tag is moved to
each compatible release, and the actions' default `version` is stamped to match.

## Packaging note

The published npm package (`@lucinate-ai/concord`) ships only `dist/` and `bin/` (see `files` in
`package.json`). The `actions/`, `.github/`, `docs/`, and `scripts/` directories are consumed from
the git repository by GitHub Actions and are intentionally excluded from the npm tarball — keep
them out of the `files` allowlist.
