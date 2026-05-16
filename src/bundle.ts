import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { classifyFailure } from "./classifier.js";
import { getToolVersions } from "./env.js";
import { getGitSummary } from "./git.js";
import { loadRedactionRules, redactText } from "./redact.js";
import type { CapturedCommand, CrashcartBundle, RunOptions } from "./types.js";

export function truncateMiddle(input: string, maxBytes: number): { text: string; truncated: boolean } {
  const bytes = Buffer.byteLength(input, "utf8");
  if (bytes <= maxBytes) return { text: input, truncated: false };
  const marker = "\n[... crashcart truncated log output ...]\n";
  const half = Math.floor((maxBytes - Buffer.byteLength(marker)) / 2);
  const start = Buffer.from(input).subarray(0, half).toString("utf8");
  const end = Buffer.from(input).subarray(bytes - half).toString("utf8");
  return { text: start + marker + end, truncated: true };
}

export async function createBundle(captured: CapturedCommand, options: RunOptions): Promise<CrashcartBundle> {
  const extraRules = await loadRedactionRules(options.patternFile);
  const combinedRaw = [captured.stdout, captured.stderr].filter(Boolean).join("\n");
  const redactedCombined = redactText(combinedRaw, extraRules);
  const redactedStdout = redactText(captured.stdout, extraRules);
  const redactedStderr = redactText(captured.stderr, extraRules);
  const truncated = truncateMiddle(redactedCombined.text, options.maxBytes);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    command: {
      argv: captured.command,
      display: captured.command.join(" "),
      cwd: captured.cwd,
      exitCode: captured.exitCode,
      signal: captured.signal,
      durationMs: captured.durationMs
    },
    environment: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      tools: await getToolVersions(),
      git: await getGitSummary(captured.cwd)
    },
    logs: {
      stdout: truncateMiddle(redactedStdout.text, options.maxBytes).text,
      stderr: truncateMiddle(redactedStderr.text, options.maxBytes).text,
      combined: truncated.text,
      truncated: truncated.truncated,
      maxBytes: options.maxBytes
    },
    redactions: redactedCombined.findings,
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
