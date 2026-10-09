import { spawn, type ChildProcess } from "node:child_process";

export interface ShellResult {
  exitCode: number;
  /** Tail of combined stdout and stderr. */
  output: string;
  timedOut: boolean;
}

const OUTPUT_TAIL_BYTES = 4000;

/** Exit code reported for a command stopped by an interrupt, as shells do for SIGINT. */
export const INTERRUPTED_EXIT_CODE = 130;

/** Kills a detached child's whole process group, falling back to the child alone. */
function killGroup(child: ChildProcess): void {
  try {
    process.kill(-child.pid!, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

/**
 * Kills a detached child's process group, then keeps killing it until its
 * output closes. One kill is not enough: a process the group forks at that
 * instant can miss the signal, survive, and hold the output pipe open, so the
 * caller would wait for it (a test watcher or dev server: forever).
 */
export function stopProcessGroup(child: ChildProcess, closed: () => boolean): void {
  killGroup(child);
  const retry = setInterval(() => (closed() ? clearInterval(retry) : killGroup(child)), 200);
  retry.unref();
}

/**
 * Runs a shell command with a hard timeout, keeping only the tail of output:
 * a failing test suite can print megabytes, and the end is where the reason is.
 */
export function runShell(
  command: string,
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<ShellResult> {
  if (signal?.aborted) {
    return Promise.resolve({ exitCode: INTERRUPTED_EXIT_CODE, output: "[interrupted]", timedOut: false });
  }

  return new Promise((resolvePromise) => {
    const child = spawn("sh", ["-c", command], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      // Own process group, so a timeout can kill the whole tree, not just sh.
      detached: true
    });

    let output = "";
    const append = (chunk: Buffer): void => {
      output = (output + chunk.toString("utf-8")).slice(-OUTPUT_TAIL_BYTES);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);

    let closed = false;
    const stop = (): void => stopProcessGroup(child, () => closed);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);

    // The child has its own process group, so a terminal's Ctrl-C never
    // reaches it: it has to be killed explicitly.
    let interrupted = false;
    const onAbort = (): void => {
      interrupted = true;
      stop();
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    const finish = (result: ShellResult): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolvePromise(result);
    };

    child.on("close", (code) => {
      closed = true;
      if (interrupted) {
        finish({ exitCode: INTERRUPTED_EXIT_CODE, output: `${output}\n[interrupted]`, timedOut: false });
        return;
      }
      finish({
        exitCode: timedOut ? 124 : (code ?? 1),
        output: timedOut ? `${output}\n[timed out after ${timeoutMs}ms]` : output,
        timedOut
      });
    });

    child.on("error", (error) => {
      closed = true;
      finish({ exitCode: 127, output: error.message, timedOut: false });
    });
  });
}
