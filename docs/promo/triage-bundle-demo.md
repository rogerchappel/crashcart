# crashcart triage bundle demo

## Demo promise

Show how crashcart captures a failing local command, writes a redacted triage
bundle, and lets a maintainer inspect likely next checks before sharing logs.

## Recording flow

1. Run `bash demo/run-triage-bundle.sh`.
2. Open the generated `inspect.txt` summary from the printed temporary
   directory.
3. Open `bundle/crashcart.json` and point out command metadata, captured output,
   classification, and redaction metadata.
4. Open `redacted.log` to show standalone log redaction with fixture rules.

## Grounded talking points

- `crashcart run` captures a command locally and exits with the captured command
  status.
- `crashcart inspect` reads an existing bundle without re-running the failure.
- `crashcart redact` can sanitize an existing log file with maintained patterns.
- The README calls out pattern-based redaction and heuristic classification
  limits, so generated bundles should be inspected before sharing.

## Short post hooks

- "When a local command fails, send a triage bundle instead of a wall of logs."
- "Crashcart captures the failure, redacts obvious secrets, and suggests next checks."
- "A tiny local support artifact for agent handoffs and maintainer triage."
