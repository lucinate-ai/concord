# Tasks: add `concord ci` command

## 1. Core implementation

- [x] 1.1 Create `src/commands/ci.ts` with `runCi(options)` composing `runCheck` and `runOverlap`, returning `{ check, overlap }` and a `CiOptions` type (cwd, dir, base, change)
- [x] 1.2 Export the new command module from `src/index.ts` alongside the existing commands

## 2. CLI and rendering

- [x] 2.1 Register the `ci` command in `src/cli.ts` with `-C/--cwd`, `--dir`, `--base`, `--change`, `--json`; exit 1 when either analysis reports problems, otherwise 0
- [x] 2.2 Emit the combined `--json` document (`check` and `overlap` keys, pretty-printed)
- [x] 2.3 Add `renderCi` to `src/report.ts` that renders the check report, then the overlap report, then a combined summary line

## 3. Tests

- [x] 3.1 Add `test/ci.integration.test.ts`: clean repo exits 0 with both sections clean
- [x] 3.2 Test exit 1 when only the check analysis has findings, and when only the overlap analysis has overlaps
- [x] 3.3 Test the combined JSON shape matches the individual commands' results for the same repo state
- [x] 3.4 Test that `--change` restricts the check analysis but not the overlap analysis

## 4. Verification

- [x] 4.1 Run `pnpm lint` and `pnpm test`
- [x] 4.2 Dogfood: `pnpm build && node bin/concord.js ci` on this repo and confirm output and exit code
