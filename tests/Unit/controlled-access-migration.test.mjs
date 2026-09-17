import assert from "node:assert/strict";
import test from "node:test";

import {
  controlledAccessFunctionNames,
  controlledAccessImmutableTableNames,
  controlledAccessMigration,
  controlledAccessViewNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/controlled-access.js";

test("0006 controlled access has the exact identity and closed object set", () => {
  assert.equal(controlledAccessMigration.sequence, 6);
  assert.equal(controlledAccessMigration.migrationId, "0006-controlled-access");
  assert.deepEqual(controlledAccessFunctionNames, [
    "reject_immutable_change",
    "application_replay_get",
    "job_get",
    "paper_order_command_get",
    "paper_order_get",
    "portfolio_get",
  ]);
  assert.deepEqual(controlledAccessViewNames, [
    "current_watchlist",
    "current_jobs",
    "current_paper_orders",
    "current_portfolios",
    "current_analytics_publications",
  ]);
  assert.deepEqual(controlledAccessImmutableTableNames, [
    "anchor_keys",
    "audit_anchor_checkpoints",
    "application_replays",
    "job_checkpoints",
    "readiness_audit",
    "order_transitions",
    "order_command_replays",
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
    "fixture_packages",
    "fixture_descriptors",
    "fixture_raw_sources",
    "market_observations",
    "economic_observations",
    "fixture_ingestion_replays",
    "analytics_input_sets",
    "analytics_evidence_bundles",
    "analytics_manifests",
    "analytics_lifecycle_references",
    "analytics_deletion_links",
    "analytics_retention_bindings",
    "analytics_evidence_replays",
    "analytics_audit",
  ]);
});

test("0006 installs exact immutable statement guards", () => {
  const { sql } = controlledAccessMigration;

  assert.equal((sql.match(/CREATE TRIGGER trg_/gu) ?? []).length, 102);
  for (const tableName of controlledAccessImmutableTableNames) {
    for (const event of ["update", "delete", "truncate"]) {
      assert.match(
        sql,
        new RegExp(`CREATE TRIGGER trg_${tableName}__reject_${event}\\nBEFORE ${event.toUpperCase()} ON etf\\.${tableName}\\nFOR EACH STATEMENT EXECUTE FUNCTION etf\\.reject_immutable_change\\(\\);`, "u"),
      );
    }
  }
  assert.match(sql, /RAISE EXCEPTION 'IMMUTABLE_RELATION_CHANGE_REJECTED' USING ERRCODE = '55000'/u);
});

test("0006 closes the read and authority surface without new storage", () => {
  const { sql } = controlledAccessMigration;

  assert.doesNotMatch(sql, /CREATE TABLE|CREATE EXTENSION|EXECUTE\s+format|EXECUTE\s+query/iu);
  assert.equal((sql.match(/CREATE VIEW etf\./gu) ?? []).length, 5);
  assert.equal((sql.match(/WITH \(security_barrier = true\)/gu) ?? []).length, 5);
  assert.match(sql, /CREATE FUNCTION etf\.application_replay_get\(\s+requested_operation text,\s+requested_command_id uuid,\s+requested_canonical_content text\s+\) RETURNS jsonb/u);
  assert.match(sql, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(/u);
  assert.match(sql, /CREATE FUNCTION etf\.job_get\(requested_job_id uuid\) RETURNS jsonb/u);
  assert.match(sql, /CREATE FUNCTION etf\.paper_order_get\(requested_order_id uuid\) RETURNS jsonb/u);
  assert.match(sql, /CREATE FUNCTION etf\.paper_order_command_get\(requested_order_id uuid, requested_transition_command_id uuid\) RETURNS jsonb/u);
  assert.match(sql, /CREATE FUNCTION etf\.portfolio_get\(requested_portfolio_id uuid, requested_as_of timestamp with time zone\) RETURNS jsonb/u);
  assert.match(sql, /GRANT SELECT \(portfolio_id, portfolio_version, baseline_version, precision_policy_version\) ON etf\.portfolios TO projection_owner/u);
  assert.match(sql, /JOIN etf\.ledger_commitments AS commitment/u);
  assert.match(sql, /JOIN etf\.ledger_anchors AS anchor_record/u);
  assert.equal((sql.match(/LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER/gu) ?? []).length, 4);
  assert.match(sql, /GRANT SELECT ON etf\.current_watchlist, etf\.current_jobs, etf\.current_paper_orders, etf\.current_portfolios, etf\.current_analytics_publications TO app_runtime/u);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION etf\.paper_order_transition\(jsonb\) TO app_runtime/u);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION etf\.application_replay_get\(text, uuid, text\), etf\.application_replay_get_or_put\(text, uuid, text, text\) TO app_runtime/u);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION etf\.job_get\(uuid\), etf\.paper_order_get\(uuid\), etf\.paper_order_command_get\(uuid, uuid\) TO app_runtime/u);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION etf\.portfolio_get\(uuid, timestamp with time zone\) TO app_runtime/u);
  assert.match(sql, /REVOKE ALL ON FUNCTION etf\.job_get\(uuid\) FROM PUBLIC/u);
  assert.match(sql, /REVOKE ALL ON FUNCTION etf\.application_replay_get\(text, uuid, text\) FROM PUBLIC/u);
  assert.match(sql, /REVOKE ALL ON FUNCTION etf\.paper_order_get\(uuid\) FROM PUBLIC/u);
  assert.match(sql, /REVOKE ALL ON FUNCTION etf\.portfolio_get\(uuid, timestamp with time zone\) FROM PUBLIC/u);
});
