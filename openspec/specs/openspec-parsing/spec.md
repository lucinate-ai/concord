# OpenSpec Parsing Specification

## Purpose

Parse spec files, delta files, and change directories exactly the way OpenSpec v1.6.0 does, so concord recognises precisely the blocks OpenSpec would archive — no more, no less. Any divergence here would produce false findings or miss real ones.

## Requirements

### Requirement: Spec file parsing mirrors OpenSpec
Spec files SHALL be parsed by extracting requirement blocks from the `Requirements` section only: the section starts at a level-2 `Requirements` header (matched case-insensitively) and ends at the next level-2 header or end of file. Within it, each block starts at a `### Requirement: <name>` header (matched case-insensitively) and runs to the next requirement header or level-2 header. Names SHALL be normalised by trimming only, line endings SHALL be normalised to LF before parsing, and each block's raw text SHALL be preserved including its header line.

#### Scenario: Requirement outside the Requirements section
- **WHEN** a spec file contains a requirement-style header in some other level-2 section
- **THEN** it is not parsed as a requirement

#### Scenario: No Requirements section
- **WHEN** a spec file has no level-2 `Requirements` header
- **THEN** parsing yields no requirement blocks

#### Scenario: Header case variation
- **WHEN** the section or requirement headers differ from the canonical form only in letter case
- **THEN** they are still recognised

### Requirement: Delta section parsing
Delta files SHALL be parsed into operations from level-2 sections whose headers are `ADDED Requirements`, `MODIFIED Requirements`, `REMOVED Requirements`, or `RENAMED Requirements` (matched case-insensitively). Requirement blocks inside ADDED, MODIFIED, and REMOVED sections become operations of that type with their raw block preserved. Any other level-2 header ends the current delta section, and content outside delta sections SHALL be ignored.

#### Scenario: All four section types present
- **WHEN** a delta file contains all four delta section types
- **THEN** each requirement block or rename pair yields one operation of the matching type

#### Scenario: Non-delta section interleaved
- **WHEN** a delta file contains an unrelated level-2 section (for example implementation notes) with requirement-style headers inside it
- **THEN** that content yields no operations

#### Scenario: Plain spec file passed as a delta
- **WHEN** a file with only a `Requirements` section is parsed as a delta
- **THEN** it yields no operations, so the file is treated as having no delta content

### Requirement: Rename entry parsing
Within a `RENAMED Requirements` section, renames SHALL be parsed from paired `FROM:` and `TO:` lines whose payload is a `### Requirement: <name>` header. A leading list dash and surrounding backticks are optional, and names are trimmed. A TO line SHALL only pair with the most recent unconsumed FROM line; unpaired FROM or TO lines are dropped.

#### Scenario: Rename with backticked headers
- **WHEN** a renamed section contains a FROM line and a TO line whose requirement headers are wrapped in backticks
- **THEN** one renamed operation is produced with the FROM name as target and the TO name recorded

#### Scenario: Unpaired TO line
- **WHEN** a TO line appears with no preceding FROM line
- **THEN** no renamed operation is produced for it

### Requirement: Change discovery
Open changes SHALL be discovered by enumerating the directories under the OpenSpec `changes/` directory, skipping `archive/` and directories whose names start with a dot. For each change, markdown files under its `specs/` subdirectory SHALL be walked recursively in sorted order and parsed as deltas; files yielding zero operations are filtered out. Each delta SHALL record the change id (the directory name) and its domain — the file's parent path relative to the change's `specs/` directory, POSIX-separated. A missing `changes/` directory yields an empty result. Deltas are read from the working tree, so uncommitted edits are included.

#### Scenario: Standard change layout
- **WHEN** `changes/add-auth/specs/user-auth/spec.md` contains delta operations
- **THEN** a delta is discovered with change id `add-auth` and domain `user-auth`

#### Scenario: Change without delta content
- **WHEN** a change directory has no `specs/` subdirectory, or its markdown files contain no delta sections
- **THEN** the change contributes no deltas

#### Scenario: Filter to a single change
- **WHEN** discovery is restricted to one change id
- **THEN** only deltas from that change directory are returned
