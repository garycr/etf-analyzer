import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  prepareLocalEvaluation,
  provisionLocalEvaluation,
  writeLocalEvaluationArtifacts,
} from "../../dist/Infrastructure/Local/local-evaluation-provisioner.js";

test("local evaluation artifacts are deterministic and runtime-loadable", async (context) => {
  const first = await mkdtemp(path.join(os.tmpdir(), "etf-evaluation-first-"));
  const second = await mkdtemp(path.join(os.tmpdir(), "etf-evaluation-second-"));
  context.after(() => Promise.all([
    rm(first, { force: true, recursive: true }),
    rm(second, { force: true, recursive: true }),
  ]));

  const firstResult = await writeLocalEvaluationArtifacts(first);
  const secondResult = await writeLocalEvaluationArtifacts(second);

  assert.deepEqual(firstResult, secondResult);
  assert.equal(firstResult.datasetId, "etf-prototype-core");
  assert.equal(firstResult.datasetVersion, "2026.01.0");
  assert.match(firstResult.configurationHash, /^[0-9a-f]{64}$/u);
  for (const relativePath of [
    "fixture/manifest.json",
    "fixture/economic-vintages.jsonl",
    "fixture/market-observations.jsonl",
    `fixture/raw-sources/${firstResult.rawSourceHash}`,
    "analytics.json",
  ]) {
    assert.deepEqual(
      await readFile(path.join(first, relativePath)),
      await readFile(path.join(second, relativePath)),
      relativePath,
    );
  }
});

test("local evaluation provisioning rejects an unverified PostgreSQL identity before mutation", async (context) => {
  const artifactRoot = await mkdtemp(path.join(os.tmpdir(), "etf-evaluation-identity-"));
  context.after(() => rm(artifactRoot, { force: true, recursive: true }));
  await writeLocalEvaluationArtifacts(artifactRoot);
  const queries = [];
  const client = {
    async connect() {},
    async end() {},
    async query(sql) {
      queries.push(sql);
      return { rows: [{ environment: "24.20|UTF8|UTC|on|C" }] };
    },
  };

  await assert.rejects(
    provisionLocalEvaluation({
      adminConnectionString: "postgresql://local-admin@127.0.0.1/etf_analyzer",
      appliedAt: "2026-09-27T00:00:00.000Z",
      artifactRoot,
      createClient: () => client,
    }),
    /APPLICATION_DATABASE_UNAVAILABLE/u,
  );
  assert.equal(queries.length, 1);
});

test("local evaluation provisioning rejects unsafe targets before connecting", async () => {
  for (const adminConnectionString of [
    "postgresql://postgres@database.example.com/etf_analyzer",
    "postgresql://postgres@127.0.0.1/other_database",
    "not-a-url",
  ]) {
    let createCalls = 0;
    await assert.rejects(
      provisionLocalEvaluation({
        adminConnectionString,
        appliedAt: "2026-09-27T00:00:00.000Z",
        createClient() {
          createCalls += 1;
          throw new Error("must not connect");
        },
      }),
      /APPLICATION_CONFIGURATION_INVALID/u,
    );
    assert.equal(createCalls, 0);
  }
});

test("local evaluation provisioning rejects a noncanonical timestamp before connecting", async () => {
  let createCalls = 0;
  await assert.rejects(
    provisionLocalEvaluation({
      adminConnectionString: "postgresql://postgres@127.0.0.1/etf_analyzer",
      appliedAt: "2026-09-27",
      createClient() {
        createCalls += 1;
        throw new Error("must not connect");
      },
    }),
    /APPLICATION_CONFIGURATION_INVALID/u,
  );
  assert.equal(createCalls, 0);
});

test("local evaluation provisioning preserves artifact verification diagnostics before connect", async () => {
  let createCalls = 0;
  const error = await provisionLocalEvaluation({
    adminConnectionString: "postgresql://postgres@127.0.0.1/etf_analyzer",
    appliedAt: "2026-09-27T00:00:00.000Z",
    artifactRoot: "/missing/evaluation-artifacts",
    createClient() {
      createCalls += 1;
      throw new Error("must not connect");
    },
  }).then(() => undefined, (failure) => failure);

  assert.equal(error?.message, "APPLICATION_CONFIGURATION_INVALID");
  assert.ok(error?.cause instanceof Error);
  assert.equal(createCalls, 0);
});

test("local evaluation preparation writes a closed runtime configuration", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "etf-evaluation-prepare-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  let provisioned = false;
  const operations = [];

  const result = await prepareLocalEvaluation(
    root,
    "postgresql://local-admin@127.0.0.1/etf_analyzer",
    "2026-09-27T00:00:00.000Z",
    {
      async provision() { operations.push("provision"); provisioned = true; },
      async writeArtifacts(artifactRoot) {
        operations.push("artifacts");
        return writeLocalEvaluationArtifacts(artifactRoot);
      },
    },
  );
  const config = JSON.parse(await readFile(result.configPath, "utf8"));

  assert.equal(provisioned, true);
  assert.deepEqual(operations, ["artifacts", "provision"]);
  assert.equal(config.artifactRoot, path.join(path.resolve(root), "reviewed-artifacts"));
  assert.deepEqual(config.allowedOrigins, ["http://127.0.0.1:43123"]);
  assert.equal(config.port, 43123);
  assert.equal(Object.hasOwn(config, "adminConnectionString"), false);
});

test("local evaluation preparation requires an explicit administrator URL", async () => {
  await assert.rejects(
    prepareLocalEvaluation("/tmp/etf-evaluation", undefined, "2026-09-27T00:00:00.000Z"),
    /APPLICATION_CONFIGURATION_INVALID/u,
  );
});
