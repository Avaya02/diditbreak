import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createInterface } from "node:readline/promises";

import {
  AgentUnavailableError,
  BASELINE,
  ClaudeCodeAdapter,
  GitError,
  MockAgentAdapter,
  SandboxError,
  TaskFileError,
  buildVariants,
  checkTasks,
  loadTasks,
  parseExperimentSettings,
  planAblation,
  readContextFiles,
  repoRoot as findRepoRoot,
  runExperiment,
  summarizeExperiment,
  variantFromToken,
  type AgentAdapter,
  type AgentTask,
  type ExperimentResult,
  type ExperimentSettings,
  type ExperimentSummary,
  type Variant
} from "@diditbreak/agent-eval";
import chalk from "chalk";
import { execa } from "execa";
import ora, { type Ora } from "ora";

import { loadConfigModule } from "../config/load-config.js";
import { CliError } from "../errors.js";
import { EXIT } from "../exit-codes.js";
import { printCompareReport } from "../reporter/compare-report.js";

export interface ExperimentOptions {
  trials?: number | undefined;
  tasks?: string | undefined;
  agent?: string | undefined;
  model?: string | undefined;
  concurrency?: number | undefined;
  yes?: boolean | undefined;
  json?: boolean | undefined;
  /** Interrupts the run as Ctrl-C would. For tests; the CLI wires up signals itself. */
  signal?: AbortSignal | undefined;
}

export interface CompareCommandArgs extends ExperimentOptions {
  setups: string[];
  baseline?: boolean | undefined;
  reference?: string | undefined;
}

export interface AblateCommandArgs extends ExperimentOptions {
  file?: string | undefined;
  from?: string | undefined;
  skills?: boolean | undefined;
}

interface Prepared {
  root: string;
  settings: ExperimentSettings;
  tasks: AgentTask[];
  adapter: AgentAdapter;
}

async function prepare(options: ExperimentOptions): Promise<Prepared> {
  const cwd = process.cwd();

  let root: string;
  try {
    root = await findRepoRoot(cwd);
  } catch {
    throw new CliError("Not inside a git repository.", "Agent experiments sandbox the repo with git worktrees; run this from a git checkout.");
  }

  const settings = parseExperimentSettings(await loadConfigModule(root, { required: false }));
  if (options.agent !== undefined) {
    if (options.agent !== "claude-code" && options.agent !== "mock") {
      throw new CliError(`Unknown agent "${options.agent}".`, "Use claude-code or mock.");
    }
    settings.agent.name = options.agent;
  }
  if (options.model !== undefined) {
    settings.agent.model = options.model;
  }
  if (options.trials !== undefined) {
    settings.trials = options.trials;
  }
  if (options.concurrency !== undefined) {
    settings.concurrency = options.concurrency;
  }
  if (options.tasks !== undefined) {
    settings.tasksDir = options.tasks;
  }

  let tasks: AgentTask[];
  try {
    tasks = await loadTasks(root, settings.tasksDir);
  } catch (error) {
    if (error instanceof TaskFileError) {
      throw new CliError(error.message, `Tasks live in ${settings.tasksDir}/*.yaml. Run \`diditbreak init --agent\` for a working example.`);
    }
    throw error;
  }

  if (tasks.length === 0) {
    throw new CliError(`No tasks in ${settings.tasksDir}.`, "Add a task file, or run `diditbreak init --agent` for an example.");
  }

  for (const ref of new Set(tasks.map((task) => task.base))) {
    await assertRef(root, ref, "task base");
  }

  const adapter: AgentAdapter = settings.agent.name === "mock" ? new MockAgentAdapter() : new ClaudeCodeAdapter();
  return { root, settings, tasks, adapter };
}

