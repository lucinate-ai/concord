#!/usr/bin/env node
// Bump concord's version in every place it must be kept in sync, in one
// command, so no location is ever forgotten. AGENTS.md requires package.json,
// the Claude Code plugin manifest, and the agent-skill metadata to move
// together — TARGETS below is the single source of truth for that list.
//
// Usage: node scripts/bump-version.mjs <version>   (or: pnpm bump <version>)
//   <version>  new semver, without a leading "v" (e.g. 1.2.3 or 1.2.3-rc.1)
//
// It only edits files — it does not commit, tag, or push. Pushing a vX.Y.Z tag
// triggers the release + npm publish, which stays a deliberate manual step.

import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);

// Every file that carries concord's version. Add new locations here and the one
// command keeps covering all of them. `pattern` captures (prefix)(value)(suffix)
// so the value can be swapped without disturbing surrounding formatting.
const TARGETS = [
  { file: 'package.json', json: true, pattern: /("version":\s*")([^"]+)(")/ },
  { file: '.claude-plugin/plugin.json', json: true, pattern: /("version":\s*")([^"]+)(")/ },
  { file: 'skills/concord/SKILL.md', pattern: /^([ \t]*version:[ \t]*")([^"]+)(")/m },
];

function fail(msg) {
  console.error(`bump-version: ${msg}`);
  process.exit(1);
}

const version = process.argv[2];
if (!version) fail('usage: bump-version.mjs <version>   (e.g. 1.2.3)');
if (version.startsWith('v')) fail(`pass the version without a leading "v" (got "${version}")`);
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`"${version}" is not valid semver (expected X.Y.Z or X.Y.Z-pre)`);
}

let bumped = 0;
for (const { file, json, pattern } of TARGETS) {
  const path = new URL(file, root);
  let src;
  try {
    src = readFileSync(path, 'utf8');
  } catch {
    fail(`cannot read ${file} — has this version location moved?`);
  }
  const match = src.match(pattern);
  if (!match) fail(`no version field found in ${file} — update TARGETS in this script`);

  const current = match[2];
  if (current === version) {
    console.log(`  ${file.padEnd(32)} already ${version}`);
    continue;
  }

  const out = src.replace(pattern, `$1${version}$3`);
  if (json) JSON.parse(out); // guard against producing invalid JSON
  writeFileSync(path, out);
  console.log(`  ${file.padEnd(32)} ${current} -> ${version}`);
  bumped++;
}

// Every location must now report the same version — catch a partial rewrite.
const after = TARGETS.map(
  ({ file, pattern }) => readFileSync(new URL(file, root), 'utf8').match(pattern)?.[2],
);
if (new Set(after).size !== 1) {
  fail(`versions out of sync after bump: ${after.join(', ')}`);
}

console.log(
  bumped === 0
    ? `\nAll ${TARGETS.length} version locations already at ${version}.`
    : `\nBumped ${bumped} of ${TARGETS.length} version location(s) to ${version}.`,
);
console.log('Next (per AGENTS.md):');
console.log(`  git commit -am "chore: release v${version}"`);
console.log(`  git tag -a v${version} -m "v${version}"`);
console.log(`  git push origin main && git push origin v${version}   # triggers release + npm publish`);
