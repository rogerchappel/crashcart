import { spawn } from "node:child_process";
import type { CapturedCommand } from "./types.js";

export async function captureCommand(argv: string[], cwd: string, timeoutMs: number): Promise<CapturedCommand> {
  if (argv.length === 0) {
    throw new Error("No command provided after --");
  }

  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();

  return await new Promise((resolve, reject) => {
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        stderr += `\ncrashcart: command timed out after ${timeoutMs}ms\n`;
      }
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
    });
  });
}
