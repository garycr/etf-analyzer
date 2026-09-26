import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import pg from "pg";

import {
  executeApplicationRequestAsync,
} from "../../dist/Application/application-boundary.js";
import { createPostgresApplicationReplayStore } from "../../dist/Infrastructure/PostgreSQL/application-replay-store.js";
import { isDurableHandoffObjectName } from "../../dist/Infrastructure/PostgreSQL/migration-set.js";
import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import {
  checkDenialAuditCapability,
  checkLedgerIntegrity,
  checkPostgresMigrationState,
  checkPostgresSchemaManifest,
} from "../../dist/Infrastructure/PostgreSQL/readiness.js";
import { applicationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import { analyticsEvidenceMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/analytics-evidence.js";
import {
  controlledAccessImmutableTableNames,
  controlledAccessMigration,
  controlledAccessViewNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/controlled-access.js";
import { denialBackendVerifierMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/denial-backend-verifier.js";
import { domainLedgerMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import { fixtureMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
import { runtimeQueriesMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/runtime-queries.js";
import { dispatchPostgresPaperOrder } from "../../dist/Infrastructure/PostgreSQL/paper-order-owner.js";
import {
  collectPostgresManifestGrants,
  projectCurrentPostgresSchemaManifest,
  projectCurrentPostgresSchemaManifestPrefix,
  projectPostgresSchemaManifest,
} from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";
import {
  createRoleBootstrapSql,
  productRoles,
  roleMemberships,
} from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const lockSql =
  "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const unlockSql =
  "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const controlledAccessContentHash = "69edc73adca240b45af423ee4d4725b1999692b561e9d3d79bcd8cc6bede81cb";
const controlledAccessManifestHash = "91d0b8b2c12284b2d1fe481242388a32668424309e74ef2f82f1850d62f6a4de";

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

async function collectEmptyBootstrapState(client) {
  return (await client.query(
    `SELECT owner.rolname AS owner,
            namespace.nspacl::text AS schema_acl,
            (SELECT count(*)::integer FROM pg_catalog.pg_class AS relation
              WHERE relation.relnamespace = namespace.oid) AS relation_count,
            (SELECT count(*)::integer FROM pg_catalog.pg_proc AS routine
              WHERE routine.pronamespace = namespace.oid) AS routine_count,
            COALESCE(
              (SELECT pg_catalog.jsonb_agg(
                        pg_catalog.jsonb_build_object(
                          'owner', default_owner.rolname,
                          'object_type', defaults.defaclobjtype,
                          'acl', defaults.defaclacl::text
                        )
                        ORDER BY default_owner.rolname, defaults.defaclobjtype, defaults.defaclacl::text
                      )
                 FROM pg_catalog.pg_default_acl AS defaults
                 JOIN pg_catalog.pg_roles AS default_owner ON default_owner.oid = defaults.defaclrole
                WHERE defaults.defaclnamespace = namespace.oid),
              '[]'::jsonb
            ) AS default_acls
       FROM pg_catalog.pg_namespace AS namespace
       JOIN pg_catalog.pg_roles AS owner ON owner.oid = namespace.nspowner
      WHERE namespace.nspname = 'etf'`,
  )).rows;
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
    runtimeQueriesMigration,
  ];
  for (const [index, migration] of migrations.entries()) {
    if (migration.sequence === 6) {
      const owner = await client.query(
        `SELECT role_record.rolname AS owner
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           JOIN pg_catalog.pg_roles AS role_record ON role_record.oid = relation.relowner
          WHERE namespace.nspname = 'etf' AND relation.relname = 'audit_commitments'`,
      );
      assert.equal(owner.rows[0]?.owner, "audit_writer_owner");
      await client.query(
        `INSERT INTO etf.jobs VALUES
           ('10000000-0000-0000-0000-000000000001', 'Analytics', 'Pending', 'Restartable', 2,
            'AnalyticsRun', '10000000-0000-0000-0000-000000000002', '{}'::jsonb,
            '2026-09-14T00:04:00.000Z', NULL, NULL, 0, 0, NULL);
         INSERT INTO etf.job_checkpoints VALUES
           ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 1, 0,
            '2026-09-14T00:04:01.000Z', '${"1".repeat(64)}', 'Analytics', 'first', 'last', 0);
         INSERT INTO etf.paper_orders VALUES
           ('20000000-0000-0000-0000-000000000001', 'ETF-1', 'Draft', 1,
            '20000000-0000-0000-0000-000000000002', 'Buy', 2, 0, 2, 10, '2026-09-14', NULL);
         INSERT INTO etf.order_transitions VALUES
           ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003',
            'OT-01', 'Initial', 'Draft', 'UserCreatedFromResearch', '{}'::jsonb,
            '2026-09-14T00:04:02.000Z', 'local-user', '20000000-0000-0000-0000-000000000004',
            0, 1, 'v1.0.0');
         INSERT INTO etf.portfolios VALUES
           ('30000000-0000-0000-0000-000000000001', 2, 'v1.0.0', 'DEC-014');
         INSERT INTO etf.anchor_keys VALUES
           ('primary', decode('00112233445566778899aabbccddeeff', 'hex'), '2026-09-14T00:00:00.000Z', NULL);
         INSERT INTO etf.audit_commitments VALUES
           (1, '${"a".repeat(64)}', NULL, 'primary', '${"b".repeat(64)}', '${"c".repeat(64)}', '2026-09-14T00:03:59.000Z');
         INSERT INTO etf.ledger_transactions VALUES
           ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 1,
            'CashDeposit', '2026-09-14T00:03:58.000Z', '2026-09-14T00:03:58.000Z', NULL, NULL,
            '30000000-0000-0000-0000-000000000003', NULL, 'DEC-014', 'v1.0.0', NULL, '${"d".repeat(64)}'),
           ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 2,
            'CashDeposit', '2026-09-14T00:04:20.000Z', '2026-09-14T00:04:20.000Z', NULL, NULL,
            '30000000-0000-0000-0000-000000000007', NULL, 'DEC-014', 'v1.0.0', NULL, '${"4".repeat(64)}');
         INSERT INTO etf.ledger_commitments VALUES
           ('30000000-0000-0000-0000-000000000001', 1, '${"d".repeat(64)}', '${"e".repeat(64)}',
            '${"f".repeat(64)}', NULL, '${"1".repeat(64)}'),
           ('30000000-0000-0000-0000-000000000001', 2, '${"4".repeat(64)}', '${"5".repeat(64)}',
            '${"6".repeat(64)}', '${"1".repeat(64)}', '${"3".repeat(64)}');
         INSERT INTO etf.ledger_anchors VALUES
           ('30000000-0000-0000-0000-000000000001', 1, 'primary', '${"1".repeat(64)}',
            '${"2".repeat(64)}', '2026-09-14T00:03:59.000Z');
         INSERT INTO etf.portfolio_projections VALUES
           ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 1,
            '2026-09-14T00:04:00.000Z', 100, '[]'::jsonb, '[]'::jsonb, 0, 100, 'Reconciled', '${"1".repeat(64)}'),
           ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 2,
            '2026-09-14T00:06:00.000Z', 200, '[]'::jsonb, '[]'::jsonb, 0, 200, 'Reconciled', '${"1".repeat(64)}'),
           ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000008', 2,
            '2026-09-14T00:04:30.000Z', 300, '[]'::jsonb, '[]'::jsonb, 0, 300, 'Reconciled', '${"3".repeat(64)}');`,
      );
    }
    try {
      await applyMigration(
        client,
        migration,
        `2026-09-14T00:0${index}:00.000Z`,
        projectPostgresSchemaManifest,
      );
    } catch (error) {
      throw new Error(`${migration.migrationId}: ${error.message}`, { cause: error });
    }
  }
}

function runtimeClientFactory(role, password) {
  return async () => {
    const runtimeUrl = new URL(connectionString);
    runtimeUrl.username = role;
    runtimeUrl.password = password;
    const client = new pg.Client({ connectionString: runtimeUrl.toString() });
    await client.connect();
    return {
      query: (sql, parameters) => client.query(sql, parameters),
      close: () => client.end(),
    };
  };
}

async function applyMigrationsThroughAnalytics(client) {
  await client.query(createRoleBootstrapSql());
  for (const [index, migration] of [
    foundationMigration,
    applicationMigration,
    domainLedgerMigration,
    fixtureMigration,
    analyticsEvidenceMigration,
  ].entries()) {
    await applyMigration(
      client,
      migration,
      `2026-09-14T00:0${index}:00.000Z`,
      projectPostgresSchemaManifest,
    );
  }
}

test(
  "0006 rolls back its complete surface when manifest projection fails",
  { skip: connectionString ? false : "ETF_TEST_POSTGRES_URL is not configured" },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      await client.query(lockSql);
      await cleanBootstrap(client);
      await applyMigrationsThroughAnalytics(client);
      const grantsBeforeFailure = await collectPostgresManifestGrants(client);
      await assert.rejects(
        applyMigration(
          client,
          controlledAccessMigration,
          "2026-09-14T00:05:00.000Z",
          async (transaction, migration) => {
            await projectPostgresSchemaManifest(transaction, migration);
            throw new Error("FORCED_MANIFEST_FAILURE");
          },
        ),
        /FORCED_MANIFEST_FAILURE/,
      );
      const state = await client.query(
        `SELECT
           (SELECT count(*)::integer FROM etf.schema_migrations) AS migrations,
           (SELECT count(*)::integer
              FROM pg_catalog.pg_proc AS function_record
              JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
             WHERE namespace.nspname = 'etf' AND function_record.proname = 'reject_immutable_change') AS functions,
           (SELECT count(*)::integer
              FROM pg_catalog.pg_class AS relation
              JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
             WHERE namespace.nspname = 'etf' AND relation.relkind = 'v') AS views,
           (SELECT count(*)::integer
              FROM pg_catalog.pg_trigger AS trigger_record
              JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger_record.tgrelid
              JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
             WHERE namespace.nspname = 'etf' AND NOT trigger_record.tgisinternal) AS triggers,
           pg_catalog.has_schema_privilege('app_runtime', 'etf', 'USAGE') AS app_schema_usage,
           pg_catalog.has_schema_privilege('application_writer_owner', 'etf', 'CREATE') AS application_schema_create,
           pg_catalog.has_column_privilege('schema_owner', 'etf.jobs', 'job_id', 'SELECT') AS schema_owner_job_read,
           pg_catalog.has_column_privilege('projection_owner', 'etf.portfolios', 'portfolio_id', 'SELECT') AS projection_portfolio_read`,
      );
      assert.deepEqual(state.rows[0], {
        migrations: 5,
        functions: 0,
        views: 0,
        triggers: 0,
        app_schema_usage: true,
        application_schema_create: false,
        schema_owner_job_read: false,
        projection_portfolio_read: true,
      });
      assert.deepEqual(await collectPostgresManifestGrants(client), grantsBeforeFailure);
    } finally {
      await cleanBootstrap(client).catch(() => undefined);
      await client.query(unlockSql).catch(() => undefined);
      await client.end();
    }
  },
);

test(
  "CT-DB-001A an empty database reaches the exact candidate schema",
  { skip: connectionString ? false : "ETF_TEST_POSTGRES_URL is not configured" },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      await client.query(lockSql);
      await cleanBootstrap(client);
      await client.query(createRoleBootstrapSql());
      const bootstrap = await client.query(
        `SELECT
           (SELECT owner.rolname
              FROM pg_catalog.pg_namespace AS namespace
              JOIN pg_catalog.pg_roles AS owner ON owner.oid = namespace.nspowner
             WHERE namespace.nspname = 'etf') AS schema_owner,
           (SELECT namespace.nspacl IS NULL
              FROM pg_catalog.pg_namespace AS namespace
             WHERE namespace.nspname = 'etf') AS schema_default_acl,
           (SELECT count(*)::integer
              FROM pg_catalog.pg_class AS relation
              JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
             WHERE namespace.nspname = 'etf') AS relation_count,
           (SELECT count(*)::integer
              FROM pg_catalog.pg_proc AS routine
              JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = routine.pronamespace
             WHERE namespace.nspname = 'etf') AS routine_count,
           (SELECT count(*)::integer
              FROM pg_catalog.pg_default_acl AS defaults
              JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
             WHERE namespace.nspname = 'etf') AS default_acl_count`,
      );
      assert.deepEqual(bootstrap.rows, [{
        schema_owner: "schema_owner",
        schema_default_acl: true,
        relation_count: 0,
        routine_count: 0,
        default_acl_count: 0,
      }]);
      const roleState = await client.query(
        `SELECT role_record.rolname,
                role_record.rolcanlogin,
                role_record.rolsuper,
                role_record.rolcreaterole,
                role_record.rolcreatedb,
                role_record.rolreplication,
                role_record.rolbypassrls
           FROM pg_catalog.pg_roles AS role_record
          WHERE role_record.rolname = ANY($1::text[])
          ORDER BY role_record.rolname`,
        [productRoles.map(({ name }) => name)],
      );
      assert.deepEqual(roleState.rows, [...productRoles]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(({ name, login }) => ({
          rolname: name,
          rolcanlogin: login,
          rolsuper: false,
          rolcreaterole: false,
          rolcreatedb: false,
          rolreplication: false,
          rolbypassrls: false,
        })));
      const memberships = await client.query(
        `SELECT granted.rolname AS role, member.rolname AS member,
                membership.admin_option,
                membership.inherit_option,
                membership.set_option
           FROM pg_catalog.pg_auth_members AS membership
           JOIN pg_catalog.pg_roles AS granted ON granted.oid = membership.roleid
           JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
          WHERE granted.rolname = ANY($1::text[])
            AND member.rolname = ANY($1::text[])
          ORDER BY granted.rolname, member.rolname`,
        [[...productRoles.map(({ name }) => name), "pg_read_all_stats"]],
      );
      assert.deepEqual(memberships.rows, [...roleMemberships]
        .sort((left, right) => left.role.localeCompare(right.role) || left.member.localeCompare(right.member))
        .map(({ role, member, admin, inherit, set }) => ({
          role,
          member,
          admin_option: admin,
          inherit_option: inherit,
          set_option: set,
        })));
      const extensions = await client.query(
        "SELECT extname AS name, extversion AS version FROM pg_catalog.pg_extension ORDER BY extname",
      );
      assert.deepEqual(extensions.rows, [
        { name: "pgcrypto", version: "1.3" },
        { name: "plpgsql", version: "1.0" },
      ]);
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);

      const readinessPreconditions = await client.query(
        `SELECT
           (SELECT count(*)::integer FROM etf.schema_migrations) AS migration_count,
           (SELECT count(*)::integer
              FROM pg_catalog.pg_proc AS function_record
              JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
             CROSS JOIN LATERAL pg_catalog.aclexplode(
               COALESCE(function_record.proacl, pg_catalog.acldefault('f', function_record.proowner))
             ) AS privilege
             WHERE namespace.nspname = 'etf'
               AND privilege.grantee = 0
               AND privilege.privilege_type = 'EXECUTE') AS public_execute_count`,
      );
      assert.deepEqual(readinessPreconditions.rows, [{
        migration_count: 8,
        public_execute_count: 0,
      }]);
      assert.deepEqual(await checkPostgresMigrationState(client), { ready: true });
      assert.deepEqual(await checkPostgresSchemaManifest(client), { ready: true });

      const auditPassword = randomBytes(24).toString("hex");
      const projectionPassword = randomBytes(24).toString("hex");
      assert.match(auditPassword, /^[0-9a-f]{48}$/u);
      assert.match(projectionPassword, /^[0-9a-f]{48}$/u);
      await client.query(`ALTER ROLE audit_runtime PASSWORD '${auditPassword}'`);
      await client.query(`ALTER ROLE projection_runtime PASSWORD '${projectionPassword}'`);
      const protectedStateBefore = (await client.query(
        `SELECT
           (SELECT pg_catalog.jsonb_agg(row_record ORDER BY row_record.audit_id)
              FROM etf.access_denial_audit AS row_record) AS denial_audits,
           (SELECT pg_catalog.jsonb_agg(row_record ORDER BY row_record.audit_sequence)
              FROM etf.audit_commitments AS row_record) AS audit_commitments,
           (SELECT pg_catalog.jsonb_agg(row_record ORDER BY row_record.audit_sequence)
              FROM etf.audit_anchor_checkpoints AS row_record) AS audit_checkpoints,
           (SELECT pg_catalog.jsonb_agg(row_record ORDER BY row_record.portfolio_id)
              FROM etf.portfolio_anchor_checkpoints AS row_record) AS portfolio_checkpoints`,
      )).rows[0];
      assert.deepEqual(
        await checkDenialAuditCapability(
          runtimeClientFactory("audit_runtime", auditPassword),
        ),
        { ready: true },
      );
      assert.deepEqual(
        await checkLedgerIntegrity(
          client,
          runtimeClientFactory("projection_runtime", projectionPassword),
        ),
        { ready: true },
      );
      assert.deepEqual((await client.query(
        `SELECT
           (SELECT pg_catalog.jsonb_agg(row_record ORDER BY row_record.audit_id)
              FROM etf.access_denial_audit AS row_record) AS denial_audits,
           (SELECT pg_catalog.jsonb_agg(row_record ORDER BY row_record.audit_sequence)
              FROM etf.audit_commitments AS row_record) AS audit_commitments,
           (SELECT pg_catalog.jsonb_agg(row_record ORDER BY row_record.audit_sequence)
              FROM etf.audit_anchor_checkpoints AS row_record) AS audit_checkpoints,
           (SELECT pg_catalog.jsonb_agg(row_record ORDER BY row_record.portfolio_id)
              FROM etf.portfolio_anchor_checkpoints AS row_record) AS portfolio_checkpoints`,
      )).rows[0], protectedStateBefore);

      const driftedCheckpointControl = {
        query: async () => ({ rows: [{
          portfolio_id: "30000000-0000-0000-0000-000000000001",
          portfolio_commitment: "0".repeat(64),
        }] }),
      };
      assert.deepEqual(
        await checkLedgerIntegrity(
          driftedCheckpointControl,
          runtimeClientFactory("projection_runtime", projectionPassword),
        ),
        { errorCode: "LEDGER_INTEGRITY_FAILED", ready: false },
      );

      const catalog = await client.query(
        `SELECT object_type, object_identity, object_name
           FROM (
             SELECT 'table' AS object_type,
                    relation.relname::text AS object_identity,
                    relation.relname::text AS object_name
               FROM pg_catalog.pg_class AS relation
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
              WHERE namespace.nspname = 'etf'
                AND relation.relkind = ANY(ARRAY['r','p']::"char"[])
             UNION ALL
             SELECT 'function',
                    function_record.proname::text || '(' || pg_catalog.pg_get_function_identity_arguments(function_record.oid) || ')',
                    function_record.proname::text
               FROM pg_catalog.pg_proc AS function_record
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
              WHERE namespace.nspname = 'etf'
             UNION ALL
             SELECT 'trigger',
                    relation.relname || '.' || trigger_record.tgname || ':' ||
                      pg_catalog.concat_ws(',',
                        CASE WHEN (trigger_record.tgtype & 4) <> 0 THEN 'INSERT' END,
                        CASE WHEN (trigger_record.tgtype & 8) <> 0 THEN 'DELETE' END,
                        CASE WHEN (trigger_record.tgtype & 16) <> 0 THEN 'UPDATE' END,
                        CASE WHEN (trigger_record.tgtype & 32) <> 0 THEN 'TRUNCATE' END),
                    trigger_record.tgname::text
               FROM pg_catalog.pg_trigger AS trigger_record
               JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger_record.tgrelid
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
              WHERE namespace.nspname = 'etf' AND NOT trigger_record.tgisinternal
             UNION ALL
             SELECT 'index', table_record.relname::text || '.' || index_record.relname::text, index_record.relname::text
               FROM pg_catalog.pg_index AS index_metadata
               JOIN pg_catalog.pg_class AS index_record ON index_record.oid = index_metadata.indexrelid
               JOIN pg_catalog.pg_class AS table_record ON table_record.oid = index_metadata.indrelid
               JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = table_record.relnamespace
              WHERE namespace.nspname = 'etf'
           ) AS manifested_object
          ORDER BY object_type, object_identity`,
      );
      assert.ok(catalog.rows.length > 0);
      assert.ok(catalog.rows.every(({ object_type, object_identity, object_name }) =>
        ["table", "function", "trigger", "index"].includes(object_type) &&
        typeof object_identity === "string" && typeof object_name === "string"));
      const identityCounts = new Map();
      for (const { object_type, object_identity } of catalog.rows) {
        const identity = `${object_type}:${object_identity}`;
        identityCounts.set(identity, (identityCounts.get(identity) ?? 0) + 1);
      }
      assert.deepEqual(
        [...identityCounts].filter(([, count]) => count !== 1),
        [],
      );
      assert.deepEqual(
        Object.fromEntries(["table", "function", "trigger", "index"].map((objectType) => [
          objectType,
          catalog.rows.filter(({ object_type }) => object_type === objectType).length,
        ])),
        { table: 45, function: 26, trigger: 105, index: 71 },
      );

      assert.deepEqual(
        catalog.rows.filter(({ object_name }) => isDurableHandoffObjectName(object_name)),
        [],
      );
      const migrations = await client.query(
        "SELECT sequence::integer AS sequence, migration_id, content_hash, schema_manifest_hash FROM etf.schema_migrations ORDER BY sequence",
      );
      const runtimeQueriesContentHash = createHash("sha256")
        .update(runtimeQueriesMigration.sql, "utf8")
        .digest("hex");
      const currentSchemaManifestHash = createHash("sha256")
        .update(await projectCurrentPostgresSchemaManifest(client), "utf8")
        .digest("hex");
      assert.deepEqual(
        migrations.rows,
        [
          { sequence: 1, migration_id: "0001-foundation", content_hash: "a604802a67bed66c6ce79d2f2f856b48e184ae5b4f76803ab8ead3a135c85291", schema_manifest_hash: "f6be4a872519869b56b35d084377af52811eaef5b123b0cac6410ad29ba6f235" },
          { sequence: 2, migration_id: "0002-application", content_hash: "e944f4c75488cba07045595b1769517ddfc369b6828b747091cc9774464fdb8d", schema_manifest_hash: "0418e808ca3d371e273b7500c8f836bf2cc5a06b613b1c50c40da579ed592e01" },
          { sequence: 3, migration_id: "0003-domain-ledger", content_hash: "c5da21109969595e17dfb7b31e5c45296324b6d20caf1f1debdb1a70ea84a496", schema_manifest_hash: "ed2b0c90c02e7eb39a2818ee890f41713475ed7ef2e19e90569bd54f37c2d9f3" },
          { sequence: 4, migration_id: "0004-fixtures", content_hash: "9bf81885aab5fafe8bcac9b372d7bbd0bec601fc29e0cdbc234a65fc3d5489f1", schema_manifest_hash: "d6e0e28b925a9dbad5375a2042b3bd84d7e26cb3861a1f45e8d4a52175f01009" },
          { sequence: 5, migration_id: "0005-analytics-evidence", content_hash: "2a848c629d66a7e3e2621ea065f684a94fc82acb9b7e85477a228c30c8ed8001", schema_manifest_hash: "05f956d422453a53346b7ac1280d801bd3eb47211817bfd13fc9cc8060d34e95" },
          { sequence: 6, migration_id: "0006-controlled-access", content_hash: "69edc73adca240b45af423ee4d4725b1999692b561e9d3d79bcd8cc6bede81cb", schema_manifest_hash: "91d0b8b2c12284b2d1fe481242388a32668424309e74ef2f82f1850d62f6a4de" },
          { sequence: 7, migration_id: "0007-denial-backend-verifier", content_hash: "0d07358c3056885e15ba190681402a381ed71485beb35e3b9088cc8d107b1340", schema_manifest_hash: "690a7efe18d5279f84ca5c7af3cf507a1bcc2a38841a1d3b3a622cbae9f3dc43" },
          { sequence: 8, migration_id: "0008-runtime-queries", content_hash: runtimeQueriesContentHash, schema_manifest_hash: currentSchemaManifestHash },
        ],
      );
    } finally {
      await cleanBootstrap(client).catch(() => undefined);
      await client.query(unlockSql).catch(() => undefined);
      await client.end();
    }
  },
);

test(
  "CT-DB-001B migration replay is deterministic and drift fails closed",
  { skip: connectionString ? false : "ETF_TEST_POSTGRES_URL is not configured" },
  async (context) => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      await client.query(lockSql);
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      const migrationRowsBefore = (await client.query(
        "SELECT sequence, migration_id, content_hash, applied_at, schema_manifest_hash FROM etf.schema_migrations ORDER BY sequence",
      )).rows;

      const replay = await applyMigration(
        client,
        runtimeQueriesMigration,
        "2026-09-14T00:08:00.000Z",
        projectPostgresSchemaManifest,
      );
      assert.equal(replay.applied, false);
      assert.deepEqual((await client.query(
        "SELECT sequence, migration_id, content_hash, applied_at, schema_manifest_hash FROM etf.schema_migrations ORDER BY sequence",
      )).rows, migrationRowsBefore);

      for (const [name, mutate, mutationRemains] of [
        [
          "changed check constraint expression",
          () => client.query(
            "ALTER TABLE etf.watchlist_state DROP CONSTRAINT ck_watchlist_state__version_nonnegative, ADD CONSTRAINT ck_watchlist_state__version_nonnegative CHECK (version > -1)",
          ),
          async () => (await client.query(
            `SELECT pg_catalog.pg_get_constraintdef(constraint_record.oid) <> 'CHECK ((version >= 0))' AS remains
               FROM pg_catalog.pg_constraint AS constraint_record
              WHERE constraint_record.conname = 'ck_watchlist_state__version_nonnegative'`,
          )).rows[0]?.remains,
        ],
        [
          "unknown table etf.event_outbox",
          () => client.query("CREATE TABLE etf.event_outbox (event_id bigint PRIMARY KEY)"),
          async () => (await client.query("SELECT pg_catalog.to_regclass('etf.event_outbox') IS NOT NULL AS remains")).rows[0]?.remains,
        ],
        [
          "changed function body hash",
          () => client.query(
            `CREATE OR REPLACE FUNCTION etf.denial_backend_matches(
               requested_pid integer,
               requested_backend_start timestamp with time zone,
               requested_session_user text,
               requested_application_name text
             )
             RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS 'SELECT false'`,
          ),
          async () => (await client.query(
            `SELECT pg_catalog.pg_get_functiondef(
               'etf.denial_backend_matches(integer,timestamp with time zone,text,text)'::regprocedure
             ) LIKE '%SELECT false%' AS remains`,
          )).rows[0]?.remains,
        ],
        [
          "extra runtime role membership",
          () => client.query("GRANT audit_writer_owner TO app_runtime"),
          async () => (await client.query("SELECT pg_catalog.pg_has_role('app_runtime', 'audit_writer_owner', 'MEMBER') AS remains")).rows[0]?.remains,
        ],
        [
          "PUBLIC execute grant",
          () => client.query("GRANT EXECUTE ON FUNCTION etf.denial_backend_matches(integer, timestamp with time zone, text, text) TO PUBLIC"),
          async () => (await client.query(
            "SELECT pg_catalog.has_function_privilege('public', 'etf.denial_backend_matches(integer,timestamp with time zone,text,text)', 'EXECUTE') AS remains",
          )).rows[0]?.remains,
        ],
        [
          "PUBLIC database CONNECT grant",
          () => client.query("DO $drift$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO PUBLIC', current_database()); END $drift$;"),
          async () => (await client.query("SELECT pg_catalog.has_database_privilege('public', current_database(), 'CONNECT') AS remains")).rows[0]?.remains,
        ],
        [
          "PUBLIC database TEMPORARY grant",
          () => client.query("DO $drift$ BEGIN EXECUTE format('GRANT TEMPORARY ON DATABASE %I TO PUBLIC', current_database()); END $drift$;"),
          async () => (await client.query("SELECT pg_catalog.has_database_privilege('public', current_database(), 'TEMPORARY') AS remains")).rows[0]?.remains,
        ],
        [
          "missing app_runtime database CONNECT grant",
          () => client.query("DO $drift$ BEGIN EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM app_runtime', current_database()); END $drift$;"),
          async () => !(await client.query("SELECT pg_catalog.has_database_privilege('app_runtime', current_database(), 'CONNECT') AS present")).rows[0]?.present,
        ],
      ]) {
        await context.test(name, async () => {
          await cleanBootstrap(client);
          await applyCompleteMigrationSet(client);
          const ledgerBeforeDrift = (await client.query(
            "SELECT sequence, migration_id, content_hash, applied_at, schema_manifest_hash FROM etf.schema_migrations ORDER BY sequence",
          )).rows;
          await mutate();

          assert.deepEqual(await checkPostgresSchemaManifest(client), {
            errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE",
            ready: false,
          });
          assert.equal(await mutationRemains(), true);
          assert.deepEqual((await client.query(
            "SELECT sequence, migration_id, content_hash, applied_at, schema_manifest_hash FROM etf.schema_migrations ORDER BY sequence",
          )).rows, ledgerBeforeDrift);
        });
      }
    } finally {
      await cleanBootstrap(client).catch(() => undefined);
      await client.query(unlockSql).catch(() => undefined);
      await client.end();
    }
  },
);

