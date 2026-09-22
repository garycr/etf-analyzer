import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import pg from "pg";

import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import { applicationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import { analyticsEvidenceMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/analytics-evidence.js";
import { controlledAccessMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/controlled-access.js";
import { denialBackendVerifierMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/denial-backend-verifier.js";
import { domainLedgerMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import { fixtureMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
import { projectPostgresSchemaManifest } from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";
import {
  createRoleBootstrapSql,
  productRoles,
} from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const lockSql =
  "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const unlockSql =
  "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const firstSixMigrations = [
  foundationMigration,
  applicationMigration,
  domainLedgerMigration,
  fixtureMigration,
  analyticsEvidenceMigration,
  controlledAccessMigration,
];

async function cleanBootstrap(client) {
  await client.query("ROLLBACK").catch(() => undefined);
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

async function applyThroughSequenceSix(client) {
  await client.query(createRoleBootstrapSql());
  for (const [index, migration] of firstSixMigrations.entries()) {
    await applyMigration(
      client,
      migration,
      `2026-09-21T01:0${index}:00.000Z`,
      projectPostgresSchemaManifest,
    );
  }
}

async function functionState(client) {
  const result = await client.query(
    `SELECT function_record.proname AS name, owner.rolname AS owner,
            function_record.oid::text AS oid,
            pg_catalog.pg_get_functiondef(function_record.oid) AS definition
       FROM pg_catalog.pg_proc AS function_record
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
       JOIN pg_catalog.pg_roles AS owner ON owner.oid = function_record.proowner
      WHERE namespace.nspname = 'etf'
        AND function_record.proname IN ('audit_append', 'denial_backend_matches')
      ORDER BY function_record.proname`,
  );
  return result.rows;
}

test(
  "0007 rolls back helper and audit replacement when manifest projection fails",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyThroughSequenceSix(client);
      const before = await functionState(client);

      await assert.rejects(
        () => applyMigration(
          client,
          denialBackendVerifierMigration,
          "2026-09-21T01:06:00.000Z",
          async (transaction, migration) => {
            await projectPostgresSchemaManifest(transaction, migration);
            throw new Error("FORCED_VERIFIER_MANIFEST_FAILURE");
          },
        ),
        /FORCED_VERIFIER_MANIFEST_FAILURE/u,
      );

      assert.deepEqual(await functionState(client), before);
      const ledger = await client.query(
        "SELECT count(*)::integer AS count FROM etf.schema_migrations",
      );
      assert.deepEqual(ledger.rows, [{ count: 6 }]);
    } finally {
      await cleanBootstrap(client).catch(() => undefined);
      await client.query(unlockSql).catch(() => undefined);
      await client.end();
    }
  },
);

test(
  "0007 installs exact verifier function authority and replays without mutation",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyThroughSequenceSix(client);
      const applied = await applyMigration(
        client,
        denialBackendVerifierMigration,
        "2026-09-21T01:06:00.000Z",
        projectPostgresSchemaManifest,
      );
      assert.equal(applied.applied, true);

      const functions = await functionState(client);
      assert.equal(functions.length, 2);
      const audit = functions.find(({ name }) => name === "audit_append");
      const verifier = functions.find(({ name }) => name === "denial_backend_matches");
      assert.equal(verifier?.owner, "audit_activity_verifier_owner");
      assert.match(audit?.definition ?? "", /etf\.denial_backend_matches/u);
      assert.doesNotMatch(audit?.definition ?? "", /FROM pg_catalog\.pg_stat_activity/iu);

      const authority = await client.query(
        `SELECT role_name,
                pg_catalog.has_function_privilege(
                  role_name,
                  'etf.denial_backend_matches(integer,timestamp with time zone,text,text)',
                  'EXECUTE'
                ) AS can_execute
           FROM pg_catalog.unnest($1::text[]) AS role_name
          ORDER BY role_name`,
        [productRoles.map(({ name }) => name)],
      );
      assert.deepEqual(
        authority.rows.filter(({ can_execute }) => can_execute).map(({ role_name }) => role_name),
        ["audit_activity_verifier_owner", "audit_writer_owner"],
      );
      const closedAuthority = await client.query(
        `SELECT
           pg_catalog.has_schema_privilege('audit_activity_verifier_owner', 'etf', 'USAGE') AS schema_usage,
           pg_catalog.has_schema_privilege('audit_activity_verifier_owner', 'etf', 'CREATE') AS schema_create,
           pg_catalog.pg_has_role('audit_writer_owner', 'pg_read_all_stats', 'MEMBER') AS audit_stats_role`,
      );
      assert.deepEqual(closedAuthority.rows, [{
        schema_usage: false,
        schema_create: false,
        audit_stats_role: false,
      }]);

      const replayed = await applyMigration(
        client,
        denialBackendVerifierMigration,
        "2026-09-21T01:07:00.000Z",
        projectPostgresSchemaManifest,
      );
      assert.equal(replayed.applied, false);
      assert.deepEqual(await functionState(client), functions);
    } finally {
      await cleanBootstrap(client).catch(() => undefined);
      await client.query(unlockSql).catch(() => undefined);
      await client.end();
    }
  },
);

test(
  "0007 replay rejects current catalog drift",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyThroughSequenceSix(client);
      await applyMigration(
        client,
        denialBackendVerifierMigration,
        "2026-09-21T01:06:00.000Z",
        projectPostgresSchemaManifest,
      );
      await client.query(
        "ALTER FUNCTION etf.denial_backend_matches(integer, timestamp with time zone, text, text) OWNER TO schema_owner",
      );

      await assert.rejects(
        () => applyMigration(
          client,
          denialBackendVerifierMigration,
          "2026-09-21T01:07:00.000Z",
          projectPostgresSchemaManifest,
        ),
        /APPLICATION_MIGRATIONS_INCOMPLETE/u,
      );
    } finally {
      await cleanBootstrap(client).catch(() => undefined);
      await client.query(unlockSql).catch(() => undefined);
      await client.end();
    }
  },
);

