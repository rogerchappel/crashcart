import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBundle, renderMarkdown, truncateMiddle, writeBundle } from "../src/bundle.js";
import type { CapturedCommand } from "../src/types.js";

const captured: CapturedCommand = {
  command: ["node", "fixtures/failing-command.js"],
  cwd: process.cwd(),
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 42,
  exitCode: 1,
  signal: null,
  stdout: "hello",
  stderr: "error TS2307: Cannot find module 'x'\nAPI_TOKEN=secret"
};

test("creates a redacted classified bundle", async () => {
  const bundle = await createBundle(captured, {
    outDir: ".crashcart/test",
    cwd: process.cwd(),
    maxBytes: 10000,
    timeoutMs: 1000
  });
  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.classification.class, "typescript");
  assert.equal(bundle.logs.combined.includes("API_TOKEN=secret"), false);
  assert.equal(bundle.redactions[0]?.label, "env-secret");
});

test("renders markdown report", async () => {
  const bundle = await createBundle(captured, {
    outDir: ".crashcart/test",
    cwd: process.cwd(),
    maxBytes: 10000,
    timeoutMs: 1000
  });
  const markdown = renderMarkdown(bundle);
  assert.match(markdown, /Crashcart Triage Bundle/);
  assert.match(markdown, /typescript/);
});

test("redacts secrets from command and path metadata", async (t) => {
  const secret = "recognizable-metadata-secret";
  const metadataCapture: CapturedCommand = {
    ...captured,
    command: ["node", "fixtures/failing-command.js", `API_TOKEN=${secret}`],
    cwd: `/tmp/API_TOKEN=${secret}/project`
  };
  const outDir = await mkdtemp(join(tmpdir(), "crashcart-metadata-"));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const bundle = await createBundle(metadataCapture, {
    outDir,
    cwd: process.cwd(),
    maxBytes: 10000,
    timeoutMs: 1000
  });
  const { jsonPath, markdownPath } = await writeBundle(bundle, outDir);
  const json = await readFile(jsonPath, "utf8");
  const markdown = await readFile(markdownPath, "utf8");

  assert.equal(json.includes(secret), false);
  assert.equal(markdown.includes(secret), false);
  assert.equal(bundle.command.argv[0], "node");
  assert.match(bundle.command.argv[2]!, /^API_TOKEN=\[REDACTED:env-secret\]$/);
  assert.match(bundle.command.cwd, /\[REDACTED:env-secret\]/);
});

test("truncates long logs", () => {
  const result = truncateMiddle("a".repeat(200), 80);
  assert.equal(result.truncated, true);
  assert.match(result.text, /truncated/);
});
