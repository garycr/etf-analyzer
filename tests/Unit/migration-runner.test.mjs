import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";

const migration = {
  migrationId: "0001-foundation",
  sequence: 1,
  sql: "CREATE SCHEMA etf;\n",
};

const exactEmptySchema = {
  rows: [
    {
      owner: "schema_owner",
      default_acl: true,
      relation_count: 0,
      routine_count: 0,
      default_acl_count: 0,
    },
  ],
};

function recordingClient(responses = []) {
  const queries = [];
  return {
    queries,
    query: async (sql, values) => {
      queries.push({ sql, values });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response ?? { rows: [] };
    },
  };
}

test("migration runner commits one migration row with exact hashes", async () => {
  const client = recordingClient([
    undefined,
    undefined,
    undefined,
    undefined,
    { rows: [{ migration_table: null }] },
    exactEmptySchema,
    undefined,
    undefined,
    undefined,
  ]);
  const manifestJson = '{"objects":[]}';
  const expectedManifestHash = createHash("sha256")
    .update(manifestJson, "utf8")
    .digest("hex");
  let projectedMigration;

  const result = await applyMigration(
    client,
    migration,
    "2026-09-14T00:00:00.000Z",
    async (_client, prospectiveMigration) => {
      projectedMigration = prospectiveMigration;
      return manifestJson;
    },
  );

  assert.equal(result.applied, true);
  assert.match(result.contentHash, /^[0-9a-f]{64}$/);
  assert.equal(result.schemaManifestHash, expectedManifestHash);
  assert.deepEqual(projectedMigration, {
    sequence: migration.sequence,
    migrationId: migration.migrationId,
    contentHash: result.contentHash,
  });
  assert.equal(client.queries[0].sql, "BEGIN");
  assert.match(client.queries[1].sql, /pg_advisory_xact_lock/);
  assert.equal(client.queries[2].sql, "SET LOCAL ROLE migration_executor");
  assert.equal(client.queries[3].sql, "SET LOCAL ROLE migration_owner");
  assert.equal(client.queries.at(-1).sql, "COMMIT");
});

test("migration runner returns an identical committed migration as a no-op", async () => {
  const contentHash = createHash("sha256")
    .update(migration.sql, "utf8")
    .digest("hex");
  const manifestJson = '{"objects":[]}';
  const schemaManifestHash = createHash("sha256")
    .update(manifestJson, "utf8")
    .digest("hex");
  const client = recordingClient([
    undefined,
    undefined,
    undefined,
    undefined,
    { rows: [{ migration_table: "etf.schema_migrations" }] },
    {
      rows: [
        {
          sequence: migration.sequence,
          migration_id: migration.migrationId,
          content_hash: contentHash,
          schema_manifest_hash: schemaManifestHash,
        },
      ],
    },
    { rows: [{ applied_count: "1", min_sequence: 1, max_sequence: 1 }] },
    undefined,
  ]);
  let projectedMigration;

  const result = await applyMigration(
    client,
    { ...migration, contentHash: "d".repeat(64) },
    "2026-09-14T00:00:00.000Z",
    async (_client, prospectiveMigration) => {
      projectedMigration = prospectiveMigration;
      return manifestJson;
    },
  );

  assert.deepEqual(result, {
    applied: false,
    contentHash,
    schemaManifestHash,
  });
  assert.deepEqual(projectedMigration, {
    sequence: migration.sequence,
    migrationId: migration.migrationId,
    contentHash,
  });
  assert.equal(client.queries.at(-1).sql, "COMMIT");
  assert.equal(client.queries.some(({ sql }) => sql === migration.sql), false);
});

