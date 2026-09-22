import assert from "node:assert/strict";
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
           pg_catalog.has_schema_privilege('audit_activity_verifier_owner', 'etf', 'CREATE') AS schema_create,
           pg_catalog.pg_has_role('audit_writer_owner', 'pg_read_all_stats', 'MEMBER') AS audit_stats_role`,
      );
      assert.deepEqual(closedAuthority.rows, [{
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
