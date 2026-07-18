/**
 * Parser for OpenSpec delta files (`openspec/changes/<id>/specs/<domain>/*.md`).
 *
 * Section and rename patterns mirror OpenSpec v1.6.0's change parser
 * (`dist/core/parsers/change-parser.js`):
 *   - delta sections are level-2 headers matched case-insensitively:
 *     `## ADDED|MODIFIED|REMOVED|RENAMED Requirements`
 *   - renames are `- FROM:` / `- TO:` lines whose payload is a
 *     `### Requirement: <name>` header, backticks optional
 */

import {
  normalizeLineEndings,
  parseRequirementBlocks,
  type RequirementBlock,
} from './spec.js';

export type OperationType = 'added' | 'modified' | 'removed' | 'renamed';

export interface DeltaOperation {
  type: OperationType;
  /** Target requirement name (for renames: the FROM name). */
  name: string;
  /** For renames: the TO name. */
  to?: string;
  /** Raw block text for added/modified/removed entries. */
  raw?: string;
}

const DELTA_SECTION = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i;
const LEVEL2_HEADER = /^##\s+/;
const RENAME_FROM = /^\s*-?\s*FROM:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;
const RENAME_TO = /^\s*-?\s*TO:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/;

interface Section {
  kind: Exclude<OperationType, 'renamed'> | 'renamed';
  lines: string[];
}

function splitSections(content: string): Section[] {
  const lines = normalizeLineEndings(content).split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    const match = line.match(DELTA_SECTION);
    if (match) {
      current = {
        kind: match[1].toLowerCase() as Section['kind'],
        lines: [],
      };
      sections.push(current);
      continue;
    }
    if (LEVEL2_HEADER.test(line)) {
      current = null; // some other level-2 section — not a delta section
      continue;
    }
    if (current) current.lines.push(line);
  }
  return sections;
}

function parseRenames(lines: string[]): Array<{ from: string; to: string }> {
  const renames: Array<{ from: string; to: string }> = [];
  let from: string | undefined;
  for (const line of lines) {
    const fromMatch = line.match(RENAME_FROM);
    const toMatch = line.match(RENAME_TO);
    if (fromMatch) {
      from = fromMatch[1].trim();
    } else if (toMatch && from) {
      renames.push({ from, to: toMatch[1].trim() });
      from = undefined;
    }
  }
  return renames;
}

/** Parse one delta file's contents into its operations. */
export function parseDelta(content: string): DeltaOperation[] {
  const operations: DeltaOperation[] = [];
  for (const section of splitSections(content)) {
    if (section.kind === 'renamed') {
      for (const rename of parseRenames(section.lines)) {
        operations.push({ type: 'renamed', name: rename.from, to: rename.to });
      }
      continue;
    }
    for (const block of parseRequirementBlocks(section.lines)) {
      operations.push({ type: section.kind, name: block.name, raw: block.raw });
    }
  }
  return operations;
}

/** All requirement names a delta claims, keyed for overlap detection. */
export function claimedNames(operations: DeltaOperation[]): string[] {
  const names = new Set<string>();
  for (const op of operations) {
    names.add(op.name);
    if (op.to) names.add(op.to);
  }
  return [...names];
}

export type { RequirementBlock };
