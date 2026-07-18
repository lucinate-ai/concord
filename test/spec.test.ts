import { describe, expect, it } from 'vitest';

import { findRequirement, parseSpec } from '../src/core/spec.js';

const SPEC = `# Widgets Specification

## Purpose

Widgets exist.

## Requirements

Some preamble prose.

### Requirement: Widget frobnication
Widgets SHALL frobnicate.

#### Scenario: Basic frob
- **WHEN** frobbed
- **THEN** frobnicates

### Requirement:   Padded name\t
Padded SHALL still match.

#### Scenario: Pad
- **WHEN** x
- **THEN** y

## Notes

### Requirement: Outside the requirements section
This must not be picked up.
`;

describe('parseSpec', () => {
  it('finds requirement blocks inside the Requirements section only', () => {
    const blocks = parseSpec(SPEC);
    expect(blocks.map((b) => b.name)).toEqual(['Widget frobnication', 'Padded name']);
  });

  it('trims requirement names the way OpenSpec does', () => {
    const blocks = parseSpec(SPEC);
    expect(findRequirement(blocks, 'Padded name')).toBeDefined();
    expect(findRequirement(blocks, '  Padded name ')).toBeDefined();
  });

  it('keeps the raw block including the header line', () => {
    const block = findRequirement(parseSpec(SPEC), 'Widget frobnication');
    expect(block?.raw.startsWith('### Requirement: Widget frobnication')).toBe(true);
    expect(block?.raw).toContain('#### Scenario: Basic frob');
  });

  it('matches the header case-insensitively', () => {
    const spec = '## Requirements\n\n### requirement: lower\nBody.\n';
    expect(parseSpec(spec).map((b) => b.name)).toEqual(['lower']);
  });

  it('returns [] when there is no Requirements section', () => {
    expect(parseSpec('# Just prose\n\nNothing here.')).toEqual([]);
  });
});
