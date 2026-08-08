import assert from "node:assert/strict";
import test from "node:test";
import { captureCommand } from "../src/capture.js";

test("captures command output and exit code", async () => {
  const result = await captureCommand(["node", "fixtures/failing-command.js"], process.cwd(), 5000);
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /TS2307/);
  assert.match(result.stdout, /fixture stdout/);
});

test("represents a missing executable as a completed capture", async () => {
  const result = await captureCommand(
    ["definitely-not-a-real-command-crashcart-test"],
    process.cwd(),
    60_000
  );

  assert.equal(result.exitCode, 127);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /failed to spawn command/i);
  assert.match(result.stderr, /ENOENT/);
  assert.ok(result.durationMs < 5_000, "spawn failure should clear the long timeout timer");
});

test("escalates when a timed-out command ignores SIGTERM", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX signal behavior is not available on Windows");
  }

  const startedAt = Date.now();
  const result = await captureCommand(
    ["node", "fixtures/ignores-sigterm.js"],
    process.cwd(),
    500
  );

  assert.equal(result.exitCode, null);
  assert.equal(result.signal, "SIGKILL");
  assert.match(result.stderr, /timed out after 500ms/);
  assert.match(result.stderr, /SIGTERM.*SIGKILL/);
  assert.ok(Date.now() - startedAt < 2000, "capture should terminate within a bounded interval");
});
