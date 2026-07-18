import { describe, expect, it } from 'vitest';

import { blockHash, blocksEqual, canonicalize } from '../src/core/canonical.js';

const BLOCK = `### Requirement: Widget frobnication
Widgets SHALL frobnicate on demand.

#### Scenario: Basic frob
- **WHEN** the user frobs
- **THEN** the widget frobnicates`;

describe('canonicalize', () => {
  it('is a fixed point on already-canonical text', () => {
    expect(canonicalize(BLOCK)).toBe(BLOCK);
  });

  it('normalises CRLF line endings', () => {
    expect(canonicalize(BLOCK.replace(/\n/g, '\r\n'))).toBe(BLOCK);
  });

  it('strips trailing whitespace per line', () => {
    const messy = BLOCK.split('\n')
      .map((l) => l + '   ')
      .join('\n');
    expect(canonicalize(messy)).toBe(BLOCK);
  });

  it('collapses runs of blank lines and trims block edges', () => {
    const messy = `\n\n${BLOCK.replace('\n\n', '\n\n\n\n')}\n\n\n`;
    expect(canonicalize(messy)).toBe(BLOCK);
  });

  it('preserves internal spacing (aligned tables stay aligned)', () => {
    const table = '| a      | b |\n| ------ | - |';
    expect(canonicalize(table)).toBe(table);
  });
});

describe('blockHash / blocksEqual', () => {
  it('reformatting does not change the hash', () => {
    expect(blockHash(BLOCK.replace(/\n/g, '\r\n') + '  \n\n')).toBe(blockHash(BLOCK));
  });

  it('content changes do change the hash', () => {
    expect(blockHash(BLOCK.replace('frobnicate', 'defrobnicate'))).not.toBe(
      blockHash(BLOCK)
    );
  });

  it('blocksEqual matches across formatting noise only', () => {
    expect(blocksEqual(BLOCK, BLOCK + '\n')).toBe(true);
    expect(blocksEqual(BLOCK, BLOCK + '\n- **AND** a new clause')).toBe(false);
  });
});
