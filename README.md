# AHG-Technologies Shared Workflows

Centralized reusable GitHub Actions workflows and scripts for all AHG-Technologies repositories.

---

## Repository structure

```
shared-workflows/
├── src/                          # Scripts fetched by reusable workflows at runtime
│   ├── common/                   # Language-agnostic scripts (work for any project)
│   │   └── update-pr-ci-reports.js
│   ├── python/                   # Python-specific scripts
│   │   └── pr_coverage.py
│   ├── golang/                   # (future)
│   └── nodejs/                   # (future)
└── .github/
    └── workflows/                # Reusable workflow definitions only — no scripts here
        ├── python-pre-commit.yml
        ├── python-pr-coverage.yml
        ├── python-allure-report.yml
        ├── python-coverage-badge.yml
        ├── notify-gchat-on-approval.yml
        └── notify-gchat-on-merge.yml
```

**Design rules:**
- Workflow YAML files live in `.github/workflows/` only.
- All executable scripts live in `src/<scope>/` — never in `.github/`.
- `src/common/` → scripts whose purpose is language-agnostic (PR formatting, notifications).
- `src/<language>/` → scripts tied to a specific runtime or toolchain.
- Reusable workflows check out this repo at runtime (into `.shared-workflows/`) and run scripts from the `src/` tree directly — **calling repos never need their own script copies**.

---

## Available Workflows

### Language-Specific — Python

#### `python-pre-commit.yml` — Pre-commit Checks

Runs `pre-commit --all-files` using `uv`. Optionally clones the private `greylog` dependency.

| Input | Type | Default | Description |
|---|---|---|---|
| `python-version` | string | `3.12` | Python version |
| `uv-version` | string | `0.5.1` | uv version |
| `clone-greylog` | boolean | `true` | Clone greylog before install |
| `greylog-branch` | string | `main` | greylog branch to clone |

**Required secret (via `secrets: inherit`):** `SSH_PRIVATE_KEY`

```yaml
jobs:
  pre-commit:
    uses: AHG-Technologies/shared-workflows/.github/workflows/python-pre-commit.yml@main
    with:
      python-version: '3.12'
    secrets: inherit
```

---

#### `python-pr-coverage.yml` — PR Coverage Report & Enforcement

Downloads `coverage.xml` (and optionally an Allure HTML report) from workflow artifacts,
calculates PR-scoped and overall line coverage, posts a formatted table into the PR
description, and fails the job if thresholds are not met.

Scripts used: `src/python/pr_coverage.py`, `src/common/update-pr-ci-reports.js`

| Input | Type | Default | Description |
|---|---|---|---|
| `ci-marker` | string | `ahg-reports` | Unique ID for the HTML comment block in the PR body — use one value per repo |
| `pr-coverage-threshold` | number | `90` | PR-file coverage gate % (0 = disabled) |
| `overall-coverage-threshold` | number | `45` | Overall coverage gate % (0 = disabled) |
| `coverage-artifact-name` | string | `coverage-report` | Artifact containing `coverage.xml` |
| `allure-report-artifact` | string | _(empty)_ | Allure HTML artifact — omit to skip Allure summary in PR |
| `python-version` | string | `3.12` | Python version for running `pr_coverage.py` |
| `shared-workflows-ref` | string | `main` | Branch/tag of this repo to fetch scripts from |

**Required secrets (via `secrets: inherit`):** `GITHUB_TOKEN` (auto), `SSH_PRIVATE_KEY`

```yaml
jobs:
  pr-coverage:
    needs: [test, allure-report]    # drop allure-report if not using Allure
    if: github.event_name == 'pull_request'
    uses: AHG-Technologies/shared-workflows/.github/workflows/python-pr-coverage.yml@main
    with:
      ci-marker: 'voiceai-reports'
      pr-coverage-threshold: 90
      overall-coverage-threshold: 45
      allure-report-artifact: 'allure-report'
    secrets: inherit
```

---

#### `python-allure-report.yml` — Allure HTML Report Generation

Downloads raw `allure-results/` from a workflow artifact, generates the Allure HTML
report, re-uploads it as a named artifact, and prints a test summary table to the
GitHub Step Summary.

