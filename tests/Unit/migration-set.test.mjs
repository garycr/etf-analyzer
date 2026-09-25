import assert from "node:assert/strict";
import test from "node:test";

import {
  expectedMigrationIds,
  isDurableHandoffObjectName,
  prepareMigrationSet,
} from "../../dist/Infrastructure/PostgreSQL/migration-set.js";

const migrationSql = expectedMigrationIds.map(
  (migrationId, index) =>
    `CREATE TABLE etf.table_${index + 1} (id bigint PRIMARY KEY);\n`,
);
const prohibitedObjectNames = [
  "outbox",
  "eventoutbox",
  "domain_event_log",
  "workqueue",
  "queue_items",
  "scheduler",
  "nightly_schedule",
  "lease",
  "processing_lease_rows",
  "workerinbox",
  "worker_inbox_items",
  "notificationbox",
  "user_notifications",
  "delayedconsumer",
  "delayed_consumer_state",
];

test("migration preflight publishes ordered exact-byte hashes", () => {
  assert.deepEqual(expectedMigrationIds, [
    "0001-foundation",
    "0002-application",
    "0003-domain-ledger",
    "0004-fixtures",
    "0005-analytics-evidence",
    "0006-controlled-access",
    "0007-denial-backend-verifier",
    "0008-runtime-queries",
  ]);
  const prepared = prepareMigrationSet(
    expectedMigrationIds.map((migrationId, index) => ({
      migrationId,
      sequence: index + 1,
      sql: migrationSql[index],
    })),
  );

  assert.deepEqual(
    prepared.map(({ migrationId, sequence }) => ({ migrationId, sequence })),
    expectedMigrationIds.map((migrationId, index) => ({
      migrationId,
      sequence: index + 1,
    })),
  );
  assert.match(prepared[0].contentHash, /^[0-9a-f]{64}$/);
  assert.equal(prepareMigrationSet(prepared.map(({ contentHash: _, ...item }) => item))[0].contentHash, prepared[0].contentHash);
});

test("migration preflight rejects a missing migration set", () => {
  assert.throws(() => prepareMigrationSet([]), /migration set must contain exactly 8 artifacts/);
});

test("migration preflight rejects reordered identities", () => {
  assert.throws(
    () =>
      prepareMigrationSet(
        expectedMigrationIds.map((migrationId, index) => ({
          migrationId,
          sequence: index + 1,
          sql: migrationSql.at(-(index + 1)),
        })).reverse(),
      ),
    /migration 1 must be 0001-foundation/,
  );
});

test("migration preflight rejects a wrong sequence", () => {
  const wrongSequence = expectedMigrationIds.map((migrationId, index) => ({
    migrationId,
    sequence: index + 1,
    sql: migrationSql[index],
  }));
  wrongSequence[5].sequence = 7;
  assert.throws(
    () => prepareMigrationSet(wrongSequence),
    /migration 6 must be 0006-controlled-access/,
  );
});

test("migration preflight rejects extensions and durable handoff objects", () => {
  for (const prohibitedIndex of expectedMigrationIds.keys()) {
    for (const [prohibitedSql, expectedError] of [
      ["CREATE EXTENSION pgcrypto;\n", /CT-DB-001A prohibits product-created extensions/],
      ["CREATE TABLE etf.event_outbox (id bigint);\n", /CT-DB-001L prohibits durable handoff objects/],
    ]) {
      const artifacts = expectedMigrationIds.map((migrationId, index) => ({
        migrationId,
        sequence: index + 1,
        sql: index === prohibitedIndex ? prohibitedSql : migrationSql[index],
      }));

      assert.throws(() => prepareMigrationSet(artifacts), expectedError);
    }
  }
  for (const [prefix, objectName, suffix] of [
    ["CREATE TABLE etf.", prohibitedObjectNames[0], " (id bigint);"],
    ["CREATE OR REPLACE FUNCTION etf.", prohibitedObjectNames[1], "() RETURNS void LANGUAGE sql AS 'SELECT';"],
    ["CREATE TRIGGER ", prohibitedObjectNames[2], " BEFORE INSERT ON etf.table_1 EXECUTE FUNCTION etf.fn();"],
    ["CREATE UNIQUE INDEX ", prohibitedObjectNames[3], " ON etf.table_1 (id);"],
    ["CREATE VIEW etf.", prohibitedObjectNames[4], " AS SELECT 1;"],
  ]) {
    assert.throws(
      () => prepareMigrationSet(expectedMigrationIds.map((migrationId, index) => ({
        migrationId,
        sequence: index + 1,
        sql: index === 0 ? `${prefix}${objectName}${suffix}\n` : migrationSql[index],
      }))),
      /CT-DB-001L prohibits durable handoff objects/,
    );
  }
  for (const objectName of prohibitedObjectNames) {
    assert.throws(
      () => prepareMigrationSet(expectedMigrationIds.map((migrationId, index) => ({
        migrationId,
        sequence: index + 1,
        sql: index === 0
          ? `CREATE TABLE etf.${objectName} (id bigint);\n`
          : migrationSql[index],
      }))),
      /CT-DB-001L prohibits durable handoff objects/,
      objectName,
    );
  }
});

test("CT-DB-001L classifies durable handoff object names without contract confounders", () => {
  for (const objectName of prohibitedObjectNames) {
    assert.equal(isDurableHandoffObjectName(objectName), true, objectName);
  }
  for (const objectName of [
    "analytics_lifecycle_references",
    "ix_economic_observations__release_timestamp",
    "order_transitions",
    "fixture_ingestion_replays",
  ]) {
    assert.equal(isDurableHandoffObjectName(objectName), false, objectName);
  }
});

test("migration preflight permits contract lifecycle event fields", () => {
  const artifacts = expectedMigrationIds.map((migrationId, index) => ({
    migrationId,
    sequence: index + 1,
    sql:
      index === 4
        ? "CREATE TABLE etf.analytics_lifecycle_references (event_at timestamptz, event_hash char(64));\n"
        : migrationSql[index],
  }));

  assert.doesNotThrow(() => prepareMigrationSet(artifacts));
});

test("migration preflight permits contract release timestamp indexes", () => {
  const artifacts = expectedMigrationIds.map((migrationId, index) => ({
    migrationId,
    sequence: index + 1,
    sql:
      index === 3
        ? "CREATE INDEX ix_economic_observations__release_timestamp ON etf.economic_observations (release_timestamp);\n"
        : migrationSql[index],
  }));

  assert.doesNotThrow(() => prepareMigrationSet(artifacts));
});
