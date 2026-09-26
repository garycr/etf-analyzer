import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalizeJson } from "../../dist/Infrastructure/CanonicalJson/canonical-json.js";
import { dispatchPostgresWorkflowOperation } from "../../dist/Infrastructure/PostgreSQL/workflow-owner.js";

const context = {
  commandId: "81000000-0000-4000-8000-000000000001",
  correlationId: "81000000-0000-4000-8000-000000000002",
  requestedAt: "2026-09-22T10:00:00.000Z",
};
const fixturePayload = {
  jobId: "81000000-0000-4000-8000-000000000003",
  datasetId: "etf-prototype-core",
  datasetVersion: "2026.01.0",
  fixturePackageHash: "a".repeat(64),
};
const fixtureArtifact = {
  fixturePackageHash: "a".repeat(64),
  databasePayload: {
    jobId: fixturePayload.jobId,
    datasetId: fixturePayload.datasetId,
    datasetVersion: fixturePayload.datasetVersion,
    datasetHash: fixturePayload.fixturePackageHash,
    manifest: {},
    descriptors: [],
    rawSources: [],
    marketObservations: [{ instrumentId: "ETF-1" }],
    economicObservations: [{ seriesId: "CPI" }],
  },
};

function definition(operation, kind = "command") {
  return { operation, kind };
}

function resultJob(operation, jobId, originalCommandId, acceptedCount) {
  return {
    jobId,
    jobType: operation === "AnalyticsRun" ? "Analytics" : "FixtureIngestion",
    status: "Succeeded",
    originalCommandId,
    acceptedCount,
  };
}

test("workflow owner completes an approved fixture artifact through one PostgreSQL client", async () => {
  const observed = [];
  const job = resultJob("FixtureIngestionStart", fixturePayload.jobId, context.commandId, "2");
  const client = {
    async query(sql, values) {
      observed.push({ sql, values });
      if (sql.includes("fixture_ingest")) {
        return { rows: [{ result: {
          datasetId: fixturePayload.datasetId,
          datasetVersion: fixturePayload.datasetVersion,
          datasetHash: fixturePayload.fixturePackageHash,
          acceptedCount: 2,
        } }] };
      }
      if (sql.includes("job_succeed")) return { rows: [{ job }] };
      return { rows: [{ job: { status: "Pending" } }] };
    },
  };

  assert.deepEqual(await dispatchPostgresWorkflowOperation(
    client,
    { resolveFixture: () => fixtureArtifact, resolveAnalytics: () => undefined },
    () => "2026-09-22T10:00:02.000Z",
    definition("FixtureIngestionStart"),
    fixturePayload,
    context,
  ), { job });
  assert.deepEqual(observed.map(({ sql }) => sql), [
    "SELECT etf.job_start($1::jsonb) AS job",
    "SELECT etf.fixture_ingest($1::jsonb) AS result",
    "SELECT etf.job_succeed($1::jsonb) AS job",
  ]);
  assert.deepEqual(JSON.parse(observed[2].values[0]), {
    jobId: fixturePayload.jobId,
    originalCommandId: context.commandId,
    operation: "FixtureIngestionStart",
    acceptedCount: "2",
    rejectedCount: "0",
    startedAt: context.requestedAt,
    completedAt: "2026-09-22T10:00:02.000Z",
  });
});

test("workflow owner rejects mismatched approved artifacts before SQL mutation", async () => {
  let queryCount = 0;
  const client = { async query() { queryCount += 1; return { rows: [] }; } };
  await assert.rejects(
    dispatchPostgresWorkflowOperation(
      client,
      { resolveFixture: () => ({ ...fixtureArtifact, fixturePackageHash: "b".repeat(64) }), resolveAnalytics: () => undefined },
      () => "2026-09-22T10:00:02.000Z",
      definition("FixtureIngestionStart"),
      fixturePayload,
      context,
    ),
    (error) => error.code === "APPLICATION_REQUEST_INVALID",
  );
  assert.equal(queryCount, 0);
});

