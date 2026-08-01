# crashcart

crashcart is a privacy-preserving local CLI for capturing a failing command,
redacting sensitive text, and writing a compact triage bundle that can be
inspected before it is shared.


## Quickstart

Run the tool from a fresh checkout:

```sh
npm install
npm run build
node dist/src/cli.js --help
npm test
```

The help command is a quick smoke test for the CLI entrypoint, and `npm test` runs the committed regression suite before you depend on the output.

## Status

This is a v0.1.0 local-first developer tool. Treat the CLI and bundle schema as
early-stage, pin versions in automation, and run the verification commands below
before relying on it in CI.

## Install from a checkout

```sh
git clone https://github.com/rogerchappel/crashcart.git
cd crashcart
npm install
npm run build
```

## CLI Quickstart

Capture a command that exits non-zero and write the bundle under `.crashcart/`:

```sh
node dist/src/cli.js run --out .crashcart/demo -- node fixtures/failing-command.js
```

`--max-bytes` accepts safe integers of at least 42 (the size of the truncation
marker) and defaults to 120000. The cap applies to each stored stdout, stderr,
and combined log field. `--timeout-ms` accepts safe integers of at least 1 and
defaults to 600000. Invalid or missing values are rejected before the captured
command runs or an output directory is created. When the timeout expires,
crashcart sends `SIGTERM`, waits 250ms for a graceful exit, then sends `SIGKILL`
if the command is still running. It records the timeout in the bundle and exits
nonzero.

Inspect the generated bundle without re-running the failing command:

```sh
node dist/src/cli.js inspect .crashcart/demo/crashcart.json
```

Redact an existing log with the maintained fixture rules:

```sh
node dist/src/cli.js redact fixtures/raw.log --patterns fixtures/crashcart.config.json
```

Run the reproducible triage bundle demo:

```sh
bash demo/run-triage-bundle.sh
```

The demo builds the CLI, captures the checked-in failing fixture, inspects the
generated bundle, redacts the sample log, and verifies the expected artifacts.
A short recording outline is available in
[docs/promo/triage-bundle-demo.md](docs/promo/triage-bundle-demo.md).

## Verification

Use the package scripts as the public release gates before publishing or changing
CLI behavior:

```sh
npm run check
npm test
npm run build
npm run smoke
npm run package:smoke
npm run release:check
```

`release:check` runs tests, type-checking, the CLI smoke capture, and a dry-run
`npm pack` so the shipped package contents are visible before release.

## Limitations

- crashcart runs locally and does not upload bundles, logs, or command output.
- Redaction is pattern-based; inspect generated bundles before sharing them.
- The classifier is heuristic and should guide triage, not replace human review.
- Bundle fields may change before a stable 1.0 release.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Keep changes small, include a fixture or
smoke case when behavior changes, and paste verification output into the pull
request.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting. Do not paste secrets,
private tokens, proprietary logs, or private bundle contents into public issues.

## License

MIT
