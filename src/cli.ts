import { readFileSync } from 'node:fs';

import chalk from 'chalk';
import { Command } from 'commander';

import { runCheck } from './commands/check.js';
import { runOverlap } from './commands/overlap.js';
import { runCi } from './commands/ci.js';
import { renderCheck, renderOverlap, renderCi } from './report.js';
import { GitError } from './git.js';
import { ConcordError } from './errors.js';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };

const program = new Command();

program
  .name('concord')
  .description(
    'Concurrent OpenSpec for teams — catch base drift and overlapping changes before they clobber your specs'
  )
  .version(pkg.version);

program
  .command('check')
  .description(
    'verify every open change against the base branch: stale-base drift, missing targets, name collisions'
  )
  .option('-C, --cwd <path>', 'run as if started in <path>', '.')
  .option('--dir <path>', 'OpenSpec directory relative to the repo root', 'openspec')
  .option('--base <ref>', "base ref to compare against (default: origin's default branch)")
  .option('--change <id>', 'check a single change only')
  .option('--json', 'machine-readable output', false)
  .action(async (opts: { cwd: string; dir: string; base?: string; change?: string; json: boolean }) => {
    const result = await runCheck({
      cwd: opts.cwd,
      dir: opts.dir,
      base: opts.base,
      change: opts.change,
    });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const line of renderCheck(result)) console.log(line);
    }
    process.exitCode = result.findings.length > 0 ? 1 : 0;
  });

program
  .command('overlap')
  .description('detect requirements claimed by more than one open change')
  .option('-C, --cwd <path>', 'run as if started in <path>', '.')
  .option('--dir <path>', 'OpenSpec directory relative to the repo root', 'openspec')
  .option('--json', 'machine-readable output', false)
  .action(async (opts: { cwd: string; dir: string; json: boolean }) => {
    const result = await runOverlap({ cwd: opts.cwd, dir: opts.dir });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const line of renderOverlap(result)) console.log(line);
    }
    process.exitCode = result.overlaps.length > 0 ? 1 : 0;
  });

program
  .command('ci')
  .description('run check and overlap together — one gate, one exit code, one JSON document')
  .option('-C, --cwd <path>', 'run as if started in <path>', '.')
  .option('--dir <path>', 'OpenSpec directory relative to the repo root', 'openspec')
  .option('--base <ref>', "base ref for the check analysis (default: origin's default branch)")
  .option('--change <id>', 'restrict the check analysis to a single change')
  .option('--json', 'machine-readable output', false)
  .action(async (opts: { cwd: string; dir: string; base?: string; change?: string; json: boolean }) => {
    const result = await runCi({
      cwd: opts.cwd,
      dir: opts.dir,
      base: opts.base,
      change: opts.change,
    });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      for (const line of renderCi(result)) console.log(line);
    }
    process.exitCode =
      result.check.findings.length > 0 || result.overlap.overlaps.length > 0 ? 1 : 0;
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof GitError || error instanceof ConcordError) {
    console.error(chalk.red(`concord: ${error.message}`));
  } else {
    console.error(chalk.red(`concord: unexpected error`));
    console.error(error);
  }
  process.exitCode = 2;
});
