import assert from "node:assert/strict";
import test from "node:test";
import { classifyFailure } from "../src/classifier.js";

test("classifies TypeScript failures", () => {
  const result = classifyFailure("src/index.ts(1,1): error TS2322: Type 'string' is not assignable");
  assert.equal(result.class, "typescript");
  assert.equal(result.confidence, "high");
});

test("classifies missing binaries", () => {
  const result = classifyFailure("sh: vitest: command not found");
  assert.equal(result.class, "missing-binary");
});

test("returns unknown for unrecognized output", () => {
  const result = classifyFailure("something broke in a novel way");
  assert.equal(result.class, "unknown");
  assert.equal(result.confidence, "low");
});
