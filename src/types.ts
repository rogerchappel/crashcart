export type FailureClass =
  | "dependency-install"
  | "missing-binary"
  | "typescript"
  | "test-assertion"
  | "lint"
  | "network"
  | "permission"
  | "timeout"
  | "unknown";

export interface Classification {
  class: FailureClass;
  confidence: "high" | "medium" | "low";
  matched: string[];
  summary: string;
  nextChecks: string[];
}

export interface RedactionFinding {
  label: string;
  count: number;
}

export interface RedactionResult {
  text: string;
  findings: RedactionFinding[];
}

export interface ToolVersion {
  name: string;
  version: string | null;
}

export interface GitSummary {
  available: boolean;
  branch?: string;
  commit?: string;
  dirty?: boolean;
  status?: string;
  error?: string;
}

export interface CapturedCommand {
  command: string[];
  cwd: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export interface CrashcartBundle {
  schemaVersion: 1;
  generatedAt: string;
  command: {
    argv: string[];
    display: string;
    cwd: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    durationMs: number;
  };
  environment: {
    platform: NodeJS.Platform;
    arch: string;
    node: string;
    tools: ToolVersion[];
    git: GitSummary;
  };
  logs: {
    stdout: string;
    stderr: string;
    combined: string;
    truncated: boolean;
    maxBytes: number;
  };
  redactions: RedactionFinding[];
  classification: Classification;
}

export interface RunOptions {
  outDir: string;
  cwd: string;
  maxBytes: number;
  timeoutMs: number;
  patternFile?: string;
}

export interface CrashcartConfig {
  redactionPatterns?: Array<{
    label: string;
    pattern: string;
    flags?: string;
  }>;
}