async function assertRef(root: string, ref: string, what: string): Promise<void> {
  const result = await execa("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: root, reject: false });
  if (result.exitCode !== 0) {
    throw new CliError(`Unknown git ref "${ref}" (${what}).`, "Use a branch, tag or commit, or `working` / `none`.");
  }
}

async function confirm(
  prepared: Prepared,
  variants: Variant[],
  options: ExperimentOptions,
  signal: AbortSignal
): Promise<boolean> {
  const runs = variants.length * prepared.tasks.length * prepared.settings.trials;
  const { agent } = prepared.settings;
  const plan = `${variants.length} setups × ${prepared.tasks.length} tasks × ${prepared.settings.trials} trials = ${runs} agent runs`;

  if (agent.name === "mock" || options.yes) {
    if (!options.json) {
      console.error(chalk.dim(` ${plan}`));
    }
    return true;
  }

  // The per-run budget is enforced by the agent, so this bound is real.
  const ceiling = runs * agent.maxBudgetUsd;
  const message = ` ${plan}\n Spend is capped at $${agent.maxBudgetUsd} per run: at most $${ceiling.toFixed(2)} in total.`;

  if (!process.stdin.isTTY) {
    throw new CliError(`${plan} would start without confirmation.`, "Pass --yes to run non-interactively (CI).");
  }

  console.error(message);
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  // In a terminal, readline turns Ctrl-C into its own event; unhandled, the
  // prompt would just pause. Treat it as "no", like any other refusal.
  const asking = new AbortController();
  prompt.on("SIGINT", () => asking.abort());
  signal.addEventListener("abort", () => asking.abort(), { once: true });
  try {
    const answer = await prompt.question(" Continue? [y/N] ", { signal: asking.signal });
    return /^y(es)?$/i.test(answer.trim());
  } catch {
    process.stderr.write("\n");
    return false;
  } finally {
    prompt.close();
  }
}

function runId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
}

/** Free checks that catch a broken environment before anything is spent. */
async function preflight(prepared: Prepared, id: string, options: ExperimentOptions, signal: AbortSignal): Promise<string[]> {
  try {
    await prepared.adapter.preflight?.();
  } catch (error) {
    if (error instanceof AgentUnavailableError) {
      throw new CliError(error.message, error.hint);
    }
    throw error;
  }

  const interactive = process.stderr.isTTY && !options.json;
  const spinner = ora({ text: "Checking tasks", stream: process.stderr, isSilent: !interactive }).start();
  let vacuous: AgentTask[];
  try {
    ({ passedByDoingNothing: vacuous } = await checkTasks({
      repoRoot: prepared.root,
      runId: id,
      tasks: prepared.tasks,
      setup: prepared.settings.setup,
      concurrency: prepared.settings.concurrency,
      signal
    }));
  } catch (error) {
    if (signal.aborted) {
      throw new Interrupted();
    }
    if (error instanceof SandboxError) {
      throw new CliError(
        `Could not prepare a sandbox for ${error.message}`,
        "Every run would fail the same way. Check tasks.setup in diditbreak.config.ts and the task's base ref."
      );
    }
    throw error;
  } finally {
    spinner.stop();
  }

  return vacuous.map(
    (task) =>
      `Task "${task.id}" passes even if the agent changes nothing, so it cannot tell setups apart. Add a check that fails until the task is done: a test of the new behaviour, or must_change (${task.file}).`
  );
}

/**
 * Ctrl-C (or SIGTERM from a CI cancel) stops running agents and keeps the
 * runs that finished. Agents run in their own process groups, so without this
 * they would outlive diditbreak and keep spending. A second Ctrl-C quits now.
 */
