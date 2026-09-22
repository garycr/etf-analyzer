import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import { canonicalizeJson } from "../../dist/Infrastructure/CanonicalJson/canonical-json.js";
import { buildSchemaManifest } from "../../dist/Infrastructure/PostgreSQL/schema-manifest.js";
import { projectPostgresSchemaManifest } from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";

const migration = {
  sequence: 1,
  migrationId: "0001-foundation",
  contentHash: "a".repeat(64),
};

const schemaDefinition = {
  encoding: "UTF8",
  identifierCollation: "C",
};

const roleDefinition = {
  login: false,
  inherit: false,
  superuser: false,
  bypassRls: false,
  createDb: false,
  createRole: false,
  replication: false,
};

const tableDefinition = {
  columns: [],
  constraints: [],
  indexes: [],
  triggers: [],
};

const systemExtensions = [
  { name: "pgcrypto", version: "1.3" },
  { name: "plpgsql", version: "1.0" },
];

function digest(value) {
  return createHash("sha256").update(canonicalizeJson(value), "utf8").digest("hex");
}

test("schema manifest emits the exact canonical root and object ordering", () => {
  const manifestJson = buildSchemaManifest(
    {
      systemExtensions,
      migrationSequence: [],
      objects: [
        {
          kind: "table",
          schema: "etf",
          name: "schema_migrations",
          owner: "migration_owner",
          definition: tableDefinition,
        },
        {
          kind: "role",
          schema: null,
          name: "migration_owner",
          owner: null,
          definition: roleDefinition,
        },
        {
          kind: "schema",
          schema: null,
          name: "etf",
          owner: "schema_owner",
          definition: schemaDefinition,
        },
      ],
      roleMemberships: [],
      grants: [],
    },
    migration,
  );

  assert.equal(manifestJson, canonicalizeJson(JSON.parse(manifestJson)));
  const manifest = JSON.parse(manifestJson);
  assert.deepEqual(Object.keys(manifest).sort(), [
    "contractVersion",
    "grants",
    "migrationSequence",
    "objects",
    "roleMemberships",
    "systemExtensions",
  ]);
  assert.equal(manifest.contractVersion, "1.0.0-candidate.2");
  assert.deepEqual(manifest.migrationSequence, [migration]);
  assert.deepEqual(
    manifest.objects.map(({ kind, schema, name }) => ({ kind, schema, name })),
    [
      { kind: "schema", schema: null, name: "etf" },
      { kind: "role", schema: null, name: "migration_owner" },
      { kind: "table", schema: "etf", name: "schema_migrations" },
    ],
  );
  assert.equal(manifest.objects[0].definitionHash, digest(schemaDefinition));
  assert.equal(manifest.objects[1].definitionHash, digest(roleDefinition));
  assert.equal(manifest.objects[2].definitionHash, digest(tableDefinition));
});

test("schema manifest sorts memberships and grants by contract tuples", () => {
  const manifest = JSON.parse(
    buildSchemaManifest(
      {
        systemExtensions,
        migrationSequence: [],
        objects: [],
        roleMemberships: [
          { role: "schema_owner", member: "migration_owner", adminOption: false, inheritOption: false, setOption: true },
          { role: "migration_owner", member: "migration_executor", adminOption: false, inheritOption: false, setOption: true },
        ],
        grants: [
          { objectKind: "table", schema: "etf", object: "jobs", columns: ["job_id", "status"], grantee: "reader", privilege: "SELECT", grantOption: true },
          { objectKind: "table", schema: "etf", object: "jobs", columns: ["job_id", "status"], grantee: "reader", privilege: "SELECT", grantOption: false },
          { objectKind: "schema", schema: "etf", object: null, grantee: "migration_owner", privilege: "USAGE", grantOption: false },
          { objectKind: "schema", schema: "etf", object: null, grantee: "migration_owner", privilege: "CREATE", grantOption: false },
        ],
      },
      migration,
    ),
  );

  assert.deepEqual(
    manifest.roleMemberships.map(({ role, member }) => [role, member]),
    [
      ["migration_owner", "migration_executor"],
      ["schema_owner", "migration_owner"],
    ],
  );
  assert.deepEqual(
    manifest.grants.map(({ objectKind, schema, object, grantee, privilege }) => [objectKind, schema, object, grantee, privilege]),
    [
      ["schema", "etf", null, "migration_owner", "CREATE"],
      ["schema", "etf", null, "migration_owner", "USAGE"],
      ["table", "etf", "jobs", "reader", "SELECT"],
      ["table", "etf", "jobs", "reader", "SELECT"],
    ],
  );
  assert.deepEqual(manifest.grants.map(({ columns }) => columns), [
    null,
    null,
    ["job_id", "status"],
    ["job_id", "status"],
  ]);
  assert.deepEqual(manifest.grants.slice(2).map(({ grantOption }) => grantOption), [false, true]);
});

test("schema manifest tuple ordering is code-unit based and locale independent", () => {
  const manifest = JSON.parse(
    buildSchemaManifest(
      {
        systemExtensions,
        migrationSequence: [],
        objects: [
          { kind: "role", schema: null, name: "alpha", owner: null, definition: roleDefinition },
          { kind: "role", schema: null, name: "Zed", owner: null, definition: roleDefinition },
        ],
        roleMemberships: [],
        grants: [],
      },
      migration,
    ),
  );

  assert.deepEqual(manifest.objects.map(({ name }) => name), ["Zed", "alpha"]);
});

test("schema manifest rejects a duplicate or non-contiguous prospective migration", () => {
  const base = {
    systemExtensions,
    objects: [],
    roleMemberships: [],
    grants: [],
  };

  assert.throws(
    () => buildSchemaManifest({ ...base, migrationSequence: [migration] }, migration),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
  assert.throws(
    () =>
      buildSchemaManifest(
        { ...base, migrationSequence: [] },
        { ...migration, sequence: 2, migrationId: "0002-application" },
      ),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
});

test("schema manifest requires exact system extension names and versions", () => {
  const source = {
    migrationSequence: [],
    objects: [],
    roleMemberships: [],
    grants: [],
  };

  assert.throws(
    () =>
      buildSchemaManifest(
        { ...source, systemExtensions: [{ name: "plpgsql", version: "1.0" }] },
        migration,
      ),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
  assert.throws(
    () =>
      buildSchemaManifest(
        {
          ...source,
          systemExtensions: [
            { name: "pgcrypto", version: "1.2" },
            { name: "plpgsql", version: "1.0" },
          ],
        },
        migration,
      ),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
});

test("PostgreSQL projector rejects unsupported migration sequences before querying", async () => {
  let queryCount = 0;
  await assert.rejects(
    () =>
      projectPostgresSchemaManifest(
        {
          query: async () => {
            queryCount += 1;
            return { rows: [] };
          },
        },
        {
          sequence: 8,
          migrationId: "0008-unsupported",
          contentHash: "a".repeat(64),
        },
      ),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
  assert.equal(queryCount, 0);
});
