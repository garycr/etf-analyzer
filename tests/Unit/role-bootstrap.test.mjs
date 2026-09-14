import assert from "node:assert/strict";
import test from "node:test";

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

test("role bootstrap defines the exact fourteen product roles", () => {
  assert.deepEqual(
    productRoles.filter(({ login }) => !login).map(({ name }) => name),
    expectedOwnerRoles,
  );
  assert.deepEqual(
    productRoles.filter(({ login }) => login).map(({ name }) => name),
    expectedLoginRoles,
  );
  assert.equal(productRoles.length, 14);
});

test("role bootstrap defines the exact nine set-only memberships", () => {
  assert.deepEqual(roleMemberships, [
    { role: "migration_executor", member: "deployment_login" },
    { role: "migration_owner", member: "migration_executor" },
    { role: "anchor_owner", member: "migration_owner" },
    { role: "application_writer_owner", member: "migration_owner" },
    { role: "audit_writer_owner", member: "migration_owner" },
    { role: "evidence_writer_owner", member: "migration_owner" },
    { role: "ledger_writer_owner", member: "migration_owner" },
    { role: "projection_owner", member: "migration_owner" },
    { role: "schema_owner", member: "migration_owner" },
  ]);
});

test("role bootstrap SQL is transactional and denies elevated attributes", () => {
  const sql = createRoleBootstrapSql();

  assert.match(sql, /^BEGIN;\n/);
  assert.match(sql, /COMMIT;\n$/);
  assert.doesNotMatch(sql, /CREATE\s+EXTENSION/iu);
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
  assert.equal((sql.match(/CREATE ROLE/gu) ?? []).length, 14);
  assert.equal((sql.match(/NOSUPERUSER/gu) ?? []).length, 14);
  assert.equal((sql.match(/NOCREATEROLE/gu) ?? []).length, 14);
  assert.equal((sql.match(/NOCREATEDB/gu) ?? []).length, 14);
  assert.equal((sql.match(/NOREPLICATION/gu) ?? []).length, 14);
  assert.equal((sql.match(/NOBYPASSRLS/gu) ?? []).length, 14);
  assert.equal(
    (sql.match(/WITH ADMIN FALSE, INHERIT FALSE, SET TRUE/gu) ?? []).length,
    9,
  );
});
