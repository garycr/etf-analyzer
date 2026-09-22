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
const oldDeclare = "DECLARE\n  domain_name text; outcome_name text; subject jsonb; recorded timestamp(3) with time zone; workload text; actor text; auth_hash text; audit_content text; evidence text; anchor_result jsonb; replay_evidence text; replay_sequence bigint;";
const newDeclare = "DECLARE\n  domain_name text; outcome_name text; subject jsonb; recorded timestamp(3) with time zone; workload text; actor text; auth_hash text; audit_content text; evidence text; anchor_result jsonb; replay_audit_id uuid; replay_evidence text; replay_sequence bigint;";
const oldDenialInsert = "INSERT INTO etf.access_denial_audit VALUES ((subject ->> 'auditId')::uuid,(payload ->> 'correlationId')::uuid,(subject ->> 'originalBackendPid')::integer,(subject ->> 'backendStart')::timestamp with time zone,subject ->> 'originalSessionUser',subject ->> 'denialNonce',NULL,workload,auth_hash,subject ->> 'objectClass',subject ->> 'objectName',subject ->> 'denialCode',(subject ->> 'deniedAt')::timestamp with time zone,evidence) ON CONFLICT ON CONSTRAINT uq_access_denial_audit__deduplication DO NOTHING;";
const newDenialInsert = `PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.jsonb_build_array('etf:denial-dedup', (payload ->> 'correlationId')::uuid, (subject ->> 'originalBackendPid')::integer, (extract(epoch FROM (subject ->> 'backendStart')::timestamp(3) with time zone) * 1000)::bigint, subject ->> 'denialNonce', workload, subject ->> 'objectClass', subject ->> 'objectName', subject ->> 'denialCode')::text, 0));
    SELECT denial.audit_id, denial.content_hash, commitment.audit_sequence
      INTO replay_audit_id, replay_evidence, replay_sequence
      FROM etf.access_denial_audit AS denial
      JOIN etf.audit_commitments AS commitment ON commitment.audit_segment_hash = denial.content_hash
     WHERE denial.correlation_id = (payload ->> 'correlationId')::uuid
       AND denial.original_backend_pid = (subject ->> 'originalBackendPid')::integer
      AND denial.backend_start = (subject ->> 'backendStart')::timestamp(3) with time zone
       AND denial.denial_nonce = subject ->> 'denialNonce'
       AND denial.workload_identity = workload
       AND denial.object_class = subject ->> 'objectClass'
       AND denial.object_name = subject ->> 'objectName'
       AND denial.denial_code = subject ->> 'denialCode';
    IF FOUND THEN
      IF replay_evidence <> evidence THEN RAISE EXCEPTION 'ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED' USING ERRCODE = '55000'; END IF;
      RETURN jsonb_build_object('auditId', replay_audit_id::text, 'evidenceHash', replay_evidence, 'auditSequence', replay_sequence);
    END IF;
    INSERT INTO etf.access_denial_audit VALUES ((subject ->> 'auditId')::uuid,(payload ->> 'correlationId')::uuid,(subject ->> 'originalBackendPid')::integer,(subject ->> 'backendStart')::timestamp with time zone,subject ->> 'originalSessionUser',subject ->> 'denialNonce',NULL,workload,auth_hash,subject ->> 'objectClass',subject ->> 'objectName',subject ->> 'denialCode',(subject ->> 'deniedAt')::timestamp with time zone,evidence);`;
const canonicalAuditFunction = domainLedgerMigration.sql.slice(
  auditStartIndex,
  auditEndIndex + auditFunctionEnd.length,
);
if (
  canonicalAuditFunction.indexOf(oldCorrelation) < 0 ||
  canonicalAuditFunction.indexOf(oldCorrelation, canonicalAuditFunction.indexOf(oldCorrelation) + 1) >= 0 ||
  canonicalAuditFunction.indexOf(oldDeclare) < 0 ||
  canonicalAuditFunction.indexOf(oldDeclare, canonicalAuditFunction.indexOf(oldDeclare) + 1) >= 0 ||
  canonicalAuditFunction.indexOf(oldDenialInsert) < 0 ||
  canonicalAuditFunction.indexOf(oldDenialInsert, canonicalAuditFunction.indexOf(oldDenialInsert) + 1) >= 0
) {
  throw new Error("0007 requires one canonical audit_append transformation surface");
}
const replacedAuditFunction = canonicalAuditFunction
  .replace(auditFunctionStart, `CREATE OR REPLACE FUNCTION etf.audit_append(payload jsonb) RETURNS jsonb`)
  .replace(oldCorrelation, newCorrelation)
  .replace(oldDeclare, newDeclare)
  .replace(oldDenialInsert, newDenialInsert);
if (
  !replacedAuditFunction.includes(newCorrelation) ||
  !replacedAuditFunction.includes(newDeclare) ||
  !replacedAuditFunction.includes(newDenialInsert)
) {
  throw new Error("0007 failed to replace the canonical audit_append transformation surface");
}

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
REVOKE USAGE, CREATE ON SCHEMA etf FROM audit_activity_verifier_owner;
REVOKE CREATE ON SCHEMA etf FROM audit_writer_owner;
SET LOCAL ROLE migration_owner;
`;

export const denialBackendVerifierMigration: MigrationArtifact = {
  migrationId: "0007-denial-backend-verifier",
  sequence: 7,
  sql,
};
