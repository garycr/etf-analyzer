import assert from "node:assert/strict";
import test from "node:test";

import {
  foundationMigration,
  foundationTableNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";

test("0001 foundation has the exact identity and closed object set", () => {
  assert.equal(foundationMigration.sequence, 1);
  assert.equal(foundationMigration.migrationId, "0001-foundation");
  assert.deepEqual(foundationTableNames, [
    "schema_migrations",
    "anchor_keys",
    "portfolio_anchor_checkpoints",
    "audit_anchor_checkpoints",
  ]);
});

test("0001 foundation SQL creates only contract-owned foundation tables", () => {
  const { sql } = foundationMigration;

  assert.doesNotMatch(sql, /CREATE SCHEMA/iu);
  assert.match(sql, /^SET LOCAL ROLE schema_owner;\n/);
  assert.match(
    sql,
    /GRANT USAGE, CREATE ON SCHEMA etf TO migration_owner;/,
  );
  assert.match(sql, /GRANT USAGE, CREATE ON SCHEMA etf TO anchor_owner;/);
  assert.doesNotMatch(sql, /CREATE\s+EXTENSION/iu);
  assert.equal((sql.match(/CREATE TABLE etf\./gu) ?? []).length, 4);
  for (const tableName of foundationTableNames) {
    assert.match(sql, new RegExp(`CREATE TABLE etf\\.${tableName} \\(`));
  }
  assert.doesNotMatch(sql, /ALTER TABLE/iu);
  assert.match(sql, /SET LOCAL ROLE migration_owner;\n\nCREATE TABLE etf\.schema_migrations/);
  assert.match(sql, /SET LOCAL ROLE anchor_owner;\n\nCREATE TABLE etf\.anchor_keys/);
  assert.match(sql, /REVOKE USAGE, CREATE ON SCHEMA etf FROM anchor_owner;/);
});

test("0001 foundation SQL enforces positive sequences and lowercase hashes", () => {
  const { sql } = foundationMigration;

  assert.match(sql, /CHECK \(sequence > 0\)/);
  assert.equal(
    (sql.match(/CHECK \([^\n]+ ~ '\^\[0-9a-f\]\{64\}\$'\)/gu) ?? []).length,
    7,
  );
  assert.doesNotMatch(sql, /\b(?:outbox|queue|scheduler|event)\b/iu);
});
