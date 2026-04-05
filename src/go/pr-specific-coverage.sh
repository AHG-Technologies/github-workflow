#!/usr/bin/env bash
# Computes per-PR-file and aggregate coverage from go tool cover -func=coverage.out.
# Env: PR_FILES (space-separated repo-relative paths). Requires go.mod at cwd.
set -euo pipefail

PR_FILES="${PR_FILES:-}"
if [ -z "$PR_FILES" ]; then
  echo "pr_total=N/A" >> "$GITHUB_OUTPUT"
  echo "pr_detail=" >> "$GITHUB_OUTPUT"
  exit 0
fi

MODULE=$(head -1 go.mod | awk '{print $2}')
FUNC_OUTPUT=$(go tool cover -func=coverage.out)
MATCHED_LINES=""

for f in $PR_FILES; do
  FULL_PATH="${MODULE}/${f}"
  LINE=$(echo "$FUNC_OUTPUT" | grep "^${FULL_PATH}:" || true)
  if [ -n "$LINE" ]; then
    MATCHED_LINES="$MATCHED_LINES$LINE
"
  fi
done

if [ -z "$MATCHED_LINES" ]; then
  echo "pr_total=N/A" >> "$GITHUB_OUTPUT"
  echo "pr_detail=" >> "$GITHUB_OUTPUT"
else
  PR_FILE_SUMMARY=""
  MATCHED_COUNT=0
  for f in $PR_FILES; do
    FULL_PATH="${MODULE}/${f}"
    FILE_LINES=$(echo "$FUNC_OUTPUT" | grep "^${FULL_PATH}:" || true)
    if [ -n "$FILE_LINES" ]; then
      FILE_COV=$(echo "$FILE_LINES" | awk '{gsub(/%/,"",$NF); sum+=$NF; n++} END {if(n>0) printf "%.1f%%", sum/n; else print "N/A"}')
      PR_FILE_SUMMARY="$PR_FILE_SUMMARY| \`$f\` | $FILE_COV |
"
      MATCHED_COUNT=$((MATCHED_COUNT + 1))
    fi
  done

  echo "matched_files=$MATCHED_COUNT" >> "$GITHUB_OUTPUT"

  OVERALL=$(echo "$MATCHED_LINES" | awk '{gsub(/%/,"",$NF); sum+=$NF; n++} END {if(n>0) printf "%.1f%%", sum/n; else print "N/A"}')
  echo "pr_total=$OVERALL" >> "$GITHUB_OUTPUT"

  OVERALL_NUM=$(echo "$OVERALL" | sed 's/%//')
  echo "pr_total_num=$OVERALL_NUM" >> "$GITHUB_OUTPUT"

  {
    echo 'pr_detail<<EOF'
    echo "$PR_FILE_SUMMARY"
    echo 'EOF'
  } >> "$GITHUB_OUTPUT"
fi
