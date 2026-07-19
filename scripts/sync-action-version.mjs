#!/usr/bin/env node
/**
 * Stamp the `version` input default in each action.yml under actions/ to a
 * concrete version. The release workflow runs this so the `@v1` action refs pin
 * the CLI they ship with, rather than resolving `latest` at run time.
 *
 * The target line is marked with a trailing `# x-release-version` comment.
 *
 * Usage: node scripts/sync-action-version.mjs <version>
 */

import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
  console.error('usage: sync-action-version.mjs <version>');
  process.exit(1);
}

const files = [
  'actions/ci/action.yml',
  'actions/check/action.yml',
  'actions/overlap/action.yml',
];

const marker = /default:\s*'[^']*'\s*# x-release-version/;
let failed = false;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!marker.test(src)) {
    console.error(`no '# x-release-version' marker found in ${file}`);
    failed = true;
    continue;
  }
  const out = src.replace(marker, `default: '${version}' # x-release-version`);
  writeFileSync(file, out);
  console.log(`stamped ${file} -> ${version}`);
}

if (failed) process.exit(1);
