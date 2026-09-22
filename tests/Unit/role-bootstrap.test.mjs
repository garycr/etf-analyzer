import assert from "node:assert/strict";
import test from "node:test";

import { applyDenialVerifierRoleUpgrade } from "../../dist/Infrastructure/PostgreSQL/denial-verifier-role-upgrade.js";
import {
  createRoleBootstrapSql,
  productRoles,
  roleMemberships,
} from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const expectedOwnerRoles = [
  "schema_owner",
  "migration_owner",
  "application_writer_owner",
  "ledger_writer_owner",
  "projection_owner",
  "audit_writer_owner",
  "audit_activity_verifier_owner",
  "anchor_owner",
  "evidence_writer_owner",
];

const expectedLoginRoles = [
  "deployment_login",
  "migration_executor",
  "app_runtime",
  "projection_runtime",
  "audit_runtime",
  "key_injector",
];

test("role bootstrap defines the exact fifteen product roles", () => {
  assert.deepEqual(
    productRoles.filter(({ login }) => !login).map(({ name }) => name),
    expectedOwnerRoles,
  );
  assert.deepEqual(
    productRoles.filter(({ login }) => login).map(({ name }) => name),
    expectedLoginRoles,
  );
  assert.equal(productRoles.length, 15);
});

test("role bootstrap defines the exact eleven authority memberships", () => {
  assert.deepEqual(roleMemberships, [
    { role: "migration_executor", member: "deployment_login", admin: false, inherit: false, set: true },
    { role: "migration_owner", member: "migration_executor", admin: false, inherit: false, set: true },
    { role: "anchor_owner", member: "migration_owner", admin: false, inherit: false, set: true },
    { role: "application_writer_owner", member: "migration_owner", admin: false, inherit: false, set: true },
    { role: "audit_activity_verifier_owner", member: "migration_owner", admin: false, inherit: false, set: true },
    { role: "audit_writer_owner", member: "migration_owner", admin: false, inherit: false, set: true },
    { role: "evidence_writer_owner", member: "migration_owner", admin: false, inherit: false, set: true },
    { role: "ledger_writer_owner", member: "migration_owner", admin: false, inherit: false, set: true },
    { role: "projection_owner", member: "migration_owner", admin: false, inherit: false, set: true },
    { role: "schema_owner", member: "migration_owner", admin: false, inherit: false, set: true },
    { role: "pg_read_all_stats", member: "audit_activity_verifier_owner", admin: false, inherit: true, set: false },
  ]);
});

test("role bootstrap SQL is transactional and denies elevated attributes", () => {
  const sql = createRoleBootstrapSql();

  assert.match(sql, /^BEGIN;\n/);
  assert.match(sql, /COMMIT;\n$/);
  assert.match(
    sql,
    /CREATE EXTENSION IF NOT EXISTS pgcrypto VERSION '1.3';/,
  );
  assert.ok(
    sql.indexOf("CREATE EXTENSION") < sql.indexOf("CREATE ROLE"),
    "pgcrypto must be provisioned before product role lockdown",
  );
  assert.match(
    sql,
    /REVOKE CONNECT, TEMPORARY ON DATABASE %I FROM PUBLIC/,
  );
  assert.match(
    sql,
    /GRANT CONNECT ON DATABASE %I TO deployment_login, migration_executor, app_runtime, projection_runtime, audit_runtime, key_injector/,
  );
  assert.equal(
    (sql.match(/CREATE SCHEMA etf AUTHORIZATION schema_owner;/gu) ?? []).length,
    1,
  );
  assert.doesNotMatch(sql, /CREATE TABLE|CREATE FUNCTION|CREATE VIEW/iu);
  assert.equal((sql.match(/CREATE ROLE/gu) ?? []).length, 15);
  assert.equal((sql.match(/NOSUPERUSER/gu) ?? []).length, 15);
  assert.equal((sql.match(/NOCREATEROLE/gu) ?? []).length, 15);
  assert.equal((sql.match(/NOCREATEDB/gu) ?? []).length, 15);
  assert.equal((sql.match(/NOREPLICATION/gu) ?? []).length, 15);
  assert.equal((sql.match(/NOBYPASSRLS/gu) ?? []).length, 15);
  assert.equal(
    (sql.match(/WITH ADMIN FALSE, INHERIT FALSE, SET TRUE/gu) ?? []).length,
    10,
  );
  assert.match(
    sql,
    /GRANT pg_read_all_stats TO audit_activity_verifier_owner WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;/,
  );
});

test("denial verifier role upgrade rejects noncanonical metadata before querying", async () => {
  let queryCount = 0;
  await assert.rejects(() => applyDenialVerifierRoleUpgrade({
    query: async () => {
      queryCount += 1;
      return { rows: [] };
    },
  }, {
    migrations: [
      "0001-foundation",
      "0002-application",
      "0003-domain-ledger",
      "0004-fixtures",
      "0005-analytics-evidence",
      "0006-controlled-access",
    ].map((migrationId, index) => ({
      sequence: index + 1,
      migrationId,
      contentHash: String(index + 1).repeat(64),
    })),
    controlledAccessManifestHash: "not-a-hash",
  }), /canonical sequence-6 ledger/u);
  assert.equal(queryCount, 0);
});
