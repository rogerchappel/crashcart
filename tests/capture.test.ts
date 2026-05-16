import assert from "node:assert/strict";
import test from "node:test";
import { captureCommand } from "../src/capture.js";

test("captures command output and exit code", async () => {
  const result = await captureCommand(["node", "fixtures/failing-command.js"], process.cwd(), 5000);
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /TS2307/);
  assert.match(result.stdout, /fixture stdout/);
});
