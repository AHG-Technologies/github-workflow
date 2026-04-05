/**
 * Python + coverage.py + optional Allure: builds the managed markdown block.
 */

const fs = require("fs");
const { buildAllureTable, loadAllureSummaries } = require(
  "../common/pr-ci-reports/providers/allure-report",
);

function buildFileBreakdownSection() {
  const breakdownFile = "pr_coverage_breakdown.json";
  if (!fs.existsSync(breakdownFile)) return "";

  let data;
  try {
    data = JSON.parse(fs.readFileSync(breakdownFile, "utf8"));
  } catch {
    return "";
  }

  const files = data?.files;
  if (!Array.isArray(files) || files.length === 0) return "";

  function fileEmoji(pct) {
    if (pct >= 80) return "🟢";
    if (pct >= 60) return "🟡";
    if (pct >= 40) return "🟠";
    return "🔴";
  }

  const rows = files.map(({ file, covered, total, pct }) => {
    const emoji = fileEmoji(pct);
    const pctStr = `${pct.toFixed(1)}%`;
    const lines = `${covered}/${total}`;
    return `| \`${file}\` | ${emoji} ${pctStr} | ${lines} |`;
  });

  const table = [
    "| File | Coverage | Lines |",
    "|------|----------|-------|",
    ...rows,
  ].join("\n");

  return [
    "<details>",
    "<summary>📁 Changed file coverage breakdown</summary>",
    "",
    table,
    "",
    "</details>",
  ].join("\n");
}

function coverageBar(pct) {
  const filled = Math.round(pct / 5);
  return `\`${"█".repeat(filled)}${"░".repeat(20 - filled)}\``;
}

function coverageEmoji(pct, threshold) {
  if (pct >= 80) return "🟢";
  if (pct >= 60) return "🟡";
  if (pct >= threshold) return "🟠";
  return "🔴";
}

function buildOverallRow(pct, overallThreshold) {
  const num = parseInt(pct, 10);
  const emoji = coverageEmoji(num, overallThreshold);
  const bar = coverageBar(num);
  const status = num >= overallThreshold
    ? `✅ ≥ ${overallThreshold}%`
    : `❌ < ${overallThreshold}% — blocked`;
  return `| Overall | ${emoji} **${num}%** | ${bar} | ${status} |`;
}

function buildPRRow(pct, matchedFiles, prThreshold) {
  if (pct === "" || pct == null || parseInt(matchedFiles, 10) === 0) {
    return "| PR files | ➖ **N/A** | `────────────────────` | _No changed files tracked by coverage_ |";
  }
  const num = parseInt(pct, 10);
  const emoji = coverageEmoji(num, prThreshold);
  const bar = coverageBar(num);
  const status = num >= prThreshold
    ? `✅ ≥ ${prThreshold}%`
    : `❌ < ${prThreshold}% — blocked`;
  return `| PR files | ${emoji} **${num}%** | ${bar} | ${status} |`;
}

/**
 * Fallback provider: Python/coverage.py workflows (and anything without Go env).
 * @type {import('../common/pr-ci-reports/providers/types').CiReportProvider}
 */
module.exports = {
  id: "python-coverage",

  matches() {
    return true;
  },

  /**
   * @param {import('../common/pr-ci-reports/providers/types').BuildContext} ctx
   * @returns {import('../common/pr-ci-reports/providers/types').BuildResult}
   */
  build(ctx) {
    const { core, env } = ctx;
    const overallThreshold = parseInt(env.OVERALL_THRESHOLD || "45", 10);
    const prThreshold = parseInt(env.PR_THRESHOLD || "90", 10);

    const coverage = env.COVERAGE || "";
    const prCoverage = env.PR_COVERAGE || "";
    const prMatchedFiles = env.PR_MATCHED_FILES || "0";

    const summaries = loadAllureSummaries(core);
    const allureTable = buildAllureTable(summaries);

    if (!coverage && !allureTable) {
      return {
        status: "skip",
        reason: "No coverage metric and no Allure summary — skipping PR description update.",
      };
    }

    const parts = [
      "### CI reports (auto-updated)",
      "_This section is maintained by GitHub Actions._",
      "",
    ];

    if (coverage) {
      parts.push(
        "#### Coverage",
        "| Scope | Result | Progress | Threshold |",
        "|-------|--------|----------|-----------|",
        buildOverallRow(coverage, overallThreshold),
        buildPRRow(prCoverage, prMatchedFiles, prThreshold),
        "",
      );

      const breakdown = buildFileBreakdownSection();
      if (breakdown) parts.push(breakdown, "");
    }

    parts.push(
      allureTable ||
      "_No Allure report was generated for this run (missing or empty `summary.json`)._",
    );

    return {
      status: "ok",
      innerMarkdown: parts.join("\n"),
    };
  },
};
