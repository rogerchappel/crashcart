import type { Classification, FailureClass } from "./types.js";

interface Rule {
  class: FailureClass;
  summary: string;
  nextChecks: string[];
  patterns: RegExp[];
}

const rules: Rule[] = [
  {
    class: "dependency-install",
    summary: "Dependency installation or package resolution failed.",
    nextChecks: [
      "Confirm the lockfile matches the package manager in use.",
      "Retry with the package manager's frozen-lockfile or clean-install mode.",
      "Check whether the failing package or registry is reachable."
    ],
    patterns: [/npm ERR!/i, /ERR_PNPM_/i, /yarn install/i, /unable to resolve dependency tree/i, /peer dep/i]
  },
  {
    class: "missing-binary",
    summary: "A required executable was not found on PATH.",
    nextChecks: [
      "Install the missing tool or run through the package manager script.",
      "Check PATH inside the shell or agent environment.",
      "Confirm local node_modules/.bin entries were installed."
    ],
    patterns: [/command not found/i, /not recognized as an internal or external command/i, /ENOENT/i, /spawn .* ENOENT/i]
  },
  {
    class: "typescript",
    summary: "TypeScript compilation reported type or configuration errors.",
    nextChecks: [
      "Run the TypeScript check directly for full diagnostics.",
      "Inspect the first TS error and related source file.",
      "Confirm tsconfig paths and dependency types are current."
    ],
    patterns: [/TS\d{4}/, /Type '.*' is not assignable/i, /Cannot find module .* or its corresponding type declarations/i]
  },
  {
    class: "test-assertion",
    summary: "A test assertion or test runner failed.",
    nextChecks: [
      "Rerun the smallest failing test file.",
      "Inspect expected versus actual output near the first failure.",
      "Check recent changes around the failing assertion."
    ],
    patterns: [/AssertionError/i, /expected .* to/i, /FAIL\s+.*\.(test|spec)\./i, /not ok \d+/i]
  },
  {
    class: "lint",
    summary: "Linting or formatting checks failed.",
    nextChecks: [
      "Run the lint command locally with formatter output.",
      "Apply the formatter if the project has one.",
      "Inspect rule names in the first reported lint error."
    ],
    patterns: [/eslint/i, /prettier/i, /lint/i, /no-unused-vars/i]
  },
  {
    class: "network",
    summary: "Network access or remote service resolution failed.",
    nextChecks: [
      "Check whether the machine is online and DNS works.",
      "Retry once to rule out transient service failure.",
      "Confirm proxy, registry, and certificate settings."
    ],
    patterns: [/ECONNRESET/i, /ETIMEDOUT/i, /ENOTFOUND/i, /EAI_AGAIN/i, /certificate/i, /network/i]
  },
  {
    class: "permission",
    summary: "The command failed because a file, directory, or executable was not accessible.",
    nextChecks: [
      "Check ownership and mode of the reported path.",
      "Avoid rerunning with elevated privileges until the path is understood.",
      "Confirm generated directories are writable."
    ],
    patterns: [/EACCES/i, /EPERM/i, /permission denied/i, /operation not permitted/i]
  },
  {
    class: "timeout",
    summary: "The command timed out or reported a timeout-like failure.",
    nextChecks: [
      "Rerun the command with a narrower scope.",
      "Look for a hung subprocess or external service wait.",
      "Increase timeout only after confirming useful progress."
    ],
    patterns: [/timed out/i, /timeout/i, /SIGTERM/i]
  }
];

export function classifyFailure(text: string): Classification {
  const scores = rules.map((rule) => {
    const matched = rule.patterns
      .filter((pattern) => pattern.test(text))
      .map((pattern) => pattern.source);
    return { rule, matched };
  });

  const best = scores
    .filter((score) => score.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length)[0];

  if (!best) {
    return {
      class: "unknown",
      confidence: "low",
      matched: [],
      summary: "Crashcart did not find a known failure pattern.",
      nextChecks: [
        "Read the first error in stderr or combined output.",
        "Rerun the smallest command that reproduces the failure.",
        "Check recent local changes and dependency updates."
      ]
    };
  }

  return {
    class: best.rule.class,
    confidence: best.matched.length >= 2 ? "high" : "medium",
    matched: best.matched,
    summary: best.rule.summary,
    nextChecks: best.rule.nextChecks
  };
}
