import { createHash } from "node:crypto";

import type { MigrationClient } from "./migration-runner.js";
import { projectCurrentPostgresSchemaManifestPrefix } from "./postgres-schema-manifest.js";
import { productRoles, roleMemberships } from "./role-bootstrap.js";

const lockQuery =
  "SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('etf:v1.0.0-prototype.1:migrations', 0))";
const deniedAttributes =
  "NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS";
const sha256Pattern = /^[0-9a-f]{64}$/u;
const verifierRoleName = "audit_activity_verifier_owner";

export interface DenialVerifierRoleUpgradeHashes {
  readonly migrations: readonly {
    readonly sequence: number;
    readonly migrationId: string;
    readonly contentHash: string;
  }[];
  readonly controlledAccessManifestHash: string;
}

function createUpgradeStatements(hashes: DenialVerifierRoleUpgradeHashes): string {
  const expectedIds = [
    "0001-foundation",
    "0002-application",
    "0003-domain-ledger",
    "0004-fixtures",
    "0005-analytics-evidence",
    "0006-controlled-access",
  ];
  if (
    hashes.migrations.length !== expectedIds.length ||
    hashes.migrations.some((migration, index) =>
      migration.sequence !== index + 1 ||
      migration.migrationId !== expectedIds[index] ||
      !sha256Pattern.test(migration.contentHash)
    ) ||
    !sha256Pattern.test(hashes.controlledAccessManifestHash)
  ) {
    throw new Error("denial verifier role upgrade requires the canonical sequence-6 ledger");
  }
  const expectedLedger = hashes.migrations
    .map((migration) =>
      `(${migration.sequence}, '${migration.migrationId}', '${migration.contentHash}')`)
    .join(",");
  const legacyRoles = productRoles.filter(({ name }) => name !== verifierRoleName);
  const legacyRoleNames = legacyRoles.map(({ name }) => `'${name}'`).join(",");
  const loginRoleNames = legacyRoles
    .filter(({ login }) => login)
    .map(({ name }) => `'${name}'`)
    .join(",");
  const expectedLegacyMemberships = roleMemberships
    .filter(({ role, member }) => role !== verifierRoleName && member !== verifierRoleName)
    .map(({ role, member, admin, inherit, set }) =>
      `('${role}', '${member}', ${admin}, ${inherit}, ${set})`)
    .join(",");

  return [
    "DO $upgrade$",
    "DECLARE",
    "  migration_count integer;",
    "BEGIN",
    "  IF pg_catalog.to_regclass('etf.schema_migrations') IS NULL THEN",
    "    RAISE EXCEPTION 'APPLICATION_MIGRATIONS_INCOMPLETE' USING ERRCODE = '55000';",
    "  END IF;",
    "  SELECT count(*)::integer INTO migration_count",
    "    FROM etf.schema_migrations AS actual",
    `    JOIN (VALUES ${expectedLedger}) AS expected(sequence, migration_id, content_hash)`,
    "      ON actual.sequence = expected.sequence",
    "     AND actual.migration_id = expected.migration_id",
    "     AND actual.content_hash = expected.content_hash;",
    "  IF migration_count <> 6 OR (SELECT count(*) FROM etf.schema_migrations) <> 6 OR NOT EXISTS (",
    "    SELECT 1 FROM etf.schema_migrations",
    "     WHERE sequence = 6",
    `       AND schema_manifest_hash = '${hashes.controlledAccessManifestHash}'`,
    "  ) THEN",
    "    RAISE EXCEPTION 'APPLICATION_MIGRATIONS_INCOMPLETE' USING ERRCODE = '55000';",
    "  END IF;",
    "  IF NOT EXISTS (",
    "    SELECT 1 FROM pg_catalog.pg_namespace AS namespace",
    "    JOIN pg_catalog.pg_roles AS owner ON owner.oid = namespace.nspowner",
    "    WHERE namespace.nspname = 'etf' AND owner.rolname = 'schema_owner'",
    "  ) OR EXISTS (",
    "    SELECT 1 FROM pg_catalog.pg_namespace AS namespace",
    "    CROSS JOIN LATERAL pg_catalog.aclexplode(",
    "      COALESCE(namespace.nspacl, pg_catalog.acldefault('n', namespace.nspowner))",
    "    ) AS privilege",
    "    WHERE namespace.nspname = 'etf' AND privilege.grantee = 0",
    "  ) OR EXISTS (",
    "    SELECT 1 FROM pg_catalog.pg_database AS database_record",
    "    CROSS JOIN LATERAL pg_catalog.aclexplode(",
    "      COALESCE(database_record.datacl, pg_catalog.acldefault('d', database_record.datdba))",
    "    ) AS privilege",
    "    WHERE database_record.datname = pg_catalog.current_database()",
    "      AND privilege.grantee = 0",
    "      AND privilege.privilege_type IN ('CONNECT', 'TEMPORARY')",
    "  ) OR EXISTS (",
    "    SELECT 1 FROM pg_catalog.pg_proc AS function_record",
    "    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace",
    "    CROSS JOIN LATERAL pg_catalog.aclexplode(",
    "      COALESCE(function_record.proacl, pg_catalog.acldefault('f', function_record.proowner))",
    "    ) AS privilege",
    "    WHERE namespace.nspname = 'etf'",
    "      AND privilege.grantee = 0",
    "      AND privilege.privilege_type = 'EXECUTE'",
    "  ) THEN",
    "    RAISE EXCEPTION 'APPLICATION_MIGRATIONS_INCOMPLETE' USING ERRCODE = '55000';",
    "  END IF;",
    "  IF (",
    "    SELECT count(*) FROM pg_catalog.pg_roles",
    `    WHERE rolname IN (${legacyRoleNames})`,
    "      AND NOT rolinherit AND NOT rolsuper AND NOT rolcreaterole",
    "      AND NOT rolcreatedb AND NOT rolreplication AND NOT rolbypassrls",
    `      AND rolcanlogin = (rolname IN (${loginRoleNames}))`,
    `  ) <> ${legacyRoles.length} THEN`,
    "    RAISE EXCEPTION 'APPLICATION_MIGRATIONS_INCOMPLETE' USING ERRCODE = '55000';",
    "  END IF;",
    "  IF (",
    "    SELECT count(*) FROM pg_catalog.pg_auth_members AS membership",
    "    JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid",
    "    JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member",
    `    JOIN (VALUES ${expectedLegacyMemberships}) AS expected(role, member, admin_option, inherit_option, set_option)`,
    "      ON parent.rolname = expected.role AND member.rolname = expected.member",
    "     AND membership.admin_option = expected.admin_option",
    "     AND membership.inherit_option = expected.inherit_option",
    "     AND membership.set_option = expected.set_option",
    `  ) <> ${roleMemberships.length - 2} OR (`,
    "    SELECT count(*) FROM pg_catalog.pg_auth_members AS membership",
    "    JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid",
    "    JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member",
    `    WHERE (parent.rolname IN (${legacyRoleNames}) OR member.rolname IN (${legacyRoleNames}))`,
    `      AND parent.rolname <> '${verifierRoleName}'`,
    `      AND member.rolname <> '${verifierRoleName}'`,
    `  ) <> ${roleMemberships.length - 2} THEN`,
    "    RAISE EXCEPTION 'APPLICATION_MIGRATIONS_INCOMPLETE' USING ERRCODE = '55000';",
    "  END IF;",
    `  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${verifierRoleName}') THEN`,
    "    IF NOT EXISTS (",
    "      SELECT 1 FROM pg_catalog.pg_roles",
    `      WHERE rolname = '${verifierRoleName}'`,
    "        AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper",
    "        AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolbypassrls",
    "    ) OR (",
    "      SELECT count(*) FROM pg_catalog.pg_auth_members AS membership",
    "      JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid",
    "      JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member",
    `      WHERE parent.rolname = '${verifierRoleName}' OR member.rolname = '${verifierRoleName}'`,
    "    ) <> 2 OR NOT EXISTS (",
    "      SELECT 1 FROM pg_catalog.pg_auth_members AS membership",
    "      JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid",
    "      JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member",
    "      WHERE parent.rolname = 'pg_read_all_stats'",
    `        AND member.rolname = '${verifierRoleName}'`,
    "        AND NOT membership.admin_option AND membership.inherit_option AND NOT membership.set_option",
    "    ) OR NOT EXISTS (",
    "      SELECT 1 FROM pg_catalog.pg_auth_members AS membership",
    "      JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid",
    "      JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member",
    `      WHERE parent.rolname = '${verifierRoleName}' AND member.rolname = 'migration_owner'`,
    "        AND NOT membership.admin_option AND NOT membership.inherit_option AND membership.set_option",
    "    ) THEN",
    "      RAISE EXCEPTION 'APPLICATION_MIGRATIONS_INCOMPLETE' USING ERRCODE = '55000';",
    "    END IF;",
    "  ELSE",
    `    CREATE ROLE ${verifierRoleName} NOLOGIN ${deniedAttributes};`,
    "  END IF;",
    "END",
    "$upgrade$;",
    `GRANT pg_read_all_stats TO ${verifierRoleName} WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;`,
    `GRANT ${verifierRoleName} TO migration_owner WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
  ].join("\n");
}

export async function applyDenialVerifierRoleUpgrade(
  client: MigrationClient,
  hashes: DenialVerifierRoleUpgradeHashes,
): Promise<void> {
  const statements = createUpgradeStatements(hashes);
  await client.query("BEGIN");
  try {
    await client.query(lockQuery);
    const manifestJson = await projectCurrentPostgresSchemaManifestPrefix(client, 6);
    const manifestHash = createHash("sha256")
      .update(manifestJson, "utf8")
      .digest("hex");
    if (manifestHash !== hashes.controlledAccessManifestHash) {
      throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
    }
    await client.query(statements);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
