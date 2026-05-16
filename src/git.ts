import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitSummary } from "./types.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd, timeout: 2000 });
  return stdout.trim();
}

export async function getGitSummary(cwd: string): Promise<GitSummary> {
  try {
    const [branch, commit, status] = await Promise.all([
      git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
      git(cwd, ["rev-parse", "--short", "HEAD"]),
      git(cwd, ["status", "--short"])
    ]);
    return {
      available: true,
      branch,
      commit,
      dirty: status.length > 0,
      status
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
