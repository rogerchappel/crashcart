#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="${TMPDIR:-/tmp}/crashcart-demo-$$"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

cd "$repo_root"
npm run build

set +e
node dist/src/cli.js run \
  --out "$tmp_dir/bundle" \
  --patterns fixtures/crashcart.config.json \
  -- node fixtures/failing-command.js
run_status=$?
set -e

test "$run_status" -eq 1
node dist/src/cli.js inspect "$tmp_dir/bundle/crashcart.json" > "$tmp_dir/inspect.txt"
node dist/src/cli.js redact fixtures/raw.log \
  --patterns fixtures/crashcart.config.json \
  --out "$tmp_dir/redacted.log"

test -s "$tmp_dir/bundle/crashcart.json"
test -s "$tmp_dir/inspect.txt"
test -s "$tmp_dir/redacted.log"
grep -q -- "- " "$tmp_dir/inspect.txt"
grep -q "REDACTED" "$tmp_dir/redacted.log"

printf 'crashcart demo artifacts written under %s\n' "$tmp_dir"
