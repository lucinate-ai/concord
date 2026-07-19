## 1. Add the combined command to invocation guidance

- [x] 1.1 In `skills/concord/SKILL.md`, add `concord ci` to the "How to invoke" guidance (the command list and, where relevant, the fallback `npx @lucinate-ai/concord ci`), stating it runs check + overlap together and returns a single exit code
- [x] 1.2 Reconcile the exit-codes note so the `1` case reads as "findings or overlaps" where `ci` is in scope

## 2. Document running concord in CI

- [x] 2.1 Add a "Running concord in CI" section to `skills/concord/SKILL.md` that names the three composite actions by their `uses:` path form — `lucinate-ai/concord/actions/ci`, `.../check`, `.../overlap` — and says which concord command each runs
- [x] 2.2 State that the actions self-install a pinned concord and emit PR annotations plus a job step summary, and that `actions/ci` is the combined check + overlap gate and the usual default
- [x] 2.3 Recommend only the `actions/` composite actions (concord's external surface); do not point consumers at concord's internal `.github/workflows/` reusable workflow
- [x] 2.4 Call out the two things an agent must get right: pin the `@v1` major tag, and check out with full history (`fetch-depth: 0`) for the `ci`/`check` actions because a shallow checkout breaks drift detection
- [x] 2.5 Point at the action YAML / `github-actions` spec for the full input list rather than duplicating every input, so the skill doesn't drift from the actions

## 3. Verify

- [x] 3.1 Confirm the action paths, defaults, and the full-history requirement in the skill match `actions/*/action.yml` and the `github-actions` spec, and that the skill does not reference concord's internal `.github/workflows/` reusable workflow
- [x] 3.2 Run `openspec validate skill-documents-github-actions` and confirm it passes
- [x] 3.3 Proof-read the skill in British English and keep the new content consistent with the existing tone and structure