test(
  "0007 verifier exposes only exact boolean correlation through closed authority",
  { skip: !connectionString },
  async () => {
    const admin = new pg.Client({ connectionString });
    let runtime;
    await admin.connect();
    await admin.query(lockSql);
    try {
      await cleanBootstrap(admin);
      await applyThroughSequenceSix(admin);
      await applyMigration(
        admin,
        denialBackendVerifierMigration,
        "2026-09-21T01:06:00.000Z",
        projectPostgresSchemaManifest,
      );

      await admin.query("ALTER ROLE app_runtime PASSWORD 'verifier-test-password'");
      const runtimeUrl = new URL(connectionString);
      runtimeUrl.username = "app_runtime";
      runtimeUrl.password = "verifier-test-password";
      runtime = new pg.Client({ connectionString: runtimeUrl.toString() });
      await runtime.connect();
      const nonce = "0123456789abcdef0123456789abcdef";
      await runtime.query(`SET application_name = 'etf-denial:${nonce}'`);
      const pid = (await runtime.query(
        "SELECT pg_catalog.pg_backend_pid() AS pid",
      )).rows[0].pid;
      const backend = (await admin.query(
        `SELECT backend_start::text AS backend_start, usename, application_name
           FROM pg_catalog.pg_stat_activity
          WHERE pid = $1`,
        [pid],
      )).rows[0];
      assert.equal(backend.usename, "app_runtime");
      assert.equal(backend.application_name, `etf-denial:${nonce}`);

      await admin.query("SET ROLE audit_writer_owner");
      const verify = async (values) => admin.query(
        "SELECT etf.denial_backend_matches($1, $2, $3, $4) AS matches",
        values,
      );
      const exact = await verify([
        pid,
        backend.backend_start,
        "app_runtime",
        `etf-denial:${nonce}`,
      ]);
      assert.deepEqual(exact.fields.map(({ name }) => name), ["matches"]);
      assert.deepEqual(exact.rows, [{ matches: true }]);
      for (const mismatch of [
        [pid + 1, backend.backend_start, "app_runtime", `etf-denial:${nonce}`],
        [pid, "2000-01-01 00:00:00+00", "app_runtime", `etf-denial:${nonce}`],
        [pid, backend.backend_start, "projection_runtime", `etf-denial:${nonce}`],
        [pid, backend.backend_start, "app_runtime", `etf-denial:${"f".repeat(32)}`],
      ]) {
        assert.deepEqual((await verify(mismatch)).rows, [{ matches: false }]);
      }
      await admin.query("RESET ROLE");

      const verifierSetRoles = new Set([
        "deployment_login",
        "migration_executor",
        "migration_owner",
        "audit_activity_verifier_owner",
      ]);
      for (const { name: role } of productRoles) {
        await admin.query(`SET SESSION AUTHORIZATION ${role}`);
        try {
          if (verifierSetRoles.has(role)) {
            await admin.query("SET ROLE audit_activity_verifier_owner");
            await admin.query("RESET ROLE");
          } else {
            await assert.rejects(
              () => admin.query("SET ROLE audit_activity_verifier_owner"),
              (error) => error.code === "42501",
            );
          }
          await assert.rejects(
            () => admin.query("SET ROLE pg_read_all_stats"),
            (error) => error.code === "42501",
          );
        } finally {
          await admin.query("RESET ROLE").catch(() => undefined);
          await admin.query("RESET SESSION AUTHORIZATION");
        }
      }

      const deniedRoles = productRoles
        .map(({ name }) => name)
        .filter((name) => ![
          "audit_activity_verifier_owner",
          "audit_writer_owner",
        ].includes(name));
      for (const role of deniedRoles) {
        await admin.query(`SET SESSION AUTHORIZATION ${role}`);
        try {
          await assert.rejects(
            () => admin.query(
              "SELECT etf.denial_backend_matches($1, $2, $3, $4)",
              [pid, backend.backend_start, "app_runtime", `etf-denial:${nonce}`],
            ),
            (error) => error.code === "42501",
          );
        } finally {
          await admin.query("RESET SESSION AUTHORIZATION");
        }
      }

      await runtime.end();
      runtime = undefined;
      await admin.query("SET ROLE audit_writer_owner");
      const vanished = await admin.query(
        "SELECT etf.denial_backend_matches($1, $2, $3, $4) AS matches",
        [pid, backend.backend_start, "app_runtime", `etf-denial:${nonce}`],
      );
      assert.deepEqual(vanished.rows, [{ matches: false }]);
      await admin.query("RESET ROLE");
    } finally {
      await runtime?.end().catch(() => undefined);
      await cleanBootstrap(admin).catch(() => undefined);
      await admin.query(unlockSql).catch(() => undefined);
      await admin.end();
    }
  },
);

