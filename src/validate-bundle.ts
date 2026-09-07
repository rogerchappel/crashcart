import type { CrashcartBundle, FailureClass } from "./types.js";

const failureClasses = new Set<FailureClass>([
  "dependency-install", "missing-binary", "typescript", "test-assertion", "lint",
  "network", "permission", "timeout", "unknown"
]);
const confidences = new Set(["high", "medium", "low"]);

function record(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${path} must be an object`);
}

function string(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
}

function boolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
}

function number(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path} must be a finite number`);
}

function stringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  value.forEach((item, index) => string(item, `${path}[${index}]`));
}

export function validateBundle(value: unknown): CrashcartBundle {
  record(value, "bundle");
  if (value.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  string(value.generatedAt, "generatedAt");

  record(value.command, "command");
  stringArray(value.command.argv, "command.argv");
  string(value.command.display, "command.display");
  string(value.command.cwd, "command.cwd");
  if (value.command.exitCode !== null) number(value.command.exitCode, "command.exitCode");
  if (value.command.signal !== null) string(value.command.signal, "command.signal");
  number(value.command.durationMs, "command.durationMs");

  record(value.environment, "environment");
  string(value.environment.platform, "environment.platform");
  string(value.environment.arch, "environment.arch");
  string(value.environment.node, "environment.node");
  if (!Array.isArray(value.environment.tools)) throw new Error("environment.tools must be an array");
  value.environment.tools.forEach((tool, index) => {
    record(tool, `environment.tools[${index}]`);
    string(tool.name, `environment.tools[${index}].name`);
    if (tool.version !== null) string(tool.version, `environment.tools[${index}].version`);
  });
  record(value.environment.git, "environment.git");
  boolean(value.environment.git.available, "environment.git.available");
  for (const field of ["branch", "commit", "status", "error"] as const) {
    if (value.environment.git[field] !== undefined) string(value.environment.git[field], `environment.git.${field}`);
  }
  if (value.environment.git.dirty !== undefined) boolean(value.environment.git.dirty, "environment.git.dirty");

  record(value.logs, "logs");
  string(value.logs.stdout, "logs.stdout");
  string(value.logs.stderr, "logs.stderr");
  string(value.logs.combined, "logs.combined");
  boolean(value.logs.truncated, "logs.truncated");
  number(value.logs.maxBytes, "logs.maxBytes");

  if (!Array.isArray(value.redactions)) throw new Error("redactions must be an array");
  value.redactions.forEach((finding, index) => {
    record(finding, `redactions[${index}]`);
    string(finding.label, `redactions[${index}].label`);
    number(finding.count, `redactions[${index}].count`);
  });

  record(value.classification, "classification");
  if (!failureClasses.has(value.classification.class as FailureClass)) {
    throw new Error("classification.class must be a supported failure class");
  }
  if (!confidences.has(value.classification.confidence as string)) {
    throw new Error("classification.confidence must be high, medium, or low");
  }
  stringArray(value.classification.matched, "classification.matched");
  string(value.classification.summary, "classification.summary");
  stringArray(value.classification.nextChecks, "classification.nextChecks");
  return value as unknown as CrashcartBundle;
}
