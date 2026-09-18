import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import {
  executeApplicationRequestAsync,
} from "../../dist/Application/application-boundary.js";
import { createPostgresApplicationReplayStore } from "../../dist/Infrastructure/PostgreSQL/application-replay-store.js";
import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import { applicationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import { analyticsEvidenceMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/analytics-evidence.js";
import {
  controlledAccessImmutableTableNames,
  controlledAccessMigration,
  controlledAccessViewNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/controlled-access.js";
import { domainLedgerMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import { fixtureMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
import { dispatchPostgresPaperOrder } from "../../dist/Infrastructure/PostgreSQL/paper-order-owner.js";
import {
  collectPostgresManifestGrants,
  projectPostgresSchemaManifest,
} from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";
import {
  createRoleBootstrapSql,
  productRoles,
} from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const lockSql =
  "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const unlockSql =
  "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const controlledAccessContentHash = "1bafffc644bfe57fc487e0aa9363626cd0273653c8c4278049b2a6421c6b87ed";
const controlledAccessManifestHash = "25cb5c4a4fc79887b6386068969aa1f2bb3828abb75dcb41ef03e5c4d4e86025";

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
        app_schema_usage: false,
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
        [["application_replay_get", "reject_immutable_change", "job_get", "paper_order_command_get", "paper_order_get", "portfolio_get"]],
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
          { name: "application_replay_get", owner: "application_writer_owner", security_definer: true, volatility: "v", parallel: "u", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "job_get", owner: "application_writer_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "paper_order_command_get", owner: "application_writer_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "paper_order_get", owner: "application_writer_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "portfolio_get", owner: "projection_owner", security_definer: true, volatility: "s", parallel: "s", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
          { name: "reject_immutable_change", owner: "schema_owner", security_definer: true, volatility: "v", parallel: "u", configuration: ["search_path=pg_catalog, etf"], public_execute: false },
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
      for (const viewName of controlledAccessViewNames) {
        await client.query(`SELECT * FROM etf.${viewName}`);
      }
      const job = await client.query(
        "SELECT etf.job_get('10000000-0000-0000-0000-000000000001') AS result",
      );
      assert.equal(job.rows[0].result.job.checkpoint.sequence, 0);
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
      assert.equal(portfolio.rows[0].result.portfolio.portfolioVersion, 1);
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
        await assert.rejects(
          client.query("SELECT etf.job_get('10000000-0000-0000-0000-000000000001')"),
          (error) => error.code === "42501",
        );
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
