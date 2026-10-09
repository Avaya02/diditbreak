import { execFile } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import chalk from "chalk";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { runAblateCommand, runCompareCommand } from "./experiment-command.js";

const exec = promisify(execFile);

let repo: string;
let originalCwd: string;
let out: string[];
let err: string[];
let originalLevel: typeof chalk.level;

const CLAUDE_MD = "# Demo\n\n## Commands\nRun tests with `node --test`. No dependencies.\n\n## Style\nTwo-space indent.\n";
const BAD_SECTION = "\n## Wiki\nAll tests must use Jest.\n";

function taskYaml(file: string): string {
  return `prompt: Create ${file}.
verify: test -f ${file}
checks:
  must_change: ${file}
  forbid_commands: npm install
mock:
  files: { "${file}": "export {};\\n" }
  requires: node --test
  breaks_on: Jest
  commands:
    - run: npm install --save-dev jest
      when: Jest
`;
}

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), "diditbreak-cli-exp-"));
  await mkdir(join(repo, ".diditbreak/tasks"), { recursive: true });
  await writeFile(join(repo, "CLAUDE.md"), CLAUDE_MD);
  await writeFile(join(repo, ".diditbreak/tasks/a.yaml"), taskYaml("a.js"));
  await writeFile(join(repo, ".diditbreak/tasks/b.yaml"), taskYaml("b.js"));
  await writeFile(join(repo, "diditbreak.config.ts"), "export default { agent: { name: 'mock' }, tasks: { trials: 2 } };\n");
  const git = (...args: string[]) => exec("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: repo });
  await git("init", "-q");
  await git("add", "-A");
  await git("commit", "-qm", "init");
  await writeFile(join(repo, "CLAUDE.md"), CLAUDE_MD + BAD_SECTION);
});

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
});

beforeEach(() => {
  originalCwd = process.cwd();
  process.chdir(repo);
  out = [];
  err = [];
  originalLevel = chalk.level;
  chalk.level = 0;
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => out.push(args.join(" ")));
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => err.push(args.join(" ")));
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    out.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  process.chdir(originalCwd);
  chalk.level = originalLevel;
  vi.restoreAllMocks();
});

