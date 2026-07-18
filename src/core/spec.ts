/**
 * Parser for OpenSpec spec files (`openspec/specs/<domain>/spec.md`).
 *
 * The header patterns deliberately mirror OpenSpec v1.6.0's own parser
 * (`dist/core/parsers/requirement-blocks.js`) so that concord recognises
 * exactly the blocks OpenSpec would archive:
 *   - requirement headers: /^###\s*Requirement:\s*(.+)\s*$/i
 *   - names are normalised by trimming only
 *   - the Requirements section runs from /^##\s+Requirements\s*$/i to the
 *     next level-2 header
 */

export interface RequirementBlock {
  /** Trimmed requirement name, as OpenSpec matches it at archive time. */
  name: string;
  /** Raw block text including the `### Requirement:` header line. */
  raw: string;
}

const REQUIREMENT_HEADER = /^###\s*Requirement:\s*(.+)\s*$/i;
const REQUIREMENTS_SECTION = /^##\s+Requirements\s*$/i;
const LEVEL2_HEADER = /^##\s+/;

export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

export function normalizeRequirementName(name: string): string {
  return name.trim();
}

/**
 * Parse requirement blocks out of a run of lines (no section narrowing).
 * A block runs from its header to the next requirement header or level-2
 * header.
 */
export function parseRequirementBlocks(lines: string[]): RequirementBlock[] {
  const blocks: RequirementBlock[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    const header = lines[cursor].match(REQUIREMENT_HEADER);
    if (!header) {
      cursor++;
      continue;
    }
    const bodyLines = [lines[cursor]];
    cursor++;
    while (
      cursor < lines.length &&
      !REQUIREMENT_HEADER.test(lines[cursor]) &&
      !LEVEL2_HEADER.test(lines[cursor])
    ) {
      bodyLines.push(lines[cursor]);
      cursor++;
    }
    blocks.push({
      name: normalizeRequirementName(header[1]),
      raw: bodyLines.join('\n').trimEnd(),
    });
  }
  return blocks;
}

/**
 * Parse a full spec file, returning the requirement blocks inside its
 * `## Requirements` section. Returns [] when the section is absent.
 */
export function parseSpec(content: string): RequirementBlock[] {
  const lines = normalizeLineEndings(content).split('\n');
  const start = lines.findIndex((l) => REQUIREMENTS_SECTION.test(l));
  if (start === -1) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (LEVEL2_HEADER.test(lines[i])) {
      end = i;
      break;
    }
  }
  return parseRequirementBlocks(lines.slice(start + 1, end));
}

/** Find a requirement by its OpenSpec-normalised (trimmed) name. */
export function findRequirement(
  blocks: RequirementBlock[],
  name: string
): RequirementBlock | undefined {
  const wanted = normalizeRequirementName(name);
  return blocks.find((b) => b.name === wanted);
}
