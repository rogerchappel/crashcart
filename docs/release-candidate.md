# Release Candidate Checklist

Use this checklist before publishing a CrashCart package or tagging a release.

## Verification

- Run `npm run release:check`.
- Confirm `npm run smoke` still captures a failing command and inspects the generated crashcart receipt.
- Inspect `npm pack --dry-run` output and confirm it includes `dist`, `README.md`, `LICENSE`, `CHANGELOG.md`, and `SECURITY.md`.

## Evidence

- Record the failing fixture command used for smoke testing.
- Include receipt schema, redaction, or inspect output changes in release notes.
- Note any CLI flag additions with a short example command.

## Support Notes

- Keep failure fixtures synthetic and deterministic.
- Do not publish crash receipts containing secrets, customer data, or private command output.
