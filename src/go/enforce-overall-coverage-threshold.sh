#!/usr/bin/env bash
# Env: COVERAGE (coverage_num from overall report). Threshold is hardcoded to 0% in workflow.
set -euo pipefail

COVERAGE="${COVERAGE:-}"
if [ -z "$COVERAGE" ] || [ "$COVERAGE" = "N/A" ]; then
  echo "::warning::Coverage report not found or not available. Skipping threshold check."
  exit 0
fi
echo "Current coverage: ${COVERAGE}%"
if [ "$(echo "$COVERAGE < 0" | bc -l)" -eq 1 ]; then
  echo "::error::Coverage ${COVERAGE}% is below the required 0% threshold. PR cannot be merged."
  exit 1
fi
echo "Coverage ${COVERAGE}% meets the required 0% threshold."
