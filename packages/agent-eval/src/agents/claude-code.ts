import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

import { stopProcessGroup } from "../sandbox/shell.js";
import type { AgentAdapter, AgentRunInput, AgentRunResult } from "../types.js";
import { AgentUnavailableError } from "./errors.js";
import { fatalApiError, parseClaudeStream } from "./parse-claude-stream.js";

const exec = promisify(execFile);

/** An empty MCP config; with --strict-mcp-config it shuts out personal servers. */
const NO_MCP_SERVERS = JSON.stringify({ mcpServers: {} });

export function buildClaudeArgs(input: AgentRunInput): string[] {
  const { config } = input;
  const args = [
    "-p",
    input.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    // Experiments must not litter the user's session history or be resumable.
    "--no-session-persistence",
    // Project settings only: personal hooks, permissions and env from
    // ~/.claude/settings.json would otherwise change behaviour per machine.
    "--setting-sources",
    "project",
    "--max-turns",
    String(config.maxTurns),
    "--max-budget-usd",
    String(config.maxBudgetUsd),
    "--permission-mode",
    config.permissionMode
  ];

  if (config.model !== undefined) {
    args.push("--model", config.model);
  }

  if (config.allowedTools.length > 0) {
    args.push("--allowedTools", ...config.allowedTools);
  }

  if (config.isolateMcp) {
    args.push("--strict-mcp-config", "--mcp-config", NO_MCP_SERVERS);
  }

  return args;
}

/**
 * Environment for the child agent. Claude Code refuses to start inside another
 * Claude Code session, and diditbreak itself is often run from one.
 */
export function childEnvironment(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...parent };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

const INSTALL_HINT = "Install Claude Code (npm install -g @anthropic-ai/claude-code), or set DIDITBREAK_CLAUDE_BIN to its path.";

