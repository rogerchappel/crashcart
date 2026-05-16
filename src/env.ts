import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolVersion } from "./types.js";

const execFileAsync = promisify(execFile);

async function versionFor(command: string, args = ["--version"]): Promise<ToolVersion> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 2000 });
    return { name: command, version: (stdout || stderr).trim().split("\n")[0] ?? null };
  } catch {
    return { name: command, version: null };
  }
}

export async function getToolVersions(): Promise<ToolVersion[]> {
  return await Promise.all([
    versionFor("npm", ["--version"]),
    versionFor("pnpm", ["--version"]),
    versionFor("yarn", ["--version"]),
    versionFor("git", ["--version"]),
    versionFor("tsc", ["--version"])
  ]);
}