test(
  "CT-DB-001D conflicting denial deduplication content fails closed without mutation",
  { skip: !connectionString },
  async () => {
    const admin = new pg.Client({ connectionString });
    let deniedRuntime;
    let auditRuntime;
    let concurrentAuditRuntime;
    await admin.connect();
    await admin.query(lockSql);
    try {
      await cleanBootstrap(admin);
      await applyThroughSequenceSix(admin);
      await applyMigration(
        admin,
        denialBackendVerifierMigration,
        "2026-09-21T01:06:00.000Z",
        projectPostgresSchemaManifest,
      );
      await admin.query(
        "INSERT INTO etf.anchor_keys VALUES ('primary', decode('00112233445566778899aabbccddeeff', 'hex'), '2026-09-21T00:00:00.000Z', NULL)",
      );

      const deniedPassword = randomBytes(24).toString("hex");
      const auditPassword = randomBytes(24).toString("hex");
      await admin.query(`ALTER ROLE app_runtime PASSWORD '${deniedPassword}'`);
      await admin.query(`ALTER ROLE audit_runtime PASSWORD '${auditPassword}'`);
      const deniedUrl = new URL(connectionString);
      deniedUrl.username = "app_runtime";
      deniedUrl.password = deniedPassword;
      deniedRuntime = new pg.Client({ connectionString: deniedUrl.toString() });
      await deniedRuntime.connect();
      const nonce = randomBytes(16).toString("hex");
      await deniedRuntime.query("SELECT pg_catalog.set_config('application_name', $1, false)", [`etf-denial:${nonce}`]);
      const backend = (await admin.query(
        `SELECT pid, backend_start::text AS backend_start
           FROM pg_catalog.pg_stat_activity
          WHERE pid = $1`,
        [(await deniedRuntime.query("SELECT pg_catalog.pg_backend_pid() AS pid")).rows[0].pid],
      )).rows[0];

      const auditUrl = new URL(connectionString);
      auditUrl.username = "audit_runtime";
      auditUrl.password = auditPassword;
      auditRuntime = new pg.Client({ connectionString: auditUrl.toString() });
      await auditRuntime.connect();
      concurrentAuditRuntime = new pg.Client({ connectionString: auditUrl.toString() });
      await concurrentAuditRuntime.connect();
      await concurrentAuditRuntime.query("SET TIME ZONE 'America/New_York'");
      const payload = {
        action: "EvidenceRead",
        attemptIntentId: "82000000-0000-4000-8000-000000000001",
        correlationId: "82000000-0000-4000-8000-000000000002",
        domain: "Denial",
        keyIdentifier: "primary",
        outcome: "PermissionDenied",
        subject: {
          auditId: "82000000-0000-4000-8000-000000000003",
          originalBackendPid: backend.pid,
          backendStart: backend.backend_start,
          originalSessionUser: "app_runtime",
          denialNonce: nonce,
          objectClass: "function",
          objectName: "etf.evidence_read",
          denialCode: "PermissionDenied",
          deniedAt: "2026-09-21T02:00:00.000Z",
        },
      };
      const original = (await auditRuntime.query(
        "SELECT etf.audit_append($1::jsonb) AS result",
        [payload],
      )).rows[0].result;
      const before = (await admin.query(
        `SELECT
           (SELECT count(*)::integer FROM etf.access_denial_audit) AS denials,
           (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments,
           (SELECT count(*)::integer FROM etf.audit_anchor_checkpoints) AS checkpoints`,
      )).rows;
      assert.deepEqual(
        (await auditRuntime.query(
          "SELECT etf.audit_append($1::jsonb) AS result",
          [{
            ...payload,
            subject: {
              ...payload.subject,
              auditId: "82000000-0000-4000-8000-000000000004",
            },
          }],
        )).rows[0].result,
        original,
      );
      assert.deepEqual((await admin.query(
        `SELECT
           (SELECT count(*)::integer FROM etf.access_denial_audit) AS denials,
           (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments,
           (SELECT count(*)::integer FROM etf.audit_anchor_checkpoints) AS checkpoints`,
      )).rows, before);

      await assert.rejects(
        () => auditRuntime.query("SELECT etf.audit_append($1::jsonb)", [{
          ...payload,
          subject: {
            ...payload.subject,
            auditId: "82000000-0000-4000-8000-000000000005",
            deniedAt: "2026-09-21T02:00:01.000Z",
          },
        }]),
        (error) => error.code === "55000" && error.message === "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
      );
      assert.deepEqual((await admin.query(
        `SELECT
           (SELECT count(*)::integer FROM etf.access_denial_audit) AS denials,
           (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments,
           (SELECT count(*)::integer FROM etf.audit_anchor_checkpoints) AS checkpoints`,
      )).rows, before);

      const concurrentPayload = {
        ...payload,
        attemptIntentId: "82000000-0000-4000-8000-000000000006",
        correlationId: "82000000-0000-4000-8000-000000000007",
        subject: {
          ...payload.subject,
          auditId: "82000000-0000-4000-8000-000000000008",
          deniedAt: "2026-09-21T02:00:02.000Z",
        },
      };
      const concurrentBefore = before[0];
      const concurrentResults = await Promise.all([
        auditRuntime.query("SELECT etf.audit_append($1::jsonb) AS result", [concurrentPayload]),
        concurrentAuditRuntime.query("SELECT etf.audit_append($1::jsonb) AS result", [{
          ...concurrentPayload,
          subject: {
            ...concurrentPayload.subject,
            auditId: "82000000-0000-4000-8000-000000000009",
            backendStart: concurrentPayload.subject.backendStart
              .replace(" ", "T")
              .replace(/\+00$/u, "Z"),
          },
        }]),
      ]);
      assert.deepEqual(concurrentResults[1].rows[0].result, concurrentResults[0].rows[0].result);
      assert.deepEqual((await admin.query(
        `SELECT
           (SELECT count(*)::integer FROM etf.access_denial_audit) AS denials,
           (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments,
           (SELECT count(*)::integer FROM etf.audit_anchor_checkpoints) AS checkpoints`,
      )).rows, [{
        denials: concurrentBefore.denials + 1,
        commitments: concurrentBefore.commitments + 1,
        checkpoints: concurrentBefore.checkpoints + 1,
      }]);
    } finally {
      await deniedRuntime?.end().catch(() => undefined);
      await auditRuntime?.end().catch(() => undefined);
      await concurrentAuditRuntime?.end().catch(() => undefined);
      await cleanBootstrap(admin).catch(() => undefined);
      await admin.query(unlockSql).catch(() => undefined);
      await admin.end();
    }
  },
);

