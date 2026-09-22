import type { MigrationArtifact } from "../migration-set.js";
import { domainLedgerMigration } from "./domain-ledger.js";

export const denialBackendVerifierFunctionNames = [
  "denial_backend_matches",
] as const;

const auditFunctionStart = "CREATE FUNCTION etf.audit_append(payload jsonb) RETURNS jsonb";
const auditFunctionEnd = "REVOKE ALL ON FUNCTION etf.audit_append(jsonb) FROM PUBLIC;";
const auditStartIndex = domainLedgerMigration.sql.indexOf(auditFunctionStart);
const auditEndIndex = domainLedgerMigration.sql.indexOf(auditFunctionEnd, auditStartIndex);
if (
  auditStartIndex < 0 ||
  auditEndIndex < 0 ||
  domainLedgerMigration.sql.indexOf(auditFunctionStart, auditStartIndex + 1) >= 0
) {
  throw new Error("0007 requires one canonical audit_append definition");
}

const oldCorrelation = "IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid = (subject ->> 'originalBackendPid')::integer AND backend_start = (subject ->> 'backendStart')::timestamp with time zone AND usename = subject ->> 'originalSessionUser' AND application_name = 'etf-denial:' || (subject ->> 'denialNonce')) THEN";
const newCorrelation = "IF NOT etf.denial_backend_matches((subject ->> 'originalBackendPid')::integer, (subject ->> 'backendStart')::timestamp with time zone, subject ->> 'originalSessionUser', 'etf-denial:' || (subject ->> 'denialNonce')) THEN";
const canonicalAuditFunction = domainLedgerMigration.sql.slice(
  auditStartIndex,
  auditEndIndex + auditFunctionEnd.length,
);
if (
  canonicalAuditFunction.indexOf(oldCorrelation) < 0 ||
  canonicalAuditFunction.indexOf(oldCorrelation, canonicalAuditFunction.indexOf(oldCorrelation) + 1) >= 0
) {
  throw new Error("0007 requires one canonical denial correlation predicate");
}
const replacedAuditFunction = canonicalAuditFunction
  .replace(auditFunctionStart, `CREATE OR REPLACE FUNCTION etf.audit_append(payload jsonb) RETURNS jsonb`)
  .replace(oldCorrelation, newCorrelation);

const sql = `SET LOCAL ROLE schema_owner;
GRANT USAGE, CREATE ON SCHEMA etf TO audit_activity_verifier_owner;
GRANT CREATE ON SCHEMA etf TO audit_writer_owner;

SET LOCAL ROLE audit_activity_verifier_owner;
CREATE FUNCTION etf.denial_backend_matches(requested_pid integer, requested_backend_start timestamp with time zone, requested_session_user text, requested_application_name text) RETURNS boolean
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  PERFORM pg_catalog.pg_stat_clear_snapshot();
  RETURN EXISTS (
    SELECT 1
      FROM pg_catalog.pg_stat_activity
     WHERE pid = requested_pid
       AND backend_start = requested_backend_start
       AND usename = requested_session_user
       AND application_name = requested_application_name
  );
END;
$function$;
REVOKE ALL ON FUNCTION etf.denial_backend_matches(integer, timestamp with time zone, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etf.denial_backend_matches(integer, timestamp with time zone, text, text) TO audit_writer_owner;

SET LOCAL ROLE audit_writer_owner;
${replacedAuditFunction}

SET LOCAL ROLE schema_owner;
REVOKE CREATE ON SCHEMA etf FROM audit_activity_verifier_owner;
REVOKE CREATE ON SCHEMA etf FROM audit_writer_owner;
SET LOCAL ROLE migration_owner;
`;

export const denialBackendVerifierMigration: MigrationArtifact = {
  migrationId: "0007-denial-backend-verifier",
  sequence: 7,
  sql,
};
