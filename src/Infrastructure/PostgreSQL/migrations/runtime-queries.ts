import type { MigrationArtifact } from "../migration-set.js";

export const runtimeQueryFunctionNames = [
  "analytics_result_get",
  "readiness_get",
  "watchlist_get",
] as const;

const sql = `SET LOCAL ROLE schema_owner;
GRANT USAGE, CREATE ON SCHEMA etf TO application_writer_owner;
GRANT USAGE, CREATE ON SCHEMA etf TO evidence_writer_owner;

SET LOCAL ROLE application_writer_owner;
CREATE FUNCTION etf.readiness_get() RETURNS jsonb
LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  readiness_row etf.readiness_audit%ROWTYPE;
BEGIN
  IF session_user <> 'app_runtime' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO readiness_row
    FROM etf.readiness_audit
   ORDER BY checked_at DESC, readiness_id
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_MIGRATIONS_INCOMPLETE' USING ERRCODE = '55000';
  END IF;
  RETURN jsonb_build_object('readiness', jsonb_build_object(
    'state', readiness_row.state,
    'checkedAt', to_char(readiness_row.checked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'displayTimezone', readiness_row.display_timezone,
    'liveness', readiness_row.liveness,
    'dependencies', readiness_row.dependencies,
    'controllingError', readiness_row.controlling_error
  ));
END;
$function$;
REVOKE ALL ON FUNCTION etf.readiness_get() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etf.readiness_get() TO app_runtime;

CREATE FUNCTION etf.watchlist_get() RETURNS jsonb
LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  current_version bigint;
BEGIN
  IF session_user <> 'app_runtime' THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT version INTO current_version
    FROM etf.watchlist_state
   WHERE singleton;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_MIGRATIONS_INCOMPLETE' USING ERRCODE = '55000';
  END IF;
  RETURN jsonb_build_object(
    'orderedItems', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'instrumentId', instrument_id,
        'displayName', display_name,
        'validationState', validation_state,
        'position', position::text
      ) ORDER BY position, instrument_id)
        FROM etf.watchlist_items
    ), '[]'::jsonb),
    'version', current_version::text
  );
END;
$function$;
REVOKE ALL ON FUNCTION etf.watchlist_get() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etf.watchlist_get() TO app_runtime;

SET LOCAL ROLE evidence_writer_owner;
CREATE FUNCTION etf.analytics_result_get(requested_publication_target_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  analytics_result jsonb;
BEGIN
  IF session_user <> 'app_runtime' OR requested_publication_target_id IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT bundle.result INTO analytics_result
    FROM etf.analytics_publications AS publication
    JOIN etf.analytics_evidence_bundles AS bundle
      ON bundle.evidence_id = publication.evidence_id
     AND bundle.bundle_hash = publication.bundle_hash
   WHERE publication.publication_target_id = requested_publication_target_id::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANALYTICS_INPUT_INCOMPLETE' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('result', analytics_result);
END;
$function$;
REVOKE ALL ON FUNCTION etf.analytics_result_get(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etf.analytics_result_get(uuid) TO app_runtime;

SET LOCAL ROLE schema_owner;
REVOKE CREATE ON SCHEMA etf FROM application_writer_owner;
REVOKE CREATE ON SCHEMA etf FROM evidence_writer_owner;
SET LOCAL ROLE migration_owner;
`;

export const runtimeQueriesMigration: MigrationArtifact = {
  migrationId: "0008-runtime-queries",
  sequence: 8,
  sql,
};
