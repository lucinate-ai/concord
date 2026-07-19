# Drift Detection Specification

## Purpose

Catch stale-base drift in open OpenSpec changes: when a requirement changes on the base branch after a delta was derived from it, archiving that delta would silently overwrite the upstream edit. `concord check` reconstructs each targeted requirement at the merge-base (the author's baseline) and at the base-branch tip, and reports drift when they differ — with no stored state, purely from git history.

## Requirements

### Requirement: Drift detection against the merge-base
For every delta operation that modifies, removes, or renames a requirement, `concord check` SHALL compare the requirement's block at `merge-base(HEAD, baseRef)` with its block at the tip of the base ref, and SHALL report a finding of kind `drift` when they differ.

#### Scenario: Requirement changed on base after divergence
- **WHEN** a delta marks a requirement as MODIFIED, REMOVED, or RENAMED
- **AND** the requirement's text at the base tip differs from its text at the merge-base
- **THEN** a `drift` finding is reported for that change, domain, and requirement
- **AND** the finding carries both the merge-base block and the tip block

#### Scenario: Requirement unchanged on base
- **WHEN** the requirement's block is equivalent at the merge-base and the base tip
- **THEN** no drift finding is reported for that operation

### Requirement: Drift for targets that appeared after divergence
When a targeted requirement exists at the base tip but not at the merge-base, `concord check` SHALL report a `drift` finding, because the delta cannot have been derived from a requirement that did not yet exist on the author's baseline.

#### Scenario: Requirement added on base after the branch diverged
- **WHEN** a MODIFIED, REMOVED, or RENAMED target exists at the base tip but not at the merge-base
- **AND** the branch is behind the base ref
- **THEN** a `drift` finding is reported carrying the tip block

### Requirement: Canonical block comparison
Blocks SHALL be canonicalised before comparison so that semantically-null reformatting never registers as drift: line endings normalised to LF, trailing whitespace stripped per line, runs of blank lines collapsed to one, and leading/trailing blank lines removed. Internal spacing SHALL be preserved, so aligned tables and indented bullets remain significant.

#### Scenario: Formatting-only change on base
- **WHEN** a requirement differs between merge-base and tip only in line endings, trailing whitespace, or blank-line runs
- **THEN** no drift finding is reported

#### Scenario: Content change on base
- **WHEN** the wording or internal indentation of a requirement changes
- **THEN** the blocks compare as different and drift is reported

### Requirement: Drift clears when the branch is level with the base
Drift findings SHALL clear automatically once the merge-base equals the base tip — that is, after the author merges or rebases the base branch and re-derives the delta. No drift comparison is performed when the branch is up to date.

#### Scenario: Branch merges the base branch
- **WHEN** a branch with a drift finding merges or rebases the base ref so the merge-base advances to the tip
- **THEN** the drift finding is no longer reported

### Requirement: ADDED operations cannot drift
Delta entries in an ADDED section SHALL never produce drift findings, since an added requirement has no upstream baseline to drift from. ADDED entries are checked only for name collisions.

#### Scenario: Base moves under an ADDED entry
- **WHEN** the base branch gains commits after a branch with an ADDED delta entry diverged
- **AND** the added name does not exist on the base
- **THEN** no finding is reported for that entry