test(
  "CT-DB-001C a failed migration leaves no partial candidate state",
  { skip: connectionString ? false : "ETF_TEST_POSTGRES_URL is not configured" },
  async (context) => {
    const client = new pg.Client({ connectionString });
    const lockObserver = new pg.Client({ connectionString });
    await client.connect();
    await lockObserver.connect();
    const migrations = [
      foundationMigration,
      applicationMigration,
      domainLedgerMigration,
      fixtureMigration,
      analyticsEvidenceMigration,
      controlledAccessMigration,
      denialBackendVerifierMigration,
      runtimeQueriesMigration,
    ];
    try {
      await client.query(lockSql);
      for (const migration of migrations) {
        await context.test(migration.migrationId, async () => {
          await cleanBootstrap(client);
          await client.query(createRoleBootstrapSql());
          for (const prerequisite of migrations.slice(0, migration.sequence - 1)) {
            await applyMigration(
              client,
              prerequisite,
              `2026-09-14T00:0${prerequisite.sequence - 1}:00.000Z`,
              projectPostgresSchemaManifest,
            );
          }
          const ledgerBefore = migration.sequence === 1 ? [] : (await client.query(
            "SELECT sequence, migration_id, content_hash, applied_at, schema_manifest_hash FROM etf.schema_migrations ORDER BY sequence",
          )).rows;
          const bootstrapBefore = migration.sequence === 1
            ? await collectEmptyBootstrapState(client)
            : null;
          const manifestBefore = migration.sequence === 1
            ? null
            : await projectCurrentPostgresSchemaManifestPrefix(client, migration.sequence - 1);

          await assert.rejects(
            applyMigration(
              client,
              migration,
              `2026-09-14T00:0${migration.sequence - 1}:30.000Z`,
              async (transaction, prospectiveMigration) => {
                await projectPostgresSchemaManifest(transaction, prospectiveMigration);
                throw new Error(`FORCED_${migration.sequence}_ROLLBACK`);
              },
            ),
            new RegExp(`FORCED_${migration.sequence}_ROLLBACK`, "u"),
          );

          if (migration.sequence === 1) {
            assert.deepEqual(await collectEmptyBootstrapState(client), bootstrapBefore);
          } else {
            assert.deepEqual((await client.query(
              "SELECT sequence, migration_id, content_hash, applied_at, schema_manifest_hash FROM etf.schema_migrations ORDER BY sequence",
            )).rows, ledgerBefore);
            assert.equal(
              await projectCurrentPostgresSchemaManifestPrefix(client, migration.sequence - 1),
              manifestBefore,
            );
          }
          const runtimeAuthority = await client.query(
            `SELECT CASE $1::integer
               WHEN 1 THEN pg_catalog.to_regclass('etf.schema_migrations') IS NOT NULL
               WHEN 2 THEN pg_catalog.to_regprocedure('etf.application_replay_get_or_put(jsonb)') IS NOT NULL
               WHEN 3 THEN pg_catalog.to_regprocedure('etf.paper_order_command(jsonb)') IS NOT NULL
               WHEN 4 THEN pg_catalog.to_regprocedure('etf.fixture_package_put(jsonb)') IS NOT NULL
               WHEN 5 THEN pg_catalog.to_regprocedure('etf.analytics_evidence_commit(jsonb)') IS NOT NULL
               WHEN 6 THEN pg_catalog.to_regprocedure('etf.job_get(uuid)') IS NOT NULL
               WHEN 7 THEN pg_catalog.to_regprocedure('etf.denial_backend_matches(integer,timestamp with time zone,text,text)') IS NOT NULL
               WHEN 8 THEN pg_catalog.to_regprocedure('etf.readiness_get()') IS NOT NULL
             END AS target_exists`,
            [migration.sequence],
          );
          assert.equal(runtimeAuthority.rows[0]?.target_exists, false);
          const migrationLock = await lockObserver.query(
            "SELECT pg_catalog.pg_try_advisory_lock(pg_catalog.hashtextextended('etf:v1.0.0-prototype.1:migrations', 0)) AS acquired",
          );
          assert.deepEqual(migrationLock.rows, [{ acquired: true }]);
          await lockObserver.query(
            "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:v1.0.0-prototype.1:migrations', 0))",
          );
        });
      }
    } finally {
      await cleanBootstrap(client).catch(() => undefined);
      await client.query(unlockSql).catch(() => undefined);
      await client.end();
      await lockObserver.end();
    }
  },
);

