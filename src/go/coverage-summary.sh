#!/usr/bin/env bash
# Reads coverage.out (go test -coverprofile), writes total and coverage_num to GITHUB_OUTPUT.
set -euo pipefail

COVERAGE_OUTPUT=$(go tool cover -func=coverage.out)
echo "$COVERAGE_OUTPUT"

TOTAL=$(echo "$COVERAGE_OUTPUT" | grep '^total:' | awk '{print $NF}')
echo "total=$TOTAL" >> "$GITHUB_OUTPUT"

COVERAGE_NUM=$(echo "$TOTAL" | sed 's/%//')
echo "coverage_num=$COVERAGE_NUM" >> "$GITHUB_OUTPUT"
