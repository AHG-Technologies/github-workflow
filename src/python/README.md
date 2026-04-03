# src/python

Scripts used by Python-specific reusable workflows.

| File | Used by workflow | Purpose |
|---|---|---|
| `pr_coverage.py` | `python-pr-coverage.yml` | Calculates line coverage % for only the files changed in a PR, using `coverage.xml` as input |

## Adding a new Python script

1. Drop the `.py` file here.
2. Reference it in the appropriate `.github/workflows/python-*.yml` workflow via the `.github-workflow/src/python/<file>` path (the reusable workflow checks out this repo into `.github-workflow/` on the runner).
3. Document it in this table.