test(
  "0006 closes immutable, read, and runtime authority surfaces",
  { skip: connectionString ? false : "ETF_TEST_POSTGRES_URL is not configured" },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      await client.query(lockSql);
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      const migrationRecord = await client.query(
        "SELECT content_hash, schema_manifest_hash FROM etf.schema_migrations WHERE sequence = 6",
      );
      assert.deepEqual(migrationRecord.rows[0], {
        content_hash: controlledAccessContentHash,
        schema_manifest_hash: controlledAccessManifestHash,
      });
      const columnGrants = (await collectPostgresManifestGrants(client))
        .filter(({ columns }) => columns !== null)
        .map(({ object, columns, grantee, privilege }) => ({ object, columns, grantee, privilege }));
      assert.deepEqual(columnGrants, [
        { object: "analytics_publications", columns: ["publication_target_id", "publication_version", "evidence_id", "published_at", "bundle_hash"], grantee: "schema_owner", privilege: "SELECT" },
        { object: "audit_commitments", columns: ["audit_sequence", "audit_commitment"], grantee: "anchor_owner", privilege: "SELECT" },
        { object: "jobs", columns: ["job_id", "job_type", "status", "restartability", "attempt", "created_at", "started_at", "completed_at", "accepted_count", "rejected_count"], grantee: "schema_owner", privilege: "SELECT" },
        { object: "ledger_allocations", columns: ["portfolio_id", "sell_transaction_id", "effect_ordinal", "lot_id", "consumed_quantity", "allocated_basis"], grantee: "projection_owner", privilege: "SELECT" },
        { object: "ledger_anchors", columns: ["portfolio_id", "ledger_sequence", "commitment_hash"], grantee: "projection_owner", privilege: "SELECT" },
        { object: "ledger_commitments", columns: ["portfolio_id", "ledger_sequence", "commitment_hash"], grantee: "projection_owner", privilege: "SELECT" },
        { object: "ledger_effects", columns: ["portfolio_id", "effect_type", "instrument_id", "lot_id", "quantity", "money"], grantee: "projection_owner", privilege: "SELECT" },
        { object: "ledger_lots", columns: ["portfolio_id", "lot_id", "instrument_id"], grantee: "projection_owner", privilege: "SELECT" },
        { object: "paper_orders", columns: ["order_id", "instrument_id", "aggregate_version", "side"], grantee: "ledger_writer_owner", privilege: "SELECT" },
        { object: "paper_orders", columns: ["order_id", "instrument_id", "state", "aggregate_version", "research_evidence_id", "side", "requested_quantity", "filled_quantity", "open_quantity", "unit_price", "trade_date"], grantee: "schema_owner", privilege: "SELECT" },
        { object: "portfolios", columns: ["portfolio_id", "portfolio_version", "baseline_version", "precision_policy_version"], grantee: "projection_owner", privilege: "SELECT" },
        { object: "portfolios", columns: ["portfolio_id", "portfolio_version", "baseline_version", "precision_policy_version"], grantee: "schema_owner", privilege: "SELECT" },
        { object: "watchlist_items", columns: ["instrument_id", "display_name", "validation_state", "position", "version"], grantee: "schema_owner", privilege: "SELECT" },
      ]);

      const triggers = await client.query(
        `SELECT count(*)::integer AS count
           FROM pg_catalog.pg_trigger AS trigger_record
           JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger_record.tgrelid
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'etf' AND NOT trigger_record.tgisinternal`,
      );
      assert.equal(triggers.rows[0].count, controlledAccessImmutableTableNames.length * 3);

      const views = await client.query(
        `SELECT relation.relname AS name, owner.rolname AS owner,
                pg_catalog.array_position(relation.reloptions, 'security_barrier=true') IS NOT NULL AS security_barrier
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = relation.relowner
          WHERE namespace.nspname = 'etf' AND relation.relkind = 'v'
          ORDER BY relation.relname`,
      );
      assert.deepEqual(views.rows.map(({ name }) => name), [...controlledAccessViewNames].sort());
      assert.ok(views.rows.every(({ security_barrier }) => security_barrier));
      assert.ok(views.rows.every(({ owner }) => owner === "schema_owner"));

      const functions = await client.query(
        `SELECT function_record.proname AS name, owner.rolname AS owner,
                function_record.prosecdef AS security_definer,
                function_record.provolatile AS volatility,
                function_record.proparallel AS parallel,
                function_record.proconfig AS configuration,
                pg_catalog.has_function_privilege('public', function_record.oid, 'EXECUTE') AS public_execute
           FROM pg_catalog.pg_proc AS function_record
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = function_record.proowner
          WHERE namespace.nspname = 'etf'
            AND function_record.proname = ANY($1::text[])
          ORDER BY function_record.proname`,
        [["analytics_result_get", "application_replay_get", "job_get", "paper_order_command_get", "paper_order_get", "portfolio_get", "readiness_get", "reject_immutable_change", "watchlist_get"]],
      );
      assert.deepEqual(
        functions.rows.map(({ name, owner, security_definer, volatility, parallel, configuration, public_execute }) => ({
          name,
          owner,
          security_definer,
          volatility,
          parallel,
          configuration,
          public_execute,
        })),
        [
          { name: "analytics_result_get", owner: "evidence_writer_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "application_replay_get", owner: "application_writer_owner", security_definer: true, volatility: "v", parallel: "u", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "job_get", owner: "application_writer_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "paper_order_command_get", owner: "application_writer_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "paper_order_get", owner: "application_writer_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "portfolio_get", owner: "projection_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "readiness_get", owner: "application_writer_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "reject_immutable_change", owner: "schema_owner", security_definer: true, volatility: "v", parallel: "u", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "watchlist_get", owner: "application_writer_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
        ],
      );

      const runtimeSchemaUsage = await client.query(
        `SELECT grantee
           FROM pg_catalog.unnest($1::text[]) AS runtime_role(grantee)
          WHERE pg_catalog.has_schema_privilege(grantee, 'etf', 'USAGE')
          ORDER BY grantee`,
        [["app_runtime", "projection_runtime", "audit_runtime", "key_injector"]],
      );
      assert.deepEqual(runtimeSchemaUsage.rows.map(({ grantee }) => grantee), [
        "app_runtime",
        "audit_runtime",
        "key_injector",
        "projection_runtime",
      ]);
      const ownerSchemaAuthority = await client.query(
        `SELECT owner_role,
                pg_catalog.has_schema_privilege(owner_role, 'etf', 'USAGE') AS usage,
                pg_catalog.has_schema_privilege(owner_role, 'etf', 'CREATE') AS create
           FROM pg_catalog.unnest($1::text[]) AS role_name(owner_role)
          ORDER BY owner_role`,
        [["application_writer_owner", "ledger_writer_owner", "projection_owner", "audit_writer_owner", "anchor_owner", "evidence_writer_owner"]],
      );
      assert.ok(ownerSchemaAuthority.rows.every(({ usage, create }) => usage === true && create === false));
      const projectionOwnerColumns = await client.query(
        `SELECT relation.relname AS table_name, attribute.attname AS column_name,
                requested.privilege,
                pg_catalog.has_column_privilege('projection_owner', relation.oid, attribute.attname, requested.privilege) AS granted
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = relation.oid
          CROSS JOIN pg_catalog.unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) AS requested(privilege)
          WHERE namespace.nspname = 'etf'
            AND relation.relname = ANY($1::text[])
            AND attribute.attnum > 0 AND NOT attribute.attisdropped
          ORDER BY relation.relname, attribute.attnum, requested.privilege`,
        [["portfolios", "ledger_commitments", "ledger_anchors"]],
      );
      const readableProjectionColumns = new Map([
        ["portfolios", new Set(["portfolio_id", "portfolio_version", "baseline_version", "precision_policy_version"])],
        ["ledger_commitments", new Set(["portfolio_id", "ledger_sequence", "commitment_hash"])],
        ["ledger_anchors", new Set(["portfolio_id", "ledger_sequence", "commitment_hash"])],
      ]);
      assert.ok(projectionOwnerColumns.rows.every(({ table_name, column_name, privilege, granted }) =>
        granted === (privilege === "SELECT" && readableProjectionColumns.get(table_name).has(column_name))));

      await client.query("SET SESSION AUTHORIZATION app_runtime");
      for (const signature of ["etf.job_start(jsonb)", "etf.job_succeed(jsonb)", "etf.job_restart(jsonb)"]) {
        assert.equal((await client.query(
          "SELECT pg_catalog.has_function_privilege(session_user, $1, 'EXECUTE') AS granted",
          [signature],
        )).rows[0].granted, true);
      }
      const completedJobId = "39000000-0000-4000-8000-000000000001";
      const completedCommandId = "39000000-0000-4000-8000-000000000002";
      await client.query("SELECT etf.job_start($1::jsonb)", [{
        jobId: completedJobId,
        jobType: "FixtureIngestion",
        restartability: "Restartable",
        operation: "FixtureIngestionStart",
        originalCommandId: completedCommandId,
        inputIdentity: {
          datasetId: "pt-e2e",
          datasetVersion: "1",
          fixturePackageHash: "a".repeat(64),
        },
        createdAt: "2026-09-17T11:00:00.000Z",
      }]);
      const completed = await client.query(
        "SELECT etf.job_succeed($1::jsonb) AS result",
        [{
          jobId: completedJobId,
          originalCommandId: completedCommandId,
          operation: "FixtureIngestionStart",
          acceptedCount: "2",
          rejectedCount: "0",
          startedAt: "2026-09-17T11:00:01.000Z",
          completedAt: "2026-09-17T11:00:02.000Z",
        }],
      );
      assert.deepEqual(completed.rows[0].result, {
        jobId: completedJobId,
        jobType: "FixtureIngestion",
        status: "Succeeded",
        restartability: "Restartable",
        attempt: "1",
        operation: "FixtureIngestionStart",
        originalCommandId: completedCommandId,
        inputIdentity: {
          datasetId: "pt-e2e",
          datasetVersion: "1",
          fixturePackageHash: "a".repeat(64),
        },
        createdAt: "2026-09-17T11:00:00.000Z",
        startedAt: "2026-09-17T11:00:01.000Z",
        completedAt: "2026-09-17T11:00:02.000Z",
        checkpoint: null,
        acceptedCount: "2",
        rejectedCount: "0",
        controllingError: null,
      });
      await assert.rejects(
        client.query("SELECT etf.job_succeed($1::jsonb)", [{
          jobId: completedJobId,
          originalCommandId: completedCommandId,
          operation: "FixtureIngestionStart",
          acceptedCount: "2",
          rejectedCount: "0",
          startedAt: "2026-09-17T11:00:01.000Z",
          completedAt: "2026-09-17T11:00:02.000Z",
        }]),
        (error) => error.code === "P0001" && error.message === "APPLICATION_JOB_NOT_COMPLETABLE",
      );
      for (const viewName of controlledAccessViewNames) {
        await client.query(`SELECT * FROM etf.${viewName}`);
      }
      const job = await client.query(
        "SELECT etf.job_get('10000000-0000-0000-0000-000000000001') AS result",
      );
      assert.equal(job.rows[0].result.job.attempt, "2");
      assert.equal(job.rows[0].result.job.checkpoint.attempt, "1");
      assert.equal(job.rows[0].result.job.checkpoint.sequence, "0");
      assert.equal(job.rows[0].result.job.acceptedCount, "0");
      assert.equal(job.rows[0].result.job.rejectedCount, "0");
      const order = await client.query(
        "SELECT etf.paper_order_get('20000000-0000-0000-0000-000000000001') AS result",
      );
      assert.deepEqual(
        order.rows[0].result.order.transitionHistory.map(({ resultingVersion }) => resultingVersion),
        ["1"],
      );
      const portfolio = await client.query(
        "SELECT etf.portfolio_get('30000000-0000-0000-0000-000000000001', '2026-09-14T00:05:00.000Z') AS result",
      );
      assert.equal(portfolio.rows[0].result.portfolio.portfolioVersion, "1");
      assert.equal(portfolio.rows[0].result.portfolio.valuationSnapshotId, "30000000-0000-0000-0000-000000000004");
      assert.equal(portfolio.rows[0].result.portfolio.asOf, "2026-09-14T00:04:00.000Z");
      assert.equal(portfolio.rows[0].result.portfolio.cash, "100.00000000");
      assert.equal(portfolio.rows[0].result.portfolio.totalEquity, "100.00000000");
      assert.deepEqual(portfolio.rows[0].result.portfolio.lots, []);
      assert.deepEqual(portfolio.rows[0].result.portfolio.positions, []);
      for (const deniedSql of [
        "SELECT * FROM etf.jobs",
        "INSERT INTO etf.jobs DEFAULT VALUES",
        "UPDATE etf.jobs SET status = status WHERE false",
        "DELETE FROM etf.jobs WHERE false",
        "TRUNCATE etf.jobs",
      ]) {
        await assert.rejects(client.query(deniedSql), (error) => error.code === "42501");
      }
      await assert.rejects(
        client.query("SELECT etf.job_get('00000000-0000-0000-0000-000000000001')"),
        (error) => error.code === "P0002" && error.message === "APPLICATION_JOB_NOT_FOUND",
      );

      await client.query("RESET SESSION AUTHORIZATION");
      for (const runtimeRole of ["projection_runtime", "audit_runtime", "key_injector"]) {
        await client.query(`SET SESSION AUTHORIZATION ${runtimeRole}`);
        for (const signature of ["etf.job_start(jsonb)", "etf.job_succeed(jsonb)", "etf.job_restart(jsonb)"]) {
          assert.equal((await client.query(
            "SELECT pg_catalog.has_function_privilege(session_user, $1, 'EXECUTE') AS granted",
            [signature],
          )).rows[0].granted, false);
        }
        await assert.rejects(
          client.query("SELECT etf.job_get('10000000-0000-0000-0000-000000000001')"),
          (error) => error.code === "42501",
        );
        await client.query("RESET SESSION AUTHORIZATION");
      }
      for (const [ownerRole, query] of [
        ["application_writer_owner", "SELECT etf.readiness_get()"],
        ["application_writer_owner", "SELECT etf.watchlist_get()"],
        ["evidence_writer_owner", "SELECT etf.analytics_result_get('10000000-0000-0000-0000-000000000001')"],
      ]) {
        await client.query(`SET SESSION AUTHORIZATION ${ownerRole}`);
        await assert.rejects(client.query(query), (error) => error.code === "42501");
        await client.query("RESET SESSION AUTHORIZATION");
      }

      for (const [ownerRole, tableName, identityColumn] of [
        ["anchor_owner", "ledger_anchors", "commitment_hash"],
        ["application_writer_owner", "readiness_audit", "readiness_id"],
        ["audit_writer_owner", "order_audit", "audit_id"],
        ["evidence_writer_owner", "analytics_audit", "audit_id"],
        ["ledger_writer_owner", "ledger_allocations", "portfolio_id"],
      ]) {
        await client.query(`SET SESSION AUTHORIZATION ${ownerRole}`);
        for (const immutableSql of [
          `UPDATE etf.${tableName} SET ${identityColumn} = ${identityColumn} WHERE false`,
          `DELETE FROM etf.${tableName} WHERE false`,
          `TRUNCATE etf.${tableName}`,
        ]) {
          await assert.rejects(
            client.query(immutableSql),
            (error) => error.code === "55000" && error.message === "IMMUTABLE_RELATION_CHANGE_REJECTED",
          );
        }
        await client.query("RESET SESSION AUTHORIZATION");
      }
    } finally {
      await client.query("RESET SESSION AUTHORIZATION").catch(() => undefined);
      await cleanBootstrap(client).catch(() => undefined);
      await client.query(unlockSql).catch(() => undefined);
      await client.end();
    }
  },
);

