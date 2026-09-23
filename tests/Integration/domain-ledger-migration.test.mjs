import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

import pg from "pg";

import { executeApplicationRequestAsync } from "../../dist/Application/application-boundary.js";
import { quantizeAnalyticsIntermediate } from "../../dist/Domain/Analytics/analytics.js";
import { canonicalizeJson } from "../../dist/Infrastructure/CanonicalJson/canonical-json.js";
import { createPostgresApplicationReplayStore } from "../../dist/Infrastructure/PostgreSQL/application-replay-store.js";
import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import { applicationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import { analyticsEvidenceMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/analytics-evidence.js";
import { controlledAccessMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/controlled-access.js";
import {
  domainLedgerFunctionNames,
  domainLedgerMigration,
  domainLedgerTableNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
import { fixtureMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";
import { dispatchPostgresPaperOrder } from "../../dist/Infrastructure/PostgreSQL/paper-order-owner.js";
import { projectPostgresSchemaManifest } from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";
import {
  createRoleBootstrapSql,
  productRoles,
} from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const fixtureLockSql =
  "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const fixtureUnlockSql =
  "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

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

async function applyPrerequisites(client) {
  await client.query(createRoleBootstrapSql());
  await applyMigration(
    client,
    foundationMigration,
    "2026-09-14T00:00:00.000Z",
    projectPostgresSchemaManifest,
  );
  await applyMigration(
    client,
    applicationMigration,
    "2026-09-14T00:01:00.000Z",
    projectPostgresSchemaManifest,
  );
}

async function prepareLedgerBoundary(client) {
  await applyMigration(
    client,
    domainLedgerMigration,
    "2026-09-14T00:02:00.000Z",
    projectPostgresSchemaManifest,
  );
  await client.query("GRANT USAGE ON SCHEMA etf TO app_runtime, key_injector");
  await client.query(
    "GRANT EXECUTE ON FUNCTION etf.anchor_key_inject(text,bytea,timestamp with time zone) TO key_injector",
  );
  await client.query(
    "GRANT EXECUTE ON FUNCTION etf.ledger_append(jsonb) TO app_runtime",
  );
  await client.query("SET SESSION AUTHORIZATION key_injector");
  try {
    await client.query(
      "SELECT etf.anchor_key_inject('primary', decode('00112233445566778899aabbccddeeff', 'hex'), '2026-09-14T00:00:00.000Z')",
    );
  } finally {
    await client.query("RESET SESSION AUTHORIZATION");
  }
}

async function applyCompleteMigrationSet(client) {
  await applyPrerequisites(client);
  await applyMigration(
    client,
    domainLedgerMigration,
    "2026-09-14T00:02:00.000Z",
    projectPostgresSchemaManifest,
  );
  await client.query("GRANT USAGE ON SCHEMA etf TO key_injector");
  await client.query(
    "GRANT EXECUTE ON FUNCTION etf.anchor_key_inject(text,bytea,timestamp with time zone) TO key_injector",
  );
  await client.query("SET SESSION AUTHORIZATION key_injector");
  try {
    await client.query(
      "SELECT etf.anchor_key_inject('primary', decode('00112233445566778899aabbccddeeff', 'hex'), '2026-09-14T00:00:00.000Z')",
    );
  } finally {
    await client.query("RESET SESSION AUTHORIZATION");
  }
  for (const [migration, appliedAt] of [
    [fixtureMigration, "2026-09-14T00:03:00.000Z"],
    [analyticsEvidenceMigration, "2026-09-14T00:04:00.000Z"],
    [controlledAccessMigration, "2026-09-14T00:05:00.000Z"],
  ]) {
    await applyMigration(client, migration, appliedAt, projectPostgresSchemaManifest);
  }
}

async function seedFillOrder(client, {
  orderId,
  transitionCommandId,
  correlationId,
  researchEvidenceId,
  instrumentId,
  side,
  quantity,
  unitPrice,
  occurredAt,
  effectiveAt,
}) {
  await client.query("SET SESSION AUTHORIZATION postgres");
  try {
    await client.query(
      `INSERT INTO etf.paper_orders (
         order_id, instrument_id, state, aggregate_version, research_evidence_id,
         side, requested_quantity, filled_quantity, open_quantity, unit_price,
         trade_date, confirmation
       ) VALUES ($1::uuid, $2, 'Filled', 1, $3::uuid, $4, $5::numeric,
                 $5::numeric, 0, $6::numeric, '2026-09-14', NULL)`,
      [orderId, instrumentId, researchEvidenceId, side, quantity, unitPrice],
    );
    await client.query(
      `INSERT INTO etf.order_transitions (
         order_id, transition_command_id, transition, source_state, target_state,
         trigger, normalized_payload, occurred_at, actor_id, correlation_id,
         prior_version, resulting_version, baseline_version
       ) VALUES ($1::uuid, $2::uuid, 'OT-04', 'Accepted', 'Filled',
                 'SimulatedFill', '{}'::jsonb, $3::timestamp with time zone,
                 'integration-test', $4::uuid, 0, 1, 'v1.0.0')`,
      [orderId, transitionCommandId, occurredAt ?? effectiveAt, correlationId],
    );
  } finally {
    await client.query("RESET SESSION AUTHORIZATION");
  }
}

async function appendLedger(client, command) {
  const payload = {
    canonicalContent: canonicalizeJson(command),
    ...command,
  };
  await client.query("SET SESSION AUTHORIZATION app_runtime");
  try {
    const result = await client.query(
      "SELECT etf.ledger_append($1::jsonb) AS result",
      [payload],
    );
    return result.rows[0].result;
  } finally {
    await client.query("RESET SESSION AUTHORIZATION");
  }
}

async function appendAudit(client, payload) {
  await client.query("SET SESSION AUTHORIZATION audit_runtime");
  try {
    const result = await client.query(
      "SELECT etf.audit_append($1::jsonb) AS result",
      [payload],
    );
    return result.rows[0].result;
  } finally {
    await client.query("RESET SESSION AUTHORIZATION");
  }
}

async function transitionPaperOrder(client, command) {
  const payload = {
    canonicalContent: canonicalizeJson(command),
    ...command,
  };
  await client.query("SET SESSION AUTHORIZATION app_runtime");
  try {
    const result = await client.query(
      "SELECT etf.paper_order_transition($1::jsonb) AS result",
      [payload],
    );
    return result.rows[0].result;
  } finally {
    await client.query("RESET SESSION AUTHORIZATION");
  }
}

async function snapshotLedger(client, portfolioId) {
  const snapshot = await client.query(
    `SELECT portfolio.portfolio_version::text AS portfolio_version,
            (SELECT count(*)::integer FROM etf.ledger_transactions WHERE portfolio_id = $1::uuid) AS transactions,
            (SELECT count(*)::integer FROM etf.ledger_effects WHERE portfolio_id = $1::uuid) AS effects,
            (SELECT count(*)::integer FROM etf.ledger_lots WHERE portfolio_id = $1::uuid) AS lots,
            (SELECT count(*)::integer FROM etf.ledger_allocations WHERE portfolio_id = $1::uuid) AS allocations,
            (SELECT count(*)::integer FROM etf.ledger_reversal_links WHERE portfolio_id = $1::uuid) AS reversal_links,
            (SELECT count(*)::integer FROM etf.fills WHERE portfolio_id = $1::uuid) AS fills,
            (SELECT count(*)::integer FROM etf.ledger_command_replays WHERE portfolio_id = $1::uuid) AS command_replays,
            (SELECT count(*)::integer FROM etf.ledger_audit WHERE portfolio_id = $1::uuid) AS audits,
            (SELECT count(*)::integer FROM etf.ledger_commitments WHERE portfolio_id = $1::uuid) AS commitments,
            (SELECT count(*)::integer FROM etf.ledger_anchors WHERE portfolio_id = $1::uuid) AS anchors,
            (SELECT count(*)::integer FROM etf.audit_commitments) AS audit_commitments,
            (SELECT count(*)::integer FROM etf.audit_anchor_checkpoints) AS audit_checkpoints,
            (SELECT count(*)::integer FROM etf.portfolio_anchor_checkpoints WHERE portfolio_id = $1::uuid) AS portfolio_checkpoints,
            (SELECT jsonb_agg(transaction_record.evidence_hash ORDER BY transaction_record.ledger_sequence)
               FROM etf.ledger_transactions AS transaction_record
              WHERE transaction_record.portfolio_id = $1::uuid) AS transaction_hashes,
            (SELECT jsonb_agg(commitment.allocation_evidence_hash ORDER BY commitment.ledger_sequence)
               FROM etf.ledger_commitments AS commitment
              WHERE commitment.portfolio_id = $1::uuid) AS allocation_hashes,
            (SELECT jsonb_agg(commitment.commitment_hash ORDER BY commitment.ledger_sequence)
               FROM etf.ledger_commitments AS commitment
              WHERE commitment.portfolio_id = $1::uuid) AS commitment_hashes
       FROM etf.portfolios AS portfolio
      WHERE portfolio.portfolio_id = $1::uuid`,
    [portfolioId],
  );
  assert.equal(snapshot.rowCount, 1);
  return snapshot.rows[0];
}

async function raceUnderPortfolioLock(admin, portfolioId, contenders, operations) {
  await admin.query("BEGIN");
  await admin.query(
    "SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('etf:portfolio:' || $1::uuid::text, 0))",
    [portfolioId],
  );
  const backendPids = await Promise.all(contenders.map(async (client) => {
    const result = await client.query("SELECT pg_catalog.pg_backend_pid() AS pid");
    return result.rows[0].pid;
  }));
  const outcomes = Promise.allSettled(operations.map((operation) => operation()));
  try {
    let waiting = 0;
    for (let attempt = 0; attempt < 1000 && waiting !== contenders.length; attempt += 1) {
      const result = await admin.query(
        `SELECT count(*)::integer AS waiting
           FROM pg_catalog.pg_stat_activity
          WHERE pid = ANY($1::integer[])
            AND wait_event_type = 'Lock'
            AND wait_event = 'advisory'`,
        [backendPids],
      );
      waiting = result.rows[0].waiting;
      if (waiting !== contenders.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
    assert.equal(waiting, contenders.length, "both contenders must wait on the portfolio lock");
  } finally {
    await admin.query("COMMIT");
  }
  return outcomes;
}

function cashDeposit({ portfolioId, transactionId, correlationId, version, effectiveAt, amount = "100.00000000" }) {
  return {
    correlationId,
    effectiveAt,
    expectedPortfolioVersion: version,
    keyIdentifier: "primary",
    portfolioId,
    transactionId,
    type: "CashDeposit",
    amount,
  };
}

function deterministicUuid(group, value) {
  return `${group}-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

function fillFixture({ group, index, side, quantity, unitPrice, effectiveAt }) {
  return {
    orderId: deterministicUuid(group, 100 + index),
    transitionCommandId: deterministicUuid(group, 200 + index),
    fillId: deterministicUuid(group, 300 + index),
    transactionId: deterministicUuid(group, 400 + index),
    correlationId: deterministicUuid(group, 500 + index),
    researchEvidenceId: deterministicUuid(group, 600 + index),
    side,
    quantity,
    unitPrice,
    effectiveAt,
  };
}

function fillCommand({
  portfolioId,
  transactionId,
  correlationId,
  version,
  effectiveAt,
  orderId,
  transitionCommandId,
  fillId,
  instrumentId,
  side,
  quantity,
  unitPrice,
  fee = "0.00000000",
}) {
  return {
    correlationId,
    effectiveAt,
    expectedOrderVersion: 1,
    expectedPortfolioVersion: version,
    fee,
    fillId,
    instrumentId,
    keyIdentifier: "primary",
    orderId,
    orderSide: side,
    portfolioId,
    quantity,
    simulatedAt: effectiveAt,
    transactionId,
    transitionCommandId,
    type: `${side}Fill`,
    unitPrice,
  };
}

function reversal({
  portfolioId,
  transactionId,
  correlationId,
  version,
  effectiveAt,
  reversesTransactionId,
}) {
  return {
    correlationId,
    effectiveAt,
    expectedPortfolioVersion: version,
    keyIdentifier: "primary",
    portfolioId,
    reversesTransactionId,
    transactionId,
    type: "Reversal",
  };
}

test(
  "0003 rolls back its complete catalog on manifest failure",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await assert.rejects(
        () =>
          applyMigration(
            client,
            domainLedgerMigration,
            "2026-09-14T00:02:00.000Z",
            async () => {
              throw new Error("forced 0003 manifest stop");
            },
          ),
        /forced 0003 manifest stop/,
      );
      const remaining = await client.query(
        `SELECT count(*)::integer AS object_count
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'etf'
            AND relation.relname = ANY($1::text[])`,
        [domainLedgerTableNames],
      );
      assert.deepEqual(remaining.rows, [{ object_count: 0 }]);
      const migrationRows = await client.query(
        "SELECT count(*)::integer AS migration_count FROM etf.schema_migrations",
      );
      assert.deepEqual(migrationRows.rows, [{ migration_count: 2 }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0003 commits its exact manifest and atomic anchored cash behavior",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      let manifestJson;
      const applied = await applyMigration(
        client,
        domainLedgerMigration,
        "2026-09-14T00:02:00.000Z",
        async (transaction, migration) => {
          manifestJson = await projectPostgresSchemaManifest(transaction, migration);
          return manifestJson;
        },
      );

      const manifest = JSON.parse(manifestJson);
      assert.equal(
        applied.contentHash,
        "c5da21109969595e17dfb7b31e5c45296324b6d20caf1f1debdb1a70ea84a496",
      );
      assert.equal(
        applied.schemaManifestHash,
        "50fb07d7aeb7a51f8b985c6c53f8c1a2ef5707220032355bcd62769856076f13",
      );
      assert.equal(Buffer.byteLength(manifestJson, "utf8"), 16368);
      assert.equal(manifest.migrationSequence.length, 3);
      assert.equal(manifest.objects.filter(({ kind }) => kind === "table").length, 28);
      assert.equal(manifest.objects.filter(({ kind }) => kind === "function").length, 12);
      const owners = await client.query(
        `SELECT relation.relname AS name, owner.rolname AS owner
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = relation.relowner
          WHERE namespace.nspname = 'etf' AND relation.relkind = 'r'
            AND relation.relname = ANY($1::text[])
          ORDER BY relation.relname`,
        [domainLedgerTableNames],
      );
      const expectedOwners = new Map([
        ["paper_orders", "application_writer_owner"],
        ["order_transitions", "application_writer_owner"],
        ["order_command_replays", "application_writer_owner"],
        ["portfolios", "ledger_writer_owner"],
        ["fills", "ledger_writer_owner"],
        ["ledger_transactions", "ledger_writer_owner"],
        ["ledger_effects", "ledger_writer_owner"],
        ["ledger_lots", "ledger_writer_owner"],
        ["ledger_allocations", "ledger_writer_owner"],
        ["ledger_reversal_links", "ledger_writer_owner"],
        ["ledger_command_replays", "ledger_writer_owner"],
        ["ledger_commitments", "ledger_writer_owner"],
        ["order_audit", "audit_writer_owner"],
        ["access_denial_audit", "audit_writer_owner"],
        ["ledger_audit", "audit_writer_owner"],
        ["audit_commitments", "audit_writer_owner"],
        ["ledger_anchors", "anchor_owner"],
        ["portfolio_projections", "projection_owner"],
      ]);
      assert.deepEqual(
        owners.rows,
        [...domainLedgerTableNames]
          .sort()
          .map((name) => ({ name, owner: expectedOwners.get(name) })),
      );

      const functions = await client.query(
        `SELECT function_record.proname AS name, owner.rolname AS owner,
                function_record.prosecdef AS security_definer,
                function_record.provolatile AS volatility,
                function_record.proparallel AS parallel_safety,
                function_record.proconfig AS configuration,
                pg_catalog.has_function_privilege('public', function_record.oid, 'EXECUTE') AS public_execute
           FROM pg_catalog.pg_proc AS function_record
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = function_record.proowner
          WHERE namespace.nspname = 'etf'
            AND function_record.proname = ANY($1::text[])
          ORDER BY function_record.proname`,
        [domainLedgerFunctionNames],
      );
      assert.ok(
        functions.rows.every(
          ({ security_definer, volatility, parallel_safety, configuration, public_execute }) =>
            security_definer === true &&
            volatility === "v" &&
            parallel_safety === "u" &&
            configuration[0] === "search_path=pg_catalog, etf" &&
            public_execute === false,
        ),
      );
      const ledgerWriterAuthority = await client.query(
        `SELECT attribute.attname AS column_name,
                requested.privilege,
                pg_catalog.has_column_privilege(
                  'ledger_writer_owner', 'etf.paper_orders', attribute.attname,
                  requested.privilege
                ) AS granted
           FROM pg_catalog.pg_attribute AS attribute
          CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES'])
                     WITH ORDINALITY AS requested(privilege, privilege_order)
          WHERE attribute.attrelid = 'etf.paper_orders'::regclass
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
          ORDER BY attribute.attnum, requested.privilege_order`,
      );
      const paperOrderColumns = [
        "order_id",
        "instrument_id",
        "state",
        "aggregate_version",
        "research_evidence_id",
        "side",
        "requested_quantity",
        "filled_quantity",
        "open_quantity",
        "unit_price",
        "trade_date",
        "confirmation",
      ];
      const readableColumns = new Set([
        "order_id",
        "instrument_id",
        "side",
        "aggregate_version",
      ]);
      assert.deepEqual(
        ledgerWriterAuthority.rows,
        paperOrderColumns.flatMap((columnName) =>
          ["SELECT", "INSERT", "UPDATE", "REFERENCES"].map((privilege) => ({
            column_name: columnName,
            privilege,
            granted: privilege === "SELECT" && readableColumns.has(columnName),
          })),
        ),
      );

      await client.query("GRANT USAGE ON SCHEMA etf TO app_runtime, key_injector");
      await client.query(
        "GRANT EXECUTE ON FUNCTION etf.anchor_key_inject(text,bytea,timestamp with time zone) TO key_injector",
      );
      await client.query("GRANT EXECUTE ON FUNCTION etf.ledger_append(jsonb), etf.anchor_append(jsonb) TO app_runtime");

      await client.query("SET SESSION AUTHORIZATION key_injector");
      await client.query(
        "SELECT etf.anchor_key_inject('primary', decode('00112233445566778899aabbccddeeff', 'hex'), '2026-09-14T00:00:00.000Z')",
      );
      await assert.rejects(
        () =>
          client.query(
            "SELECT etf.anchor_key_inject('primary', decode('ff', 'hex'), '2026-09-14T00:00:00.000Z')",
          ),
        /ANCHOR_KEY_REPLACEMENT_FORBIDDEN/,
      );
      await client.query("RESET SESSION AUTHORIZATION");

      const command = {
        correlationId: "10000000-0000-4000-8000-000000000001",
        effectiveAt: "2026-09-14T00:03:00.000Z",
        expectedPortfolioVersion: 0,
        keyIdentifier: "primary",
        portfolioId: "20000000-0000-4000-8000-000000000001",
        transactionId: "30000000-0000-4000-8000-000000000001",
        type: "CashDeposit",
        amount: "100.00000000",
      };
      const contractGoldenEvidence = {
        baselineVersion: "v1.0.0",
        correlationId: "corr-1",
        effectiveAt: "2026-09-10T12:00:00.000Z",
        effects: [{
          effectOrdinal: 0,
          effectType: "Cash",
          instrumentId: null,
          lotId: null,
          money: "100.00000000",
          quantity: null,
          rate: null,
          sourceEffectId: null,
        }],
        fillId: null,
        ledgerSequence: 1,
        orderId: null,
        portfolioId: "portfolio-1",
        precisionPolicyVersion: "DEC-014",
        recordedAt: "2026-09-10T12:00:00.000Z",
        reversesTransactionId: null,
        transactionId: "tx-1",
        type: "CashDeposit",
      };
      assert.equal(
        sha256(canonicalizeJson(contractGoldenEvidence)),
        "e36056ee2d240bd513b0eef2ed4d8d6e7815a08d0882dc82a7e11e664188eb18",
      );
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      const ledger = await client.query(
        "SELECT etf.ledger_append($1::jsonb) AS result",
        [{ canonicalContent: canonicalizeJson(command), ...command }],
      );
      assert.equal(ledger.rows[0].result.portfolioVersion, 1);
      assert.equal(ledger.rows[0].result.ledgerSequence, 1);
      await client.query("RESET SESSION AUTHORIZATION");
      const evidence = await client.query(
        `SELECT transaction_record.recorded_at,
                transaction_record.evidence_hash AS persisted_transaction_hash,
                commitment.transaction_evidence_hash,
                commitment.allocation_evidence_hash,
                commitment.audit_evidence_hash AS commitment_audit_hash,
                commitment.previous_portfolio_commitment,
                commitment.commitment_hash,
                audit.transaction_evidence_hash AS audit_transaction_hash,
                audit.allocation_evidence_hash AS audit_allocation_hash,
                audit.audit_evidence_hash AS persisted_audit_hash,
                audit.audit_id::text,
                audit.attempt_intent_id::text,
                audit.action AS audit_action,
                audit.outcome AS audit_outcome,
                audit.error_code,
                audit.replay_classification,
                audit.correlation_id::text AS audit_correlation_id,
                audit.transition_command_id::text,
                audit.old_order_version,
                audit.new_order_version,
                audit.old_portfolio_version,
                audit.new_portfolio_version,
                audit.reverses_transaction_id::text,
                audit.reversed_by_transaction_id::text,
                audit.actor_subject,
                audit.workload_identity,
                audit.authentication_context_digest,
                audit.recorded_at AS audit_recorded_at,
                audit_commitment.audit_sequence,
                audit_commitment.audit_segment_hash,
                audit_commitment.previous_audit_commitment,
                audit_commitment.key_identifier,
                audit_commitment.audit_commitment,
                audit_commitment.anchor_hmac
           FROM etf.ledger_transactions AS transaction_record
           JOIN etf.ledger_commitments AS commitment
             USING (portfolio_id, ledger_sequence)
           JOIN etf.ledger_audit AS audit
             USING (portfolio_id, transaction_id, ledger_sequence)
           JOIN etf.audit_commitments AS audit_commitment
             ON audit_commitment.audit_segment_hash = audit.audit_evidence_hash
          WHERE transaction_record.portfolio_id = $1::uuid
            AND transaction_record.transaction_id = $2::uuid`,
        [command.portfolioId, command.transactionId],
      );
      assert.equal(evidence.rowCount, 1);
      const persisted = evidence.rows[0];
      const recordedAt = persisted.recorded_at.toISOString();
      const expectedTransactionHash = sha256(canonicalizeJson({
        baselineVersion: "v1.0.0",
        correlationId: command.correlationId,
        effectiveAt: command.effectiveAt,
        effects: [{
          effectOrdinal: 0,
          effectType: "Cash",
          instrumentId: null,
          lotId: null,
          money: command.amount,
          quantity: null,
          rate: null,
          sourceEffectId: null,
        }],
        fillId: null,
        ledgerSequence: 1,
        orderId: null,
        portfolioId: command.portfolioId,
        precisionPolicyVersion: "DEC-014",
        recordedAt,
        reversesTransactionId: null,
        transactionId: command.transactionId,
        type: command.type,
      }));
      const expectedAllocationHash = sha256("[]");
      assert.equal(ledger.rows[0].result.transactionEvidenceHash, expectedTransactionHash);
      assert.equal(ledger.rows[0].result.allocationEvidenceHash, expectedAllocationHash);
      assert.equal(persisted.persisted_transaction_hash, expectedTransactionHash);
      assert.equal(persisted.transaction_evidence_hash, expectedTransactionHash);
      assert.equal(persisted.audit_transaction_hash, expectedTransactionHash);
      assert.equal(persisted.allocation_evidence_hash, expectedAllocationHash);
      assert.equal(persisted.audit_allocation_hash, expectedAllocationHash);
      assert.equal(persisted.commitment_audit_hash, persisted.persisted_audit_hash);
      assert.equal(persisted.previous_portfolio_commitment, null);

      const expectedAuditHash = sha256(canonicalizeJson({
        action: persisted.audit_action,
        actorSubject: persisted.actor_subject,
        allocationEvidenceHash: expectedAllocationHash,
        attemptIntentId: persisted.attempt_intent_id,
        auditId: persisted.audit_id,
        authenticationContextDigest: persisted.authentication_context_digest,
        correlationId: persisted.audit_correlation_id,
        errorCode: persisted.error_code,
        ledgerSequence: 1,
        newOrderVersion: persisted.new_order_version,
        newPortfolioVersion: Number(persisted.new_portfolio_version),
        oldOrderVersion: persisted.old_order_version,
        oldPortfolioVersion: Number(persisted.old_portfolio_version),
        outcome: persisted.audit_outcome,
        portfolioId: command.portfolioId,
        recordedAt: persisted.audit_recorded_at.toISOString(),
        replayClassification: persisted.replay_classification,
        reversedByTransactionId: persisted.reversed_by_transaction_id,
        reversesTransactionId: persisted.reverses_transaction_id,
        transactionEvidenceHash: expectedTransactionHash,
        transactionId: command.transactionId,
        transitionCommandId: persisted.transition_command_id,
        workloadIdentity: persisted.workload_identity,
      }));
      assert.equal(persisted.persisted_audit_hash, expectedAuditHash);

      const expectedPortfolioCommitment = sha256(canonicalizeJson({
        allocationEvidenceHash: expectedAllocationHash,
        auditEvidenceHash: persisted.persisted_audit_hash,
        domain: "etf.ledger.commitment.v1",
        ledgerSequence: 1,
        portfolioId: command.portfolioId,
        previousPortfolioCommitment: null,
        transactionEvidenceHash: expectedTransactionHash,
      }));
      assert.equal(persisted.commitment_hash, expectedPortfolioCommitment);
      assert.equal(ledger.rows[0].result.commitmentHash, expectedPortfolioCommitment);

      const auditCommitmentContent = canonicalizeJson({
        auditSegmentHash: persisted.audit_segment_hash,
        auditSequence: Number(persisted.audit_sequence),
        domain: "etf.audit.commitment.v1",
        keyIdentifier: "primary",
        previousAuditCommitment: null,
      });
      assert.equal(persisted.key_identifier, "primary");
      assert.equal(persisted.previous_audit_commitment, null);
      assert.equal(persisted.audit_commitment, sha256(auditCommitmentContent));
      assert.equal(
        persisted.anchor_hmac,
        createHmac("sha256", Buffer.from("00112233445566778899aabbccddeeff", "hex"))
          .update(auditCommitmentContent, "utf8")
          .digest("hex"),
      );
          await client.query("SET SESSION AUTHORIZATION app_runtime");
      await assert.rejects(
        () =>
          client.query(
            "SELECT etf.anchor_append($1::jsonb)",
            [{
              domain: "Verify",
              portfolioId: command.portfolioId,
              sourceCommitmentHash: ledger.rows[0].result.commitmentHash,
            }],
          ),
        /permission denied/,
      );
      await client.query("RESET SESSION AUTHORIZATION");

      const counts = await client.query(
        `SELECT
           (SELECT count(*)::integer FROM etf.ledger_transactions) AS transactions,
           (SELECT count(*)::integer FROM etf.ledger_audit) AS audits,
           (SELECT count(*)::integer FROM etf.audit_commitments) AS audit_commitments,
           (SELECT count(*)::integer FROM etf.ledger_commitments) AS ledger_commitments,
           (SELECT count(*)::integer FROM etf.ledger_anchors) AS anchors,
           (SELECT count(*)::integer FROM etf.portfolio_anchor_checkpoints) AS checkpoints`,
      );
      assert.deepEqual(counts.rows, [{
        transactions: 1,
        audits: 1,
        audit_commitments: 1,
        ledger_commitments: 1,
        anchors: 1,
        checkpoints: 1,
      }]);
      for (const statement of [
        "INSERT INTO etf.ledger_transactions DEFAULT VALUES",
        "UPDATE etf.ledger_transactions SET evidence_hash = evidence_hash",
        "DELETE FROM etf.ledger_transactions",
        "TRUNCATE etf.ledger_transactions",
      ]) {
        await client.query("SET SESSION AUTHORIZATION app_runtime");
        try {
          await assert.rejects(() => client.query(statement), (error) => error.code === "42501");
        } finally {
          await client.query("RESET SESSION AUTHORIZATION");
        }
        assert.deepEqual((await client.query(
          `SELECT (SELECT count(*)::integer FROM etf.ledger_transactions) AS transactions,
                  (SELECT count(*)::integer FROM etf.ledger_audit) AS audits,
                  (SELECT count(*)::integer FROM etf.audit_commitments) AS audit_commitments,
                  (SELECT count(*)::integer FROM etf.ledger_commitments) AS commitments,
                  (SELECT count(*)::integer FROM etf.ledger_anchors) AS anchors,
                  (SELECT count(*)::integer FROM etf.portfolio_anchor_checkpoints) AS checkpoints`,
        )).rows, [{
          transactions: 1,
          audits: 1,
          audit_commitments: 1,
          commitments: 1,
          anchors: 1,
          checkpoints: 1,
        }]);
      }
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0003 rejects noncanonical and duplicate-key ledger content before mutation",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const command = cashDeposit({
      portfolioId: deterministicUuid("50000000", 1),
      transactionId: deterministicUuid("50000000", 2),
      correlationId: deterministicUuid("50000000", 3),
      version: 0,
      effectiveAt: "2026-09-14T00:03:00.000Z",
    });
    const duplicateKeyContent = `{"amount":"100.00000000","amount":"100.00000000","correlationId":"${command.correlationId}","effectiveAt":"${command.effectiveAt}","expectedPortfolioVersion":0,"keyIdentifier":"primary","portfolioId":"${command.portfolioId}","transactionId":"${command.transactionId}","type":"CashDeposit"}`;
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      for (const canonicalContent of [
        JSON.stringify(command, null, 2),
        duplicateKeyContent,
      ]) {
        await client.query("SET SESSION AUTHORIZATION app_runtime");
        try {
          await assert.rejects(
            () => client.query(
              "SELECT etf.ledger_append($1::jsonb)",
              [{ canonicalContent, ...command }],
            ),
            /LEDGER_REQUEST_INVALID/,
          );
        } finally {
          await client.query("RESET SESSION AUTHORIZATION");
        }
        const counts = await client.query(
          `SELECT (SELECT count(*)::integer FROM etf.portfolios) AS portfolios,
                  (SELECT count(*)::integer FROM etf.ledger_transactions) AS transactions,
                  (SELECT count(*)::integer FROM etf.ledger_audit) AS audits`,
        );
        assert.deepEqual(counts.rows, [{ portfolios: 0, transactions: 0, audits: 0 }]);
      }
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0003 rejects noncanonical and duplicate-key paper order content before mutation",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "54400000";
    const command = {
      correlationId: deterministicUuid(group, 1),
      expectedVersion: 0,
      occurredAt: "2026-09-17T12:00:00.000Z",
      operation: "DraftCreate",
      orderId: deterministicUuid(group, 2),
      transition: "OT-01",
      transitionCommandId: deterministicUuid(group, 3),
      transitionPayload: {
        instrumentId: "CANONICAL-ETF",
        quantity: "2.0000000000",
        researchEvidenceId: deterministicUuid(group, 4),
        side: "Buy",
        tradeDate: "2026-09-17",
        unitPrice: "10.0000000000",
      },
    };
    const duplicateKeyContent = canonicalizeJson(command).replace(
      '"expectedVersion":0',
      '"expectedVersion":0,"expectedVersion":0',
    );

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await client.query("GRANT EXECUTE ON FUNCTION etf.paper_order_transition(jsonb) TO app_runtime");
      for (const canonicalContent of [
        JSON.stringify(command, null, 2),
        `{"operation":"DraftCreate",${canonicalizeJson(command).slice(1).replace(',"operation":"DraftCreate"', "")}`,
        duplicateKeyContent,
      ]) {
        await client.query("SET SESSION AUTHORIZATION app_runtime");
        try {
          await assert.rejects(
            () => client.query(
              "SELECT etf.paper_order_transition($1::jsonb)",
              [{ canonicalContent, ...command }],
            ),
            /APPLICATION_REQUEST_INVALID/,
          );
        } finally {
          await client.query("RESET SESSION AUTHORIZATION");
        }
        const counts = await client.query(
          `SELECT (SELECT count(*)::integer FROM etf.paper_orders) AS orders,
                  (SELECT count(*)::integer FROM etf.order_transitions) AS transitions,
                  (SELECT count(*)::integer FROM etf.order_command_replays) AS replays,
                  (SELECT count(*)::integer FROM etf.order_audit) AS audits`,
        );
        assert.deepEqual(counts.rows, [{ orders: 0, transitions: 0, replays: 0, audits: 0 }]);
      }
      for (const nonFinite of ["NaN", "Infinity", "-Infinity"]) {
        for (const field of ["quantity", "unitPrice"]) {
          const invalidCommand = {
            ...command,
            transitionPayload: { ...command.transitionPayload, [field]: nonFinite },
          };
          await client.query("SET SESSION AUTHORIZATION app_runtime");
          try {
            await assert.rejects(
              () => client.query(
                "SELECT etf.paper_order_transition($1::jsonb)",
                [{ canonicalContent: canonicalizeJson(invalidCommand), ...invalidCommand }],
              ),
              /APPLICATION_REQUEST_INVALID/,
            );
          } finally {
            await client.query("RESET SESSION AUTHORIZATION");
          }
        }
      }
      const invalidFill = {
        ...command,
        operation: "Transition",
        transition: "OT-05",
        transitionPayload: {
          expectedPortfolioVersion: 0,
          fee: "NaN",
          fillId: deterministicUuid(group, 5),
          portfolioId: deterministicUuid(group, 6),
          quantity: "1.0000000000",
          transactionId: deterministicUuid(group, 7),
          unitPrice: "10.0000000000",
        },
      };
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      try {
        await assert.rejects(
          () => client.query(
            "SELECT etf.paper_order_transition($1::jsonb)",
            [{ canonicalContent: canonicalizeJson(invalidFill), ...invalidFill }],
          ),
          /APPLICATION_REQUEST_INVALID/,
        );
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }
      const counts = await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.paper_orders) AS orders,
                (SELECT count(*)::integer FROM etf.order_transitions) AS transitions,
                (SELECT count(*)::integer FROM etf.order_command_replays) AS replays,
                (SELECT count(*)::integer FROM etf.order_audit) AS audits`,
      );
      assert.deepEqual(counts.rows, [{ orders: 0, transitions: 0, replays: 0, audits: 0 }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-ORD-003 confirmed drafts become Submitted with evidence only",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "54500000";
    const orderId = deterministicUuid(group, 1);
    const confirmation = {
      actorId: "local-user",
      confirmedAt: "2026-09-17T13:01:00.000Z",
      confirmationText: "Submit hypothetical paper order",
    };
    const envelope = (operation, commandId, requestedAt, payload) => JSON.stringify({
      operation,
      requestId: deterministicUuid(group, Number(commandId.slice(-3)) + 100),
      correlationId: deterministicUuid(group, 2),
      actorId: "local-user",
      prototypeCandidate: "v1.0.0-prototype.1",
      contractVersion: "1.0.0-candidate.2",
      requestedAt,
      commandId,
      payload,
    });

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      let draft;
      let submitted;
      try {
        const dependencies = {
          replayStore: createPostgresApplicationReplayStore(client),
          completedAt: () => "2026-09-17T13:02:00.000Z",
          checkReadiness: () => undefined,
          ownerDispatch: (definition, payload, context) =>
            dispatchPostgresPaperOrder(client, definition, payload, context),
        };
        draft = await executeApplicationRequestAsync(
          envelope(
            "PaperOrderDraftCreate",
            deterministicUuid(group, 3),
            "2026-09-17T13:00:00.000Z",
            {
              orderId,
              instrumentId: "CONFIRM-ETF",
              researchEvidenceId: deterministicUuid(group, 4),
              side: "Buy",
              quantity: "2.0000000000",
              unitPrice: "10.0000000000",
              tradeDate: "2026-09-17",
            },
          ),
          dependencies,
        );
        submitted = await executeApplicationRequestAsync(
          envelope(
            "PaperOrderTransition",
            deterministicUuid(group, 5),
            confirmation.confirmedAt,
            {
              orderId,
              transitionCommandId: deterministicUuid(group, 6),
              expectedVersion: "1",
              transition: "OT-02",
              transitionPayload: { confirmation },
            },
          ),
          dependencies,
        );
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }

      assert.equal(draft.outcome, "Succeeded", JSON.stringify(draft));
      assert.equal(submitted.outcome, "Succeeded", JSON.stringify(submitted));
      assert.equal(submitted.data.order.state, "Submitted");
      assert.equal(submitted.data.order.aggregateVersion, "2");
      assert.deepEqual(submitted.data.order.confirmation, confirmation);
      assert.deepEqual(
        submitted.data.order.transitionHistory.map((transition) => ({
          transition: transition.transition,
          sourceState: transition.sourceState,
          targetState: transition.targetState,
          trigger: transition.trigger,
          priorVersion: transition.priorVersion,
          resultingVersion: transition.resultingVersion,
        })),
        [
          { transition: "OT-01", sourceState: "Initial", targetState: "Draft", trigger: "UserCreatedFromResearch", priorVersion: "0", resultingVersion: "1" },
          { transition: "OT-02", sourceState: "Draft", targetState: "Submitted", trigger: "UserConfirmedPaperAction", priorVersion: "1", resultingVersion: "2" },
        ],
      );

      const evidence = await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.paper_orders) AS orders,
                (SELECT count(*)::integer FROM etf.order_transitions) AS transitions,
                (SELECT count(*)::integer FROM etf.order_command_replays) AS order_replays,
                (SELECT count(*)::integer FROM etf.order_audit) AS order_audits,
                (SELECT count(*)::integer FROM etf.application_replays) AS application_replays,
                (SELECT count(*)::integer FROM etf.fills) AS fills,
                (SELECT count(*)::integer FROM etf.portfolios) AS portfolios,
                (SELECT count(*)::integer FROM etf.ledger_transactions) AS ledger_transactions,
                (SELECT count(*)::integer FROM etf.ledger_effects) AS ledger_effects,
                (SELECT count(*)::integer FROM etf.ledger_allocations) AS ledger_allocations`,
      );
      assert.deepEqual(evidence.rows, [{
        orders: 1,
        transitions: 2,
        order_replays: 2,
        order_audits: 2,
        application_replays: 2,
        fills: 0,
        portfolios: 0,
        ledger_transactions: 0,
        ledger_effects: 0,
        ledger_allocations: 0,
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-ORD-004 Submitted validation chooses exactly OT-03 or OT-04",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "54600000";
    const scenarios = [
      {
        offset: 0,
        transition: "OT-03",
        targetState: "Accepted",
        transitionPayload: {
          portfolioId: deterministicUuid(group, 301),
          validationSnapshotId: deterministicUuid(group, 302),
          expectedPortfolioVersion: "0",
        },
      },
      {
        offset: 10,
        transition: "OT-04",
        targetState: "Rejected",
        transitionPayload: { rejectionCode: "PORTFOLIO_VALIDATION_FAILED" },
      },
    ];
    const envelope = (operation, commandIndex, requestedAt, payload) => JSON.stringify({
      operation,
      requestId: deterministicUuid(group, commandIndex + 500),
      correlationId: deterministicUuid(group, commandIndex + 600),
      actorId: "local-user",
      prototypeCandidate: "v1.0.0-prototype.1",
      contractVersion: "1.0.0-candidate.2",
      requestedAt,
      commandId: deterministicUuid(group, commandIndex),
      payload,
    });

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      try {
        const dependencies = {
          replayStore: createPostgresApplicationReplayStore(client),
          completedAt: () => "2026-09-17T14:03:00.000Z",
          checkReadiness: () => undefined,
          ownerDispatch: (definition, payload, context) =>
            dispatchPostgresPaperOrder(client, definition, payload, context),
        };
        for (const scenario of scenarios) {
          const orderId = deterministicUuid(group, scenario.offset + 1);
          const confirmation = {
            actorId: "local-user",
            confirmedAt: "2026-09-17T14:01:00.000Z",
            confirmationText: "Submit hypothetical paper order",
          };
          const commands = [
            envelope(
              "PaperOrderDraftCreate",
              scenario.offset + 101,
              "2026-09-17T14:00:00.000Z",
              {
                orderId,
                instrumentId: `VALIDATE-${scenario.transition}`,
                researchEvidenceId: deterministicUuid(group, scenario.offset + 2),
                side: "Buy",
                quantity: "2.0000000000",
                unitPrice: "10.0000000000",
                tradeDate: "2026-09-17",
              },
            ),
            envelope(
              "PaperOrderTransition",
              scenario.offset + 102,
              confirmation.confirmedAt,
              {
                orderId,
                transitionCommandId: deterministicUuid(group, scenario.offset + 202),
                expectedVersion: "1",
                transition: "OT-02",
                transitionPayload: { confirmation },
              },
            ),
            envelope(
              "PaperOrderTransition",
              scenario.offset + 103,
              "2026-09-17T14:02:00.000Z",
              {
                orderId,
                transitionCommandId: deterministicUuid(group, scenario.offset + 203),
                expectedVersion: "2",
                transition: scenario.transition,
                transitionPayload: scenario.transitionPayload,
              },
            ),
          ];
          let result;
          for (const command of commands) {
            result = await executeApplicationRequestAsync(command, dependencies);
            assert.equal(result.outcome, "Succeeded", JSON.stringify(result));
          }
          assert.equal(result.data.order.state, scenario.targetState);
          assert.equal(result.data.order.aggregateVersion, "3");
          assert.equal(result.data.order.filledQuantity, "0.0000000000");
          assert.equal(
            result.data.order.openQuantity,
            scenario.targetState === "Rejected" ? "0.0000000000" : "2.0000000000",
          );
          assert.deepEqual(
            result.data.order.transitionHistory.map(({ transition }) => transition),
            ["OT-01", "OT-02", scenario.transition],
          );
        }
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }

      const evidence = await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.paper_orders) AS orders,
                (SELECT count(*)::integer FROM etf.order_transitions WHERE transition = 'OT-03') AS accepted,
                (SELECT count(*)::integer FROM etf.order_transitions WHERE transition = 'OT-04') AS rejected,
                (SELECT jsonb_agg(normalized_payload ORDER BY transition)
                   FROM etf.order_transitions
                  WHERE transition IN ('OT-03', 'OT-04')) AS validation_payloads,
                (SELECT count(*)::integer FROM etf.fills) AS fills,
                (SELECT count(*)::integer FROM etf.ledger_transactions) AS ledger_transactions,
                (SELECT count(*)::integer FROM etf.ledger_effects) AS ledger_effects,
                (SELECT count(*)::integer FROM etf.ledger_allocations) AS ledger_allocations`,
      );
      assert.deepEqual(evidence.rows, [{
        orders: 2,
        accepted: 1,
        rejected: 1,
        validation_payloads: scenarios.map(({ transitionPayload }) => ({
          ...transitionPayload,
          ...(transitionPayload.expectedPortfolioVersion === undefined
            ? {}
            : { expectedPortfolioVersion: 0 }),
        })),
        fills: 0,
        ledger_transactions: 0,
        ledger_effects: 0,
        ledger_allocations: 0,
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-ORD-005 Accepted supports exactly OT-05 through OT-08",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "54700000";
    const scenarios = [
      { offset: 0, transition: "OT-05", targetState: "Partial", filled: "1.0000000000", open: "1.0000000000" },
      { offset: 10, transition: "OT-06", targetState: "Filled", filled: "2.0000000000", open: "0.0000000000" },
      { offset: 20, transition: "OT-07", targetState: "Canceled", filled: "0.0000000000", open: "0.0000000000" },
      { offset: 30, transition: "OT-08", targetState: "Expired", filled: "0.0000000000", open: "0.0000000000" },
    ];
    const envelope = (operation, commandIndex, requestedAt, payload) => JSON.stringify({
      operation,
      requestId: deterministicUuid(group, commandIndex + 500),
      correlationId: deterministicUuid(group, commandIndex + 600),
      actorId: "local-user",
      prototypeCandidate: "v1.0.0-prototype.1",
      contractVersion: "1.0.0-candidate.2",
      requestedAt,
      commandId: deterministicUuid(group, commandIndex),
      payload,
    });

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await client.query("GRANT EXECUTE ON FUNCTION etf.ledger_append(jsonb) TO app_runtime");
      for (const scenario of scenarios.slice(0, 2)) {
        await appendLedger(client, cashDeposit({
          portfolioId: deterministicUuid(group, scenario.offset + 301),
          transactionId: deterministicUuid(group, scenario.offset + 401),
          correlationId: deterministicUuid(group, scenario.offset + 501),
          version: 0,
          effectiveAt: "2026-09-17T15:00:00.000Z",
        }));
      }
      await client.query("REVOKE EXECUTE ON FUNCTION etf.ledger_append(jsonb) FROM app_runtime");

      await client.query("SET SESSION AUTHORIZATION app_runtime");
      try {
        const dependencies = {
          replayStore: createPostgresApplicationReplayStore(client),
          completedAt: () => "2026-09-17T15:05:00.000Z",
          checkReadiness: () => undefined,
          ownerDispatch: (definition, payload, context) =>
            dispatchPostgresPaperOrder(client, definition, payload, context),
        };
        for (const scenario of scenarios) {
          const orderId = deterministicUuid(group, scenario.offset + 1);
          const portfolioId = deterministicUuid(group, scenario.offset + 301);
          const confirmation = {
            actorId: "local-user",
            confirmedAt: "2026-09-17T15:01:00.000Z",
            confirmationText: "Submit hypothetical paper order",
          };
          const transitionPayload = scenario.transition === "OT-05" || scenario.transition === "OT-06"
            ? {
                portfolioId,
                transactionId: deterministicUuid(group, scenario.offset + 4010),
                fillId: deterministicUuid(group, scenario.offset + 4020),
                expectedPortfolioVersion: "1",
                quantity: scenario.transition === "OT-05" ? "1.0000000000" : "2.0000000000",
                unitPrice: "10.0000000000",
                fee: "0.00000000",
              }
            : scenario.transition === "OT-07"
            ? { reasonCode: "USER_CANCELED" }
            : { expiresAt: "2026-09-17T15:03:00.000Z" };
          const commands = [
            envelope("PaperOrderDraftCreate", scenario.offset + 101, "2026-09-17T15:00:00.000Z", {
              orderId,
              instrumentId: `ACCEPTED-${scenario.transition}`,
              researchEvidenceId: deterministicUuid(group, scenario.offset + 2),
              side: "Buy",
              quantity: "2.0000000000",
              unitPrice: "10.0000000000",
              tradeDate: "2026-09-17",
            }),
            envelope("PaperOrderTransition", scenario.offset + 102, confirmation.confirmedAt, {
              orderId,
              transitionCommandId: deterministicUuid(group, scenario.offset + 202),
              expectedVersion: "1",
              transition: "OT-02",
              transitionPayload: { confirmation },
            }),
            envelope("PaperOrderTransition", scenario.offset + 103, "2026-09-17T15:02:00.000Z", {
              orderId,
              transitionCommandId: deterministicUuid(group, scenario.offset + 203),
              expectedVersion: "2",
              transition: "OT-03",
              transitionPayload: {
                portfolioId,
                validationSnapshotId: deterministicUuid(group, scenario.offset + 303),
                expectedPortfolioVersion: scenario.offset < 20 ? "1" : "0",
              },
            }),
            envelope("PaperOrderTransition", scenario.offset + 104, "2026-09-17T15:04:00.000Z", {
              orderId,
              transitionCommandId: deterministicUuid(group, scenario.offset + 204),
              expectedVersion: "3",
              transition: scenario.transition,
              transitionPayload,
            }),
          ];
          let result;
          for (const command of commands) {
            result = await executeApplicationRequestAsync(command, dependencies);
            assert.equal(result.outcome, "Succeeded", `${scenario.transition}: ${JSON.stringify(result)}`);
          }
          assert.equal(result.data.order.state, scenario.targetState, scenario.transition);
          assert.equal(result.data.order.aggregateVersion, "4", scenario.transition);
          assert.equal(result.data.order.filledQuantity, scenario.filled, scenario.transition);
          assert.equal(result.data.order.openQuantity, scenario.open, scenario.transition);
        }
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }

      const evidence = await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.fills) AS fills,
                (SELECT count(*)::integer FROM etf.ledger_transactions) AS ledger_transactions,
                (SELECT count(*)::integer FROM etf.ledger_effects) AS ledger_effects,
                (SELECT count(*)::integer FROM etf.ledger_lots) AS ledger_lots,
                (SELECT count(*)::integer FROM etf.ledger_allocations) AS ledger_allocations,
                (SELECT count(*)::integer FROM etf.order_transitions WHERE transition IN ('OT-05','OT-06','OT-07','OT-08')) AS completion_transitions`,
      );
      assert.deepEqual(evidence.rows, [{
        fills: 2,
        ledger_transactions: 4,
        ledger_effects: 8,
        ledger_lots: 2,
        ledger_allocations: 0,
        completion_transitions: 4,
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-ORD-006 Partial preserves prior fills through OT-09 or OT-10",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "54800000";
    const scenarios = [
      { offset: 0, transition: "OT-09", targetState: "Filled", fillCount: 2 },
      { offset: 10, transition: "OT-10", targetState: "Canceled", fillCount: 1 },
    ];
    const envelope = (operation, commandIndex, requestedAt, payload) => JSON.stringify({
      operation,
      requestId: deterministicUuid(group, commandIndex + 500),
      correlationId: deterministicUuid(group, commandIndex + 600),
      actorId: "local-user",
      prototypeCandidate: "v1.0.0-prototype.1",
      contractVersion: "1.0.0-candidate.2",
      requestedAt,
      commandId: deterministicUuid(group, commandIndex),
      payload,
    });

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await client.query("GRANT EXECUTE ON FUNCTION etf.ledger_append(jsonb) TO app_runtime");
      for (const scenario of scenarios) {
        await appendLedger(client, cashDeposit({
          portfolioId: deterministicUuid(group, scenario.offset + 301),
          transactionId: deterministicUuid(group, scenario.offset + 401),
          correlationId: deterministicUuid(group, scenario.offset + 501),
          version: 0,
          effectiveAt: "2026-09-17T16:00:00.000Z",
        }));
      }
      await client.query("REVOKE EXECUTE ON FUNCTION etf.ledger_append(jsonb) FROM app_runtime");

      await client.query("SET SESSION AUTHORIZATION app_runtime");
      try {
        const dependencies = {
          replayStore: createPostgresApplicationReplayStore(client),
          completedAt: () => "2026-09-17T16:06:00.000Z",
          checkReadiness: () => undefined,
          ownerDispatch: (definition, payload, context) =>
            dispatchPostgresPaperOrder(client, definition, payload, context),
        };
        for (const scenario of scenarios) {
          const orderId = deterministicUuid(group, scenario.offset + 1);
          const portfolioId = deterministicUuid(group, scenario.offset + 301);
          const partialFillId = deterministicUuid(group, scenario.offset + 4010);
          const confirmation = {
            actorId: "local-user",
            confirmedAt: "2026-09-17T16:01:00.000Z",
            confirmationText: "Submit hypothetical paper order",
          };
          const commands = [
            envelope("PaperOrderDraftCreate", scenario.offset + 101, "2026-09-17T16:00:00.000Z", {
              orderId,
              instrumentId: `PARTIAL-${scenario.transition}`,
              researchEvidenceId: deterministicUuid(group, scenario.offset + 2),
              side: "Buy",
              quantity: "2.0000000000",
              unitPrice: "10.0000000000",
              tradeDate: "2026-09-17",
            }),
            envelope("PaperOrderTransition", scenario.offset + 102, confirmation.confirmedAt, {
              orderId,
              transitionCommandId: deterministicUuid(group, scenario.offset + 202),
              expectedVersion: "1",
              transition: "OT-02",
              transitionPayload: { confirmation },
            }),
            envelope("PaperOrderTransition", scenario.offset + 103, "2026-09-17T16:02:00.000Z", {
              orderId,
              transitionCommandId: deterministicUuid(group, scenario.offset + 203),
              expectedVersion: "2",
              transition: "OT-03",
              transitionPayload: {
                portfolioId,
                validationSnapshotId: deterministicUuid(group, scenario.offset + 303),
                expectedPortfolioVersion: "1",
              },
            }),
            envelope("PaperOrderTransition", scenario.offset + 104, "2026-09-17T16:03:00.000Z", {
              orderId,
              transitionCommandId: deterministicUuid(group, scenario.offset + 204),
              expectedVersion: "3",
              transition: "OT-05",
              transitionPayload: {
                portfolioId,
                transactionId: deterministicUuid(group, scenario.offset + 4040),
                fillId: partialFillId,
                expectedPortfolioVersion: "1",
                quantity: "1.0000000000",
                unitPrice: "10.0000000000",
                fee: "0.00000000",
              },
            }),
            envelope("PaperOrderTransition", scenario.offset + 105, "2026-09-17T16:04:00.000Z", {
              orderId,
              transitionCommandId: deterministicUuid(group, scenario.offset + 205),
              expectedVersion: "4",
              transition: scenario.transition,
              transitionPayload: scenario.transition === "OT-09"
                ? {
                    portfolioId,
                    transactionId: deterministicUuid(group, scenario.offset + 4050),
                    fillId: deterministicUuid(group, scenario.offset + 4020),
                    expectedPortfolioVersion: "2",
                    quantity: "1.0000000000",
                    unitPrice: "10.0000000000",
                    fee: "0.00000000",
                  }
                : { reasonCode: "USER_CANCELED_REMAINDER" },
            }),
          ];
          let result;
          for (const command of commands) {
            result = await executeApplicationRequestAsync(command, dependencies);
            assert.equal(result.outcome, "Succeeded", `${scenario.transition}: ${JSON.stringify(result)}`);
          }
          assert.equal(result.data.order.state, scenario.targetState, scenario.transition);
          assert.equal(result.data.order.aggregateVersion, "5", scenario.transition);
          assert.equal(result.data.order.filledQuantity, scenario.transition === "OT-09" ? "2.0000000000" : "1.0000000000");
          assert.equal(result.data.order.openQuantity, "0.0000000000", scenario.transition);
        }
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }

      for (const scenario of scenarios) {
        const fills = await client.query(
          `SELECT fill_id::text, quantity::text
             FROM etf.fills
            WHERE order_id = $1::uuid
            ORDER BY simulated_at, fill_id`,
          [deterministicUuid(group, scenario.offset + 1)],
        );
        assert.equal(fills.rows.length, scenario.fillCount, scenario.transition);
        assert.deepEqual(fills.rows[0], {
          fill_id: deterministicUuid(group, scenario.offset + 4010),
          quantity: "1.0000000000",
        });
      }

      const evidence = await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.fills) AS fills,
                (SELECT count(*)::integer FROM etf.ledger_transactions) AS ledger_transactions,
                (SELECT count(*)::integer FROM etf.ledger_effects) AS ledger_effects,
                (SELECT count(*)::integer FROM etf.ledger_lots) AS ledger_lots,
                (SELECT count(*)::integer FROM etf.order_transitions WHERE transition IN ('OT-09','OT-10')) AS closing_transitions`,
      );
      assert.deepEqual(evidence.rows, [{
        fills: 3,
        ledger_transactions: 5,
        ledger_effects: 11,
        ledger_lots: 3,
        closing_transitions: 2,
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-ORD-009 equivalent replay is stable and conflicting replay fails",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "54900000";
    const orderId = deterministicUuid(group, 1);
    const transitionCommandId = deterministicUuid(group, 2);
    const confirmation = {
      actorId: "local-user",
      confirmedAt: "2026-09-17T17:01:00.000Z",
      confirmationText: "Submit hypothetical paper order",
    };
    const envelope = (commandId, correlationId, payload) => JSON.stringify({
      operation: "PaperOrderTransition",
      requestId: deterministicUuid(group, Number(commandId.slice(-3)) + 100),
      correlationId,
      actorId: "local-user",
      prototypeCandidate: "v1.0.0-prototype.1",
      contractVersion: "1.0.0-candidate.2",
      requestedAt: confirmation.confirmedAt,
      commandId,
      payload,
    });

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      try {
        const dependencies = {
          replayStore: createPostgresApplicationReplayStore(client),
          completedAt: () => "2026-09-17T17:02:00.000Z",
          checkReadiness: () => undefined,
          ownerDispatch: (definition, payload, context) =>
            dispatchPostgresPaperOrder(client, definition, payload, context),
        };
        const draft = JSON.stringify({
          operation: "PaperOrderDraftCreate",
          requestId: deterministicUuid(group, 110),
          correlationId: deterministicUuid(group, 10),
          actorId: "local-user",
          prototypeCandidate: "v1.0.0-prototype.1",
          contractVersion: "1.0.0-candidate.2",
          requestedAt: "2026-09-17T17:00:00.000Z",
          commandId: deterministicUuid(group, 10),
          payload: {
            orderId,
            instrumentId: "REPLAY-ETF",
            researchEvidenceId: deterministicUuid(group, 3),
            side: "Buy",
            quantity: "2.0000000000",
            unitPrice: "10.0000000000",
            tradeDate: "2026-09-17",
          },
        });
        const payload = {
          orderId,
          transitionCommandId,
          expectedVersion: "1",
          transition: "OT-02",
          transitionPayload: { confirmation },
        };
        assert.equal((await executeApplicationRequestAsync(draft, dependencies)).outcome, "Succeeded");
        const original = await executeApplicationRequestAsync(
          envelope(deterministicUuid(group, 11), deterministicUuid(group, 21), payload),
          dependencies,
        );
        const equivalent = await executeApplicationRequestAsync(
          envelope(deterministicUuid(group, 12), deterministicUuid(group, 22), payload),
          dependencies,
        );
        assert.equal(original.outcome, "Succeeded", JSON.stringify(original));
        assert.equal(equivalent.outcome, "Succeeded", JSON.stringify(equivalent));
        assert.deepEqual(equivalent.data, original.data);

        const conflict = await executeApplicationRequestAsync(
          envelope(deterministicUuid(group, 13), deterministicUuid(group, 23), {
            ...payload,
            transitionPayload: {
              confirmation: {
                ...confirmation,
                confirmationText: "Changed confirmation",
              },
            },
          }),
          dependencies,
        );
        assert.equal(conflict.outcome, "Failed", JSON.stringify(conflict));
        assert.equal(conflict.error.code, "ORDER_IDEMPOTENCY_CONFLICT");
        assert.equal(JSON.stringify(conflict).includes("Changed confirmation"), false);
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }

      const evidence = await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.paper_orders) AS orders,
                (SELECT count(*)::integer FROM etf.order_transitions WHERE transition = 'OT-02') AS transitions,
                (SELECT count(*)::integer FROM etf.order_command_replays WHERE order_id = $1::uuid AND transition_command_id = $2::uuid) AS order_replays,
                (SELECT count(*)::integer FROM etf.order_audit WHERE order_id = $1::uuid AND transition_command_id = $2::uuid) AS order_audits,
                (SELECT count(*)::integer FROM etf.application_replays) AS application_replays,
                (SELECT count(*)::integer FROM etf.fills) AS fills,
                (SELECT count(*)::integer FROM etf.ledger_transactions) AS ledger_transactions`,
        [orderId, transitionCommandId],
      );
      assert.deepEqual(evidence.rows, [{
        orders: 1,
        transitions: 1,
        order_replays: 1,
        order_audits: 1,
        application_replays: 4,
        fills: 0,
        ledger_transactions: 0,
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-ORD-012 stale order versions roll back every mutation surface",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "55100000";
    const orderId = deterministicUuid(group, 1);
    const envelope = (operation, commandId, requestedAt, payload) => JSON.stringify({
      operation,
      requestId: deterministicUuid(group, Number(commandId.slice(-3)) + 100),
      correlationId: deterministicUuid(group, 2),
      actorId: "local-user",
      prototypeCandidate: "v1.0.0-prototype.1",
      contractVersion: "1.0.0-candidate.2",
      requestedAt,
      commandId,
      payload,
    });

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      let stale;
      try {
        const dependencies = {
          replayStore: createPostgresApplicationReplayStore(client),
          completedAt: () => "2026-09-17T18:02:00.000Z",
          checkReadiness: () => undefined,
          ownerDispatch: (definition, payload, context) =>
            dispatchPostgresPaperOrder(client, definition, payload, context),
        };
        const draft = await executeApplicationRequestAsync(
          envelope("PaperOrderDraftCreate", deterministicUuid(group, 10), "2026-09-17T18:00:00.000Z", {
            orderId,
            instrumentId: "STALE-ETF",
            researchEvidenceId: deterministicUuid(group, 3),
            side: "Buy",
            quantity: "2.0000000000",
            unitPrice: "10.0000000000",
            tradeDate: "2026-09-17",
          }),
          dependencies,
        );
        assert.equal(draft.outcome, "Succeeded", JSON.stringify(draft));
        stale = await executeApplicationRequestAsync(
          envelope("PaperOrderTransition", deterministicUuid(group, 11), "2026-09-17T18:01:00.000Z", {
            orderId,
            transitionCommandId: deterministicUuid(group, 12),
            expectedVersion: "0",
            transition: "OT-02",
            transitionPayload: {
              confirmation: {
                actorId: "local-user",
                confirmedAt: "2026-09-17T18:01:00.000Z",
                confirmationText: "Submit hypothetical paper order",
              },
            },
          }),
          dependencies,
        );
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }

      assert.equal(stale.outcome, "Failed", JSON.stringify(stale));
      assert.equal(stale.error.code, "ORDER_VERSION_CONFLICT");
      assert.equal(JSON.stringify(stale).includes("confirmationText"), false);

      const evidence = await client.query(
        `SELECT order_record.state,
                order_record.aggregate_version::integer AS aggregate_version,
                order_record.filled_quantity::text AS filled_quantity,
                order_record.open_quantity::text AS open_quantity,
                (SELECT count(*)::integer FROM etf.order_transitions) AS transitions,
                (SELECT count(*)::integer FROM etf.order_command_replays) AS order_replays,
                (SELECT count(*)::integer FROM etf.order_audit) AS order_audits,
                (SELECT count(*)::integer FROM etf.application_replays) AS application_replays,
                (SELECT count(*)::integer FROM etf.fills) AS fills,
                (SELECT count(*)::integer FROM etf.portfolios) AS portfolios,
                (SELECT count(*)::integer FROM etf.ledger_transactions) AS ledger_transactions,
                (SELECT count(*)::integer FROM etf.ledger_effects) AS ledger_effects,
                (SELECT count(*)::integer FROM etf.ledger_lots) AS ledger_lots,
                (SELECT count(*)::integer FROM etf.ledger_allocations) AS ledger_allocations
           FROM etf.paper_orders AS order_record
          WHERE order_record.order_id = $1::uuid`,
        [orderId],
      );
      assert.deepEqual(evidence.rows, [{
        state: "Draft",
        aggregate_version: 1,
        filled_quantity: "0.0000000000",
        open_quantity: "2.0000000000",
        transitions: 1,
        order_replays: 1,
        order_audits: 1,
        application_replays: 2,
        fills: 0,
        portfolios: 0,
        ledger_transactions: 0,
        ledger_effects: 0,
        ledger_lots: 0,
        ledger_allocations: 0,
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-ORD-016 paper-order failures preserve the complete transition boundary",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "55900000";
    const orderId = deterministicUuid(group, 1);
    const portfolioId = deterministicUuid(group, 2);
    const commands = [
      {
        correlationId: deterministicUuid(group, 101),
        occurredAt: "2026-09-22T12:00:00.000Z",
        operation: "DraftCreate",
        orderId,
        transitionCommandId: deterministicUuid(group, 201),
        expectedVersion: 0,
        transition: "OT-01",
        transitionPayload: {
          instrumentId: "CONFORMANCE-F-ETF",
          researchEvidenceId: deterministicUuid(group, 3),
          side: "Buy",
          quantity: "2.0000000000",
          unitPrice: "10.0000000000",
          tradeDate: "2026-09-22",
        },
      },
      {
        correlationId: deterministicUuid(group, 102),
        occurredAt: "2026-09-22T12:01:00.000Z",
        operation: "Transition",
        orderId,
        transitionCommandId: deterministicUuid(group, 202),
        expectedVersion: 1,
        transition: "OT-02",
        transitionPayload: {
          confirmation: {
            actorId: "local-user",
            confirmedAt: "2026-09-22T12:01:00.000Z",
            confirmationText: "Confirm hypothetical paper order",
          },
        },
      },
      {
        correlationId: deterministicUuid(group, 103),
        occurredAt: "2026-09-22T12:02:00.000Z",
        operation: "Transition",
        orderId,
        transitionCommandId: deterministicUuid(group, 203),
        expectedVersion: 2,
        transition: "OT-03",
        transitionPayload: {
          portfolioId,
          validationSnapshotId: deterministicUuid(group, 4),
          expectedPortfolioVersion: 1,
        },
      },
    ];
    const snapshot = async () => (await client.query(
      `SELECT row_to_json(order_record)::jsonb AS order_record,
              (SELECT jsonb_agg(transition_record ORDER BY resulting_version)
                 FROM etf.order_transitions AS transition_record
                WHERE transition_record.order_id = $1::uuid) AS transitions,
              (SELECT jsonb_agg(replay_record ORDER BY transition_command_id)
                 FROM etf.order_command_replays AS replay_record
                WHERE replay_record.order_id = $1::uuid) AS order_replays,
                (SELECT jsonb_agg(audit_record ORDER BY recorded_at, audit_id)
                 FROM etf.order_audit AS audit_record
                WHERE audit_record.order_id = $1::uuid) AS order_audits,
                (SELECT jsonb_agg(replay_record ORDER BY operation, command_id)
                  FROM etf.application_replays AS replay_record) AS application_replays
         FROM etf.paper_orders AS order_record
        WHERE order_record.order_id = $1::uuid`,
      [orderId],
    )).rows;

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await client.query("GRANT EXECUTE ON FUNCTION etf.paper_order_transition(jsonb) TO app_runtime");
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 301),
        correlationId: deterministicUuid(group, 401),
        version: 0,
        effectiveAt: "2026-09-22T11:59:00.000Z",
      }));
      for (const command of commands) await transitionPaperOrder(client, command);

      const baseline = await snapshot();
      assert.equal(baseline[0].order_record.state, "Accepted");
      assert.equal(baseline[0].order_record.aggregate_version, 3);
      const failures = [
        [{ ...commands[2], transitionCommandId: deterministicUuid(group, 204), expectedVersion: 2 }, "40001", "ORDER_VERSION_CONFLICT"],
        [{ ...commands[2], transitionPayload: { ...commands[2].transitionPayload, validationSnapshotId: deterministicUuid(group, 5) } }, "P0001", "ORDER_IDEMPOTENCY_CONFLICT"],
        [{
          correlationId: deterministicUuid(group, 104),
          occurredAt: "2026-09-22T12:03:00.000Z",
          operation: "Transition",
          orderId,
          transitionCommandId: deterministicUuid(group, 205),
          expectedVersion: 3,
          transition: "OT-05",
          transitionPayload: {
            portfolioId,
            transactionId: deterministicUuid(group, 302),
            fillId: deterministicUuid(group, 303),
            expectedPortfolioVersion: 1,
            quantity: "2.0000000000",
            unitPrice: "10.0000000000",
            fee: "0.00000000",
          },
        }, "P0001", "ORDER_GUARD_FAILED"],
      ];
      for (const [command, code, message] of failures) {
        await assert.rejects(
          () => transitionPaperOrder(client, command),
          (error) => error.code === code && error.message === message,
          message,
        );
        assert.deepEqual(await snapshot(), baseline, message);
      }
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0003 executes a canonical paper fill through the complete nested owner path",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "55000000";
    const portfolioId = deterministicUuid(group, 1);
    const orderId = deterministicUuid(group, 2);
    const researchEvidenceId = deterministicUuid(group, 3);
    const validationSnapshotId = deterministicUuid(group, 4);
    const fillId = deterministicUuid(group, 5);
    const fillTransactionId = deterministicUuid(group, 6);
    const instrumentId = "NESTED-OWNER-ETF";
    const confirmation = {
      actorId: "local-user",
      confirmedAt: "2026-09-14T05:02:00.000Z",
      confirmationText: "Confirm hypothetical paper order",
    };
    const commands = [
      {
        correlationId: deterministicUuid(group, 101),
        occurredAt: "2026-09-14T05:01:00.000Z",
        operation: "DraftCreate",
        orderId,
        transitionCommandId: deterministicUuid(group, 201),
        expectedVersion: 0,
        transition: "OT-01",
        transitionPayload: {
          instrumentId,
          researchEvidenceId,
          side: "Buy",
          quantity: "2.0000000000",
          unitPrice: "10.0000000000",
          tradeDate: "2026-09-14",
        },
      },
      {
        correlationId: deterministicUuid(group, 102),
        occurredAt: confirmation.confirmedAt,
        operation: "Transition",
        orderId,
        transitionCommandId: deterministicUuid(group, 202),
        expectedVersion: 1,
        transition: "OT-02",
        transitionPayload: { confirmation },
      },
      {
        correlationId: deterministicUuid(group, 103),
        occurredAt: "2026-09-14T05:03:00.000Z",
        operation: "Transition",
        orderId,
        transitionCommandId: deterministicUuid(group, 203),
        expectedVersion: 2,
        transition: "OT-03",
        transitionPayload: {
          portfolioId,
          validationSnapshotId,
          expectedPortfolioVersion: 1,
        },
      },
      {
        correlationId: deterministicUuid(group, 104),
        occurredAt: "2026-09-14T05:04:00.000Z",
        operation: "Transition",
        orderId,
        transitionCommandId: deterministicUuid(group, 204),
        expectedVersion: 3,
        transition: "OT-06",
        transitionPayload: {
          portfolioId,
          transactionId: fillTransactionId,
          fillId,
          expectedPortfolioVersion: 1,
          quantity: "2.0000000000",
          unitPrice: "10.0000000000",
          fee: "0.00000000",
        },
      },
    ];

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await client.query(
        "GRANT EXECUTE ON FUNCTION etf.paper_order_transition(jsonb) TO app_runtime",
      );
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 301),
        correlationId: deterministicUuid(group, 401),
        version: 0,
        effectiveAt: "2026-09-14T05:00:00.000Z",
      }));

      for (const command of commands) {
        try {
          await transitionPaperOrder(client, command);
        } catch (error) {
          error.message = `${command.transition}: ${error.message}`;
          throw error;
        }
      }

      const order = await client.query(
        `SELECT state,
                aggregate_version::integer AS aggregate_version,
                filled_quantity::text AS filled_quantity,
                open_quantity::text AS open_quantity,
                confirmation
           FROM etf.paper_orders
          WHERE order_id = $1::uuid`,
        [orderId],
      );
      assert.deepEqual(order.rows, [{
        state: "Filled",
        aggregate_version: 4,
        filled_quantity: "2.0000000000",
        open_quantity: "0.0000000000",
        confirmation,
      }]);

      const fill = await client.query(
        `SELECT fill_id::text,
                order_id::text,
                transition_command_id::text,
                transaction_id::text,
                quantity::text,
                unit_price::text,
                fee::text
           FROM etf.fills
          WHERE portfolio_id = $1::uuid
            AND fill_id = $2::uuid`,
        [portfolioId, fillId],
      );
      assert.deepEqual(fill.rows, [{
        fill_id: fillId,
        order_id: orderId,
        transition_command_id: commands[3].transitionCommandId,
        transaction_id: fillTransactionId,
        quantity: "2.0000000000",
        unit_price: "10.0000000000",
        fee: "0.00000000",
      }]);

      const ledger = await client.query(
        `SELECT transaction_record.type,
                transaction_record.order_id::text,
                transaction_record.fill_id::text,
                portfolio.portfolio_version::integer AS portfolio_version,
                lot.original_quantity::text AS lot_quantity,
                lot.original_basis::text AS lot_basis
           FROM etf.ledger_transactions AS transaction_record
           JOIN etf.portfolios AS portfolio
             ON portfolio.portfolio_id = transaction_record.portfolio_id
           JOIN etf.ledger_lots AS lot
             ON lot.portfolio_id = transaction_record.portfolio_id
            AND lot.lot_id = transaction_record.fill_id
          WHERE transaction_record.portfolio_id = $1::uuid
            AND transaction_record.transaction_id = $2::uuid`,
        [portfolioId, fillTransactionId],
      );
      assert.deepEqual(ledger.rows, [{
        type: "BuyFill",
        order_id: orderId,
        fill_id: fillId,
        portfolio_version: 2,
        lot_quantity: "2.0000000000",
        lot_basis: "20.00000000",
      }]);

      const auditEvidence = await client.query(
        `SELECT order_record.action AS order_action,
                order_record.outcome AS order_outcome,
                order_record.old_order_version::integer AS old_order_version,
                order_record.new_order_version::integer AS new_order_version,
                ledger_record.action AS ledger_action,
                ledger_record.outcome AS ledger_outcome,
                ledger_record.transaction_id::text AS transaction_id
           FROM etf.order_audit AS order_record
           JOIN etf.ledger_audit AS ledger_record
             ON ledger_record.transition_command_id = order_record.transition_command_id
          WHERE order_record.order_id = $1::uuid
            AND order_record.transition_command_id = $2::uuid
            AND length(order_record.evidence_hash) = 64
            AND length(ledger_record.audit_evidence_hash) = 64`,
        [orderId, commands[3].transitionCommandId],
      );
      assert.deepEqual(auditEvidence.rows, [{
        order_action: "PaperOrderTransition",
        order_outcome: "Committed",
        old_order_version: 3,
        new_order_version: 4,
        ledger_action: "LedgerAppend",
        ledger_outcome: "Committed",
        transaction_id: fillTransactionId,
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-001 rebuilds buy partial sell and valuation exactly",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "50100000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "REBUILD-ETF";
    const buy = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "10.0000000000",
      unitPrice: "100.0000000000",
      effectiveAt: "2026-09-17T19:01:00.000Z",
    });
    const sell = fillFixture({
      group,
      index: 2,
      side: "Sell",
      quantity: "4.0000000000",
      unitPrice: "120.0000000000",
      effectiveAt: "2026-09-17T19:02:00.000Z",
    });

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await seedFillOrder(client, { ...buy, instrumentId });
      await seedFillOrder(client, { ...sell, instrumentId });
      await client.query("GRANT EXECUTE ON FUNCTION etf.ledger_append(jsonb) TO app_runtime");
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-17T19:00:00.000Z",
        amount: "10000.00000000",
      }));
      await appendLedger(client, fillCommand({
        ...buy,
        portfolioId,
        instrumentId,
        version: 1,
        fee: "1.00000000",
      }));
      await appendLedger(client, fillCommand({
        ...sell,
        portfolioId,
        instrumentId,
        version: 2,
        fee: "1.00000000",
      }));
      await client.query("REVOKE EXECUTE ON FUNCTION etf.ledger_append(jsonb) FROM app_runtime");

      const rebuilt = await client.query(
        `WITH lot_rebuild AS (
           SELECT lot.lot_id,
                  sum(effect.quantity)::numeric(28,10) AS quantity,
                (sum(effect.money) FILTER (WHERE right(effect.effect_type, 5) = 'Basis'))::numeric(28,8) AS basis
             FROM etf.ledger_lots AS lot
             JOIN etf.ledger_effects AS effect
               ON effect.portfolio_id = lot.portfolio_id
              AND effect.lot_id = lot.lot_id
            WHERE lot.portfolio_id = $1::uuid
            GROUP BY lot.lot_id
         ), totals AS (
           SELECT sum(money) FILTER (WHERE right(effect_type, 4) = 'Cash')::numeric(28,8) AS cash,
                  sum(quantity) FILTER (WHERE right(effect_type, 8) = 'Position')::numeric(28,10) AS position_quantity,
                  sum(money) FILTER (WHERE right(effect_type, 5) = 'Basis')::numeric(28,8) AS position_basis,
                  sum(money) FILTER (WHERE right(effect_type, 11) = 'RealizedPnL')::numeric(28,8) AS realized_pnl
             FROM etf.ledger_effects
            WHERE portfolio_id = $1::uuid
         )
         SELECT totals.cash::text,
                totals.position_quantity::text,
                totals.position_basis::text,
                totals.realized_pnl::text,
                lot_rebuild.lot_id::text,
                lot_rebuild.quantity::text AS lot_quantity,
                lot_rebuild.basis::text AS lot_basis,
                round(totals.position_quantity * 110.0000000000, 8)::text AS valuation,
                round(totals.cash + totals.position_quantity * 110.0000000000, 8)::text AS total_equity
           FROM totals CROSS JOIN lot_rebuild`,
        [portfolioId],
      );
      assert.deepEqual(rebuilt.rows, [{
        cash: "9478.00000000",
        position_quantity: "6.0000000000",
        position_basis: "600.60000000",
        realized_pnl: "78.60000000",
        lot_id: buy.fillId,
        lot_quantity: "6.0000000000",
        lot_basis: "600.60000000",
        valuation: "660.00000000",
        total_equity: "10138.00000000",
      }]);

      const allocation = await client.query(
        `SELECT sell_transaction_id::text, effect_ordinal::integer, lot_id::text,
                consumed_quantity::text, allocated_basis::text
           FROM etf.ledger_allocations
          WHERE portfolio_id = $1::uuid`,
        [portfolioId],
      );
      assert.deepEqual(allocation.rows, [{
        sell_transaction_id: sell.transactionId,
        effect_ordinal: 1,
        lot_id: buy.fillId,
        consumed_quantity: "4.0000000000",
        allocated_basis: "400.40000000",
      }]);

      const commitment = await client.query(
        `SELECT commitment_hash
           FROM etf.ledger_commitments
          WHERE portfolio_id = $1::uuid
          ORDER BY ledger_sequence DESC
          LIMIT 1`,
        [portfolioId],
      );
      const valuationSnapshotId = deterministicUuid(group, 900);
      const projectionPayload = {
        allocations: [{
          sellTransactionId: sell.transactionId,
          effectOrdinal: 1,
          lotId: buy.fillId,
          consumedQuantity: "4.0000000000",
          allocatedBasis: "400.40000000",
        }],
        asOf: "2026-09-17T19:03:00.000Z",
        baselineVersion: "v1.0.0",
        cash: rebuilt.rows[0].cash,
        keyIdentifier: "primary",
        lots: [{
          lotId: buy.fillId,
          instrumentId,
          quantity: rebuilt.rows[0].lot_quantity,
          basis: rebuilt.rows[0].lot_basis,
        }],
        portfolioId,
        portfolioVersion: 3,
        precisionPolicyVersion: "DEC-014",
        positions: [{
          instrumentId,
          quantity: rebuilt.rows[0].position_quantity,
          basis: rebuilt.rows[0].position_basis,
          unitValue: "110.0000000000",
          valuation: rebuilt.rows[0].valuation,
          unrealizedPnL: "59.40000000",
        }],
        realizedPnL: rebuilt.rows[0].realized_pnl,
        reconciliationState: "Reconciled",
        sourceCommitmentHash: commitment.rows[0].commitment_hash,
        totalEquity: rebuilt.rows[0].total_equity,
        valuationSnapshotId,
      };
      await client.query("GRANT EXECUTE ON FUNCTION etf.projection_publish(jsonb) TO projection_runtime");
      await client.query("SET SESSION AUTHORIZATION projection_runtime");
      try {
        const published = await client.query(
          "SELECT etf.projection_publish($1::jsonb) AS result",
          [projectionPayload],
        );
        assert.equal(published.rows[0].result.published, true);
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }

      const projection = await client.query(
        `SELECT portfolio_version::integer, cash::text, lots, positions,
                realized_pnl::text, total_equity::text, reconciliation_state,
                source_commitment_hash
           FROM etf.portfolio_projections
          WHERE portfolio_id = $1::uuid AND valuation_snapshot_id = $2::uuid`,
        [portfolioId, valuationSnapshotId],
      );
      assert.deepEqual(projection.rows, [{
        portfolio_version: 3,
        cash: "9478.00000000",
        lots: projectionPayload.lots,
        positions: projectionPayload.positions,
        realized_pnl: "78.60000000",
        total_equity: "10138.00000000",
        reconciliation_state: "Reconciled",
        source_commitment_hash: commitment.rows[0].commitment_hash,
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-002 reverses an unconsumed buy immutably",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "50200000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "REVERSE-BUY-ETF";
    const buy = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "2.0000000000",
      unitPrice: "25.0000000000",
      effectiveAt: "2026-09-17T20:01:00.000Z",
    });
    const reversalId = deterministicUuid(group, 700);

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await seedFillOrder(client, { ...buy, instrumentId });
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-17T20:00:00.000Z",
      }));
      await appendLedger(client, fillCommand({
        ...buy,
        portfolioId,
        instrumentId,
        version: 1,
        fee: "1.00000000",
      }));

      const beforeReversal = await client.query(
        `SELECT sum(money) FILTER (WHERE right(effect_type, 4) = 'Cash')::numeric(28,8)::text AS cash,
                sum(quantity) FILTER (WHERE right(effect_type, 8) = 'Position')::numeric(28,10)::text AS quantity,
                sum(money) FILTER (WHERE right(effect_type, 5) = 'Basis')::numeric(28,8)::text AS basis
           FROM etf.ledger_effects
          WHERE portfolio_id = $1::uuid`,
        [portfolioId],
      );
      assert.deepEqual(beforeReversal.rows, [{
        cash: "49.00000000",
        quantity: "2.0000000000",
        basis: "51.00000000",
      }]);

      await appendLedger(client, reversal({
        portfolioId,
        transactionId: reversalId,
        correlationId: deterministicUuid(group, 800),
        version: 2,
        effectiveAt: "2026-09-17T20:02:00.000Z",
        reversesTransactionId: buy.transactionId,
      }));

      const rebuilt = await client.query(
        `SELECT sum(money) FILTER (WHERE right(effect_type, 4) = 'Cash')::numeric(28,8)::text AS cash,
                sum(quantity) FILTER (WHERE right(effect_type, 8) = 'Position')::numeric(28,10)::text AS quantity,
                sum(money) FILTER (WHERE right(effect_type, 5) = 'Basis')::numeric(28,8)::text AS basis,
                COALESCE(sum(money) FILTER (WHERE right(effect_type, 11) = 'RealizedPnL'), 0)::numeric(28,8)::text AS realized_pnl
           FROM etf.ledger_effects
          WHERE portfolio_id = $1::uuid`,
        [portfolioId],
      );
      assert.deepEqual(rebuilt.rows, [{
        cash: "100.00000000",
        quantity: "0.0000000000",
        basis: "0.00000000",
        realized_pnl: "0.00000000",
      }]);

      const lineage = await client.query(
        `SELECT transaction_record.transaction_id::text,
                transaction_record.type,
                transaction_record.reverses_transaction_id::text,
                link.target_transaction_id::text
           FROM etf.ledger_transactions AS transaction_record
           LEFT JOIN etf.ledger_reversal_links AS link
             ON link.portfolio_id = transaction_record.portfolio_id
            AND link.reversal_transaction_id = transaction_record.transaction_id
          WHERE transaction_record.portfolio_id = $1::uuid
            AND transaction_record.transaction_id = ANY($2::uuid[])
          ORDER BY transaction_record.ledger_sequence`,
        [portfolioId, [buy.transactionId, reversalId]],
      );
      assert.deepEqual(lineage.rows, [
        {
          transaction_id: buy.transactionId,
          type: "BuyFill",
          reverses_transaction_id: null,
          target_transaction_id: null,
        },
        {
          transaction_id: reversalId,
          type: "Reversal",
          reverses_transaction_id: buy.transactionId,
          target_transaction_id: buy.transactionId,
        },
      ]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-003 consumes a partial lot FIFO",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "50300000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "PARTIAL-FIFO-ETF";
    const buy = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "3.0000000000",
      unitPrice: "10.0000000000",
      effectiveAt: "2026-09-17T21:01:00.000Z",
    });
    const sell = fillFixture({
      group,
      index: 2,
      side: "Sell",
      quantity: "1.0000000000",
      unitPrice: "15.0000000000",
      effectiveAt: "2026-09-17T21:02:00.000Z",
    });

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await seedFillOrder(client, { ...buy, instrumentId });
      await seedFillOrder(client, { ...sell, instrumentId });
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-17T21:00:00.000Z",
      }));
      await appendLedger(client, fillCommand({ ...buy, portfolioId, instrumentId, version: 1 }));
      await appendLedger(client, fillCommand({ ...sell, portfolioId, instrumentId, version: 2 }));

      const rebuilt = await client.query(
        `SELECT sum(effect.money) FILTER (WHERE right(effect.effect_type, 4) = 'Cash')::numeric(28,8)::text AS cash,
                sum(effect.quantity) FILTER (WHERE right(effect.effect_type, 8) = 'Position')::numeric(28,10)::text AS quantity,
                sum(effect.money) FILTER (WHERE right(effect.effect_type, 5) = 'Basis')::numeric(28,8)::text AS basis,
                sum(effect.money) FILTER (WHERE right(effect.effect_type, 11) = 'RealizedPnL')::numeric(28,8)::text AS realized_pnl,
                count(DISTINCT lot.lot_id)::integer AS consulted_lots
           FROM etf.ledger_effects AS effect
           LEFT JOIN etf.ledger_lots AS lot
             ON lot.portfolio_id = effect.portfolio_id
            AND lot.lot_id = effect.lot_id
          WHERE effect.portfolio_id = $1::uuid`,
        [portfolioId],
      );
      assert.deepEqual(rebuilt.rows, [{
        cash: "85.00000000",
        quantity: "2.0000000000",
        basis: "20.00000000",
        realized_pnl: "5.00000000",
        consulted_lots: 1,
      }]);

      const allocations = await client.query(
        `SELECT sell_transaction_id::text, effect_ordinal::integer, lot_id::text,
                consumed_quantity::text, allocated_basis::text
           FROM etf.ledger_allocations
          WHERE portfolio_id = $1::uuid`,
        [portfolioId],
      );
      assert.deepEqual(allocations.rows, [{
        sell_transaction_id: sell.transactionId,
        effect_ordinal: 1,
        lot_id: buy.fillId,
        consumed_quantity: "1.0000000000",
        allocated_basis: "10.00000000",
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-004 spans FIFO lots with exact realized PnL",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "50400000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "SPANNING-FIFO-ETF";
    const lotA = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "3.0000000000",
      unitPrice: "10.0000000000",
      effectiveAt: "2026-09-17T22:01:00.000Z",
    });
    const lotB = fillFixture({
      group,
      index: 2,
      side: "Buy",
      quantity: "2.0000000000",
      unitPrice: "12.0000000000",
      effectiveAt: "2026-09-17T22:02:00.000Z",
    });
    const sell = fillFixture({
      group,
      index: 3,
      side: "Sell",
      quantity: "4.0000000000",
      unitPrice: "15.0000000000",
      effectiveAt: "2026-09-17T22:03:00.000Z",
    });

    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      for (const fill of [lotA, lotB, sell]) {
        await seedFillOrder(client, { ...fill, instrumentId });
      }
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-17T22:00:00.000Z",
        amount: "20000.00000000",
      }));
      await appendLedger(client, fillCommand({ ...lotA, portfolioId, instrumentId, version: 1 }));
      await appendLedger(client, fillCommand({ ...lotB, portfolioId, instrumentId, version: 2 }));
      await appendLedger(client, fillCommand({
        ...sell,
        portfolioId,
        instrumentId,
        version: 3,
        fee: "1.00000000",
      }));

      const allocations = await client.query(
        `SELECT effect_ordinal::integer, lot_id::text,
                consumed_quantity::text, allocated_basis::text
           FROM etf.ledger_allocations
          WHERE portfolio_id = $1::uuid
          ORDER BY effect_ordinal, lot_id`,
        [portfolioId],
      );
      assert.deepEqual(allocations.rows, [
        {
          effect_ordinal: 1,
          lot_id: lotA.fillId,
          consumed_quantity: "3.0000000000",
          allocated_basis: "30.00000000",
        },
        {
          effect_ordinal: 3,
          lot_id: lotB.fillId,
          consumed_quantity: "1.0000000000",
          allocated_basis: "12.00000000",
        },
      ]);

      const rebuilt = await client.query(
        `SELECT sum(money) FILTER (WHERE right(effect_type, 4) = 'Cash')::numeric(28,8)::text AS cash,
                sum(quantity) FILTER (WHERE right(effect_type, 8) = 'Position')::numeric(28,10)::text AS quantity,
                sum(money) FILTER (WHERE right(effect_type, 5) = 'Basis')::numeric(28,8)::text AS basis,
          sum(money) FILTER (WHERE right(effect_type, 11) = 'RealizedPnL')::numeric(28,8)::text AS realized_pnl,
          round(sum(quantity) FILTER (WHERE right(effect_type, 8) = 'Position') * 14.0000000000, 8)::text AS valuation,
          round(sum(money) FILTER (WHERE right(effect_type, 4) = 'Cash') + sum(quantity) FILTER (WHERE right(effect_type, 8) = 'Position') * 14.0000000000, 8)::text AS total_equity
           FROM etf.ledger_effects
          WHERE portfolio_id = $1::uuid`,
        [portfolioId],
      );
      assert.deepEqual(rebuilt.rows, [{
        cash: "20005.00000000",
        quantity: "1.0000000000",
        basis: "12.00000000",
        realized_pnl: "17.00000000",
        valuation: "14.00000000",
        total_equity: "20019.00000000",
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-006 produces identical TypeScript and PostgreSQL canonical strings",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      const vectors = [
        { source: "1.0000000000", numericClass: "Quantity", postgresType: "numeric(28,10)", expected: "1.0000000000" },
        { source: "100.00000000", numericClass: "Money", postgresType: "numeric(28,8)", expected: "100.00000000" },
        { source: "-0.00000000", numericClass: "Money", postgresType: "numeric(28,8)", expected: "0.00000000" },
        { source: "1.000000005", numericClass: "Money", postgresType: "numeric(28,8)", expected: "1.00000000" },
        { source: "1.000000015", numericClass: "Money", postgresType: "numeric(28,8)", expected: "1.00000002" },
        { source: "-1.000000005", numericClass: "Money", postgresType: "numeric(28,8)", expected: "-1.00000000" },
        { source: "-1.000000015", numericClass: "Money", postgresType: "numeric(28,8)", expected: "-1.00000002" },
        { source: "1.00000000005", numericClass: "Quantity", postgresType: "numeric(28,10)", expected: "1.0000000000" },
        { source: "0.0000000000005", numericClass: "Rate", postgresType: "numeric(28,12)", expected: "0.000000000000" },
      ];

      for (const vector of vectors) {
        const typescriptValue = quantizeAnalyticsIntermediate(vector.source, vector.numericClass);
        assert.equal(typescriptValue, vector.expected);
        const postgres = await client.query(
          `SELECT $1::${vector.postgresType}::text AS canonical_value`,
          [typescriptValue],
        );
        assert.equal(postgres.rows[0].canonical_value, typescriptValue);
      }
    } finally {
      await client.end();
    }
  },
);

test(
  "CT-LED-007 rejects invalid scale grammar and bounds before persistence",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);

      const vectors = [
        { amount: "1.000000001", error: /LEDGER_EXCESS_SCALE/ },
        { amount: "1e2", error: /LEDGER_INVALID_DECIMAL/ },
        { amount: "+1.00000000", error: /LEDGER_INVALID_DECIMAL/ },
        { amount: " 1.00000000", error: /LEDGER_INVALID_DECIMAL/ },
        { amount: "NaN", error: /LEDGER_INVALID_DECIMAL/ },
        { amount: "Infinity", error: /LEDGER_INVALID_DECIMAL/ },
        { amount: "-Infinity", error: /LEDGER_INVALID_DECIMAL/ },
        { amount: 1.5, error: /LEDGER_INVALID_DECIMAL/ },
        { amount: "9000000000000000.00000001", error: /LEDGER_BOUND_EXCEEDED/ },
      ];

      for (const [index, vector] of vectors.entries()) {
        await assert.rejects(
          () => appendLedger(client, cashDeposit({
            portfolioId: deterministicUuid("55700000", index + 1),
            transactionId: deterministicUuid("55700000", index + 101),
            correlationId: deterministicUuid("55700000", index + 201),
            version: 0,
            effectiveAt: "2026-09-21T10:00:00.000Z",
            amount: vector.amount,
          })),
          vector.error,
        );
      }

      const fill = fillFixture({
        group: "55700000",
        index: 50,
        side: "Buy",
        quantity: "1.0000000000",
        unitPrice: "1.0000000000",
        effectiveAt: "2026-09-21T10:01:00.000Z",
      });
      const fillVectors = [
        { field: "quantity", value: "1.00000000001", error: /LEDGER_EXCESS_SCALE/ },
        { field: "unitPrice", value: "1.00000000001", error: /LEDGER_EXCESS_SCALE/ },
        { field: "fee", value: "1.000000001", error: /LEDGER_EXCESS_SCALE/ },
        { field: "quantity", value: "1e0", error: /LEDGER_INVALID_DECIMAL/ },
        { field: "unitPrice", value: 1.5, error: /LEDGER_INVALID_DECIMAL/ },
        { field: "fee", value: "+1.00000000", error: /LEDGER_INVALID_DECIMAL/ },
        { field: "quantity", value: "NaN", error: /LEDGER_INVALID_DECIMAL/ },
        { field: "unitPrice", value: "Infinity", error: /LEDGER_INVALID_DECIMAL/ },
        { field: "fee", value: "-Infinity", error: /LEDGER_INVALID_DECIMAL/ },
        { field: "quantity", value: "1000000000.0000000001", error: /LEDGER_BOUND_EXCEEDED/ },
        { field: "unitPrice", value: "1000000.0000000001", error: /LEDGER_BOUND_EXCEEDED/ },
        { field: "fee", value: "1000000000.00000001", error: /LEDGER_BOUND_EXCEEDED/ },
      ];
      for (const [index, vector] of fillVectors.entries()) {
        const command = fillCommand({
          ...fill,
          portfolioId: deterministicUuid("55700000", index + 301),
          instrumentId: "ETF-LED-007",
          version: 0,
          fee: "0.00000000",
        });
        command[vector.field] = vector.value;
        await assert.rejects(() => appendLedger(client, command), vector.error);
      }

      const persisted = await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.portfolios) AS portfolios,
                (SELECT count(*)::integer FROM etf.ledger_transactions) AS transactions,
                (SELECT count(*)::integer FROM etf.ledger_effects) AS effects,
                (SELECT count(*)::integer FROM etf.ledger_command_replays) AS replays`,
      );
      assert.deepEqual(persisted.rows, [{
        portfolios: 0,
        transactions: 0,
        effects: 0,
        replays: 0,
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-012 distinguishes stale fill versions from order mismatches without mutation",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "55800000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "STALE-ORDER-ETF";
    const buy = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "1.0000000000",
      unitPrice: "10.0000000000",
      effectiveAt: "2026-09-21T11:01:00.000Z",
    });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await seedFillOrder(client, { ...buy, instrumentId });
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-21T11:00:00.000Z",
      }));
      const before = await snapshotLedger(client, portfolioId);
      const staleOrder = fillCommand({
        ...buy,
        portfolioId,
        instrumentId,
        version: 1,
      });
      staleOrder.expectedOrderVersion = 0;

      await assert.rejects(
        () => appendLedger(client, staleOrder),
        (error) => error.code === "40001" && error.message === "ORDER_VERSION_CONFLICT",
      );
      assert.deepEqual(await snapshotLedger(client, portfolioId), before);

      await assert.rejects(
        () => appendLedger(client, { ...staleOrder, instrumentId: "WRONG-ORDER-ETF" }),
        (error) => error.code === "P0001" && error.message === "LEDGER_ORDER_MISMATCH",
      );
      assert.deepEqual(await snapshotLedger(client, portfolioId), before);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-013 records the complete immutable audit outcome lifecycle",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "55900000";
    const portfolioId = deterministicUuid(group, 1);
    const order = fillFixture({
      group,
      index: 40,
      side: "Buy",
      quantity: "1.0000000000",
      unitPrice: "10.0000000000",
      effectiveAt: "2026-09-21T12:01:00.000Z",
    });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await seedFillOrder(client, { ...order, instrumentId: "AUDIT-ORDER-ETF" });
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-21T12:00:00.000Z",
      }));
      await client.query("GRANT USAGE ON SCHEMA etf TO audit_runtime");
      assert.equal(
        (await client.query(
          "SELECT pg_catalog.has_function_privilege('audit_runtime', 'etf.audit_append(jsonb)', 'EXECUTE') AS allowed",
        )).rows[0].allowed,
        true,
      );
      const before = await client.query(
        "SELECT (SELECT count(*)::integer FROM etf.ledger_audit) AS audits, (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments",
      );
      const payload = {
        action: "LedgerAppend",
        attemptIntentId: deterministicUuid(group, 10),
        correlationId: deterministicUuid(group, 11),
        domain: "Ledger",
        keyIdentifier: "primary",
        outcome: "Rejected",
        subject: {
          auditId: deterministicUuid(group, 12),
          portfolioId,
          errorCode: "LEDGER_VERSION_CONFLICT",
          oldPortfolioVersion: 1,
          replayClassification: "New",
        },
      };

      await assert.rejects(
        () => appendAudit(client, payload),
        (error) => error.code === "22023" && error.message === "AUDIT_REQUEST_INVALID",
      );
      assert.deepEqual(
        (await client.query(
          "SELECT (SELECT count(*)::integer FROM etf.ledger_audit) AS audits, (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments",
        )).rows,
        before.rows,
      );

      await assert.rejects(
        () => appendAudit(client, {
          ...payload,
          attemptIntentId: deterministicUuid(group, 15),
          outcome: "IntentRecorded",
          subject: {
            auditId: deterministicUuid(group, 16),
            portfolioId,
            oldPortfolioVersion: -1,
            replayClassification: "New",
          },
        }),
        (error) => error.code === "22023" && error.message === "AUDIT_REQUEST_INVALID",
      );
      assert.deepEqual(
        (await client.query(
          "SELECT (SELECT count(*)::integer FROM etf.ledger_audit) AS audits, (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments",
        )).rows,
        before.rows,
      );

      const intent = {
        ...payload,
        outcome: "IntentRecorded",
        subject: {
          auditId: deterministicUuid(group, 13),
          portfolioId,
          oldPortfolioVersion: 1,
          replayClassification: "New",
        },
      };
      await appendAudit(client, intent);
      await appendAudit(client, payload);
      const afterTerminal = await client.query(
        "SELECT (SELECT count(*)::integer FROM etf.ledger_audit) AS audits, (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments",
      );
      assert.deepEqual(afterTerminal.rows, [{ audits: 3, commitments: 3 }]);
      assert.deepEqual(
        (await client.query(
          `SELECT outcome, error_code, old_portfolio_version::integer, new_portfolio_version
             FROM etf.ledger_audit
            WHERE attempt_intent_id = $1::uuid
            ORDER BY CASE outcome WHEN 'IntentRecorded' THEN 1 ELSE 2 END`,
          [payload.attemptIntentId],
        )).rows,
        [
          {
            outcome: "IntentRecorded",
            error_code: null,
            old_portfolio_version: 1,
            new_portfolio_version: null,
          },
          {
            outcome: "Rejected",
            error_code: "LEDGER_VERSION_CONFLICT",
            old_portfolio_version: 1,
            new_portfolio_version: null,
          },
        ],
      );

      await assert.rejects(
        () => appendAudit(client, {
          ...payload,
          subject: { ...payload.subject, auditId: deterministicUuid(group, 14) },
        }),
        (error) => error.code === "22023" && error.message === "AUDIT_REQUEST_INVALID",
      );
      assert.deepEqual(
        (await client.query(
          "SELECT (SELECT count(*)::integer FROM etf.ledger_audit) AS audits, (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments",
        )).rows,
        afterTerminal.rows,
      );

      const recoveryIntent = {
        ...intent,
        attemptIntentId: deterministicUuid(group, 20),
        correlationId: deterministicUuid(group, 21),
        subject: { ...intent.subject, auditId: deterministicUuid(group, 22) },
      };
      const recoveryCompleted = {
        ...recoveryIntent,
        outcome: "RecoveryCompleted",
        subject: { ...recoveryIntent.subject, auditId: deterministicUuid(group, 23) },
      };
      await appendAudit(client, recoveryIntent);
      await assert.rejects(
        () => appendAudit(client, recoveryCompleted),
        (error) => error.code === "22023" && error.message === "AUDIT_REQUEST_INVALID",
      );
      await appendAudit(client, {
        ...recoveryIntent,
        outcome: "TimeoutRecovery",
        subject: {
          ...recoveryIntent.subject,
          auditId: deterministicUuid(group, 24),
          errorCode: "AUDIT_ATTEMPT_TIMEOUT",
        },
      });
      await appendAudit(client, recoveryCompleted);
      await assert.rejects(
        () => appendAudit(client, {
          ...recoveryCompleted,
          subject: { ...recoveryCompleted.subject, auditId: deterministicUuid(group, 25) },
        }),
        (error) => error.code === "22023" && error.message === "AUDIT_REQUEST_INVALID",
      );
      await assert.rejects(
        () => appendAudit(client, {
          ...recoveryCompleted,
          outcome: "Rejected",
          subject: {
            ...recoveryCompleted.subject,
            auditId: deterministicUuid(group, 26),
            errorCode: "LEDGER_VERSION_CONFLICT",
          },
        }),
        (error) => error.code === "22023" && error.message === "AUDIT_REQUEST_INVALID",
      );
      assert.deepEqual(
        (await client.query(
          "SELECT outcome FROM etf.ledger_audit WHERE attempt_intent_id = $1::uuid ORDER BY recorded_at, audit_id",
          [recoveryIntent.attemptIntentId],
        )).rows.map(({ outcome }) => outcome).sort(),
        ["IntentRecorded", "RecoveryCompleted", "TimeoutRecovery"].sort(),
      );

      const committedTransactionId = deterministicUuid(group, 30);
      const committedIntent = {
        ...intent,
        attemptIntentId: committedTransactionId,
        correlationId: deterministicUuid(group, 31),
        subject: { ...intent.subject, auditId: deterministicUuid(group, 32) },
      };
      await appendAudit(client, committedIntent);
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: committedTransactionId,
        correlationId: committedIntent.correlationId,
        version: 1,
        effectiveAt: "2026-09-21T12:02:00.000Z",
        amount: "1.00000000",
      }));
      assert.deepEqual(
        (await client.query(
          `SELECT outcome, error_code, old_portfolio_version::integer, new_portfolio_version::integer
             FROM etf.ledger_audit
            WHERE attempt_intent_id = $1::uuid
            ORDER BY CASE outcome WHEN 'IntentRecorded' THEN 1 ELSE 2 END`,
          [committedTransactionId],
        )).rows,
        [
          { outcome: "IntentRecorded", error_code: null, old_portfolio_version: 1, new_portfolio_version: null },
          { outcome: "Committed", error_code: null, old_portfolio_version: 1, new_portfolio_version: 2 },
        ],
      );

      const integrityIntent = {
        ...intent,
        attemptIntentId: deterministicUuid(group, 33),
        correlationId: deterministicUuid(group, 34),
        subject: {
          ...intent.subject,
          auditId: deterministicUuid(group, 35),
          oldPortfolioVersion: 2,
        },
      };
      await appendAudit(client, integrityIntent);
      await appendAudit(client, {
        ...integrityIntent,
        outcome: "IntegrityFailed",
        subject: {
          ...integrityIntent.subject,
          auditId: deterministicUuid(group, 36),
          errorCode: "LEDGER_INTEGRITY_FAILED",
        },
      });
      assert.deepEqual(
        (await client.query(
          "SELECT portfolio_version::integer FROM etf.portfolios WHERE portfolio_id = $1::uuid",
          [portfolioId],
        )).rows,
        [{ portfolio_version: 2 }],
      );

      const beforeOrder = await client.query(
        "SELECT (SELECT count(*)::integer FROM etf.order_audit) AS audits, (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments",
      );
      const orderRejected = {
        action: "PaperOrderTransition",
        attemptIntentId: deterministicUuid(group, 40),
        correlationId: deterministicUuid(group, 41),
        domain: "Order",
        keyIdentifier: "primary",
        outcome: "Rejected",
        subject: {
          auditId: deterministicUuid(group, 42),
          orderId: order.orderId,
          errorCode: "ORDER_VERSION_CONFLICT",
          oldOrderVersion: 1,
        },
      };
      await assert.rejects(
        () => appendAudit(client, orderRejected),
        (error) => error.code === "22023" && error.message === "AUDIT_REQUEST_INVALID",
      );
      assert.deepEqual(
        (await client.query(
          "SELECT (SELECT count(*)::integer FROM etf.order_audit) AS audits, (SELECT count(*)::integer FROM etf.audit_commitments) AS commitments",
        )).rows,
        beforeOrder.rows,
      );
      await appendAudit(client, {
        ...orderRejected,
        outcome: "IntentRecorded",
        subject: {
          auditId: deterministicUuid(group, 43),
          orderId: order.orderId,
          oldOrderVersion: 1,
        },
      });
      await appendAudit(client, orderRejected);
      await assert.rejects(
        () => appendAudit(client, {
          ...orderRejected,
          subject: { ...orderRejected.subject, auditId: deterministicUuid(group, 44) },
        }),
        (error) => error.code === "22023" && error.message === "AUDIT_REQUEST_INVALID",
      );
      assert.deepEqual(
        (await client.query(
          "SELECT outcome, error_code, old_order_version::integer, new_order_version FROM etf.order_audit WHERE attempt_intent_id = $1::uuid ORDER BY CASE outcome WHEN 'IntentRecorded' THEN 1 ELSE 2 END",
          [orderRejected.attemptIntentId],
        )).rows,
        [
          { outcome: "IntentRecorded", error_code: null, old_order_version: 1, new_order_version: null },
          { outcome: "Rejected", error_code: "ORDER_VERSION_CONFLICT", old_order_version: 1, new_order_version: null },
        ],
      );
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-014 commits or rolls back ledger and dual chains together",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "56000000";
    const portfolioId = deterministicUuid(group, 1);
    const successful = cashDeposit({
      portfolioId,
      transactionId: deterministicUuid(group, 1),
      correlationId: deterministicUuid(group, 2),
      version: 0,
      effectiveAt: "2026-09-21T13:00:00.000Z",
    });
    const snapshot = async () => (await client.query(
      `SELECT portfolio.portfolio_version::integer AS portfolio_version,
              (SELECT count(*)::integer FROM etf.ledger_transactions WHERE portfolio_id = $1::uuid) AS transactions,
              (SELECT count(*)::integer FROM etf.ledger_audit WHERE portfolio_id = $1::uuid) AS audits,
              (SELECT count(*)::integer FROM etf.ledger_commitments WHERE portfolio_id = $1::uuid) AS ledger_commitments,
              (SELECT count(*)::integer FROM etf.ledger_anchors WHERE portfolio_id = $1::uuid) AS ledger_anchors,
              (SELECT count(*)::integer FROM etf.audit_commitments) AS audit_commitments,
              (SELECT count(*)::integer FROM etf.audit_anchor_checkpoints) AS audit_checkpoints,
              (SELECT count(*)::integer FROM etf.portfolio_anchor_checkpoints WHERE portfolio_id = $1::uuid) AS portfolio_checkpoints
         FROM etf.portfolios AS portfolio
        WHERE portfolio.portfolio_id = $1::uuid`,
      [portfolioId],
    )).rows;
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await appendLedger(client, successful);
      assert.deepEqual(await snapshot(), [{
        portfolio_version: 1,
        transactions: 1,
        audits: 1,
        ledger_commitments: 1,
        ledger_anchors: 1,
        audit_commitments: 1,
        audit_checkpoints: 1,
        portfolio_checkpoints: 1,
      }]);
      const beforeFailure = await snapshot();

      await assert.rejects(
        () => appendLedger(client, {
          ...cashDeposit({
            portfolioId,
            transactionId: deterministicUuid(group, 3),
            correlationId: deterministicUuid(group, 4),
            version: 1,
            effectiveAt: "2026-09-21T13:01:00.000Z",
          }),
          keyIdentifier: "missing",
        }),
        (error) => error.code === "55000" && error.message === "LEDGER_INTEGRITY_FAILED",
      );
      assert.deepEqual(await snapshot(), beforeFailure);

      const attemptIntentId = deterministicUuid(group, 10);
      const correlationId = deterministicUuid(group, 11);
      const intent = {
        action: "LedgerAppend",
        attemptIntentId,
        correlationId,
        domain: "Ledger",
        keyIdentifier: "primary",
        outcome: "IntentRecorded",
        subject: {
          auditId: deterministicUuid(group, 12),
          portfolioId,
          oldPortfolioVersion: 1,
          replayClassification: "New",
        },
      };
      await appendAudit(client, intent);
      const beforeAuditFailure = await snapshot();
      const rejected = {
        ...intent,
        keyIdentifier: "missing",
        outcome: "Rejected",
        subject: {
          ...intent.subject,
          auditId: deterministicUuid(group, 13),
          errorCode: "LEDGER_VERSION_CONFLICT",
        },
      };
      await assert.rejects(
        () => appendAudit(client, rejected),
        (error) => error.code === "55000" && error.message === "LEDGER_INTEGRITY_FAILED",
      );
      assert.deepEqual(await snapshot(), beforeAuditFailure);
      await appendAudit(client, { ...rejected, keyIdentifier: "primary" });

      const auditChain = await client.query(
        `SELECT audit.outcome,
                commitment.audit_sequence::integer,
                commitment.previous_audit_commitment,
                commitment.audit_commitment,
                commitment.key_identifier
           FROM etf.ledger_audit AS audit
           JOIN etf.audit_commitments AS commitment
             ON commitment.audit_segment_hash = audit.audit_evidence_hash
          WHERE audit.attempt_intent_id = $1::uuid
          ORDER BY commitment.audit_sequence`,
        [attemptIntentId],
      );
      assert.equal(auditChain.rowCount, 2);
      assert.deepEqual(
        auditChain.rows.map(({ outcome, audit_sequence, key_identifier }) => ({
          outcome,
          audit_sequence,
          key_identifier,
        })),
        [
          { outcome: "IntentRecorded", audit_sequence: 2, key_identifier: "primary" },
          { outcome: "Rejected", audit_sequence: 3, key_identifier: "primary" },
        ],
      );
      assert.equal(
        auditChain.rows[1].previous_audit_commitment,
        auditChain.rows[0].audit_commitment,
      );
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-016 publishes a verified projection and audit atomically",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "56100000";
    const portfolioId = deterministicUuid(group, 1);
    const valuationSnapshotId = deterministicUuid(group, 2);
    const publish = async (payload) => {
      await client.query("SET SESSION AUTHORIZATION projection_runtime");
      try {
        return await client.query(
          "SELECT etf.projection_publish($1::jsonb) AS result",
          [payload],
        );
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }
    };
    const snapshot = async () => (await client.query(
      `SELECT
         (SELECT jsonb_agg(to_jsonb(projection) ORDER BY projection.as_of, projection.valuation_snapshot_id)
            FROM etf.portfolio_projections AS projection
           WHERE projection.portfolio_id = $1::uuid) AS projections,
         (SELECT jsonb_agg(to_jsonb(audit) ORDER BY audit.recorded_at, audit.audit_id)
            FROM etf.ledger_audit AS audit
           WHERE audit.portfolio_id = $1::uuid) AS audits,
         (SELECT jsonb_agg(to_jsonb(commitment) ORDER BY commitment.audit_sequence)
            FROM etf.audit_commitments AS commitment) AS commitments,
         (SELECT jsonb_agg(to_jsonb(checkpoint) ORDER BY checkpoint.audit_sequence)
            FROM etf.audit_anchor_checkpoints AS checkpoint) AS checkpoints`,
      [portfolioId],
    )).rows;
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 3),
        correlationId: deterministicUuid(group, 4),
        version: 0,
        effectiveAt: "2026-09-21T14:00:00.000Z",
        amount: "100.00000000",
      }));
      const commitment = (await client.query(
        `SELECT commitment_hash
           FROM etf.ledger_commitments
          WHERE portfolio_id = $1::uuid AND ledger_sequence = 1`,
        [portfolioId],
      )).rows[0].commitment_hash;
      const projection = {
        allocations: [],
        asOf: "2026-09-21T14:01:00.000Z",
        baselineVersion: "v1.0.0",
        cash: "100.00000000",
        keyIdentifier: "primary",
        lots: [],
        portfolioId,
        portfolioVersion: 1,
        precisionPolicyVersion: "DEC-014",
        positions: [],
        realizedPnL: "0.00000000",
        reconciliationState: "Reconciled",
        sourceCommitmentHash: commitment,
        totalEquity: "100.00000000",
        valuationSnapshotId,
      };

      const published = await publish(projection);
      assert.deepEqual(published.rows[0].result, {
        auditId: published.rows[0].result.auditId,
        published: true,
      });
      const accepted = await client.query(
        `SELECT projection.valuation_snapshot_id::text,
                projection.portfolio_version::integer,
                projection.reconciliation_state,
                audit.outcome,
                audit.old_portfolio_version::integer,
                audit.workload_identity,
                commitment.audit_sequence::integer,
                commitment.key_identifier,
                checkpoint.audit_commitment = commitment.audit_commitment AS checkpoint_matches
           FROM etf.portfolio_projections AS projection
           JOIN etf.ledger_audit AS audit
             ON audit.attempt_intent_id = projection.valuation_snapshot_id
           JOIN etf.audit_commitments AS commitment
             ON commitment.audit_segment_hash = audit.audit_evidence_hash
           JOIN etf.audit_anchor_checkpoints AS checkpoint
             ON checkpoint.audit_sequence = commitment.audit_sequence
          WHERE projection.portfolio_id = $1::uuid
            AND projection.valuation_snapshot_id = $2::uuid`,
        [portfolioId, valuationSnapshotId],
      );
      assert.deepEqual(accepted.rows, [{
        valuation_snapshot_id: valuationSnapshotId,
        portfolio_version: 1,
        reconciliation_state: "Reconciled",
        outcome: "PublicationCompleted",
        old_portfolio_version: 1,
        workload_identity: "projection_runtime",
        audit_sequence: 2,
        key_identifier: "primary",
        checkpoint_matches: true,
      }]);
      const beforeFailure = await snapshot();

      await assert.rejects(
        () => publish({
          ...projection,
          cash: "101.00000000",
          totalEquity: "101.00000000",
          valuationSnapshotId: deterministicUuid(group, 5),
        }),
        (error) => error.code === "P0001" && error.message === "LEDGER_RECONCILIATION_FAILED",
      );
      assert.deepEqual(await snapshot(), beforeFailure);

      await client.query(
        "REVOKE EXECUTE ON FUNCTION etf.audit_append(jsonb) FROM projection_owner",
      );
      try {
        await assert.rejects(
          () => publish({
            ...projection,
            asOf: "2026-09-21T14:02:00.000Z",
            valuationSnapshotId: deterministicUuid(group, 6),
          }),
          (error) => error.code === "42501",
        );
      } finally {
        await client.query(
          "GRANT EXECUTE ON FUNCTION etf.audit_append(jsonb) TO projection_owner",
        );
      }
      assert.deepEqual(await snapshot(), beforeFailure);

      await assert.rejects(
        () => publish({
          ...projection,
          asOf: "2026-09-21T14:03:00.000Z",
          keyIdentifier: "missing",
          valuationSnapshotId: deterministicUuid(group, 7),
        }),
        (error) => error.code === "55000" && error.message === "LEDGER_INTEGRITY_FAILED",
      );
      assert.deepEqual(await snapshot(), beforeFailure);
      const current = await client.query(
        `SELECT valuation_snapshot_id::text
           FROM etf.portfolio_projections
          WHERE portfolio_id = $1::uuid
          ORDER BY as_of DESC, valuation_snapshot_id DESC
          LIMIT 1`,
        [portfolioId],
      );
      assert.equal(current.rows[0].valuation_snapshot_id, valuationSnapshotId);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-017 blocks publication on integrity failure without replacing cache",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "56200000";
    const portfolioId = deterministicUuid(group, 1);
    const acceptedSnapshotId = deterministicUuid(group, 2);
    const publish = async (payload) => {
      await client.query("SET SESSION AUTHORIZATION projection_runtime");
      try {
        return await client.query(
          "SELECT etf.projection_publish($1::jsonb) AS result",
          [payload],
        );
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }
    };
    const snapshot = async () => (await client.query(
      `SELECT
         (SELECT jsonb_agg(to_jsonb(projection) ORDER BY projection.as_of, projection.valuation_snapshot_id)
            FROM etf.portfolio_projections AS projection
           WHERE projection.portfolio_id = $1::uuid) AS projections,
         (SELECT jsonb_agg(to_jsonb(audit) ORDER BY audit.recorded_at, audit.audit_id)
            FROM etf.ledger_audit AS audit
           WHERE audit.portfolio_id = $1::uuid) AS audits,
         (SELECT jsonb_agg(to_jsonb(commitment) ORDER BY commitment.audit_sequence)
            FROM etf.audit_commitments AS commitment) AS commitments,
         (SELECT jsonb_agg(to_jsonb(checkpoint) ORDER BY checkpoint.audit_sequence)
            FROM etf.audit_anchor_checkpoints AS checkpoint) AS checkpoints`,
      [portfolioId],
    )).rows;
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 3),
        correlationId: deterministicUuid(group, 4),
        version: 0,
        effectiveAt: "2026-09-21T15:00:00.000Z",
        amount: "100.00000000",
      }));
      const commitment = (await client.query(
        `SELECT commitment_hash
           FROM etf.ledger_commitments
          WHERE portfolio_id = $1::uuid AND ledger_sequence = 1`,
        [portfolioId],
      )).rows[0].commitment_hash;
      const projection = {
        allocations: [],
        asOf: "2026-09-21T15:01:00.000Z",
        baselineVersion: "v1.0.0",
        cash: "100.00000000",
        keyIdentifier: "primary",
        lots: [],
        portfolioId,
        portfolioVersion: 1,
        precisionPolicyVersion: "DEC-014",
        positions: [],
        realizedPnL: "0.00000000",
        reconciliationState: "Reconciled",
        sourceCommitmentHash: commitment,
        totalEquity: "100.00000000",
        valuationSnapshotId: acceptedSnapshotId,
      };
      assert.equal((await publish(projection)).rows[0].result.published, true);
      const projectionBefore = await client.query(
        `SELECT to_jsonb(projection) AS projection
           FROM etf.portfolio_projections AS projection
          WHERE projection.portfolio_id = $1::uuid
          ORDER BY projection.as_of, projection.valuation_snapshot_id`,
        [portfolioId],
      );

      const blockedSnapshotId = deterministicUuid(group, 5);
      const blocked = await publish({
        ...projection,
        asOf: "2026-09-21T15:02:00.000Z",
        sourceCommitmentHash: "f".repeat(64),
        valuationSnapshotId: blockedSnapshotId,
      });
      assert.deepEqual(blocked.rows[0].result, {
        auditId: blocked.rows[0].result.auditId,
        published: false,
      });
      const blockedEvidence = await client.query(
        `SELECT audit.outcome,
                audit.error_code,
                audit.old_portfolio_version::integer,
                audit.workload_identity,
                commitment.key_identifier,
                checkpoint.audit_commitment = commitment.audit_commitment AS checkpoint_matches
           FROM etf.ledger_audit AS audit
           JOIN etf.audit_commitments AS commitment
             ON commitment.audit_segment_hash = audit.audit_evidence_hash
           JOIN etf.audit_anchor_checkpoints AS checkpoint
             ON checkpoint.audit_sequence = commitment.audit_sequence
          WHERE audit.attempt_intent_id = $1::uuid`,
        [blockedSnapshotId],
      );
      assert.deepEqual(blockedEvidence.rows, [{
        outcome: "BlockedPublication",
        error_code: "LEDGER_INTEGRITY_FAILED",
        old_portfolio_version: 1,
        workload_identity: "projection_runtime",
        key_identifier: "primary",
        checkpoint_matches: true,
      }]);
      const projectionAfter = await client.query(
        `SELECT to_jsonb(projection) AS projection
           FROM etf.portfolio_projections AS projection
          WHERE projection.portfolio_id = $1::uuid
          ORDER BY projection.as_of, projection.valuation_snapshot_id`,
        [portfolioId],
      );
      assert.deepEqual(projectionAfter.rows, projectionBefore.rows);
      const current = await client.query(
        `SELECT valuation_snapshot_id::text
           FROM etf.portfolio_projections
          WHERE portfolio_id = $1::uuid
          ORDER BY as_of DESC, valuation_snapshot_id DESC
          LIMIT 1`,
        [portfolioId],
      );
      assert.equal(current.rows[0].valuation_snapshot_id, acceptedSnapshotId);

      const beforeAnchorFailure = await snapshot();
      await assert.rejects(
        () => publish({
          ...projection,
          asOf: "2026-09-21T15:03:00.000Z",
          keyIdentifier: "missing",
          reconciliationState: "IntegrityBlocked",
          valuationSnapshotId: deterministicUuid(group, 6),
        }),
        (error) => error.code === "55000" && error.message === "LEDGER_INTEGRITY_FAILED",
      );
      assert.deepEqual(await snapshot(), beforeAnchorFailure);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-018 appends timeout and recovery outcomes for unresolved intent",
  { skip: !connectionString },
  async () => {
    const admin = new pg.Client({ connectionString });
    const group = "56300000";
    const portfolioId = deterministicUuid(group, 1);
    const attemptIntentId = deterministicUuid(group, 2);
    const correlationId = deterministicUuid(group, 3);
    const intent = {
      action: "LedgerAppend",
      attemptIntentId,
      correlationId,
      domain: "Ledger",
      keyIdentifier: "primary",
      outcome: "IntentRecorded",
      subject: {
        auditId: deterministicUuid(group, 4),
        oldPortfolioVersion: 1,
        portfolioId,
        replayClassification: "New",
      },
    };
    const timeout = {
      ...intent,
      outcome: "TimeoutRecovery",
      subject: {
        ...intent.subject,
        auditId: deterministicUuid(group, 5),
        errorCode: "AUDIT_ATTEMPT_TIMEOUT",
        transitionCommandId: null,
      },
    };
    const recovery = {
      ...intent,
      outcome: "RecoveryCompleted",
      subject: {
        ...intent.subject,
        auditId: deterministicUuid(group, 6),
        transitionCommandId: null,
      },
    };
    const collect = async (payload) => {
      const collector = new pg.Client({ connectionString });
      await collector.connect();
      try {
        return await appendAudit(collector, payload);
      } finally {
        await collector.end();
      }
    };
    const snapshot = async () => (await admin.query(
      `SELECT
         (SELECT jsonb_agg(to_jsonb(audit) ORDER BY audit.recorded_at, audit.audit_id)
            FROM etf.ledger_audit AS audit
           WHERE audit.attempt_intent_id = $1::uuid) AS audits,
         (SELECT jsonb_agg(to_jsonb(commitment) ORDER BY commitment.audit_sequence)
            FROM etf.audit_commitments AS commitment) AS commitments,
         (SELECT jsonb_agg(to_jsonb(checkpoint) ORDER BY checkpoint.audit_sequence)
            FROM etf.audit_anchor_checkpoints AS checkpoint) AS checkpoints`,
      [attemptIntentId],
    )).rows;
    await admin.connect();
    await admin.query(fixtureLockSql);
    try {
      await cleanBootstrap(admin);
      await applyCompleteMigrationSet(admin);
      await appendLedger(admin, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 7),
        correlationId: deterministicUuid(group, 8),
        version: 0,
        effectiveAt: "2026-09-21T16:00:00.000Z",
        amount: "100.00000000",
      }));

      const intentResult = await collect(intent);
      const immutableIntent = await admin.query(
        "SELECT to_jsonb(audit) AS audit FROM etf.ledger_audit AS audit WHERE audit_id = $1::uuid",
        [intent.subject.auditId],
      );
      const timeoutResult = await collect(timeout);
      const afterTimeout = await snapshot();
      assert.deepEqual(await collect(timeout), timeoutResult);
      assert.deepEqual(await snapshot(), afterTimeout);
      await assert.rejects(
        () => collect({ ...timeout, correlationId: deterministicUuid(group, 9) }),
        (error) => error.code === "22023" && error.message === "AUDIT_REQUEST_INVALID",
      );
      assert.deepEqual(await snapshot(), afterTimeout);

      const recoveryResult = await collect(recovery);
      const afterRecovery = await snapshot();
      assert.deepEqual(await collect(recovery), recoveryResult);
      assert.deepEqual(await snapshot(), afterRecovery);
      assert.deepEqual(
        (await admin.query(
          "SELECT to_jsonb(audit) AS audit FROM etf.ledger_audit AS audit WHERE audit_id = $1::uuid",
          [intent.subject.auditId],
        )).rows,
        immutableIntent.rows,
      );
      assert.equal(intentResult.auditId, intent.subject.auditId);

      const lifecycle = await admin.query(
        `SELECT audit.outcome,
                audit.attempt_intent_id::text AS attempt_intent_id,
                audit.correlation_id::text AS correlation_id,
                audit.workload_identity,
                commitment.audit_sequence::integer,
                checkpoint.audit_commitment = commitment.audit_commitment AS checkpoint_matches
           FROM etf.ledger_audit AS audit
           JOIN etf.audit_commitments AS commitment
             ON commitment.audit_segment_hash = audit.audit_evidence_hash
           JOIN etf.audit_anchor_checkpoints AS checkpoint
             ON checkpoint.audit_sequence = commitment.audit_sequence
          WHERE audit.attempt_intent_id = $1::uuid
          ORDER BY commitment.audit_sequence`,
        [attemptIntentId],
      );
      assert.deepEqual(
        lifecycle.rows.map(({ outcome }) => outcome),
        ["IntentRecorded", "TimeoutRecovery", "RecoveryCompleted"],
      );
      for (const row of lifecycle.rows) {
        assert.equal(row.attempt_intent_id, attemptIntentId);
        assert.equal(row.correlation_id, correlationId);
        assert.equal(row.workload_identity, "audit_runtime");
        assert.equal(row.checkpoint_matches, true);
      }

      const competingIntent = {
        ...intent,
        attemptIntentId: deterministicUuid(group, 10),
        correlationId: deterministicUuid(group, 11),
        subject: { ...intent.subject, auditId: deterministicUuid(group, 12) },
      };
      await collect(competingIntent);
      const sharedAuditId = deterministicUuid(group, 13);
      const collidingTimeouts = [
        { ...timeout, subject: { ...timeout.subject, auditId: sharedAuditId } },
        {
          ...timeout,
          attemptIntentId: competingIntent.attemptIntentId,
          correlationId: competingIntent.correlationId,
          subject: { ...competingIntent.subject, auditId: sharedAuditId, errorCode: "AUDIT_ATTEMPT_TIMEOUT" },
        },
      ];
      const collisionResults = await Promise.all(collidingTimeouts.map(async (payload) => {
        try {
          return { result: await collect(payload) };
        } catch (error) {
          return { error };
        }
      }));
      assert.equal(collisionResults.filter(({ result }) => result !== undefined).length, 1);
      const collisionError = collisionResults.find(({ error }) => error !== undefined).error;
      assert.equal(collisionError.code, "22023");
      assert.equal(collisionError.message, "AUDIT_REQUEST_INVALID");
      assert.deepEqual(
        (await admin.query(
          `SELECT count(*)::integer AS audits,
                  count(commitment.audit_sequence)::integer AS commitments,
                  count(checkpoint.audit_sequence)::integer AS checkpoints
             FROM etf.ledger_audit AS audit
             LEFT JOIN etf.audit_commitments AS commitment
               ON commitment.audit_segment_hash = audit.audit_evidence_hash
             LEFT JOIN etf.audit_anchor_checkpoints AS checkpoint
               ON checkpoint.audit_sequence = commitment.audit_sequence
            WHERE audit.audit_id = $1::uuid`,
          [sharedAuditId],
        )).rows,
        [{ audits: 1, commitments: 1, checkpoints: 1 }],
      );
    } finally {
      try {
        await cleanBootstrap(admin);
      } finally {
        await admin.query(fixtureUnlockSql);
        await admin.end();
      }
    }
  },
);

