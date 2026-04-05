/**
 * Contract for a language/toolchain-specific CI report section.
 * Add a new file under providers/, implement CiReportProvider, register it in registry.js.
 *
 * @typedef {object} BuildContext
 * @property {import('@actions/core')} core
 * @property {NodeJS.ProcessEnv} env
 */

/**
 * @typedef {object} BuildResult
 * @property {'ok' | 'skip'} status
 * @property {string} [reason] log message when status is skip
 * @property {string} [innerMarkdown] markdown between marker comments when status is ok
 */

/**
 * @typedef {object} CiReportProvider
 * @property {string} id stable id for logs
 * @property {(env: NodeJS.ProcessEnv) => boolean} matches first registered match wins
 * @property {(ctx: BuildContext) => BuildResult} build sync; extend to async if needed
 * @property {(body: string) => string} [prepareBody] run on existing PR body before block replace (e.g. strip legacy markers)
 */

module.exports = {};
