import type { ExperimentResult, TrialResult } from "../types.js";
import {
  mean,
  pairedBootstrap,
  pairedRelativeChange,
  wilsonInterval,
  type DifferenceEstimate,
  type Interval,
  type PairedTaskValues
} from "./stats.js";

export interface CheckTally {
  check: string;
  failed: number;
  total: number;
  /** A representative failure detail, e.g. the offending command. */
  example?: string | undefined;
}

export interface VariantSummary {
  name: string;
  /** Runs that measured the agent. Runs that could not run are not included. */
  runs: number;
  passed: number;
  passRate: number;
  passRateInterval: Interval;
  failures: { agentError: number; verifyFailed: number; checkFailed: number };
  /** Runs that could not run at all, left out of every number above and below. */
  couldNotRun: number;
  /** Why they could not run, with counts. */
  couldNotRunReasons: Record<string, number>;
  meanCostUsd: number | null;
  meanTurns: number | null;
  meanContextTokens: number | null;
  meanDurationMs: number | null;
  totalCostUsd: number;
  checks: CheckTally[];
  skillsUsed: Record<string, number>;
  /** Distinct agent errors with counts, e.g. "error_max_turns". */
  errors: Record<string, number>;
  /** Actions the agent attempted that its permissions refused: a confusion signal. */
  permissionDenials: number;
  /** Skills the agent loaded at startup, from any source, as reported by the agent. */
  skillsLoaded: string[];
}

export type Verdict = "better" | "worse" | "no-clear-difference";

export interface Comparison {
  variant: string;
  reference: string;
  passRate: DifferenceEstimate;
  verdict: Verdict;
  /** Relative change versus the reference, e.g. 0.33 for +33%. */
  costChange: number | null;
  /** 95% interval for costChange; a change is only real if it excludes zero. */
  costChangeInterval: Interval | null;
  turnsChange: number | null;
  turnsChangeInterval: Interval | null;
  /** Absolute change in starting context, in tokens. */
  contextTokensChange: number | null;
}

export interface ExperimentSummary {
  reference: string;
  variants: VariantSummary[];
  comparisons: Comparison[];
  /**
   * Reasons the experiment cannot answer its question, e.g. most runs could
   * not start. Non-empty means no verdict should be trusted or acted on.
   */
  problems: string[];
}

/** A run that could not run measures the environment, not the agent. */
function measured(results: TrialResult[]): TrialResult[] {
  return results.filter((result) => result.failure !== "infra-error");
}

function firstLine(text: string): string {
  return text.split("\n")[0]!.slice(0, 160);
}

function tally(reasons: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const reason of reasons) {
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
  return counts;
}

