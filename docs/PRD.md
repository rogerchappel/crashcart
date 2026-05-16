# PRD: crashcart

Status: in-progress
Decision: build now
Factory run: 2026-05-17 AM

## Pitch

`crashcart` collects failing local command evidence into a tidy triage bundle: command, environment fingerprint, logs, likely failure class, and next safe checks. It is first aid for broken builds. 🧰

## Why It Matters

When `npm test` or `pnpm build` fails, agents often paste huge logs, miss the root clue, or rerun blindly. Maintainers need compact, private, local-first diagnostics that preserve enough evidence for another human/agent to continue without exposing secrets.

`crashcart` wraps commands, redacts sensitive values, classifies common failure patterns, and writes a Markdown + JSON incident packet.

## Qualification

### Pub Test

"Run a failing command through Crashcart and get a clean local triage packet instead of a wall of logs."

### Source / Inspiration

Inspired by recurring local CI failures across Roger's OSS garden, secret-redaction needs, and agent handoff workflows. It does not send telemetry or copy any external project.

### V1 Scope

- TypeScript CLI package.
- `crashcart run -- <command>` captures stdout, stderr, exit code, duration, cwd, selected tool versions, and git status summary.
- Redaction engine for env-like secrets, tokens, auth headers, and configurable patterns.
- Pattern classifier for dependency install, missing binary, TypeScript, test assertion, lint, network, permission, and timeout failures.
- Markdown and JSON bundle outputs.
- `crashcart inspect <bundle>` prints the likely cause and next checks.
- Fixture-backed tests for classifiers, redaction, bundle schema, and command capture.

## Out of Scope

- Uploading logs anywhere.
- Auto-fixing failures.
- Capturing private files outside the command output.
- Replacing real CI systems.

## CLI Sketch

```bash
crashcart run -- npm test
crashcart run --out .crashcart/build -- pnpm build
crashcart inspect .crashcart/build/crashcart.json
crashcart redact fixtures/raw.log --patterns crashcart.config.json
```

## Verification

Run `npm test`, `npm run check`, `npm run build`, `npm run smoke`, `bash scripts/validate.sh`, and one real CLI smoke that captures an intentional fixture failure.

## Agent Prompt

Build `crashcart` as a privacy-preserving local CLI failure triage bundle generator. Make redaction conservative, classification transparent, and reports immediately useful for human or agent handoff.
