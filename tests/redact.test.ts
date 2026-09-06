import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadRedactionRules, redactText } from "../src/redact.js";

test("redacts env-like secrets and tokens", () => {
  const result = redactText("API_TOKEN=abc123 ghp_abcdefghijklmnopqrstuvwxyz123456");
  assert.equal(result.text.includes("abc123"), false);
  assert.equal(result.text.includes("ghp_abcdefghijklmnopqrstuvwxyz123456"), false);
  assert.deepEqual(result.findings.map((finding) => finding.label).sort(), ["env-secret", "github-token"]);
});

test("supports extra regex rules", () => {
  const result = redactText("customer id cust_12345", [{ label: "customer-id", pattern: /cust_\d+/g }]);
  assert.equal(result.text, "customer id [REDACTED:customer-id]");
});

test("loads valid redaction pattern configuration", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "crashcart-patterns-valid-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "patterns.json");
  await writeFile(file, JSON.stringify({
    redactionPatterns: [
      { label: "customer-id", pattern: "cust_[0-9]+" },
      { label: "case-insensitive", pattern: "private", flags: "gi" }
    ]
  }));

  const rules = await loadRedactionRules(file);
  assert.equal(rules.length, 2);
  assert.equal(rules[0]?.pattern.flags, "g");
  assert.equal(rules[1]?.pattern.flags, "gi");
});

test("rejects malformed redaction pattern configuration with stable context", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "crashcart-patterns-invalid-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cases: Array<[unknown, string]> = [
    [null, "root must be a JSON object"],
    [{ redactionPatterns: {} }, "redactionPatterns must be an array"],
    [{ redactionPatterns: [null] }, "redactionPatterns[0] must be an object"],
    [{ redactionPatterns: [{}] }, "redactionPatterns[0].label must be a non-empty string"],
    [{ redactionPatterns: [{ label: " ", pattern: "x" }] }, "redactionPatterns[0].label must be a non-empty string"],
    [{ redactionPatterns: [{ label: "x", pattern: 3 }] }, "redactionPatterns[0].pattern must be a non-empty string"],
    [{ redactionPatterns: [{ label: "x", pattern: "" }] }, "redactionPatterns[0].pattern must be a non-empty string"],
    [{ redactionPatterns: [{ label: "x", pattern: "x", flags: 1 }] }, "redactionPatterns[0].flags must be a string"],
    [{ redactionPatterns: [{ label: "x", pattern: "x", flags: "gg" }] }, "redactionPatterns[0] has invalid regular expression"],
    [{ redactionPatterns: [{ label: "x", pattern: "[" }] }, "redactionPatterns[0] has invalid regular expression"]
  ];

  for (const [index, [config, diagnostic]] of cases.entries()) {
    const file = join(root, `patterns-${index}.json`);
    await writeFile(file, JSON.stringify(config));
    await assert.rejects(loadRedactionRules(file), (error: Error) => {
      assert.equal(error.message, `Invalid redaction patterns file ${file}: ${diagnostic}`);
      assert.doesNotMatch(error.message, /TypeError|Invalid regular expression/);
      return true;
    });
  }
});
