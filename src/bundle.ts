import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { classifyFailure } from "./classifier.js";
import { getToolVersions } from "./env.js";
import { getGitSummary } from "./git.js";
import { loadRedactionRules, redactText } from "./redact.js";
import type { CapturedCommand, CrashcartBundle, RedactionFinding, RunOptions } from "./types.js";

export const TRUNCATION_MARKER = "\n[... crashcart truncated log output ...]\n";
export const MIN_MAX_BYTES = Buffer.byteLength(TRUNCATION_MARKER, "utf8");

function mergeFindings(...groups: RedactionFinding[][]): RedactionFinding[] {
  const counts = new Map<string, number>();
  for (const group of groups) {
    for (const finding of group) {
      counts.set(finding.label, (counts.get(finding.label) ?? 0) + finding.count);
    }
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

export function truncateMiddle(input: string, maxBytes: number): { text: string; truncated: boolean } {
  const bytes = Buffer.byteLength(input, "utf8");
  if (bytes <= maxBytes) return { text: input, truncated: false };
  if (!Number.isSafeInteger(maxBytes) || maxBytes < MIN_MAX_BYTES) {
    throw new RangeError(`maxBytes must be an integer of at least ${MIN_MAX_BYTES}`);
  }
  const half = Math.floor((maxBytes - MIN_MAX_BYTES) / 2);
  const buffer = Buffer.from(input);
  let startBytes = half;
  let endBytes = half;
  let text: string;
  do {
    const start = buffer.subarray(0, startBytes).toString("utf8");
    const end = buffer.subarray(bytes - endBytes).toString("utf8");
    text = start + TRUNCATION_MARKER + end;
    if (Buffer.byteLength(text, "utf8") <= maxBytes) break;
    if (startBytes >= endBytes && startBytes > 0) startBytes -= 1;
    else if (endBytes > 0) endBytes -= 1;
  } while (startBytes > 0 || endBytes > 0);
  return { text, truncated: true };
}

export async function createBundle(captured: CapturedCommand, options: RunOptions): Promise<CrashcartBundle> {
  const extraRules = await loadRedactionRules(options.patternFile);
  const combinedRaw = [captured.stdout, captured.stderr].filter(Boolean).join("\n");
  const redactedCombined = redactText(combinedRaw, extraRules);
  const redactedStdout = redactText(captured.stdout, extraRules);
  const redactedStderr = redactText(captured.stderr, extraRules);
  const redactedArgv = captured.command.map((argument) => redactText(argument, extraRules));
  const redactedCwd = redactText(captured.cwd, extraRules);
  const git = await getGitSummary(captured.cwd);
  const redactedGitFields = [git.branch, git.commit, git.status, git.error].map((field) =>
    field === undefined ? undefined : redactText(field, extraRules)
  );
  const redactedGit = {
    ...git,
    branch: redactedGitFields[0]?.text,
    commit: redactedGitFields[1]?.text,
    status: redactedGitFields[2]?.text,
    error: redactedGitFields[3]?.text
  };
  const truncated = truncateMiddle(redactedCombined.text, options.maxBytes);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    command: {
      argv: redactedArgv.map((argument) => argument.text),
      display: redactedArgv.map((argument) => argument.text).join(" "),
      cwd: redactedCwd.text,
      exitCode: captured.exitCode,
      signal: captured.signal,
      durationMs: captured.durationMs
    },
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      tools: await getToolVersions(),
      git: redactedGit
    },
    logs: {
      stdout: truncateMiddle(redactedStdout.text, options.maxBytes).text,
      stderr: truncateMiddle(redactedStderr.text, options.maxBytes).text,
      combined: truncated.text,
      truncated: truncated.truncated,
      maxBytes: options.maxBytes
    },
    redactions: mergeFindings(
      redactedCombined.findings,
      ...redactedArgv.map((argument) => argument.findings),
      redactedCwd.findings,
      redactedGitFields.flatMap((field) => field?.findings ?? [])
    ),
    classification: classifyFailure(redactedCombined.text)
  };
}

export function renderMarkdown(bundle: CrashcartBundle): string {
  const git = bundle.environment.git.available
    ? `${bundle.environment.git.branch}@${bundle.environment.git.commit}${bundle.environment.git.dirty ? " (dirty)" : ""}`
    : "not available";

  return `# Crashcart Triage Bundle

Generated: ${bundle.generatedAt}

## Summary

- Command: \`${bundle.command.display}\`
- Exit: ${bundle.command.exitCode ?? "signal " + bundle.command.signal}
- Duration: ${bundle.command.durationMs}ms
- Likely class: ${bundle.classification.class} (${bundle.classification.confidence})
- Cause: ${bundle.classification.summary}

## Next Safe Checks

${bundle.classification.nextChecks.map((check) => `- ${check}`).join("\n")}

## Environment

- CWD: \`${bundle.command.cwd}\`
- Platform: ${bundle.environment.platform}/${bundle.environment.arch}
- Node: ${bundle.environment.node}
- Git: ${git}

## Tool Versions

${bundle.environment.tools.map((tool) => `- ${tool.name}: ${tool.version ?? "not found"}`).join("\n")}

## Redactions

${bundle.redactions.length === 0 ? "- None detected" : bundle.redactions.map((finding) => `- ${finding.label}: ${finding.count}`).join("\n")}

## Combined Log

\`\`\`text
${bundle.logs.combined || "(no output captured)"}
\`\`\`
`;
}

export async function writeBundle(bundle: CrashcartBundle, outDir: string): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(outDir, { recursive: true });
  const jsonPath = join(outDir, "crashcart.json");
  const markdownPath = join(outDir, "crashcart.md");
  await writeFile(jsonPath, JSON.stringify(bundle, null, 2) + "\n");
  await writeFile(markdownPath, renderMarkdown(bundle));
  return { jsonPath, markdownPath };
}
