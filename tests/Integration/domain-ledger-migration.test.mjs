import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

import pg from "pg";

import { canonicalizeJson } from "../../dist/Infrastructure/CanonicalJson/canonical-json.js";
import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import { applicationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import {
  domainLedgerFunctionNames,
  domainLedgerMigration,
  domainLedgerTableNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
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
            (SELECT count(*)::integer FROM etf.ledger_allocations WHERE portfolio_id = $1::uuid) AS allocations,
            (SELECT count(*)::integer FROM etf.ledger_reversal_links WHERE portfolio_id = $1::uuid) AS reversal_links,
            (SELECT count(*)::integer FROM etf.fills WHERE portfolio_id = $1::uuid) AS fills,
            (SELECT count(*)::integer FROM etf.ledger_command_replays WHERE portfolio_id = $1::uuid) AS command_replays,
            (SELECT count(*)::integer FROM etf.ledger_audit WHERE portfolio_id = $1::uuid) AS audits,
            (SELECT count(*)::integer FROM etf.ledger_commitments WHERE portfolio_id = $1::uuid) AS commitments,
            (SELECT count(*)::integer FROM etf.ledger_anchors WHERE portfolio_id = $1::uuid) AS anchors,
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

function cashDeposit({ portfolioId, transactionId, correlationId, version, effectiveAt }) {
  return {
    correlationId,
    effectiveAt,
    expectedPortfolioVersion: version,
    keyIdentifier: "primary",
    portfolioId,
    transactionId,
    type: "CashDeposit",
    amount: "100.00000000",
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
}) {
  return {
    correlationId,
    effectiveAt,
    expectedOrderVersion: 1,
    expectedPortfolioVersion: version,
    fee: "0.00000000",
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
        "d514c7f3b75c6ed83dfdbd9b54b406b14814b2bf8f40bd1e04a9d70a303346a3",
      );
      assert.equal(
        applied.schemaManifestHash,
        "e0b21def5e9e2822142821f0fec70bd0d06593ee4f62496b1b2b29eabce6b3ac",
      );
      assert.equal(Buffer.byteLength(manifestJson, "utf8"), 14194);
      assert.equal(manifest.migrationSequence.length, 3);
      assert.equal(manifest.objects.filter(({ kind }) => kind === "table").length, 28);
      assert.equal(manifest.objects.filter(({ kind }) => kind === "function").length, 11);
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
        unitPrice: "3.3333333333",
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