function topReason(counts: Record<string, number>): string | undefined {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function summarizeVariant(name: string, all: TrialResult[]): VariantSummary {
  const results = measured(all);
  const unrunnable = all.filter((result) => result.failure === "infra-error");
  const passed = results.filter((result) => result.passed).length;
  const tallies = new Map<string, CheckTally>();
  const skillsUsed: Record<string, number> = {};
  const errors: Record<string, number> = {};

  for (const result of results) {
    for (const check of result.checks) {
      const tally = tallies.get(check.check) ?? { check: check.check, failed: 0, total: 0 };
      tally.total += 1;
      if (!check.pass) {
        tally.failed += 1;
        tally.example ??= check.detail;
      }
      tallies.set(check.check, tally);
    }
    for (const skill of new Set(result.agent.skillsUsed)) {
      skillsUsed[skill] = (skillsUsed[skill] ?? 0) + 1;
    }
    if (result.failure === "agent-error" && result.agent.error) {
      const key = result.agent.error.split("\n")[0]!.slice(0, 120);
      errors[key] = (errors[key] ?? 0) + 1;
    }
  }

  const costs = results.map((r) => r.agent.costUsd).filter((c): c is number => c !== null);
  const contexts = results.map((r) => r.agent.contextTokens).filter((c): c is number => c !== null);
  // Turns and time are only meaningful for runs where the agent actually ran.
  const ran = results.filter((r) => r.agent.turns > 0);

  return {
    name,
    runs: results.length,
    passed,
    passRate: results.length === 0 ? 0 : passed / results.length,
    passRateInterval: wilsonInterval(passed, results.length),
    failures: {
      agentError: results.filter((r) => r.failure === "agent-error").length,
      verifyFailed: results.filter((r) => r.failure === "verify-failed").length,
      checkFailed: results.filter((r) => r.failure === "check-failed").length
    },
    couldNotRun: unrunnable.length,
    couldNotRunReasons: tally(unrunnable.map((r) => firstLine(r.agent.error ?? "unknown error"))),
    meanCostUsd: mean(costs),
    meanTurns: mean(ran.map((r) => r.agent.turns)),
    meanContextTokens: mean(contexts),
    meanDurationMs: mean(ran.map((r) => r.agent.durationMs)),
    // Spend counts every run, including ones that failed partway.
    totalCostUsd: all.reduce((total, r) => total + (r.agent.costUsd ?? 0), 0),
    checks: [...tallies.values()].sort((a, b) => a.check.localeCompare(b.check)),
    skillsUsed,
    errors,
    permissionDenials: results.reduce((total, r) => total + r.agent.permissionDenials, 0),
    skillsLoaded: [...new Set(results.flatMap((r) => r.agent.environment.skillsLoaded))].sort()
  };
}

/**
 * Summarises an experiment and compares every setup against a reference.
 *
 * The reference defaults to the first setup that is not the "none" baseline,
 * which in `compare main working` is `main`: the question being asked is
 * whether the change beats what is committed.
 */
export function summarizeExperiment(experiment: ExperimentResult, referenceName?: string): ExperimentSummary {
  const names = experiment.variants.map((variant) => variant.name);
  const reference =
    referenceName ?? names.find((name) => name !== "none") ?? names[0] ?? "";

  const byVariant = new Map<string, TrialResult[]>();
  for (const name of names) {
    byVariant.set(name, experiment.results.filter((result) => result.variant === name));
  }

  const variants = names.map((name) => summarizeVariant(name, byVariant.get(name) ?? []));
  const referenceSummary = variants.find((variant) => variant.name === reference);

  // Per task, so every comparison is paired: same task, different context.
  const perTask = <T>(name: string, taskId: string, pick: (result: TrialResult) => T | null): T[] =>
    measured(byVariant.get(name) ?? [])
      .filter((r) => r.taskId === taskId)
      .map(pick)
      .filter((value): value is T => value !== null);

  const comparisons: Comparison[] = [];
  for (const variant of variants) {
    if (variant.name === reference || !referenceSummary) {
      continue;
    }

    const paired = experiment.tasks.map((task) => ({
      reference: perTask(reference, task.id, (r) => r.passed),
      candidate: perTask(variant.name, task.id, (r) => r.passed)
    }));

    const estimate = pairedBootstrap(paired);
    const verdict: Verdict = estimate.low > 0 ? "better" : estimate.high < 0 ? "worse" : "no-clear-difference";

    const values = (pick: (result: TrialResult) => number | null): PairedTaskValues[] =>
      experiment.tasks.map((task) => ({
        reference: perTask(reference, task.id, pick),
        candidate: perTask(variant.name, task.id, pick)
      }));
    const cost = pairedRelativeChange(values((r) => r.agent.costUsd));
    // Turns only where the agent actually ran.
    const turns = pairedRelativeChange(values((r) => (r.agent.turns > 0 ? r.agent.turns : null)));

    comparisons.push({
      variant: variant.name,
      reference,
      passRate: estimate,
      verdict,
      costChange: cost?.mean ?? null,
      costChangeInterval: cost ? { low: cost.low, high: cost.high } : null,
      turnsChange: turns?.mean ?? null,
      turnsChangeInterval: turns ? { low: turns.low, high: turns.high } : null,
      contextTokensChange:
        variant.meanContextTokens !== null && referenceSummary.meanContextTokens !== null
          ? variant.meanContextTokens - referenceSummary.meanContextTokens
          : null
    });
  }

  return { reference, variants, comparisons, problems: findProblems(experiment, variants) };
}

/**
 * When the runs that could not run outnumber the ones that measured something,
 * or a setup measured nothing at all, the comparison is not evidence of
 * anything. Saying so is the difference between a failed check and a check
 * that silently passed without testing.
 */
function findProblems(experiment: ExperimentResult, variants: VariantSummary[]): string[] {
  const problems: string[] = [];
  const finished = experiment.results.length;
  const couldNotRun = variants.reduce((total, v) => total + v.couldNotRun, 0);

  if (experiment.status === "stopped") {
    problems.push(`stopped early because runs could not start: ${experiment.stopReason ?? "unknown error"}`);
  } else if (finished > 0 && couldNotRun * 2 > finished) {
    const reasons = tally(
      experiment.results.filter((r) => r.failure === "infra-error").map((r) => firstLine(r.agent.error ?? "unknown error"))
    );
    problems.push(`${couldNotRun} of ${finished} runs could not run: ${topReason(reasons) ?? "unknown error"}`);
  }

  if (experiment.status === "complete" || experiment.status === undefined) {
    for (const variant of variants) {
      if (variant.runs === 0) {
        problems.push(`setup "${variant.name}" has no runs that measured the agent`);
      }
    }
  }

  return problems;
}
