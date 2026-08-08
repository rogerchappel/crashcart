import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MIN_MAX_BYTES } from "../src/bundle.js";
import type { CrashcartBundle } from "../src/types.js";

const cli = join(process.cwd(), "dist/src/cli.js");

test("rejects invalid numeric options before executing the child or writing output", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "crashcart-cli-invalid-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const invalid = [
    ["--max-bytes"],
    ["--max-bytes", "nope"],
    ["--max-bytes", "Infinity"],
    ["--max-bytes", "0"],
    ["--max-bytes", "-1"],
    ["--max-bytes", String(MIN_MAX_BYTES - 1)],
    ["--timeout-ms"],
    ["--timeout-ms", "nope"],
    ["--timeout-ms", "Infinity"],
    ["--timeout-ms", "0"],
    ["--timeout-ms", "-1"]
  ];

  for (const [index, option] of invalid.entries()) {
    const outDir = join(root, `out-${index}`);
    const sentinel = join(root, `child-${index}`);
    const result = spawnSync(process.execPath, [
      cli, "run", "--out", outDir, ...option, "--",
      process.execPath, "-e", `require("node:fs").writeFileSync(${JSON.stringify(sentinel)}, "ran")`
    ], { encoding: "utf8" });
    assert.equal(result.status, 1, option.join(" "));
    assert.match(result.stderr, new RegExp(`^${option[0]} must be an integer of at least `));
    await assert.rejects(access(sentinel));
    await assert.rejects(access(outDir));
  }
});

test("accepts valid custom numeric options and honors the byte cap", async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), "crashcart-cli-valid-"));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [
    cli, "run", "--out", outDir,
    "--max-bytes", String(MIN_MAX_BYTES),
    "--timeout-ms", "1000", "--",
    process.execPath, "-e", `process.stdout.write("x".repeat(1000))`
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const bundle = JSON.parse(await readFile(join(outDir, "crashcart.json"), "utf8")) as {
    logs: { combined: string; maxBytes: number };
  };
  assert.equal(bundle.logs.maxBytes, MIN_MAX_BYTES);
  assert.ok(Buffer.byteLength(bundle.logs.combined) <= MIN_MAX_BYTES);
});

test("writes a classified bundle when the executable is missing", async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), "crashcart-cli-spawn-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  const outDir = join(tempDir, "out");

  const result = spawnSync(
    process.execPath,
    [
      cli,
      "run",
      "--out",
      outDir,
      "--timeout-ms",
      "60000",
      "--",
      "definitely-not-a-real-command-crashcart-cli-test"
    ],
    { cwd: process.cwd(), encoding: "utf8", timeout: 5_000 }
  );

  assert.equal(result.error, undefined);
  assert.equal(result.status, 127);
  assert.match(result.stdout, /Crashcart wrote .*crashcart\.json/);
  assert.match(result.stdout, /Likely: missing-binary/);

  const json = await readFile(join(outDir, "crashcart.json"), "utf8");
  const markdown = await readFile(join(outDir, "crashcart.md"), "utf8");
  const bundle = JSON.parse(json) as CrashcartBundle;
  assert.equal(bundle.command.exitCode, 127);
  assert.equal(bundle.command.signal, null);
  assert.equal(bundle.classification.class, "missing-binary");
  assert.match(bundle.logs.stderr, /failed to spawn command/i);
  assert.match(bundle.logs.stderr, /ENOENT/);
  assert.match(markdown, /Likely class: missing-binary/);
  assert.match(markdown, /failed to spawn command/i);
});
