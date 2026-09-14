import type { MigrationArtifact } from "../migration-set.js";

export const analyticsEvidenceTableNames = [
  "analytics_input_sets",
  "analytics_evidence_bundles",
  "analytics_manifests",
  "analytics_lifecycle_references",
  "analytics_deletion_links",
  "analytics_retention_bindings",
  "analytics_evidence_replays",
  "analytics_publications",
  "analytics_audit",
] as const;

export const analyticsEvidenceFunctionNames = [
  "_evidence_rfc8785",
  "evidence_commit",
  "evidence_read",
] as const;

const sql = `SET LOCAL ROLE schema_owner;
GRANT USAGE, CREATE ON SCHEMA etf TO evidence_writer_owner;
SET LOCAL ROLE evidence_writer_owner;

CREATE TABLE etf.analytics_input_sets (
  input_set_id text COLLATE "C" NOT NULL,
  input_schema_version text COLLATE "C" NOT NULL,
  evaluation_at timestamp(3) with time zone NOT NULL,
  canonical_content jsonb NOT NULL,
  input_hash character(64) COLLATE "C" NOT NULL,
  portfolio_context_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_analytics_input_sets PRIMARY KEY (input_set_id),
  CONSTRAINT ck_analytics_input_sets__identity CHECK (length(input_set_id) > 0 AND length(input_schema_version) > 0),
  CONSTRAINT ck_analytics_input_sets__hashes CHECK (input_hash ~ '^[0-9a-f]{64}$' AND portfolio_context_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE etf.analytics_evidence_bundles (
  evidence_id text COLLATE "C" NOT NULL,
  evidence_schema_version text COLLATE "C" NOT NULL,
  baseline_version text COLLATE "C" NOT NULL,
  input_set_id text COLLATE "C" NOT NULL,
  evaluation_at timestamp(3) with time zone NOT NULL,
  reproducibility_status text COLLATE "C" NOT NULL,
  reason text COLLATE "C",
  configuration jsonb NOT NULL,
  result jsonb NOT NULL,
  input_hash character(64) COLLATE "C" NOT NULL,
  configuration_hash character(64) COLLATE "C" NOT NULL,
  result_hash character(64) COLLATE "C" NOT NULL,
  bundle_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_analytics_evidence_bundles PRIMARY KEY (evidence_id),
  CONSTRAINT uq_analytics_evidence_bundles__evidence_id_bundle_hash UNIQUE (evidence_id, bundle_hash),
  CONSTRAINT fk_analytics_bundles__input_set__analytics_input_sets FOREIGN KEY (input_set_id) REFERENCES etf.analytics_input_sets (input_set_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_analytics_bundles__identity CHECK (length(evidence_id) > 0 AND length(evidence_schema_version) > 0 AND baseline_version = 'v1.0.0'),
  CONSTRAINT ck_analytics_bundles__reproducibility CHECK ((reproducibility_status = 'Complete' AND reason IS NULL) OR (reproducibility_status = 'Degraded' AND length(reason) > 0)),
  CONSTRAINT ck_analytics_bundles__hashes CHECK (input_hash ~ '^[0-9a-f]{64}$' AND configuration_hash ~ '^[0-9a-f]{64}$' AND result_hash ~ '^[0-9a-f]{64}$' AND bundle_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE etf.analytics_manifests (
  manifest_id text COLLATE "C" NOT NULL,
  manifest_sequence bigint NOT NULL,
  previous_manifest_hash character(64) COLLATE "C",
  evidence_id text COLLATE "C" NOT NULL,
  retention_policy_version text COLLATE "C" NOT NULL,
  retention_epoch timestamp(3) with time zone NOT NULL,
  canonical_content jsonb NOT NULL,
  manifest_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_analytics_manifests PRIMARY KEY (manifest_id),
  CONSTRAINT uq_analytics_manifests__manifest_sequence UNIQUE (manifest_sequence),
  CONSTRAINT fk_analytics_manifests__evidence__bundles FOREIGN KEY (evidence_id) REFERENCES etf.analytics_evidence_bundles (evidence_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_analytics_manifests__sequence CHECK (manifest_sequence >= 0 AND ((manifest_sequence = 0 AND previous_manifest_hash IS NULL) OR (manifest_sequence > 0 AND previous_manifest_hash ~ '^[0-9a-f]{64}$'))),
  CONSTRAINT ck_analytics_manifests__retention CHECK (retention_policy_version = 'RET-A-1.0'),
  CONSTRAINT ck_analytics_manifests__hash CHECK (manifest_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX ix_analytics_manifests__evidence_id_manifest_sequence ON etf.analytics_manifests (evidence_id COLLATE "C", manifest_sequence);

CREATE TABLE etf.analytics_lifecycle_references (
  evidence_id text COLLATE "C" NOT NULL,
  lifecycle_sequence bigint NOT NULL,
  state text COLLATE "C" NOT NULL,
  event_at timestamp(3) with time zone NOT NULL,
  event_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_analytics_lifecycle_references PRIMARY KEY (evidence_id, lifecycle_sequence),
  CONSTRAINT fk_analytics_lifecycle__evidence__bundles FOREIGN KEY (evidence_id) REFERENCES etf.analytics_evidence_bundles (evidence_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_analytics_lifecycle__sequence CHECK (lifecycle_sequence >= 0),
  CONSTRAINT ck_analytics_lifecycle__state CHECK (state IN ('Hot', 'Archived', 'Quarantined', 'DeletionFrozen', 'ExpiredFrozen', 'PendingBackupExpiry')),
  CONSTRAINT ck_analytics_lifecycle__event_hash CHECK (event_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE etf.analytics_deletion_links (
  evidence_id text COLLATE "C" NOT NULL,
  deletion_certificate_id text COLLATE "C" NOT NULL,
  target_class text COLLATE "C" NOT NULL,
  certificate_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_analytics_deletion_links PRIMARY KEY (evidence_id, deletion_certificate_id),
  CONSTRAINT fk_analytics_deletion__evidence__bundles FOREIGN KEY (evidence_id) REFERENCES etf.analytics_evidence_bundles (evidence_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_analytics_deletion__identity CHECK (length(deletion_certificate_id) > 0),
  CONSTRAINT ck_analytics_deletion__target_class CHECK (target_class IN ('RawEligible', 'FullBundle', 'AuditManifest', 'DeletionCertificate', 'OperationalMetadata')),
  CONSTRAINT ck_analytics_deletion__hash CHECK (certificate_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE etf.analytics_retention_bindings (
  evidence_id text COLLATE "C" NOT NULL,
  retention_epoch timestamp(3) with time zone NOT NULL,
  target_class text COLLATE "C" NOT NULL,
  retain_through timestamp(3) with time zone NOT NULL,
  lifecycle_state text COLLATE "C" NOT NULL,
  retention_policy_version text COLLATE "C" NOT NULL,
  CONSTRAINT pk_analytics_retention_bindings PRIMARY KEY (evidence_id, retention_epoch, target_class),
  CONSTRAINT fk_analytics_retention__evidence__bundles FOREIGN KEY (evidence_id) REFERENCES etf.analytics_evidence_bundles (evidence_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_analytics_retention__target_class CHECK (target_class IN ('RawEligible', 'FullBundle', 'AuditManifest', 'DeletionCertificate', 'OperationalMetadata')),
  CONSTRAINT ck_analytics_retention__lifecycle CHECK (lifecycle_state IN ('Hot', 'Archived', 'Quarantined', 'DeletionFrozen', 'ExpiredFrozen', 'PendingBackupExpiry')),
  CONSTRAINT ck_analytics_retention__policy CHECK (retention_policy_version = 'RET-A-1.0')
);
CREATE INDEX ix_analytics_retention__evidence_id_retention_epoch ON etf.analytics_retention_bindings (evidence_id COLLATE "C", retention_epoch);

CREATE TABLE etf.analytics_evidence_replays (
  evidence_id text COLLATE "C" NOT NULL,
  evidence_commit_command_id uuid NOT NULL,
  canonical_content jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_analytics_evidence_replays PRIMARY KEY (evidence_id, evidence_commit_command_id),
  CONSTRAINT fk_analytics_replays__evidence__bundles FOREIGN KEY (evidence_id) REFERENCES etf.analytics_evidence_bundles (evidence_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE
);

CREATE TABLE etf.analytics_publications (
  publication_target_id text COLLATE "C" NOT NULL,
  publication_version bigint NOT NULL,
  evidence_id text COLLATE "C" NOT NULL,
  published_at timestamp(3) with time zone NOT NULL,
  bundle_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_analytics_publications PRIMARY KEY (publication_target_id),
  CONSTRAINT uq_analytics_publications__evidence_id_bundle_hash UNIQUE (evidence_id, bundle_hash),
  CONSTRAINT fk_analytics_publications__evidence_bundle FOREIGN KEY (evidence_id, bundle_hash) REFERENCES etf.analytics_evidence_bundles (evidence_id, bundle_hash) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_analytics_publications__identity CHECK (length(publication_target_id) > 0),
  CONSTRAINT ck_analytics_publications__version CHECK (publication_version >= 0),
  CONSTRAINT ck_analytics_publications__hash CHECK (bundle_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX ix_analytics_publications__evidence_id ON etf.analytics_publications (evidence_id COLLATE "C");

CREATE TABLE etf.analytics_audit (
  audit_id uuid NOT NULL,
  evidence_id text COLLATE "C",
  publication_target_id text COLLATE "C",
  action text COLLATE "C" NOT NULL,
  outcome text COLLATE "C" NOT NULL,
  error_code text COLLATE "C",
  created_at timestamp(3) with time zone NOT NULL,
  audit_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_analytics_audit PRIMARY KEY (audit_id),
  CONSTRAINT fk_analytics_audit__evidence__bundles FOREIGN KEY (evidence_id) REFERENCES etf.analytics_evidence_bundles (evidence_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_analytics_audit__publication FOREIGN KEY (publication_target_id) REFERENCES etf.analytics_publications (publication_target_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_analytics_audit__identity CHECK (evidence_id IS NOT NULL OR publication_target_id IS NOT NULL),
  CONSTRAINT ck_analytics_audit__action CHECK (action IN ('EvidenceCommit', 'EvidenceRead', 'PublicationReplace', 'Archive', 'Restore', 'Delete', 'LifecycleAdmin')),
  CONSTRAINT ck_analytics_audit__outcome CHECK (outcome IN ('Committed', 'Rejected', 'PermissionDenied')),
  CONSTRAINT ck_analytics_audit__error CHECK ((outcome = 'Committed' AND error_code IS NULL) OR (outcome <> 'Committed' AND length(error_code) > 0)),
  CONSTRAINT ck_analytics_audit__hash CHECK (audit_hash ~ '^[0-9a-f]{64}$')
);

CREATE FUNCTION etf._evidence_rfc8785(value jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE SECURITY INVOKER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  value_kind text := jsonb_typeof(value);
  canonical text;
  numeric_text text;
BEGIN
  CASE value_kind
    WHEN 'null' THEN RETURN 'null';
    WHEN 'boolean' THEN RETURN value::text;
    WHEN 'string' THEN RETURN to_jsonb(value #>> '{}')::text;
    WHEN 'number' THEN
      numeric_text := value::text;
      IF numeric_text !~ '^-?(0|[1-9][0-9]*)$'
         OR numeric_text::numeric < -9007199254740991
         OR numeric_text::numeric > 9007199254740991 THEN
        RAISE EXCEPTION 'ANALYTICS_NUMERIC_CLASS_INVALID' USING ERRCODE = '22023';
      END IF;
      RETURN numeric_text;
    WHEN 'array' THEN
      SELECT '[' || COALESCE(string_agg(etf._evidence_rfc8785(item.element), ',' ORDER BY item.ordinal), '') || ']'
        INTO canonical
        FROM jsonb_array_elements(value) WITH ORDINALITY AS item(element, ordinal);
      RETURN canonical;
    WHEN 'object' THEN
      SELECT '{' || COALESCE(string_agg(
               to_jsonb(entry.key)::text || ':' || etf._evidence_rfc8785(entry.element),
               ',' ORDER BY entry.utf16_key COLLATE "C"
             ), '') || '}'
        INTO canonical
        FROM (
          SELECT object_entry.key, object_entry.element,
                 (SELECT string_agg(
                    CASE
                      WHEN codepoint.value <= 65535 THEN lpad(to_hex(codepoint.value), 4, '0')
                      ELSE lpad(to_hex(55296 + ((codepoint.value - 65536) >> 10)), 4, '0') ||
                           lpad(to_hex(56320 + ((codepoint.value - 65536) & 1023)), 4, '0')
                    END,
                    '' ORDER BY character_position
                  )
                    FROM generate_series(1, char_length(object_entry.key)) AS character(character_position)
                   CROSS JOIN LATERAL (SELECT ascii(substr(object_entry.key, character_position, 1))) AS codepoint(value)
                 ) AS utf16_key
            FROM jsonb_each(value) AS object_entry(key, element)
        ) AS entry;
      RETURN canonical;
    ELSE
      RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
  END CASE;
END;
$function$;

CREATE FUNCTION etf.evidence_commit(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  canonical_content jsonb;
  replay_record record;
  retention_epoch timestamp(3) with time zone;
  retention_epoch_text text;
  current_version bigint;
  next_version bigint;
  manifest_sequence bigint;
  previous_manifest_hash text;
  manifest_id text;
  input_hash text;
  configuration_hash text;
  result_hash text;
  event_hash text;
  bundle_hash text;
  manifest_hash text;
  lifecycle_record jsonb;
  bundle_record jsonb;
  manifest_record jsonb;
  audit_record jsonb;
  commit_result jsonb;
  item_index integer;
  decimal_value text;
  supplied_hash text;
BEGIN
  IF jsonb_typeof(payload) <> 'object'
     OR NOT (payload ?& ARRAY[
       'evidenceId', 'evidenceCommitCommandId', 'publicationTargetId',
       'expectedPublicationVersion', 'baselineVersion', 'retentionPolicyVersion',
       'inputSetId', 'inputSchemaVersion', 'evaluationAt', 'canonicalInput',
       'evidenceSchemaVersion', 'canonicalConfiguration', 'canonicalResult',
       'reproducibilityStatus', 'reproducibilityReason'
     ])
     OR payload ?| ARRAY['retentionEpoch', 'retainThrough', 'bundleHash', 'manifestHash', 'canonicalManifest']
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(payload) AS field(name)
        WHERE field.name <> ALL (ARRAY[
          'evidenceId', 'evidenceCommitCommandId', 'publicationTargetId',
          'expectedPublicationVersion', 'baselineVersion', 'retentionPolicyVersion',
          'inputSetId', 'inputSchemaVersion', 'evaluationAt', 'canonicalInput',
          'evidenceSchemaVersion', 'canonicalConfiguration', 'canonicalResult',
          'reproducibilityStatus', 'reproducibilityReason'
        ])
     ) THEN
    RAISE EXCEPTION 'ANALYTICS_INPUT_INCOMPLETE' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(payload -> 'evidenceId') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload -> 'evidenceCommitCommandId') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload -> 'publicationTargetId') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload -> 'expectedPublicationVersion') IS DISTINCT FROM 'number'
     OR jsonb_typeof(payload -> 'baselineVersion') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload -> 'retentionPolicyVersion') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload -> 'inputSetId') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload -> 'inputSchemaVersion') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload -> 'evaluationAt') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload -> 'evidenceSchemaVersion') IS DISTINCT FROM 'string'
     OR jsonb_typeof(payload -> 'reproducibilityStatus') IS DISTINCT FROM 'string'
    OR jsonb_typeof(payload -> 'reproducibilityReason') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'ANALYTICS_INPUT_INCOMPLETE' USING ERRCODE = '22023';
  END IF;
  IF length(payload ->> 'evidenceId') = 0
     OR length(payload ->> 'publicationTargetId') = 0
     OR length(payload ->> 'inputSetId') = 0
     OR length(payload ->> 'inputSchemaVersion') = 0
     OR length(payload ->> 'evidenceSchemaVersion') = 0
     OR payload ->> 'expectedPublicationVersion' !~ '^(0|[1-9][0-9]{0,18})$'
    OR (payload ->> 'expectedPublicationVersion')::numeric > 9223372036854775807
     OR NOT pg_input_is_valid(payload ->> 'evidenceCommitCommandId', 'uuid') THEN
    RAISE EXCEPTION 'ANALYTICS_INPUT_INCOMPLETE' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(payload -> 'canonicalInput') IS DISTINCT FROM 'object'
     OR jsonb_typeof(payload -> 'canonicalConfiguration') IS DISTINCT FROM 'object'
     OR jsonb_typeof(payload -> 'canonicalResult') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(payload -> 'canonicalInput' -> 'economicVintages') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload -> 'canonicalInput' -> 'marketObservations') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload -> 'canonicalInput' -> 'transformationLineage') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'providerPolicyReferences') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload -> 'canonicalResult' -> 'metrics') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload -> 'canonicalResult' -> 'signals') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload -> 'canonicalResult' -> 'trades') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload -> 'canonicalResult' -> 'warnings') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(payload -> 'canonicalInput') = 'object'
     AND jsonb_typeof(payload -> 'canonicalConfiguration') = 'object'
     AND jsonb_typeof(payload -> 'canonicalResult') = 'object'
     AND (
       payload -> 'canonicalConfiguration' ->> 'inputHash' <>
         encode(public.digest(convert_to(etf._evidence_rfc8785(payload -> 'canonicalInput'), 'UTF8'), 'sha256'), 'hex')
       OR payload -> 'canonicalResult' ->> 'configurationHash' <>
         encode(public.digest(convert_to(etf._evidence_rfc8785(payload -> 'canonicalConfiguration'), 'UTF8'), 'sha256'), 'hex')
     ) THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
  END IF;

  FOREACH decimal_value IN ARRAY ARRAY['costRate', 'slippageRate'] LOOP
    IF payload #>> ARRAY['canonicalConfiguration', 'assumptions', decimal_value] ~ '^-0\.0{12}$' THEN
      payload := jsonb_set(payload,
        ARRAY['canonicalConfiguration', 'assumptions', decimal_value],
        to_jsonb('0.000000000000'::text), false);
    END IF;
  END LOOP;
  FOR item_index IN 0..jsonb_array_length(coalesce(payload #> '{canonicalInput,marketObservations}', '[]'::jsonb)) - 1 LOOP
    IF payload #>> ARRAY['canonicalInput', 'marketObservations', item_index::text, 'value'] ~ '^-0\.0{10}$' THEN
      payload := jsonb_set(payload, ARRAY['canonicalInput', 'marketObservations', item_index::text, 'value'], to_jsonb('0.0000000000'::text), false);
    END IF;
  END LOOP;
  FOR item_index IN 0..jsonb_array_length(coalesce(payload #> '{canonicalInput,economicVintages}', '[]'::jsonb)) - 1 LOOP
    IF payload #>> ARRAY['canonicalInput', 'economicVintages', item_index::text, 'value'] ~ '^-0\.0{10}$' THEN
      payload := jsonb_set(payload, ARRAY['canonicalInput', 'economicVintages', item_index::text, 'value'], to_jsonb('0.0000000000'::text), false);
    END IF;
  END LOOP;
  FOR item_index IN 0..jsonb_array_length(coalesce(payload #> '{canonicalInput,transformationLineage}', '[]'::jsonb)) - 1 LOOP
    supplied_hash := payload #>> ARRAY['canonicalInput', 'transformationLineage', item_index::text, 'outputHash'];
    decimal_value := payload #>> ARRAY['canonicalInput', 'transformationLineage', item_index::text, 'outputValue'];
    IF decimal_value ~ '^-0\.0+$' THEN
      payload := jsonb_set(payload,
        ARRAY['canonicalInput', 'transformationLineage', item_index::text, 'outputValue'],
        to_jsonb(regexp_replace(decimal_value, '^-', '')::text), false);
    END IF;
    IF supplied_hash <> encode(public.digest(convert_to(etf._evidence_rfc8785(
        (payload #> ARRAY['canonicalInput', 'transformationLineage', item_index::text]) - 'outputHash' ||
          jsonb_build_object('domain', 'etf.analytics.transformation.v1')
      ), 'UTF8'), 'sha256'), 'hex') THEN
      RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOR item_index IN 0..jsonb_array_length(coalesce(payload #> '{canonicalResult,signals}', '[]'::jsonb)) - 1 LOOP
    IF payload #>> ARRAY['canonicalResult', 'signals', item_index::text, 'score'] ~ '^-0\.0{12}$' THEN
      payload := jsonb_set(payload, ARRAY['canonicalResult', 'signals', item_index::text, 'score'], to_jsonb('0.000000000000'::text), false);
    END IF;
  END LOOP;
  FOR item_index IN 0..jsonb_array_length(coalesce(payload #> '{canonicalResult,trades}', '[]'::jsonb)) - 1 LOOP
    FOREACH decimal_value IN ARRAY ARRAY['quantity', 'unitPrice', 'grossValue', 'fee'] LOOP
      IF payload #>> ARRAY['canonicalResult', 'trades', item_index::text, decimal_value] ~ '^-0\.0+$' THEN
        payload := jsonb_set(payload,
          ARRAY['canonicalResult', 'trades', item_index::text, decimal_value],
          to_jsonb(regexp_replace(payload #>> ARRAY['canonicalResult', 'trades', item_index::text, decimal_value], '^-', '')::text), false);
      END IF;
    END LOOP;
  END LOOP;
  FOR item_index IN 0..jsonb_array_length(coalesce(payload #> '{canonicalResult,metrics}', '[]'::jsonb)) - 1 LOOP
    decimal_value := payload #>> ARRAY['canonicalResult', 'metrics', item_index::text, 'value'];
    IF decimal_value ~ '^-0\.0+$' THEN
      payload := jsonb_set(payload, ARRAY['canonicalResult', 'metrics', item_index::text, 'value'], to_jsonb(regexp_replace(decimal_value, '^-', '')::text), false);
    END IF;
  END LOOP;
  IF jsonb_typeof(payload -> 'canonicalInput') = 'object'
     AND jsonb_typeof(payload -> 'canonicalConfiguration') = 'object'
     AND jsonb_typeof(payload -> 'canonicalResult') = 'object' THEN
    payload := jsonb_set(payload, '{canonicalConfiguration,inputHash}', to_jsonb(
      encode(public.digest(convert_to(etf._evidence_rfc8785(payload -> 'canonicalInput'), 'UTF8'), 'sha256'), 'hex')
    ), false);
    payload := jsonb_set(payload, '{canonicalResult,configurationHash}', to_jsonb(
      encode(public.digest(convert_to(etf._evidence_rfc8785(payload -> 'canonicalConfiguration'), 'UTF8'), 'sha256'), 'hex')
    ), false);
  END IF;
  canonical_content := payload - 'expectedPublicationVersion';

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'etf:analytics-replay:' || (payload ->> 'evidenceId') || ':' ||
      (payload ->> 'evidenceCommitCommandId'), 0
  ));

  SELECT replay.canonical_content, replay.result INTO replay_record
    FROM etf.analytics_evidence_replays AS replay
   WHERE replay.evidence_id = payload ->> 'evidenceId'
     AND replay.evidence_commit_command_id = (payload ->> 'evidenceCommitCommandId')::uuid;
  IF FOUND THEN
    IF replay_record.canonical_content = canonical_content THEN
      RETURN replay_record.result;
    END IF;
    RAISE EXCEPTION 'ANALYTICS_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
  END IF;

  IF payload ->> 'baselineVersion' <> 'v1.0.0'
     OR payload ->> 'retentionPolicyVersion' <> 'RET-A-1.0'
      OR payload ->> 'evaluationAt' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$'
     OR jsonb_typeof(payload -> 'canonicalInput') <> 'object'
     OR jsonb_typeof(payload -> 'canonicalConfiguration') <> 'object'
     OR jsonb_typeof(payload -> 'canonicalResult') <> 'object'
     OR payload ->> 'reproducibilityStatus' NOT IN ('Complete', 'Degraded')
     OR (payload ->> 'reproducibilityStatus' = 'Complete' AND
         payload -> 'reproducibilityReason' <> 'null'::jsonb)
     OR (payload ->> 'reproducibilityStatus' = 'Degraded' AND (
         jsonb_typeof(payload -> 'reproducibilityReason') IS DISTINCT FROM 'string'
         OR payload ->> 'reproducibilityReason' !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
       )) THEN
    RAISE EXCEPTION 'ANALYTICS_INPUT_INCOMPLETE' USING ERRCODE = '22023';
  END IF;

  IF NOT (payload -> 'canonicalInput' ?& ARRAY[
       'domain', 'economicVintages', 'evaluationAt', 'inputSchemaVersion',
       'marketObservations', 'portfolioContextHash', 'transformationLineage'
     ])
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(payload -> 'canonicalInput') AS field(name)
        WHERE field.name <> ALL (ARRAY[
          'domain', 'economicVintages', 'evaluationAt', 'inputSchemaVersion',
          'marketObservations', 'portfolioContextHash', 'transformationLineage'
        ])
     )
     OR NOT (payload -> 'canonicalConfiguration' ?& ARRAY[
       'assumptions', 'baselineVersion', 'benchmark', 'codeHash', 'domain',
       'environment', 'evaluationAt', 'inputHash', 'parameters',
       'providerPolicyReferences', 'ruleId', 'ruleVersion', 'seed'
     ])
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(payload -> 'canonicalConfiguration') AS field(name)
        WHERE field.name <> ALL (ARRAY[
          'assumptions', 'baselineVersion', 'benchmark', 'codeHash', 'domain',
          'environment', 'evaluationAt', 'inputHash', 'parameters',
          'providerPolicyReferences', 'ruleId', 'ruleVersion', 'seed'
        ])
     )
     OR NOT (payload -> 'canonicalResult' ?& ARRAY[
       'configurationHash', 'domain', 'metrics', 'resultSchemaVersion',
       'signals', 'trades', 'warnings'
     ])
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(payload -> 'canonicalResult') AS field(name)
        WHERE field.name <> ALL (ARRAY[
          'configurationHash', 'domain', 'metrics', 'resultSchemaVersion',
          'signals', 'trades', 'warnings'
        ])
     )
     OR jsonb_typeof(payload -> 'canonicalInput' -> 'economicVintages') <> 'array'
     OR jsonb_typeof(payload -> 'canonicalInput' -> 'marketObservations') <> 'array'
     OR jsonb_typeof(payload -> 'canonicalInput' -> 'transformationLineage') <> 'array'
     OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'assumptions') <> 'object'
     OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'benchmark') <> 'object'
     OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'environment') <> 'object'
     OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'parameters') <> 'object'
     OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'providerPolicyReferences') <> 'array'
     OR jsonb_typeof(payload -> 'canonicalResult' -> 'metrics') <> 'array'
     OR jsonb_typeof(payload -> 'canonicalResult' -> 'signals') <> 'array'
     OR jsonb_typeof(payload -> 'canonicalResult' -> 'trades') <> 'array'
     OR jsonb_typeof(payload -> 'canonicalResult' -> 'warnings') <> 'array' THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
  END IF;

  IF payload -> 'canonicalInput' ->> 'domain' <> 'etf.analytics.input.v1'
     OR payload -> 'canonicalInput' ->> 'inputSchemaVersion' <> payload ->> 'inputSchemaVersion'
     OR payload -> 'canonicalInput' ->> 'evaluationAt' <> payload ->> 'evaluationAt'
     OR payload -> 'canonicalConfiguration' ->> 'domain' <> 'etf.analytics.configuration.v1'
     OR payload -> 'canonicalConfiguration' ->> 'baselineVersion' <> payload ->> 'baselineVersion'
     OR payload -> 'canonicalConfiguration' ->> 'evaluationAt' <> payload ->> 'evaluationAt'
     OR payload -> 'canonicalResult' ->> 'domain' <> 'etf.analytics.result.v1'
     OR payload -> 'canonicalResult' ->> 'resultSchemaVersion' <> '1.0.0'
     OR (payload -> 'canonicalConfiguration' -> 'providerPolicyReferences') <>
        (SELECT coalesce(jsonb_agg(reference ORDER BY reference COLLATE "C"), '[]'::jsonb)
           FROM jsonb_array_elements_text(
             payload -> 'canonicalConfiguration' -> 'providerPolicyReferences'
           ) AS item(reference))
     OR (SELECT count(*) <> count(DISTINCT reference)
           FROM jsonb_array_elements_text(
             payload -> 'canonicalConfiguration' -> 'providerPolicyReferences'
           ) AS item(reference))
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'signals') AS item(signal)
        WHERE jsonb_typeof(item.signal) <> 'object'
           OR NOT (item.signal ?& ARRAY['instrumentId', 'label', 'score'])
           OR EXISTS (
             SELECT 1 FROM jsonb_object_keys(item.signal) AS field(name)
              WHERE field.name <> ALL (ARRAY['instrumentId', 'label', 'score'])
           )
           OR jsonb_typeof(item.signal -> 'instrumentId') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.signal -> 'label') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.signal -> 'score') IS DISTINCT FROM 'string'
           OR length(item.signal ->> 'instrumentId') = 0
           OR length(item.signal ->> 'label') = 0
     )
     OR (payload -> 'canonicalResult' -> 'signals') <>
        (SELECT coalesce(jsonb_agg(item.signal ORDER BY item.signal ->> 'instrumentId' COLLATE "C"), '[]'::jsonb)
           FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'signals') AS item(signal))
     OR (SELECT count(*) <> count(DISTINCT item.signal ->> 'instrumentId')
           FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'signals') AS item(signal)) THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
  END IF;

  IF NOT (payload -> 'canonicalConfiguration' -> 'assumptions' ?&
       ARRAY['costRate', 'fillTiming', 'slippageRate'])
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(payload -> 'canonicalConfiguration' -> 'assumptions') AS field(name)
        WHERE field.name <> ALL (ARRAY['costRate', 'fillTiming', 'slippageRate'])
     )
     OR NOT (payload -> 'canonicalConfiguration' -> 'benchmark' ?& ARRAY['instrumentId', 'version'])
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(payload -> 'canonicalConfiguration' -> 'benchmark') AS field(name)
        WHERE field.name <> ALL (ARRAY['instrumentId', 'version'])
     )
     OR NOT (payload -> 'canonicalConfiguration' -> 'environment' ?& ARRAY['dependencyLockHash', 'runtime'])
     OR EXISTS (
       SELECT 1 FROM jsonb_object_keys(payload -> 'canonicalConfiguration' -> 'environment') AS field(name)
        WHERE field.name <> ALL (ARRAY['dependencyLockHash', 'runtime'])
     )
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'assumptions' -> 'costRate') IS DISTINCT FROM 'string'
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'assumptions' -> 'fillTiming') IS DISTINCT FROM 'string'
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'assumptions' -> 'slippageRate') IS DISTINCT FROM 'string'
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'benchmark' -> 'instrumentId') IS DISTINCT FROM 'string'
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'benchmark' -> 'version') IS DISTINCT FROM 'string'
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'environment' -> 'dependencyLockHash') IS DISTINCT FROM 'string'
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'environment' -> 'runtime') IS DISTINCT FROM 'string'
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'codeHash') IS DISTINCT FROM 'string'
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'ruleId') IS DISTINCT FROM 'string'
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'ruleVersion') IS DISTINCT FROM 'string'
        OR jsonb_typeof(payload -> 'canonicalConfiguration' -> 'seed') IS DISTINCT FROM 'string'
        OR length(payload -> 'canonicalConfiguration' -> 'benchmark' ->> 'instrumentId') = 0
        OR length(payload -> 'canonicalConfiguration' -> 'benchmark' ->> 'version') = 0
        OR length(payload -> 'canonicalConfiguration' -> 'environment' ->> 'runtime') = 0
        OR length(payload -> 'canonicalConfiguration' ->> 'ruleId') = 0
        OR length(payload -> 'canonicalConfiguration' ->> 'ruleVersion') = 0
     OR jsonb_path_exists(
       payload -> 'canonicalConfiguration' -> 'parameters',
       '$.** ? (@.type() == "number")'
     )
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'marketObservations') AS item(observation)
        WHERE jsonb_typeof(item.observation) <> 'object'
           OR NOT (item.observation ?& ARRAY[
             'instrumentId', 'tradingDate', 'providerId', 'adjustmentPolicy',
             'revision', 'sourceAvailableAt', 'value'
           ])
           OR EXISTS (
             SELECT 1 FROM jsonb_object_keys(item.observation) AS field(name)
              WHERE field.name <> ALL (ARRAY[
                'instrumentId', 'tradingDate', 'providerId', 'adjustmentPolicy',
                'revision', 'sourceAvailableAt', 'value'
              ])
           )
              OR jsonb_typeof(item.observation -> 'instrumentId') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.observation -> 'tradingDate') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.observation -> 'providerId') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.observation -> 'adjustmentPolicy') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.observation -> 'revision') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.observation -> 'sourceAvailableAt') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.observation -> 'value') IS DISTINCT FROM 'string'
               OR length(item.observation ->> 'instrumentId') = 0
               OR length(item.observation ->> 'providerId') = 0
               OR length(item.observation ->> 'adjustmentPolicy') = 0
               OR length(item.observation ->> 'revision') = 0
           OR item.observation ->> 'tradingDate' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])$'
              OR NOT pg_input_is_valid(item.observation ->> 'tradingDate', 'date')
           OR item.observation ->> 'sourceAvailableAt' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$'
           OR NOT pg_input_is_valid(item.observation ->> 'sourceAvailableAt', 'timestamp with time zone')
     )
     OR (payload -> 'canonicalInput' -> 'marketObservations') <>
        (SELECT coalesce(jsonb_agg(item.observation ORDER BY
           item.observation ->> 'instrumentId' COLLATE "C",
           item.observation ->> 'tradingDate' COLLATE "C",
           item.observation ->> 'providerId' COLLATE "C",
           item.observation ->> 'adjustmentPolicy' COLLATE "C",
           item.observation ->> 'revision' COLLATE "C"), '[]'::jsonb)
           FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'marketObservations') AS item(observation))
     OR (SELECT count(*) <> count(DISTINCT jsonb_build_array(
           item.observation ->> 'instrumentId', item.observation ->> 'tradingDate',
           item.observation ->> 'providerId', item.observation ->> 'adjustmentPolicy',
           item.observation ->> 'revision'))
           FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'marketObservations') AS item(observation))
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'economicVintages') AS item(vintage)
        WHERE jsonb_typeof(item.vintage) <> 'object'
           OR NOT (item.vintage ?& ARRAY[
             'providerId', 'seriesId', 'observationDate', 'releaseTimestamp', 'vintageId', 'value'
           ])
           OR EXISTS (
             SELECT 1 FROM jsonb_object_keys(item.vintage) AS field(name)
              WHERE field.name <> ALL (ARRAY[
                'providerId', 'seriesId', 'observationDate', 'releaseTimestamp', 'vintageId', 'value'
              ])
           )
              OR jsonb_typeof(item.vintage -> 'providerId') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.vintage -> 'seriesId') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.vintage -> 'observationDate') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.vintage -> 'releaseTimestamp') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.vintage -> 'vintageId') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.vintage -> 'value') IS DISTINCT FROM 'string'
               OR length(item.vintage ->> 'providerId') = 0
               OR length(item.vintage ->> 'seriesId') = 0
               OR length(item.vintage ->> 'vintageId') = 0
           OR item.vintage ->> 'observationDate' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])$'
              OR NOT pg_input_is_valid(item.vintage ->> 'observationDate', 'date')
           OR item.vintage ->> 'releaseTimestamp' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$'
           OR NOT pg_input_is_valid(item.vintage ->> 'releaseTimestamp', 'timestamp with time zone')
     )
     OR (payload -> 'canonicalInput' -> 'economicVintages') <>
        (SELECT coalesce(jsonb_agg(item.vintage ORDER BY
           item.vintage ->> 'providerId' COLLATE "C", item.vintage ->> 'seriesId' COLLATE "C",
           item.vintage ->> 'observationDate' COLLATE "C", item.vintage ->> 'releaseTimestamp' COLLATE "C",
           item.vintage ->> 'vintageId' COLLATE "C"), '[]'::jsonb)
           FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'economicVintages') AS item(vintage))
     OR (SELECT count(*) <> count(DISTINCT jsonb_build_array(
           item.vintage ->> 'providerId', item.vintage ->> 'seriesId',
           item.vintage ->> 'observationDate', item.vintage ->> 'releaseTimestamp',
           item.vintage ->> 'vintageId'))
           FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'economicVintages') AS item(vintage))
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'transformationLineage')
              WITH ORDINALITY AS item(transformation, ordinality)
        WHERE jsonb_typeof(item.transformation) <> 'object'
           OR NOT (item.transformation ?& ARRAY[
             'transformationId', 'algorithmId', 'algorithmVersion', 'parameters',
             'sourceObservationIds', 'parentTransformationIds', 'numericClass',
             'outputValue', 'outputHash'
           ])
           OR EXISTS (
             SELECT 1 FROM jsonb_object_keys(item.transformation) AS field(name)
              WHERE field.name <> ALL (ARRAY[
                'transformationId', 'algorithmId', 'algorithmVersion', 'parameters',
                'sourceObservationIds', 'parentTransformationIds', 'numericClass',
                'outputValue', 'outputHash'
              ])
           )
           OR jsonb_typeof(item.transformation -> 'parameters') <> 'object'
           OR jsonb_typeof(item.transformation -> 'sourceObservationIds') <> 'array'
           OR jsonb_typeof(item.transformation -> 'parentTransformationIds') <> 'array'
           OR jsonb_typeof(item.transformation -> 'transformationId') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.transformation -> 'algorithmId') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.transformation -> 'algorithmVersion') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.transformation -> 'numericClass') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.transformation -> 'outputValue') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.transformation -> 'outputHash') IS DISTINCT FROM 'string'
           OR length(item.transformation ->> 'transformationId') = 0
           OR length(item.transformation ->> 'algorithmId') = 0
           OR length(item.transformation ->> 'algorithmVersion') = 0
           OR item.transformation ->> 'outputHash' !~ '^[0-9a-f]{64}$'
           OR jsonb_path_exists(item.transformation -> 'parameters', '$.** ? (@.type() == "number")')
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(item.transformation -> 'parentTransformationIds') AS parent(id)
              WHERE NOT EXISTS (
                SELECT 1
                  FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'transformationLineage')
                       WITH ORDINALITY AS prior(transformation, ordinality)
                 WHERE prior.transformation ->> 'transformationId' = parent.id
                   AND prior.ordinality < item.ordinality
              )
           )
              OR (item.transformation -> 'sourceObservationIds') <>
                (SELECT coalesce(jsonb_agg(source_id ORDER BY source_id COLLATE "C"), '[]'::jsonb)
                  FROM jsonb_array_elements_text(item.transformation -> 'sourceObservationIds') AS source(source_id))
              OR (SELECT count(*) <> count(DISTINCT source_id)
                  OR bool_or(source_id !~ '^(market|economic)\|')
                  FROM jsonb_array_elements_text(item.transformation -> 'sourceObservationIds') AS source(source_id))
               OR EXISTS (
                 SELECT 1
                   FROM jsonb_array_elements_text(item.transformation -> 'sourceObservationIds') AS source(source_id)
                  WHERE source.source_id NOT IN (
                    SELECT format('market|%s:%s|%s:%s|%s:%s|%s:%s|%s:%s',
                      octet_length(observation ->> 'instrumentId'), observation ->> 'instrumentId',
                      octet_length(observation ->> 'tradingDate'), observation ->> 'tradingDate',
                      octet_length(observation ->> 'providerId'), observation ->> 'providerId',
                      octet_length(observation ->> 'adjustmentPolicy'), observation ->> 'adjustmentPolicy',
                      octet_length(observation ->> 'revision'), observation ->> 'revision')
                      FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'marketObservations') AS market(observation)
                    UNION ALL
                    SELECT format('economic|%s:%s|%s:%s|%s:%s|%s:%s|%s:%s',
                      octet_length(vintage ->> 'providerId'), vintage ->> 'providerId',
                      octet_length(vintage ->> 'seriesId'), vintage ->> 'seriesId',
                      octet_length(vintage ->> 'observationDate'), vintage ->> 'observationDate',
                      octet_length(vintage ->> 'releaseTimestamp'), vintage ->> 'releaseTimestamp',
                      octet_length(vintage ->> 'vintageId'), vintage ->> 'vintageId')
                      FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'economicVintages') AS economic(vintage)
                  )
               )
              OR (item.transformation -> 'parentTransformationIds') <>
                (SELECT coalesce(jsonb_agg(parent_id ORDER BY parent_id COLLATE "C"), '[]'::jsonb)
                  FROM jsonb_array_elements_text(item.transformation -> 'parentTransformationIds') AS parent(parent_id))
              OR (SELECT count(*) <> count(DISTINCT parent_id)
                  FROM jsonb_array_elements_text(item.transformation -> 'parentTransformationIds') AS parent(parent_id))
               OR EXISTS (
                 SELECT 1
                   FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'transformationLineage')
                        WITH ORDINALITY AS candidate(transformation, ordinality)
                  WHERE candidate.ordinality > item.ordinality
                    AND candidate.transformation ->> 'transformationId' < item.transformation ->> 'transformationId' COLLATE "C"
                    AND NOT EXISTS (
                      SELECT 1
                        FROM jsonb_array_elements_text(candidate.transformation -> 'parentTransformationIds') AS parent(id)
                       WHERE NOT EXISTS (
                         SELECT 1
                           FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'transformationLineage')
                                WITH ORDINALITY AS prior(transformation, ordinality)
                          WHERE prior.transformation ->> 'transformationId' = parent.id
                            AND prior.ordinality < item.ordinality
                       )
                    )
               )
     )
     OR (SELECT count(*) <> count(DISTINCT item.transformation ->> 'transformationId')
           FROM jsonb_array_elements(payload -> 'canonicalInput' -> 'transformationLineage') AS item(transformation))
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'trades')
              WITH ORDINALITY AS item(trade, ordinality)
        WHERE jsonb_typeof(item.trade) <> 'object'
           OR NOT (item.trade ?& ARRAY[
             'tradeOrdinal', 'instrumentId', 'side', 'quantity', 'unitPrice',
             'grossValue', 'fee', 'effectiveAt'
           ])
           OR EXISTS (
             SELECT 1 FROM jsonb_object_keys(item.trade) AS field(name)
              WHERE field.name <> ALL (ARRAY[
                'tradeOrdinal', 'instrumentId', 'side', 'quantity', 'unitPrice',
                'grossValue', 'fee', 'effectiveAt'
              ])
           )
           OR jsonb_typeof(item.trade -> 'tradeOrdinal') IS DISTINCT FROM 'number'
           OR jsonb_typeof(item.trade -> 'instrumentId') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.trade -> 'side') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.trade -> 'quantity') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.trade -> 'unitPrice') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.trade -> 'grossValue') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.trade -> 'fee') IS DISTINCT FROM 'string'
           OR jsonb_typeof(item.trade -> 'effectiveAt') IS DISTINCT FROM 'string'
           OR length(item.trade ->> 'instrumentId') = 0
           OR item.trade ->> 'side' NOT IN ('Buy', 'Sell')
           OR item.trade ->> 'tradeOrdinal' <> (item.ordinality - 1)::text
           OR item.trade ->> 'effectiveAt' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$'
           OR NOT pg_input_is_valid(item.trade ->> 'effectiveAt', 'timestamp with time zone')
     )
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'metrics') AS item(metric)
        WHERE jsonb_typeof(item.metric) <> 'object'
           OR NOT (item.metric ?& ARRAY['metricId', 'numericClass', 'value'])
           OR EXISTS (
             SELECT 1 FROM jsonb_object_keys(item.metric) AS field(name)
              WHERE field.name <> ALL (ARRAY['metricId', 'numericClass', 'value'])
           )
              OR jsonb_typeof(item.metric -> 'metricId') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.metric -> 'numericClass') IS DISTINCT FROM 'string'
               OR length(item.metric ->> 'metricId') = 0
     )
     OR (payload -> 'canonicalResult' -> 'metrics') <>
        (SELECT coalesce(jsonb_agg(item.metric ORDER BY item.metric ->> 'metricId' COLLATE "C"), '[]'::jsonb)
           FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'metrics') AS item(metric))
     OR (SELECT count(*) <> count(DISTINCT item.metric ->> 'metricId')
           FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'metrics') AS item(metric))
     OR EXISTS (
       SELECT 1
         FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'warnings') AS item(warning)
        WHERE jsonb_typeof(item.warning) <> 'object'
           OR NOT (item.warning ?& ARRAY['warningCode', 'subjectId'])
           OR EXISTS (
             SELECT 1 FROM jsonb_object_keys(item.warning) AS field(name)
              WHERE field.name <> ALL (ARRAY['warningCode', 'subjectId'])
           )
              OR jsonb_typeof(item.warning -> 'warningCode') IS DISTINCT FROM 'string'
              OR jsonb_typeof(item.warning -> 'subjectId') NOT IN ('string', 'null')
               OR length(item.warning ->> 'warningCode') = 0
     )
     OR (payload -> 'canonicalResult' -> 'warnings') <>
        (SELECT coalesce(jsonb_agg(item.warning ORDER BY
           item.warning ->> 'warningCode' COLLATE "C",
           item.warning ->> 'subjectId' COLLATE "C" NULLS FIRST), '[]'::jsonb)
           FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'warnings') AS item(warning))
     OR (SELECT count(*) <> count(DISTINCT jsonb_build_array(
           item.warning ->> 'warningCode', item.warning -> 'subjectId'))
           FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'warnings') AS item(warning)) THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'signals') AS item(signal)
      WHERE jsonb_typeof(item.signal -> 'score') IS DISTINCT FROM 'string'
        OR item.signal ->> 'score' !~ '^-?(0|[1-9][0-9]{0,15})\.[0-9]{12}$'
  )
     OR payload -> 'canonicalConfiguration' -> 'assumptions' ->> 'costRate'
        !~ '^-?(0|[1-9][0-9]{0,15})\.[0-9]{12}$'
     OR payload -> 'canonicalConfiguration' -> 'assumptions' ->> 'slippageRate'
        !~ '^-?(0|[1-9][0-9]{0,15})\.[0-9]{12}$'
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(
         payload -> 'canonicalInput' -> 'marketObservations'
       ) AS item(observation)
        WHERE jsonb_typeof(item.observation -> 'value') IS DISTINCT FROM 'string'
           OR item.observation ->> 'value' !~ '^-?(0|[1-9][0-9]{0,17})\.[0-9]{10}$'
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(
         payload -> 'canonicalInput' -> 'economicVintages'
       ) AS item(vintage)
        WHERE jsonb_typeof(item.vintage -> 'value') IS DISTINCT FROM 'string'
           OR item.vintage ->> 'value' !~ '^-?(0|[1-9][0-9]{0,17})\.[0-9]{10}$'
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(
         payload -> 'canonicalInput' -> 'transformationLineage'
       ) AS item(transformation)
        WHERE item.transformation ->> 'numericClass' NOT IN ('Quantity', 'Money', 'Rate')
           OR CASE item.transformation ->> 'numericClass'
                WHEN 'Quantity' THEN item.transformation ->> 'outputValue' !~ '^-?(0|[1-9][0-9]{0,17})\.[0-9]{10}$'
                WHEN 'Money' THEN item.transformation ->> 'outputValue' !~ '^-?(0|[1-9][0-9]{0,19})\.[0-9]{8}$'
                WHEN 'Rate' THEN item.transformation ->> 'outputValue' !~ '^-?(0|[1-9][0-9]{0,15})\.[0-9]{12}$'
                ELSE true
              END
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'trades') AS item(trade)
          WHERE item.trade ->> 'quantity' !~ '^-?(0|[1-9][0-9]{0,17})\.[0-9]{10}$'
            OR item.trade ->> 'unitPrice' !~ '^-?(0|[1-9][0-9]{0,17})\.[0-9]{10}$'
            OR item.trade ->> 'grossValue' !~ '^-?(0|[1-9][0-9]{0,19})\.[0-9]{8}$'
            OR item.trade ->> 'fee' !~ '^-?(0|[1-9][0-9]{0,19})\.[0-9]{8}$'
     )
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(payload -> 'canonicalResult' -> 'metrics') AS item(metric)
        WHERE jsonb_typeof(item.metric -> 'value') IS DISTINCT FROM 'string'
           OR item.metric ->> 'numericClass' NOT IN ('Quantity', 'Money', 'Rate')
           OR CASE item.metric ->> 'numericClass'
                WHEN 'Quantity' THEN item.metric ->> 'value' !~ '^-?(0|[1-9][0-9]{0,17})\.[0-9]{10}$'
                WHEN 'Money' THEN item.metric ->> 'value' !~ '^-?(0|[1-9][0-9]{0,19})\.[0-9]{8}$'
                WHEN 'Rate' THEN item.metric ->> 'value' !~ '^-?(0|[1-9][0-9]{0,15})\.[0-9]{12}$'
                ELSE true
              END
     ) THEN
    RAISE EXCEPTION 'ANALYTICS_NUMERIC_CLASS_INVALID' USING ERRCODE = '22023';
  END IF;

  input_hash := encode(public.digest(convert_to(etf._evidence_rfc8785(payload -> 'canonicalInput'), 'UTF8'), 'sha256'), 'hex');
  IF payload -> 'canonicalConfiguration' ->> 'inputHash' <> input_hash THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
  END IF;
  configuration_hash := encode(public.digest(convert_to(etf._evidence_rfc8785(payload -> 'canonicalConfiguration'), 'UTF8'), 'sha256'), 'hex');
  IF payload -> 'canonicalResult' ->> 'configurationHash' <> configuration_hash THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
  END IF;
  result_hash := encode(public.digest(convert_to(etf._evidence_rfc8785(payload -> 'canonicalResult'), 'UTF8'), 'sha256'), 'hex');

  IF payload ->> 'reproducibilityStatus' = 'Complete' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'etf:analytics-publication:' || (payload ->> 'publicationTargetId'), 0
    ));
    SELECT publication_version INTO current_version
      FROM etf.analytics_publications
     WHERE publication_target_id = payload ->> 'publicationTargetId'
     FOR UPDATE;
    current_version := COALESCE(current_version, 0);
    IF (payload ->> 'expectedPublicationVersion')::bigint <> current_version THEN
      RAISE EXCEPTION 'ANALYTICS_PUBLICATION_VERSION_CONFLICT' USING ERRCODE = '40001';
    END IF;
    next_version := current_version + 1;
  ELSE
    SELECT COALESCE(publication_version, 0) INTO current_version
      FROM etf.analytics_publications
     WHERE publication_target_id = payload ->> 'publicationTargetId';
    next_version := COALESCE(current_version, 0);
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('etf:analytics-manifest', 0));
  SELECT existing.manifest_sequence, existing.manifest_hash
    INTO manifest_sequence, previous_manifest_hash
    FROM etf.analytics_manifests AS existing
   ORDER BY existing.manifest_sequence DESC
   LIMIT 1;
  manifest_sequence := COALESCE(manifest_sequence + 1, 0);
  manifest_id := 'manifest-' || substring(encode(public.digest(
    convert_to(payload ->> 'evidenceId', 'UTF8'), 'sha256'
  ), 'hex') FROM 1 FOR 54);

  retention_epoch := date_trunc('milliseconds', clock_timestamp());
  retention_epoch_text := to_char(retention_epoch AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  lifecycle_record := jsonb_build_object(
    'eventAt', retention_epoch_text,
    'lifecycleSequence', 0,
    'state', 'Hot'
  );
  event_hash := encode(public.digest(convert_to(etf._evidence_rfc8785(
    lifecycle_record || jsonb_build_object('domain', 'etf.analytics.lifecycle.v1')
  ), 'UTF8'), 'sha256'), 'hex');
  lifecycle_record := lifecycle_record || jsonb_build_object('eventHash', event_hash);

  bundle_record := jsonb_build_object(
    'assumptions', payload -> 'canonicalConfiguration' -> 'assumptions',
    'baselineVersion', payload ->> 'baselineVersion',
    'benchmark', payload -> 'canonicalConfiguration' -> 'benchmark',
    'codeHash', payload -> 'canonicalConfiguration' ->> 'codeHash',
    'configurationHash', configuration_hash,
    'domain', 'etf.analytics.bundle.v1',
    'environment', payload -> 'canonicalConfiguration' -> 'environment',
    'evaluationAt', payload ->> 'evaluationAt',
    'evidenceId', payload ->> 'evidenceId',
    'evidenceSchemaVersion', payload ->> 'evidenceSchemaVersion',
    'inputHash', input_hash,
    'inputSetId', payload ->> 'inputSetId',
    'parameters', payload -> 'canonicalConfiguration' -> 'parameters',
    'providerPolicyReferences', payload -> 'canonicalConfiguration' -> 'providerPolicyReferences',
    'reproducibilityReason', payload -> 'reproducibilityReason',
    'reproducibilityStatus', payload ->> 'reproducibilityStatus',
    'result', payload -> 'canonicalResult',
    'resultHash', result_hash,
    'retentionEpoch', retention_epoch_text,
    'retentionPolicyVersion', payload ->> 'retentionPolicyVersion',
    'ruleId', payload -> 'canonicalConfiguration' ->> 'ruleId',
    'ruleVersion', payload -> 'canonicalConfiguration' ->> 'ruleVersion',
    'seed', payload -> 'canonicalConfiguration' ->> 'seed'
  );
  bundle_hash := encode(public.digest(convert_to(etf._evidence_rfc8785(bundle_record), 'UTF8'), 'sha256'), 'hex');

  manifest_record := jsonb_build_object(
    'baselineVersion', payload ->> 'baselineVersion',
    'bundleHash', bundle_hash,
    'configurationHash', configuration_hash,
    'deletionCertificateLinks', '[]'::jsonb,
    'domain', 'etf.analytics.manifest.v1',
    'evidenceId', payload ->> 'evidenceId',
    'evidenceSchemaVersion', payload ->> 'evidenceSchemaVersion',
    'inputHash', input_hash,
    'lifecycleReferences', jsonb_build_array(lifecycle_record),
    'manifestId', manifest_id,
    'manifestSequence', manifest_sequence,
    'previousManifestHash', to_jsonb(previous_manifest_hash),
    'reproducibilityReason', payload -> 'reproducibilityReason',
    'reproducibilityStatus', payload ->> 'reproducibilityStatus',
    'resultHash', result_hash,
    'retentionEpoch', retention_epoch_text,
    'retentionPolicyVersion', payload ->> 'retentionPolicyVersion'
  );
  manifest_hash := encode(public.digest(convert_to(etf._evidence_rfc8785(manifest_record), 'UTF8'), 'sha256'), 'hex');

  INSERT INTO etf.analytics_input_sets VALUES (
    payload ->> 'inputSetId', payload ->> 'inputSchemaVersion',
    (payload ->> 'evaluationAt')::timestamp(3) with time zone,
    payload -> 'canonicalInput', input_hash, payload -> 'canonicalInput' ->> 'portfolioContextHash'
  ) ON CONFLICT (input_set_id) DO NOTHING;
  PERFORM 1 FROM etf.analytics_input_sets AS existing
   WHERE existing.input_set_id = payload ->> 'inputSetId'
     AND existing.input_schema_version = payload ->> 'inputSchemaVersion'
     AND existing.evaluation_at = (payload ->> 'evaluationAt')::timestamp(3) with time zone
     AND existing.canonical_content = payload -> 'canonicalInput'
     AND existing.input_hash = encode(public.digest(
       convert_to(etf._evidence_rfc8785(payload -> 'canonicalInput'), 'UTF8'), 'sha256'
     ), 'hex')
     AND existing.portfolio_context_hash = payload -> 'canonicalInput' ->> 'portfolioContextHash';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = '22023';
  END IF;
  INSERT INTO etf.analytics_evidence_bundles VALUES (
    payload ->> 'evidenceId', payload ->> 'evidenceSchemaVersion', payload ->> 'baselineVersion',
    payload ->> 'inputSetId', (payload ->> 'evaluationAt')::timestamp(3) with time zone,
    payload ->> 'reproducibilityStatus', payload ->> 'reproducibilityReason',
    payload -> 'canonicalConfiguration', payload -> 'canonicalResult', input_hash,
    configuration_hash, result_hash, bundle_hash
  );
  INSERT INTO etf.analytics_manifests VALUES (
    manifest_id, manifest_sequence, previous_manifest_hash,
    payload ->> 'evidenceId', payload ->> 'retentionPolicyVersion',
    retention_epoch, manifest_record, manifest_hash
  );
  INSERT INTO etf.analytics_lifecycle_references VALUES (
    payload ->> 'evidenceId', 0, 'Hot', retention_epoch, event_hash
  );
  INSERT INTO etf.analytics_retention_bindings VALUES
    (payload ->> 'evidenceId', retention_epoch, 'RawEligible', retention_epoch + interval '2160 hours', 'Hot', 'RET-A-1.0'),
    (payload ->> 'evidenceId', retention_epoch, 'OperationalMetadata', retention_epoch + interval '8760 hours', 'Hot', 'RET-A-1.0'),
    (payload ->> 'evidenceId', retention_epoch, 'FullBundle', retention_epoch + interval '17520 hours', 'Hot', 'RET-A-1.0'),
    (payload ->> 'evidenceId', retention_epoch, 'AuditManifest', retention_epoch + interval '43800 hours', 'Hot', 'RET-A-1.0'),
    (payload ->> 'evidenceId', retention_epoch, 'DeletionCertificate', retention_epoch + interval '43800 hours', 'Hot', 'RET-A-1.0');

  IF payload ->> 'reproducibilityStatus' = 'Complete' THEN
    INSERT INTO etf.analytics_publications VALUES (
      payload ->> 'publicationTargetId', next_version, payload ->> 'evidenceId', retention_epoch, bundle_hash
    ) ON CONFLICT (publication_target_id) DO UPDATE SET
      publication_version = EXCLUDED.publication_version,
      evidence_id = EXCLUDED.evidence_id,
      published_at = EXCLUDED.published_at,
      bundle_hash = EXCLUDED.bundle_hash;
  END IF;

  commit_result := jsonb_build_object(
    'evidenceId', payload ->> 'evidenceId', 'manifestId', manifest_id,
    'publicationTargetId', payload ->> 'publicationTargetId', 'publicationVersion', next_version,
    'retentionEpoch', retention_epoch_text, 'inputHash', input_hash,
    'configurationHash', configuration_hash, 'resultHash', result_hash,
    'bundleHash', bundle_hash, 'manifestHash', manifest_hash
  );
  audit_record := jsonb_build_object(
    'action', 'EvidenceCommit', 'createdAt', retention_epoch_text,
    'evidenceId', payload ->> 'evidenceId', 'outcome', 'Committed',
    'publicationTargetId', payload ->> 'publicationTargetId'
  );
  INSERT INTO etf.analytics_audit VALUES (
    gen_random_uuid(), payload ->> 'evidenceId',
    CASE WHEN payload ->> 'reproducibilityStatus' = 'Complete' THEN payload ->> 'publicationTargetId' END,
    'EvidenceCommit', 'Committed', NULL, retention_epoch,
    encode(public.digest(convert_to(etf._evidence_rfc8785(audit_record), 'UTF8'), 'sha256'), 'hex')
  );
  INSERT INTO etf.analytics_evidence_replays VALUES (
    payload ->> 'evidenceId', (payload ->> 'evidenceCommitCommandId')::uuid,
    canonical_content, commit_result, retention_epoch
  );
  RETURN commit_result;
EXCEPTION
  WHEN invalid_text_representation OR datetime_field_overflow OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'ANALYTICS_INPUT_INCOMPLETE' USING ERRCODE = '22023';
  WHEN OTHERS THEN
    IF SQLERRM IN (
      'ANALYTICS_INPUT_INCOMPLETE',
      'ANALYTICS_INTEGRITY_FAILED',
      'ANALYTICS_IDEMPOTENCY_CONFLICT',
      'ANALYTICS_PUBLICATION_VERSION_CONFLICT',
      'ANALYTICS_NUMERIC_CLASS_INVALID'
    ) THEN
      RAISE;
    END IF;
    RAISE EXCEPTION 'ANALYTICS_EVIDENCE_COMMIT_FAILED' USING ERRCODE = 'P0001';
END;
$function$;

CREATE FUNCTION etf.evidence_read(requested_evidence_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  bundle_row record;
  input_row record;
  manifest_row record;
  lifecycle_records jsonb;
  deletion_records jsonb;
  expected_manifest jsonb;
  evidence_without_hash jsonb;
  evidence jsonb;
  retention_epoch_text text;
BEGIN
  SELECT bundle.* INTO bundle_row
    FROM etf.analytics_evidence_bundles AS bundle
   WHERE bundle.evidence_id = requested_evidence_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANALYTICS_INPUT_INCOMPLETE' USING ERRCODE = 'P0002';
  END IF;

  SELECT input.* INTO input_row
    FROM etf.analytics_input_sets AS input
   WHERE input.input_set_id = bundle_row.input_set_id;
  SELECT manifest.* INTO manifest_row
    FROM etf.analytics_manifests AS manifest
   WHERE manifest.evidence_id = requested_evidence_id
   ORDER BY manifest.manifest_sequence DESC
   LIMIT 1;
  IF input_row IS NULL OR manifest_row IS NULL THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'eventAt', to_char(lifecycle.event_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'eventHash', lifecycle.event_hash,
           'lifecycleSequence', lifecycle.lifecycle_sequence,
           'state', lifecycle.state
         ) ORDER BY lifecycle.lifecycle_sequence), '[]'::jsonb)
    INTO lifecycle_records
    FROM etf.analytics_lifecycle_references AS lifecycle
   WHERE lifecycle.evidence_id = requested_evidence_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'certificateHash', deletion.certificate_hash,
           'deletionCertificateId', deletion.deletion_certificate_id,
           'targetClass', deletion.target_class
         ) ORDER BY deletion.deletion_certificate_id COLLATE "C"), '[]'::jsonb)
    INTO deletion_records
    FROM etf.analytics_deletion_links AS deletion
   WHERE deletion.evidence_id = requested_evidence_id;

  retention_epoch_text := to_char(
    manifest_row.retention_epoch AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
  evidence_without_hash := jsonb_build_object(
    'assumptions', bundle_row.configuration -> 'assumptions',
    'baselineVersion', bundle_row.baseline_version,
    'benchmark', bundle_row.configuration -> 'benchmark',
    'codeHash', bundle_row.configuration ->> 'codeHash',
    'configurationHash', bundle_row.configuration_hash,
    'domain', 'etf.analytics.bundle.v1',
    'environment', bundle_row.configuration -> 'environment',
    'evaluationAt', to_char(bundle_row.evaluation_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'evidenceId', bundle_row.evidence_id,
    'evidenceSchemaVersion', bundle_row.evidence_schema_version,
    'inputHash', bundle_row.input_hash,
    'inputSetId', bundle_row.input_set_id,
    'parameters', bundle_row.configuration -> 'parameters',
    'providerPolicyReferences', bundle_row.configuration -> 'providerPolicyReferences',
    'reproducibilityReason', bundle_row.reason,
    'reproducibilityStatus', bundle_row.reproducibility_status,
    'result', bundle_row.result,
    'resultHash', bundle_row.result_hash,
    'retentionEpoch', retention_epoch_text,
    'retentionPolicyVersion', manifest_row.retention_policy_version,
    'ruleId', bundle_row.configuration ->> 'ruleId',
    'ruleVersion', bundle_row.configuration ->> 'ruleVersion',
    'seed', bundle_row.configuration ->> 'seed'
  );
  expected_manifest := jsonb_build_object(
    'baselineVersion', bundle_row.baseline_version,
    'bundleHash', bundle_row.bundle_hash,
    'configurationHash', bundle_row.configuration_hash,
    'deletionCertificateLinks', deletion_records,
    'domain', 'etf.analytics.manifest.v1',
    'evidenceId', bundle_row.evidence_id,
    'evidenceSchemaVersion', bundle_row.evidence_schema_version,
    'inputHash', bundle_row.input_hash,
    'lifecycleReferences', lifecycle_records,
    'manifestId', manifest_row.manifest_id,
    'manifestSequence', manifest_row.manifest_sequence,
    'previousManifestHash', manifest_row.previous_manifest_hash,
    'reproducibilityReason', bundle_row.reason,
    'reproducibilityStatus', bundle_row.reproducibility_status,
    'resultHash', bundle_row.result_hash,
    'retentionEpoch', retention_epoch_text,
    'retentionPolicyVersion', manifest_row.retention_policy_version
  );

  IF input_row.input_hash <> encode(public.digest(convert_to(
       etf._evidence_rfc8785(input_row.canonical_content), 'UTF8'
     ), 'sha256'), 'hex')
     OR input_row.input_hash <> bundle_row.input_hash
      OR input_row.input_schema_version <> input_row.canonical_content ->> 'inputSchemaVersion'
      OR to_char(input_row.evaluation_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <>
        input_row.canonical_content ->> 'evaluationAt'
      OR input_row.canonical_content ->> 'domain' <> 'etf.analytics.input.v1'
      OR input_row.portfolio_context_hash <>
        input_row.canonical_content ->> 'portfolioContextHash'
      OR bundle_row.evaluation_at <> input_row.evaluation_at
      OR bundle_row.configuration ->> 'inputHash' <> bundle_row.input_hash
      OR bundle_row.configuration ->> 'baselineVersion' <> bundle_row.baseline_version
      OR bundle_row.configuration ->> 'evaluationAt' <>
        to_char(bundle_row.evaluation_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      OR bundle_row.configuration ->> 'domain' <> 'etf.analytics.configuration.v1'
      OR bundle_row.result ->> 'configurationHash' <> bundle_row.configuration_hash
      OR bundle_row.result ->> 'domain' <> 'etf.analytics.result.v1'
     OR bundle_row.configuration_hash <> encode(public.digest(convert_to(
       etf._evidence_rfc8785(bundle_row.configuration), 'UTF8'
     ), 'sha256'), 'hex')
     OR bundle_row.result_hash <> encode(public.digest(convert_to(
       etf._evidence_rfc8785(bundle_row.result), 'UTF8'
     ), 'sha256'), 'hex')
     OR bundle_row.bundle_hash <> encode(public.digest(convert_to(
       etf._evidence_rfc8785(evidence_without_hash), 'UTF8'
     ), 'sha256'), 'hex')
     OR manifest_row.canonical_content <> expected_manifest
     OR manifest_row.manifest_hash <> encode(public.digest(convert_to(
       etf._evidence_rfc8785(expected_manifest), 'UTF8'
     ), 'sha256'), 'hex')
     OR EXISTS (
       SELECT 1
         FROM etf.analytics_retention_bindings AS binding
        WHERE binding.evidence_id = requested_evidence_id
        GROUP BY binding.retention_epoch
       HAVING (
            binding.retention_epoch = manifest_row.retention_epoch
            AND (count(*) <> 5 OR count(DISTINCT binding.target_class) <> 5)
          )
          OR (
            binding.retention_epoch <> manifest_row.retention_epoch
            AND (count(*) <> 1 OR min(binding.target_class) <> 'OperationalMetadata')
          )
          OR bool_or(
            binding.retention_policy_version <> manifest_row.retention_policy_version
            OR binding.retain_through <> binding.retention_epoch + CASE binding.target_class
              WHEN 'RawEligible' THEN interval '2160 hours'
              WHEN 'OperationalMetadata' THEN interval '8760 hours'
              WHEN 'FullBundle' THEN interval '17520 hours'
              WHEN 'AuditManifest' THEN interval '43800 hours'
              WHEN 'DeletionCertificate' THEN interval '43800 hours'
              ELSE interval '0 hours'
            END
          )
     )
     OR (SELECT count(*) <> 5 OR bool_or(binding.lifecycle_state <> 'Hot')
           FROM etf.analytics_retention_bindings AS binding
          WHERE binding.evidence_id = requested_evidence_id
            AND binding.retention_epoch = manifest_row.retention_epoch)
     OR EXISTS (
       SELECT 1
         FROM (
           SELECT binding.target_class, binding.retention_epoch, binding.retain_through,
                  lag(binding.retain_through) OVER (
                    PARTITION BY binding.target_class ORDER BY binding.retention_epoch
                  ) AS prior_retain_through
             FROM etf.analytics_retention_bindings AS binding
            WHERE binding.evidence_id = requested_evidence_id
         ) AS retention_chain
        WHERE retention_chain.prior_retain_through IS NOT NULL
          AND retention_chain.retain_through < retention_chain.prior_retain_through
     )
     OR EXISTS (
       SELECT 1
         FROM etf.analytics_lifecycle_references AS lifecycle
        WHERE lifecycle.evidence_id = requested_evidence_id
          AND NOT EXISTS (
            SELECT 1
              FROM etf.analytics_retention_bindings AS binding
             WHERE binding.evidence_id = lifecycle.evidence_id
               AND binding.retention_epoch = lifecycle.event_at
               AND binding.target_class = 'OperationalMetadata'
               AND binding.lifecycle_state = lifecycle.state
               AND binding.retention_policy_version = manifest_row.retention_policy_version
               AND binding.retain_through = lifecycle.event_at + interval '8760 hours'
          )
     )
     OR EXISTS (
       SELECT 1
         FROM etf.analytics_retention_bindings AS binding
        WHERE binding.evidence_id = requested_evidence_id
          AND binding.target_class = 'OperationalMetadata'
          AND 1 <> (
            SELECT count(*)
              FROM etf.analytics_lifecycle_references AS lifecycle
             WHERE lifecycle.evidence_id = binding.evidence_id
               AND lifecycle.event_at = binding.retention_epoch
               AND lifecycle.state = binding.lifecycle_state
          )
     )
     OR EXISTS (
       SELECT 1
         FROM etf.analytics_manifests AS chained
        WHERE chained.manifest_hash <> encode(public.digest(convert_to(
            etf._evidence_rfc8785(chained.canonical_content), 'UTF8'
          ), 'sha256'), 'hex')
     )
     OR EXISTS (
       SELECT 1
         FROM (
           SELECT chained.manifest_sequence,
                  chained.previous_manifest_hash,
                  row_number() OVER (ORDER BY chained.manifest_sequence) - 1 AS expected_sequence,
                  lag(chained.manifest_hash) OVER (ORDER BY chained.manifest_sequence) AS expected_previous
             FROM etf.analytics_manifests AS chained
         ) AS chain
        WHERE chain.manifest_sequence <> chain.expected_sequence
           OR chain.previous_manifest_hash IS DISTINCT FROM chain.expected_previous
     )
     OR EXISTS (
       SELECT 1
         FROM (
           SELECT lifecycle.lifecycle_sequence,
                  row_number() OVER (ORDER BY lifecycle.lifecycle_sequence) - 1 AS expected_sequence
             FROM etf.analytics_lifecycle_references AS lifecycle
            WHERE lifecycle.evidence_id = requested_evidence_id
         ) AS lifecycle_chain
        WHERE lifecycle_chain.lifecycle_sequence <> lifecycle_chain.expected_sequence
     )
     OR EXISTS (
       SELECT 1
         FROM etf.analytics_lifecycle_references AS lifecycle
        WHERE lifecycle.evidence_id = requested_evidence_id
          AND lifecycle.event_hash <> encode(public.digest(convert_to(etf._evidence_rfc8785(
            jsonb_build_object(
              'domain', 'etf.analytics.lifecycle.v1',
              'eventAt', to_char(lifecycle.event_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'lifecycleSequence', lifecycle.lifecycle_sequence,
              'state', lifecycle.state
            )
          ), 'UTF8'), 'sha256'), 'hex')
     ) THEN
    RAISE EXCEPTION 'ANALYTICS_INTEGRITY_FAILED' USING ERRCODE = 'P0001';
  END IF;

  evidence := evidence_without_hash || jsonb_build_object('bundleHash', bundle_row.bundle_hash);
  RETURN jsonb_build_object('evidence', evidence);
END;
$function$;

REVOKE ALL ON FUNCTION etf.evidence_commit(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION etf.evidence_read(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION etf._evidence_rfc8785(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etf.evidence_commit(jsonb) TO app_runtime;
GRANT EXECUTE ON FUNCTION etf.evidence_read(text) TO app_runtime;

SET LOCAL ROLE schema_owner;
REVOKE CREATE ON SCHEMA etf FROM evidence_writer_owner;
SET LOCAL ROLE migration_owner;
`;

export const analyticsEvidenceMigration: MigrationArtifact = {
  migrationId: "0005-analytics-evidence",
  sequence: 5,
  sql,
};
