/**
 * Updates the PR description with an auto-managed block containing
 * coverage metrics and (optionally) an Allure report summary.
 *
 * All configuration comes from environment variables so this script works
 * across every repo without modification:
 *
 *   CI_MARKER          — unique identifier for the HTML comment delimiters
 *                        (e.g. "voiceai-reports" or "telephony-middleware-reports")
 *                        Keeps multiple repos' blocks independent in the PR body.
 *   OVERALL_THRESHOLD  — overall coverage gate % (used for display only; enforcement
 *                        is done by the shell step in the workflow)
 *   PR_THRESHOLD       — PR-file coverage gate % (display only)
 *   COVERAGE           — overall line coverage % extracted from coverage.xml
 *   PR_COVERAGE        — coverage % for PR-changed files only
 *   PR_MATCHED_FILES   — number of changed files found in coverage.xml
 */

const fs   = require("fs");
const path = require("path");

// ── Configuration from env ────────────────────────────────────────────────────

const CI_MARKER        = process.env.CI_MARKER        || "ahg-reports";
const OVERALL_THRESHOLD = parseInt(process.env.OVERALL_THRESHOLD || "45",  10);
const PR_THRESHOLD      = parseInt(process.env.PR_THRESHOLD      || "90",  10);

const MARKER_START = `<!-- ci:${CI_MARKER}:start -->`;
const MARKER_END   = `<!-- ci:${CI_MARKER}:end -->`;

// ── Allure helpers ────────────────────────────────────────────────────────────

function formatDuration(ms) {
  const n = Number(ms) || 0;
  if (n < 1000) return `${n}ms`;
  const s = Math.floor(n / 1000);
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s % 60}s`;
}

function walkDir(dir, files) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkDir(p, files);
    else if (name === "summary.json") files.push(p);
  }
}

function countTests(value) {
  if (value == null)             return 0;
  if (Array.isArray(value))     return value.length;
  if (typeof value === "number") return value;
  return 0;
}

function buildAllureTable(summaries) {
  if (!summaries.length) return "";
  const header    = "| | Name | Duration | Stats | New | Flaky | Retry | Report |";
  const delimiter = "|-|-|-|-|-|-|-|-|";
  const rows = summaries.map((summary) => {
    const stats = {
      unknown: 0, passed: 0, failed: 0, broken: 0, skipped: 0,
      ...summary.stats,
    };
    const name     = summary?.name ?? "Allure Report";
    const duration = formatDuration(summary?.duration ?? 0);
    const labels   = [];
    if (stats.passed  > 0) labels.push(`✅ ${stats.passed}`);
    if (stats.failed  > 0) labels.push(`❌ ${stats.failed}`);
    if (stats.broken  > 0) labels.push(`⚠️ ${stats.broken}`);
    if (stats.skipped > 0) labels.push(`⏭️ ${stats.skipped}`);
    if (stats.unknown > 0) labels.push(`❓ ${stats.unknown}`);
    const reportCell = summary?.remoteHref ? `[View](${summary.remoteHref})` : "";
    const cells = [
      "", name, duration,
      labels.join(" ") || "—",
      String(countTests(summary?.newTests)),
      String(countTests(summary?.flakyTests)),
      String(countTests(summary?.retryTests)),
      reportCell,
    ];
    return `| ${cells.join(" | ")} |`;
  });
  return ["### Allure Report Summary", header, delimiter, ...rows].join("\n");
}

// ── Per-file breakdown helpers ────────────────────────────────────────────────

/**
 * Reads pr_coverage_breakdown.json (written by pr_coverage.py) and builds
 * a collapsible <details> section listing every changed file with its
 * individual coverage %, sorted lowest-first so problem files are prominent.
 */
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
    const emoji   = fileEmoji(pct);
    const pctStr  = `${pct.toFixed(1)}%`;
    const lines   = `${covered}/${total}`;
    return `| \`${file}\` | ${emoji} ${pctStr} | ${lines} |`;
  });

  const table = [
    "| File | Coverage | Lines |",
    "|------|----------|-------|",
    ...rows,
  ].join("\n");

  // GitHub markdown supports <details> in PR bodies.
  return [
    "<details>",
    "<summary>📁 Changed file coverage breakdown</summary>",
    "",
    table,
    "",
    "</details>",
  ].join("\n");
}

