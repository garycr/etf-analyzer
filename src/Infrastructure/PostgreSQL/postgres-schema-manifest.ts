import { createHash } from "node:crypto";

import type { CanonicalJsonValue } from "../CanonicalJson/canonical-json.js";
import type {
  ManifestClient,
  ManifestMigration,
} from "./migration-runner.js";
import { productRoles } from "./role-bootstrap.js";
import {
  buildSchemaManifest,
  type ManifestGrant,
  type ManifestObjectSource,
  type ManifestRoleMembership,
} from "./schema-manifest.js";
import {
  applicationFunctionNames,
  applicationTableNames,
} from "./migrations/application.js";
import {
  domainLedgerFunctionNames,
  domainLedgerTableNames,
} from "./migrations/domain-ledger.js";
import {
  fixtureFunctionNames,
  fixtureTableNames,
} from "./migrations/fixtures.js";
import { foundationTableNames } from "./migrations/foundation.js";

interface TableSource {
  name: string;
  owner: string;
}

interface NamedTableRecord extends Record<string, unknown> {
  table_name: string;
}

function requireString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
  return value;
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
  return value;
}

function nullableString(value: unknown): string | null {
  if (value === null) return null;
  return requireString(value);
}

function rowsForTable<T extends NamedTableRecord>(
  rows: readonly T[],
  tableName: string,
): T[] {
  return rows.filter((row) => row.table_name === tableName);
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizePostgresDefinition(value: string): string {
  return `${value
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/gu, ""))
    .join("\n")
    .replace(/\n+$/gu, "")}\n`;
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function collectPostgresManifestGrants(
  client: ManifestClient,
): Promise<ManifestGrant[]> {
  const result = await client.query(
    `SELECT 'database'::text AS object_kind, NULL::text AS schema,
            NULL::text AS object,
            CASE WHEN privilege.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
            privilege.privilege_type AS privilege, privilege.is_grantable AS grant_option
       FROM pg_catalog.pg_database AS database
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(database.datacl, pg_catalog.acldefault('d', database.datdba))
       ) AS privilege
       LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = privilege.grantee
      WHERE database.datname = pg_catalog.current_database()
        AND privilege.grantee <> database.datdba
      UNION ALL
     SELECT 'schema'::text AS object_kind, namespace.nspname AS schema,
            NULL::text AS object,
            CASE WHEN privilege.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
            privilege.privilege_type AS privilege, privilege.is_grantable AS grant_option
       FROM pg_catalog.pg_namespace AS namespace
       CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) AS privilege
       LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = privilege.grantee
      WHERE namespace.nspname = 'etf' AND privilege.grantee <> namespace.nspowner
      UNION ALL
     SELECT CASE relation.relkind WHEN 'v' THEN 'view' ELSE 'table' END AS object_kind,
            namespace.nspname AS schema, relation.relname AS object,
            CASE WHEN privilege.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
            privilege.privilege_type AS privilege, privilege.is_grantable AS grant_option
       FROM pg_catalog.pg_class AS relation
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       CROSS JOIN LATERAL pg_catalog.aclexplode(relation.relacl) AS privilege
       LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = privilege.grantee
      WHERE namespace.nspname = 'etf' AND relation.relkind IN ('r', 'v')
        AND privilege.grantee <> relation.relowner
      UNION ALL
     SELECT 'function'::text AS object_kind, namespace.nspname AS schema,
            function_record.proname || '(' || pg_catalog.pg_get_function_identity_arguments(function_record.oid) || ')' AS object,
            CASE WHEN privilege.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
            privilege.privilege_type AS privilege, privilege.is_grantable AS grant_option
       FROM pg_catalog.pg_proc AS function_record
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
       CROSS JOIN LATERAL pg_catalog.aclexplode(
         COALESCE(function_record.proacl, pg_catalog.acldefault('f', function_record.proowner))
       ) AS privilege
       LEFT JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = privilege.grantee
      WHERE namespace.nspname = 'etf' AND privilege.grantee <> function_record.proowner
      ORDER BY object_kind, schema, object, grantee, privilege`,
  );
  return result.rows.map((row) => ({
    objectKind: requireString(row.object_kind) as ManifestGrant["objectKind"],
    schema: nullableString(row.schema),
    object: nullableString(row.object),
    grantee: requireString(row.grantee),
    privilege: requireString(row.privilege),
    grantOption: requireBoolean(row.grant_option),
  }));
}

export async function projectPostgresSchemaManifest(
  client: ManifestClient,
  prospectiveMigration: ManifestMigration,
): Promise<string> {
  if (prospectiveMigration.sequence < 1 || prospectiveMigration.sequence > 4) {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
  const extensions = await client.query(
    "SELECT extname AS name, extversion AS version FROM pg_catalog.pg_extension ORDER BY extname",
  );
  const schemaResult = await client.query(
    `SELECT owner.rolname AS owner,
            pg_catalog.pg_encoding_to_char(database.encoding) AS encoding,
            database.datcollate AS identifier_collation
       FROM pg_catalog.pg_namespace AS namespace
       JOIN pg_catalog.pg_roles AS owner ON owner.oid = namespace.nspowner
       JOIN pg_catalog.pg_database AS database ON database.datname = pg_catalog.current_database()
      WHERE namespace.nspname = 'etf'`,
  );
  const roles = await client.query(
    `SELECT rolname AS name, rolcanlogin AS login, rolinherit AS inherit,
            rolsuper AS superuser, rolbypassrls AS bypass_rls,
            rolcreatedb AS create_db, rolcreaterole AS create_role,
            rolreplication AS replication
       FROM pg_catalog.pg_roles
      WHERE rolname = ANY($1::text[])
      ORDER BY rolname`,
    [productRoles.map(({ name }) => name)],
  );
  const memberships = await client.query(
    `SELECT parent.rolname AS role, member.rolname AS member,
            membership.admin_option, membership.inherit_option, membership.set_option
       FROM pg_catalog.pg_auth_members AS membership
       JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
       JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
      WHERE parent.rolname = ANY($1::text[])
         OR member.rolname = ANY($1::text[])
      ORDER BY parent.rolname, member.rolname`,
    [productRoles.map(({ name }) => name)],
  );
  const migrations = await client.query(
    `SELECT sequence, migration_id, content_hash
       FROM etf.schema_migrations
      ORDER BY sequence`,
  );
  const tables = await client.query(
    `SELECT relation.relname AS name, owner.rolname AS owner
       FROM pg_catalog.pg_class AS relation
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       JOIN pg_catalog.pg_roles AS owner ON owner.oid = relation.relowner
      WHERE namespace.nspname = 'etf' AND relation.relkind = 'r'
      ORDER BY relation.relname`,
  );
  const functions = await client.query(
    `SELECT function_record.proname AS name, owner.rolname AS owner,
            pg_catalog.oidvectortypes(function_record.proargtypes) AS arguments,
            pg_catalog.pg_get_function_result(function_record.oid) AS returns,
            language_record.lanname AS language,
            function_record.prosecdef AS security_definer,
            CASE function_record.provolatile
              WHEN 'i' THEN 'immutable' WHEN 's' THEN 'stable' ELSE 'volatile'
            END AS volatility,
            CASE function_record.proparallel
              WHEN 's' THEN 'safe' WHEN 'r' THEN 'restricted' ELSE 'unsafe'
            END AS parallel_safety,
            function_record.proconfig AS configuration,
            pg_catalog.pg_get_functiondef(function_record.oid) AS definition
       FROM pg_catalog.pg_proc AS function_record
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
       JOIN pg_catalog.pg_roles AS owner ON owner.oid = function_record.proowner
       JOIN pg_catalog.pg_language AS language_record ON language_record.oid = function_record.prolang
      WHERE namespace.nspname = 'etf'
      ORDER BY function_record.proname, function_record.oid`,
  );
  const unsupportedObjects = await client.query(
    `SELECT
       (SELECT count(*)::integer
          FROM pg_catalog.pg_class AS relation
          JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
         WHERE namespace.nspname = 'etf' AND relation.relkind NOT IN ('r', 'i'))
       AS unsupported_count`,
  );
  const columns = await client.query(
    `SELECT relation.relname AS table_name, attribute.attnum::integer AS ordinal,
            attribute.attname AS name,
            pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) AS type,
            collation_record.collname AS collation,
            NOT attribute.attnotnull AS nullable,
            pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid, false) AS default_expression
       FROM pg_catalog.pg_class AS relation
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       JOIN pg_catalog.pg_attribute AS attribute ON attribute.attrelid = relation.oid
      LEFT JOIN pg_catalog.pg_collation AS collation_record ON collation_record.oid = attribute.attcollation
       LEFT JOIN pg_catalog.pg_attrdef AS default_value
              ON default_value.adrelid = relation.oid AND default_value.adnum = attribute.attnum
      WHERE namespace.nspname = 'etf' AND relation.relkind = 'r'
        AND attribute.attnum > 0 AND NOT attribute.attisdropped
      ORDER BY relation.relname, attribute.attnum`,
  );
  const constraints = await client.query(
    `SELECT relation.relname AS table_name, constraint_record.conname AS name,
            CASE constraint_record.contype
              WHEN 'p' THEN 'primaryKey'
              WHEN 'u' THEN 'unique'
              WHEN 'f' THEN 'foreignKey'
              WHEN 'c' THEN 'check'
            END AS kind,
            CASE WHEN constraint_record.contype IN ('p', 'u', 'f') THEN
              ARRAY(SELECT attribute.attname
                      FROM pg_catalog.unnest(constraint_record.conkey) WITH ORDINALITY AS key(attnum, position)
                      JOIN pg_catalog.pg_attribute AS attribute
                        ON attribute.attrelid = constraint_record.conrelid AND attribute.attnum = key.attnum
                     ORDER BY key.position)
            ELSE NULL END AS columns,
            referenced_namespace.nspname AS referenced_schema,
            referenced_relation.relname AS referenced_table,
            CASE WHEN constraint_record.contype = 'f' THEN
              ARRAY(SELECT attribute.attname
                      FROM pg_catalog.unnest(constraint_record.confkey) WITH ORDINALITY AS key(attnum, position)
                      JOIN pg_catalog.pg_attribute AS attribute
                        ON attribute.attrelid = constraint_record.confrelid AND attribute.attnum = key.attnum
                     ORDER BY key.position)
            ELSE NULL END AS referenced_columns,
            CASE constraint_record.confupdtype
              WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
              WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
              WHEN 'd' THEN 'SET DEFAULT' ELSE NULL
            END AS on_update,
            CASE constraint_record.confdeltype
              WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
              WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
              WHEN 'd' THEN 'SET DEFAULT' ELSE NULL
            END AS on_delete,
            constraint_record.condeferrable AS deferrable,
            constraint_record.condeferred AS initially_deferred,
            CASE WHEN constraint_record.contype = 'c'
              THEN pg_catalog.pg_get_expr(constraint_record.conbin, constraint_record.conrelid, false)
              ELSE NULL END AS check_expression
       FROM pg_catalog.pg_constraint AS constraint_record
       JOIN pg_catalog.pg_class AS relation ON relation.oid = constraint_record.conrelid
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       LEFT JOIN pg_catalog.pg_class AS referenced_relation ON referenced_relation.oid = constraint_record.confrelid
       LEFT JOIN pg_catalog.pg_namespace AS referenced_namespace ON referenced_namespace.oid = referenced_relation.relnamespace
      WHERE namespace.nspname = 'etf' AND constraint_record.contype IN ('p', 'u', 'f', 'c')
      ORDER BY relation.relname, constraint_record.conname`,
  );
  const indexes = await client.query(
    `SELECT table_record.relname AS table_name, index_record.relname AS name,
            access_method.amname AS method, index_metadata.indisunique AS unique,
            key.position::integer AS position,
            pg_catalog.pg_get_indexdef(index_record.oid, key.position, true) AS expression,
            CASE WHEN (index_metadata.indoption[key.position - 1] & 1) = 1 THEN 'DESC' ELSE 'ASC' END AS direction,
            CASE WHEN (index_metadata.indoption[key.position - 1] & 2) = 2 THEN 'FIRST' ELSE 'LAST' END AS nulls,
            collation_record.collname AS collation, operator_class.opcname AS opclass,
            pg_catalog.pg_get_expr(index_metadata.indpred, index_metadata.indrelid, false) AS predicate
       FROM pg_catalog.pg_index AS index_metadata
       JOIN pg_catalog.pg_class AS table_record ON table_record.oid = index_metadata.indrelid
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = table_record.relnamespace
       JOIN pg_catalog.pg_class AS index_record ON index_record.oid = index_metadata.indexrelid
       JOIN pg_catalog.pg_am AS access_method ON access_method.oid = index_record.relam
       CROSS JOIN LATERAL pg_catalog.generate_series(1, index_metadata.indnkeyatts) AS key(position)
      LEFT JOIN pg_catalog.pg_collation AS collation_record ON collation_record.oid = index_metadata.indcollation[key.position - 1]
       LEFT JOIN pg_catalog.pg_opclass AS operator_class ON operator_class.oid = index_metadata.indclass[key.position - 1]
      WHERE namespace.nspname = 'etf' AND table_record.relkind = 'r'
      ORDER BY table_record.relname, index_record.relname, key.position`,
  );
  const triggers = await client.query(
    `SELECT relation.relname AS table_name, trigger_record.tgname AS name,
            CASE WHEN (trigger_record.tgtype & 64) = 64 THEN 'INSTEAD OF'
                 WHEN (trigger_record.tgtype & 2) = 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
            ARRAY_REMOVE(ARRAY[
              CASE WHEN (trigger_record.tgtype & 4) = 4 THEN 'INSERT' END,
              CASE WHEN (trigger_record.tgtype & 16) = 16 THEN 'UPDATE' END,
              CASE WHEN (trigger_record.tgtype & 8) = 8 THEN 'DELETE' END,
              CASE WHEN (trigger_record.tgtype & 32) = 32 THEN 'TRUNCATE' END
            ], NULL) AS events,
            CASE WHEN (trigger_record.tgtype & 1) = 1 THEN 'ROW' ELSE 'STATEMENT' END AS level,
            function_namespace.nspname AS function_schema,
            function_record.proname AS function_name,
            pg_catalog.pg_get_expr(trigger_record.tgqual, trigger_record.tgrelid, false) AS when_expression
       FROM pg_catalog.pg_trigger AS trigger_record
       JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger_record.tgrelid
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       JOIN pg_catalog.pg_proc AS function_record ON function_record.oid = trigger_record.tgfoid
       JOIN pg_catalog.pg_namespace AS function_namespace ON function_namespace.oid = function_record.pronamespace
      WHERE namespace.nspname = 'etf' AND NOT trigger_record.tgisinternal
      ORDER BY relation.relname, trigger_record.tgname`,
  );
  const grants = await collectPostgresManifestGrants(client);
  const expectedTableNames = [
    ...foundationTableNames,
    ...(prospectiveMigration.sequence >= 2 ? applicationTableNames : []),
    ...(prospectiveMigration.sequence >= 3 ? domainLedgerTableNames : []),
    ...(prospectiveMigration.sequence >= 4 ? fixtureTableNames : []),
  ].sort(compareCodeUnits);
  const expectedFunctionNames = [
    ...(prospectiveMigration.sequence >= 2 ? applicationFunctionNames : []),
    ...(prospectiveMigration.sequence >= 3 ? domainLedgerFunctionNames : []),
    ...(prospectiveMigration.sequence >= 4 ? fixtureFunctionNames : []),
  ].sort(compareCodeUnits);

  if (
    schemaResult.rows.length !== 1 ||
    roles.rows.length !== productRoles.length ||
    tables.rows.length !== expectedTableNames.length ||
    functions.rows.length !== expectedFunctionNames.length ||
    Number(unsupportedObjects.rows[0]?.unsupported_count) !== 0
  ) {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
  const actualTableNames = tables.rows
    .map((row) => requireString(row.name))
    .sort(compareCodeUnits);
  if (actualTableNames.some((name, index) => name !== expectedTableNames[index])) {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
  const actualFunctionNames = functions.rows
    .map((row) => requireString(row.name))
    .sort(compareCodeUnits);
  if (
    actualFunctionNames.some((name, index) => name !== expectedFunctionNames[index])
  ) {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
  const schema = schemaResult.rows[0];
  if (!schema) throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");

  const columnRows = columns.rows as NamedTableRecord[];
  const constraintRows = constraints.rows as NamedTableRecord[];
  const indexRows = indexes.rows as NamedTableRecord[];
  const triggerRows = triggers.rows as NamedTableRecord[];
  const tableObjects: ManifestObjectSource[] = tables.rows.map((tableRow) => {
    const table: TableSource = {
      name: requireString(tableRow.name),
      owner: requireString(tableRow.owner),
    };
    const tableIndexes = rowsForTable(indexRows, table.name);
    const indexNames = [
      ...new Set(tableIndexes.map((row) => requireString(row.name))),
    ].sort(compareCodeUnits);
    const definition: CanonicalJsonValue = {
      columns: rowsForTable(columnRows, table.name)
        .sort((left, right) => Number(left.ordinal) - Number(right.ordinal))
        .map((row) => ({
          ordinal: Number(row.ordinal),
          name: requireString(row.name),
          type: requireString(row.type),
          collation: nullableString(row.collation),
          nullable: requireBoolean(row.nullable),
          defaultExpression: nullableString(row.default_expression),
        })),
      constraints: rowsForTable(constraintRows, table.name)
        .sort((left, right) =>
          compareCodeUnits(requireString(left.name), requireString(right.name)),
        )
        .map((row) => ({
          name: requireString(row.name),
          kind: requireString(row.kind),
          columns: (row.columns as string[] | null) ?? null,
          referencedSchema: nullableString(row.referenced_schema),
          referencedTable: nullableString(row.referenced_table),
          referencedColumns: (row.referenced_columns as string[] | null) ?? null,
          onUpdate: nullableString(row.on_update),
          onDelete: nullableString(row.on_delete),
          deferrable: requireBoolean(row.deferrable),
          initiallyDeferred: requireBoolean(row.initially_deferred),
          checkExpression: nullableString(row.check_expression),
        })),
      indexes: indexNames.map((indexName) => {
        const keyRows = tableIndexes
          .filter((row) => row.name === indexName)
          .sort((left, right) => Number(left.position) - Number(right.position));
        const first = keyRows[0];
        if (!first) throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
        return {
          name: indexName,
          method: requireString(first.method),
          unique: requireBoolean(first.unique),
          keys: keyRows.map((row) => ({
            expression: requireString(row.expression),
            direction: requireString(row.direction),
            nulls: requireString(row.nulls),
            collation: nullableString(row.collation),
            opclass: requireString(row.opclass),
          })),
          predicate: nullableString(first.predicate),
        };
      }),
      triggers: rowsForTable(triggerRows, table.name)
        .sort((left, right) =>
          compareCodeUnits(requireString(left.name), requireString(right.name)),
        )
        .map((row) => ({
          name: requireString(row.name),
          timing: requireString(row.timing),
          events: row.events as string[],
          level: requireString(row.level),
          functionSchema: requireString(row.function_schema),
          functionName: requireString(row.function_name),
          whenExpression: nullableString(row.when_expression),
        })),
    };
    return { kind: "table", schema: "etf", ...table, definition };
  });
  const functionObjects: ManifestObjectSource[] = functions.rows.map(
    (row): ManifestObjectSource => {
      const configuration = row.configuration;
      if (
        !Array.isArray(configuration) ||
        configuration.length !== 1 ||
        configuration[0] !== "search_path=pg_catalog, etf"
      ) {
        throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
      }
      return {
        kind: "function",
        schema: "etf",
        name: requireString(row.name),
        owner: requireString(row.owner),
        definition: {
          arguments: requireString(row.arguments),
          returns: requireString(row.returns),
          language: requireString(row.language),
          securityDefiner: requireBoolean(row.security_definer),
          volatility: requireString(row.volatility),
          parallelSafety: requireString(row.parallel_safety),
          searchPath: ["pg_catalog", "etf"],
          bodyHash: sha256Text(
            normalizePostgresDefinition(requireString(row.definition)),
          ),
        },
      };
    },
  );

  const objects: ManifestObjectSource[] = [
    {
      kind: "schema",
      schema: null,
      name: "etf",
      owner: requireString(schema.owner),
      definition: {
        encoding: requireString(schema.encoding),
        identifierCollation: requireString(schema.identifier_collation),
      },
    },
    ...roles.rows.map((role): ManifestObjectSource => ({
      kind: "role",
      schema: null,
      name: requireString(role.name),
      owner: null,
      definition: {
        login: requireBoolean(role.login),
        inherit: requireBoolean(role.inherit),
        superuser: requireBoolean(role.superuser),
        bypassRls: requireBoolean(role.bypass_rls),
        createDb: requireBoolean(role.create_db),
        createRole: requireBoolean(role.create_role),
        replication: requireBoolean(role.replication),
      },
    })),
    ...tableObjects,
    ...functionObjects,
  ];
  const roleMemberships: ManifestRoleMembership[] = memberships.rows.map((row) => ({
    role: requireString(row.role),
    member: requireString(row.member),
    adminOption: requireBoolean(row.admin_option),
    inheritOption: requireBoolean(row.inherit_option),
    setOption: requireBoolean(row.set_option),
  }));
  return buildSchemaManifest(
    {
      systemExtensions: extensions.rows.map((row) => ({
        name: requireString(row.name),
        version: requireString(row.version),
      })),
      migrationSequence: migrations.rows.map((row) => ({
        sequence: Number(row.sequence),
        migrationId: requireString(row.migration_id),
        contentHash: requireString(row.content_hash),
      })),
      objects,
      roleMemberships,
      grants,
    },
    prospectiveMigration,
  );
}