| Input | Type | Default | Description |
|---|---|---|---|
| `allure-results-artifact` | string | `allure-results` | Artifact with raw pytest-allure output |
| `allure-report-artifact` | string | `allure-report` | Name for the generated HTML artifact |
| `allure-version` | string | `3.3.1` | Allure CLI version |
| `node-version` | string | `20` | Node.js version for the CLI |
| `retention-days` | number | `14` | Days to retain the uploaded artifact |

```yaml
jobs:
  allure-report:
    needs: test
    if: always()
    uses: AHG-Technologies/shared-workflows/.github/workflows/python-allure-report.yml@main
    with:
      retention-days: 14
    secrets: inherit
```

---

#### `python-coverage-badge.yml` — Coverage Badge (Gist)

Downloads `coverage.xml`, extracts the overall line-rate, and updates a
[shields.io](https://shields.io/endpoint) endpoint file in a GitHub Gist.
Typically called only on push to `main`/`develop`.

Use a **unique `gist-filename`** per repo so a single Gist can host multiple badges.

| Input | Type | Default | Description |
|---|---|---|---|
| `coverage-artifact-name` | string | `coverage-report` | Artifact containing `coverage.xml` |
| `gist-filename` | string | `coverage.json` | File in the Gist to update — **unique per repo** |
| `label` | string | `coverage` | Badge left-side label text |

**Required secrets (via `secrets: inherit`):** `GIST_SECRET`, `GIST_ID`

```yaml
jobs:
  coverage-badge:
    needs: test
    if: github.event_name == 'push'
    uses: AHG-Technologies/shared-workflows/.github/workflows/python-coverage-badge.yml@main
    with:
      gist-filename: 'my-repo-coverage.json'
    secrets: inherit
```

---

### Universal (all languages)

#### `notify-gchat-on-approval.yml` — Google Chat PR Approval Notification

**Required secret:** `GCHAT_APPROVAL_WEBHOOK_URL`

```yaml
on:
  pull_request_review:
    types: [submitted]
jobs:
  notify:
    if: github.event.review.state == 'approved'
    uses: AHG-Technologies/shared-workflows/.github/workflows/notify-gchat-on-approval.yml@main
    secrets: inherit
```

#### `notify-gchat-on-merge.yml` — Google Chat PR Merge Notification

Supports `workflow_dispatch` for manual testing. Define the test inputs in the calling workflow.

**Required secret:** `GCHAT_WEBHOOK_URL`

```yaml
on:
  pull_request:
    types: [closed]
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      pr_title: { default: "Test PR notification" }
jobs:
  notify:
    if: github.event_name == 'workflow_dispatch' || github.event.pull_request.merged == true
    uses: AHG-Technologies/shared-workflows/.github/workflows/notify-gchat-on-merge.yml@main
    secrets: inherit
```

---

## Extending the repo

### Adding a new language

1. Create `src/<language>/` — e.g. `src/golang/`
2. Add scripts and a `README.md` inside it
3. Create `.github/workflows/<language>-<tool>.yml` with `on: workflow_call`
4. Reference scripts via `.shared-workflows/src/<language>/<script>` (the reusable workflow checks out this repo at `.shared-workflows/`)

### Adding a new common script

Drop it in `src/common/` and document it in `src/common/README.md`. Common scripts should have no dependency on a specific language runtime.

### Adding a new universal workflow

Add it to `.github/workflows/` with `on: workflow_call`. Universal workflows contain no language-specific steps — they use `actions/github-script`, shell, or similar portable tools.

---

## Secrets reference

| Secret | Workflows | Description |
|---|---|---|
| `SSH_PRIVATE_KEY` | `python-pre-commit`, `python-pr-coverage` | Deploy key for private repos (greylog) and for checking out `shared-workflows` itself |
| `GITHUB_TOKEN` | `python-pr-coverage` | Auto-provided; needs `pull-requests: write` on caller |
| `GIST_SECRET` | `python-coverage-badge` | PAT with `gist` write scope |
| `GIST_ID` | `python-coverage-badge` | ID from the Gist URL |
| `GCHAT_APPROVAL_WEBHOOK_URL` | `notify-gchat-on-approval` | Google Chat space webhook |
| `GCHAT_WEBHOOK_URL` | `notify-gchat-on-merge` | Google Chat space webhook |

---

## Versioning

Pin callers to a release tag for production stability:

```yaml
uses: AHG-Technologies/shared-workflows/.github/workflows/python-pr-coverage.yml@v1.0.0
```

Create a GitHub Release when making breaking changes to inputs or script interfaces.