// ── Coverage helpers ──────────────────────────────────────────────────────────

function coverageBar(pct) {
  const filled = Math.round(pct / 5); // 0–20 blocks
  return `\`${"█".repeat(filled)}${"░".repeat(20 - filled)}\``;
}

function coverageEmoji(pct, threshold) {
  if (pct >= 80) return "🟢";
  if (pct >= 60) return "🟡";
  if (pct >= threshold) return "🟠";
  return "🔴";
}

function buildOverallRow(pct) {
  const num    = parseInt(pct, 10);
  const emoji  = coverageEmoji(num, OVERALL_THRESHOLD);
  const bar    = coverageBar(num);
  const status = num >= OVERALL_THRESHOLD
    ? `✅ ≥ ${OVERALL_THRESHOLD}%`
    : `❌ < ${OVERALL_THRESHOLD}% — blocked`;
  return `| Overall | ${emoji} **${num}%** | ${bar} | ${status} |`;
}

function buildPRRow(pct, matchedFiles) {
  if (pct === "" || pct == null || parseInt(matchedFiles, 10) === 0) {
    return `| PR files | ➖ **N/A** | \`────────────────────\` | _No changed files tracked by coverage_ |`;
  }
  const num    = parseInt(pct, 10);
  const emoji  = coverageEmoji(num, PR_THRESHOLD);
  const bar    = coverageBar(num);
  const status = num >= PR_THRESHOLD
    ? `✅ ≥ ${PR_THRESHOLD}%`
    : `❌ < ${PR_THRESHOLD}% — blocked`;
  return `| PR files | ${emoji} **${num}%** | ${bar} | ${status} |`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run({ github, context, core }) {
  const coverage      = process.env.COVERAGE        || "";
  const prCoverage    = process.env.PR_COVERAGE     || "";
  const prMatchedFiles = process.env.PR_MATCHED_FILES || "0";

  // Collect Allure summaries (gracefully skipped if allure-report/ doesn't exist)
  const summaryPaths = [];
  walkDir("allure-report", summaryPaths);
  const summaries = [];
  for (const p of summaryPaths) {
    try {
      summaries.push(JSON.parse(fs.readFileSync(p, "utf8")));
    } catch (e) {
      core.warning(`Skipping invalid summary file ${p}: ${e.message}`);
    }
  }
  const allureTable = buildAllureTable(summaries);

  if (!coverage && !allureTable) {
    core.info("No coverage metric and no Allure summary — skipping PR description update.");
    return;
  }

  const parts = [
    "### CI reports (auto-updated)",
    "_This section is maintained by GitHub Actions._",
    "",
  ];

  if (coverage) {
    parts.push(
      "#### Coverage",
      `| Scope | Result | Progress | Threshold |`,
      `|-------|--------|----------|-----------|`,
      buildOverallRow(coverage),
      buildPRRow(prCoverage, prMatchedFiles),
      "",
    );

    const breakdown = buildFileBreakdownSection();
    if (breakdown) parts.push(breakdown, "");
  }

  parts.push(
    allureTable ||
    "_No Allure report was generated for this run (missing or empty `summary.json`)._"
  );

  const newBlock = `${MARKER_START}\n${parts.join("\n")}\n${MARKER_END}`;

  const { data: pr } = await github.rest.pulls.get({
    owner: context.repo.owner,
    repo:  context.repo.repo,
    pull_number: context.payload.pull_request.number,
  });
  let body = pr.body || "";

  const escapedStart = MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd   = MARKER_END  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockRegex   = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, "m");

  body = blockRegex.test(body)
    ? body.replace(blockRegex, newBlock)
    : (body.trim() ? `${body.trim()}\n\n${newBlock}` : newBlock);

  await github.rest.pulls.update({
    owner: context.repo.owner,
    repo:  context.repo.repo,
    pull_number: context.payload.pull_request.number,
    body,
  });

  core.info(`PR description updated (marker: ${CI_MARKER})`);
}

module.exports = { run };
