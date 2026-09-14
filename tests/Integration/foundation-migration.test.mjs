import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
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
  await client.query(
    `DROP ROLE IF EXISTS ${productRoles.map(({ name }) => name).join(", ")}`,
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
