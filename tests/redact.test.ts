import assert from "node:assert/strict";
import test from "node:test";
import { redactText } from "../src/redact.js";

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
