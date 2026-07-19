#!/usr/bin/env node
// Generate grouped release notes from conventional commits since the previous
// tag. Prints Markdown to stdout for `gh release create --notes-file`.
//
// Usage: node scripts/release-notes.mjs [tag]
// The tag defaults to $GITHUB_REF_NAME (the tag that triggered the release).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Conventional-commit types in the order they should appear, mapped to headings.
// Anything unrecognised falls through to "Other Changes"; `chore`/`ci`/`build`/
// `test`/`style` are deliberately omitted from the notes as noise.
const SECTIONS = [
  ['feat', 'Features'],
  ['fix', 'Bug Fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['docs', 'Documentation'],
];
const HIDDEN = new Set(['chore', 'ci', 'build', 'test', 'style']);

const RS = '\x1e'; // record separator
const FS = '\x1f'; // field separator
const SUBJECT_RE = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

// Previous tag reachable from `tag` (skipping the tag itself), or null if this
// is the first tag in the repo.
function previousTag(tag) {
  try {
    // stderr silenced: "No names found" is the expected first-release case.
    return execFileSync('git', ['describe', '--tags', '--abbrev=0', `${tag}^`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function commits(range) {
  const out = git([
    'log',
    ...(range ? [range] : []),
    '--no-merges',
    `--pretty=format:%h${FS}%s${FS}%b${RS}`,
  ]);
  return out
    .split(RS)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [short, subject, body = ''] = r.split(FS);
      const m = SUBJECT_RE.exec(subject.trim());
      return {
        short,
        subject: subject.trim(),
        body,
        type: m?.[1]?.toLowerCase() ?? null,
        scope: m?.[2] ?? null,
        breaking: Boolean(m?.[3]) || /BREAKING[ -]CHANGE/.test(body),
        description: m?.[4] ?? subject.trim(),
      };
    });
}

function line(c) {
  const scope = c.scope ? `**${c.scope}:** ` : '';
  return `- ${scope}${c.description} (${c.short})`;
}

function repoUrl() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY } = process.env;
  if (GITHUB_SERVER_URL && GITHUB_REPOSITORY) {
    return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`;
  }
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
    const url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    return url?.replace(/^git\+/, '').replace(/\.git$/, '') ?? null;
  } catch {
    return null;
  }
}

function npmUrl(tag) {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
    if (!pkg.name || pkg.private) return null;
    return `https://www.npmjs.com/package/${pkg.name}/v/${tag.replace(/^v/, '')}`;
  } catch {
    return null;
  }
}

function render(tag, prev, list) {
  const out = [];

  const breaking = list.filter((c) => c.breaking);
  if (breaking.length) {
    out.push('### ⚠ Breaking Changes', '', ...breaking.map(line), '');
  }

  for (const [type, heading] of SECTIONS) {
    const group = list.filter((c) => c.type === type && !c.breaking);
    if (group.length) out.push(`### ${heading}`, '', ...group.map(line), '');
  }

  const other = list.filter(
    (c) => !c.breaking && !SECTIONS.some(([t]) => t === c.type) && !HIDDEN.has(c.type),
  );
  if (other.length) out.push('### Other Changes', '', ...other.map(line), '');

  if (out.length === 0) out.push('_No notable changes._', '');

  const npm = npmUrl(tag);
  if (npm) out.push(`**npm**: ${npm}`, '');

  const url = repoUrl();
  if (url && prev) {
    out.push(`**Full Changelog**: ${url}/compare/${prev}...${tag}`);
  }

  return out.join('\n').trim() + '\n';
}

function main() {
  const tag = process.argv[2] || process.env.GITHUB_REF_NAME;
  if (!tag) {
    process.stderr.write('usage: release-notes.mjs <tag> (or set GITHUB_REF_NAME)\n');
    process.exit(2);
  }
  const prev = previousTag(tag);
  const range = prev ? `${prev}..${tag}` : tag;
  process.stdout.write(render(tag, prev, commits(range)));
}

main();
