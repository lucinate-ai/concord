import { createHash } from 'node:crypto';

/**
 * Canonicalise a requirement block before hashing or comparing, so that
 * semantically-null reformatting (CRLF vs LF, trailing whitespace, runs of
 * blank lines) never registers as drift. Internal spacing is deliberately
 * preserved — aligned tables and indented bullets are meaningful in specs.
 */
export function canonicalize(block: string): string {
  const lines = block
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''));

  const out: string[] = [];
  let previousBlank = false;
  for (const line of lines) {
    if (line === '') {
      if (!previousBlank) out.push('');
      previousBlank = true;
    } else {
      out.push(line);
      previousBlank = false;
    }
  }
  while (out.length > 0 && out[0] === '') out.shift();
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** SHA-256 of the canonicalised block, hex-encoded. */
export function blockHash(block: string): string {
  return createHash('sha256').update(canonicalize(block), 'utf8').digest('hex');
}

/** True when two blocks are equivalent after canonicalisation. */
export function blocksEqual(a: string, b: string): boolean {
  return canonicalize(a) === canonicalize(b);
}
