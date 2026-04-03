# src/common

Language-agnostic scripts used by multiple reusable workflows regardless of the
project's programming language.

| File | Used by workflow | Purpose |
|---|---|---|
| `update-pr-ci-reports.js` | `python-pr-coverage.yml` | Reads `coverage.xml` + optional `allure-report/summary.json` and writes a formatted coverage table into the PR description using unique HTML comment delimiters |

## Configuration

`update-pr-ci-reports.js` is driven entirely by environment variables — no
hardcoded values — so it adapts to any repo without modification:

| Env var | Default | Description |
|---|---|---|
| `CI_MARKER` | `ahg-reports` | Unique string for HTML comment delimiters (per-repo, prevents collisions) |
| `OVERALL_THRESHOLD` | `45` | Overall coverage gate (display label only; enforcement is in the shell step) |
| `PR_THRESHOLD` | `90` | PR-file coverage gate (display label only) |
| `COVERAGE` | — | Overall line coverage % from `coverage.xml` |
| `PR_COVERAGE` | — | Coverage % for PR-changed files |
| `PR_MATCHED_FILES` | — | Count of changed files tracked by `coverage.xml` |

## Adding a new common script

Scripts belong here when they are:
- Invoked by workflows that cut across languages (notifications, PR updates, etc.)
- Not tied to a specific runtime or toolchain

Drop the file here and document it in the table above.
