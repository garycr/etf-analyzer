import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  checkDenialAuditCapability,
  checkLedgerIntegrity,
  checkPostgresBaseline,
  checkPostgresMigrationState,
  checkPostgresSchemaManifest,
  composePostgresReadinessChecks,
} from "../../dist/Infrastructure/PostgreSQL/readiness.js";
import { analyticsEvidenceMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/analytics-evidence.js";
import { applicationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import { controlledAccessMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/controlled-access.js";
import { denialBackendVerifierMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/denial-backend-verifier.js";
import { domainLedgerMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import { fixtureMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";

function clientReturning(row) {
  return { query: async () => ({ rows: [row] }) };
}

test("PostgreSQL 16 baseline reports ready for exact server settings", async () => {
  const result = await checkPostgresBaseline(
    clientReturning({
      identifier_collation: "C",
      server_encoding: "UTF8",
      server_version_num: "160010",
      standard_conforming_strings: "on",
      timezone: "UTC",
    }),
  );

  assert.deepEqual(result, { ready: true });
});

test("PostgreSQL connection failure returns the stable application error", async () => {
  const result = await checkPostgresBaseline({
    query: async () => {
      throw new Error("connection refused with password=do-not-log");
    },
  });

  assert.deepEqual(result, {
    errorCode: "APPLICATION_DATABASE_UNAVAILABLE",
    ready: false,
  });
});

test("PostgreSQL baseline drift fails without exposing server values", async () => {
  for (const [field, value] of [
    ["identifier_collation", "en_US.utf8"],
    ["server_encoding", "SQL_ASCII"],
    ["server_version_num", "170000"],
    ["standard_conforming_strings", "off"],
    ["timezone", "America/Chicago"],
  ]) {
    const row = {
      identifier_collation: "C",
      server_encoding: "UTF8",
      server_version_num: "160010",
      standard_conforming_strings: "on",
      timezone: "UTC",
      [field]: value,
    };

    assert.deepEqual(
      await checkPostgresBaseline(clientReturning(row)),
      { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false },
      field,
    );
  }
});

test("PostgreSQL baseline rejects empty results and versions outside major 16", async () => {
  assert.deepEqual(
    await checkPostgresBaseline({ query: async () => ({ rows: [] }) }),
    { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false },
  );

  for (const serverVersion of ["159999", "170000", "16-invalid"]) {
    assert.deepEqual(
      await checkPostgresBaseline(
        clientReturning({
          identifier_collation: "C",
          server_encoding: "UTF8",
          server_version_num: serverVersion,
          standard_conforming_strings: "on",
          timezone: "UTC",
        }),
      ),
      { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false },
      serverVersion,
    );
  }
});

test("exact empty schema prerequisite remains NotReady without a migration ledger", async () => {
  const result = await checkPostgresMigrationState(
    clientReturning({ migration_table: null }),
  );

  assert.deepEqual(result, {
    errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE",
    ready: false,
  });
});

test("CT-DB-001B migration ledger drift fails closed without repair", async (context) => {
  const canonicalRows = [
    foundationMigration,
    applicationMigration,
    domainLedgerMigration,
    fixtureMigration,
    analyticsEvidenceMigration,
    controlledAccessMigration,
    denialBackendVerifierMigration,
  ].map(({ sequence, migrationId, sql }) => ({
    sequence,
    migration_id: migrationId,
    content_hash: createHash("sha256").update(sql, "utf8").digest("hex"),
  }));
  for (const [name, migrationRows] of [
    ["missing migration 0004-fixtures", canonicalRows.filter(({ sequence }) => sequence !== 4)],
    ["duplicate migration sequence 4", [...canonicalRows, { ...canonicalRows[3], migration_id: "0004-duplicate" }]],
    ["reordered migrations 0004 and 0005", [...canonicalRows.slice(0, 3), canonicalRows[4], canonicalRows[3], ...canonicalRows.slice(5)]],
    ["unknown migration 0007-outbox", [...canonicalRows.slice(0, 6), { ...canonicalRows[6], migration_id: "0007-outbox" }]],
    ["changed migration content hash", canonicalRows.map((row) => row.sequence === 4 ? { ...row, content_hash: "0".repeat(64) } : row)],
  ]) {
    await context.test(name, async () => {
      let queryCount = 0;
      const result = await checkPostgresMigrationState({
        query: async () => {
          queryCount += 1;
          return queryCount === 1
            ? { rows: [{ migration_table: "etf.schema_migrations" }] }
            : { rows: migrationRows };
        },
      });

      assert.deepEqual(result, {
        errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE",
        ready: false,
      });
      assert.equal(queryCount, 2);
    });
  }
});

test("CT-DB-001K migration readiness accepts only the canonical seven-row ledger", async () => {
  const migrationRows = [
    foundationMigration,
    applicationMigration,
    domainLedgerMigration,
    fixtureMigration,
    analyticsEvidenceMigration,
    controlledAccessMigration,
    denialBackendVerifierMigration,
  ].map(({ sequence, migrationId, sql }) => ({
    sequence,
    migration_id: migrationId,
    content_hash: createHash("sha256").update(sql, "utf8").digest("hex"),
  }));
  let queryCount = 0;

  assert.deepEqual(await checkPostgresMigrationState({
    query: async () => {
      queryCount += 1;
      if (queryCount === 1) return { rows: [{ migration_table: "etf.schema_migrations" }] };
      if (queryCount === 2) return { rows: migrationRows };
      return { rows: [{ public_execute_count: 0 }] };
    },
  }), { ready: true });

  queryCount = 0;
  assert.deepEqual(await checkPostgresMigrationState({
    query: async () => {
      queryCount += 1;
      if (queryCount === 1) return { rows: [{ migration_table: "etf.schema_migrations" }] };
      throw new Error("password and SQL must remain redacted");
    },
  }), {
    errorCode: "APPLICATION_DATABASE_UNAVAILABLE",
    ready: false,
  });
});

test("CT-DB-001K migration readiness rejects PUBLIC function execution", async () => {
  let queryCount = 0;
  const result = await checkPostgresMigrationState({
    query: async () => {
      queryCount += 1;
      if (queryCount === 1) return { rows: [{ migration_table: "etf.schema_migrations" }] };
      if (queryCount === 2) {
        return { rows: [
          foundationMigration,
          applicationMigration,
          domainLedgerMigration,
          fixtureMigration,
          analyticsEvidenceMigration,
          controlledAccessMigration,
          denialBackendVerifierMigration,
        ].map(({ sequence, migrationId, sql }) => ({
          sequence,
          migration_id: migrationId,
          content_hash: createHash("sha256").update(sql, "utf8").digest("hex"),
        })) };
      }
      return { rows: [{ public_execute_count: 1 }] };
    },
  });

  assert.deepEqual(result, {
    errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE",
    ready: false,
  });
});

test("CT-DB-001K schema readiness rejects manifest drift and projector failure", async () => {
  const canonicalManifest = '{"contractVersion":"1.0.0-candidate.2"}';
  const manifestHash = createHash("sha256").update(canonicalManifest, "utf8").digest("hex");
  assert.deepEqual(await checkPostgresSchemaManifest(
    clientReturning({ schema_manifest_hash: "a".repeat(64) }),
    async () => canonicalManifest,
  ), {
    errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE",
    ready: false,
  });
  assert.deepEqual(await checkPostgresSchemaManifest(
    clientReturning({ schema_manifest_hash: "a".repeat(64) }),
    async () => {
      throw new Error("catalog SQL must remain redacted");
    },
  ), {
    errorCode: "APPLICATION_DATABASE_UNAVAILABLE",
    ready: false,
  });
  assert.deepEqual(await checkPostgresSchemaManifest(
    clientReturning({ schema_manifest_hash: manifestHash }),
    async () => canonicalManifest,
  ), { ready: true });
  assert.deepEqual(await checkPostgresSchemaManifest(
    clientReturning({ schema_manifest_hash: manifestHash }),
    async () => {
      throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
    },
  ), {
    errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE",
    ready: false,
  });
});

function scriptedRuntimeClient(steps) {
  const calls = [];
  let closed = false;
  return {
    calls,
    get closed() { return closed; },
    query: async (sql, parameters = []) => {
      calls.push({ sql, parameters });
      const step = steps.shift();
      if (step instanceof Error) throw step;
      return { rows: step ?? [] };
    },
    close: async () => { closed = true; },
  };
}

test("CT-DB-001K denial-audit probe uses the authenticated audit role and always rolls back", async () => {
  const runtimeClient = scriptedRuntimeClient([
    [],
    [],
    [{ session_user: "audit_runtime" }],
    [{ application_name: "etf-denial:00000000000000000000000000000000" }],
    [],
    [{ matching_backend_count: 1 }],
    [{ appended: true }],
    [],
  ]);

  assert.deepEqual(
    await checkDenialAuditCapability(async () => runtimeClient, {
      auditId: "81000000-0000-4000-8000-000000000001",
      attemptIntentId: "81000000-0000-4000-8000-000000000002",
      correlationId: "81000000-0000-4000-8000-000000000003",
      denialNonce: "00000000000000000000000000000000",
    }),
    { ready: true },
  );
  assert.match(runtimeClient.calls[0].sql, /^BEGIN$/u);
  assert.match(runtimeClient.calls[3].sql, /set_config\('application_name'/u);
  assert.match(runtimeClient.calls[5].sql, /pg_stat_activity/u);
  assert.match(runtimeClient.calls[6].sql, /etf\.audit_append/u);
  assert.match(runtimeClient.calls.at(-1).sql, /^ROLLBACK$/u);
  assert.equal(runtimeClient.closed, true);
});

test("CT-DB-001K denial-audit probe rejects role drift and redacts failures", async () => {
  for (const steps of [
    [[], [], [{ session_user: "postgres" }], []],
    [[], [], [{ session_user: "audit_runtime" }], new Error("credential and SQL leak"), []],
  ]) {
    const runtimeClient = scriptedRuntimeClient(steps);
    assert.deepEqual(
      await checkDenialAuditCapability(async () => runtimeClient),
      { errorCode: "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED", ready: false },
    );
    assert.match(runtimeClient.calls.at(-1).sql, /^ROLLBACK$/u);
    assert.equal(runtimeClient.closed, true);
  }
});

test("CT-DB-001K denial-audit probe fails readiness when rollback or close fails", async () => {
  for (const failedOperation of ["rollback", "close"]) {
    const runtimeClient = scriptedRuntimeClient([
      [],
      [],
      [{ session_user: "audit_runtime" }],
      [{ application_name: "etf-denial:00000000000000000000000000000000" }],
      [],
      [{ matching_backend_count: 1 }],
      [{ appended: true }],
      failedOperation === "rollback" ? new Error("rollback failed") : [],
    ]);
    if (failedOperation === "close") {
      runtimeClient.close = async () => { throw new Error("close failed"); };
    }

    assert.deepEqual(
      await checkDenialAuditCapability(async () => runtimeClient, {
        auditId: "81000000-0000-4000-8000-000000000001",
        attemptIntentId: "81000000-0000-4000-8000-000000000002",
        correlationId: "81000000-0000-4000-8000-000000000003",
        denialNonce: "00000000000000000000000000000000",
      }),
      { errorCode: "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED", ready: false },
      failedOperation,
    );
  }
});

test("CT-DB-001K denial-audit defaults are unique and establish bounded transaction timeouts", async () => {
  const parameterSets = [];
  for (let index = 0; index < 2; index += 1) {
    const runtimeClient = scriptedRuntimeClient([
      [],
      [],
      [{ session_user: "audit_runtime" }],
      [{ application_name: "ignored" }],
      [],
      [{ matching_backend_count: 1 }],
      [{ appended: true }],
      [],
    ]);
    await checkDenialAuditCapability(async () => runtimeClient);
    assert.match(runtimeClient.calls[1].sql, /lock_timeout/u);
    parameterSets.push(runtimeClient.calls[6].parameters);
  }
  assert.notDeepEqual(parameterSets[0], parameterSets[1]);
});

test("CT-DB-001K ledger probe is read-only and accepts an empty protected checkpoint set", async () => {
  const controlClient = clientReturning({});
  controlClient.query = async () => ({ rows: [] });
  const runtimeClient = scriptedRuntimeClient([
    [],
    [],
    [{ session_user: "projection_runtime" }],
    [],
  ]);

  assert.deepEqual(
    await checkLedgerIntegrity(controlClient, async () => runtimeClient),
    { ready: true },
  );
  assert.match(runtimeClient.calls[0].sql, /^BEGIN READ ONLY$/u);
  assert.match(runtimeClient.calls.at(-1).sql, /^ROLLBACK$/u);
  assert.equal(runtimeClient.closed, true);
});

test("CT-DB-001K ledger probe rejects an unverifiable protected checkpoint", async () => {
  const controlClient = {
    query: async () => ({ rows: [{
      portfolio_id: "82000000-0000-4000-8000-000000000001",
      portfolio_commitment: "a".repeat(64),
    }] }),
  };
  const runtimeClient = scriptedRuntimeClient([
    [],
    [],
    [{ session_user: "projection_runtime" }],
    [{ verified: false }],
    [],
  ]);

  assert.deepEqual(
    await checkLedgerIntegrity(controlClient, async () => runtimeClient),
    { errorCode: "LEDGER_INTEGRITY_FAILED", ready: false },
  );
  assert.match(runtimeClient.calls[3].sql, /etf\.anchor_append/u);
  assert.match(runtimeClient.calls.at(-1).sql, /^ROLLBACK$/u);
  assert.equal(runtimeClient.closed, true);
});

test("CT-DB-001K ledger probe fails readiness on cleanup failure and sets bounded timeouts", async () => {
  const runtimeClient = scriptedRuntimeClient([
    [],
    [],
    [{ session_user: "projection_runtime" }],
    new Error("rollback failed"),
  ]);

  assert.deepEqual(
    await checkLedgerIntegrity({ query: async () => ({ rows: [] }) }, async () => runtimeClient),
    { errorCode: "LEDGER_INTEGRITY_FAILED", ready: false },
  );
  assert.match(runtimeClient.calls[1].sql, /statement_timeout/u);
});

test("CT-DB-001K composes the four PostgreSQL-owned readiness members", async () => {
  const checkedAt = "2026-09-21T18:00:00.000Z";
  const result = await composePostgresReadinessChecks({
    checkedAt,
    controlClient: clientReturning({}),
    createAuditClient: async () => scriptedRuntimeClient([]),
    createProjectionClient: async () => scriptedRuntimeClient([]),
    checks: {
      baseline: async () => ({ ready: true }),
      denialAudit: async () => ({ ready: true }),
      ledgerIntegrity: async () => ({ errorCode: "LEDGER_INTEGRITY_FAILED", ready: false }),
      migrationState: async () => ({ ready: true }),
      schemaManifest: async () => ({ ready: true }),
    },
  });

  assert.deepEqual(result, {
    PostgreSQL: { ready: true, checkedAt },
    Migrations: { ready: true, checkedAt },
    DenialAudit: { ready: true, checkedAt },
    LedgerIntegrity: { ready: false, checkedAt, errorCode: "LEDGER_INTEGRITY_FAILED" },
  });
});

test("CT-DB-001K composer short-circuits dependent checks after structural failure", async () => {
  let dependentCalls = 0;
  const result = await composePostgresReadinessChecks({
    checkedAt: "2026-09-21T18:00:00.000Z",
    controlClient: clientReturning({}),
    createAuditClient: async () => scriptedRuntimeClient([]),
    createProjectionClient: async () => scriptedRuntimeClient([]),
    checks: {
      baseline: async () => ({ ready: true }),
      migrationState: async () => ({ errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false }),
      schemaManifest: async () => { dependentCalls += 1; return { ready: true }; },
      denialAudit: async () => { dependentCalls += 1; return { ready: true }; },
      ledgerIntegrity: async () => { dependentCalls += 1; return { ready: true }; },
    },
  });

  assert.equal(dependentCalls, 0);
  assert.deepEqual(result, {
    PostgreSQL: { ready: true, checkedAt: "2026-09-21T18:00:00.000Z" },
    Migrations: {
      ready: false,
      checkedAt: "2026-09-21T18:00:00.000Z",
      errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE",
    },
    DenialAudit: {
      ready: false,
      checkedAt: "2026-09-21T18:00:00.000Z",
      errorCode: "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
    },
    LedgerIntegrity: {
      ready: false,
      checkedAt: "2026-09-21T18:00:00.000Z",
      errorCode: "LEDGER_INTEGRITY_FAILED",
    },
  });
});

test("CT-DB-001K composer preserves connectivity versus migration drift classification", async () => {
  for (const [failedCheck, errorCode, expectedPostgresReady] of [
    ["baseline", "APPLICATION_DATABASE_UNAVAILABLE", false],
    ["baseline", "APPLICATION_MIGRATIONS_INCOMPLETE", true],
    ["migrationState", "APPLICATION_DATABASE_UNAVAILABLE", false],
    ["migrationState", "APPLICATION_MIGRATIONS_INCOMPLETE", true],
    ["schemaManifest", "APPLICATION_DATABASE_UNAVAILABLE", false],
    ["schemaManifest", "APPLICATION_MIGRATIONS_INCOMPLETE", true],
  ]) {
    const ready = async () => ({ ready: true });
    const failed = async () => ({ ready: false, errorCode });
    const result = await composePostgresReadinessChecks({
      checkedAt: "2026-09-21T18:00:00.000Z",
      controlClient: clientReturning({}),
      createAuditClient: async () => scriptedRuntimeClient([]),
      createProjectionClient: async () => scriptedRuntimeClient([]),
      checks: {
        baseline: failedCheck === "baseline" ? failed : ready,
        migrationState: failedCheck === "migrationState" ? failed : ready,
        schemaManifest: failedCheck === "schemaManifest" ? failed : ready,
        denialAudit: ready,
        ledgerIntegrity: ready,
      },
    });

    assert.equal(result.PostgreSQL.ready, expectedPostgresReady, `${failedCheck}:${errorCode}`);
    assert.equal(result.Migrations.ready, false, `${failedCheck}:${errorCode}`);
  }
});