test(
  "CT-DB-001D roles and controlled operations enforce least privilege",
  { skip: connectionString ? false : "ETF_TEST_POSTGRES_URL is not configured" },
  async (context) => {
    const client = new pg.Client({ connectionString });
    const expectDeniedAs = async (sessionUser, statement) => {
      await client.query(`SET SESSION AUTHORIZATION ${sessionUser}`);
      try {
        await assert.rejects(
          () => client.query(statement),
          (error) => error.code === "42501",
        );
      } finally {
        await client.query("RESET ROLE").catch(() => undefined);
        await client.query("RESET SESSION AUTHORIZATION");
      }
    };
    const protectedState = async () => (await client.query(
      `SELECT
         (SELECT count(*)::integer FROM etf.ledger_transactions) AS ledger_transactions,
         (SELECT count(*)::integer FROM etf.ledger_anchors) AS ledger_anchors,
         (SELECT count(*)::integer FROM etf.anchor_keys) AS anchor_keys,
         (SELECT count(*)::integer FROM etf.access_denial_audit) AS denial_audits`,
    )).rows;

    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);

      const memberships = await client.query(
        `SELECT granted.rolname AS role, member.rolname AS member,
                membership.admin_option,
                membership.inherit_option,
                membership.set_option
           FROM pg_catalog.pg_auth_members AS membership
           JOIN pg_catalog.pg_roles AS granted ON granted.oid = membership.roleid
           JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
          WHERE granted.rolname = ANY($1::text[])
            AND member.rolname = ANY($1::text[])
          ORDER BY granted.rolname, member.rolname`,
        [[...productRoles.map(({ name }) => name), "pg_read_all_stats"]],
      );
      assert.deepEqual(memberships.rows, [...roleMemberships]
        .sort((left, right) => left.role.localeCompare(right.role) || left.member.localeCompare(right.member))
        .map(({ role, member, admin, inherit, set }) => ({
          role,
          member,
          admin_option: admin,
          inherit_option: inherit,
          set_option: set,
        })));

      const databaseAuthority = await client.query(
        `SELECT role_name,
                pg_catalog.has_database_privilege(role_name, current_database(), 'CONNECT') AS connect,
                pg_catalog.has_database_privilege(role_name, current_database(), 'TEMPORARY') AS temporary
           FROM pg_catalog.unnest($1::text[]) AS role_name
          ORDER BY role_name`,
        [productRoles.map(({ name }) => name)],
      );
      const databaseConnectRoles = new Set([
        "app_runtime",
        "audit_runtime",
        "deployment_login",
        "key_injector",
        "migration_executor",
        "projection_runtime",
      ]);
      assert.ok(databaseAuthority.rows.every(({ role_name, connect, temporary }) =>
        connect === databaseConnectRoles.has(role_name) && temporary === false));

      const publicAuthority = await client.query(
        `SELECT
           NOT EXISTS (
             SELECT 1
               FROM pg_catalog.pg_database AS database_record
              CROSS JOIN LATERAL pg_catalog.aclexplode(
                COALESCE(database_record.datacl, pg_catalog.acldefault('d', database_record.datdba))
              ) AS privilege
              WHERE database_record.datname = current_database()
                AND privilege.grantee = 0
                AND privilege.privilege_type IN ('CONNECT', 'TEMPORARY')
           ) AS database_denied,
           pg_catalog.has_schema_privilege('public', 'etf', 'USAGE') AS schema_usage,
           pg_catalog.has_schema_privilege('public', 'etf', 'CREATE') AS schema_create,
           pg_catalog.has_function_privilege('public', 'etf.ledger_append(jsonb)', 'EXECUTE') AS writer_execute`,
      );
      assert.deepEqual(publicAuthority.rows, [{
        database_denied: true,
        schema_usage: false,
        schema_create: false,
        writer_execute: false,
      }]);

      const before = await protectedState();
      for (const [name, sessionUser, statement] of [
        ["app_runtime cannot SET ROLE migration_owner", "app_runtime", "SET ROLE migration_owner"],
        ["app_runtime cannot insert ledger transactions", "app_runtime", "INSERT INTO etf.ledger_transactions DEFAULT VALUES"],
        ["key_injector cannot execute anchor_append", "key_injector", "SELECT etf.anchor_append('{}'::jsonb)"],
        ["projection_runtime cannot replace a ledger anchor", "projection_runtime", "UPDATE etf.ledger_anchors SET commitment_hash = commitment_hash WHERE false"],
        ["app_runtime cannot read protected key material", "app_runtime", "SELECT key_ciphertext FROM etf.anchor_keys"],
        ["PUBLIC cannot execute a controlled writer", "audit_runtime", "SELECT etf.ledger_append('{}'::jsonb)"],
      ]) {
        await context.test(name, async () => {
          await expectDeniedAs(sessionUser, statement);
          assert.deepEqual(await protectedState(), before);
        });
      }
    } finally {
      await client.query("RESET SESSION AUTHORIZATION").catch(() => undefined);
      await cleanBootstrap(client).catch(() => undefined);
      await client.query(unlockSql).catch(() => undefined);
      await client.end();
    }
  },
);