function interruptOnSignals(controller: AbortController, onFirst: () => void): () => void {
  let received = 0;
  const handler = (): void => {
    received += 1;
    if (received === 1) {
      onFirst();
      controller.abort();
      return;
    }
    process.exit(EXIT.interrupted);
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
  return () => {
    process.off("SIGINT", handler);
    process.off("SIGTERM", handler);
  };
}

/** Ctrl-C before any run started: nothing to report, nothing spent. */
class Interrupted extends Error {
  constructor() {
    super("Interrupted before any runs started. Nothing was spent.");
    this.name = "Interrupted";
  }
}

interface Executed {
  experiment: ExperimentResult;
  resultsPath: string;
  warnings: string[];
}

async function execute(prepared: Prepared, variants: Variant[], options: ExperimentOptions): Promise<Executed | null> {
  const id = runId();
  const interactive = process.stderr.isTTY && !options.json;
  let spinner: Ora | undefined;

  // Signals are handled for the whole command, so Ctrl-C during the checks or
  // at the prompt cleans up too.
  const controller = new AbortController();
  if (options.signal?.aborted) {
    controller.abort();
  }
  options.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  const release = interruptOnSignals(controller, () => {
    spinner?.stop();
    console.error(" Stopping: ending running agents and cleaning up. Press Ctrl-C again to quit now.");
  });

  try {
    // Without a terminal there is no one to say yes: refuse before the checks,
    // not after them.
    if (prepared.settings.agent.name !== "mock" && !options.yes && !process.stdin.isTTY) {
      const runs = variants.length * prepared.tasks.length * prepared.settings.trials;
      throw new CliError(`${runs} agent runs would start without confirmation.`, "Pass --yes to run non-interactively (CI).");
    }

    const warnings = await preflight(prepared, id, options, controller.signal);
    // An interrupted check can still return, its commands merely failing.
    if (controller.signal.aborted) {
      throw new Interrupted();
    }
    if (!options.json) {
      for (const warning of warnings) {
        console.error(`${chalk.yellow("!")} ${warning}`);
      }
    }

    if (!(await confirm(prepared, variants, options, controller.signal))) {
      if (controller.signal.aborted) {
        throw new Interrupted();
      }
      console.error(" Cancelled.");
      return null;
    }

    const runsRoot = join(prepared.root, ".diditbreak", "runs");
    const runDir = join(runsRoot, id);
    await mkdir(runsRoot, { recursive: true });
    // Self-ignoring: run artifacts stay out of git without editing the user's
    // .gitignore, and without ignoring the prompt registry next to it.
    await writeFile(join(runsRoot, ".gitignore"), "*\n");

    spinner = ora({ text: "Starting", stream: process.stderr, isSilent: !interactive }).start();
    const progress = spinner;

    const experiment = await runExperiment({
      repoRoot: prepared.root,
      runDir,
      runId: id,
      tasks: prepared.tasks,
      variants,
      agent: prepared.adapter,
      config: prepared.settings.agent,
      trials: prepared.settings.trials,
      concurrency: prepared.settings.concurrency,
      setup: prepared.settings.setup,
      signal: controller.signal,
      onProgress: ({ done, total, last }) => {
        const couldNotRun = last.failure === "infra-error";
        const mark = last.passed ? chalk.green("✓") : couldNotRun ? chalk.yellow("!") : chalk.red("✗");
        progress.text = `${done}/${total} ${mark} ${last.variant} × ${last.taskId} #${last.trial}`;
        // In CI there is no spinner, so log each run: long jobs need a heartbeat.
        if (!interactive && !options.json) {
          const outcome = last.passed
            ? "passed"
            : couldNotRun
              ? `could not run (${last.agent.error ?? "unknown error"})`
              : `failed (${last.failure})`;
          console.error(` [${done}/${total}] ${last.variant} × ${last.taskId} #${last.trial} ${outcome}`);
        }
      }
    });

    return { experiment, resultsPath: relative(process.cwd(), join(runDir, "results.json")), warnings };
  } finally {
    release();
    spinner?.stop();
  }
}

function emit(
  experiment: ExperimentResult,
  summary: ExperimentSummary,
  resultsPath: string,
  options: ExperimentOptions,
  extra: { labels?: Record<string, string>; warnings?: string[] } = {}
): void {
  if (options.json) {
    const report = {
      schemaVersion: 1,
      id: experiment.id,
      status: experiment.status ?? "complete",
      ...(experiment.plannedRuns !== undefined ? { plannedRuns: experiment.plannedRuns } : {}),
      resultsPath,
      problems: summary.problems,
      warnings: extra.warnings ?? [],
      summary
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  printCompareReport({ experiment, summary, resultsPath, labels: extra.labels });
}

/** Hint for the most common reasons runs cannot start. */
function problemHint(problem: string): string {
  if (/authentication|logged in|API key/i.test(problem)) {
    return "Check ANTHROPIC_API_KEY, or run `claude` once and log in. Nothing was compared.";
  }
  if (/setup command failed|sandbox/i.test(problem)) {
    return "Check tasks.setup in diditbreak.config.ts. Nothing was compared.";
  }
  return "Nothing was compared: fix the cause above and run again. Details are in the results file.";
}

/**
 * Exit code for a finished experiment that did not reach a verdict, or null
 * when it did. Interrupted wins; problems mean the numbers are not evidence.
 */
function unanswered(experiment: ExperimentResult, summary: ExperimentSummary, options: ExperimentOptions): number | null {
  if (experiment.status === "interrupted") {
    if (!options.json) {
      console.error(` Interrupted after ${experiment.results.length} of ${experiment.plannedRuns ?? "?"} runs. Partial results are above.`);
    }
    return EXIT.interrupted;
  }
  if (summary.problems.length > 0) {
    if (!options.json) {
      for (const problem of summary.problems) {
        console.error(`${chalk.red("✗")} No verdict: ${problem}`);
      }
      console.error(`  ${problemHint(summary.problems[0]!)}\n`);
    }
    return EXIT.error;
  }
  return null;
}

function handleError(error: unknown, options: ExperimentOptions): number {
  if (error instanceof Interrupted) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: "interrupted", error: { message: error.message } }, null, 2)}\n`);
    } else {
      console.error(` ${error.message}`);
    }
    return EXIT.interrupted;
  }
  const message = error instanceof Error ? error.message : String(error);
  const hint = error instanceof CliError ? error.hint : error instanceof GitError ? "Check that the repository and refs are valid." : undefined;

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, error: { message, ...(hint ? { hint } : {}) } }, null, 2)}\n`);
  } else {
    console.error(`\n${chalk.red("✗")} ${message}`);
    if (hint) {
      console.error(`  ${hint}\n`);
    }
  }
  return EXIT.error;
}

