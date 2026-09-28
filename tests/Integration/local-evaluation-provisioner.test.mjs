import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import pg from "pg";

import { loadLocalArtifactResolver } from "../../dist/Infrastructure/Local/artifact-loader.js";
import {
  provisionLocalEvaluation,
  writeLocalEvaluationArtifacts,
} from "../../dist/Infrastructure/Local/local-evaluation-provisioner.js";
import { composePostgresReadinessChecks } from "../../dist/Infrastructure/PostgreSQL/readiness.js";
import { productRoles } from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const adminConnectionString = process.env.ETF_TEST_POSTGRES_URL;
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

test(
  "local evaluation provisioner creates the canonical runnable database and artifacts",
  { skip: !adminConnectionString },
  async (context) => {
    const artifactRoot = await mkdtemp(path.join(os.tmpdir(), "etf-live-evaluation-"));
    const admin = new pg.Client({ connectionString: adminConnectionString });
    context.after(() => rm(artifactRoot, { force: true, recursive: true }));
    await admin.connect();
    await admin.query(lockSql);
    await cleanBootstrap(admin);
    context.after(async () => {
      await cleanBootstrap(admin).catch(() => undefined);
      await admin.query(unlockSql).catch(() => undefined);
      await admin.end().catch(() => undefined);
    });

    await writeLocalEvaluationArtifacts(artifactRoot);
    await assert.rejects(
      provisionLocalEvaluation({
        adminConnectionString,
        appliedAt: "2026-09-27T00:00:00.000Z",
        artifactRoot,
        async composeReadiness() {
          return {
            PostgreSQL: { ready: true, checkedAt: "2026-09-27T00:00:00.000Z" },
            Migrations: { ready: true, checkedAt: "2026-09-27T00:00:00.000Z" },
            DenialAudit: {
              ready: false,
              checkedAt: "2026-09-27T00:00:00.000Z",
              errorCode: "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
            },
            LedgerIntegrity: { ready: true, checkedAt: "2026-09-27T00:00:00.000Z" },
          };
        },
      }),
      /ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED/u,
    );
    assert.equal(
      (await admin.query("SELECT count(*)::integer AS count FROM etf.readiness_audit")).rows[0]?.count,
      0,
    );
    await cleanBootstrap(admin);

    let composeCalls = 0;
    await provisionLocalEvaluation({
      adminConnectionString,
      appliedAt: "2026-09-27T00:00:00.000Z",
      artifactRoot,
      async composeReadiness(options) {
        composeCalls += 1;
        return composePostgresReadinessChecks(options);
      },
    });
    assert.equal(composeCalls, 1);
    const artifacts = await writeLocalEvaluationArtifacts(artifactRoot);
    const anchor = await admin.query(
      "SELECT encode(key_ciphertext, 'hex') AS key_ciphertext FROM etf.anchor_keys WHERE key_identifier = 'primary'",
    );
    assert.notEqual(anchor.rows[0]?.key_ciphertext, "00112233445566778899aabbccddeeff");
    assert.match(anchor.rows[0]?.key_ciphertext, /^[0-9a-f]{64}$/u);
    const runtimeConnectionString = new URL(adminConnectionString);
    runtimeConnectionString.username = "app_runtime";
    runtimeConnectionString.password = "";
    const runtime = new pg.Client({ connectionString: runtimeConnectionString.toString() });
    await runtime.connect();
    context.after(() => runtime.end());

    const identity = await runtime.query(
      "SELECT session_user::text AS session_user, etf.readiness_get() AS result",
    );
    assert.equal(identity.rows[0]?.session_user, "app_runtime");
    assert.equal(identity.rows[0]?.result.readiness.state, "Ready");
    assert.deepEqual(
      identity.rows[0]?.result.readiness.dependencies.map(({ dependency, state }) => [dependency, state]),
      [
        ["PostgreSQL", "Ready"],
        ["Migrations", "Ready"],
        ["FixturePolicy", "Ready"],
        ["LocalDependency", "Ready"],
        ["DenialAudit", "Ready"],
        ["LedgerIntegrity", "Ready"],
      ],
    );

    const resolver = await loadLocalArtifactResolver({
      artifactRoot,
      fixturePackageDirectory: "fixture",
      fixtureEvaluationAt: "2026-01-31T00:00:00.000Z",
      analyticsArtifactPath: "analytics.json",
    });
    assert.notEqual(resolver.resolveFixture({
      datasetId: artifacts.datasetId,
      datasetVersion: artifacts.datasetVersion,
      fixturePackageHash: "5c68a8c394aecb6e27833f4216bfcd5f5c724e3aff6cfad7980192ec8d1e0b68",
      jobId: "81000000-0000-4000-8000-000000000001",
    }), undefined);
    assert.notEqual(resolver.resolveAnalytics({ configurationHash: artifacts.configurationHash }), undefined);
  },
);
