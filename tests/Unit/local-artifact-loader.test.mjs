import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadLocalArtifactResolver } from "../../dist/Infrastructure/Local/artifact-loader.js";

function config(artifactRoot, fixturePackageDirectory) {
  return {
    artifactRoot,
    fixturePackageDirectory,
    fixtureEvaluationAt: "2026-01-31T00:00:00.000Z",
    analyticsArtifactPath: "analytics.json",
  };
}

test("local artifact loader rejects lexical traversal outside the reviewed root", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "etf-artifacts-"));
  context.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    loadLocalArtifactResolver(config(root, "../unreviewed")),
    (error) => error.message === "APPLICATION_CONFIGURATION_INVALID",
  );
});

test("local artifact loader rejects symlinks that escape the reviewed root", async (context) => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "etf-artifacts-"));
  const root = path.join(parent, "reviewed");
  const outside = path.join(parent, "unreviewed");
  await mkdir(root);
  await mkdir(outside);
  await symlink(outside, path.join(root, "fixture"));
  context.after(() => rm(parent, { recursive: true, force: true }));

  await assert.rejects(
    loadLocalArtifactResolver(config(root, "fixture")),
    (error) => error.message === "APPLICATION_CONFIGURATION_INVALID",
  );
});
