import assert from "node:assert/strict";
import test from "node:test";

import { startLocalRuntime } from "../../dist/Infrastructure/Local/local-runtime.js";

const config = {
  controlConnectionString: "postgresql://local-control",
  connectionString: "postgresql://local-runtime",
  port: 0,
  allowedOrigins: ["http://127.0.0.1:5173"],
  bodyLimitBytes: 1_048_576,
  requestTimeoutMs: 5_000,
  artifactRoot: "/tmp/etf-reviewed-artifacts",
  fixturePackageDirectory: "fixture",
  fixtureEvaluationAt: "2026-01-31T00:00:00.000Z",
  analyticsArtifactPath: "analytics.json",
};

test("local runtime owns startup query dispatch and idempotent shutdown", async () => {
  const events = [];
  let execute;
  const readiness = {
    state: "Ready",
    checkedAt: "2026-09-24T09:59:00.000Z",
    displayTimezone: "UTC",
    liveness: "Live",
    dependencies: [
      "PostgreSQL", "Migrations", "FixturePolicy", "LocalDependency", "DenialAudit", "LedgerIntegrity",
    ].map((dependency) => ({
      dependency,
      state: "Ready",
      checkedAt: "2026-09-24T09:59:00.000Z",
      code: null,
    })),
    controllingError: null,
  };
  const client = {
    async connect() { events.push("database-connect"); },
    async query(sql) {
      assert.equal(sql, "SELECT etf.readiness_get() AS result");
      return { rows: [{ result: { readiness } }] };
    },
    async end() { events.push("database-end"); },
  };
  const server = {
    address: () => ({ address: "127.0.0.1", family: "IPv4", port: 43123 }),
    close(callback) {
      events.push("server-close");
      callback();
      return this;
    },
  };

  const runtime = await startLocalRuntime(config, {
    createClient(connectionString) {
      assert.equal(connectionString, config.connectionString);
      return client;
    },
    async loadArtifactResolver(receivedConfig) {
      assert.equal(receivedConfig, config);
      events.push("artifacts-load");
      return { resolveFixture: () => undefined, resolveAnalytics: () => undefined };
    },
    async startServer(apiConfig, executor) {
      assert.deepEqual(apiConfig, {
        allowedOrigins: config.allowedOrigins,
        bodyLimitBytes: config.bodyLimitBytes,
        port: config.port,
        requestTimeoutMs: config.requestTimeoutMs,
      });
      execute = executor;
      events.push("server-start");
      return server;
    },
    now: () => "2026-09-24T10:00:00.000Z",
    async verifyStartup() { events.push("readiness-verify"); },
  });

  assert.deepEqual(events, ["artifacts-load", "database-connect", "readiness-verify", "server-start"]);
  assert.deepEqual(runtime.address, { host: "127.0.0.1", port: 43123 });
  const result = await execute(JSON.stringify({
    operation: "ReadinessGet",
    requestId: "81000000-0000-4000-8000-000000000101",
    correlationId: "81000000-0000-4000-8000-000000000102",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-09-24T10:00:00.000Z",
    payload: {},
  }));
  assert.equal(result.outcome, "Succeeded");
  assert.equal(result.data.readiness.state, "Ready");

  await runtime.close();
  await runtime.close();
  assert.deepEqual(events, [
    "artifacts-load", "database-connect", "readiness-verify", "server-start", "server-close", "database-end",
  ]);
});

