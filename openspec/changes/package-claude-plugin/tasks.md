## 1. Author the concord agent skill

- [ ] 1.1 Create `skills/concord/SKILL.md` with frontmatter: kebab-case `name: concord`, a
  `description` that names concord, OpenSpec, drift and overlap and states when to use it, and an
  `allowed-tools` scoped to running concord (`Bash` for `concord` / `npx @lucinate-ai/concord`)
  plus read access; leave `when` at default.
- [ ] 1.2 Write the "when to run" section: before archiving a change, after rebasing/merging the
  base branch into a change branch, and when opening/editing a change targeting an existing
  requirement.
- [ ] 1.3 Write the "how to invoke" section: `concord check` and `concord overlap`, the `--json`,
  `--base <ref>`, `--change <id>`, `--dir <path>`, `-C/--cwd <path>` flags, the `--json`
  preference for programmatic reasoning, and the `npx @lucinate-ai/concord` fallback when the
  binary is not on `PATH`.
- [ ] 1.4 Write the "interpret & resolve" section: the exit-code contract (0/1/2) and one entry
  per finding kind — `drift`, `removed-upstream`, `target-missing`, `name-collision`, and
  cross-change `overlap` — each with what it means and how to fix it, sourced from README.md and
  AGENTS.md so guidance can't drift from the tool.
- [ ] 1.5 Use British English in prose to match repo convention.

## 2. Add Claude plugin metadata and directories

- [ ] 2.1 Create `.claude-plugin/plugin.json` with `name: concord` (kebab-case) and
  `description`, `version`, `author` (object with `name`), `homepage`, `repository`, `license`
  (`Apache-2.0`) and `keywords` mirroring `package.json`; no `skills` path override (rely on the
  auto-discovered root `skills/`).
- [ ] 2.2 Create `.claude-plugin/marketplace.json` listing the concord plugin with a relative
  `"./"` source, an `owner` (name), a marketplace `name`, and a listed plugin `name` matching the
  manifest.
- [ ] 2.3 Confirm the root `skills/` tree (from task 1) is the layout the manifest expects and
  that no path in `plugin.json` contradicts it.

## 3. Documentation

- [ ] 3.1 Add an install/usage section to `README.md`: `/plugin marketplace add lucinate-ai/concord`
  then install the plugin, plus a short description of what the skill does — stating it packages
  agent guidance around the existing CLI and changes no commands, `--json` shapes, or exit codes.
- [ ] 3.2 Add a note to `AGENTS.md`'s Release section to bump `plugin.json`'s `version` alongside
  `package.json`, and to update the skill when concord's finding kinds or flags change.

## 4. Validate

- [ ] 4.1 Verify `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` are valid
  JSON with the required fields (e.g. a `node`/`jq` parse check that works without the `claude`
  binary); run `claude plugin validate` on the repo root if the CLI is available.
- [ ] 4.2 Cross-check the skill against the specs: every listed trigger, flag, exit code, and
  finding kind is covered, and the description mentions concord/OpenSpec/drift/overlap.
- [ ] 4.3 Run `pnpm lint` / `pnpm test` to confirm the additive files don't disturb the existing
  build (no code changed, but keep CI green).
