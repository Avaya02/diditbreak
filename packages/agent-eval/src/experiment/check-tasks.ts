import pLimit from "p-limit";

import { readContextFiles } from "../context/context-files.js";
import { createSandbox, SandboxError } from "../sandbox/sandbox.js";
import type { AgentRunResult, AgentTask, Variant } from "../types.js";
import { evaluateChecks, runVerify } from "../verify/checks.js";

/** An agent that starts, does nothing, and stops. */
const NOTHING_DONE: AgentRunResult = {
  completed: true,
  finalMessage: "",
  turns: 0,
  durationMs: 0,
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  contextTokens: null,
  toolCalls: [],
  skillsUsed: [],
  commands: [],
  permissionDenials: 0,
  environment: { skillsLoaded: [], mcpServers: [], agents: [] }
};

export interface CheckTasksInput {
  repoRoot: string;
  runId: string;
  tasks: AgentTask[];
  setup: string[];
  concurrency: number;
  signal?: AbortSignal | undefined;
}

export interface TaskCheckResult {
  /** Tasks an agent that changes nothing would pass: they cannot tell success from inaction. */
  passedByDoingNothing: AgentTask[];
}

/**
 * Runs each task's verification and checks on an untouched sandbox, before
 * anything is spent.
 *
 * A task whose checks already pass before the agent starts (an existing test
 * suite on its own, say) reports every run as solved whatever the agent does,
 * so every setup looks equally good. This is the same validation benchmarks
 * like SWE-bench apply: a task's tests must fail before the change.
 *
 * Throws SandboxError when a sandbox cannot be prepared, typically a failing
 * setup command, since every run of the experiment would fail the same way.
 */
export async function checkTasks(input: CheckTasksInput): Promise<TaskCheckResult> {
  const limit = pLimit(Math.max(1, input.concurrency));

  const outcomes = await Promise.all(
    input.tasks.map((task) =>
      limit(async () => {
        const variant: Variant = { name: "do-nothing", context: { kind: "ref", ref: task.base }, remove: [], removeSections: [] };
        const sandbox = await createSandbox({
          repoRoot: input.repoRoot,
          runId: `${input.runId}-task-check`,
          task,
          variant,
          trial: 0,
          contextFiles: await readContextFiles(input.repoRoot, variant.context),
          setup: input.setup,
          setupTimeoutMs: task.timeoutSec * 1000,
          signal: input.signal
        }).catch((error: unknown) => {
          throw new SandboxError(`task ${task.id}: ${(error as Error).message}`);
        });

        try {
          const verify = await runVerify(task.verify, sandbox.dir, task.timeoutSec * 1000, input.signal);
          const checks = evaluateChecks(task.checks, NOTHING_DONE, []);
          const passes = verify.every((outcome) => outcome.exitCode === 0) && checks.every((check) => check.pass);
          return { task, passes };
        } finally {
          await sandbox.cleanup();
        }
      })
    )
  );

  return { passedByDoingNothing: outcomes.filter((outcome) => outcome.passes).map((outcome) => outcome.task) };
}
