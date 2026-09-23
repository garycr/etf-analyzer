import assert from "node:assert/strict";
import http from "node:http";
import { performance } from "node:perf_hooks";
import test from "node:test";

import pg from "pg";

import { evaluateReadiness } from "../../dist/Application/application-boundary.js";
import { startLoopbackApiServer } from "../../dist/Infrastructure/Http/api-adapter.js";
import { evaluatePrototypeOperations } from "../../dist/Infrastructure/Operations/prototype-operations.js";
import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import { analyticsEvidenceMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/analytics-evidence.js";
import { applicationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import { controlledAccessMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/controlled-access.js";
import { denialBackendVerifierMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/denial-backend-verifier.js";
import { domainLedgerMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import { fixtureMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
import { projectPostgresSchemaManifest } from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";
import { createRoleBootstrapSql, productRoles } from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const lockSql = "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const unlockSql = "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";

async function cleanBootstrap(client) {
  await client.query("ROLLBACK").catch(() => undefined);
  await client.query("RESET SESSION AUTHORIZATION").catch(() => undefined);
  await client.query("RESET ROLE").catch(() => undefined);
  await client.query("DROP SCHEMA IF EXISTS etf CASCADE");
  const existing = await client.query(
    "SELECT rolname FROM pg_catalog.pg_roles WHERE rolname = ANY($1::text[])",
    [productRoles.map(({ name }) => name)],
  );
  const roleNames = existing.rows.map(({ rolname }) => rolname);
  if (roleNames.length > 0) {
    await client.query(`DROP OWNED BY ${roleNames.join(", ")}`);
    await client.query(`DROP ROLE ${roleNames.join(", ")}`);
  }
  await client.query(
    "DO $cleanup$ BEGIN EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO PUBLIC', current_database()); END $cleanup$;",
  );
}

async function applyCompleteMigrationSet(client) {
  await client.query(createRoleBootstrapSql());
  const migrations = [
    foundationMigration,
    applicationMigration,
    domainLedgerMigration,
    fixtureMigration,
    analyticsEvidenceMigration,
    controlledAccessMigration,
    denialBackendVerifierMigration,
  ];
  for (const [index, migration] of migrations.entries()) {
    await applyMigration(
      client,
      migration,
      `2026-09-23T12:0${index}:00.000Z`,
      projectPostgresSchemaManifest,
    );
  }
}

function send(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      method: "GET",
      path,
      headers: { host: `127.0.0.1:${port}`, ...headers },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        body: Buffer.concat(chunks).toString("utf8"),
        status: response.statusCode,
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

test(
  "PT-OPS-001 exposes readiness recovery redaction and Golden Signals evidence",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const checkedAt = "2026-09-23T12:10:00.000Z";
    const ready = evaluateReadiness({
      checkedAt,
      liveness: "Live",
      dependencies: Object.fromEntries([
        "PostgreSQL",
        "Migrations",
        "FixturePolicy",
        "LocalDependency",
        "DenialAudit",
        "LedgerIntegrity",
      ].map((dependency) => [dependency, { ready: true, checkedAt }])),
    });
    const notReady = evaluateReadiness({
      checkedAt,
      liveness: "Live",
      dependencies: {
        PostgreSQL: { ready: false, checkedAt, errorCode: "APPLICATION_DATABASE_UNAVAILABLE" },
        Migrations: { ready: true, checkedAt },
        FixturePolicy: { ready: true, checkedAt },
        LocalDependency: { ready: true, checkedAt },
        DenialAudit: { ready: true, checkedAt },
        LedgerIntegrity: { ready: true, checkedAt },
      },
    });
    let readiness = notReady;
    let server;
    let locked = false;
    try {
      await client.connect();
      await client.query(lockSql);
      locked = true;
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      const execute = (requestJson) => {
        const request = JSON.parse(requestJson);
        assert.equal(request.operation, "ReadinessGet");
        return { operation: "ReadinessGet", outcome: "Succeeded", data: { readiness } };
      };
      server = await startLoopbackApiServer(
        { allowedOrigins: ["http://127.0.0.1:5173"], bodyLimitBytes: 1_048_576, port: 0 },
        execute,
        () => ({ readiness }),
      );
      const address = server.address();
      assert.notEqual(address, null);
      assert.equal(typeof address, "object");
      const port = address.port;

      const degraded = await send(port, "/", { accept: "text/html" });
      assert.equal(degraded.status, 200);
      assert.match(degraded.body, /Status: <\/span>NotReady/);
      assert.match(degraded.body, /Recovery: Review readiness details/);
      assert.doesNotMatch(degraded.body, /password|secret|token|postgresql:\/\//iu);
          const databasePassword = connectionString === undefined
            ? undefined
            : new URL(connectionString).password;
          assert.equal(degraded.body.includes(connectionString), false);
          assert.equal(degraded.body.includes(databasePassword), false);
      readiness = ready;

      const dashboardDurationsMs = [];
      const apiDurationsMs = [];
      let unexpectedServerErrorCount = 0;
      const cpuStarted = process.cpuUsage();
      const wallStarted = performance.now();
      let dashboardResponse;
      for (let index = 0; index < 25; index += 1) {
        const startedAt = performance.now();
        dashboardResponse = await send(port, "/", { accept: "text/html" });
        dashboardDurationsMs.push(performance.now() - startedAt);
        if ((dashboardResponse.status ?? 500) >= 500) unexpectedServerErrorCount += 1;
        assert.equal(dashboardResponse.status, 200);
      }
      assert.match(dashboardResponse.body, /Status: <\/span>Ready/);
      assert.doesNotMatch(dashboardResponse.body, /password|secret|token/iu);
          assert.equal(dashboardResponse.body.includes(connectionString), false);
          assert.equal(dashboardResponse.body.includes(databasePassword), false);

      for (let index = 0; index < 25; index += 1) {
        const startedAt = performance.now();
        const response = await send(port, "/api/v1/readiness", {
          accept: "application/json",
          origin: `http://127.0.0.1:${port}`,
          "x-request-id": `82000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          "x-correlation-id": `83000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          "x-requested-at": checkedAt,
        });
        apiDurationsMs.push(performance.now() - startedAt);
        if ((response.status ?? 500) >= 500) unexpectedServerErrorCount += 1;
        assert.equal(response.status, 200);
        assert.doesNotMatch(response.body, /password|secret|token/iu);
            assert.equal(response.body.includes(connectionString), false);
            assert.equal(response.body.includes(databasePassword), false);
      }

      const observations = (await client.query(
        `SELECT capacity.managed_bytes::float8,
                capacity.capacity_bytes::float8,
                current_setting('max_connections')::integer AS max_connections,
                (SELECT count(*)::integer
                   FROM pg_catalog.pg_stat_activity
                  WHERE datname = current_database()) AS connections,
                (SELECT count(*)::integer
                   FROM pg_catalog.pg_class AS relation
                   JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
                  WHERE namespace.nspname = 'etf'
                    AND (relation.relname LIKE '%queue%' OR relation.relname LIKE '%outbox%')) AS handoff_objects
           FROM etf.analytics_capacity_admission AS capacity
          WHERE capacity.singleton_key = 'analytics'`,
      )).rows[0];
      const cpuUsed = process.cpuUsage(cpuStarted);
      const elapsedMicros = (performance.now() - wallStarted) * 1_000;
      const result = evaluatePrototypeOperations({
        apiDurationsMs,
        cpuPercent: Number((((cpuUsed.user + cpuUsed.system) / elapsedMicros) * 100).toFixed(2)),
        dashboardDurationsMs,
        databaseConnections: observations.connections,
        databaseMaxConnections: observations.max_connections,
        evidenceCapacityBytes: observations.capacity_bytes,
        evidenceManagedBytes: observations.managed_bytes,
        expectedWorkflowCounts: {},
        hashMismatchCount: 0,
        memoryBytes: process.memoryUsage().rss,
        queueOrOutboxObjectCount: observations.handoff_objects,
        reconciliationDifferenceCount: 0,
        unexpectedServerErrorCount,
        unresolvedIntentCount: 0,
        workflowCounts: {},
      });

      assert.equal(result.status, "Pass", JSON.stringify(result));
      assert.ok(result.goldenSignals.latency.apiP95Ms < 1_000);
      assert.ok(result.goldenSignals.latency.dashboardP95Ms < 2_000);
      assert.ok(result.goldenSignals.saturation.evidenceCapacityUtilizationPercent < 80);
      assert.ok(result.goldenSignals.saturation.databaseConnectionUtilizationPercent < 100);
    } finally {
      if (server !== undefined) await new Promise((resolve) => server.close(resolve));
      try {
        if (locked) await cleanBootstrap(client);
      } finally {
        if (locked) await client.query(unlockSql).catch(() => undefined);
        await client.end();
      }
    }
  },
);