test("migration runner rejects a sequence or identity conflict", async () => {
  const contentHash = createHash("sha256")
    .update(migration.sql, "utf8")
    .digest("hex");
  const client = recordingClient([
    undefined,
    undefined,
    undefined,
    undefined,
    { rows: [{ migration_table: "etf.schema_migrations" }] },
    {
      rows: [
        {
          sequence: 2,
          migration_id: migration.migrationId,
          content_hash: contentHash,
          schema_manifest_hash: "e".repeat(64),
        },
      ],
    },
  ]);

  await assert.rejects(
    () =>
      applyMigration(
        client,
        migration,
        "2026-09-14T00:00:00.000Z",
        async () => assert.fail("manifest projection must not run for conflicts"),
      ),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
  assert.equal(client.queries.at(-1).sql, "ROLLBACK");
});

test("migration runner rejects two rows matching different identity keys", async () => {
  const client = recordingClient([
    undefined,
    undefined,
    undefined,
    undefined,
    { rows: [{ migration_table: "etf.schema_migrations" }] },
    {
      rows: [
        { sequence: 1, migration_id: "wrong-id" },
        { sequence: 2, migration_id: migration.migrationId },
      ],
    },
  ]);

  await assert.rejects(
    () =>
      applyMigration(
        client,
        migration,
        "2026-09-14T00:00:00.000Z",
        async () => assert.fail("manifest projection must not run for conflicts"),
      ),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
  assert.equal(client.queries.at(-1).sql, "ROLLBACK");
});

test("migration runner rejects a non-contiguous ledger prefix", async () => {
  const secondMigration = {
    migrationId: "0002-application",
    sequence: 2,
    sql: "CREATE TABLE etf.application_replays (id bigint);\n",
  };
  const client = recordingClient([
    undefined,
    undefined,
    undefined,
    undefined,
    { rows: [{ migration_table: "etf.schema_migrations" }] },
    { rows: [] },
    { rows: [{ applied_count: "0", min_sequence: null, max_sequence: null }] },
  ]);

  await assert.rejects(
    () =>
      applyMigration(
        client,
        secondMigration,
        "2026-09-14T00:00:00.000Z",
        async () => assert.fail("manifest projection must not run across a gap"),
      ),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
  assert.equal(client.queries.at(-1).sql, "ROLLBACK");
});

test("migration runner rejects a later migration before the ledger exists", async () => {
  const client = recordingClient([
    undefined,
    undefined,
    undefined,
    undefined,
    { rows: [{ migration_table: null }] },
  ]);

  await assert.rejects(
    () =>
      applyMigration(
        client,
        {
          migrationId: "0002-application",
          sequence: 2,
          sql: "CREATE TABLE etf.application_replays (id bigint);\n",
        },
        "2026-09-14T00:00:00.000Z",
        async () => assert.fail("manifest projection must not run without ledger"),
      ),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
  assert.equal(client.queries.at(-1).sql, "ROLLBACK");
});

test("migration runner rejects a contaminated foundation prerequisite", async () => {
  const client = recordingClient([
    undefined,
    undefined,
    undefined,
    undefined,
    { rows: [{ migration_table: null }] },
    {
      rows: [
        {
          owner: "wrong_owner",
          default_acl: true,
          relation_count: 0,
          routine_count: 0,
          default_acl_count: 0,
        },
      ],
    },
  ]);

  await assert.rejects(
    () =>
      applyMigration(
        client,
        migration,
        "2026-09-14T00:00:00.000Z",
        async () => assert.fail("manifest projection must not run"),
      ),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
  assert.equal(client.queries.at(-1).sql, "ROLLBACK");
  assert.equal(client.queries.some(({ sql }) => sql === migration.sql), false);
});

test("migration runner rejects prohibited SQL before opening a transaction", async () => {
  const client = recordingClient();

  await assert.rejects(
    () =>
      applyMigration(
        { ...client },
        { ...migration, sql: "CREATE EXTENSION pgcrypto;\n" },
        "2026-09-14T00:00:00.000Z",
        async () => assert.fail("manifest projection must not run"),
      ),
    /CT-DB-001A/,
  );
  assert.equal(client.queries.length, 0);
});

test("migration runner rejects a non-canonical applied timestamp", async () => {
  const client = recordingClient();

  await assert.rejects(
    () =>
      applyMigration(
        client,
        migration,
        "2026-09-14T00:00:00Z",
        async () => assert.fail("manifest projection must not run"),
      ),
    /canonical UTC millisecond timestamp/,
  );
  assert.equal(client.queries.length, 0);
});

test("migration runner normalizes calendar-invalid timestamp failures", async () => {
  const client = recordingClient();

  await assert.rejects(
    () =>
      applyMigration(
        client,
        migration,
        "2026-13-01T00:00:00.000Z",
        async () => assert.fail("manifest projection must not run"),
      ),
    /canonical UTC millisecond timestamp/,
  );
  assert.equal(client.queries.length, 0);
});

test("migration runner rolls back changed content without executing SQL", async () => {
  const client = recordingClient([
    undefined,
    undefined,
    undefined,
    undefined,
    { rows: [{ migration_table: "etf.schema_migrations" }] },
    { rows: [{ content_hash: "f".repeat(64), schema_manifest_hash: "e".repeat(64) }] },
  ]);

  await assert.rejects(
    () =>
      applyMigration(
        client,
        migration,
        "2026-09-14T00:00:00.000Z",
        async () => assert.fail("manifest projection must not run for drift"),
      ),
    /APPLICATION_MIGRATIONS_INCOMPLETE/,
  );
  assert.equal(client.queries.at(-1).sql, "ROLLBACK");
  assert.equal(client.queries.some(({ sql }) => sql === migration.sql), false);
});

test("migration runner rolls back a failed migration body", async () => {
  const client = recordingClient([
    undefined,
    undefined,
    undefined,
    undefined,
    { rows: [{ migration_table: null }] },
    exactEmptySchema,
    new Error("forced DDL failure"),
  ]);

  await assert.rejects(
    () =>
      applyMigration(
        client,
        migration,
        "2026-09-14T00:00:00.000Z",
        async () => assert.fail("manifest projection must not run after DDL failure"),
      ),
    /forced DDL failure/,
  );
  assert.equal(client.queries.at(-1).sql, "ROLLBACK");
});
