import assert from "node:assert/strict";
import test from "node:test";

import {
  denialBackendVerifierFunctionNames,
  denialBackendVerifierMigration,
} from "../../dist/Infrastructure/PostgreSQL/migrations/denial-backend-verifier.js";

test("0007 denial backend verifier has the exact additive identity", () => {
  assert.equal(denialBackendVerifierMigration.sequence, 7);
  assert.equal(
    denialBackendVerifierMigration.migrationId,
    "0007-denial-backend-verifier",
  );
  assert.deepEqual(denialBackendVerifierFunctionNames, [
    "denial_backend_matches",
  ]);
  assert.doesNotMatch(
    denialBackendVerifierMigration.sql,
    /CREATE TABLE|CREATE VIEW|CREATE EXTENSION/iu,
  );
});

test("0007 contains statistics authority behind one boolean helper", () => {
  const { sql } = denialBackendVerifierMigration;

  assert.match(
    sql,
    /CREATE FUNCTION etf\.denial_backend_matches\(requested_pid integer, requested_backend_start timestamp with time zone, requested_session_user text, requested_application_name text\) RETURNS boolean/u,
  );
  assert.match(sql, /LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER/u);
  assert.match(sql, /SET search_path = pg_catalog/u);
  assert.match(sql, /pg_catalog\.pg_stat_clear_snapshot\(\)/u);
  assert.match(sql, /FROM pg_catalog\.pg_stat_activity/u);
  assert.match(sql, /REVOKE ALL ON FUNCTION etf\.denial_backend_matches\(integer, timestamp with time zone, text, text\) FROM PUBLIC/u);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION etf\.denial_backend_matches\(integer, timestamp with time zone, text, text\) TO audit_writer_owner/u);
  assert.doesNotMatch(sql, /GRANT pg_read_all_stats TO audit_writer_owner/iu);
});

test("0007 uses temporary schema create authority and replaces only denial correlation", () => {
  const { sql } = denialBackendVerifierMigration;

  assert.match(
    sql,
    /GRANT USAGE, CREATE ON SCHEMA etf TO audit_activity_verifier_owner;\nGRANT CREATE ON SCHEMA etf TO audit_writer_owner/u,
  );
  assert.match(
    sql,
    /REVOKE USAGE, CREATE ON SCHEMA etf FROM audit_activity_verifier_owner/u,
  );
  assert.match(sql, /REVOKE CREATE ON SCHEMA etf FROM audit_writer_owner/u);
  assert.match(sql, /CREATE OR REPLACE FUNCTION etf\.audit_append\(payload jsonb\)/u);
  assert.match(
    sql,
    /etf\.denial_backend_matches\(\(subject ->> 'originalBackendPid'\)::integer, \(subject ->> 'backendStart'\)::timestamp with time zone, subject ->> 'originalSessionUser', 'etf-denial:' \|\| \(subject ->> 'denialNonce'\)\)/u,
  );
  assert.doesNotMatch(sql, /IF NOT EXISTS \(SELECT 1 FROM pg_catalog\.pg_stat_activity/iu);
  assert.match(sql, /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(pg_catalog\.jsonb_build_array\('etf:denial-dedup'/u);
  assert.match(sql, /extract\(epoch FROM \(subject ->> 'backendStart'\)::timestamp\(3\) with time zone\) \* 1000\)::bigint/u);
  assert.match(sql, /replay_audit_id uuid/u);
  assert.match(sql, /SELECT denial\.audit_id, denial\.content_hash, commitment\.audit_sequence/u);
  assert.match(sql, /replay_evidence <> evidence/u);
  assert.match(sql, /RAISE EXCEPTION 'ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED' USING ERRCODE = '55000'/u);
  assert.match(sql, /REVOKE ALL ON FUNCTION etf\.audit_append\(jsonb\) FROM PUBLIC/u);
});
