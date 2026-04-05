#!/usr/bin/env bash
# Env: PR_COVERAGE (from pr_total_num), MATCHED_FILES. Threshold is hardcoded to 0% in workflow.
set -euo pipefail

PR_COVERAGE="${PR_COVERAGE:-}"
MATCHED_FILES="${MATCHED_FILES:-0}"

if [ -z "$PR_COVERAGE" ] || [ "$PR_COVERAGE" = "N/A" ] || [ "${MATCHED_FILES:-0}" -eq 0 ]; then
  echo "No PR files tracked by coverage — skipping PR coverage threshold check."
  exit 0
fi
echo "PR-specific coverage: ${PR_COVERAGE}%"
if [ "$(echo "$PR_COVERAGE < 0" | bc -l)" -eq 1 ]; then
  echo "::error::PR coverage ${PR_COVERAGE}% is below the required 0% threshold for changed files. PR cannot be merged."
  exit 1
fi
echo "PR coverage ${PR_COVERAGE}% meets the required 0% threshold."
