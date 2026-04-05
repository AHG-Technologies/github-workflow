/**
 * HTML comment delimiters for the managed PR body block.
 * CI_MARKER env overrides; otherwise inferred from coverage toolchain signals.
 */

function isGoEnv(env) {
  return env.TOTAL_COVERAGE !== undefined;
}

/**
 * @param {NodeJS.ProcessEnv} env
 */
function getMarkerId(env) {
  if (env.CI_MARKER) return env.CI_MARKER;
  return isGoEnv(env) ? "go-coverage" : "pr-ci-reports";
}

/**
 * @param {string} markerId
 */
function makeMarkers(markerId) {
  return {
    start: `<!-- ci:${markerId}:start -->`,
    end: `<!-- ci:${markerId}:end -->`,
  };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} body
 * @param {{ start: string, end: string }} markers
 * @param {string} newInner markdown between markers (no marker lines)
 */
function replaceManagedBlock(body, markers, newInner) {
  const newBlock = `${markers.start}\n${newInner}\n${markers.end}`;
  const blockRegex = new RegExp(
    `${escapeRegExp(markers.start)}[\\s\\S]*?${escapeRegExp(markers.end)}`,
    "m",
  );
  if (blockRegex.test(body)) {
    return body.replace(blockRegex, newBlock);
  }
  return body.trim() ? `${body.trim()}\n\n${newBlock}` : newBlock;
}

module.exports = {
  getMarkerId,
  makeMarkers,
  replaceManagedBlock,
};