test("local runtime cleans up failed startup resources", async () => {
  for (const [name, startServer, expectedEvents] of [
    [
      "server start failure",
      async () => { throw new Error("bind failed"); },
      ["connect", "end"],
    ],
    [
      "invalid server address",
      async () => ({
        address: () => null,
        close(callback) { this.events.push("close"); callback(); },
        events: [],
      }),
      ["connect", "close", "end"],
    ],
  ]) {
    const events = [];
    const client = {
      async connect() { events.push("connect"); },
      async query() { return { rows: [] }; },
      async end() { events.push("end"); },
    };
    await assert.rejects(startLocalRuntime(config, {
      createClient: () => client,
      loadArtifactResolver: async () => ({ resolveFixture: () => undefined, resolveAnalytics: () => undefined }),
      startServer: async (...arguments_) => {
        const server = await startServer(...arguments_);
        if (server.events !== undefined) server.events = events;
        return server;
      },
      now: () => "2026-09-24T10:00:00.000Z",
      verifyStartup: async () => undefined,
    }), undefined, name);
    assert.deepEqual(events, expectedEvents, name);
  }

  let clientCreations = 0;
  await assert.rejects(startLocalRuntime(config, {
    createClient: () => { clientCreations += 1; throw new Error("must not create"); },
    loadArtifactResolver: async () => { throw new Error("artifact failure"); },
    startServer: async () => assert.fail("must not start"),
    now: () => "2026-09-24T10:00:00.000Z",
    verifyStartup: async () => undefined,
  }), /artifact failure/);
  assert.equal(clientCreations, 0);

  const readinessEvents = [];
  await assert.rejects(startLocalRuntime(config, {
    createClient: () => ({
      async connect() { readinessEvents.push("connect"); },
      async query() { return { rows: [] }; },
      async end() { readinessEvents.push("end"); },
    }),
    loadArtifactResolver: async () => ({ resolveFixture: () => undefined, resolveAnalytics: () => undefined }),
    startServer: async () => { readinessEvents.push("server-start"); throw new Error("must not start"); },
    now: () => "2026-09-24T10:00:00.000Z",
    verifyStartup: async () => {
      readinessEvents.push("readiness-failed");
      throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
    },
  }), /APPLICATION_MIGRATIONS_INCOMPLETE/);
  assert.deepEqual(readinessEvents, ["connect", "readiness-failed", "end"]);
});

test("local runtime routes paper-order commands to the paper-order owner", async () => {
  let execute;
  let paperDispatches = 0;
  let workflowDispatches = 0;
  const client = {
    async connect() {},
    async end() {},
    async query(sql) {
      if (sql.includes("application_replay_get(")) return { rows: [{ result: null }] };
      if (sql.includes("application_replay_get_or_put")) return { rows: [{ result: {} }] };
      return { rows: [] };
    },
  };
  const runtime = await startLocalRuntime(config, {
    createClient: () => client,
    loadArtifactResolver: async () => ({ resolveFixture: () => undefined, resolveAnalytics: () => undefined }),
    startServer: async (_apiConfig, executor) => {
      execute = executor;
      return {
        address: () => ({ address: "127.0.0.1", family: "IPv4", port: 43123 }),
        close(callback) { callback(); },
      };
    },
    now: () => "2026-09-24T10:00:01.000Z",
    verifyStartup: async () => undefined,
    dispatchPaperOrder: async () => {
      paperDispatches += 1;
      throw new Error("controlled paper owner failure");
    },
    dispatchWorkflow: async () => {
      workflowDispatches += 1;
      throw new Error("wrong owner");
    },
  });
  const result = await execute(JSON.stringify({
    operation: "PaperOrderDraftCreate",
    requestId: "81000000-0000-4000-8000-000000000201",
    correlationId: "81000000-0000-4000-8000-000000000202",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-09-24T10:00:00.000Z",
    commandId: "81000000-0000-4000-8000-000000000203",
    payload: {
      orderId: "81000000-0000-4000-8000-000000000204",
      instrumentId: "ETF-1",
      researchEvidenceId: "81000000-0000-4000-8000-000000000205",
      side: "Buy",
      quantity: "1.0000000000",
      unitPrice: "100.0000000000",
      tradeDate: "2026-09-24",
    },
  }));
  assert.equal(result.outcome, "Failed");
  assert.equal(paperDispatches, 1);
  assert.equal(workflowDispatches, 0);
  await runtime.close();
});