test(
  "CT-LED-008 detects every keyed cache corruption without repair",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "55800000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "CORRUPT-CACHE-ETF";
    const buy = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "10.0000000000",
      unitPrice: "100.0000000000",
      effectiveAt: "2026-09-21T11:01:00.000Z",
    });
    const sell = fillFixture({
      group,
      index: 2,
      side: "Sell",
      quantity: "4.0000000000",
      unitPrice: "120.0000000000",
      effectiveAt: "2026-09-21T11:02:00.000Z",
    });
    const valuationSnapshotId = deterministicUuid(group, 900);
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await seedFillOrder(client, { ...buy, instrumentId });
      await seedFillOrder(client, { ...sell, instrumentId });
      await client.query("GRANT EXECUTE ON FUNCTION etf.ledger_append(jsonb) TO app_runtime");
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-21T11:00:00.000Z",
        amount: "10000.00000000",
      }));
      await appendLedger(client, fillCommand({
        ...buy,
        portfolioId,
        instrumentId,
        version: 1,
        fee: "1.00000000",
      }));
      await appendLedger(client, fillCommand({
        ...sell,
        portfolioId,
        instrumentId,
        version: 2,
        fee: "1.00000000",
      }));
      await client.query("REVOKE EXECUTE ON FUNCTION etf.ledger_append(jsonb) FROM app_runtime");
      const commitment = await client.query(
        `SELECT commitment_hash
           FROM etf.ledger_commitments
          WHERE portfolio_id = $1::uuid
          ORDER BY ledger_sequence DESC
          LIMIT 1`,
        [portfolioId],
      );
      const validProjection = {
        allocations: [{
          sellTransactionId: sell.transactionId,
          effectOrdinal: 1,
          lotId: buy.fillId,
          consumedQuantity: "4.0000000000",
          allocatedBasis: "400.40000000",
        }],
        asOf: "2026-09-21T11:03:00.000Z",
        baselineVersion: "v1.0.0",
        cash: "9478.00000000",
        keyIdentifier: "primary",
        lots: [{
          lotId: buy.fillId,
          instrumentId,
          quantity: "6.0000000000",
          basis: "600.60000000",
        }],
        portfolioId,
        portfolioVersion: 3,
        precisionPolicyVersion: "DEC-014",
        positions: [{
          instrumentId,
          quantity: "6.0000000000",
          basis: "600.60000000",
          unitValue: "110.0000000000",
          valuation: "660.00000000",
          unrealizedPnL: "59.40000000",
        }],
        realizedPnL: "78.60000000",
        reconciliationState: "Reconciled",
        sourceCommitmentHash: commitment.rows[0].commitment_hash,
        totalEquity: "10138.00000000",
        valuationSnapshotId,
      };
      const corruptions = [
        ["cash", { ...validProjection, cash: "9478.01000000" }],
        ["realized P&L", { ...validProjection, realizedPnL: "78.61000000" }],
        ["open-lot quantity", {
          ...validProjection,
          lots: [{ ...validProjection.lots[0], quantity: "6.0000000001" }],
        }],
        ["open-lot basis", {
          ...validProjection,
          lots: [{ ...validProjection.lots[0], basis: "600.61000000" }],
        }],
        ["open-lot identity", {
          ...validProjection,
          lots: [{ ...validProjection.lots[0], lotId: deterministicUuid(group, 999) }],
        }],
        ["missing open lot", { ...validProjection, lots: [] }],
        ["extra open lot", {
          ...validProjection,
          lots: [...validProjection.lots, {
            ...validProjection.lots[0],
            lotId: deterministicUuid(group, 999),
          }],
        }],
        ["duplicate open-lot key", {
          ...validProjection,
          lots: [...validProjection.lots, validProjection.lots[0]],
        }],
        ["position quantity", {
          ...validProjection,
          positions: [{ ...validProjection.positions[0], quantity: "6.0000000001" }],
        }],
        ["position basis", {
          ...validProjection,
          positions: [{ ...validProjection.positions[0], basis: "600.61000000" }],
        }],
        ["position identity", {
          ...validProjection,
          positions: [{ ...validProjection.positions[0], instrumentId: "OTHER-ETF" }],
        }],
        ["missing position", { ...validProjection, positions: [] }],
        ["extra position", {
          ...validProjection,
          positions: [...validProjection.positions, {
            ...validProjection.positions[0],
            instrumentId: "OTHER-ETF",
          }],
        }],
        ["duplicate position key", {
          ...validProjection,
          positions: [...validProjection.positions, validProjection.positions[0]],
        }],
        ["valuation", {
          ...validProjection,
          positions: [{ ...validProjection.positions[0], valuation: "660.01000000" }],
        }],
        ["unit-value consistency", {
          ...validProjection,
          positions: [{ ...validProjection.positions[0], unitValue: "110.0100000000" }],
        }],
        ["unrealized P&L", {
          ...validProjection,
          positions: [{ ...validProjection.positions[0], unrealizedPnL: "59.41000000" }],
        }],
        ["total equity", { ...validProjection, totalEquity: "10138.01000000" }],
        ["allocation sell identity", {
          ...validProjection,
          allocations: [{
            ...validProjection.allocations[0],
            sellTransactionId: deterministicUuid(group, 998),
          }],
        }],
        ["allocation lot identity", {
          ...validProjection,
          allocations: [{
            ...validProjection.allocations[0],
            lotId: deterministicUuid(group, 999),
          }],
        }],
        ["allocation ordinal identity", {
          ...validProjection,
          allocations: [{ ...validProjection.allocations[0], effectOrdinal: 2 }],
        }],
        ["missing allocation", { ...validProjection, allocations: [] }],
        ["extra allocation", {
          ...validProjection,
          allocations: [...validProjection.allocations, {
            ...validProjection.allocations[0],
            effectOrdinal: 2,
          }],
        }],
        ["duplicate allocation key", {
          ...validProjection,
          allocations: [...validProjection.allocations, validProjection.allocations[0]],
        }],
        ["stale portfolio version", { ...validProjection, portfolioVersion: 2 }],
        ["stale precision policy", { ...validProjection, precisionPolicyVersion: "DEC-013" }],
        ["stale baseline", { ...validProjection, baselineVersion: "v0.9.0" }],
        ["stale valuation snapshot", {
          ...validProjection,
          valuationSnapshotId: deterministicUuid(group, 901),
        }],
        ["equal-and-opposite cross-surface values", {
          ...validProjection,
          cash: "9478.01000000",
          positions: [{ ...validProjection.positions[0], valuation: "659.99000000" }],
        }],
      ];

      await client.query("GRANT USAGE ON SCHEMA etf TO projection_runtime");
      await client.query("GRANT EXECUTE ON FUNCTION etf.projection_publish(jsonb) TO projection_runtime");
      await client.query("SET SESSION AUTHORIZATION projection_runtime");
      try {
        const published = await client.query(
          "SELECT etf.projection_publish($1::jsonb) AS result",
          [validProjection],
        );
        assert.equal(published.rows[0].result.published, true);
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }
      const before = await snapshotLedger(client, portfolioId);
      const cachedBefore = await client.query(
        "SELECT to_jsonb(projection) AS projection FROM etf.portfolio_projections projection WHERE portfolio_id = $1::uuid",
        [portfolioId],
      );

      for (const [surface, corruptedProjection] of corruptions) {
        await client.query("SET SESSION AUTHORIZATION projection_runtime");
        try {
          await assert.rejects(
            () => client.query(
              "SELECT etf.projection_publish($1::jsonb)",
              [corruptedProjection],
            ),
            /LEDGER_RECONCILIATION_FAILED/,
            surface,
          );
        } finally {
          await client.query("RESET SESSION AUTHORIZATION");
        }

        assert.deepEqual(await snapshotLedger(client, portfolioId), before, surface);
        const cachedAfter = await client.query(
          "SELECT to_jsonb(projection) AS projection FROM etf.portfolio_projections projection WHERE portfolio_id = $1::uuid",
          [portfolioId],
        );
        assert.deepEqual(cachedAfter.rows, cachedBefore.rows, surface);
      }

      await client.query("SET SESSION AUTHORIZATION projection_runtime");
      try {
        await assert.rejects(
          () => client.query(
            "SELECT etf.projection_publish($1::jsonb)",
            [{ ...validProjection, lots: "not-an-array" }],
          ),
          /APPLICATION_REQUEST_INVALID/,
          "malformed projection array",
        );
      } finally {
        await client.query("RESET SESSION AUTHORIZATION");
      }
      assert.deepEqual(await snapshotLedger(client, portfolioId), before);
      const cachedAfterMalformed = await client.query(
        "SELECT to_jsonb(projection) AS projection FROM etf.portfolio_projections projection WHERE portfolio_id = $1::uuid",
        [portfolioId],
      );
      assert.deepEqual(cachedAfterMalformed.rows, cachedBefore.rows);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-009 orders equal-timestamp lots by ledger sequence independent of fetch order",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "51500000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "EQUAL-TIME-ETF";
    const acquiredAt = "2026-09-14T01:01:00.000Z";
    const lotA = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "1.0000000000",
      unitPrice: "11.0000000000",
      effectiveAt: acquiredAt,
    });
    const lotB = fillFixture({
      group,
      index: 2,
      side: "Buy",
      quantity: "1.0000000000",
      unitPrice: "10.0000000000",
      effectiveAt: acquiredAt,
    });
    const sell = fillFixture({
      group,
      index: 3,
      side: "Sell",
      quantity: "1.0000000000",
      unitPrice: "12.0000000000",
      effectiveAt: "2026-09-14T01:02:00.000Z",
    });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      for (const fill of [lotA, lotB, sell]) {
        await seedFillOrder(client, { ...fill, instrumentId });
      }

      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-14T01:00:00.000Z",
      }));
      await appendLedger(client, fillCommand({
        ...lotB,
        portfolioId,
        instrumentId,
        version: 1,
      }));
      await appendLedger(client, fillCommand({
        ...lotA,
        portfolioId,
        instrumentId,
        version: 2,
      }));

      await client.query("CLUSTER etf.ledger_lots USING pk_ledger_lots");
      const physicalOrder = await client.query(
        `SELECT lot_id::text AS lot_id
           FROM etf.ledger_lots
          WHERE portfolio_id = $1::uuid
          ORDER BY ctid`,
        [portfolioId],
      );
      assert.deepEqual(
        physicalOrder.rows.map(({ lot_id }) => lot_id),
        [lotA.fillId, lotB.fillId],
      );

      await appendLedger(client, fillCommand({
        ...sell,
        portfolioId,
        instrumentId,
        version: 3,
      }));
      const allocations = await client.query(
        `SELECT allocation.effect_ordinal::integer AS effect_ordinal,
                allocation.lot_id::text AS lot_id,
                allocation.consumed_quantity::text AS consumed_quantity,
                allocation.allocated_basis::text AS allocated_basis
           FROM etf.ledger_allocations AS allocation
          WHERE allocation.portfolio_id = $1::uuid
            AND allocation.sell_transaction_id = $2::uuid
          ORDER BY allocation.effect_ordinal`,
        [portfolioId, sell.transactionId],
      );
      assert.deepEqual(allocations.rows, [{
        effect_ordinal: 1,
        lot_id: lotB.fillId,
        consumed_quantity: "1.0000000000",
        allocated_basis: "10.00000000",
      }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-005 assigns the final proportional sale the exact residual lot basis",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "51000000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "RESIDUAL-ETF";
    const fills = [
      fillFixture({
        group,
        index: 1,
        side: "Buy",
        quantity: "3.0000000000",
        unitPrice: "3.3333333350",
        effectiveAt: "2026-09-14T01:01:00.000Z",
      }),
      ...[2, 3, 4].map((index) => fillFixture({
        group,
        index,
        side: "Sell",
        quantity: "1.0000000000",
        unitPrice: "4.0000000000",
        effectiveAt: `2026-09-14T01:0${index}:00.000Z`,
      })),
    ];
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      for (const fill of fills) {
        await seedFillOrder(client, { ...fill, instrumentId });
      }

      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-14T01:00:00.000Z",
      }));
      for (const [index, fill] of fills.entries()) {
        await appendLedger(client, fillCommand({
          ...fill,
          portfolioId,
          instrumentId,
          version: index + 1,
        }));
      }

      const allocations = await client.query(
        `SELECT transaction_record.ledger_sequence::integer AS ledger_sequence,
                allocation.effect_ordinal::integer AS effect_ordinal,
                allocation.allocated_basis::text AS allocated_basis
           FROM etf.ledger_allocations AS allocation
           JOIN etf.ledger_transactions AS transaction_record
             ON transaction_record.portfolio_id = allocation.portfolio_id
            AND transaction_record.transaction_id = allocation.sell_transaction_id
          WHERE allocation.portfolio_id = $1::uuid
          ORDER BY transaction_record.ledger_sequence, allocation.effect_ordinal`,
        [portfolioId],
      );
      const allocationTotal = await client.query(
        `SELECT sum(allocated_basis)::text AS allocated_basis
           FROM etf.ledger_allocations
          WHERE portfolio_id = $1::uuid`,
        [portfolioId],
      );
      assert.deepEqual({
        allocations: allocations.rows,
        allocatedBasisTotal: allocationTotal.rows[0].allocated_basis,
      }, {
        allocations: [
          { ledger_sequence: 3, effect_ordinal: 1, allocated_basis: "3.33333333" },
          { ledger_sequence: 4, effect_ordinal: 1, allocated_basis: "3.33333333" },
          { ledger_sequence: 5, effect_ordinal: 1, allocated_basis: "3.33333334" },
        ],
        allocatedBasisTotal: "10.00000000",
      });
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-010 rejects active dependencies and preserves immutable reversal lineage",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "52000000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "REVERSAL-ETF";
    const buy = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "2.0000000000",
      unitPrice: "10.0000000000",
      effectiveAt: "2026-09-14T02:01:00.000Z",
    });
    const sell = fillFixture({
      group,
      index: 2,
      side: "Sell",
      quantity: "2.0000000000",
      unitPrice: "15.0000000000",
      effectiveAt: "2026-09-14T02:02:00.000Z",
    });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await seedFillOrder(client, { ...buy, instrumentId });
      await seedFillOrder(client, { ...sell, instrumentId });
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-14T02:00:00.000Z",
      }));
      await appendLedger(client, fillCommand({
        ...buy,
        portfolioId,
        instrumentId,
        version: 1,
      }));
      await appendLedger(client, fillCommand({
        ...sell,
        portfolioId,
        instrumentId,
        version: 2,
      }));

      const beforeRejectedReversal = await snapshotLedger(client, portfolioId);
      await assert.rejects(
        () => appendLedger(client, reversal({
          portfolioId,
          transactionId: deterministicUuid(group, 701),
          correlationId: deterministicUuid(group, 801),
          version: 3,
          effectiveAt: "2026-09-14T02:03:00.000Z",
          reversesTransactionId: buy.transactionId,
        })),
        /LEDGER_REVERSAL_DEPENDENCY/,
      );
      assert.deepEqual(
        await snapshotLedger(client, portfolioId),
        beforeRejectedReversal,
      );

      const sellReversalId = deterministicUuid(group, 702);
      const buyReversalId = deterministicUuid(group, 703);
      await appendLedger(client, reversal({
        portfolioId,
        transactionId: sellReversalId,
        correlationId: deterministicUuid(group, 802),
        version: 3,
        effectiveAt: "2026-09-14T02:04:00.000Z",
        reversesTransactionId: sell.transactionId,
      }));
      await appendLedger(client, reversal({
        portfolioId,
        transactionId: buyReversalId,
        correlationId: deterministicUuid(group, 803),
        version: 4,
        effectiveAt: "2026-09-14T02:05:00.000Z",
        reversesTransactionId: buy.transactionId,
      }));

      const aggregateEffects = await client.query(
        `SELECT round(COALESCE(sum(money) FILTER (WHERE effect_type ~ '(^|:)Cash$'), 0), 8)::text AS cash,
                round(COALESCE(sum(quantity) FILTER (WHERE effect_type ~ '(^|:)Position$'), 0), 10)::text AS quantity,
                round(COALESCE(sum(money) FILTER (WHERE effect_type ~ '(^|:)RealizedPnL$'), 0), 8)::text AS realized_pnl
           FROM etf.ledger_effects
          WHERE portfolio_id = $1::uuid`,
        [portfolioId],
      );
      assert.deepEqual(aggregateEffects.rows, [{
        cash: "100.00000000",
        quantity: "0.0000000000",
        realized_pnl: "0.00000000",
      }]);
      const allocationLineage = await client.query(
        `SELECT count(*)::integer AS allocation_count,
                sum(consumed_quantity)::text AS consumed_quantity,
                sum(allocated_basis)::text AS allocated_basis
           FROM etf.ledger_allocations
          WHERE portfolio_id = $1::uuid`,
        [portfolioId],
      );
      assert.deepEqual(allocationLineage.rows, [{
        allocation_count: 1,
        consumed_quantity: "2.0000000000",
        allocated_basis: "20.00000000",
      }]);
      const reversalLineage = await client.query(
        `SELECT transaction_record.transaction_id::text,
                transaction_record.reverses_transaction_id::text,
                link.target_transaction_id::text
           FROM etf.ledger_transactions AS transaction_record
           JOIN etf.ledger_reversal_links AS link
             ON link.portfolio_id = transaction_record.portfolio_id
            AND link.reversal_transaction_id = transaction_record.transaction_id
          WHERE transaction_record.portfolio_id = $1::uuid
          ORDER BY transaction_record.ledger_sequence`,
        [portfolioId],
      );
      assert.deepEqual(reversalLineage.rows, [
        {
          transaction_id: sellReversalId,
          reverses_transaction_id: sell.transactionId,
          target_transaction_id: sell.transactionId,
        },
        {
          transaction_id: buyReversalId,
          reverses_transaction_id: buy.transactionId,
          target_transaction_id: buy.transactionId,
        },
      ]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-010 reapplies stored sell effects through a reversal of its reversal",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "53000000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "REAPPLY-ETF";
    const buy = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "2.0000000000",
      unitPrice: "10.0000000000",
      effectiveAt: "2026-09-14T03:01:00.000Z",
    });
    const sell = fillFixture({
      group,
      index: 2,
      side: "Sell",
      quantity: "2.0000000000",
      unitPrice: "15.0000000000",
      effectiveAt: "2026-09-14T03:02:00.000Z",
    });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await seedFillOrder(client, { ...buy, instrumentId });
      await seedFillOrder(client, { ...sell, instrumentId });
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-14T03:00:00.000Z",
      }));
      await appendLedger(client, fillCommand({
        ...buy,
        portfolioId,
        instrumentId,
        version: 1,
      }));
      await appendLedger(client, fillCommand({
        ...sell,
        portfolioId,
        instrumentId,
        version: 2,
      }));

      const sellReversalId = deterministicUuid(group, 701);
      const reapplyId = deterministicUuid(group, 702);
      await appendLedger(client, reversal({
        portfolioId,
        transactionId: sellReversalId,
        correlationId: deterministicUuid(group, 801),
        version: 3,
        effectiveAt: "2026-09-14T03:03:00.000Z",
        reversesTransactionId: sell.transactionId,
      }));
      const reapplied = await appendLedger(client, reversal({
        portfolioId,
        transactionId: reapplyId,
        correlationId: deterministicUuid(group, 802),
        version: 4,
        effectiveAt: "2026-09-14T03:04:00.000Z",
        reversesTransactionId: sellReversalId,
      }));
      assert.equal(reapplied.portfolioVersion, 5);

      const sellAndReappliedEffects = await client.query(
        `SELECT transaction_id::text,
                effect_ordinal::integer,
                regexp_replace(effect_type, '^(Reversal:)+', '') AS effect_type,
                quantity::text,
                money::text
           FROM etf.ledger_effects
          WHERE portfolio_id = $1::uuid
            AND transaction_id = ANY($2::uuid[])
          ORDER BY transaction_id, effect_ordinal`,
        [portfolioId, [sell.transactionId, reapplyId]],
      );
      const withoutTransactionIds = sellAndReappliedEffects.rows.map(({
        effect_ordinal,
        effect_type,
        quantity,
        money,
      }) => ({ effect_ordinal, effect_type, quantity, money }));
      const effectCount = withoutTransactionIds.length / 2;
      assert.equal(Number.isInteger(effectCount), true);
      assert.deepEqual(
        withoutTransactionIds.slice(0, effectCount),
        withoutTransactionIds.slice(effectCount),
      );

      const aggregateEffects = await client.query(
        `SELECT round(COALESCE(sum(money) FILTER (WHERE effect_type ~ '(^|:)Cash$'), 0), 8)::text AS cash,
                round(COALESCE(sum(quantity) FILTER (WHERE effect_type ~ '(^|:)Position$'), 0), 10)::text AS quantity,
                round(COALESCE(sum(money) FILTER (WHERE effect_type ~ '(^|:)RealizedPnL$'), 0), 8)::text AS realized_pnl
           FROM etf.ledger_effects
          WHERE portfolio_id = $1::uuid`,
        [portfolioId],
      );
      assert.deepEqual(aggregateEffects.rows, [{
        cash: "110.00000000",
        quantity: "0.0000000000",
        realized_pnl: "10.00000000",
      }]);

      const beforeDuplicateReversal = await snapshotLedger(client, portfolioId);
      await assert.rejects(
        () => appendLedger(client, reversal({
          portfolioId,
          transactionId: deterministicUuid(group, 703),
          correlationId: deterministicUuid(group, 803),
          version: 5,
          effectiveAt: "2026-09-14T03:05:00.000Z",
          reversesTransactionId: sellReversalId,
        })),
        /LEDGER_ALREADY_REVERSED/,
      );
      assert.deepEqual(
        await snapshotLedger(client, portfolioId),
        beforeDuplicateReversal,
      );
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-010 rejects reversing a sell reversal after restored lot consumption",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const group = "54000000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "RESTORED-LOT-ETF";
    const buy = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "2.0000000000",
      unitPrice: "10.0000000000",
      effectiveAt: "2026-09-14T04:01:00.000Z",
    });
    const sell = fillFixture({
      group,
      index: 2,
      side: "Sell",
      quantity: "2.0000000000",
      unitPrice: "15.0000000000",
      effectiveAt: "2026-09-14T04:02:00.000Z",
    });
    const laterSell = fillFixture({
      group,
      index: 3,
      side: "Sell",
      quantity: "1.0000000000",
      unitPrice: "15.0000000000",
      effectiveAt: "2026-09-14T04:04:00.000Z",
    });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await prepareLedgerBoundary(client);
      await seedFillOrder(client, { ...buy, instrumentId });
      await seedFillOrder(client, { ...sell, instrumentId });
      await seedFillOrder(client, { ...laterSell, instrumentId });
      await appendLedger(client, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-14T04:00:00.000Z",
      }));
      await appendLedger(client, fillCommand({
        ...buy,
        portfolioId,
        instrumentId,
        version: 1,
      }));
      await appendLedger(client, fillCommand({
        ...sell,
        portfolioId,
        instrumentId,
        version: 2,
      }));

      const sellReversalId = deterministicUuid(group, 701);
      await appendLedger(client, reversal({
        portfolioId,
        transactionId: sellReversalId,
        correlationId: deterministicUuid(group, 801),
        version: 3,
        effectiveAt: "2026-09-14T04:03:00.000Z",
        reversesTransactionId: sell.transactionId,
      }));

      const laterSellResult = await appendLedger(client, fillCommand({
        ...laterSell,
        portfolioId,
        instrumentId,
        version: 4,
      }));
      assert.equal(laterSellResult.portfolioVersion, 5);

      const restoredLotAllocation = await client.query(
        `SELECT lot_id::text,
                consumed_quantity::text,
                allocated_basis::text
           FROM etf.ledger_allocations
          WHERE portfolio_id = $1::uuid
            AND sell_transaction_id = $2::uuid`,
        [portfolioId, laterSell.transactionId],
      );
      assert.deepEqual(restoredLotAllocation.rows, [{
        lot_id: buy.fillId,
        consumed_quantity: "1.0000000000",
        allocated_basis: "10.00000000",
      }]);

      const beforeRejectedReversal = await snapshotLedger(client, portfolioId);
      await assert.rejects(
        () => appendLedger(client, reversal({
          portfolioId,
          transactionId: deterministicUuid(group, 702),
          correlationId: deterministicUuid(group, 802),
          version: 5,
          effectiveAt: "2026-09-14T04:05:00.000Z",
          reversesTransactionId: sellReversalId,
        })),
        /LEDGER_REVERSAL_DEPENDENCY/,
      );
      assert.deepEqual(
        await snapshotLedger(client, portfolioId),
        beforeRejectedReversal,
      );
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "CT-LED-011 serializes races replay and rollback atomically",
  { skip: !connectionString },
  async () => {
    const admin = new pg.Client({ connectionString });
    const contenderA = new pg.Client({ connectionString });
    const contenderB = new pg.Client({ connectionString });
    const group = "55000000";
    const portfolioId = deterministicUuid(group, 1);
    const instrumentId = "CONCURRENT-BUY-ETF";
    const buyA = fillFixture({
      group,
      index: 1,
      side: "Buy",
      quantity: "8.0000000000",
      unitPrice: "10.0000000000",
      effectiveAt: "2026-09-14T05:01:00.000Z",
    });
    const buyB = fillFixture({
      group,
      index: 2,
      side: "Buy",
      quantity: "8.0000000000",
      unitPrice: "10.0000000000",
      effectiveAt: "2026-09-14T05:01:00.000Z",
    });
    const sellA = fillFixture({
      group,
      index: 3,
      side: "Sell",
      quantity: "8.0000000000",
      unitPrice: "12.0000000000",
      effectiveAt: "2026-09-14T05:02:00.000Z",
    });
    const sellB = fillFixture({
      group,
      index: 4,
      side: "Sell",
      quantity: "8.0000000000",
      unitPrice: "12.0000000000",
      effectiveAt: "2026-09-14T05:02:00.000Z",
    });
    const insufficientSell = fillFixture({
      group,
      index: 5,
      side: "Sell",
      quantity: "1.0000000000",
      unitPrice: "12.0000000000",
      effectiveAt: "2026-09-14T05:03:00.000Z",
    });
    await admin.connect();
    await admin.query(fixtureLockSql);
    try {
      await cleanBootstrap(admin);
      await applyPrerequisites(admin);
      await prepareLedgerBoundary(admin);
      await seedFillOrder(admin, { ...buyA, instrumentId });
      await seedFillOrder(admin, { ...buyB, instrumentId });
      await seedFillOrder(admin, { ...sellA, instrumentId });
      await seedFillOrder(admin, { ...sellB, instrumentId });
      await seedFillOrder(admin, { ...insufficientSell, instrumentId });
      await appendLedger(admin, cashDeposit({
        portfolioId,
        transactionId: deterministicUuid(group, 1),
        correlationId: deterministicUuid(group, 2),
        version: 0,
        effectiveAt: "2026-09-14T05:00:00.000Z",
      }));
      const beforeRace = await snapshotLedger(admin, portfolioId);
      await contenderA.connect();
      await contenderB.connect();

      const outcomes = await raceUnderPortfolioLock(
        admin,
        portfolioId,
        [contenderA, contenderB],
        [
          () => appendLedger(contenderA, fillCommand({
          ...buyA,
          portfolioId,
          instrumentId,
          version: 1,
          })),
          () => appendLedger(contenderB, fillCommand({
          ...buyB,
          portfolioId,
          instrumentId,
          version: 1,
          })),
        ],
      );
      const committed = outcomes.filter(({ status }) => status === "fulfilled");
      const rejected = outcomes.filter(({ status }) => status === "rejected");
      assert.equal(committed.length, 1);
      assert.equal(rejected.length, 1);
      assert.match(rejected[0].reason.message, /LEDGER_VERSION_CONFLICT/);

      const afterRace = await snapshotLedger(admin, portfolioId);
      assert.deepEqual(afterRace, {
        ...beforeRace,
        portfolio_version: "2",
        transactions: beforeRace.transactions + 1,
        effects: beforeRace.effects + 3,
        lots: beforeRace.lots + 1,
        fills: beforeRace.fills + 1,
        command_replays: beforeRace.command_replays + 1,
        audits: beforeRace.audits + 1,
        commitments: beforeRace.commitments + 1,
        anchors: beforeRace.anchors + 1,
        audit_commitments: beforeRace.audit_commitments + 1,
        audit_checkpoints: beforeRace.audit_checkpoints + 1,
        portfolio_checkpoints: beforeRace.portfolio_checkpoints,
        transaction_hashes: [
          ...beforeRace.transaction_hashes,
          committed[0].value.transactionEvidenceHash,
        ],
        allocation_hashes: [
          ...beforeRace.allocation_hashes,
          committed[0].value.allocationEvidenceHash,
        ],
        commitment_hashes: [
          ...beforeRace.commitment_hashes,
          committed[0].value.commitmentHash,
        ],
      });
      const persistedRace = await admin.query(
        `SELECT transaction_id::text
           FROM etf.ledger_transactions
          WHERE portfolio_id = $1::uuid
            AND transaction_id = ANY($2::uuid[])
          ORDER BY transaction_id`,
        [portfolioId, [buyA.transactionId, buyB.transactionId]],
      );
      assert.deepEqual(persistedRace.rows, [{
        transaction_id: committed[0].value.transactionId,
      }]);

      const beforeSellRace = await snapshotLedger(admin, portfolioId);
      const sellCommands = [sellA, sellB].map((sell) => fillCommand({
        ...sell,
        portfolioId,
        instrumentId,
        version: 2,
      }));
      const sellOutcomes = await raceUnderPortfolioLock(
        admin,
        portfolioId,
        [contenderA, contenderB],
        [
          () => appendLedger(contenderA, sellCommands[0]),
          () => appendLedger(contenderB, sellCommands[1]),
        ],
      );
      const committedSells = sellOutcomes.filter(({ status }) => status === "fulfilled");
      const rejectedSells = sellOutcomes.filter(({ status }) => status === "rejected");
      assert.equal(committedSells.length, 1);
      assert.equal(rejectedSells.length, 1);
      assert.match(rejectedSells[0].reason.message, /LEDGER_VERSION_CONFLICT/);

      const committedSell = committedSells[0].value;
      const afterSellRace = await snapshotLedger(admin, portfolioId);
      assert.deepEqual(afterSellRace, {
        ...beforeSellRace,
        portfolio_version: "3",
        transactions: beforeSellRace.transactions + 1,
        effects: beforeSellRace.effects + 4,
        allocations: beforeSellRace.allocations + 1,
        fills: beforeSellRace.fills + 1,
        command_replays: beforeSellRace.command_replays + 1,
        audits: beforeSellRace.audits + 1,
        commitments: beforeSellRace.commitments + 1,
        anchors: beforeSellRace.anchors + 1,
        audit_commitments: beforeSellRace.audit_commitments + 1,
        audit_checkpoints: beforeSellRace.audit_checkpoints + 1,
        portfolio_checkpoints: beforeSellRace.portfolio_checkpoints,
        transaction_hashes: [
          ...beforeSellRace.transaction_hashes,
          committedSell.transactionEvidenceHash,
        ],
        allocation_hashes: [
          ...beforeSellRace.allocation_hashes,
          committedSell.allocationEvidenceHash,
        ],
        commitment_hashes: [
          ...beforeSellRace.commitment_hashes,
          committedSell.commitmentHash,
        ],
      });

      const committedSellCommand = sellCommands.find(
        ({ transactionId }) => transactionId === committedSell.transactionId,
      );
      const replayOutcomes = await Promise.all([
        appendLedger(contenderA, committedSellCommand),
        appendLedger(contenderB, committedSellCommand),
      ]);
      assert.deepEqual(replayOutcomes, [committedSell, committedSell]);
      assert.deepEqual(await snapshotLedger(admin, portfolioId), afterSellRace);

      await assert.rejects(
        () => appendLedger(contenderA, {
          ...committedSellCommand,
          correlationId: deterministicUuid(group, 999),
        }),
        /LEDGER_IDEMPOTENCY_CONFLICT/,
      );
      assert.deepEqual(await snapshotLedger(admin, portfolioId), afterSellRace);

      await assert.rejects(
        () => appendLedger(contenderA, fillCommand({
          ...insufficientSell,
          portfolioId,
          instrumentId,
          version: 3,
        })),
        (error) => error.code === "P0001" && error.message === "LEDGER_INSUFFICIENT_POSITION",
      );
      assert.deepEqual(await snapshotLedger(admin, portfolioId), afterSellRace);
    } finally {
      await contenderA.end().catch(() => undefined);
      await contenderB.end().catch(() => undefined);
      try {
        await cleanBootstrap(admin);
      } finally {
        await admin.query(fixtureUnlockSql);
        await admin.end();
      }
    }
  },
);
