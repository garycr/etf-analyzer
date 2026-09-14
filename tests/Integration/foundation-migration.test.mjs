import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
import {
  collectPostgresManifestGrants,
  projectPostgresSchemaManifest,
} from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";
import {
  createRoleBootstrapSql,
  productRoles,
} from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const fixtureLockSql =
  "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const fixtureUnlockSql =
  "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";

async function cleanBootstrap(client) {
  await client.query("ROLLBACK").catch(() => undefined);
  await client.query("DROP SCHEMA IF EXISTS etf CASCADE");
  const existing = await client.query(
    `SELECT rolname FROM pg_catalog.pg_roles WHERE rolname = ANY($1::text[])`,
    [productRoles.map(({ name }) => name)],
  );
  const roleNames = existing.rows.map(({ rolname }) => rolname);
  if (roleNames.length > 0) {
    await client.query(`DROP OWNED BY ${roleNames.join(", ")}`);
    await client.query(`DROP ROLE ${roleNames.join(", ")}`);
  }
  await client.query(
    "DO $cleanup$ BEGIN EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO PUBLIC', current_database()); END $cleanup$;",
  );
}

test(
  "0001 uses final owners, revokes temporary grants, and rolls back to the empty prerequisite",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await client.query(createRoleBootstrapSql());

      await assert.rejects(
        () =>
          applyMigration(
            client,
            foundationMigration,
            "2026-09-14T00:00:00.000Z",
            async (transaction) => {
              const owners = await transaction.query(
                `SELECT relation.relname AS name, owner.rolname AS owner
                   FROM pg_catalog.pg_class AS relation
                   JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
                   JOIN pg_catalog.pg_roles AS owner ON owner.oid = relation.relowner
                  WHERE namespace.nspname = 'etf' AND relation.relkind = 'r'
                  ORDER BY relation.relname`,
              );
              assert.deepEqual(owners.rows, [
                { name: "anchor_keys", owner: "anchor_owner" },
                { name: "audit_anchor_checkpoints", owner: "anchor_owner" },
                { name: "portfolio_anchor_checkpoints", owner: "anchor_owner" },
                { name: "schema_migrations", owner: "migration_owner" },
              ]);

              const privileges = await transaction.query(
                `SELECT pg_catalog.has_schema_privilege('migration_owner', 'etf', 'CREATE') AS migration_create,
                        pg_catalog.has_schema_privilege('anchor_owner', 'etf', 'CREATE') AS anchor_create,
                        pg_catalog.has_schema_privilege('anchor_owner', 'etf', 'USAGE') AS anchor_usage`,
              );
              assert.deepEqual(privileges.rows, [
                {
                  migration_create: true,
                  anchor_create: false,
                  anchor_usage: false,
                },
              ]);
              throw new Error("forced manifest stop");
            },
          ),
        /forced manifest stop/,
      );

      const prerequisite = await client.query(
        `SELECT owner.rolname AS owner,
                (SELECT count(*)::integer FROM pg_catalog.pg_class AS relation
                  WHERE relation.relnamespace = namespace.oid) AS relation_count
           FROM pg_catalog.pg_namespace AS namespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = namespace.nspowner
          WHERE namespace.nspname = 'etf'`,
      );
      assert.deepEqual(prerequisite.rows, [
        { owner: "schema_owner", relation_count: 0 },
      ]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0001 commits its canonical catalog manifest and replays as a no-op",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await client.query(createRoleBootstrapSql());
      let manifestJson;
      const applied = await applyMigration(
        client,
        foundationMigration,
        "2026-09-14T00:00:00.000Z",
        async (transaction, migration) => {
          manifestJson = await projectPostgresSchemaManifest(transaction, migration);
          return manifestJson;
        },
      );

      assert.equal(applied.applied, true);
      assert.equal(
        applied.contentHash,
        "a604802a67bed66c6ce79d2f2f856b48e184ae5b4f76803ab8ead3a135c85291",
      );
      assert.equal(
        applied.schemaManifestHash,
        "0c378abe080211c705c41ffd15f9cf8bf7dbc61396917df25444144ed3992c1b",
      );
      assert.equal(Buffer.byteLength(manifestJson, "utf8"), 5324);
      const manifest = JSON.parse(manifestJson);
      assert.equal(manifest.contractVersion, "1.0.0-candidate.2");
      assert.deepEqual(manifest.systemExtensions, [
        { name: "pgcrypto", version: "1.3" },
        { name: "plpgsql", version: "1.0" },
      ]);
      assert.equal(manifest.objects.filter(({ kind }) => kind === "schema").length, 1);
      assert.equal(manifest.objects.filter(({ kind }) => kind === "role").length, 14);
      assert.equal(manifest.objects.filter(({ kind }) => kind === "table").length, 4);
      assert.equal(manifest.roleMemberships.length, 9);
      assert.deepEqual(
        manifest.grants.map(({ objectKind, schema, object, grantee, privilege }) => [
          objectKind,
          schema,
          object,
          grantee,
          privilege,
        ]),
        [
          ["database", null, null, "app_runtime", "CONNECT"],
          ["database", null, null, "audit_runtime", "CONNECT"],
          ["database", null, null, "deployment_login", "CONNECT"],
          ["database", null, null, "key_injector", "CONNECT"],
          ["database", null, null, "migration_executor", "CONNECT"],
          ["database", null, null, "projection_runtime", "CONNECT"],
          ["schema", "etf", null, "migration_owner", "CREATE"],
          ["schema", "etf", null, "migration_owner", "USAGE"],
        ],
      );

      const ledger = await client.query(
        "SELECT sequence, migration_id, content_hash, schema_manifest_hash FROM etf.schema_migrations",
      );
      assert.deepEqual(ledger.rows, [
        {
          sequence: "1",
          migration_id: "0001-foundation",
          content_hash: applied.contentHash,
          schema_manifest_hash: applied.schemaManifestHash,
        },
      ]);

      const replayed = await applyMigration(
        client,
        foundationMigration,
        "2026-09-14T00:00:00.000Z",
        async () => assert.fail("manifest projection must not run for replay"),
      );
      assert.deepEqual(replayed, { ...applied, applied: false });
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "catalog grants surface implicit PUBLIC function execute",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await client.query(createRoleBootstrapSql());
      await client.query(
        "CREATE FUNCTION etf.implicit_public() RETURNS integer LANGUAGE sql AS 'SELECT 1'",
      );

      const grants = await collectPostgresManifestGrants(client);
      assert.ok(
        grants.some(
          (grant) =>
            grant.objectKind === "function" &&
            grant.schema === "etf" &&
            grant.object === "implicit_public()" &&
            grant.grantee === "PUBLIC" &&
            grant.privilege === "EXECUTE" &&
            grant.grantOption === false,
        ),
      );
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0001 rejects an unexpected view and rolls back to the empty prerequisite",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await client.query(createRoleBootstrapSql());
      await assert.rejects(
        () =>
          applyMigration(
            client,
            foundationMigration,
            "2026-09-14T00:00:00.000Z",
            async (transaction, migration) => {
              await transaction.query("CREATE VIEW etf.unexpected_view AS SELECT 1 AS value");
              return projectPostgresSchemaManifest(transaction, migration);
            },
          ),
        /APPLICATION_MIGRATIONS_INCOMPLETE/,
      );

      const remaining = await client.query(
        `SELECT count(*)::integer AS relation_count
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'etf'`,
      );
      assert.deepEqual(remaining.rows, [{ relation_count: 0 }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);
