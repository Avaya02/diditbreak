import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import pLimit from "p-limit";

import { readContextFiles, type ContextFile } from "../context/context-files.js";
import { collectChanges, createSandbox, pruneWorktrees, safeSegment } from "../sandbox/sandbox.js";
import type {
  AgentAdapter,
  AgentConfig,
  AgentRunResult,
  AgentTask,
  ExperimentResult,
  ExperimentStatus,
  FailureReason,
  TrialResult,
  Variant
} from "../types.js";
import { evaluateChecks, runVerify } from "../verify/checks.js";

export interface ExperimentProgress {
  done: number;
  total: number;
  last: TrialResult;
}

export interface RunExperimentInput {
  repoRoot: string;
  /** Where transcripts, diffs and results.json are written. */
  runDir: string;
  runId: string;
  tasks: AgentTask[];
  variants: Variant[];
  agent: AgentAdapter;
  config: AgentConfig;
  trials: number;
  concurrency: number;
  setup: string[];
  onProgress?: (progress: ExperimentProgress) => void;
  /** Interrupts the experiment: running agents are stopped, finished runs kept. */
  signal?: AbortSignal | undefined;
}

/**
 * When this many runs have finished and none of them could run, the problem is
 * the environment (no login, bad key, broken setup), not the context: stop
 * rather than spend the rest of the plan reproducing it.
 */
export const STOP_AFTER_INFRA_ERRORS = 3;

function emptyAgentResult(error: string): AgentRunResult {
  return {
    completed: false,
    error,
    infraError: true,
    finalMessage: "",
    turns: 0,
    durationMs: 0,
    costUsd: null,
    inputTokens: 0,
    outputTokens: 0,
    contextTokens: null,
    toolCalls: [],
    skillsUsed: [],
    commands: [],
    permissionDenials: 0,
    environment: { skillsLoaded: [], mcpServers: [], agents: [] }
  };
}

interface Job {
  task: AgentTask;
  variant: Variant;
  trial: number;
}

/**
 * Jobs ordered trial-major, so an interrupted experiment still holds a
 * balanced sample: every setup has run every task once before any runs twice.
 */
export function planJobs(tasks: AgentTask[], variants: Variant[], trials: number): Job[] {
  const jobs: Job[] = [];
  for (let trial = 1; trial <= trials; trial += 1) {
    for (const task of tasks) {
      for (const variant of variants) {
        jobs.push({ task, variant, trial });
      }
    }
  }
  return jobs;
}

/** Writes JSON so a reader never sees a half-written file, even after a crash. */
async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

/**
 * Runs one trial. Returns null when the experiment was stopped while the trial
 * was in flight: a half-finished run measures nothing, so it is discarded.
 */