test(
  "CT-LED-015 denies controlled-procedure bypass with correlated audit",
  { skip: connectionString ? false : "ETF_TEST_POSTGRES_URL is not configured" },
  async () => {
    const client = new pg.Client({ connectionString });
    const expectAs = async (sessionUser, statement, parameters, expectedCode) => {
      await client.query(`SET SESSION AUTHORIZATION ${sessionUser}`);
      try {
        await assert.rejects(
          () => client.query(statement, parameters),
          (error) => error.code === expectedCode,
        );
      } finally {
        await client.query("RESET ROLE").catch(() => undefined);
        await client.query("RESET SESSION AUTHORIZATION");
      }
    };
    const snapshot = async () => (await client.query(
      `SELECT
         (SELECT count(*)::integer FROM etf.ledger_transactions) AS transactions,
         (SELECT count(*)::integer FROM etf.ledger_audit) AS ledger_audits,
         (SELECT count(*)::integer FROM etf.order_audit) AS order_audits,
         (SELECT count(*)::integer FROM etf.access_denial_audit) AS denial_audits,
         (SELECT count(*)::integer FROM etf.ledger_commitments) AS ledger_commitments,
         (SELECT count(*)::integer FROM etf.audit_commitments) AS audit_commitments,
         (SELECT count(*)::integer FROM etf.ledger_anchors) AS ledger_anchors,
         (SELECT count(*)::integer FROM etf.anchor_keys) AS anchor_keys,
         (SELECT count(*)::integer FROM etf.portfolio_anchor_checkpoints) AS portfolio_checkpoints,
         (SELECT count(*)::integer FROM etf.audit_anchor_checkpoints) AS audit_checkpoints,
         (SELECT count(*)::integer FROM etf.portfolio_projections) AS projections,
         (SELECT COALESCE(sum(portfolio_version), 0)::integer FROM etf.portfolios) AS portfolio_versions`,
    )).rows;
    const anchorPayload = {
      domain: "Verify",
      portfolioId: "30000000-0000-0000-0000-000000000001",
      sourceCommitmentHash: "1".repeat(64),
    };
    const rejectedAuditPayload = {
      action: "LedgerAppend",
      attemptIntentId: "40000000-0000-4000-8000-000000000001",
      correlationId: "40000000-0000-4000-8000-000000000002",
      domain: "Ledger",
      keyIdentifier: "primary",
      outcome: "Rejected",
      subject: {},
    };
    const invalidLedgerPayload = {
      canonicalContent: "{}",
      correlationId: "40000000-0000-4000-8000-000000000003",
      effectiveAt: "2026-09-18T00:00:00.000Z",
      expectedPortfolioVersion: 2,
      keyIdentifier: "primary",
      portfolioId: "30000000-0000-0000-0000-000000000001",
      transactionId: "40000000-0000-4000-8000-000000000004",
      type: "CashDeposit",
    };
    const invalidProjectionPayload = {
      allocations: null,
      asOf: "invalid",
      baselineVersion: "v1.0.0",
      cash: null,
      keyIdentifier: "primary",
      lots: null,
      portfolioId: "30000000-0000-0000-0000-000000000001",
      portfolioVersion: "invalid",
      precisionPolicyVersion: "DEC-014",
      positions: null,
      realizedPnL: null,
      reconciliationState: "Reconciled",
      sourceCommitmentHash: "1".repeat(64),
      totalEquity: null,
      valuationSnapshotId: "40000000-0000-4000-8000-000000000005",
    };
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      const before = await snapshot();

      assert.equal(
        (await client.query(
          "SELECT pg_catalog.has_function_privilege('public', 'etf.anchor_append(jsonb)', 'EXECUTE') AS allowed",
        )).rows[0].allowed,
        false,
      );
      for (const sessionUser of ["app_runtime", "projection_runtime", "audit_runtime", "postgres"]) {
        await expectAs(
          sessionUser,
          "SELECT etf.anchor_append($1::jsonb)",
          [anchorPayload],
          "42501",
        );
      }
      for (const sessionUser of ["app_runtime", "projection_runtime"]) {
        await expectAs(
          sessionUser,
          "SELECT etf.audit_append($1::jsonb)",
          [rejectedAuditPayload],
          "42501",
        );
      }
      await expectAs(
        "app_runtime",
        "SET ROLE application_writer_owner",
        [],
        "42501",
      );
      for (const sessionUser of ["app_runtime", "projection_runtime", "audit_runtime"]) {
        await expectAs(
          sessionUser,
          "INSERT INTO etf.ledger_audit DEFAULT VALUES",
          [],
          "42501",
        );
      }
      assert.deepEqual(await snapshot(), before);

      await expectAs(
        "app_runtime",
        "SELECT etf.ledger_append($1::jsonb)",
        [invalidLedgerPayload],
        "22023",
      );
      await expectAs(
        "projection_runtime",
        "SELECT etf.projection_publish($1::jsonb)",
        [invalidProjectionPayload],
        "22023",
      );
      await expectAs("audit_runtime", "SELECT etf.audit_append('{}'::jsonb)", [], "22023");
      assert.deepEqual(await snapshot(), before);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(unlockSql).catch(() => undefined);
        await client.end();
      }
    }
  },
);

