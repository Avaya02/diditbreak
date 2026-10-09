import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ClaudeCodeAdapter } from "../src/agents/claude-code.js";
import { AgentUnavailableError } from "../src/agents/errors.js";
import { DEFAULT_SETTINGS } from "../src/config.js";
import type { AgentRunInput } from "../src/types.js";

let dir: string;
const fixture = fileURLToPath(new URL("./fixtures/claude-skill-run.jsonl", import.meta.url));
const authRetry = fileURLToPath(new URL("./fixtures/claude-auth-retry.jsonl", import.meta.url));

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  );

async function fakeBinary(name: string, script: string): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, `#!/bin/sh\n${script}\n`);
  await chmod(path, 0o755);
  return path;
}

function input(overrides: Partial<AgentRunInput> = {}): AgentRunInput {
  return {
    cwd: dir,
    prompt: "Write a haiku",
    config: DEFAULT_SETTINGS.agent,
    timeoutMs: 10_000,
    transcriptPath: join(dir, "out", "transcript.jsonl"),
    trial: 1,
    context: { paths: [], text: "" },
    ...overrides
  };
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "diditbreak-claude-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("ClaudeCodeAdapter", () => {
  it("streams the transcript to disk and parses it", async () => {
    const binary = await fakeBinary("claude-ok", `cat "${fixture}"`);
    const result = await new ClaudeCodeAdapter(binary).run(input());

    expect(result.completed).toBe(true);
    expect(result.skillsUsed).toEqual(["haiku-writer"]);
    expect(await readFile(join(dir, "out", "transcript.jsonl"), "utf-8")).toContain('"type":"result"');
  });

  it("passes the headless flags and strips nesting variables", async () => {
    const binary = await fakeBinary(
      "claude-echo",
      `printf '%s\\n' "$@" > "${dir}/args.txt"; env > "${dir}/env.txt"; cat "${fixture}"`
    );
    process.env.CLAUDECODE = "1";
    try {
      await new ClaudeCodeAdapter(binary).run(input());
    } finally {
      delete process.env.CLAUDECODE;
    }

    const args = (await readFile(join(dir, "args.txt"), "utf-8")).split("\n");
    expect(args[0]).toBe("-p");
    expect(args[1]).toBe("Write a haiku");
    expect(args).toContain("--no-session-persistence");
    expect(await readFile(join(dir, "env.txt"), "utf-8")).not.toMatch(/^CLAUDECODE=/m);
  });

  it("kills a run that exceeds its timeout, and counts it against the agent", async () => {
    const binary = await fakeBinary("claude-hang", "sleep 30");
    const started = Date.now();
    const result = await new ClaudeCodeAdapter(binary).run(input({ timeoutMs: 300 }));

    expect(result.completed).toBe(false);
    expect(result.error).toMatch(/timed out/);
    expect(result.infraError).toBe(false);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("explains a missing binary instead of crashing", async () => {
    const result = await new ClaudeCodeAdapter(join(dir, "does-not-exist")).run(input());
    expect(result.completed).toBe(false);
    expect(result.infraError).toBe(true);
    expect(result.error).toMatch(/not found.*DIDITBREAK_CLAUDE_BIN/);
  });

  it("stops at the first failed authentication instead of waiting out ten retries", async () => {
    // Real Claude Code keeps retrying a rejected key for about three minutes.
    const binary = await fakeBinary("claude-bad-key", `cat "${authRetry}"; sleep 30`);
    const started = Date.now();
    const result = await new ClaudeCodeAdapter(binary).run(input());

    expect(Date.now() - started).toBeLessThan(5000);
    expect(result.infraError).toBe(true);
    expect(result.error).toMatch(/authentication failed/);
  });

  it("stops the agent and everything it started when interrupted", async () => {
    const marker = join(dir, "still-running");
    const binary = await fakeBinary("claude-slow", `(sleep 1 && touch "${marker}") & sleep 30`);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);

    const started = Date.now();
    const result = await new ClaudeCodeAdapter(binary).run(input({ signal: controller.signal }));

    expect(Date.now() - started).toBeLessThan(5000);
    expect(result.error).toBe("interrupted");
    // The background child was in the agent's process group, so it died too.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await exists(marker)).toBe(false);
  });

  it("surfaces stderr when the agent dies without a result", async () => {
    const binary = await fakeBinary("claude-crash", 'echo "Error: invalid API key" >&2; exit 1');
    const result = await new ClaudeCodeAdapter(binary).run(input());
    expect(result.error).toMatch(/invalid API key/);
  });
});

describe("ClaudeCodeAdapter.preflight", () => {
  const cli = (authStatus: string, authExit = 0) =>
    fakeBinary(
      `claude-pre-${Math.random().toString(36).slice(2)}`,
      `case "$1" in
  --version) echo "2.1.202 (Claude Code)" ;;
  auth) echo '${authStatus}'; exit ${authExit} ;;
esac`
    );

  it("reports the version when Claude Code is installed and logged in", async () => {
    const binary = await cli('{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty"}');
    expect(await new ClaudeCodeAdapter(binary).preflight()).toEqual({ version: "2.1.202" });
  });

  it("refuses to start when Claude Code is logged out", async () => {
    const binary = await cli('{"loggedIn":false,"authMethod":"none","apiProvider":"firstParty"}', 1);
    await expect(new ClaudeCodeAdapter(binary).preflight()).rejects.toThrow(/not logged in/);
  });

  it("leaves other providers alone, which authenticate outside Claude Code", async () => {
    const binary = await cli('{"loggedIn":false,"apiProvider":"bedrock"}', 1);
    await expect(new ClaudeCodeAdapter(binary).preflight()).resolves.toEqual({ version: "2.1.202" });
  });

  it("tolerates versions without `auth status`", async () => {
    const binary = await cli("error: unknown command auth", 1);
    await expect(new ClaudeCodeAdapter(binary).preflight()).resolves.toEqual({ version: "2.1.202" });
  });

  it("explains a missing binary with how to install it", async () => {
    const error = await new ClaudeCodeAdapter(join(dir, "nope")).preflight().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AgentUnavailableError);
    expect((error as AgentUnavailableError).message).toMatch(/not found/);
    expect((error as AgentUnavailableError).hint).toMatch(/npm install -g @anthropic-ai\/claude-code/);
  });
});
