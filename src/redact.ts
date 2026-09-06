import { readFile } from "node:fs/promises";
import type { RedactionFinding, RedactionResult } from "./types.js";

export interface RedactionRule {
  label: string;
  pattern: RegExp;
}

const defaultRules: RedactionRule[] = [
  { label: "authorization-header", pattern: /\bAuthorization:\s*(?:Bearer|Basic)\s+[^\s]+/gi },
  { label: "env-secret", pattern: /\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*[^\s]+/g },
  { label: "github-token", pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/g },
  { label: "npm-token", pattern: /npm_[A-Za-z0-9]{20,}/g },
  { label: "jwt", pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { label: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/g },
  { label: "private-key-block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g }
];

export function redactText(input: string, extraRules: RedactionRule[] = []): RedactionResult {
  const counts = new Map<string, number>();
  let text = input;

  for (const rule of [...defaultRules, ...extraRules]) {
    text = text.replace(rule.pattern, (match) => {
      counts.set(rule.label, (counts.get(rule.label) ?? 0) + 1);
      const key = match.includes("=") ? match.slice(0, Math.max(0, match.indexOf("=") + 1)) : "";
      return `${key}[REDACTED:${rule.label}]`;
    });
  }

  const findings: RedactionFinding[] = [...counts.entries()].map(([label, count]) => ({ label, count }));
  return { text, findings };
}

export async function loadRedactionRules(patternFile?: string): Promise<RedactionRule[]> {
  if (!patternFile) return [];
  const invalid = (message: string): Error => new Error(`Invalid redaction patterns file ${patternFile}: ${message}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(patternFile, "utf8"));
  } catch (error) {
    throw invalid(`cannot parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw invalid("root must be a JSON object");
  }

  const patterns = (parsed as Record<string, unknown>).redactionPatterns;
  if (patterns === undefined) return [];
  if (!Array.isArray(patterns)) throw invalid("redactionPatterns must be an array");

  return patterns.map((value, index) => {
    const name = `redactionPatterns[${index}]`;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw invalid(`${name} must be an object`);
    }
    const entry = value as Record<string, unknown>;
    if (typeof entry.label !== "string" || entry.label.trim() === "") {
      throw invalid(`${name}.label must be a non-empty string`);
    }
    if (typeof entry.pattern !== "string" || entry.pattern.length === 0) {
      throw invalid(`${name}.pattern must be a non-empty string`);
    }
    if (entry.flags !== undefined && typeof entry.flags !== "string") {
      throw invalid(`${name}.flags must be a string`);
    }
    try {
      return { label: entry.label, pattern: new RegExp(entry.pattern, entry.flags ?? "g") };
    } catch {
      throw invalid(`${name} has invalid regular expression`);
    }
  });
}