test("workflow owner commits analytics evidence and returns the completed job", async () => {
  const canonicalConfiguration = { domain: "configuration" };
  const configurationHash = createHash("sha256")
    .update(canonicalizeJson(canonicalConfiguration), "utf8")
    .digest("hex");
  const analyticsPayload = {
    jobId: "82000000-0000-4000-8000-000000000001",
    evidenceCommandId: context.commandId,
    asOfDate: "2026-01-31",
    configurationHash,
    inputEvidenceIds: ["82000000-0000-4000-8000-000000000002"],
  };
  const databasePayload = {
    evidenceId: "82000000-0000-4000-8000-000000000003",
    evidenceCommitCommandId: context.commandId,
    evaluationAt: "2026-01-31T00:00:00.000Z",
    canonicalConfiguration,
  };
  const observed = [];
  const job = resultJob("AnalyticsRun", analyticsPayload.jobId, context.commandId, "1");
  const client = {
    async query(sql, values) {
      observed.push({ sql, values });
      if (sql.includes("evidence_commit")) return { rows: [{ result: { evidenceId: databasePayload.evidenceId } }] };
      if (sql.includes("job_succeed")) return { rows: [{ job }] };
      return { rows: [{ job: { status: "Pending" } }] };
    },
  };
  await assert.rejects(
    dispatchPostgresWorkflowOperation(
      client,
      {
        resolveFixture: () => undefined,
        resolveAnalytics: () => ({
          configurationHash: analyticsPayload.configurationHash,
          inputEvidenceIds: analyticsPayload.inputEvidenceIds,
          databasePayload,
        }),
      },
      () => "2026-09-22T10:00:02.000Z",
      definition("AnalyticsRun"),
      { ...analyticsPayload, configurationHash: "c".repeat(64) },
      context,
    ),
    (error) => error.code === "APPLICATION_REQUEST_INVALID",
  );
  assert.equal(observed.length, 0);

  assert.deepEqual(await dispatchPostgresWorkflowOperation(
    client,
    {
      resolveFixture: () => undefined,
      resolveAnalytics: () => ({
        configurationHash: analyticsPayload.configurationHash,
        inputEvidenceIds: analyticsPayload.inputEvidenceIds,
        databasePayload,
      }),
    },
    () => "2026-09-22T10:00:02.000Z",
    definition("AnalyticsRun"),
    analyticsPayload,
    context,
  ), { job });
  assert.deepEqual(observed.map(({ sql }) => sql), [
    "SELECT etf.job_start($1::jsonb) AS job",
    "SELECT etf.evidence_commit($1::jsonb) AS result",
    "SELECT etf.job_succeed($1::jsonb) AS job",
  ]);
});

test("workflow owner reads portfolios and closes unknown PostgreSQL failures", async () => {
  const portfolio = { portfolioId: "83000000-0000-4000-8000-000000000001" };
  const payload = { portfolioId: portfolio.portfolioId, asOf: "2026-09-22T10:00:00.000Z" };
  const client = {
    async query(sql, values) {
      assert.equal(sql, "SELECT etf.portfolio_get($1::uuid, $2::timestamptz) AS result");
      assert.deepEqual(values, [payload.portfolioId, payload.asOf]);
      return { rows: [{ result: { portfolio } }] };
    },
  };
  assert.deepEqual(await dispatchPostgresWorkflowOperation(
    client,
    { resolveFixture: () => undefined, resolveAnalytics: () => undefined },
    () => assert.fail("query must not use completion clock"),
    definition("PortfolioGet", "query"),
    payload,
    undefined,
  ), { portfolio });

  await assert.rejects(
    dispatchPostgresWorkflowOperation(
      { query: async () => { throw new Error("raw database detail"); } },
      { resolveFixture: () => fixtureArtifact, resolveAnalytics: () => undefined },
      () => "2026-09-22T10:00:02.000Z",
      definition("FixtureIngestionStart"),
      fixturePayload,
      context,
    ),
    (error) => error.code === "APPLICATION_DEPENDENCY_UNAVAILABLE",
  );
});

