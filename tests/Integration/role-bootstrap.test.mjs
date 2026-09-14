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
  "external provisioner creates the exact deny-by-default role matrix",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await client.query(createRoleBootstrapSql());

      const publicAuthority = await client.query(
        `SELECT EXISTS (
                  SELECT 1
                    FROM pg_catalog.pg_namespace AS namespace
                   CROSS JOIN LATERAL pg_catalog.aclexplode(
                     COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))
                   ) AS privilege
                   WHERE namespace.nspname = 'public'
                     AND privilege.grantee = 0
                     AND privilege.privilege_type = 'CREATE'
                ) AS public_create,
                (SELECT bool_or(pg_catalog.has_schema_privilege(role_name, 'public', 'CREATE'))
                   FROM pg_catalog.unnest($1::text[]) AS role_name) AS product_create`,
        [productRoles.map(({ name }) => name)],
      );
      assert.deepEqual(publicAuthority.rows, [
        { public_create: false, product_create: false },
      ]);

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

      const databaseAcl = await client.query(
        `SELECT CASE WHEN privilege.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
                privilege.privilege_type AS privilege, privilege.is_grantable AS grant_option
           FROM pg_catalog.pg_database AS database
           CROSS JOIN LATERAL pg_catalog.aclexplode(
             COALESCE(database.datacl, pg_catalog.acldefault('d', database.datdba))
           ) AS privilege
           LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = privilege.grantee
          WHERE database.datname = pg_catalog.current_database()
            AND privilege.grantee <> database.datdba
          ORDER BY grantee, privilege`,
      );
      assert.deepEqual(
        databaseAcl.rows,
        [
          "app_runtime",
          "audit_runtime",
          "deployment_login",
          "key_injector",
          "migration_executor",
          "projection_runtime",
        ].map((grantee) => ({
          grantee,
          privilege: "CONNECT",
          grant_option: false,
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
  "role bootstrap rolls back database ACLs after a post-ACL failure",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await dropProductRoles(client);
      const failingSql = createRoleBootstrapSql().replace(
        "CREATE SCHEMA etf AUTHORIZATION schema_owner;",
        "SELECT missing_post_acl_function();\nCREATE SCHEMA etf AUTHORIZATION schema_owner;",
      );
      await assert.rejects(() => client.query(failingSql), /missing_post_acl_function/);
      await client.query("ROLLBACK").catch(() => undefined);

      const remainingRoles = await client.query(
        `SELECT rolname
           FROM pg_catalog.pg_roles
          WHERE rolname = ANY($1::text[])`,
        [productRoles.map(({ name }) => name)],
      );
      assert.deepEqual(remainingRoles.rows, []);

      const publicAcl = await client.query(
        `SELECT privilege.privilege_type AS privilege
           FROM pg_catalog.pg_database AS database
           CROSS JOIN LATERAL pg_catalog.aclexplode(
             COALESCE(database.datacl, pg_catalog.acldefault('d', database.datdba))
           ) AS privilege
          WHERE database.datname = pg_catalog.current_database()
            AND privilege.grantee = 0
          ORDER BY privilege`,
      );
      assert.deepEqual(publicAcl.rows, [
        { privilege: "CONNECT" },
        { privilege: "TEMPORARY" },
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
