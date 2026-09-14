import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import {
  createRoleBootstrapSql,
  productRoles,
  roleMemberships,
} from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const fixtureLockSql =
  "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const fixtureUnlockSql =
  "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";

async function dropProductRoles(client) {
  await client.query("ROLLBACK").catch(() => undefined);
  await client.query("DROP SCHEMA IF EXISTS etf CASCADE");
  await client.query(
    `DROP ROLE IF EXISTS ${productRoles.map(({ name }) => name).join(", ")}`,
  );
}

test(
  "external provisioner creates the exact deny-by-default role matrix",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await client.query(createRoleBootstrapSql());

      const roles = await client.query(
        `SELECT rolname AS name, rolcanlogin AS login, rolinherit AS inherit,
                rolsuper AS superuser, rolcreaterole AS create_role,
                rolcreatedb AS create_db, rolreplication AS replication,
                rolbypassrls AS bypass_rls
           FROM pg_catalog.pg_roles
          WHERE rolname = ANY($1::text[])
          ORDER BY array_position($1::text[], rolname)`,
        [productRoles.map(({ name }) => name)],
      );
      assert.deepEqual(
        roles.rows,
        productRoles.map(({ name, login }) => ({
          name,
          login,
          inherit: false,
          superuser: false,
          create_role: false,
          create_db: false,
          replication: false,
          bypass_rls: false,
        })),
      );

      const memberships = await client.query(
        `SELECT parent.rolname AS role, member.rolname AS member,
                membership.admin_option, membership.inherit_option,
                membership.set_option
           FROM pg_catalog.pg_auth_members AS membership
           JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
           JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
          WHERE parent.rolname = ANY($1::text[])
            AND member.rolname = ANY($2::text[])
          ORDER BY array_position($3::text[], parent.rolname)`,
        [
          productRoles.map(({ name }) => name),
          productRoles.map(({ name }) => name),
          roleMemberships.map(({ role }) => role),
        ],
      );
      assert.deepEqual(
        memberships.rows,
        roleMemberships.map(({ role, member }) => ({
          role,
          member,
          admin_option: false,
          inherit_option: false,
          set_option: true,
        })),
      );
    } finally {
      try {
        await dropProductRoles(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "role bootstrap rolls back every role after a mid-transaction failure",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      const failingSql = createRoleBootstrapSql().replace(
        "CREATE ROLE app_runtime",
        "SELECT missing_bootstrap_function();\nCREATE ROLE app_runtime",
      );
      await assert.rejects(() => client.query(failingSql), /missing_bootstrap_function/);
      await client.query("ROLLBACK").catch(() => undefined);

      const remaining = await client.query(
        `SELECT rolname
           FROM pg_catalog.pg_roles
          WHERE rolname = ANY($1::text[])`,
        [productRoles.map(({ name }) => name)],
      );
      assert.deepEqual(remaining.rows, []);
    } finally {
      try {
        await dropProductRoles(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "external bootstrap creates the exact empty foundation schema prerequisite",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await client.query(createRoleBootstrapSql());
      const prerequisite = await client.query(
        `SELECT owner.rolname AS owner, namespace.nspacl IS NULL AS default_acl,
                (SELECT count(*)::integer FROM pg_catalog.pg_class AS relation
                  WHERE relation.relnamespace = namespace.oid) AS relation_count,
                (SELECT count(*)::integer FROM pg_catalog.pg_proc AS routine
                  WHERE routine.pronamespace = namespace.oid) AS routine_count,
                (SELECT count(*)::integer FROM pg_catalog.pg_default_acl AS defaults
                  WHERE defaults.defaclnamespace = namespace.oid) AS default_acl_count
           FROM pg_catalog.pg_namespace AS namespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = namespace.nspowner
          WHERE namespace.nspname = 'etf'`,
      );
      assert.deepEqual(prerequisite.rows, [
        {
          owner: "schema_owner",
          default_acl: true,
          relation_count: 0,
          routine_count: 0,
          default_acl_count: 0,
        },
      ]);
    } finally {
      try {
        await dropProductRoles(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);