interface ProcessOutcome {
  code: number | null;
  timedOut: boolean;
  interrupted: boolean;
  /** Why the run was stopped early because it could not succeed. */
  fatal?: string;
  spawnError?: string;
  stderr: string;
}

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly name = "claude-code" as const;
  private readonly binary: string;

  constructor(binary = process.env.DIDITBREAK_CLAUDE_BIN ?? "claude") {
    this.binary = binary;
  }

  /**
   * Free checks before anything is spent: the binary runs, and it is not
   * plainly logged out. An invalid key still reports itself as logged in; the
   * run catches that at the first failed API call.
   */
  async preflight(): Promise<{ version?: string }> {
    const env = childEnvironment(process.env);
    let version: string | undefined;
    try {
      const { stdout } = await exec(this.binary, ["--version"], { env, timeout: 30_000 });
      version = /\d+\.\d+\.\d+/.exec(stdout)?.[0];
    } catch (error) {
      const failure = error as NodeJS.ErrnoException & { stderr?: string };
      if (failure.code === "ENOENT") {
        throw new AgentUnavailableError(`Claude Code not found ("${this.binary}").`, INSTALL_HINT);
      }
      const detail = failure.stderr?.trim().split("\n").at(-1) ?? failure.message;
      throw new AgentUnavailableError(`"${this.binary} --version" failed: ${detail}`, INSTALL_HINT);
    }

    // Older versions lack `auth status`; only a clear "logged out" blocks. Other
    // providers (Bedrock, Vertex) authenticate outside Claude Code, so are left alone.
    const status = await exec(this.binary, ["auth", "status", "--json"], { env, timeout: 30_000 }).then(
      (result) => result.stdout,
      (error: { stdout?: string }) => error.stdout ?? ""
    );
    let auth: { loggedIn?: boolean; apiProvider?: string } = {};
    try {
      auth = JSON.parse(status) as typeof auth;
    } catch {
      // Not JSON: an older version. The first run will report auth problems.
    }
    if (auth.loggedIn === false && (auth.apiProvider === undefined || auth.apiProvider === "firstParty")) {
      throw new AgentUnavailableError(
        "Claude Code is not logged in.",
        "Run `claude` once and log in, or set ANTHROPIC_API_KEY."
      );
    }

    return version !== undefined ? { version } : {};
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    await mkdir(dirname(input.transcriptPath), { recursive: true });
    const transcript = createWriteStream(input.transcriptPath);
    const started = Date.now();

    const outcome = await new Promise<ProcessOutcome>((resolvePromise) => {
      if (input.signal?.aborted) {
        resolvePromise({ code: null, timedOut: false, interrupted: true, stderr: "" });
        return;
      }

      const child = spawn(this.binary, buildClaudeArgs(input), {
        cwd: input.cwd,
        env: childEnvironment(process.env),
        // Closed stdin: an open pipe makes headless Claude wait for input.
        stdio: ["ignore", "pipe", "pipe"],
        // Own process group, so every tool process it starts dies with it. It
        // also means a terminal's Ctrl-C never reaches it: see onAbort.
        detached: true
      });
      let closed = false;
      const stop = (): void => stopProcessGroup(child, () => closed);

      let stderr = "";
      let pending = "";
      let fatal: string | undefined;
      child.stdout.pipe(transcript);
      child.stdout.on("data", (chunk: Buffer) => {
        if (fatal !== undefined) {
          return;
        }
        const lines = (pending + chunk.toString("utf-8")).split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          fatal = fatalApiError(line) ?? undefined;
          if (fatal !== undefined) {
            stop();
            return;
          }
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = (stderr + chunk.toString("utf-8")).slice(-4000);
      });

      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        stop();
      }, input.timeoutMs);

      let interrupted = false;
      const onAbort = (): void => {
        interrupted = true;
        stop();
      };
      input.signal?.addEventListener("abort", onAbort, { once: true });

      const finish = (result: Omit<ProcessOutcome, "timedOut" | "interrupted" | "fatal" | "stderr">): void => {
        clearTimeout(timer);
        input.signal?.removeEventListener("abort", onAbort);
        resolvePromise({ ...result, timedOut, interrupted, stderr, ...(fatal !== undefined ? { fatal } : {}) });
      };

      child.on("error", (error) => {
        closed = true;
        finish({ code: null, spawnError: error.message });
      });
      child.on("close", (code) => {
        closed = true;
        finish({ code });
      });
    });

    await new Promise<void>((resolvePromise) => transcript.end(resolvePromise));

    if (outcome.spawnError) {
      const notFound = /ENOENT/.test(outcome.spawnError);
      return failure(notFound ? `Claude Code not found ("${this.binary}"). ${INSTALL_HINT}` : outcome.spawnError, Date.now() - started);
    }

    const parsed = parseClaudeStream(await readFile(input.transcriptPath, "utf-8").catch(() => ""));
    const elapsed = Date.now() - started;

    if (outcome.interrupted) {
      return { ...parsed, completed: false, error: "interrupted", infraError: true, durationMs: elapsed };
    }

    if (outcome.fatal !== undefined) {
      return { ...parsed, completed: false, error: outcome.fatal, infraError: true, durationMs: elapsed };
    }

    if (outcome.timedOut) {
      // Too slow is the agent's own failure, unlike the cases above.
      return {
        ...parsed,
        completed: false,
        error: `timed out after ${Math.round(input.timeoutMs / 1000)}s`,
        infraError: false,
        durationMs: elapsed
      };
    }

    if (!parsed.completed && parsed.error?.startsWith("the agent exited") && outcome.stderr.trim()) {
      return { ...parsed, error: `${parsed.error}: ${outcome.stderr.trim().split("\n").slice(-3).join(" ")}` };
    }

    return { ...parsed, durationMs: parsed.durationMs || elapsed };
  }
}

function failure(error: string, durationMs: number): AgentRunResult {
  return {
    completed: false,
    error,
    infraError: true,
    finalMessage: "",
    turns: 0,
    durationMs,
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