describe("diditbreak compare", () => {
  it("reports the working-tree edit as worse and exits 1 to fail CI", async () => {
    expect(await runCompareCommand({ setups: [], yes: true })).toBe(1);

    const report = out.join("\n");
    expect(report).toMatch(/none\s+0\/4/);
    expect(report).toMatch(/HEAD\s+4\/4\s+100%/);
    expect(report).toMatch(/working\s+0\/4/);
    expect(report).toMatch(/working\s+−100 pts.*worse/);
    expect(report).toMatch(/forbid_command npm install\s+none 0\/4\s+HEAD 0\/4\s+working 4\/4/);
    expect(report).toContain("simulated");
  });

  it("exits 0 when the change is not worse", async () => {
    // HEAD against itself: identical context, identical results.
    expect(await runCompareCommand({ setups: ["HEAD", "HEAD~0"], baseline: false, yes: true })).toBe(0);
  });

  it("prints a machine-readable summary with --json", async () => {
    expect(await runCompareCommand({ setups: ["HEAD", "working"], baseline: false, json: true, yes: true })).toBe(1);

    const report = JSON.parse(out.join(""));
    expect(report.schemaVersion).toBe(1);
    expect(report.summary.reference).toBe("HEAD");
    expect(report.summary.comparisons[0]).toMatchObject({ variant: "working", verdict: "worse" });
    expect(await readFile(join(repo, report.resultsPath), "utf-8")).toContain('"schemaVersion": 1');
  });

  it("keeps run artifacts out of git without touching .gitignore", async () => {
    await runCompareCommand({ setups: ["HEAD"], baseline: false, yes: true });
    expect(await readFile(join(repo, ".diditbreak/runs/.gitignore"), "utf-8")).toBe("*\n");
    const { stdout } = await exec("git", ["status", "--porcelain"], { cwd: repo });
    expect(stdout).not.toContain(".diditbreak/runs");
  });

  it("rejects an unknown git ref before spending anything", async () => {
    expect(await runCompareCommand({ setups: ["no-such-branch"], yes: true })).toBe(2);
    expect(err.join("\n")).toMatch(/Unknown git ref "no-such-branch"/);
  });

  it("explains a missing task directory", async () => {
    expect(await runCompareCommand({ setups: [], tasks: "nope", yes: true })).toBe(2);
    expect(err.join("\n")).toMatch(/task directory not found/);
  });

  it("refuses to run outside a git repository", async () => {
    const outside = await mkdtemp(join(tmpdir(), "diditbreak-nogit-"));
    process.chdir(outside);
    try {
      expect(await runCompareCommand({ setups: [], yes: true })).toBe(2);
      expect(err.join("\n")).toMatch(/Not inside a git repository/);
    } finally {
      process.chdir(repo);
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("asks for confirmation before real agent runs when not interactive", async () => {
    expect(await runCompareCommand({ setups: [], agent: "claude-code" })).toBe(2);
    expect(err.join("\n")).toMatch(/--yes/);
  });
});

describe("diditbreak ablate", () => {
  it("names the section whose removal fixes the agent", async () => {
    expect(await runAblateCommand({ yes: true })).toBe(0);

    const report = out.join("\n");
    expect(report).toMatch(/no-section-Wiki\s+\+100 pts.*better/);
    expect(report).toContain("removes CLAUDE.md › Wiki");
    expect(report).toMatch(/no-section-Style\s+±0 pts.*no clear difference/);
  });

  it("explains when there is nothing to remove", async () => {
    expect(await runAblateCommand({ file: "MISSING.md", skills: false, yes: true })).toBe(2);
    expect(err.join("\n")).toMatch(/Nothing to remove/);
  });
});

describe("when the agent cannot run", () => {
  let bin: string;
  const original = process.env.DIDITBREAK_CLAUDE_BIN;

  beforeAll(async () => {
    bin = await mkdtemp(join(tmpdir(), "diditbreak-fake-claude-"));
  });

  afterAll(async () => {
    await rm(bin, { recursive: true, force: true });
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DIDITBREAK_CLAUDE_BIN;
    } else {
      process.env.DIDITBREAK_CLAUDE_BIN = original;
    }
  });

  /** A stand-in `claude` that passes the preflight, then runs `body` for each agent run. */
  async function fakeClaude(name: string, body: string): Promise<string> {
    const path = join(bin, name);
    await writeFile(
      path,
      `#!/bin/sh
case "$1" in
  --version) echo "2.1.202 (Claude Code)"; exit 0 ;;
  auth) echo '{"loggedIn":true,"apiProvider":"firstParty"}'; exit 0 ;;
esac
${body}
`
    );
    await chmod(path, 0o755);
    process.env.DIDITBREAK_CLAUDE_BIN = path;
    return path;
  }

  async function runDirs(): Promise<string[]> {
    return (await readdir(join(repo, ".diditbreak/runs")).catch(() => [] as string[])).filter((name) => !name.startsWith("."));
  }

  async function worktrees(): Promise<number> {
    const { stdout } = await exec("git", ["worktree", "list"], { cwd: repo });
    return stdout.trim().split("\n").length;
  }

  it("refuses to start without Claude Code, before spending anything", async () => {
    process.env.DIDITBREAK_CLAUDE_BIN = join(bin, "not-installed");
    const before = await runDirs();

    expect(await runCompareCommand({ setups: [], agent: "claude-code", yes: true })).toBe(2);
    expect(err.join("\n")).toMatch(/Claude Code not found/);
    expect(err.join("\n")).toMatch(/npm install -g @anthropic-ai\/claude-code/);
    expect(await runDirs()).toEqual(before);
  });

  it("gives no verdict, and exits 2, when the API key is rejected", async () => {
    // What Claude Code 2.1.202 prints with a bad key, before retrying for three minutes.
    await fakeClaude(
      "claude-bad-key",
      `echo '{"type":"system","subtype":"init","claude_code_version":"2.1.202","skills":[],"agents":[],"mcp_servers":[]}'
echo '{"type":"system","subtype":"api_retry","attempt":1,"max_retries":10,"error_status":401,"error":"authentication_failed"}'
sleep 30`
    );

    const started = Date.now();
    expect(await runCompareCommand({ setups: [], agent: "claude-code", yes: true })).toBe(2);

    expect(Date.now() - started).toBeLessThan(20_000);
    const messages = err.join("\n");
    expect(messages).toMatch(/No verdict: stopped early because runs could not start: .*authentication failed/);
    expect(messages).toMatch(/Check ANTHROPIC_API_KEY/);
    expect(out.join("\n")).toMatch(/Could not run/);
    expect(out.join("\n")).not.toMatch(/better|worse|no clear difference/);
    expect(await worktrees()).toBe(1);
  });

  it("reports the problem in --json too", async () => {
    await fakeClaude("claude-crash", "exit 1");

    expect(await runCompareCommand({ setups: ["HEAD"], baseline: false, agent: "claude-code", yes: true, json: true })).toBe(2);
    const report = JSON.parse(out.join(""));
    expect(report.status).toBe("stopped");
    expect(report.problems[0]).toMatch(/could not start: the agent exited without a result/);
  });

  it("stops running agents on Ctrl-C, cleans up and keeps a readable result", async () => {
    const started = join(bin, "agent-started");
    await fakeClaude("claude-slow", `touch "${started}"; sleep 30`);
    const controller = new AbortController();

    const running = runCompareCommand({ setups: ["HEAD"], baseline: false, agent: "claude-code", yes: true, signal: controller.signal });
    const deadline = Date.now() + 15_000;
    while (!(await access(started).then(() => true, () => false))) {
      if (Date.now() > deadline) {
        throw new Error("the fake agent never started");
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    controller.abort();

    expect(await running).toBe(130);
    expect(out.join("\n")).toMatch(/0 of 4 runs/);
    expect(out.join("\n")).toMatch(/Interrupted: the numbers cover only the runs that finished/);
    expect(out.join("\n")).not.toMatch(/no clear difference/);
    expect(err.join("\n")).toMatch(/Interrupted after 0 of 4 runs/);
    expect(await worktrees()).toBe(1);

    const latest = (await runDirs()).sort().at(-1)!;
    const saved = JSON.parse(await readFile(join(repo, ".diditbreak/runs", latest, "results.json"), "utf-8"));
    expect(saved).toMatchObject({ status: "interrupted", plannedRuns: 4, results: [] });
  });
});

describe("checks before spending", () => {
  it("warns about a task an agent that does nothing would pass", async () => {
    const vacuous = join(repo, ".diditbreak/tasks/vacuous.yaml");
    await writeFile(vacuous, "prompt: Improve the code.\nverify: test -f CLAUDE.md\n");
    try {
      await runCompareCommand({ setups: ["HEAD"], baseline: false, yes: true });
      expect(err.join("\n")).toMatch(/Task "vacuous" passes even if the agent changes nothing/);

      await runCompareCommand({ setups: ["HEAD"], baseline: false, yes: true, json: true });
      expect(JSON.parse(out.at(-1)!).warnings).toEqual([expect.stringMatching(/Task "vacuous"/)]);
    } finally {
      await rm(vacuous);
    }
  });

  it("stops with exit 2 when the project's setup fails in a fresh sandbox", async () => {
    const config = join(repo, "diditbreak.config.ts");
    const original = await readFile(config, "utf-8");
    await writeFile(config, "export default { agent: { name: 'mock' }, tasks: { trials: 2, setup: ['npm ci --nope'] } };\n");
    try {
      expect(await runCompareCommand({ setups: [], yes: true })).toBe(2);
      // Tasks are checked in parallel, so either may be the one reported.
      expect(err.join("\n")).toMatch(/Could not prepare a sandbox for task [ab]: setup command failed/);
    } finally {
      await writeFile(config, original);
    }
  });
});
