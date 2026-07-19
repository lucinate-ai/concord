#!/usr/bin/env bash
#
# Shared runner for the concord composite GitHub Actions.
#
# Each actions/<command>/action.yml invokes this with INPUT_COMMAND set. It:
#   - guards against a shallow checkout (ci/check only),
#   - defaults and fetches the base ref on pull_request events (ci/check only),
#   - installs concord pinned by INPUT_VERSION and runs the command with --json,
#   - renders annotations, a job summary, and outputs via report.mjs, and
#   - maps concord's exit code to the step result, honouring fail-on-findings.
#
# Inputs arrive as INPUT_* environment variables set by the action.

set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command="${INPUT_COMMAND:?INPUT_COMMAND is required}"
dir="${INPUT_DIR:-openspec}"
base="${INPUT_BASE:-}"
change="${INPUT_CHANGE:-}"
version="${INPUT_VERSION:-latest}"
workdir="${INPUT_WORKING_DIRECTORY:-.}"
fail_on_findings="${INPUT_FAIL_ON_FINDINGS:-true}"
annotations="${INPUT_ANNOTATIONS:-true}"
summary="${INPUT_SUMMARY:-true}"

cd "${workdir}"

needs_git=false
if [[ "${command}" == "ci" || "${command}" == "check" ]]; then
  needs_git=true
fi

concord_args=("${command}" "--json" "--dir" "${dir}")

if [[ "${needs_git}" == "true" ]]; then
  # A shallow clone silently breaks drift detection — fail loudly instead of
  # reporting a misleading "clean".
  if [[ "$(git rev-parse --is-shallow-repository 2>/dev/null)" == "true" ]]; then
    echo "::error title=concord::Repository was checked out shallowly. concord needs full history — set 'fetch-depth: 0' on actions/checkout."
    exit 1
  fi

  # On a pull request with no explicit base, target the PR base branch and make
  # sure it is present locally.
  if [[ -z "${base}" && "${GITHUB_EVENT_NAME:-}" == "pull_request" && -n "${GITHUB_BASE_REF:-}" ]]; then
    git fetch --no-tags --quiet origin \
      "+refs/heads/${GITHUB_BASE_REF}:refs/remotes/origin/${GITHUB_BASE_REF}" || true
    base="origin/${GITHUB_BASE_REF}"
  fi

  if [[ -n "${base}" ]]; then
    concord_args+=("--base" "${base}")
  fi
  if [[ -n "${change}" ]]; then
    concord_args+=("--change" "${change}")
  fi
fi

json_file="$(mktemp)"
echo "Running: concord ${concord_args[*]} (concord@${version})"
npx --yes "@lucinate-ai/concord@${version}" "${concord_args[@]}" >"${json_file}"
exit_code=$?

had_output=false
if [[ -s "${json_file}" ]]; then
  had_output=true
fi

node "${script_dir}/report.mjs" \
  --command "${command}" \
  --dir "${dir}" \
  --exit-code "${exit_code}" \
  --annotations "${annotations}" \
  --summary "${summary}" \
  --input "${json_file}"

rm -f "${json_file}"

if [[ "${had_output}" != "true" ]]; then
  echo "::error title=concord::concord produced no JSON (exit ${exit_code}). Ensure the repo is a git checkout, that @lucinate-ai/concord@${version} exists, and (for ci/check) that history is complete."
  exit 1
fi

case "${exit_code}" in
  0)
    exit 0
    ;;
  1)
    if [[ "${fail_on_findings}" == "true" ]]; then
      exit 1
    fi
    exit 0
    ;;
  *)
    echo "::error title=concord::concord exited ${exit_code} (usage or environment error)."
    exit 1
    ;;
esac
