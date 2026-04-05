/**
 * Provider registration (Open/Closed: add providers here, do not change orchestrator).
 */

const goCoverage = require("../../../go/coverage");
const pythonCoverage = require("../../../python/coverage");

/** @type {import('./types').CiReportProvider[]} */
const providers = [goCoverage, pythonCoverage];

/**
 * First matching provider wins. Keep specific toolchains before the Python fallback.
 * @param {NodeJS.ProcessEnv} env
 * @returns {import('./types').CiReportProvider}
 */
function resolveProvider(env) {
  for (const p of providers) {
    if (p.matches(env)) return p;
  }
  throw new Error("ci-report: no provider matched (registry misconfigured)");
}

module.exports = {
  resolveProvider,
  /** Exposed for tests */
  providers,
};
