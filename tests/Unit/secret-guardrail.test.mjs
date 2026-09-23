import assert from "node:assert/strict";
import test from "node:test";

import { findSecrets, secretPatterns } from "../../scripts/secret-guardrail-lib.mjs";

test("PT-SEC-001 secret guardrail detects every governed signature", () => {
  const samples = [
    [["-----BEGIN", "OPENSSH PRIVATE KEY-----"].join(" "), 1],
    [`AKIA${"A".repeat(16)}`, 2],
    [`ASIA${"A".repeat(16)}`, 2],
    [`ghp_${"a".repeat(24)}`, 3],
    [`github_pat_${"a".repeat(24)}`, 4],
    [`glpat-${"a".repeat(24)}`, 5],
    [`npm_${"a".repeat(32)}`, 6],
    [`sk-${"a".repeat(24)}`, 7],
    [`sk-proj-${"a".repeat(24)}`, 7],
    [`xoxb-${"a".repeat(24)}`, 8],
    [["postgresql:/", "/user:protected-password@example.invalid/db"].join(""), 9],
    [`Bearer ${"a".repeat(24)}`, 10],
    [`${"eyJ" + "a".repeat(12)}.${"b".repeat(12)}.${"c".repeat(12)}`, 11],
    [`ClientSecret=${"a".repeat(20)}`, 12],
  ];
  assert.equal(new Set(samples.map(([, pattern]) => pattern)).size, secretPatterns.length);
  samples.forEach(([sample, expectedPattern]) => {
    const findings = findSecrets(sample);
    assert.deepEqual(findings.map(({ pattern }) => pattern), [expectedPattern]);
    assert.ok(findings[0].value.length > 0);
  });
});

test("PT-SEC-001 secret guardrail accepts documented placeholders", () => {
  assert.deepEqual(findSecrets("postgresql://user@example.invalid/db [REDACTED]"), []);
});
