import type { MigrationArtifact } from "../migration-set.js";

export const applicationTableNames = [
  "application_replays",
  "watchlist_state",
  "watchlist_items",
  "jobs",
  "job_checkpoints",
  "readiness_audit",
] as const;

export const applicationFunctionNames = [
  "application_replay_get_or_put",
  "watchlist_write",
  "job_start",
  "job_restart",
  "readiness_append",
] as const;

const sql = `SET LOCAL ROLE schema_owner;
GRANT USAGE, CREATE ON SCHEMA etf TO application_writer_owner;
SET LOCAL ROLE application_writer_owner;

CREATE TABLE etf.application_replays (
  operation text COLLATE "C" NOT NULL,
  command_id uuid NOT NULL,
  canonical_content jsonb NOT NULL,
  result_envelope jsonb NOT NULL,
  created_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_application_replays PRIMARY KEY (operation, command_id),
  CONSTRAINT ck_application_replays__operation_nonempty CHECK (length(operation) > 0)
);

CREATE TABLE etf.watchlist_state (
  singleton boolean NOT NULL,
  version bigint NOT NULL,
  CONSTRAINT pk_watchlist_state PRIMARY KEY (singleton),
  CONSTRAINT ck_watchlist_state__singleton CHECK (singleton),
  CONSTRAINT ck_watchlist_state__version_nonnegative CHECK (version >= 0)
);

INSERT INTO etf.watchlist_state (singleton, version) VALUES (true, 0);

CREATE TABLE etf.watchlist_items (
  instrument_id text COLLATE "C" NOT NULL,
  display_name text COLLATE "C" NOT NULL,
  validation_state text COLLATE "C" NOT NULL,
  position bigint NOT NULL,
  version bigint NOT NULL,
  CONSTRAINT pk_watchlist_items PRIMARY KEY (instrument_id),
  CONSTRAINT uq_watchlist_items__position UNIQUE (position),
  CONSTRAINT ck_watchlist_items__instrument_id_nonempty CHECK (length(instrument_id) > 0),
  CONSTRAINT ck_watchlist_items__display_name_nonempty CHECK (length(display_name) > 0),
  CONSTRAINT ck_watchlist_items__validation_state CHECK (validation_state IN ('Valid', 'Invalid')),
  CONSTRAINT ck_watchlist_items__position_nonnegative CHECK (position >= 0),
  CONSTRAINT ck_watchlist_items__version_nonnegative CHECK (version >= 0)
);

CREATE TABLE etf.jobs (
  job_id uuid NOT NULL,
  job_type text COLLATE "C" NOT NULL,
  status text COLLATE "C" NOT NULL,
  restartability text COLLATE "C" NOT NULL,
  attempt bigint NOT NULL,
  operation text COLLATE "C" NOT NULL,
  original_command_id uuid NOT NULL,
  input_identity jsonb NOT NULL,
  created_at timestamp(3) with time zone NOT NULL,
  started_at timestamp(3) with time zone,
  completed_at timestamp(3) with time zone,
  accepted_count bigint NOT NULL,
  rejected_count bigint NOT NULL,
  controlling_error jsonb,
  CONSTRAINT pk_jobs PRIMARY KEY (job_id),
  CONSTRAINT ck_jobs__job_type CHECK (job_type IN ('FixtureIngestion', 'Analytics')),
  CONSTRAINT ck_jobs__status CHECK (status IN ('Pending', 'Running', 'Succeeded', 'Failed')),
  CONSTRAINT ck_jobs__restartability CHECK (restartability IN ('Restartable', 'NotRestartable')),
  CONSTRAINT ck_jobs__attempt_positive CHECK (attempt >= 1),
  CONSTRAINT ck_jobs__operation_by_type CHECK (
    (job_type = 'FixtureIngestion' AND operation = 'FixtureIngestionStart') OR
    (job_type = 'Analytics' AND operation = 'AnalyticsRun')
  ),
  CONSTRAINT ck_jobs__accepted_count_nonnegative CHECK (accepted_count >= 0),
  CONSTRAINT ck_jobs__rejected_count_nonnegative CHECK (rejected_count >= 0),
  CONSTRAINT ck_jobs__status_fields CHECK (
    (status = 'Pending' AND started_at IS NULL AND completed_at IS NULL AND controlling_error IS NULL) OR
    (status = 'Running' AND started_at IS NOT NULL AND completed_at IS NULL AND controlling_error IS NULL) OR
    (status = 'Succeeded' AND started_at IS NOT NULL AND completed_at IS NOT NULL AND controlling_error IS NULL) OR
    (status = 'Failed' AND completed_at IS NOT NULL AND controlling_error IS NOT NULL)
  )
);

CREATE TABLE etf.job_checkpoints (
  job_id uuid NOT NULL,
  checkpoint_id uuid NOT NULL,
  attempt bigint NOT NULL,
  sequence bigint NOT NULL,
  committed_at timestamp(3) with time zone NOT NULL,
  content_hash character(64) COLLATE "C" NOT NULL,
  effect_domain text COLLATE "C" NOT NULL,
  first_effect_identity text COLLATE "C" NOT NULL,
  last_effect_identity text COLLATE "C" NOT NULL,
  effect_count bigint NOT NULL,
  CONSTRAINT pk_job_checkpoints PRIMARY KEY (job_id, checkpoint_id),
  CONSTRAINT uq_job_checkpoints__job_id_attempt_sequence UNIQUE (job_id, attempt, sequence),
  CONSTRAINT fk_job_checkpoints__job_id__jobs FOREIGN KEY (job_id) REFERENCES etf.jobs (job_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_job_checkpoints__attempt_positive CHECK (attempt >= 1),
  CONSTRAINT ck_job_checkpoints__sequence_nonnegative CHECK (sequence >= 0),
  CONSTRAINT ck_job_checkpoints__content_hash_lower_hex CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_job_checkpoints__effect_domain_nonempty CHECK (length(effect_domain) > 0),
  CONSTRAINT ck_job_checkpoints__first_effect_identity_nonempty CHECK (length(first_effect_identity) > 0),
  CONSTRAINT ck_job_checkpoints__last_effect_identity_nonempty CHECK (length(last_effect_identity) > 0),
  CONSTRAINT ck_job_checkpoints__effect_count_nonnegative CHECK (effect_count >= 0)
);

CREATE TABLE etf.readiness_audit (
  readiness_id uuid NOT NULL,
  state text COLLATE "C" NOT NULL,
  checked_at timestamp(3) with time zone NOT NULL,
  display_timezone text COLLATE "C" NOT NULL,
  liveness text COLLATE "C" NOT NULL,
  dependencies jsonb NOT NULL,
  controlling_error jsonb,
  CONSTRAINT pk_readiness_audit PRIMARY KEY (readiness_id),
  CONSTRAINT ck_readiness_audit__state CHECK (state IN ('Ready', 'NotReady')),
  CONSTRAINT ck_readiness_audit__display_timezone CHECK (display_timezone = 'UTC'),
  CONSTRAINT ck_readiness_audit__liveness CHECK (liveness IN ('Live', 'NotLive')),
  CONSTRAINT ck_readiness_audit__controlling_error CHECK (
    (state = 'Ready' AND controlling_error IS NULL) OR
    (state = 'NotReady' AND controlling_error IS NOT NULL)
  )
);

CREATE FUNCTION etf.application_replay_get_or_put(
  requested_operation text,
  requested_command_id uuid,
  requested_canonical_content text,
  requested_result_envelope text
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  stored_content jsonb;
  stored_result jsonb;
  canonical_content jsonb;
  result_envelope jsonb;
BEGIN
  IF requested_operation IS NULL
     OR length(requested_operation) = 0
     OR requested_command_id IS NULL
     OR requested_canonical_content IS NULL
     OR requested_result_envelope IS NULL THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  BEGIN
    canonical_content := requested_canonical_content::jsonb;
    result_envelope := requested_result_envelope::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
  END;

  SELECT replay.canonical_content, replay.result_envelope
    INTO stored_content, stored_result
    FROM etf.application_replays AS replay
   WHERE replay.operation = requested_operation
     AND replay.command_id = requested_command_id
   FOR UPDATE;

  IF FOUND THEN
    IF stored_content <> canonical_content THEN
      RAISE EXCEPTION 'APPLICATION_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    RETURN stored_result;
  END IF;

  INSERT INTO etf.application_replays (
    operation, command_id, canonical_content, result_envelope, created_at
  ) VALUES (
    requested_operation,
    requested_command_id,
    canonical_content,
    result_envelope,
    pg_catalog.clock_timestamp()
  );
  RETURN result_envelope;
EXCEPTION
  WHEN unique_violation THEN
    SELECT replay.canonical_content, replay.result_envelope
      INTO stored_content, stored_result
      FROM etf.application_replays AS replay
     WHERE replay.operation = requested_operation
       AND replay.command_id = requested_command_id;
    IF stored_content = canonical_content THEN
      RETURN stored_result;
    END IF;
    RAISE EXCEPTION 'APPLICATION_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
END;
$function$;
REVOKE ALL ON FUNCTION etf.application_replay_get_or_put(text, uuid, text, text) FROM PUBLIC;

CREATE FUNCTION etf.watchlist_write(
  requested_operation text,
  payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  expected_version bigint;
  current_version bigint;
  next_version bigint;
  instrument_count bigint;
  requested_count bigint;
  item jsonb;
  item_position bigint;
BEGIN
  IF payload IS NULL
     OR jsonb_typeof(payload) <> 'object'
     OR NOT payload ? 'expectedVersion'
     OR jsonb_typeof(payload -> 'expectedVersion') <> 'number'
     OR payload ->> 'expectedVersion' !~ '^(0|[1-9][0-9]*)$' THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  expected_version := (payload ->> 'expectedVersion')::bigint;
  SELECT version
    INTO current_version
    FROM etf.watchlist_state
   WHERE singleton
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_MIGRATIONS_INCOMPLETE' USING ERRCODE = '55000';
  END IF;
  SELECT count(*) INTO instrument_count FROM etf.watchlist_items;
  IF expected_version <> current_version THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '40001';
  END IF;
  next_version := current_version + 1;

  IF requested_operation = 'WatchlistPut' THEN
    IF NOT payload ?& ARRAY['instrumentId', 'displayName', 'validationState', 'expectedVersion']
       OR payload - ARRAY['instrumentId', 'displayName', 'validationState', 'expectedVersion']::text[] <> '{}'::jsonb THEN
      RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
    END IF;
    INSERT INTO etf.watchlist_items (
      instrument_id, display_name, validation_state, position, version
    ) VALUES (
      payload ->> 'instrumentId',
      payload ->> 'displayName',
      payload ->> 'validationState',
      instrument_count,
      next_version
    )
    ON CONFLICT (instrument_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      validation_state = EXCLUDED.validation_state,
      version = EXCLUDED.version;
  ELSIF requested_operation = 'WatchlistRemove' THEN
    IF NOT payload ?& ARRAY['instrumentId', 'expectedVersion']
       OR payload - ARRAY['instrumentId', 'expectedVersion']::text[] <> '{}'::jsonb THEN
      RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
    END IF;
    DELETE FROM etf.watchlist_items
     WHERE instrument_id = payload ->> 'instrumentId';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
    END IF;
    UPDATE etf.watchlist_items AS target
       SET position = ordered.position,
           version = next_version
      FROM (
        SELECT instrument_id, row_number() OVER (ORDER BY position, instrument_id) - 1 AS position
          FROM etf.watchlist_items
      ) AS ordered
     WHERE target.instrument_id = ordered.instrument_id;
  ELSIF requested_operation = 'WatchlistReorder' THEN
    IF NOT payload ?& ARRAY['orderedInstrumentIds', 'expectedVersion']
       OR payload - ARRAY['orderedInstrumentIds', 'expectedVersion']::text[] <> '{}'::jsonb
       OR jsonb_typeof(payload -> 'orderedInstrumentIds') <> 'array' THEN
      RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO requested_count
      FROM jsonb_array_elements_text(payload -> 'orderedInstrumentIds');
    IF requested_count <> instrument_count
       OR requested_count <> (
         SELECT count(DISTINCT identity)
           FROM jsonb_array_elements_text(payload -> 'orderedInstrumentIds') AS requested(identity)
       )
       OR EXISTS (
         SELECT 1
           FROM jsonb_array_elements_text(payload -> 'orderedInstrumentIds') AS requested(identity)
          WHERE NOT EXISTS (
            SELECT 1 FROM etf.watchlist_items WHERE instrument_id = requested.identity
          )
       ) THEN
      RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
    END IF;
    UPDATE etf.watchlist_items
       SET position = position + instrument_count;
    item_position := 0;
    FOR item IN SELECT value FROM jsonb_array_elements(payload -> 'orderedInstrumentIds') LOOP
      UPDATE etf.watchlist_items
         SET position = item_position,
             version = next_version
       WHERE instrument_id = item #>> '{}';
      item_position := item_position + 1;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;

  UPDATE etf.watchlist_state SET version = next_version WHERE singleton;

  RETURN jsonb_build_object(
    'orderedItems', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'instrumentId', instrument_id,
        'displayName', display_name,
        'validationState', validation_state,
        'position', position
      ) ORDER BY position, instrument_id)
        FROM etf.watchlist_items
    ), '[]'::jsonb),
    'version', next_version
  );
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
END;
$function$;
REVOKE ALL ON FUNCTION etf.watchlist_write(text, jsonb) FROM PUBLIC;

CREATE FUNCTION etf.job_start(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  created_job etf.jobs%ROWTYPE;
BEGIN
  IF payload IS NULL
     OR jsonb_typeof(payload) <> 'object'
  OR NOT payload ?& ARRAY['jobId', 'jobType', 'restartability', 'operation', 'originalCommandId', 'inputIdentity', 'createdAt']
  OR payload - ARRAY['jobId', 'jobType', 'restartability', 'operation', 'originalCommandId', 'inputIdentity', 'createdAt']::text[] <> '{}'::jsonb
  OR payload ->> 'jobId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  OR payload ->> 'originalCommandId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  OR payload ->> 'createdAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
  OR jsonb_typeof(payload -> 'inputIdentity') <> 'object' THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO etf.jobs (
    job_id, job_type, status, restartability, attempt, operation,
    original_command_id, input_identity, created_at, started_at, completed_at,
    accepted_count, rejected_count, controlling_error
  ) VALUES (
    (payload ->> 'jobId')::uuid,
    payload ->> 'jobType',
    'Pending',
    payload ->> 'restartability',
    1,
    payload ->> 'operation',
    (payload ->> 'originalCommandId')::uuid,
    payload -> 'inputIdentity',
    (payload ->> 'createdAt')::timestamp(3) with time zone,
    NULL,
    NULL,
    0,
    0,
    NULL
  ) RETURNING * INTO created_job;
  RETURN jsonb_build_object(
    'jobId', created_job.job_id,
    'jobType', created_job.job_type,
    'status', created_job.status,
    'restartability', created_job.restartability,
    'attempt', created_job.attempt,
    'operation', created_job.operation,
    'originalCommandId', created_job.original_command_id,
    'inputIdentity', created_job.input_identity,
    'createdAt', to_char(created_job.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'startedAt', NULL,
    'completedAt', NULL,
    'checkpoint', NULL,
    'acceptedCount', created_job.accepted_count,
    'rejectedCount', created_job.rejected_count,
    'controllingError', NULL
  );
EXCEPTION
  WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
END;
$function$;
REVOKE ALL ON FUNCTION etf.job_start(jsonb) FROM PUBLIC;

CREATE FUNCTION etf.job_restart(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  restarted_job etf.jobs%ROWTYPE;
BEGIN
  IF payload IS NULL
     OR jsonb_typeof(payload) <> 'object'
  OR NOT payload ? 'jobId'
  OR payload - ARRAY['jobId']::text[] <> '{}'::jsonb
  OR payload ->> 'jobId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO restarted_job
    FROM etf.jobs
   WHERE job_id = (payload ->> 'jobId')::uuid
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_JOB_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF restarted_job.status <> 'Failed' OR restarted_job.restartability <> 'Restartable' THEN
    RAISE EXCEPTION 'APPLICATION_JOB_NOT_RESTARTABLE' USING ERRCODE = 'P0001';
  END IF;
  UPDATE etf.jobs
     SET status = 'Pending',
         attempt = attempt + 1,
         started_at = NULL,
         completed_at = NULL,
         controlling_error = NULL
   WHERE job_id = restarted_job.job_id
   RETURNING * INTO restarted_job;
  RETURN jsonb_build_object(
    'jobId', restarted_job.job_id,
    'jobType', restarted_job.job_type,
    'status', restarted_job.status,
    'restartability', restarted_job.restartability,
    'attempt', restarted_job.attempt,
    'operation', restarted_job.operation,
    'originalCommandId', restarted_job.original_command_id,
    'inputIdentity', restarted_job.input_identity,
    'createdAt', to_char(restarted_job.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'startedAt', NULL,
    'completedAt', NULL,
    'acceptedCount', restarted_job.accepted_count,
    'rejectedCount', restarted_job.rejected_count,
    'controllingError', NULL
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
END;
$function$;
REVOKE ALL ON FUNCTION etf.job_restart(jsonb) FROM PUBLIC;

CREATE FUNCTION etf.readiness_append(payload jsonb) RETURNS uuid
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  inserted_id uuid;
BEGIN
  IF payload IS NULL
     OR jsonb_typeof(payload) <> 'object'
     OR NOT payload ?& ARRAY['readinessId', 'state', 'checkedAt', 'displayTimezone', 'liveness', 'dependencies', 'controllingError']
     OR payload - ARRAY['readinessId', 'state', 'checkedAt', 'displayTimezone', 'liveness', 'dependencies', 'controllingError']::text[] <> '{}'::jsonb
     OR payload ->> 'readinessId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR payload ->> 'checkedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
    OR payload ->> 'state' NOT IN ('Ready', 'NotReady')
    OR payload ->> 'displayTimezone' <> 'UTC'
    OR payload ->> 'liveness' NOT IN ('Live', 'NotLive')
    OR (payload ->> 'state' = 'Ready' AND payload -> 'controllingError' <> 'null'::jsonb)
    OR (payload ->> 'state' = 'NotReady' AND jsonb_typeof(payload -> 'controllingError') <> 'object')
     OR jsonb_typeof(payload -> 'dependencies') <> 'array'
     OR jsonb_array_length(payload -> 'dependencies') <> 6
     OR ARRAY(
       SELECT dependency ->> 'dependency'
         FROM jsonb_array_elements(payload -> 'dependencies') WITH ORDINALITY AS entry(dependency, position)
        ORDER BY position
     ) <> ARRAY['PostgreSQL', 'Migrations', 'FixturePolicy', 'LocalDependency', 'DenialAudit', 'LedgerIntegrity']
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(payload -> 'dependencies') AS entry(dependency)
        WHERE jsonb_typeof(dependency) <> 'object'
           OR NOT dependency ?& ARRAY['dependency', 'state', 'checkedAt', 'code']
           OR dependency - ARRAY['dependency', 'state', 'checkedAt', 'code']::text[] <> '{}'::jsonb
           OR dependency ->> 'state' NOT IN ('Ready', 'NotReady')
           OR dependency ->> 'checkedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
           OR jsonb_typeof(dependency -> 'code') NOT IN ('string', 'null')
     ) THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO etf.readiness_audit (
    readiness_id, state, checked_at, display_timezone, liveness,
    dependencies, controlling_error
  ) VALUES (
    (payload ->> 'readinessId')::uuid,
    payload ->> 'state',
    (payload ->> 'checkedAt')::timestamp(3) with time zone,
    payload ->> 'displayTimezone',
    payload ->> 'liveness',
    payload -> 'dependencies',
    NULLIF(payload -> 'controllingError', 'null'::jsonb)
  ) RETURNING readiness_id INTO inserted_id;
  RETURN inserted_id;
EXCEPTION
  WHEN invalid_text_representation OR datetime_field_overflow THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
END;
$function$;
REVOKE ALL ON FUNCTION etf.readiness_append(jsonb) FROM PUBLIC;

SET LOCAL ROLE schema_owner;
REVOKE CREATE ON SCHEMA etf FROM application_writer_owner;
SET LOCAL ROLE migration_owner;
`;

export const applicationMigration: MigrationArtifact = {
  migrationId: "0002-application",
  sequence: 2,
  sql,
};