/**
 * `diditbreak compare [setups...]`: run the same tasks under several context
 * setups and report whether each is better or worse than the reference.
 * Exits 1 when the last setup is clearly worse, so it can gate a CI job.
 */
export async function runCompareCommand(args: CompareCommandArgs): Promise<number> {
  try {
    const prepared = await prepare(args);
    const variants = buildVariants(args.setups, { baseline: args.baseline !== false });

    for (const variant of variants) {
      if (variant.context.kind === "ref") {
        await assertRef(prepared.root, variant.context.ref, "setup");
      }
    }

    const outcome = await execute(prepared, variants, args);
    if (!outcome) {
      return EXIT.ok;
    }

    const summary = summarizeExperiment(outcome.experiment, args.reference);
    emit(outcome.experiment, summary, outcome.resultsPath, args, { warnings: outcome.warnings });

    const stopped = unanswered(outcome.experiment, summary, args);
    if (stopped !== null) {
      return stopped;
    }

    const candidate = [...variants].reverse().find((v) => v.name !== BASELINE && v.name !== summary.reference);
    const verdict = summary.comparisons.find((c) => c.variant === candidate?.name)?.verdict;
    return verdict === "worse" ? EXIT.regression : EXIT.ok;
  } catch (error) {
    return handleError(error, args);
  }
}

/**
 * `diditbreak ablate [file]`: remove one section of the context file (and one
 * skill) at a time, to find which part helps and which part hurts.
 */
export async function runAblateCommand(args: AblateCommandArgs): Promise<number> {
  try {
    const prepared = await prepare(args);
    const file = args.file ?? "CLAUDE.md";
    const source = variantFromToken(args.from ?? "working").context;

    if (source.kind === "ref") {
      await assertRef(prepared.root, source.ref, "--from");
    }
    if (source.kind === "none") {
      throw new CliError("Nothing to ablate in the empty setup.", "Use --from working (default) or a git ref.");
    }

    const files = await readContextFiles(prepared.root, source);
    const plan = planAblation(source, files, { file, includeSkills: args.skills !== false });

    if (plan.variants.length === 1) {
      throw new CliError(
        `Nothing to remove: ${file} has no sections${args.skills !== false ? " and there are no skills" : ""}.`,
        `Ablation needs a ${file} with "##" sections, or skills under .claude/skills/.`
      );
    }

    const outcome = await execute(prepared, plan.variants, args);
    if (!outcome) {
      return EXIT.ok;
    }

    const summary = summarizeExperiment(outcome.experiment, "full");
    emit(outcome.experiment, summary, outcome.resultsPath, args, { labels: plan.removed, warnings: outcome.warnings });
    return unanswered(outcome.experiment, summary, args) ?? EXIT.ok;
  } catch (error) {
    return handleError(error, args);
  }
}

export interface ReportCommandArgs {
  path?: string | undefined;
  reference?: string | undefined;
  json?: boolean | undefined;
}

/**
 * `diditbreak report [results.json]`: re-render a finished experiment without
 * running anything. Defaults to the most recent run.
 */
export async function runReportCommand(args: ReportCommandArgs): Promise<number> {
  try {
    let path = args.path;
    if (path === undefined) {
      let root: string;
      try {
        root = await findRepoRoot(process.cwd());
      } catch {
        root = process.cwd();
      }
      const runsRoot = join(root, ".diditbreak", "runs");
      const runs = (await readdir(runsRoot).catch(() => [] as string[])).filter((name) => !name.startsWith(".")).sort();
      const latest = runs.at(-1);
      if (latest === undefined) {
        throw new CliError("No experiment results yet.", "Run `diditbreak compare` first.");
      }
      path = join(runsRoot, latest, "results.json");
    }

    let experiment: ExperimentResult;
    try {
      experiment = JSON.parse(await readFile(path, "utf-8")) as ExperimentResult;
    } catch {
      throw new CliError(
        `Cannot read results from ${relative(process.cwd(), path)}.`,
        "Runs from before this version save results only when they finish. Pass a results.json written by `diditbreak compare`."
      );
    }

    const summary = summarizeExperiment(experiment, args.reference);
    emit(experiment, summary, relative(process.cwd(), path), args);
    if (!args.json) {
      for (const problem of summary.problems) {
        console.error(`${chalk.red("✗")} No verdict: ${problem}`);
      }
    }
    return EXIT.ok;
  } catch (error) {
    return handleError(error, args);
  }
}