test("workflow owner dispatches every supported runtime query through controlled PostgreSQL functions", async () => {
  const cases = [
    {
      operation: "ReadinessGet",
      payload: {},
      sql: "SELECT etf.readiness_get() AS result",
      values: [],
      result: { readiness: { state: "Ready" } },
    },
    {
      operation: "WatchlistGet",
      payload: {},
      sql: "SELECT etf.watchlist_get() AS result",
      values: [],
      result: { orderedItems: [], version: "0" },
    },
    {
      operation: "JobGet",
      payload: { jobId: "83000000-0000-4000-8000-000000000002" },
      sql: "SELECT etf.job_get($1::uuid) AS result",
      values: ["83000000-0000-4000-8000-000000000002"],
      result: { job: { jobId: "83000000-0000-4000-8000-000000000002" } },
    },
    {
      operation: "AnalyticsResultGet",
      payload: { publicationTargetId: "83000000-0000-4000-8000-000000000003" },
      sql: "SELECT etf.analytics_result_get($1::uuid) AS result",
      values: ["83000000-0000-4000-8000-000000000003"],
      result: { result: { domain: "etf.analytics.result.v1" } },
    },
    {
      operation: "EvidenceGet",
      payload: { evidenceId: "83000000-0000-4000-8000-000000000004" },
      sql: "SELECT etf.evidence_read($1) AS result",
      values: ["83000000-0000-4000-8000-000000000004"],
      result: { evidence: { evidenceId: "83000000-0000-4000-8000-000000000004" } },
    },
    {
      operation: "PaperOrderGet",
      payload: { orderId: "83000000-0000-4000-8000-000000000005" },
      sql: "SELECT etf.paper_order_get($1::uuid) AS result",
      values: ["83000000-0000-4000-8000-000000000005"],
      result: { order: { orderId: "83000000-0000-4000-8000-000000000005" } },
    },
  ];

  for (const queryCase of cases) {
    const client = {
      async query(sql, values) {
        assert.equal(sql, queryCase.sql, queryCase.operation);
        assert.deepEqual(values, queryCase.values, queryCase.operation);
        return { rows: [{ result: queryCase.result }] };
      },
    };
    const result = await dispatchPostgresWorkflowOperation(
      client,
      { resolveFixture: () => undefined, resolveAnalytics: () => undefined },
      () => assert.fail("queries must not use the completion clock"),
      definition(queryCase.operation, "query"),
      queryCase.payload,
      undefined,
    );
    assert.deepEqual(result, queryCase.result, queryCase.operation);
    assert.equal(Object.isFrozen(result), true, queryCase.operation);
    assert.equal(Object.isFrozen(Object.values(result)[0]), true, queryCase.operation);
  }
});

test("workflow owner rejects partial PostgreSQL error-token matches", async () => {
  for (const [code, message] of [
    ["22023", "APPLICATION_REQUEST_INVALID"],
    ["22023", "ANALYTICS_INPUT_INCOMPLETE"],
    ["22023", "ANALYTICS_INTEGRITY_FAILED"],
    ["22023", "ANALYTICS_NUMERIC_CLASS_INVALID"],
    ["23505", "APPLICATION_IDEMPOTENCY_CONFLICT"],
    ["23505", "FIXTURE_IDEMPOTENCY_CONFLICT"],
    ["23505", "ANALYTICS_IDEMPOTENCY_CONFLICT"],
    ["40001", "ANALYTICS_PUBLICATION_VERSION_CONFLICT"],
    ["42501", "permission denied"],
    ["42501", "ANALYTICS_RIGHTS_RESTRICTED"],
    ["53100", "ANALYTICS_CAPACITY_BLOCKED"],
    ["P0001", "APPLICATION_JOB_MISMATCH"],
    ["P0001", "APPLICATION_JOB_NOT_COMPLETABLE"],
    ["P0001", "ANALYTICS_EVIDENCE_COMMIT_FAILED"],
    ["P0002", "APPLICATION_JOB_NOT_FOUND"],
  ]) {
    for (const [driftedCode, driftedMessage] of [
      [code, `${message}_DRIFTED`],
      ["XX000", message],
    ]) {
      await assert.rejects(
        dispatchPostgresWorkflowOperation(
          {
            async query() {
              throw Object.assign(new Error(driftedMessage), { code: driftedCode });
            },
          },
          { resolveFixture: () => fixtureArtifact, resolveAnalytics: () => undefined },
          () => "2026-09-22T10:00:02.000Z",
          definition("FixtureIngestionStart"),
          fixturePayload,
          context,
        ),
        (error) => error.code === "APPLICATION_DEPENDENCY_UNAVAILABLE",
      );
    }
  }
});
