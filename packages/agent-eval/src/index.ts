export * from "./types.js";
export { parseExperimentSettings, DEFAULT_SETTINGS, type ExperimentSettings } from "./config.js";
export { loadTasks, parseTask, TaskFileError } from "./tasks/load-tasks.js";
export {
  isContextPath,
  listSections,
  readContextFiles,
  removeSection,
  type ContextFile,
  type MarkdownSection
} from "./context/context-files.js";
export { GitError, repoRoot } from "./context/git.js";
export { createSandbox, collectChanges, SandboxError } from "./sandbox/sandbox.js";
export { runShell, INTERRUPTED_EXIT_CODE } from "./sandbox/shell.js";
export { ClaudeCodeAdapter, buildClaudeArgs, childEnvironment } from "./agents/claude-code.js";
export { AgentUnavailableError } from "./agents/errors.js";
export { fatalApiError, parseClaudeStream } from "./agents/parse-claude-stream.js";
export { MockAgentAdapter } from "./agents/mock.js";
export { evaluateChecks, pathMatcher, runVerify } from "./verify/checks.js";
export {
  runExperiment,
  planJobs,
  STOP_AFTER_INFRA_ERRORS,
  type ExperimentProgress,
  type RunExperimentInput
} from "./experiment/run-experiment.js";
export { checkTasks, type CheckTasksInput, type TaskCheckResult } from "./experiment/check-tasks.js";
export {
  buildVariants,
  planAblation,
  variantFromToken,
  BASELINE,
  WORKING,
  type AblationPlan
} from "./experiment/variants.js";
export {
  pairedBootstrap,
  pairedRelativeChange,
  wilsonInterval,
  createRandom,
  mean,
  type DifferenceEstimate,
  type Interval,
  type PairedTaskValues
} from "./stats/stats.js";
export {
  summarizeExperiment,
  type Comparison,
  type ExperimentSummary,
  type Verdict,
  type VariantSummary,
  type CheckTally
} from "./stats/summarize.js";
