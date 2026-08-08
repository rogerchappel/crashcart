import { spawn } from "node:child_process";
import type { CapturedCommand } from "./types.js";

const TERMINATION_GRACE_MS = 250;

export async function captureCommand(argv: string[], cwd: string, timeoutMs: number): Promise<CapturedCommand> {
  if (argv.length === 0) {
    throw new Error("No command provided after --");
  }

  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  return await new Promise((resolve) => {
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let escalationTimer: NodeJS.Timeout | undefined;

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
      clearTimeout(timer);
      if (escalationTimer) clearTimeout(escalationTimer);
      const finishedAtMs = Date.now();
      resolve({
        command: argv,
        cwd,
        startedAt,
        finishedAt: new Date(finishedAtMs).toISOString(),
        durationMs: finishedAtMs - startedAtMs,
        exitCode,
        signal,
        stdout,
        stderr
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      escalationTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, TERMINATION_GRACE_MS);
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      stderr += `crashcart: failed to spawn command: ${error.message}\n`;
      finish(127, null);
    });
    child.on("close", (exitCode, signal) => {
      if (timedOut) {
        stderr += `\ncrashcart: command timed out after ${timeoutMs}ms; sent SIGTERM and escalated to SIGKILL after ${TERMINATION_GRACE_MS}ms if still running\n`;
      }
      finish(exitCode, signal);
    });
  });
}
