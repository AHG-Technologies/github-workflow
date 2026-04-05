# Shared GitHub Actions workflows

Reusable GitHub Actions workflows and helper scripts for multiple repositories.

**Using these workflows:** substitute your GitHub `owner/repo` wherever you see `YOUR_ORG/YOUR_WORKFLOWS_REPO` in `uses:` lines (for example `uses: YOUR_ORG/YOUR_WORKFLOWS_REPO/.github/workflows/python-pre-commit.yml@main`). Your local clone folder name can differ.

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
- Reusable workflows check out this repo at runtime (into `.github-workflow/` on the runner) and run scripts from the `src/` tree — **calling repos never need their own script copies**. For a **public** scripts repo, the default `GITHUB_TOKEN` is enough; a PAT is only needed if that repo is private (see secrets reference).

---

## Available Workflows

### Language-Specific — Python

#### `python-pre-commit.yml` — Pre-commit Checks

Runs `pre-commit --all-files` using `uv`. Optionally clones a **private dependency** over SSH (for example a shared internal library) before `uv sync`.

| Input | Type | Default | Description |
|---|---|---|---|
| `python-version` | string | `3.12` | Python version |
| `uv-version` | string | `0.5.1` | uv version |
| `private-dependency-git-url` | string | _(empty)_ | SSH URL to clone (e.g. `git@github.com:org/repo.git`) — leave empty to skip |
| `private-dependency-ref` | string | `main` | Branch or tag for that dependency |
| `private-dependency-directory` | string | `private-dependency` | Sibling folder name (next to the caller checkout) where the repo is cloned — match your `pyproject` path deps |

**Required secret (via `secrets: inherit`):** `SSH_PRIVATE_KEY` — only needed when `private-dependency-git-url` is set; must have read access to that Git URL’s repository.

```yaml
jobs:
  pre-commit:
    uses: YOUR_ORG/YOUR_WORKFLOWS_REPO/.github/workflows/python-pre-commit.yml@main
    with:
      python-version: '3.12'
      private-dependency-git-url: 'git@github.com:YOUR_ORG/your-private-lib.git'
      private-dependency-directory: 'your-private-lib'
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
| `ci-marker` | string | `pr-ci-reports` | Unique ID for the HTML comment block in the PR body — use one value per repo |
| `pr-coverage-threshold` | number | `90` | PR-file coverage gate % (0 = disabled) |
| `overall-coverage-threshold` | number | `45` | Overall coverage gate % (0 = disabled) |
| `coverage-artifact-name` | string | `coverage-report` | Artifact containing `coverage.xml` |
| `allure-report-artifact` | string | _(empty)_ | Allure HTML artifact — omit to skip Allure summary in PR |
| `python-version` | string | `3.12` | Python version for running `pr_coverage.py` |
| `workflow-scripts-ref` | string | `main` | Branch/tag of **AHG-Technologies/github-workflow** used to clone `src/` (same repo as this workflow) |

Scripts are always checked out from **`AHG-Technologies/github-workflow`** (hardcoded in the workflow YAML). Forks to another org should edit that `repository:` line.

**Required secrets (via `secrets: inherit`):** `GITHUB_TOKEN` (auto). No extra secret when **github-workflow** is public — checkout uses the default token, which can read public repos.

If the scripts repo is **private**, add a PAT with **Contents: Read** on that repo and pass it as checkout `token` in the workflow (or restore `WORKFLOW_REPO_READ_TOKEN` in a fork of this workflow). Do **not** use `SSH_PRIVATE_KEY` for that HTTPS checkout — deploy keys are one repo only.

```yaml
jobs:
  pr-coverage:
    needs: [test, allure-report]    # drop allure-report if not using Allure
    if: github.event_name == 'pull_request'
    uses: AHG-Technologies/github-workflow/.github/workflows/python-pr-coverage.yml@main
    with:
      ci-marker: 'my-service-reports'
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
    uses: YOUR_ORG/YOUR_WORKFLOWS_REPO/.github/workflows/python-allure-report.yml@main
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
| `update-gist-badge` | boolean | `true` | Set `false` to never update the Gist (coverage is still read from the artifact when present) |

**Optional secrets (via `secrets: inherit`):** `GIST_SECRET`, `GIST_ID` — if either is missing, the job still succeeds and only logs a warning; the Gist step is skipped.

