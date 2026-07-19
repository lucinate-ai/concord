## ADDED Requirements

### Requirement: Repo provides a valid plugin manifest

The concord repository SHALL contain a Claude Code plugin manifest at
`.claude-plugin/plugin.json`. The manifest SHALL declare a kebab-case `name` and SHOULD declare
`description`, `version`, `author`, `homepage`, `repository`, `license`, and `keywords` drawn
from `package.json` so the plugin presents consistent metadata. The manifest MUST validate
against Claude Code's plugin schema (for example, `claude plugin validate` on the plugin root
succeeds).

#### Scenario: Manifest is validated

- **WHEN** `claude plugin validate` is run against the concord repo root
- **THEN** it reports the plugin as valid, finding the manifest at `.claude-plugin/plugin.json`
  with a kebab-case `name`

### Requirement: Plugin ships the concord agent skill

The plugin SHALL expose the concord agent skill through the plugin's skill layout so that
installing the plugin makes the skill available to the agent. The skill SHALL live at
`skills/<skill-name>/SKILL.md` at the repo root (the location Claude Code auto-discovers), and
its frontmatter `name` SHALL be set so the invocation name is stable when the plugin is
installed from a marketplace.

#### Scenario: Plugin is installed and the skill is present

- **WHEN** the concord plugin is installed into another project
- **THEN** the concord agent skill is discoverable there, with a stable invocation name taken
  from the skill's `name` frontmatter rather than an install-directory version string

### Requirement: Repo is a self-hosting plugin marketplace

The concord repository SHALL contain a marketplace catalogue at
`.claude-plugin/marketplace.json` that lists the concord plugin with a source pointing at the
repository itself (a relative `"./"` source), so a user can add the repo as a marketplace and
install the plugin from it without a separate registry repository. The marketplace `name` and
`owner` SHALL be set, and the listed plugin `name` SHALL match the plugin manifest's `name`.

#### Scenario: User installs from the repo

- **WHEN** a user runs `/plugin marketplace add lucinate-ai/concord` and then installs the
  listed plugin
- **THEN** the concord plugin (and its agent skill) is installed from the same repository, with
  no separate marketplace repo required

### Requirement: Installation and usage are documented

The repository documentation SHALL describe how to install the concord plugin (adding the
marketplace and installing the plugin) and what the agent skill does once installed. The
documentation SHALL make clear that the plugin packages agent guidance around the existing
concord CLI and does not change concord's commands, `--json` shapes, or exit codes.

#### Scenario: A reader wants to install the plugin

- **WHEN** a reader consults `README.md`
- **THEN** they find the marketplace-add and plugin-install commands and a short description of
  the skill's behaviour
