# Delta Validation Specification

## Purpose

Verify that every delta operation in an open change can actually be applied against the base branch at archive time: targets must exist, and names being introduced must not collide with requirements that already exist. These checks catch typos, upstream removals, and duplicate names before they become silent archive failures.

## Requirements

### Requirement: Target must exist on the base branch
For every MODIFIED, REMOVED, or RENAMED delta entry, `concord check` SHALL verify that a requirement with the target name exists in the domain's spec at the base tip. When the target exists at neither the base tip nor the merge-base, it SHALL report a finding of kind `target-missing`, since archive could never apply the entry.

#### Scenario: Target name never existed
- **WHEN** a MODIFIED entry names a requirement absent from both the base tip and the merge-base
- **THEN** a `target-missing` finding is reported
- **AND** the detail explains that the name must match the spec's requirement header

### Requirement: Removed-upstream detection
When a MODIFIED, REMOVED, or RENAMED target existed at the merge-base but is absent from the base tip, `concord check` SHALL report a finding of kind `removed-upstream` — distinct from `target-missing` — because the requirement was deleted or renamed on the base after the branch diverged.

#### Scenario: Requirement deleted on base after divergence
- **WHEN** a delta targets a requirement that exists at the merge-base but not at the base tip
- **THEN** a `removed-upstream` finding is reported carrying the merge-base block
- **AND** the fix hint suggests dropping or re-targeting the delta entry

### Requirement: Name collision for ADDED requirements
For every ADDED delta entry, `concord check` SHALL report a finding of kind `name-collision` when a requirement with the same name already exists in the domain's spec at the base tip, since archiving would duplicate or clobber it.

#### Scenario: ADDED name already on base
- **WHEN** an ADDED entry uses a name that exists in the domain spec at the base tip
- **THEN** a `name-collision` finding is reported for that name

### Requirement: Name collision for RENAMED targets
For every RENAMED delta entry, `concord check` SHALL report a finding of kind `name-collision` when the TO name already exists in the domain's spec at the base tip, since the rename would create a duplicate.

#### Scenario: Rename target already on base
- **WHEN** a RENAMED entry's TO name matches an existing requirement at the base tip
- **THEN** a `name-collision` finding is reported for the TO name

### Requirement: Exact requirement-name matching
Target names SHALL be matched against spec requirement names exactly, after trimming leading and trailing whitespace only — mirroring how OpenSpec v1.6.0 matches names at archive time. No case folding or fuzzy matching is applied.

#### Scenario: Name differs only in surrounding whitespace
- **WHEN** a delta's target name equals a spec requirement name after trimming
- **THEN** the target resolves and no finding is reported

#### Scenario: Name differs in case or wording
- **WHEN** a delta's target name differs from every spec requirement name in anything other than surrounding whitespace
- **THEN** the target does not resolve
