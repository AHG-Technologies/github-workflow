/**
 * Allure summary.json discovery and markdown table (Python test workflows).
 */

const fs = require("fs");
const path = require("path");

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
  if (value == null) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number") return value;
  return 0;
}

/**
 * @returns {string} markdown or empty string
 */
function buildAllureTable(summaries) {
  if (!summaries.length) return "";
  const header = "| | Name | Duration | Stats | New | Flaky | Retry | Report |";
  const delimiter = "|-|-|-|-|-|-|-|-|";
  const rows = summaries.map((summary) => {
    const stats = {
      unknown: 0, passed: 0, failed: 0, broken: 0, skipped: 0,
      ...summary.stats,
    };
    const name = summary?.name ?? "Allure Report";
    const duration = formatDuration(summary?.duration ?? 0);
    const labels = [];
    if (stats.passed > 0) labels.push(`✅ ${stats.passed}`);
    if (stats.failed > 0) labels.push(`❌ ${stats.failed}`);
    if (stats.broken > 0) labels.push(`⚠️ ${stats.broken}`);
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

/**
 * Loads all summary.json files under allure-report/.
 * @param {{ warning: (msg: string) => void }} core
 * @returns {object[]}
 */
function loadAllureSummaries(core) {
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
  return summaries;
}

module.exports = {
  buildAllureTable,
  loadAllureSummaries,
};
