import type { AgentEnvironment, AgentRunResult, ToolCall } from "../types.js";

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface ContentBlock {
  type?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
}

interface StreamEvent {
  type?: string;
  subtype?: string;
  // init
  model?: string;
  claude_code_version?: string;
  skills?: string[];
  agents?: string[];
  mcp_servers?: Array<{ name?: string }>;
  // assistant
  message?: { id?: string; content?: ContentBlock[]; usage?: Usage };
  // api_retry: Claude Code retrying a failed model API call
  error?: string;
  error_status?: number;
  // result
  is_error?: boolean;
  /** Set when the run ended because the model API failed. */
  api_error_status?: number;
  num_turns?: number;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: Usage;
  result?: string;
  permission_denials?: unknown[];
}

/**
 * API errors that retrying cannot fix within a run. Claude Code retries them
 * anyway (10 attempts with backoff, about three minutes for a bad key), so the
 * adapter watches for them and stops the run at the first one.
 */
const FATAL_API_ERRORS: Record<string, string> = {
  authentication_failed: "authentication failed: check ANTHROPIC_API_KEY, or run `claude` once to log in",
  billing_error: "the account cannot be billed: check its credits or plan"
};

function describeApiError(error: string | undefined, status: number | undefined): string {
  const known = error !== undefined ? FATAL_API_ERRORS[error] : undefined;
  const code = status !== undefined ? ` (HTTP ${status})` : "";
  return `model API error${code}: ${known ?? error ?? "request failed"}`;
}

/**
 * Returns why a stream line means the run cannot succeed, or null. Takes a raw
 * line so the adapter can check output as it arrives.
 */
export function fatalApiError(line: string): string | null {
  if (!line.includes('"api_retry"')) {
    return null;
  }
  let event: StreamEvent;
  try {
    event = JSON.parse(line) as StreamEvent;
  } catch {
    return null;
  }
  if (event.type !== "system" || event.subtype !== "api_retry") {
    return null;
  }
  const fatal =
    (event.error !== undefined && event.error in FATAL_API_ERRORS) ||
    event.error_status === 401 ||
    event.error_status === 403;
  return fatal ? describeApiError(event.error, event.error_status) : null;
}

function promptTokens(usage: Usage | undefined): number {
  if (!usage) {
    return 0;
  }
  return (
    (usage.input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  );
}

/**
 * Turns Claude Code's `--output-format stream-json` transcript into a result.
 *
 * Pure, so it is tested against real captured transcripts. Assistant messages
 * arrive as several events sharing one message id (one per content block), so
 * tool calls are de-duplicated by block id and token usage by message id.
 */
export function parseClaudeStream(jsonl: string): AgentRunResult {
  const events: StreamEvent[] = [];
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      events.push(JSON.parse(line) as StreamEvent);
    } catch {
      // A truncated final line (the process was killed mid-write) is expected.
    }
  }

  const init = events.find((event) => event.type === "system" && event.subtype === "init");
  const environment: AgentEnvironment = {
    ...(init?.model !== undefined ? { model: init.model } : {}),
    ...(init?.claude_code_version !== undefined ? { version: init.claude_code_version } : {}),
    skillsLoaded: init?.skills ?? [],
    mcpServers: (init?.mcp_servers ?? []).map((server) => server.name ?? "").filter(Boolean),
    agents: init?.agents ?? []
  };

  const toolCalls: ToolCall[] = [];
  const seenBlocks = new Set<string>();
  const seenMessages = new Set<string>();
  let contextTokens: number | null = null;
  let lastText = "";

  for (const event of events) {
    if (event.type !== "assistant" || !event.message) {
      continue;
    }

    const messageId = event.message.id;
    if (messageId && !seenMessages.has(messageId)) {
      seenMessages.add(messageId);
      // The first model call's prompt is the context carried before any work.
      if (contextTokens === null && event.message.usage) {
        contextTokens = promptTokens(event.message.usage);
      }
    }

    for (const block of event.message.content ?? []) {
      if (block.type === "text" && block.text) {
        lastText = block.text;
      }
      if (block.type !== "tool_use" || !block.name) {
        continue;
      }
      const key = block.id ?? `${messageId}:${toolCalls.length}`;
      if (seenBlocks.has(key)) {
        continue;
      }
      seenBlocks.add(key);
      toolCalls.push({ name: block.name, input: block.input ?? {} });
    }
  }

  const skillsUsed = toolCalls
    .filter((call) => call.name === "Skill" && typeof call.input.skill === "string")
    .map((call) => call.input.skill as string);

  const commands = toolCalls
    .filter((call) => call.name === "Bash" && typeof call.input.command === "string")
    .map((call) => call.input.command as string);

  const result = events.find((event) => event.type === "result");

  if (!result) {
    // Stopped at a fatal retry (by the adapter), or crashed: either way the
    // agent never got a fair attempt at the task.
    const retry = [...events].reverse().find((event) => event.type === "system" && event.subtype === "api_retry");
    const fatal = retry ? fatalApiError(JSON.stringify(retry)) : null;
    return {
      completed: false,
      error: fatal ?? "the agent exited without a result (crashed, or was killed)",
      infraError: true,
      finalMessage: lastText,
      turns: seenMessages.size,
      durationMs: 0,
      costUsd: null,
      inputTokens: 0,
      outputTokens: 0,
      contextTokens,
      toolCalls,
      skillsUsed,
      commands,
      permissionDenials: 0,
      environment
    };
  }

  const succeeded = result.subtype === "success" && result.is_error !== true;
  const apiFailed = !succeeded && result.api_error_status !== undefined;
  const resultText = typeof result.result === "string" ? result.result.trim().split("\n")[0]! : "";

  let error: string | undefined;
  if (apiFailed) {
    const retry = [...events].reverse().find((event) => event.type === "system" && event.subtype === "api_retry");
    error = retry?.error !== undefined && retry.error in FATAL_API_ERRORS
      ? describeApiError(retry.error, result.api_error_status)
      : `model API error (HTTP ${result.api_error_status})${resultText ? `: ${resultText}` : ""}`;
  } else if (!succeeded) {
    // Subtypes such as error_max_turns name the limit that stopped the agent;
    // an error reported under "success" carries its reason in the result text.
    error = result.subtype !== undefined && result.subtype !== "success" ? result.subtype : resultText || "error";
  }

  return {
    completed: succeeded,
    ...(error !== undefined ? { error } : {}),
    ...(apiFailed ? { infraError: true } : {}),
    finalMessage: typeof result.result === "string" ? result.result : lastText,
    turns: result.num_turns ?? seenMessages.size,
    durationMs: result.duration_ms ?? 0,
    costUsd: typeof result.total_cost_usd === "number" ? result.total_cost_usd : null,
    inputTokens: promptTokens(result.usage),
    outputTokens: result.usage?.output_tokens ?? 0,
    contextTokens,
    toolCalls,
    skillsUsed,
    commands,
    permissionDenials: result.permission_denials?.length ?? 0,
    environment
  };
}
