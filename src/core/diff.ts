/** Minimal LCS-based line diff, used to render drift redlines. */

export interface DiffLine {
  type: 'context' | 'add' | 'del';
  text: string;
}

export function diffLines(a: string[], b: string[]): DiffLine[] {
  const m = a.length;
  const n = b.length;
  // dp[i][j] = LCS length of a[i..] and b[j..]
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: 'context', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: 'del', text: a[i++] });
  while (j < n) out.push({ type: 'add', text: b[j++] });
  return out;
}

/**
 * Compress long runs of context so redlines stay readable: keep `window`
 * lines of context around each change, collapse the rest to an ellipsis.
 */
export function compressContext(diff: DiffLine[], window = 2): DiffLine[] {
  const keep = new Array<boolean>(diff.length).fill(false);
  for (let i = 0; i < diff.length; i++) {
    if (diff[i].type === 'context') continue;
    for (let k = Math.max(0, i - window); k <= Math.min(diff.length - 1, i + window); k++) {
      keep[k] = true;
    }
  }
  const out: DiffLine[] = [];
  let elided = false;
  for (let i = 0; i < diff.length; i++) {
    if (keep[i]) {
      out.push(diff[i]);
      elided = false;
    } else if (!elided) {
      out.push({ type: 'context', text: '⋯' });
      elided = true;
    }
  }
  return out;
}
