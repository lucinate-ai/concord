# Base Resolution Specification

## Purpose

Resolve which branch a change will eventually merge into, and compute the git metadata drift detection depends on: the merge-base (the author's baseline), the base tip, and how far the base has moved. All git access goes through the git CLI; concord stores no state of its own.

## Requirements

### Requirement: Base ref resolution order
`concord check` SHALL resolve the base ref in this order: an explicit `--base` ref if given (which must resolve to a commit, otherwise the command errors); then origin's default branch via the `origin/HEAD` symbolic ref; then the first of `origin/main`, `origin/master`, `main`, `master` that resolves. When none resolve, the command SHALL fail with an error suggesting `--base`.

#### Scenario: Explicit base ref
- **WHEN** `--base release` is passed and `release` resolves to a commit
- **THEN** `release` is used as the base ref, taking precedence over any default branch

#### Scenario: Explicit base ref does not exist
- **WHEN** `--base nonesuch` is passed and the ref does not resolve
- **THEN** the command fails with a git error

#### Scenario: No candidate resolves
- **WHEN** the repository has none of the conventional base refs
- **THEN** the command fails with an error listing the refs tried and suggesting `--base`

### Requirement: Merge-base metadata
`concord check` SHALL report, alongside its findings: the resolved base ref, the merge-base of HEAD and the base ref, the base tip commit, whether the branch is up to date (merge-base equals tip), and how many commits the base has gained since the merge-base.

#### Scenario: Branch behind the base
- **WHEN** the base ref has commits not reachable from the merge-base
- **THEN** the result reports `upToDate` false and the count of those commits as `behind`

#### Scenario: Branch level with the base
- **WHEN** the merge-base equals the base tip
- **THEN** the result reports `upToDate` true and `behind` 0

### Requirement: Absent spec files are not errors
Reading a spec file at a git ref where the path does not exist SHALL yield "no requirements" rather than an error, so deltas targeting a brand-new domain are handled by the finding rules, not by a crash.

#### Scenario: Domain spec does not exist on the base
- **WHEN** a delta's domain has no spec file at the base tip
- **THEN** the spec is treated as containing no requirements
- **AND** the delta's operations are checked against that empty set
