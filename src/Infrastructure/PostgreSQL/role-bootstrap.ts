export interface ProductRole {
  name: string;
  login: boolean;
}

export interface RoleMembership {
  role: string;
  member: string;
  admin: boolean;
  inherit: boolean;
  set: boolean;
}

export const productRoles: readonly ProductRole[] = [
  { name: "schema_owner", login: false },
  { name: "migration_owner", login: false },
  { name: "application_writer_owner", login: false },
  { name: "ledger_writer_owner", login: false },
  { name: "projection_owner", login: false },
  { name: "audit_writer_owner", login: false },
  { name: "audit_activity_verifier_owner", login: false },
  { name: "anchor_owner", login: false },
  { name: "evidence_writer_owner", login: false },
  { name: "deployment_login", login: true },
  { name: "migration_executor", login: true },
  { name: "app_runtime", login: true },
  { name: "projection_runtime", login: true },
  { name: "audit_runtime", login: true },
  { name: "key_injector", login: true },
];

export const roleMemberships: readonly RoleMembership[] = [
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
];

const deniedAttributes =
  "NOINHERIT NOSUPERUSER NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS";

export function createRoleBootstrapSql(): string {
  const roleStatements = productRoles.map(
    ({ name, login }) =>
      `CREATE ROLE ${name} ${login ? "LOGIN" : "NOLOGIN"} ${deniedAttributes};`,
  );
  const membershipStatements = roleMemberships.map(
    ({ role, member, admin, inherit, set }) =>
      `GRANT ${role} TO ${member} WITH ADMIN ${admin ? "TRUE" : "FALSE"}, INHERIT ${inherit ? "TRUE" : "FALSE"}, SET ${set ? "TRUE" : "FALSE"};`,
  );

  return [
    "BEGIN;",
    "CREATE EXTENSION IF NOT EXISTS pgcrypto VERSION '1.3';",
    ...roleStatements,
    ...membershipStatements,
    "DO $bootstrap$",
    "BEGIN",
    "  EXECUTE format('REVOKE CONNECT, TEMPORARY ON DATABASE %I FROM PUBLIC', current_database());",
    "  EXECUTE format('GRANT CONNECT ON DATABASE %I TO deployment_login, migration_executor, app_runtime, projection_runtime, audit_runtime, key_injector', current_database());",
    "END",
    "$bootstrap$;",
    "CREATE SCHEMA etf AUTHORIZATION schema_owner;",
    "COMMIT;",
    "",
  ].join("\n");
}
