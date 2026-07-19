# Overlap Detection Specification

## Purpose

Surface requirements claimed by more than one open change so teams discover contention when the second change opens, not at archive time. OpenSpec deltas replace whole requirement blocks by name at archive, so two open changes touching the same requirement is a future conflict or silent clobber. `concord overlap` needs only the working tree — no git history.

## Requirements

### Requirement: Cross-change claim detection
`concord overlap` SHALL index every requirement name claimed by every open change, keyed by domain, and SHALL report an overlap entry for each (domain, requirement) pair claimed by two or more distinct changes. Each entry SHALL list the claiming changes and the operation types each used. A claim is any delta operation naming the requirement: ADDED, MODIFIED, REMOVED, or RENAMED.

#### Scenario: Two changes touch the same requirement
- **WHEN** two open changes each contain a delta operation naming the same requirement in the same domain
- **THEN** an overlap entry is reported for that domain and requirement
- **AND** it lists both change ids with their operation types

#### Scenario: Changes touch different requirements
- **WHEN** every claimed (domain, requirement) pair belongs to exactly one open change
- **THEN** no overlaps are reported

### Requirement: Rename claims cover both names
A RENAMED delta entry SHALL claim both its FROM name and its TO name, so a rename overlaps with any other change touching either name.

#### Scenario: One change renames onto a name another change modifies
- **WHEN** change A renames a requirement TO a name that change B has a delta operation for, in the same domain
- **THEN** an overlap entry is reported for that name

### Requirement: Archived changes are excluded
Overlap detection SHALL ignore the `archive/` directory under `changes/`; only open changes participate in claims.

#### Scenario: Archived change touches the same requirement
- **WHEN** an archived change and one open change claim the same requirement
- **THEN** no overlap is reported

### Requirement: Same-change repeat claims are not overlaps
Multiple operations within a single change claiming the same requirement SHALL NOT count as an overlap; only distinct changes contend.

#### Scenario: One change claims a requirement twice
- **WHEN** a single change's delta files name the same requirement more than once
- **AND** no other open change claims it
- **THEN** no overlap is reported

### Requirement: Operates without git history
`concord overlap` SHALL work on a plain directory tree. When the working directory is not inside a git repository, it SHALL treat that directory as the root instead of failing.

#### Scenario: Run outside a git repository
- **WHEN** `concord overlap` runs in a directory containing an OpenSpec tree but no git repository
- **THEN** open changes are discovered and overlaps reported normally