test(
  "WP-6 composes PaperOrderDraftCreate through controlled PostgreSQL mutation and read",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const orderId = "78000000-0000-4000-8000-000000000004";
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      const request = JSON.stringify({
        operation: "PaperOrderDraftCreate",
        requestId: "78000000-0000-4000-8000-000000000001",
        correlationId: "78000000-0000-4000-8000-000000000002",
        actorId: "local-user",
        prototypeCandidate: "v1.0.0-prototype.1",
        contractVersion: "1.0.0-candidate.2",
        requestedAt: "2026-09-17T12:00:00.000Z",
        commandId: "78000000-0000-4000-8000-000000000003",
        payload: {
          orderId,
          instrumentId: "GOLDEN-ETF",
          researchEvidenceId: "78000000-0000-4000-8000-000000000005",
          side: "Buy",
          quantity: "2.0000000000",
          unitPrice: "10.0000000000",
          tradeDate: "2026-09-17",
        },
      });
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      let result;
      try {
        result = await executeApplicationRequestAsync(request, {
          replayStore: createPostgresApplicationReplayStore(client),
          completedAt: () => "2026-09-17T12:00:01.000Z",
          checkReadiness: () => undefined,
          ownerDispatch: (definition, payload, context) =>
            dispatchPostgresPaperOrder(client, definition, payload, context),
        });
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }

      assert.equal(result.outcome, "Succeeded", JSON.stringify(result));
      assert.equal(result.data.order.orderId, orderId);
      assert.equal(result.data.order.state, "Draft");
      assert.equal(result.data.order.aggregateVersion, "1");
      assert.deepEqual(result.data.order.transitionHistory, [{
        transitionCommandId: "78000000-0000-4000-8000-000000000003",
        transition: "OT-01",
        sourceState: "Initial",
        targetState: "Draft",
        trigger: "UserCreatedFromResearch",
        occurredAt: "2026-09-17T12:00:00.000Z",
        actorId: "local-user",
        correlationId: "78000000-0000-4000-8000-000000000002",
        priorVersion: "0",
        resultingVersion: "1",
        baselineVersion: "v1.0.0",
      }]);

      await client.query("SET SESSION AUTHORIZATION app_runtime");
      try {
        await client.query(
          "SELECT etf.paper_order_transition($1::jsonb)",
          [{
            canonicalContent: '{"correlationId":"78000000-0000-4000-8000-000000000006","expectedVersion":1,"occurredAt":"2026-09-17T12:01:00.000Z","operation":"Transition","orderId":"78000000-0000-4000-8000-000000000004","transition":"OT-02","transitionCommandId":"78000000-0000-4000-8000-000000000007","transitionPayload":{"confirmation":{"actorId":"local-user","confirmationText":"Submit paper order","confirmedAt":"2026-09-17T12:01:00.000Z"}}}',
            correlationId: "78000000-0000-4000-8000-000000000006",
            expectedVersion: 1,
            occurredAt: "2026-09-17T12:01:00.000Z",
            operation: "Transition",
            orderId,
            transition: "OT-02",
            transitionCommandId: "78000000-0000-4000-8000-000000000007",
            transitionPayload: {
              confirmation: {
                actorId: "local-user",
                confirmationText: "Submit paper order",
                confirmedAt: "2026-09-17T12:01:00.000Z",
              },
            },
          }],
        );
        const replay = await client.query(
          "SELECT etf.paper_order_command_get($1::uuid, $2::uuid) AS result",
          [orderId, "78000000-0000-4000-8000-000000000003"],
        );
        assert.equal(replay.rows[0].result.order.state, "Draft");
        assert.equal(replay.rows[0].result.order.aggregateVersion, "1");
        assert.equal(replay.rows[0].result.order.transitionHistory.length, 1);

        const restartedRequest = JSON.stringify({
          ...JSON.parse(request),
          requestId: "78000000-0000-4000-8000-000000000008",
          correlationId: "78000000-0000-4000-8000-000000000009",
          requestedAt: "2026-09-17T12:02:00.000Z",
        });
        let replayOwnerCalls = 0;
        const applicationReplay = await executeApplicationRequestAsync(restartedRequest, {
          replayStore: createPostgresApplicationReplayStore(client),
          completedAt: () => {
            assert.fail("durable replay must retain the original completion time");
          },
          checkReadiness: () => assert.fail("durable replay must bypass readiness"),
          ownerDispatch: async () => {
            replayOwnerCalls += 1;
            return {};
          },
        });
        assert.deepEqual(applicationReplay, result);
        assert.equal(replayOwnerCalls, 0);
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }

      const competingClient = new pg.Client({ connectionString });
      await competingClient.connect();
      try {
        await client.query("SET SESSION AUTHORIZATION app_runtime");
        await competingClient.query("SET SESSION AUTHORIZATION app_runtime");
        let releaseOwner;
        let signalOwnerStarted;
        const ownerStarted = new Promise((resolve) => { signalOwnerStarted = resolve; });
        const ownerRelease = new Promise((resolve) => { releaseOwner = resolve; });
        const competingCommandId = "78100000-0000-4000-8000-000000000003";
        const firstOrderId = "78100000-0000-4000-8000-000000000004";
        const secondOrderId = "78100000-0000-4000-8000-000000000005";
        const competingRequest = (order, quantity) => JSON.stringify({
          ...JSON.parse(request),
          requestId: order,
          commandId: competingCommandId,
          payload: { ...JSON.parse(request).payload, orderId: order, quantity },
        });
        const firstExecution = executeApplicationRequestAsync(
          competingRequest(firstOrderId, "2.0000000000"),
          {
            replayStore: createPostgresApplicationReplayStore(client),
            completedAt: () => "2026-09-17T12:03:00.000Z",
            checkReadiness: () => undefined,
            ownerDispatch: async (definition, payload, context) => {
              signalOwnerStarted();
              await ownerRelease;
              return dispatchPostgresPaperOrder(client, definition, payload, context);
            },
          },
        );
        await ownerStarted;
        const competingExecution = executeApplicationRequestAsync(
          competingRequest(secondOrderId, "3.0000000000"),
          {
            replayStore: createPostgresApplicationReplayStore(competingClient),
            completedAt: () => "2026-09-17T12:03:01.000Z",
            checkReadiness: () => undefined,
            ownerDispatch: (definition, payload, context) =>
              dispatchPostgresPaperOrder(competingClient, definition, payload, context),
          },
        );
        releaseOwner();
        assert.equal((await firstExecution).outcome, "Succeeded");
        const competingResult = await competingExecution;
        assert.equal(competingResult.error.code, "APPLICATION_IDEMPOTENCY_CONFLICT");
        await client.query("RESET SESSION AUTHORIZATION");
        await competingClient.query("RESET SESSION AUTHORIZATION");
        const committed = await client.query(
          "SELECT order_id::text FROM etf.paper_orders WHERE order_id = ANY($1::uuid[]) ORDER BY order_id",
          [[firstOrderId, secondOrderId]],
        );
        assert.deepEqual(committed.rows, [{ order_id: firstOrderId }]);
      } finally {
        await client.query("RESET SESSION AUTHORIZATION").catch(() => undefined);
        await competingClient.query("RESET SESSION AUTHORIZATION").catch(() => undefined);
        await competingClient.end();
      }
    } finally {
      await cleanBootstrap(client).catch(() => undefined);
      await client.query(unlockSql).catch(() => undefined);
      await client.end();
    }
  },
);
