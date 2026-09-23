import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildSecurityEvidenceManifest } from "../../scripts/security-evidence-lib.mjs";
import { runSecurityEvidence } from "../../scripts/security-evidence-runner-lib.mjs";

const identity = {
  commitSha: "a".repeat(40),
  repository: "owner/etf-analyzer",
  runId: "1234",
  runAttempt: "2",
  workflow: "CI",
  job: "security-audit",
  ref: "refs/heads/main",
};

test("security evidence manifest binds raw command output to CI identity", () => {
  const manifest = buildSecurityEvidenceManifest(identity, [{
    name: "dependency-audit",
    command: "npm run test:security:audit",
    exitCode: 0,
    stdout: "audit passed\n",
    stderr: "",
  }]);

  assert.deepEqual(manifest, {
    schemaVersion: 1,
    identity,
    results: [{
      name: "dependency-audit",
      command: "npm run test:security:audit",
      exitCode: 0,
      stdout: {
        path: "dependency-audit.stdout.txt",
        bytes: 13,
        sha256: "089699aee217afc773879e208431ec77d4454243c6b0870c21e90a3796df28fa",
      },
      stderr: {
        path: "dependency-audit.stderr.txt",
        bytes: 0,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
    }],
  });
});

test("security evidence manifest rejects incomplete identity and malformed results", () => {
  assert.throws(
    () => buildSecurityEvidenceManifest({ ...identity, runId: "" }, []),
    /identity\.runId/u,
  );
  assert.throws(
    () => buildSecurityEvidenceManifest(identity, [{
      name: "dependency-audit",
      command: "npm run test:security:audit",
      exitCode: 0,
      stdout: Buffer.from("not text"),
      stderr: "",
    }]),
    /stdout/u,
  );
});

test("security evidence runner records every check and fails after preserving evidence", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "etf-security-evidence-"));
  const executed = [];
  try {
    const exitCode = runSecurityEvidence({
      identity,
      outputDirectory,
      checks: [
        { name: "first", script: "first" },
        { name: "failing", script: "failing" },
        { name: "last", script: "last" },
      ],
      execute: (script) => {
        executed.push(script);
        return script === "failing"
          ? { status: 7, stdout: "partial\n", stderr: "failed\n" }
          : { status: 0, stdout: `${script} passed\n`, stderr: "" };
      },
    });

    const manifest = JSON.parse(readFileSync(join(outputDirectory, "manifest.json"), "utf8"));
    assert.equal(exitCode, 1);
    assert.deepEqual(executed, ["first", "failing", "last"]);
    assert.deepEqual(manifest.results.map(({ name, exitCode: resultExitCode }) => [name, resultExitCode]), [
      ["first", 0],
      ["failing", 7],
      ["last", 0],
    ]);
    assert.equal(readFileSync(join(outputDirectory, "failing.stdout.txt"), "utf8"), "partial\n");
    assert.equal(readFileSync(join(outputDirectory, "failing.stderr.txt"), "utf8"), "failed\n");
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
