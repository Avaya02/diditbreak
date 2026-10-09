import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../src/config.js";
import { MockAgentAdapter } from "../src/agents/mock.js";
import { readContextFiles } from "../src/context/context-files.js";
import { checkTasks } from "../src/experiment/check-tasks.js";
import { runExperiment } from "../src/experiment/run-experiment.js";
import { buildVariants, planAblation } from "../src/experiment/variants.js";
import { summarizeExperiment } from "../src/stats/summarize.js";
import { parseTask } from "../src/tasks/load-tasks.js";
import type { AgentAdapter, AgentRunInput, AgentRunResult, AgentTask, ExperimentResult } from "../src/types.js";

const exec = promisify(execFile);
const git = (cwd: string, ...args: string[]) =>
  exec("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd });

let repo: string;
let runs: string;

const COMMITTED_CLAUDE_MD = `# Project

## Tooling
This project uses pnpm.

## Style
Two-space indent.
`;

// The working-tree edit adds a section that contradicts the tooling rule.
const EDITED_CLAUDE_MD = `${COMMITTED_CLAUDE_MD}
## Legacy
Use npm and yarn interchangeably.
`;

function task(id: string, file: string): AgentTask {
  return parseTask(
    {
      prompt: `Create ${file}.`,
      verify: [`test -f ${file}`],
      checks: { must_change: [file], forbid_commands: ["npm install"], expect_skills: ["greeter"] },
      mock: {
        files: { [file]: "export {};\n" },
        requires: ["pnpm"],
        breaks_on: ["interchangeably"],
        commands: [{ run: "npm install", unless: "pnpm" }],
        skills: ["greeter"]
      }
    },
    `${id}.yaml`
  );
}

const tasks = [task("add-greet", "src/greet.ts"), task("add-farewell", "src/farewell.ts")];

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), "diditbreak-repo-"));
  runs = await mkdtemp(join(tmpdir(), "diditbreak-runs-"));

  await mkdir(join(repo, "src"), { recursive: true });
  await mkdir(join(repo, ".claude/skills/greeter"), { recursive: true });
  await writeFile(join(repo, "src/.gitkeep"), "");
  await writeFile(join(repo, "CLAUDE.md"), COMMITTED_CLAUDE_MD);
  await writeFile(join(repo, ".claude/skills/greeter/SKILL.md"), "---\nname: greeter\n---\nGreet people.\n");

  await git(repo, "init", "-q");
  await git(repo, "add", "-A");
  await git(repo, "commit", "-qm", "init");

  await writeFile(join(repo, "CLAUDE.md"), EDITED_CLAUDE_MD);
});

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
  await rm(runs, { recursive: true, force: true });
});

async function experiment(
  variants: ReturnType<typeof buildVariants>,
  runId: string,
  overrides: Partial<Parameters<typeof runExperiment>[0]> = {}
): Promise<ExperimentResult> {
  return runExperiment({
    repoRoot: repo,
    runDir: join(runs, runId),
    runId,
    tasks,
    variants,
    agent: new MockAgentAdapter(),
    config: { ...DEFAULT_SETTINGS.agent, name: "mock" },
    trials: 3,
    concurrency: 3,
    setup: [],
    ...overrides
  });
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  );

async function worktreeCount(): Promise<number> {
  const { stdout } = await git(repo, "worktree", "list");
  return stdout.trim().split("\n").length;
}