```yaml
jobs:
  coverage-badge:
    needs: test
    if: github.event_name == 'push'
    uses: YOUR_ORG/YOUR_WORKFLOWS_REPO/.github/workflows/python-coverage-badge.yml@main
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
    uses: YOUR_ORG/YOUR_WORKFLOWS_REPO/.github/workflows/notify-gchat-on-approval.yml@main
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
    uses: YOUR_ORG/YOUR_WORKFLOWS_REPO/.github/workflows/notify-gchat-on-merge.yml@main
    secrets: inherit
```

---

## Extending the repo

### Adding a new language

1. Create `src/<language>/` — e.g. `src/golang/`
2. Add scripts and a `README.md` inside it
3. Create `.github/workflows/<language>-<tool>.yml` with `on: workflow_call`
4. Reference scripts via `.github-workflow/src/<language>/<script>` (the reusable workflow checks out this repo at `.github-workflow/`)

### Adding a new common script

Drop it in `src/common/` and document it in `src/common/README.md`. Common scripts should have no dependency on a specific language runtime.

### Adding a new universal workflow

Add it to `.github/workflows/` with `on: workflow_call`. Universal workflows contain no language-specific steps — they use `actions/github-script`, shell, or similar portable tools.

---

## Secrets reference

| Secret | Workflows | Description |
|---|---|---|
| `SSH_PRIVATE_KEY` | `python-pre-commit` | Deploy key with read access to the private dependency repo (when `private-dependency-git-url` is set) |
| `WORKFLOW_REPO_READ_TOKEN` | _(optional)_ | Only if you customize `python-pr-coverage` to checkout a **private** scripts repo over HTTPS. Public scripts repo: not used. |
| `GITHUB_TOKEN` | `python-pr-coverage` | Auto-provided; needs `pull-requests: write` on caller |
| `GIST_SECRET` | `python-coverage-badge` | Optional. PAT with `gist` write scope — omit to skip Gist updates |
| `GIST_ID` | `python-coverage-badge` | Optional. ID from the Gist URL — omit to skip Gist updates |
| `GCHAT_APPROVAL_WEBHOOK_URL` | `notify-gchat-on-approval` | Google Chat space webhook |
| `GCHAT_WEBHOOK_URL` | `notify-gchat-on-merge` | Google Chat space webhook |

---

## Troubleshooting: `workflow was not found`

If the caller workflow fails at parse time with **“workflow was not found”** even though the path and `@main` are correct, GitHub is usually blocking access to this repository’s workflows (it does not reveal the real reason).

### 1. Public caller + private workflows repo (very common)

A **public** repository **cannot** call a reusable workflow in a **private** repository. GitHub reports *workflow was not found*.

**Fix one of:**

- Make **`github-workflow` public** (only the workflow definitions and scripts are exposed), or  
- Make the **caller** repository **private**, or  
- Stop using `uses:` and **copy** the workflow YAML into the caller repo (no cross-repo reuse).

### 2. Private + private (same org): allow access from other repos

On the repository that **defines** the reusable workflows:

1. **Settings → Actions → General**
2. Scroll to **Workflow permissions** / **Access** (wording varies by GitHub version).
3. Enable access so workflows in **other repositories in your organization** can use workflows from **this** repository.  
   (Look for an option like **“Accessible from repositories in the organization”** or **allow reuse of workflows in private repositories**.)

Org owners may also need a matching option under **Organization settings → Actions → General**.

### 3. Confirm the caller really references this repo

In the failing run, open the workflow file on the **branch that ran** and check the `uses:` line. It must match your `owner/repo` and path, for example:

`YOUR_ORG/YOUR_WORKFLOWS_REPO/.github/workflows/<file>.yml@main`

### 4. Actions disabled on the workflows repo

**Settings → Actions → General** — Actions must be allowed on the repository that hosts the reusable workflows.

### 5. `python-pr-coverage`: *Repository not found* when checking out scripts

The **Checkout workflow scripts** step clones the repo that contains `src/python/pr_coverage.py` and `src/common/update-pr-ci-reports.js`.

If you see **Repository not found** / **exit code 128** from `git fetch`:

- Confirm **AHG-Technologies/github-workflow** is **public** (or add checkout `token` in a fork if you use a private copy).
- **`SSH_PRIVATE_KEY` is only valid for one GitHub repo** — it is not used for this HTTPS checkout.
- For a **private** scripts repo, add checkout authentication (e.g. a PAT with Contents: Read) in the reusable workflow; the stock workflow assumes a public scripts repo.

---

## Versioning

Pin callers to a release tag for production stability:

```yaml
uses: YOUR_ORG/YOUR_WORKFLOWS_REPO/.github/workflows/python-pr-coverage.yml@v1.0.0
```

Create a GitHub Release when making breaking changes to inputs or script interfaces.
