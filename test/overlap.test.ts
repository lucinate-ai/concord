import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runOverlap } from '../src/commands/overlap.js';

let dir: string;

function write(rel: string, content: string) {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('runOverlap', () => {
  it('flags a requirement claimed by two open changes, with full multi-word names', async () => {
    dir = mkdtempSync(join(tmpdir(), 'concord-overlap-'));
    write(
      'openspec/changes/change-a/specs/widgets/spec.md',
      '## MODIFIED Requirements\n\n### Requirement: Widget frobnication rules\nA version.\n'
    );
    write(
      'openspec/changes/change-b/specs/widgets/spec.md',
      '## REMOVED Requirements\n\n### Requirement: Widget frobnication rules\n**Reason**: gone.\n'
    );
    write(
      'openspec/changes/change-b/specs/gadgets/spec.md',
      '## ADDED Requirements\n\n### Requirement: Unrelated gadget\nNew.\n'
    );

    const result = await runOverlap({ cwd: dir });
    expect(result.changes).toEqual(['change-a', 'change-b']);
    expect(result.overlaps).toHaveLength(1);
    expect(result.overlaps[0]).toMatchObject({
      domain: 'widgets',
      requirement: 'Widget frobnication rules',
      claims: [
        { changeId: 'change-a', operations: ['modified'] },
        { changeId: 'change-b', operations: ['removed'] },
      ],
    });
  });

  it('treats a rename target as a claim', async () => {
    dir = mkdtempSync(join(tmpdir(), 'concord-overlap-'));
    write(
      'openspec/changes/change-a/specs/widgets/spec.md',
      '## RENAMED Requirements\n- FROM: `### Requirement: Old`\n- TO: `### Requirement: Shiny new`\n'
    );
    write(
      'openspec/changes/change-b/specs/widgets/spec.md',
      '## MODIFIED Requirements\n\n### Requirement: Shiny new\nEdited.\n'
    );

    const result = await runOverlap({ cwd: dir });
    expect(result.overlaps).toHaveLength(1);
    expect(result.overlaps[0].requirement).toBe('Shiny new');
  });

  it('ignores the archive directory and same-change repeat claims', async () => {
    dir = mkdtempSync(join(tmpdir(), 'concord-overlap-'));
    write(
      'openspec/changes/change-a/specs/widgets/spec.md',
      '## MODIFIED Requirements\n\n### Requirement: Solo\nOne.\n'
    );
    write(
      'openspec/changes/archive/old-change/specs/widgets/spec.md',
      '## MODIFIED Requirements\n\n### Requirement: Solo\nArchived copy.\n'
    );

    const result = await runOverlap({ cwd: dir });
    expect(result.changes).toEqual(['change-a']);
    expect(result.overlaps).toHaveLength(0);
  });
});