function couldNotRun(error: string): AgentRunResult {
  return {
    completed: false,
    error,
    infraError: true,
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
}

describe("runExperiment end to end", () => {
  let result: ExperimentResult;

  beforeAll(async () => {
    result = await experiment(buildVariants(["HEAD", "working"], { baseline: true }), "compare");
  });

  it("runs every task × setup × trial", () => {
    expect(result.results).toHaveLength(2 * 3 * 3);
  });

  it("passes with the committed context", () => {
    const head = result.results.filter((r) => r.variant === "HEAD");
    expect(head.every((r) => r.passed)).toBe(true);
  });

  it("fails when the edit adds a contradicting instruction", () => {
    const working = result.results.filter((r) => r.variant === "working");
    expect(working.every((r) => !r.passed && r.failure === "verify-failed")).toBe(true);
  });

  it("fails without context, breaking the npm rule and missing the skill", () => {
    const none = result.results.filter((r) => r.variant === "none");
    expect(none.every((r) => !r.passed)).toBe(true);
    const checks = none[0]!.checks;
    expect(checks.find((c) => c.check === "forbid_command npm install")).toMatchObject({ pass: false });
    expect(checks.find((c) => c.check === "expect_skill greeter")).toMatchObject({
      pass: false,
      detail: "not loaded in this setup"
    });
  });

  it("records only the agent's own changes in the diff, not the context swap", async () => {
    const head = result.results.find((r) => r.variant === "HEAD")!;
    expect(head.changedFiles).toEqual([head.taskId === "add-greet" ? "src/greet.ts" : "src/farewell.ts"]);
    const patch = await readFile(join(runs, "compare", head.diffPath), "utf-8");
    expect(patch).not.toContain("CLAUDE.md");
  });

  it("puts an interval on cost, so a cost change is backed or labelled noise", () => {
    const working = summarizeExperiment(result).comparisons.find((c) => c.variant === "working")!;
    // The mock's cost grows with context, identically every trial.
    expect(working.costChange).toBeGreaterThan(0);
    expect(working.costChangeInterval!.low).toBeGreaterThan(0);
    expect(working.turnsChangeInterval).not.toBeNull();
  });

  it("marks the saved results complete, with the size of the plan", async () => {
    const saved = JSON.parse(await readFile(join(runs, "compare", "results.json"), "utf-8")) as ExperimentResult;
    expect(saved.status).toBe("complete");
    expect(saved.plannedRuns).toBe(18);
    expect(summarizeExperiment(saved).problems).toEqual([]);
  });

  it("measures heavier starting context for heavier CLAUDE.md files", () => {
    const context = (variant: string) =>
      result.results.find((r) => r.variant === variant)!.agent.contextTokens!;
    expect(context("none")).toBeLessThan(context("HEAD"));
    expect(context("HEAD")).toBeLessThan(context("working"));
  });

  it("summarises with an honest verdict against the committed setup", () => {
    const summary = summarizeExperiment(result);
    expect(summary.reference).toBe("HEAD");

    const working = summary.comparisons.find((c) => c.variant === "working")!;
    expect(working.verdict).toBe("worse");
    expect(working.passRate.mean).toBe(-1);
    expect(working.contextTokensChange).toBeGreaterThan(0);

    const head = summary.variants.find((v) => v.name === "HEAD")!;
    expect(head.passed).toBe(6);
    expect(head.skillsUsed).toEqual({ greeter: 6 });
  });

  it("writes results.json and per-trial artifacts", async () => {
    const saved = JSON.parse(await readFile(join(runs, "compare", "results.json"), "utf-8")) as ExperimentResult;
    expect(saved.results).toHaveLength(18);
    expect(await readdir(join(runs, "compare", "working", "add-greet", "1"))).toEqual(
      expect.arrayContaining(["changes.patch", "result.json", "transcript.jsonl"])
    );
  });

  it("leaves no worktrees or sandboxes behind", async () => {
    const { stdout } = await git(repo, "worktree", "list");
    expect(stdout.trim().split("\n")).toHaveLength(1);
  });

  it("does not touch the user's working tree", async () => {
    expect(await readFile(join(repo, "CLAUDE.md"), "utf-8")).toBe(EDITED_CLAUDE_MD);
    const { stdout } = await git(repo, "status", "--porcelain");
    expect(stdout.trim()).toBe("M CLAUDE.md");
  });
});

describe("ablation end to end", () => {
  it("pins the regression on the one section that causes it", async () => {
    const files = await readContextFiles(repo, { kind: "working" });
    const plan = planAblation({ kind: "working" }, files, { file: "CLAUDE.md", includeSkills: true });

    expect(plan.variants.map((v) => v.name)).toEqual([
      "full",
      "no-section-Tooling",
      "no-section-Style",
      "no-section-Legacy",
      "no-skill-greeter"
    ]);

    const result = await experiment(plan.variants, "ablate");
    const summary = summarizeExperiment(result, "full");
    const verdict = (name: string) => summary.comparisons.find((c) => c.variant === name)!.verdict;

    // Only removing the contradicting section makes the agent succeed.
    expect(verdict("no-section-Legacy")).toBe("better");
    expect(verdict("no-section-Style")).toBe("no-clear-difference");
    expect(verdict("no-section-Tooling")).toBe("no-clear-difference");
  });
});

describe("when runs cannot start", () => {
  it("stops after the first few instead of reproducing the failure for the whole plan", async () => {
    let calls = 0;
    const brokenKey: AgentAdapter = {
      name: "mock",
      run: async () => {
        calls += 1;
        return couldNotRun("model API error (HTTP 401): authentication failed");
      }
    };

    const result = await experiment(buildVariants(["HEAD", "working"], { baseline: true }), "stopped", {
      agent: brokenKey,
      concurrency: 1
    });

    expect(calls).toBe(3);
    expect(result.status).toBe("stopped");
    expect(result.stopReason).toMatch(/authentication failed/);
    expect(result.results.every((r) => r.failure === "infra-error")).toBe(true);

    const summary = summarizeExperiment(result);
    expect(summary.problems[0]).toMatch(/stopped early because runs could not start: .*authentication failed/);
    // Nothing measured, so no setup can look better or worse than another.
    expect(summary.variants.every((v) => v.runs === 0)).toBe(true);
    expect(await worktreeCount()).toBe(1);
  });

  it("leaves a failed sandbox setup out of the pass rate", async () => {
    const result = await experiment(buildVariants(["HEAD"], { baseline: false }), "bad-setup", {
      setup: ["exit 3"],
      trials: 1
    });

    expect(result.results[0]!.failure).toBe("infra-error");
    expect(result.results[0]!.agent.error).toMatch(/setup command failed \(exit 3\)/);
    // Both planned runs failed to start, which is enough to stop.
    expect(result.status).toBe("stopped");
    const summary = summarizeExperiment(result);
    expect(summary.variants[0]).toMatchObject({ runs: 0, couldNotRun: 2 });
    expect(summary.problems).toEqual([expect.stringMatching(/could not start: sandbox: .*setup command failed/)]);
  });

  it("keeps going when only some runs fail to start, and leaves those out", async () => {
    let calls = 0;
    const flaky: AgentAdapter = {
      name: "mock",
      run: async (input: AgentRunInput) => {
        calls += 1;
        return calls === 2 ? couldNotRun("model API error (HTTP 529): overloaded") : new MockAgentAdapter().run(input);
      }
    };

    const result = await experiment(buildVariants(["HEAD"], { baseline: false }), "one-flake", { agent: flaky, concurrency: 1 });

    expect(result.status).toBe("complete");
    expect(result.results).toHaveLength(6);
    const head = summarizeExperiment(result).variants[0]!;
    expect(head).toMatchObject({ runs: 5, passed: 5, passRate: 1, couldNotRun: 1 });
    expect(head.couldNotRunReasons).toEqual({ "model API error (HTTP 529): overloaded": 1 });
  });
});

describe("when the experiment is interrupted", () => {
  it("stops running agents, cleans up, and keeps the runs that finished", async () => {
    const controller = new AbortController();
    let calls = 0;
    let sandboxOfHungRun = "";
    const hangsOnThirdRun: AgentAdapter = {
      name: "mock",
      run: (input: AgentRunInput) => {
        calls += 1;
        if (calls < 3) {
          return new MockAgentAdapter().run(input);
        }
        sandboxOfHungRun = input.cwd;
        setTimeout(() => controller.abort(), 50);
        return new Promise<AgentRunResult>((resolve) => {
          input.signal!.addEventListener("abort", () => resolve(couldNotRun("interrupted")), { once: true });
        });
      }
    };

    const progress: string[] = [];
    const result = await experiment(buildVariants(["HEAD", "working"], { baseline: false }), "interrupted", {
      agent: hangsOnThirdRun,
      concurrency: 1,
      signal: controller.signal,
      onProgress: ({ done }) => progress.push(String(done))
    });

    expect(result.status).toBe("interrupted");
    expect(result.plannedRuns).toBe(12);
    // The half-finished third run is discarded, not counted as a failure.
    expect(result.results).toHaveLength(2);
    expect(progress).toEqual(["1", "2"]);

    const saved = JSON.parse(await readFile(join(runs, "interrupted", "results.json"), "utf-8")) as ExperimentResult;
    expect(saved.status).toBe("interrupted");
    expect(saved.results).toHaveLength(2);
    expect(summarizeExperiment(saved).problems).toEqual([]);

    expect(await worktreeCount()).toBe(1);
    expect(await exists(sandboxOfHungRun)).toBe(false);
  });

  it("saves results after every run, so even a crash leaves a readable file", async () => {
    const seen: Array<{ status: string | undefined; results: number }> = [];
    await experiment(buildVariants(["HEAD"], { baseline: false }), "incremental", {
      concurrency: 1,
      trials: 2,
      onProgress: () => {
        const saved = JSON.parse(readFileSync(join(runs, "incremental", "results.json"), "utf-8")) as ExperimentResult;
        seen.push({ status: saved.status, results: saved.results.length });
      }
    });

    // Each progress event sees the file as it stood before that run was added.
    expect(seen).toEqual([
      { status: "running", results: 0 },
      { status: "running", results: 1 },
      { status: "running", results: 2 },
      { status: "running", results: 3 }
    ]);
  });
});

describe("checkTasks", () => {
  it("flags a task an agent that does nothing would pass", async () => {
    const vacuous = parseTask({ prompt: "Improve the project.", verify: ["test -f CLAUDE.md"] }, "vacuous.yaml");
    const result = await checkTasks({ repoRoot: repo, runId: "check", tasks: [...tasks, vacuous], setup: [], concurrency: 2 });

    expect(result.passedByDoingNothing.map((task) => task.id)).toEqual(["vacuous"]);
    expect(await worktreeCount()).toBe(1);
  });

  it("counts a must_change check as proof the agent has to act", async () => {
    const guarded = parseTask(
      { prompt: "Edit the style guide.", verify: ["true"], checks: { must_change: ["CLAUDE.md"] } },
      "guarded.yaml"
    );
    const result = await checkTasks({ repoRoot: repo, runId: "check-guarded", tasks: [guarded], setup: [], concurrency: 1 });
    expect(result.passedByDoingNothing).toEqual([]);
  });

  it("fails before anything is spent when the project's setup is broken", async () => {
    await expect(
      checkTasks({ repoRoot: repo, runId: "check-setup", tasks, setup: ["exit 7"], concurrency: 1 })
    ).rejects.toThrow(/task add-(greet|farewell): setup command failed \(exit 7\)/);
    expect(await worktreeCount()).toBe(1);
  });
});
