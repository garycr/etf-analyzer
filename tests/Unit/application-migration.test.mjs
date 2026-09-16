import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  applicationFunctionNames,
  applicationMigration,
  applicationTableNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";

test("0002 application has the exact identity and closed table set", () => {
  assert.equal(applicationMigration.sequence, 2);
  assert.equal(applicationMigration.migrationId, "0002-application");
  assert.deepEqual(applicationTableNames, [
    "application_replays",
    "watchlist_state",
    "watchlist_items",
    "jobs",
    "job_checkpoints",
    "readiness_audit",
  ]);
  assert.deepEqual(applicationFunctionNames, [
    "application_replay_get_or_put",
    "watchlist_write",
    "job_start",
    "job_restart",
    "readiness_append",
  ]);
  assert.equal(
    createHash("sha256").update(applicationMigration.sql, "utf8").digest("hex"),
    "ad458453834e72413f644e81e38829ae491a26a44f1ca03deeaf71349552c198",
  );
});

test("0002 application creates only application-writer-owned tables", () => {
  const { sql } = applicationMigration;

  assert.match(sql, /^SET LOCAL ROLE schema_owner;\n/);
  assert.match(
    sql,
    /GRANT USAGE, CREATE ON SCHEMA etf TO application_writer_owner;/,
  );
  assert.match(sql, /SET LOCAL ROLE application_writer_owner;/);
  assert.equal((sql.match(/CREATE TABLE etf\./gu) ?? []).length, 6);
  for (const tableName of applicationTableNames) {
    assert.match(sql, new RegExp(`CREATE TABLE etf\\.${tableName} \\(`));
  }
  assert.match(
    sql,
    /REVOKE CREATE ON SCHEMA etf FROM application_writer_owner;/,
  );
  assert.doesNotMatch(
    sql,
    /REVOKE USAGE(?:, CREATE)? ON SCHEMA etf FROM application_writer_owner;/,
  );
  assert.doesNotMatch(sql, /CREATE\s+(?:VIEW|TRIGGER|EXTENSION)/iu);
  assert.doesNotMatch(sql, /\b(?:outbox|queue|scheduler|event)\b/iu);
});

test("0002 application creates the exact deny-by-default controlled functions", () => {
  const { sql } = applicationMigration;

  assert.equal((sql.match(/CREATE FUNCTION etf\./gu) ?? []).length, 5);
  for (const functionName of applicationFunctionNames) {
    assert.match(sql, new RegExp(`CREATE FUNCTION etf\\.${functionName}\\(`));
  }
  assert.equal((sql.match(/SECURITY DEFINER/gu) ?? []).length, 5);
  assert.equal((sql.match(/VOLATILE/gu) ?? []).length, 5);
  assert.equal((sql.match(/PARALLEL UNSAFE/gu) ?? []).length, 5);
  assert.equal((sql.match(/SET search_path = pg_catalog, etf/gu) ?? []).length, 5);
  assert.equal((sql.match(/REVOKE ALL ON FUNCTION etf\./gu) ?? []).length, 5);
});

test("0002 application enforces replay, job, checkpoint, and readiness invariants", () => {
  const { sql } = applicationMigration;

  assert.match(sql, /PRIMARY KEY \(operation, command_id\)/);
  assert.match(sql, /CREATE TABLE etf\.watchlist_state/);
  assert.match(
    sql,
    /INSERT INTO etf\.watchlist_state \(singleton, version\) VALUES \(true, 0\)/,
  );
  assert.match(sql, /FROM etf\.watchlist_state\s+WHERE singleton\s+FOR UPDATE/);
  assert.match(sql, /CHECK \(validation_state IN \('Valid', 'Invalid'\)\)/);
  assert.match(sql, /UNIQUE \(position\)/);
  assert.match(sql, /CHECK \(attempt >= 1\)/);
  assert.match(sql, /CHECK \(accepted_count >= 0\)/);
  assert.match(sql, /CHECK \(rejected_count >= 0\)/);
  assert.match(sql, /UNIQUE \(job_id, attempt, sequence\)/);
  assert.match(
    sql,
    /FOREIGN KEY \(job_id\) REFERENCES etf\.jobs \(job_id\) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE/,
  );
  assert.match(sql, /CHECK \(content_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(sql, /CHECK \(state IN \('Ready', 'NotReady'\)\)/);
  assert.match(sql, /CHECK \(liveness IN \('Live', 'NotLive'\)\)/);
  assert.match(sql, /CHECK \(display_timezone = 'UTC'\)/);
});
