import { describe, expect, it } from 'vitest';

import { claimedNames, parseDelta } from '../src/core/delta.js';

const DELTA = `## ADDED Requirements

### Requirement: Brand new thing
It SHALL be new.

#### Scenario: New
- **WHEN** x
- **THEN** y

## MODIFIED Requirements

### Requirement: Widget frobnication
Widgets SHALL frobnicate twice.

#### Scenario: Double frob
- **WHEN** frobbed
- **THEN** frobnicates twice

## REMOVED Requirements

### Requirement: Legacy mode
**Reason**: Obsolete.
**Migration**: None.

## RENAMED Requirements

- FROM: \`### Requirement: Old name\`
- TO: \`### Requirement: New name\`
FROM: ### Requirement: Bare old
TO: ### Requirement: Bare new
`;

describe('parseDelta', () => {
  it('parses all four delta sections', () => {
    const ops = parseDelta(DELTA);
    expect(ops).toEqual([
      expect.objectContaining({ type: 'added', name: 'Brand new thing' }),
      expect.objectContaining({ type: 'modified', name: 'Widget frobnication' }),
      expect.objectContaining({ type: 'removed', name: 'Legacy mode' }),
      expect.objectContaining({ type: 'renamed', name: 'Old name', to: 'New name' }),
      expect.objectContaining({ type: 'renamed', name: 'Bare old', to: 'Bare new' }),
    ]);
  });

  it('keeps the raw block for added/modified entries', () => {
    const modified = parseDelta(DELTA).find((op) => op.type === 'modified');
    expect(modified?.raw).toContain('frobnicate twice');
  });

  it('matches section headers case-insensitively', () => {
    const ops = parseDelta('## modified requirements\n\n### Requirement: X\nBody.');
    expect(ops).toEqual([expect.objectContaining({ type: 'modified', name: 'X' })]);
  });

  it('ignores non-delta level-2 sections', () => {
    const ops = parseDelta(
      '## Context\n\n### Requirement: Not a delta\nProse.\n\n## MODIFIED Requirements\n\n### Requirement: Real\nBody.'
    );
    expect(ops.map((op) => op.name)).toEqual(['Real']);
  });

  it('returns [] for a plain spec file with no delta sections', () => {
    expect(parseDelta('## Requirements\n\n### Requirement: X\nBody.')).toEqual([]);
  });
});

describe('claimedNames', () => {
  it('includes rename FROM and TO names', () => {
    const names = claimedNames(parseDelta(DELTA));
    expect(names).toContain('Old name');
    expect(names).toContain('New name');
    expect(names).toContain('Widget frobnication');
  });
});