test(
  "CT-DB-001D denial binding accepts only a live matching backend",
  { skip: !connectionString },
  async (context) => {
    const admin = new pg.Client({ connectionString });
    const runtimeClients = [];
    let auditRuntime;
    await admin.connect();
    await admin.query(lockSql);
    try {
      await cleanBootstrap(admin);
      await applyThroughSequenceSix(admin);
      await applyMigration(
        admin,
        denialBackendVerifierMigration,
        "2026-09-21T01:06:00.000Z",
        projectPostgresSchemaManifest,
      );
      await admin.query(
        "INSERT INTO etf.anchor_keys VALUES ('primary', decode('00112233445566778899aabbccddeeff', 'hex'), '2026-09-21T00:00:00.000Z', NULL)",
      );

      const runtimePassword = randomBytes(24).toString("hex");
      const auditPassword = randomBytes(24).toString("hex");
      await admin.query(`ALTER ROLE app_runtime PASSWORD '${runtimePassword}'`);
      await admin.query(`ALTER ROLE audit_runtime PASSWORD '${auditPassword}'`);
      const connectRuntime = async (nonce) => {
        const runtimeUrl = new URL(connectionString);
        runtimeUrl.username = "app_runtime";
        runtimeUrl.password = runtimePassword;
        const runtime = new pg.Client({ connectionString: runtimeUrl.toString() });
        await runtime.connect();
        runtimeClients.push(runtime);
        await runtime.query("SELECT pg_catalog.set_config('application_name', $1, false)", [`etf-denial:${nonce}`]);
        const pid = (await runtime.query("SELECT pg_catalog.pg_backend_pid() AS pid")).rows[0].pid;
        return (await admin.query(
          "SELECT pid, backend_start::text AS backend_start FROM pg_catalog.pg_stat_activity WHERE pid = $1",
          [pid],
        )).rows[0];
      };
      const activeNonce = randomBytes(16).toString("hex");
      const activeBackend = await connectRuntime(activeNonce);
      const vanishedNonce = randomBytes(16).toString("hex");
      const vanishedBackend = await connectRuntime(vanishedNonce);
      await runtimeClients.pop().end();

      const auditUrl = new URL(connectionString);
      auditUrl.username = "audit_runtime";
      auditUrl.password = auditPassword;
      auditRuntime = new pg.Client({ connectionString: auditUrl.toString() });
      await auditRuntime.connect();
      let identity = 10;
      const payload = (overrides = {}) => ({
        action: "EvidenceRead",
        attemptIntentId: `83000000-0000-4000-8000-${String(identity++).padStart(12, "0")}`,
        correlationId: `83000000-0000-4000-8000-${String(identity++).padStart(12, "0")}`,
        domain: "Denial",
        keyIdentifier: "primary",
        outcome: "PermissionDenied",
        subject: {
          auditId: `83000000-0000-4000-8000-${String(identity++).padStart(12, "0")}`,
          originalBackendPid: activeBackend.pid,
          backendStart: activeBackend.backend_start,
          originalSessionUser: "app_runtime",
          denialNonce: activeNonce,
          objectClass: "function",
          objectName: "etf.evidence_read",
          denialCode: "PermissionDenied",
          deniedAt: "2026-09-21T02:10:00.000Z",
          ...overrides,
        },
      });
      const snapshot = async () => (await admin.query(
        `SELECT
           (SELECT count(*)::integer FROM etf.access_denial_audit) AS denials,
           (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments,
           (SELECT count(*)::integer FROM etf.audit_anchor_checkpoints) AS checkpoints`,
      )).rows;

      for (const [name, overrides] of [
        ["original backend vanished", {
          originalBackendPid: vanishedBackend.pid,
          backendStart: vanishedBackend.backend_start,
          denialNonce: vanishedNonce,
        }],
        ["backend PID reused with new start", {
          originalBackendPid: activeBackend.pid,
          backendStart: vanishedBackend.backend_start,
        }],
        ["backend start differs", { backendStart: "2000-01-01T00:00:00.000Z" }],
        ["nonce is missing", { denialNonce: null }],
        ["nonce differs from application_name", { denialNonce: "f".repeat(32) }],
      ]) {
        await context.test(name, async () => {
          const before = await snapshot();
          await assert.rejects(
            () => auditRuntime.query("SELECT etf.audit_append($1::jsonb)", [payload(overrides)]),
            (error) => error.code === "55000" && error.message === "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
          );
          assert.deepEqual(await snapshot(), before);
        });
      }

      await context.test("denial audit insert rolls back", async () => {
        await admin.query(
          `CREATE FUNCTION etf.force_denial_insert_failure() RETURNS trigger
             LANGUAGE plpgsql AS $failure$ BEGIN RAISE EXCEPTION 'ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED' USING ERRCODE = '55000'; END $failure$;
           CREATE TRIGGER trg_access_denial_audit__force_failure
             BEFORE INSERT ON etf.access_denial_audit
             FOR EACH ROW EXECUTE FUNCTION etf.force_denial_insert_failure();`,
        );
        const before = await snapshot();
        try {
          await assert.rejects(
            () => auditRuntime.query("SELECT etf.audit_append($1::jsonb)", [payload()]),
            (error) => error.code === "55000" && error.message === "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
          );
          assert.deepEqual(await snapshot(), before);
        } finally {
          await admin.query(
            `DROP TRIGGER trg_access_denial_audit__force_failure ON etf.access_denial_audit;
             DROP FUNCTION etf.force_denial_insert_failure();`,
          );
        }
      });

      await context.test("live backend and nonce match", async () => {
        const before = await snapshot();
        const result = (await auditRuntime.query(
          "SELECT etf.audit_append($1::jsonb) AS result",
          [payload()],
        )).rows[0].result;
        assert.equal(typeof result.auditId, "string");
        assert.equal(typeof result.evidenceHash, "string");
        assert.equal(typeof result.auditSequence, "number");
        const after = await snapshot();
        assert.deepEqual(after, [{
          denials: before[0].denials + 1,
          commitments: before[0].commitments + 1,
          checkpoints: before[0].checkpoints + 1,
        }]);
      });
    } finally {
      for (const runtime of runtimeClients) await runtime.end().catch(() => undefined);
      await auditRuntime?.end().catch(() => undefined);
      await cleanBootstrap(admin).catch(() => undefined);
      await admin.query(unlockSql).catch(() => undefined);
      await admin.end();
    }
  },
);
