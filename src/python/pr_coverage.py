"""
Computes line coverage for only the Python files changed in a PR.

Inputs (env vars):
  PR_FILES      — space-separated list of repo-relative .py paths (from GitHub API)
  GITHUB_OUTPUT — path to the GitHub Actions output file

Outputs written to GITHUB_OUTPUT:
  pr_coverage     — integer coverage % (empty string if no files are tracked)
  matched_files   — number of changed files found in coverage.xml with executable lines

Side-effects:
  Writes pr_coverage_breakdown.json to the working directory so that
  update-pr-ci-reports.js can render the per-file breakdown table in the PR body.

  Format:
    {
      "files": [
        {"file": "apps/campaign/models.py", "covered": 45, "total": 100, "pct": 45.0}
      ]
    }

Path-format robustness:
  coverage.py may store filenames in several formats depending on the `source` config:
    • Relative to project root:  "apps/campaign/models.py"   ← ideal
    • Relative to source root:   "campaign/models.py"        ← when source=["apps"]
    • Absolute:                  "/home/runner/.../models.py"
  The GitHub API always returns repo-relative paths: "apps/campaign/models.py".
  We handle all three cases via suffix-based matching after normalisation.
"""

import json
import os
import sys
import xml.etree.ElementTree as ElementTree


def normalize(path: str) -> str:
    """Return a clean POSIX path (no leading ./ or absolute prefix)."""
    if os.path.isabs(path):
        try:
            path = os.path.relpath(path)
        except ValueError:
            pass
    else:
        path = path.removeprefix("./").removeprefix("../")
    return path.replace("\\", "/")


def matches_any(cov_path: str, changed: set[str]) -> bool:
    """Return True if cov_path corresponds to any path in changed.

    Handles the case where coverage stored the path relative to the source
    root (e.g. "campaign/models.py") while changed contains the full repo-
    relative path ("apps/campaign/models.py"), and vice-versa.
    """
    if cov_path in changed:
        return True
    for c in changed:
        if c.endswith("/" + cov_path) or cov_path.endswith("/" + c):
            return True
    return False


def best_display_path(cov_path: str, changed: set[str]) -> str:
    """Return the most readable path — prefer the repo-relative one from the API."""
    for c in changed:
        if c == cov_path or c.endswith("/" + cov_path) or cov_path.endswith("/" + c):
            return c
    return cov_path


raw = os.environ.get("PR_FILES", "").strip()
changed = {f.strip().replace("\\", "/") for f in raw.split() if f.strip().endswith(".py")}
github_output = os.environ.get("GITHUB_OUTPUT", "")
breakdown_path = "pr_coverage_breakdown.json"


def write_output(**kwargs):
    if not github_output:
        return
    with open(github_output, "a") as fh:
        for key, value in kwargs.items():
            fh.write(f"{key}={value}\n")


def write_breakdown(file_stats: list[dict]) -> None:
    """Write per-file coverage data for the JS PR description renderer."""
    with open(breakdown_path, "w") as fh:
        json.dump({"files": file_stats}, fh, indent=2)


if not changed:
    print("No changed Python files detected — skipping PR coverage calculation.")
    write_output(pr_coverage="", matched_files=0)
    sys.exit(0)

if not os.path.exists("coverage.xml"):
    print("coverage.xml not found — skipping PR coverage calculation.")
    write_output(pr_coverage="", matched_files=0)
    sys.exit(0)

print(f"PR changed Python files ({len(changed)}):")
for f in sorted(changed):
    print(f"  {f}")

root = ElementTree.parse("coverage.xml").getroot()

all_cov_files = [normalize(cls.attrib.get("filename", "")) for cls in root.iter("class")]
print(f"\ncoverage.xml tracks {len(all_cov_files)} file(s). Sample (up to 5):")
for f in all_cov_files[:5]:
    print(f"  {f}")

total_lines = 0
covered_lines = 0
matched = 0
file_stats: list[dict] = []

for cls in root.iter("class"):
    filename = normalize(cls.attrib.get("filename", ""))
    if not matches_any(filename, changed):
        continue

    file_total = sum(1 for _ in cls.iter("line"))
    if file_total == 0:
        print(f"  Skipping {filename} — 0 executable lines.")
        continue

    file_covered = sum(
        1 for line in cls.iter("line") if int(line.attrib.get("hits", 0)) > 0
    )

    matched += 1
    total_lines += file_total
    covered_lines += file_covered

    display = best_display_path(filename, changed)
    pct = round(file_covered / file_total * 100, 1)
    file_stats.append({"file": display, "covered": file_covered, "total": file_total, "pct": pct})
    print(f"  {display}: {pct}% ({file_covered}/{file_total} lines)")

if matched == 0:
    print(
        f"\nNone of the {len(changed)} changed Python file(s) appear in coverage.xml "
        "with executable lines.\n"
        "Likely reasons:\n"
        "  • All changed files are test files (omitted by coverage config)\n"
        "  • All changed files are migrations (omitted by coverage config)\n"
        "  • Files are outside the tracked source root (apps/)\n"
        "  • Files have no executable lines\n"
        "Check the filenames printed above to diagnose."
    )
    write_output(pr_coverage="", matched_files=0)
    sys.exit(0)

# Sort by coverage % ascending so lowest-coverage files are most prominent.
file_stats.sort(key=lambda x: (x["pct"], x["file"]))
write_breakdown(file_stats)

pct = round(covered_lines / total_lines * 100)

print(
    f"\nPR coverage: {pct}%  "
    f"({covered_lines}/{total_lines} lines covered,  "
    f"{matched}/{len(changed)} changed files tracked by coverage)"
)
write_output(pr_coverage=pct, matched_files=matched)
