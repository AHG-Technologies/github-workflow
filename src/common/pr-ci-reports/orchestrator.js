/**
 * Single responsibility: wire GitHub API + marker replacement to a CiReportProvider.
 */

const { getMarkerId, makeMarkers, replaceManagedBlock } = require("./markers");
const { resolveProvider } = require("./providers/registry");

/**
 * @param {object} params
 * @param {import('@octokit/rest').Octokit & { rest: any }} params.github
 * @param {import('@actions/github').context} params.context
 * @param {import('@actions/core')} params.core
 */
async function run({ github, context, core }) {
  const env = process.env;
  const provider = resolveProvider(env);
  const result = provider.build({ core, env });

  if (result.status === "skip") {
    core.info(result.reason || "Skipped PR description update.");
    return;
  }

  const markerId = getMarkerId(env);
  const markers = makeMarkers(markerId);
  const prNumber = context.payload.pull_request.number;

  const { data: pr } = await github.rest.pulls.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber,
  });

  let body = pr.body || "";
  if (typeof provider.prepareBody === "function") {
    body = provider.prepareBody(body);
  }

  body = replaceManagedBlock(body, markers, result.innerMarkdown);

  await github.rest.pulls.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber,
    body,
  });

  core.info(`PR description updated (provider: ${provider.id}, marker: ${markerId})`);
}

module.exports = { run };