async function runTrial(
  input: RunExperimentInput,
  job: Job,
  contextFiles: ContextFile[],
  signal: AbortSignal
): Promise<TrialResult | null> {
  const trialDir = join(safeSegment(job.variant.name), safeSegment(job.task.id), String(job.trial));
  const absoluteTrialDir = join(input.runDir, trialDir);
  await mkdir(absoluteTrialDir, { recursive: true });

  const base = {
    variant: job.variant.name,
    taskId: job.task.id,
    trial: job.trial,
    diffPath: join(trialDir, "changes.patch"),
    transcriptPath: join(trialDir, "transcript.jsonl")
  };

  let sandbox;
  try {
    sandbox = await createSandbox({
      repoRoot: input.repoRoot,
      runId: input.runId,
      task: job.task,
      variant: job.variant,
      trial: job.trial,
      contextFiles,
      setup: input.setup,
      setupTimeoutMs: job.task.timeoutSec * 1000,
      signal
    });
  } catch (error) {
    if (signal.aborted) {
      return null;
    }
    // The sandbox or the project's setup failed: the agent never started.
    return {
      ...base,
      passed: false,
      failure: "infra-error",
      verify: [],
      checks: [],
      agent: emptyAgentResult(`sandbox: ${(error as Error).message}`),
      changedFiles: []
    };
  }

  try {
    const config: AgentConfig =
      job.variant.model !== undefined ? { ...input.config, model: job.variant.model } : input.config;

    const agent = await input.agent.run({
      cwd: sandbox.dir,
      prompt: job.task.prompt,
      config,
      timeoutMs: job.task.timeoutSec * 1000,
      transcriptPath: join(input.runDir, base.transcriptPath),
      trial: job.trial,
      context: { paths: sandbox.contextPaths, text: sandbox.contextText },
      mock: job.task.mock,
      signal
    });
    if (signal.aborted) {
      return null;
    }

    // Diff before verifying: verification may build or write artifacts that
    // are not the agent's work.
    const changes = await collectChanges(sandbox.dir);
    await writeFile(join(input.runDir, base.diffPath), changes.patch);

    const verify = agent.completed
      ? await runVerify(job.task.verify, sandbox.dir, job.task.timeoutSec * 1000, signal)
      : [];
    if (signal.aborted) {
      return null;
    }
    const checks = evaluateChecks(job.task.checks, agent, changes.files);

    let failure: FailureReason = null;
    if (agent.infraError === true) {
      failure = "infra-error";
    } else if (!agent.completed) {
      failure = "agent-error";
    } else if (verify.some((outcome) => outcome.exitCode !== 0)) {
      failure = "verify-failed";
    } else if (checks.some((check) => !check.pass)) {
      failure = "check-failed";
    }

    const result: TrialResult = {
      ...base,
      passed: failure === null,
      failure,
      verify,
      checks,
      agent,
      changedFiles: changes.files
    };

    await writeFile(join(absoluteTrialDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await sandbox.cleanup();
  }
}

/**
 * Runs every task × setup × trial with bounded concurrency.
 *
 * results.json is rewritten after every finished run, so an experiment that is
 * interrupted, stopped or killed outright still leaves a readable result.
 */
export async function runExperiment(input: RunExperimentInput): Promise<ExperimentResult> {
  const startedAt = new Date();
  const resultsPath = join(input.runDir, "results.json");
  await mkdir(input.runDir, { recursive: true });
  await pruneWorktrees(input.repoRoot);

  // Context is read once per variant, not per trial: the working tree could
  // otherwise change underneath a long experiment.
  const contextByVariant = new Map<string, ContextFile[]>();
  for (const variant of input.variants) {
    contextByVariant.set(variant.name, await readContextFiles(input.repoRoot, variant.context));
  }

  const jobs = planJobs(input.tasks, input.variants, input.trials);
  const finished: TrialResult[] = [];
  let status: ExperimentStatus = "running";
  let stopReason: string | undefined;

  // One controller stops everything, whether the user interrupted or the runs
  // showed the environment is broken.
  const stop = new AbortController();
  const onInterrupt = (): void => {
    if (status === "running") {
      status = "interrupted";
    }
    stop.abort();
  };
  if (input.signal?.aborted) {
    onInterrupt();
  }
  input.signal?.addEventListener("abort", onInterrupt, { once: true });

  const snapshot = (results: TrialResult[]): ExperimentResult => ({
    schemaVersion: 1,
    id: input.runId,
    status,
    ...(stopReason !== undefined ? { stopReason } : {}),
    plannedRuns: jobs.length,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    agent: input.config,
    trials: input.trials,
    variants: input.variants,
    tasks: input.tasks.map((task) => ({ id: task.id, file: task.file })),
    results
  });

  // Writes are chained so two runs finishing together cannot interleave.
  let writing = Promise.resolve();
  const persist = (): Promise<void> => {
    const next = snapshot([...finished]);
    writing = writing.then(() => writeJsonAtomic(resultsPath, next));
    return writing;
  };
  await persist();

  const limit = pLimit(Math.max(1, input.concurrency));
  const planned = await Promise.all(
    jobs.map((job) =>
      limit(async () => {
        if (stop.signal.aborted) {
          return null;
        }
        const result = await runTrial(input, job, contextByVariant.get(job.variant.name) ?? [], stop.signal);
        if (result === null) {
          return null;
        }

        finished.push(result);
        const couldNotRun = finished.filter((r) => r.failure === "infra-error").length;
        if (
          status === "running" &&
          couldNotRun === finished.length &&
          couldNotRun >= Math.min(STOP_AFTER_INFRA_ERRORS, jobs.length)
        ) {
          status = "stopped";
          stopReason = result.agent.error ?? "runs could not start";
          stop.abort();
        }

        input.onProgress?.({ done: finished.length, total: jobs.length, last: result });
        await persist();
        return result;
      })
    )
  );

  input.signal?.removeEventListener("abort", onInterrupt);
  await pruneWorktrees(input.repoRoot);

  if (status === "running") {
    status = "complete";
  }
  // Plan order, not finishing order, so the same experiment always reads the same.
  const experiment = snapshot(planned.filter((result): result is TrialResult => result !== null));
  writing = writing.then(() => writeJsonAtomic(resultsPath, experiment));
  await writing;
  return experiment;
}
