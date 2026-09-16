import type { MigrationArtifact } from "../migration-set.js";

export const fixtureTableNames = [
  "fixture_packages",
  "fixture_descriptors",
  "fixture_raw_sources",
  "market_observations",
  "economic_observations",
  "fixture_ingestion_replays",
] as const;

export const fixtureFunctionNames = ["fixture_ingest"] as const;

const sql = `SET LOCAL ROLE schema_owner;
GRANT USAGE, CREATE ON SCHEMA etf TO application_writer_owner;
SET LOCAL ROLE application_writer_owner;

CREATE TABLE etf.fixture_packages (
  dataset_id text COLLATE "C" NOT NULL,
  dataset_version text COLLATE "C" NOT NULL,
  dataset_hash character(64) COLLATE "C" NOT NULL,
  manifest jsonb NOT NULL,
  accepted_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_fixture_packages PRIMARY KEY (dataset_id, dataset_version),
  CONSTRAINT uq_fixture_packages__dataset_hash UNIQUE (dataset_hash),
  CONSTRAINT ck_fixture_packages__dataset_id CHECK (dataset_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  CONSTRAINT ck_fixture_packages__dataset_version CHECK (dataset_version ~ '^[0-9]{4}\\.(0[1-9]|1[0-2])\\.(0|[1-9][0-9]*)$'),
  CONSTRAINT ck_fixture_packages__dataset_hash_lower_hex CHECK (dataset_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE etf.fixture_descriptors (
  dataset_id text COLLATE "C" NOT NULL,
  dataset_version text COLLATE "C" NOT NULL,
  path text COLLATE "C" NOT NULL,
  media_type text COLLATE "C" NOT NULL,
  byte_length bigint NOT NULL,
  content_hash character(64) COLLATE "C" NOT NULL,
  ordinal bigint NOT NULL,
  CONSTRAINT pk_fixture_descriptors PRIMARY KEY (dataset_id, dataset_version, path),
  CONSTRAINT uq_fixture_descriptors__dataset_id_dataset_version_ordinal UNIQUE (dataset_id, dataset_version, ordinal),
  CONSTRAINT fk_fixture_descriptors__ds_ver__fixture_packages FOREIGN KEY (dataset_id, dataset_version) REFERENCES etf.fixture_packages (dataset_id, dataset_version) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_fixture_descriptors__path CHECK (path ~ '^[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$' AND path !~ '(^|/)\\.\\.?(/|$)'),
  CONSTRAINT ck_fixture_descriptors__media_type CHECK (media_type IN ('application/x-ndjson', 'application/octet-stream')),
  CONSTRAINT ck_fixture_descriptors__byte_length_nonnegative CHECK (byte_length >= 0),
  CONSTRAINT ck_fixture_descriptors__ordinal_nonnegative CHECK (ordinal >= 0),
  CONSTRAINT ck_fixture_descriptors__content_hash_lower_hex CHECK (content_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE etf.fixture_raw_sources (
  dataset_id text COLLATE "C" NOT NULL,
  dataset_version text COLLATE "C" NOT NULL,
  raw_source_hash character(64) COLLATE "C" NOT NULL,
  content bytea NOT NULL,
  byte_length bigint NOT NULL,
  CONSTRAINT pk_fixture_raw_sources PRIMARY KEY (dataset_id, dataset_version, raw_source_hash),
  CONSTRAINT fk_fixture_raw_sources__ds_ver__fixture_packages FOREIGN KEY (dataset_id, dataset_version) REFERENCES etf.fixture_packages (dataset_id, dataset_version) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_fixture_raw_sources__raw_source_hash_lower_hex CHECK (raw_source_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_fixture_raw_sources__byte_length CHECK (byte_length >= 0 AND byte_length = octet_length(content)),
  CONSTRAINT ck_fixture_raw_sources__content_hash CHECK (raw_source_hash = encode(public.digest(content, 'sha256'), 'hex'))
);

CREATE TABLE etf.market_observations (
  dataset_id text COLLATE "C" NOT NULL,
  dataset_version text COLLATE "C" NOT NULL,
  instrument_id text COLLATE "C" NOT NULL,
  trading_date date NOT NULL,
  provider_id text COLLATE "C" NOT NULL,
  adjustment_policy text COLLATE "C" NOT NULL,
  revision bigint NOT NULL,
  source_available_at timestamp(3) with time zone NOT NULL,
  numeric_class text COLLATE "C" NOT NULL,
  value_quantity numeric(28,10),
  value_money numeric(28,8),
  value_rate numeric(28,12),
  currency text COLLATE "C" NOT NULL,
  raw_source_ref text COLLATE "C" NOT NULL,
  raw_source_hash character(64) COLLATE "C" NOT NULL,
  normalization_id text COLLATE "C" NOT NULL,
  ingestion_job_id text COLLATE "C" NOT NULL,
  quality_state text COLLATE "C" NOT NULL,
  quality_codes text[] NOT NULL,
  CONSTRAINT pk_market_observations PRIMARY KEY (dataset_id, dataset_version, instrument_id, trading_date, provider_id, adjustment_policy, revision),
  CONSTRAINT uq_market_observations__ds_ver_job_inst_date_prov_adj_rev UNIQUE (dataset_id, dataset_version, ingestion_job_id, instrument_id, trading_date, provider_id, adjustment_policy, revision),
  CONSTRAINT fk_market_observations__ds_ver__fixture_packages FOREIGN KEY (dataset_id, dataset_version) REFERENCES etf.fixture_packages (dataset_id, dataset_version) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_market_observations__ds_ver_hash__fixture_raw_sources FOREIGN KEY (dataset_id, dataset_version, raw_source_hash) REFERENCES etf.fixture_raw_sources (dataset_id, dataset_version, raw_source_hash) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_market_observations__instrument_id CHECK (instrument_id ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$'),
  CONSTRAINT ck_market_observations__provider_id CHECK (provider_id = 'fixture'),
  CONSTRAINT ck_market_observations__adjustment_policy CHECK (adjustment_policy IN ('unadjusted', 'split-adjusted', 'total-return-adjusted')),
  CONSTRAINT ck_market_observations__revision_nonnegative CHECK (revision >= 0),
  CONSTRAINT ck_market_observations__numeric_class CHECK (numeric_class IN ('Quantity', 'UnitPrice', 'Money', 'Rate')),
  CONSTRAINT ck_market_observations__value_class CHECK ((numeric_class IN ('Quantity', 'UnitPrice') AND value_quantity IS NOT NULL AND value_money IS NULL AND value_rate IS NULL) OR (numeric_class = 'Money' AND value_quantity IS NULL AND value_money IS NOT NULL AND value_rate IS NULL) OR (numeric_class = 'Rate' AND value_quantity IS NULL AND value_money IS NULL AND value_rate IS NOT NULL)),
  CONSTRAINT ck_market_observations__value_bound CHECK ((value_quantity IS NULL OR abs(value_quantity) < 1000000000000000000) AND (value_money IS NULL OR abs(value_money) < 100000000000000000000) AND (value_rate IS NULL OR abs(value_rate) < 10000000000000000)),
  CONSTRAINT ck_market_observations__currency CHECK ((numeric_class IN ('UnitPrice', 'Money') AND currency = 'USD') OR (numeric_class IN ('Quantity', 'Rate') AND currency = '')),
  CONSTRAINT ck_market_observations__raw_source_ref CHECK (raw_source_ref = 'raw-sources/' || raw_source_hash),
  CONSTRAINT ck_market_observations__normalization_id_nonempty CHECK (length(normalization_id) > 0),
  CONSTRAINT ck_market_observations__ingestion_job_id_nonempty CHECK (length(ingestion_job_id) > 0),
  CONSTRAINT ck_market_observations__quality_state CHECK (quality_state IN ('Valid', 'Partial', 'Stale', 'Quarantined')),
  CONSTRAINT ck_market_observations__quality_codes CHECK ((quality_state = 'Valid' AND cardinality(quality_codes) = 0) OR (quality_state <> 'Valid' AND cardinality(quality_codes) > 0))
);
CREATE INDEX ix_market_observations__inst_date_prov_adj_available_rev ON etf.market_observations (instrument_id COLLATE "C", trading_date, provider_id COLLATE "C", adjustment_policy COLLATE "C", source_available_at, revision DESC);

CREATE TABLE etf.economic_observations (
  dataset_id text COLLATE "C" NOT NULL,
  dataset_version text COLLATE "C" NOT NULL,
  provider_id text COLLATE "C" NOT NULL,
  series_id text COLLATE "C" NOT NULL,
  observation_date date NOT NULL,
  release_timestamp timestamp(3) with time zone NOT NULL,
  vintage_id text COLLATE "C" NOT NULL,
  numeric_class text COLLATE "C" NOT NULL,
  value_quantity numeric(28,10),
  value_money numeric(28,8),
  value_rate numeric(28,12),
  raw_source_ref text COLLATE "C" NOT NULL,
  raw_source_hash character(64) COLLATE "C" NOT NULL,
  normalization_id text COLLATE "C" NOT NULL,
  ingestion_job_id text COLLATE "C" NOT NULL,
  quality_state text COLLATE "C" NOT NULL,
  quality_codes text[] NOT NULL,
  CONSTRAINT pk_economic_observations PRIMARY KEY (dataset_id, dataset_version, provider_id, series_id, observation_date, release_timestamp, vintage_id),
  CONSTRAINT uq_economic_observations__ds_ver_prov_series_date_release UNIQUE (dataset_id, dataset_version, provider_id, series_id, observation_date, release_timestamp),
  CONSTRAINT uq_economic_observations__ds_ver_job_prov_series_date_rel_vtg UNIQUE (dataset_id, dataset_version, ingestion_job_id, provider_id, series_id, observation_date, release_timestamp, vintage_id),
  CONSTRAINT fk_economic_observations__ds_ver__fixture_packages FOREIGN KEY (dataset_id, dataset_version) REFERENCES etf.fixture_packages (dataset_id, dataset_version) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_economic_observations__ds_ver_hash__fixture_raw_sources FOREIGN KEY (dataset_id, dataset_version, raw_source_hash) REFERENCES etf.fixture_raw_sources (dataset_id, dataset_version, raw_source_hash) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_economic_observations__provider_id CHECK (provider_id IN ('FRED', 'ALFRED', 'BLS', 'BEA', 'TREASURY_FISCAL_DATA')),
  CONSTRAINT ck_economic_observations__series_id CHECK (series_id ~ '^[\\x20-\\x7e]{1,128}$'),
  CONSTRAINT ck_economic_observations__vintage_id CHECK (vintage_id ~ '^[\\x20-\\x7e]{1,128}$'),
  CONSTRAINT ck_economic_observations__numeric_class CHECK (numeric_class IN ('Quantity', 'UnitPrice', 'Money', 'Rate')),
  CONSTRAINT ck_economic_observations__value_class CHECK ((numeric_class IN ('Quantity', 'UnitPrice') AND value_quantity IS NOT NULL AND value_money IS NULL AND value_rate IS NULL) OR (numeric_class = 'Money' AND value_quantity IS NULL AND value_money IS NOT NULL AND value_rate IS NULL) OR (numeric_class = 'Rate' AND value_quantity IS NULL AND value_money IS NULL AND value_rate IS NOT NULL)),
  CONSTRAINT ck_economic_observations__value_bound CHECK ((value_quantity IS NULL OR abs(value_quantity) < 1000000000000000000) AND (value_money IS NULL OR abs(value_money) < 100000000000000000000) AND (value_rate IS NULL OR abs(value_rate) < 10000000000000000)),
  CONSTRAINT ck_economic_observations__raw_source_ref CHECK (raw_source_ref = 'raw-sources/' || raw_source_hash),
  CONSTRAINT ck_economic_observations__normalization_id_nonempty CHECK (length(normalization_id) > 0),
  CONSTRAINT ck_economic_observations__ingestion_job_id_nonempty CHECK (length(ingestion_job_id) > 0),
  CONSTRAINT ck_economic_observations__quality_state CHECK (quality_state IN ('Valid', 'Partial', 'Stale', 'Quarantined')),
  CONSTRAINT ck_economic_observations__quality_codes CHECK ((quality_state = 'Valid' AND cardinality(quality_codes) = 0) OR (quality_state <> 'Valid' AND cardinality(quality_codes) > 0))
);
CREATE INDEX ix_economic_observations__prov_series_date_release_vintage ON etf.economic_observations (provider_id COLLATE "C", series_id COLLATE "C", observation_date, release_timestamp DESC, vintage_id COLLATE "C");

CREATE TABLE etf.fixture_ingestion_replays (
  dataset_id text COLLATE "C" NOT NULL,
  dataset_version text COLLATE "C" NOT NULL,
  job_id uuid NOT NULL,
  canonical_content jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_fixture_ingestion_replays PRIMARY KEY (dataset_id, dataset_version, job_id),
  CONSTRAINT fk_fixture_ingestion_replays__ds_ver__fixture_packages FOREIGN KEY (dataset_id, dataset_version) REFERENCES etf.fixture_packages (dataset_id, dataset_version) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE
);

CREATE FUNCTION etf.fixture_ingest(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
PARALLEL UNSAFE
SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  existing_replay etf.fixture_ingestion_replays%ROWTYPE;
  ingest_result jsonb;
  quality_codes text[];
  canonical_content jsonb;
  accepted_at timestamp(3) with time zone := date_trunc('milliseconds', clock_timestamp());
BEGIN
  IF payload IS NULL
     OR jsonb_typeof(payload) <> 'object'
     OR NOT payload ?& ARRAY['datasetId','datasetVersion','datasetHash','manifest','jobId','descriptors','rawSources','marketObservations','economicObservations']
     OR payload - ARRAY['datasetId','datasetVersion','datasetHash','manifest','jobId','descriptors','rawSources','marketObservations','economicObservations']::text[] <> '{}'::jsonb
     OR jsonb_typeof(payload -> 'manifest') <> 'object'
     OR jsonb_typeof(payload -> 'descriptors') <> 'array'
     OR jsonb_typeof(payload -> 'rawSources') <> 'array'
     OR jsonb_typeof(payload -> 'marketObservations') <> 'array'
     OR jsonb_typeof(payload -> 'economicObservations') <> 'array'
     OR payload ->> 'datasetHash' !~ '^[0-9a-f]{64}$'
     OR payload ->> 'jobId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'FIXTURE_MANIFEST_INVALID' USING ERRCODE = '22023';
  END IF;

    IF payload ->> 'datasetId' IS DISTINCT FROM payload -> 'manifest' ->> 'datasetId'
      OR payload ->> 'datasetVersion' IS DISTINCT FROM payload -> 'manifest' ->> 'datasetVersion' THEN
    RAISE EXCEPTION 'FIXTURE_MANIFEST_INVALID' USING ERRCODE = '22023';
  END IF;
  IF payload ->> 'datasetHash' IS DISTINCT FROM payload -> 'manifest' ->> 'datasetHash' THEN
    RAISE EXCEPTION 'FIXTURE_DATASET_HASH_MISMATCH' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload -> 'descriptors') AS item(descriptor)
     WHERE jsonb_typeof(descriptor) <> 'object'
        OR NOT descriptor ?& ARRAY['path','mediaType','byteLength','contentHash','ordinal']
        OR descriptor - ARRAY['path','mediaType','byteLength','contentHash','ordinal']::text[] <> '{}'::jsonb
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload -> 'rawSources') AS item(source)
     WHERE jsonb_typeof(source) <> 'object'
        OR NOT source ?& ARRAY['rawSourceHash','contentBase64','byteLength']
        OR source - ARRAY['rawSourceHash','contentBase64','byteLength']::text[] <> '{}'::jsonb
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload -> 'marketObservations') AS item(observation)
     WHERE jsonb_typeof(observation) <> 'object'
        OR NOT observation ?& ARRAY['instrumentId','tradingDate','providerId','adjustmentPolicy','revision','sourceAvailableAt','numericClass','value','currency','rawSourceRef','rawSourceHash','normalizationId','ingestionJobId','qualityState','qualityCodes']
        OR observation - ARRAY['instrumentId','tradingDate','providerId','adjustmentPolicy','revision','sourceAvailableAt','numericClass','value','currency','rawSourceRef','rawSourceHash','normalizationId','ingestionJobId','qualityState','qualityCodes']::text[] <> '{}'::jsonb
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload -> 'economicObservations') AS item(observation)
     WHERE jsonb_typeof(observation) <> 'object'
        OR NOT observation ?& ARRAY['providerId','seriesId','observationDate','releaseTimestamp','vintageId','numericClass','value','rawSourceRef','rawSourceHash','normalizationId','ingestionJobId','qualityState','qualityCodes']
        OR observation - ARRAY['providerId','seriesId','observationDate','releaseTimestamp','vintageId','numericClass','value','rawSourceRef','rawSourceHash','normalizationId','ingestionJobId','qualityState','qualityCodes']::text[] <> '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'FIXTURE_MANIFEST_INVALID' USING ERRCODE = '22023';
  END IF;

  canonical_content := payload;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload -> 'marketObservations') AS item(observation)
     WHERE observation ->> 'revision' !~ '^(0|[1-9][0-9]*)$'
        OR observation ->> 'tradingDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        OR NOT pg_input_is_valid(observation ->> 'tradingDate', 'date')
        OR observation ->> 'sourceAvailableAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$'
        OR NOT pg_input_is_valid(observation ->> 'sourceAvailableAt', 'timestamp with time zone')
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload -> 'economicObservations') AS item(observation)
     WHERE observation ->> 'observationDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        OR NOT pg_input_is_valid(observation ->> 'observationDate', 'date')
        OR observation ->> 'releaseTimestamp' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$'
        OR NOT pg_input_is_valid(observation ->> 'releaseTimestamp', 'timestamp with time zone')
  ) THEN
    RAISE EXCEPTION 'FIXTURE_TEMPORAL_INVALID' USING ERRCODE = '22007';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements((payload -> 'marketObservations') || (payload -> 'economicObservations')) AS item(observation)
     WHERE observation ->> 'numericClass' NOT IN ('Quantity','UnitPrice','Money','Rate')
        OR observation ->> 'value' ~ '^-0\\.[0]+$'
        OR CASE observation ->> 'numericClass'
             WHEN 'Quantity' THEN observation ->> 'value' !~ '^-?(0|[1-9][0-9]{0,17})\\.[0-9]{10}$'
             WHEN 'UnitPrice' THEN observation ->> 'value' !~ '^-?(0|[1-9][0-9]{0,17})\\.[0-9]{10}$'
             WHEN 'Money' THEN observation ->> 'value' !~ '^-?(0|[1-9][0-9]{0,19})\\.[0-9]{8}$'
             WHEN 'Rate' THEN observation ->> 'value' !~ '^-?(0|[1-9][0-9]{0,15})\\.[0-9]{12}$'
             ELSE true
           END
  ) THEN
    RAISE EXCEPTION 'FIXTURE_DECIMAL_INVALID' USING ERRCODE = '22003';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements((payload -> 'marketObservations') || (payload -> 'economicObservations')) AS item(observation)
     WHERE jsonb_typeof(observation -> 'qualityCodes') <> 'array'
  ) THEN
    RAISE EXCEPTION 'FIXTURE_MANIFEST_INVALID' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(pg_catalog.hashtextextended('etf:fixture:' || (payload ->> 'datasetId') || ':' || (payload ->> 'datasetVersion'), 0));
  SELECT * INTO existing_replay
    FROM etf.fixture_ingestion_replays
   WHERE dataset_id = payload ->> 'datasetId'
     AND dataset_version = payload ->> 'datasetVersion'
     AND job_id = (payload ->> 'jobId')::uuid;
  IF FOUND THEN
    IF existing_replay.canonical_content = canonical_content THEN
      RETURN existing_replay.result;
    END IF;
    RAISE EXCEPTION 'FIXTURE_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
  END IF;

  INSERT INTO etf.fixture_packages VALUES (
    payload ->> 'datasetId', payload ->> 'datasetVersion', payload ->> 'datasetHash',
    payload -> 'manifest', accepted_at
  ) ON CONFLICT (dataset_id, dataset_version) DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM etf.fixture_packages
     WHERE dataset_id = payload ->> 'datasetId'
       AND dataset_version = payload ->> 'datasetVersion'
       AND dataset_hash = payload ->> 'datasetHash'
       AND manifest = payload -> 'manifest'
  ) THEN
    RAISE EXCEPTION 'FIXTURE_IDEMPOTENCY_CONFLICT' USING ERRCODE = '23505';
  END IF;

  INSERT INTO etf.fixture_descriptors
  SELECT payload ->> 'datasetId', payload ->> 'datasetVersion', descriptor ->> 'path',
         descriptor ->> 'mediaType', (descriptor ->> 'byteLength')::bigint,
         descriptor ->> 'contentHash', (descriptor ->> 'ordinal')::bigint
    FROM jsonb_array_elements(payload -> 'descriptors') AS item(descriptor);

  INSERT INTO etf.fixture_raw_sources
  SELECT payload ->> 'datasetId', payload ->> 'datasetVersion', source ->> 'rawSourceHash',
         decode(source ->> 'contentBase64', 'base64'), (source ->> 'byteLength')::bigint
    FROM jsonb_array_elements(payload -> 'rawSources') AS item(source);

  FOR quality_codes IN
    SELECT ARRAY(
      SELECT code
        FROM jsonb_array_elements_text(observation -> 'qualityCodes') WITH ORDINALITY AS entry(code, position)
       ORDER BY position
    )
      FROM jsonb_array_elements((payload -> 'marketObservations') || (payload -> 'economicObservations')) AS item(observation)
  LOOP
    IF quality_codes <> ARRAY(SELECT DISTINCT code FROM unnest(quality_codes) AS code ORDER BY code) THEN
      RAISE EXCEPTION 'FIXTURE_MANIFEST_INVALID' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  INSERT INTO etf.market_observations
  SELECT payload ->> 'datasetId', payload ->> 'datasetVersion', observation ->> 'instrumentId',
         (observation ->> 'tradingDate')::date, observation ->> 'providerId', observation ->> 'adjustmentPolicy',
         (observation ->> 'revision')::bigint, (observation ->> 'sourceAvailableAt')::timestamp(3) with time zone,
         observation ->> 'numericClass',
         CASE WHEN observation ->> 'numericClass' IN ('Quantity','UnitPrice') THEN (observation ->> 'value')::numeric(28,10) END,
         CASE WHEN observation ->> 'numericClass' = 'Money' THEN (observation ->> 'value')::numeric(28,8) END,
         CASE WHEN observation ->> 'numericClass' = 'Rate' THEN (observation ->> 'value')::numeric(28,12) END,
         observation ->> 'currency', observation ->> 'rawSourceRef', observation ->> 'rawSourceHash',
         observation ->> 'normalizationId', observation ->> 'ingestionJobId', observation ->> 'qualityState',
         ARRAY(SELECT jsonb_array_elements_text(observation -> 'qualityCodes') ORDER BY 1)
    FROM jsonb_array_elements(payload -> 'marketObservations') AS item(observation);

  INSERT INTO etf.economic_observations
  SELECT payload ->> 'datasetId', payload ->> 'datasetVersion', observation ->> 'providerId', observation ->> 'seriesId',
         (observation ->> 'observationDate')::date, (observation ->> 'releaseTimestamp')::timestamp(3) with time zone,
         observation ->> 'vintageId', observation ->> 'numericClass',
         CASE WHEN observation ->> 'numericClass' IN ('Quantity','UnitPrice') THEN (observation ->> 'value')::numeric(28,10) END,
         CASE WHEN observation ->> 'numericClass' = 'Money' THEN (observation ->> 'value')::numeric(28,8) END,
         CASE WHEN observation ->> 'numericClass' = 'Rate' THEN (observation ->> 'value')::numeric(28,12) END,
         observation ->> 'rawSourceRef', observation ->> 'rawSourceHash', observation ->> 'normalizationId',
         observation ->> 'ingestionJobId', observation ->> 'qualityState',
         ARRAY(SELECT jsonb_array_elements_text(observation -> 'qualityCodes') ORDER BY 1)
    FROM jsonb_array_elements(payload -> 'economicObservations') AS item(observation);

  ingest_result := jsonb_build_object(
    'datasetId', payload ->> 'datasetId',
    'datasetVersion', payload ->> 'datasetVersion',
    'datasetHash', payload ->> 'datasetHash',
    'acceptedCount', jsonb_array_length(payload -> 'marketObservations') + jsonb_array_length(payload -> 'economicObservations')
  );
  INSERT INTO etf.fixture_ingestion_replays VALUES (
    payload ->> 'datasetId', payload ->> 'datasetVersion', (payload ->> 'jobId')::uuid,
    canonical_content, ingest_result, accepted_at
  );
  RETURN ingest_result;
EXCEPTION
  WHEN numeric_value_out_of_range THEN
    RAISE EXCEPTION 'FIXTURE_DECIMAL_INVALID' USING ERRCODE = '22003';
  WHEN datetime_field_overflow THEN
    RAISE EXCEPTION 'FIXTURE_TEMPORAL_INVALID' USING ERRCODE = '22007';
  WHEN check_violation THEN
    RAISE EXCEPTION 'FIXTURE_MANIFEST_INVALID' USING ERRCODE = '22023';
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'FIXTURE_MANIFEST_INVALID' USING ERRCODE = '22023';
END;
$function$;
REVOKE ALL ON FUNCTION etf.fixture_ingest(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etf.fixture_ingest(jsonb) TO app_runtime;

SET LOCAL ROLE schema_owner;
REVOKE CREATE ON SCHEMA etf FROM application_writer_owner;
SET LOCAL ROLE migration_owner;
`;

export const fixtureMigration: MigrationArtifact = {
  migrationId: "0004-fixtures",
  sequence: 4,
  sql,
};
