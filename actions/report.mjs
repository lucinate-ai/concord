#!/usr/bin/env node
/**
 * Reporter for the concord composite GitHub Actions.
 *
 * Reads concord `--json` output (the `ci` shape `{ check, overlap }`, or a bare
 * `check` / `overlap` result), then:
 *   - emits GitHub workflow annotation commands to stdout (findings + overlaps),
 *   - appends a Markdown summary to $GITHUB_STEP_SUMMARY, and
 *   - writes `findings`, `overlaps`, `exit-code`, and `result` to $GITHUB_OUTPUT.
 *
 * Pure Node, no dependencies. The script only renders; the shell runner maps
 * concord's exit code to the step result.
 *
 * Usage:
 *   node report.mjs --command <ci|check|overlap> --dir <dir> --exit-code <n>
 *                   [--annotations true|false] [--summary true|false]
 *                   [--input <json-file>]   (defaults to stdin)
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

/** Escape a GitHub workflow-command message (the part after `::`). */
function escapeData(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** Escape a GitHub workflow-command property value (e.g. file, title). */
function escapeProp(value) {
  return escapeData(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
}

function annotation(level, { file, title, message }) {
  const props = [];
  if (file) props.push(`file=${escapeProp(file)}`);
  if (title) props.push(`title=${escapeProp(title)}`);
  const head = props.length ? `${level} ${props.join(',')}` : level;
  process.stdout.write(`::${head}::${escapeData(message)}\n`);
}

/** Escape a value for use inside a Markdown table cell. */
function mdCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function readInput(inputPath) {
  try {
    const raw = inputPath ? readFileSync(inputPath, 'utf8') : readFileSync(0, 'utf8');
    return raw;
  } catch {
    return '';
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args.command ?? 'ci';
  const dir = args.dir ?? 'openspec';
  const exitCode = args['exit-code'] ?? '0';
  const wantAnnotations = args.annotations !== 'false';
  const wantSummary = args.summary !== 'false';

  const raw = readInput(args.input);
  let data = null;
  try {
    data = raw.trim() ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  let check = null;
  let overlap = null;
  if (data) {
    if (command === 'ci') {
      check = data.check ?? null;
      overlap = data.overlap ?? null;
    } else if (command === 'check') {
      check = data;
    } else if (command === 'overlap') {
      overlap = data;
    }
  }

  const findings = check?.findings ?? [];
  const overlaps = overlap?.overlaps ?? [];

  if (wantAnnotations) {
    for (const f of findings) {
      const rel = join(dir, 'changes', f.changeId, 'specs', f.domain, 'spec.md');
      const file = existsSync(rel) ? rel : undefined;
      const op = String(f.operation ?? '').toUpperCase();
      const message = `concord ${f.kind}: ${f.changeId} → ${f.domain} / "${f.requirement}" [${op}]${
        f.detail ? ` — ${f.detail}` : ''
      }`;
      annotation('error', { file, title: `concord ${f.kind}`, message });
    }
    for (const o of overlaps) {
      const who = (o.claims ?? []).map((c) => c.changeId).join(', ');
      annotation('warning', {
        title: 'concord overlap',
        message: `concord overlap: "${o.requirement}" (${o.domain}) claimed by ${who}`,
      });
    }
  }

  if (wantSummary && process.env.GITHUB_STEP_SUMMARY) {
    const lines = [`## concord ${command}`, ''];
    if (!data) {
      lines.push(`⚠️ concord produced no JSON (exit ${exitCode}). See the job log for details.`, '');
    } else {
      if (check) {
        const state = check.upToDate
          ? `level with \`${check.baseRef}\``
          : `${check.behind} commit(s) behind \`${check.baseRef}\``;
        lines.push(
          `Base branch ${state}. Checked ${check.operations} operation(s) across ${check.changes.length} change(s).`,
          ''
        );
      }
      if (findings.length) {
        lines.push(
          `### Findings (${findings.length})`,
          '',
          '| Kind | Change | Domain | Requirement | Operation |',
          '| --- | --- | --- | --- | --- |'
        );
        for (const f of findings) {
          lines.push(
            `| ${f.kind} | ${mdCell(f.changeId)} | ${mdCell(f.domain)} | ${mdCell(
              f.requirement
            )} | ${f.operation} |`
          );
        }
        lines.push('');
      }
      if (overlaps.length) {
        lines.push(
          `### Overlaps (${overlaps.length})`,
          '',
          '| Requirement | Domain | Claimed by |',
          '| --- | --- | --- |'
        );
        for (const o of overlaps) {
          const who = (o.claims ?? []).map((c) => c.changeId).join(', ');
          lines.push(`| ${mdCell(o.requirement)} | ${mdCell(o.domain)} | ${mdCell(who)} |`);
        }
        lines.push('');
      }
      if (!findings.length && !overlaps.length) {
        if (command === 'overlap') {
          lines.push(
            `✅ No overlapping requirements across ${overlap?.changes?.length ?? 0} change(s).`
          );
        } else {
          lines.push(
            `✅ No drift or overlap. Verified ${check?.operations ?? 0} operation(s) across ${
              check?.changes?.length ?? 0
            } change(s) against \`${check?.baseRef ?? ''}\`.`
          );
        }
      }
    }
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  }

  if (process.env.GITHUB_OUTPUT) {
    const delim = 'concord_result_EOF';
    const out =
      `findings=${findings.length}\n` +
      `overlaps=${overlaps.length}\n` +
      `exit-code=${exitCode}\n` +
      `result<<${delim}\n${raw.trim() || '{}'}\n${delim}\n`;
    appendFileSync(process.env.GITHUB_OUTPUT, out);
  }
}

main();
