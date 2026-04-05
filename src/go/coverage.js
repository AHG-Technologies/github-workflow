/**
 * Go (go tool cover) coverage: threshold-based table + optional shell-built breakdown.
 */

const LEGACY_MARKER = /<!-- ci-coverage-report -->[\s\S]*?<!-- ci-coverage-report -->/g;

function buildInnerMarkdown(env) {
  const BAR_LEN = 20;
  function progressBar(pct) {
    const filled = Math.round((pct / 100) * BAR_LEN);
    return "█".repeat(filled) + "░".repeat(BAR_LEN - filled);
  }
  function resultEmoji(pct, threshold) {
    if (pct >= threshold) return "🟢";
    if (pct >= threshold * 0.75) return "🟠";
    return "🔴";
  }

  const totalRaw = env.TOTAL_COVERAGE || "N/A";
  const totalNum = parseFloat(env.TOTAL_COVERAGE_NUM);
  const prRaw = env.PR_COVERAGE || "N/A";
  const prNum = parseFloat(env.PR_COVERAGE_NUM);
  const prDetail = env.PR_DETAIL || "";
  const matchedFiles = parseInt(
    env.PR_MATCHED_FILES || env.MATCHED_FILES || "0",
    10,
  );
  const overallThreshold = parseInt(env.OVERALL_THRESHOLD || "0", 10);
  const prThreshold = parseInt(env.PR_THRESHOLD || "0", 10);

  const lines = [
    "### CI reports (auto-updated)",
    "_This section is maintained by GitHub Actions._",
    "",
    "#### Coverage",
    "",
    "| Scope | Result | Progress | Threshold |",
    "|-------|--------|----------|-----------|",
  ];

  if (!isNaN(totalNum)) {
    const emoji = resultEmoji(totalNum, overallThreshold);
    const pass = totalNum >= overallThreshold ? "✅" : "❌";
    lines.push(
      `| Overall | ${emoji} ${totalRaw} | \`${progressBar(totalNum)}\` | ${pass} ≥ ${overallThreshold}% |`,
    );
  } else {
    lines.push(
      `| Overall | ➖ N/A | \`${"─".repeat(BAR_LEN)}\` | No coverage data available |`,
    );
  }

  if (!isNaN(prNum) && matchedFiles > 0) {
    const emoji = resultEmoji(prNum, prThreshold);
    const pass = prNum >= prThreshold ? "✅" : "❌";
    lines.push(
      `| PR files | ${emoji} ${prRaw} | \`${progressBar(prNum)}\` | ${pass} ≥ ${prThreshold}% |`,
    );
  } else {
    lines.push(
      `| PR files | ➖ N/A | \`${"─".repeat(BAR_LEN)}\` | No changed files tracked by coverage |`,
    );
  }

  let md = lines.join("\n");

  if (prDetail.trim()) {
    md += "\n\n<details>\n<summary>📂 Changed file coverage breakdown</summary>\n\n";
    md += "| File | Coverage |\n|------|----------|\n";
    md += prDetail;
    md += "\n</details>\n";
  }

  return md;
}

/**
 * @type {import('../common/pr-ci-reports/providers/types').CiReportProvider}
 */
module.exports = {
  id: "go-coverage",

  matches(env) {
    return env.TOTAL_COVERAGE !== undefined;
  },

  build(ctx) {
    return {
      status: "ok",
      innerMarkdown: buildInnerMarkdown(ctx.env),
    };
  },

  prepareBody(body) {
    return body.replace(LEGACY_MARKER, "").trimEnd();
  },
};
