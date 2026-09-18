import assert from "node:assert/strict";
import test from "node:test";

import {
  domainLedgerFunctionNames,
  domainLedgerMigration,
  domainLedgerTableNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";

test("0003 domain ledger has the exact identity and closed object set", () => {
  assert.equal(domainLedgerMigration.sequence, 3);
  assert.equal(domainLedgerMigration.migrationId, "0003-domain-ledger");
  assert.deepEqual(domainLedgerTableNames, [
    "paper_orders",
    "order_transitions",
    "order_command_replays",
    "portfolios",
    "fills",
    "order_audit",
    "access_denial_audit",
    "ledger_transactions",
    "ledger_effects",
    "ledger_lots",
    "ledger_allocations",
    "ledger_reversal_links",
    "ledger_command_replays",
    "ledger_audit",
    "ledger_commitments",
    "audit_commitments",
    "ledger_anchors",
    "portfolio_projections",
  ]);
  assert.deepEqual(domainLedgerFunctionNames, [
    "paper_order_transition",
    "ledger_append",
    "projection_publish",
    "audit_append",
    "anchor_append",
    "anchor_key_inject",
  ]);
});

test("0003 domain ledger assigns every object to its closed owner", () => {
  const { sql } = domainLedgerMigration;

  assert.equal((sql.match(/CREATE TABLE etf\./gu) ?? []).length, 18);
  assert.equal((sql.match(/CREATE FUNCTION etf\./gu) ?? []).length, 6);
  for (const tableName of domainLedgerTableNames) {
    assert.match(sql, new RegExp(`CREATE TABLE etf\\.${tableName} \\(`));
  }
  for (const functionName of domainLedgerFunctionNames) {
    assert.match(sql, new RegExp(`CREATE FUNCTION etf\\.${functionName}\\(`));
  }

  for (const owner of [
    "application_writer_owner",
    "ledger_writer_owner",
    "projection_owner",
    "audit_writer_owner",
    "anchor_owner",
  ]) {
    assert.match(sql, new RegExp(`SET LOCAL ROLE ${owner};`));
    assert.match(sql, new RegExp(`REVOKE CREATE ON SCHEMA etf FROM ${owner};`));
    assert.doesNotMatch(
      sql,
      new RegExp(`REVOKE USAGE(?:, CREATE)? ON SCHEMA etf FROM ${owner};`),
    );
  }
});

test("0003 domain ledger hardens every controlled function", () => {
  const { sql } = domainLedgerMigration;

  assert.equal((sql.match(/SECURITY DEFINER/gu) ?? []).length, 6);
  assert.equal((sql.match(/VOLATILE/gu) ?? []).length, 6);
  assert.equal((sql.match(/PARALLEL UNSAFE/gu) ?? []).length, 6);
  assert.equal((sql.match(/SET search_path = pg_catalog, etf/gu) ?? []).length, 6);
  assert.equal((sql.match(/REVOKE ALL ON FUNCTION etf\./gu) ?? []).length, 6);
  assert.doesNotMatch(sql, /CREATE\s+(?:VIEW|TRIGGER|EXTENSION)/iu);
  assert.doesNotMatch(sql, /\b(?:outbox|queue|scheduler|event)\b/iu);
});

test("0003 paper order quantities distinguish fillable and terminal states", () => {
  const { sql } = domainLedgerMigration;

  assert.match(sql, /WHEN state IN \('Draft','Submitted','Accepted'\) THEN filled_quantity = 0 AND open_quantity = requested_quantity/u);
  assert.match(sql, /WHEN state = 'Partial' THEN filled_quantity > 0 AND open_quantity > 0 AND requested_quantity = filled_quantity \+ open_quantity/u);
  assert.match(sql, /WHEN state = 'Filled' THEN filled_quantity = requested_quantity AND open_quantity = 0/u);
  assert.match(sql, /WHEN state IN \('Rejected','Expired'\) THEN filled_quantity = 0 AND open_quantity = 0/u);
  assert.match(sql, /WHEN state = 'Canceled' THEN filled_quantity < requested_quantity AND open_quantity = 0/u);
  assert.match(sql, /transition_name IN \('OT-04','OT-07','OT-08','OT-10'\) THEN 0/u);
});

test("0003 domain ledger grants only the nested owner call graph and authoritative order read", () => {
  const { sql } = domainLedgerMigration;

  assert.match(
    sql,
    /GRANT SELECT \(order_id, instrument_id, side, aggregate_version\) ON etf\.paper_orders TO ledger_writer_owner;/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION etf\.ledger_append\(jsonb\) TO application_writer_owner;/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION etf\.audit_append\(jsonb\) TO audit_runtime, application_writer_owner, ledger_writer_owner, projection_owner;/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION etf\.anchor_append\(jsonb\) TO ledger_writer_owner, audit_writer_owner, projection_owner;/,
  );
  assert.match(sql, /GRANT SELECT \(portfolio_id, effect_type, instrument_id, lot_id, quantity, money\) ON etf\.ledger_effects TO projection_owner;/);
  assert.match(sql, /GRANT SELECT \(portfolio_id, lot_id, instrument_id\) ON etf\.ledger_lots TO projection_owner;/);
  assert.match(sql, /GRANT SELECT \(portfolio_id, sell_transaction_id, effect_ordinal, lot_id, consumed_quantity, allocated_basis\) ON etf\.ledger_allocations TO projection_owner;/);
  assert.match(sql, /GRANT SELECT \(portfolio_id, portfolio_version, precision_policy_version, baseline_version\) ON etf\.portfolios TO projection_owner;/);
  assert.doesNotMatch(sql, /GRANT SELECT ON etf\.paper_orders/);
  assert.doesNotMatch(
    sql,
    /SELECT order_id,instrument_id,side,aggregate_version INTO order_record FROM etf\.paper_orders[^;]+FOR UPDATE/,
  );
  assert.equal(
    (sql.match(/pg_advisory_xact_lock\(pg_catalog\.hashtextextended\('etf:paper-order:'/gu) ?? []).length,
    2,
  );
  assert.equal(
    (sql.match(/pg_advisory_xact_lock\(pg_catalog\.hashtextextended\('etf:portfolio:'/gu) ?? []).length,
    2,
  );
  assert.doesNotMatch(sql, /GRANT SELECT ON etf\.ledger_commitments/);
  assert.doesNotMatch(sql, /GRANT SELECT ON etf\.portfolio_anchor_checkpoints/);
});

test("0003 domain ledger keeps every foreign key immediate", () => {
  const { sql } = domainLedgerMigration;
  const foreignKeys = sql
    .split("\n")
    .filter((line) => line.includes("FOREIGN KEY"));

  assert.ok(foreignKeys.length > 0);
  assert.ok(
    foreignKeys.every((foreignKey) =>
      /NOT DEFERRABLE[,;]?$/u.test(foreignKey),
    ),
  );
  assert.doesNotMatch(sql, /DEFERRABLE INITIALLY DEFERRED/);
});

test("0003 domain ledger fixes canonical evidence and audit chain schema", () => {
  const { sql } = domainLedgerMigration;

  assert.match(
    sql,
    /ck_ledger_audit__evidence_hashes_lower_hex CHECK \(\(transaction_evidence_hash IS NULL OR transaction_evidence_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/,
  );
  assert.match(sql, /"keyIdentifier":%s,"previousAuditCommitment":%s/);
  assert.match(sql, /FROM jsonb_to_recordset\(intended_allocations\)/);
  assert.match(
    sql,
    /SELECT '\[' \|\| COALESCE\(pg_catalog\.string_agg\([\s\S]*\), ''\) \|\| '\]'[\s\S]*FROM jsonb_to_recordset\(intended_allocations\)/,
  );
  assert.match(sql, /LEDGER_INSUFFICIENT_POSITION/);
  assert.doesNotMatch(sql, /LEDGER_INSUFFICIENT_QUANTITY/);
  assert.doesNotMatch(
    sql,
    /digest\(convert_to\(payload ->> 'canonicalContent','UTF8'\),'sha256'\)/,
  );
  assert.doesNotMatch(sql, /\(payload - 'keyIdentifier'\)::text/);
  assert.match(sql, /digest\(convert_to\(audit_content,'UTF8'\),'sha256'\)/);
  assert.doesNotMatch(sql, /UPDATE etf\.ledger_transactions SET evidence_hash/);
  assert.doesNotMatch(sql, /repeat\('0',64\)/);
  assert.doesNotMatch(sql, /DEFERRABLE INITIALLY DEFERRED/);

  const fillInsert = sql.indexOf("INSERT INTO etf.fills VALUES");
  const allocationHash = sql.indexOf("allocation_hash:=encode");
  const transactionInsert = sql.indexOf("INSERT INTO etf.ledger_transactions VALUES");
  const effectInsert = sql.indexOf("INSERT INTO etf.ledger_effects (");
  const lotInsert = sql.indexOf("INSERT INTO etf.ledger_lots VALUES");
  const allocationInsert = sql.indexOf("INSERT INTO etf.ledger_allocations (");
  const reversalLinkInsert = sql.indexOf("THEN INSERT INTO etf.ledger_reversal_links VALUES");

  assert.ok(fillInsert < allocationHash);
  assert.ok(allocationHash < transactionInsert);
  assert.ok(transactionInsert < effectInsert);
  assert.ok(effectInsert < lotInsert);
  assert.ok(lotInsert < allocationInsert);
  assert.ok(allocationInsert < reversalLinkInsert);
});
