import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import pg from "pg";

import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import { applicationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import { domainLedgerMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import {
  fixtureFunctionNames,
  fixtureMigration,
  fixtureTableNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
import { projectPostgresSchemaManifest } from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";
import {
  createRoleBootstrapSql,
  productRoles,
} from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const fixtureLockSql =
  "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const fixtureUnlockSql =
  "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";

async function cleanBootstrap(client) {
  await client.query("ROLLBACK").catch(() => undefined);
  await client.query("RESET SESSION AUTHORIZATION").catch(() => undefined);
  await client.query("RESET ROLE").catch(() => undefined);
  await client.query("DROP SCHEMA IF EXISTS etf CASCADE");
  const existing = await client.query(
    "SELECT rolname FROM pg_catalog.pg_roles WHERE rolname = ANY($1::text[])",
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

async function applyPrerequisites(client) {
  await client.query(createRoleBootstrapSql());
  for (const [migration, appliedAt] of [
    [foundationMigration, "2026-09-14T00:00:00.000Z"],
    [applicationMigration, "2026-09-14T00:01:00.000Z"],
    [domainLedgerMigration, "2026-09-14T00:02:00.000Z"],
  ]) {
    await applyMigration(client, migration, appliedAt, projectPostgresSchemaManifest);
  }
}

function fixturePayload(overrides = {}) {
  const rawBytes = Buffer.from("approved local fixture source\n", "utf8");
  const rawSourceHash = createHash("sha256").update(rawBytes).digest("hex");
  const datasetHash = "5c68a8c394aecb6e27833f4216bfcd5f5c724e3aff6cfad7980192ec8d1e0b68";
  return {
    datasetId: "etf-prototype-core",
    datasetVersion: "2026.01.0",
    datasetHash,
    manifest: {
      contractVersion: "1.0.0-candidate.2",
      datasetHash,
      datasetId: "etf-prototype-core",
      datasetVersion: "2026.01.0",
      economicCoverage: [
        { observationDates: ["2025-12-01"], providerId: "FRED", seriesId: "CPI" },
      ],
      files: [
        {
          byteLength: 489,
          mediaType: "application/x-ndjson",
          recordCount: 1,
          relativePath: "economic-vintages.jsonl",
          sha256: "6d274e625f2f3efbe6e2b6f3160531b8f3b96ab86e846f7167e17ecf3e5ceb13",
        },
        {
          byteLength: 543,
          mediaType: "application/x-ndjson",
          recordCount: 1,
          relativePath: "market-observations.jsonl",
          sha256: "bf5e14badd7df4312cc69f818ba8e9123dfe33d0e934223eef5308520aa45cab",
        },
        {
          byteLength: 30,
          mediaType: "application/octet-stream",
          recordCount: 1,
          relativePath: `raw-sources/${rawSourceHash}`,
          sha256: rawSourceHash,
        },
      ],
      fixturePolicyId: "fixture-policy-1",
      marketCoverage: [
        {
          adjustmentPolicy: "split-adjusted",
          instrumentId: "ETF-1",
          requiredTradingDates: ["2026-01-30"],
        },
      ],
      prototypeCandidate: "v1.0.0-prototype.1",
      schemaVersion: "1.0.0",
    },
    jobId: "40000000-0000-4000-8000-000000000001",
    descriptors: [
      {
        path: "economic-vintages.jsonl",
        mediaType: "application/x-ndjson",
        byteLength: 489,
        contentHash: "6d274e625f2f3efbe6e2b6f3160531b8f3b96ab86e846f7167e17ecf3e5ceb13",
        ordinal: 0,
      },
      {
        path: "market-observations.jsonl",
        mediaType: "application/x-ndjson",
        byteLength: 543,
        contentHash: "bf5e14badd7df4312cc69f818ba8e9123dfe33d0e934223eef5308520aa45cab",
        ordinal: 1,
      },
      {
        path: `raw-sources/${rawSourceHash}`,
        mediaType: "application/octet-stream",
        byteLength: rawBytes.length,
        contentHash: rawSourceHash,
        ordinal: 2,
      },
    ],
    rawSources: [
      {
        rawSourceHash,
        contentBase64: rawBytes.toString("base64"),
        byteLength: rawBytes.length,
      },
    ],
    marketObservations: [
      {
        instrumentId: "ETF-1",
        tradingDate: "2026-01-30",
        providerId: "fixture",
        adjustmentPolicy: "split-adjusted",
        revision: "1",
        sourceAvailableAt: "2026-01-30T22:00:00.000Z",
        numericClass: "UnitPrice",
        value: "100.0000000000",
        currency: "USD",
        rawSourceRef: `raw-sources/${rawSourceHash}`,
        rawSourceHash,
        normalizationId: "fixture-normalization@1.0.0",
        ingestionJobId: "fixture-build-1",
        qualityState: "Valid",
        qualityCodes: [],
      },
      {
        instrumentId: "ETF-1",
        tradingDate: "2026-01-30",
        providerId: "fixture",
        adjustmentPolicy: "split-adjusted",
        revision: "2",
        sourceAvailableAt: "2026-01-31T22:00:00.000Z",
        numericClass: "UnitPrice",
        value: "101.0000000000",
        currency: "USD",
        rawSourceRef: `raw-sources/${rawSourceHash}`,
        rawSourceHash,
        normalizationId: "fixture-normalization@1.0.0",
        ingestionJobId: "fixture-build-1",
        qualityState: "Stale",
        qualityCodes: ["SOURCE_DELAYED"],
      },
    ],
    economicObservations: [
      {
        providerId: "FRED",
        seriesId: "CPI",
        observationDate: "2025-12-01",
        releaseTimestamp: "2026-01-15T13:30:00.000Z",
        vintageId: "2026-01-15",
        numericClass: "Rate",
        value: "3.000000000000",
        rawSourceRef: `raw-sources/${rawSourceHash}`,
        rawSourceHash,
        normalizationId: "fixture-normalization@1.0.0",
        ingestionJobId: "fixture-build-1",
        qualityState: "Valid",
        qualityCodes: [],
      },
      {
        providerId: "FRED",
        seriesId: "CPI",
        observationDate: "2025-12-01",
        releaseTimestamp: "2026-02-15T13:30:00.000Z",
        vintageId: "2026-02-15",
        numericClass: "Rate",
        value: "3.100000000000",
        rawSourceRef: `raw-sources/${rawSourceHash}`,
        rawSourceHash,
        normalizationId: "fixture-normalization@1.0.0",
        ingestionJobId: "fixture-build-1",
        qualityState: "Valid",
        qualityCodes: [],
      },
    ],
    ...overrides,
  };
}

async function ingest(client, payload) {
  await client.query("SET SESSION AUTHORIZATION app_runtime");
  try {
    const result = await client.query(
      "SELECT etf.fixture_ingest($1::jsonb) AS result",
      [payload],
    );
    return result.rows[0].result;
  } finally {
    await client.query("RESET SESSION AUTHORIZATION");
  }
}

test(
  "0004 rolls back its complete catalog on manifest failure",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await assert.rejects(
        () =>
          applyMigration(
            client,
            fixtureMigration,
            "2026-09-14T00:03:00.000Z",
            async () => {
              throw new Error("forced 0004 manifest stop");
            },
          ),
        /forced 0004 manifest stop/,
      );
      const remaining = await client.query(
        `SELECT count(*)::integer AS object_count
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'etf'
            AND relation.relname = ANY($1::text[])`,
        [fixtureTableNames],
      );
      assert.deepEqual(remaining.rows, [{ object_count: 0 }]);
      const functionState = await client.query(
        `SELECT pg_catalog.to_regprocedure('etf.fixture_ingest(jsonb)') IS NULL AS function_absent,
                pg_catalog.has_function_privilege('public', 'etf.job_start(jsonb)', 'EXECUTE') AS preceding_grant_preserved`,
      );
      assert.deepEqual(functionState.rows, [{ function_absent: true, preceding_grant_preserved: false }]);
      const migrationRows = await client.query(
        "SELECT count(*)::integer AS migration_count FROM etf.schema_migrations",
      );
      assert.deepEqual(migrationRows.rows, [{ migration_count: 3 }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0004 commits exact fixture authority and atomic replay behavior",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      const applied = await applyMigration(
        client,
        fixtureMigration,
        "2026-09-14T00:03:00.000Z",
        projectPostgresSchemaManifest,
      );
      assert.equal(
        applied.contentHash,
        "9bf81885aab5fafe8bcac9b372d7bbd0bec601fc29e0cdbc234a65fc3d5489f1",
      );
      assert.equal(
        applied.schemaManifestHash,
        "777a6a0d08bdc2670253d4fef882d1683ef7b7e321079d3a9d2421f0b779ee18",
      );

      const owners = await client.query(
        `SELECT relation.relname AS name, owner.rolname AS owner
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = relation.relowner
          WHERE namespace.nspname = 'etf' AND relation.relkind = 'r'
            AND relation.relname = ANY($1::text[])
          ORDER BY relation.relname`,
        [fixtureTableNames],
      );
      assert.deepEqual(
        owners.rows,
        [...fixtureTableNames].sort().map((name) => ({
          name,
          owner: "application_writer_owner",
        })),
      );

      const catalogNames = await client.query(
        `SELECT constraint_record.conname AS name
           FROM pg_catalog.pg_constraint AS constraint_record
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = constraint_record.connamespace
          WHERE namespace.nspname = 'etf'
            AND constraint_record.conname = ANY($1::text[])
          UNION
         SELECT index_record.relname AS name
           FROM pg_catalog.pg_class AS index_record
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = index_record.relnamespace
          WHERE namespace.nspname = 'etf' AND index_record.relkind = 'i'
            AND index_record.relname = ANY($1::text[])
          ORDER BY name`,
        [[
          "fk_economic_observations__ds_ver__fixture_packages",
          "fk_economic_observations__ds_ver_hash__fixture_raw_sources",
          "fk_fixture_descriptors__ds_ver__fixture_packages",
          "fk_fixture_ingestion_replays__ds_ver__fixture_packages",
          "fk_fixture_raw_sources__ds_ver__fixture_packages",
          "fk_market_observations__ds_ver__fixture_packages",
          "fk_market_observations__ds_ver_hash__fixture_raw_sources",
          "ix_economic_observations__prov_series_date_release_vintage",
          "ix_market_observations__inst_date_prov_adj_available_rev",
          "uq_economic_observations__ds_ver_job_prov_series_date_rel_vtg",
          "uq_economic_observations__ds_ver_prov_series_date_release",
          "uq_market_observations__ds_ver_job_inst_date_prov_adj_rev",
        ]],
      );
      assert.deepEqual(catalogNames.rows.map(({ name }) => name), [
        "fk_economic_observations__ds_ver__fixture_packages",
        "fk_economic_observations__ds_ver_hash__fixture_raw_sources",
        "fk_fixture_descriptors__ds_ver__fixture_packages",
        "fk_fixture_ingestion_replays__ds_ver__fixture_packages",
        "fk_fixture_raw_sources__ds_ver__fixture_packages",
        "fk_market_observations__ds_ver__fixture_packages",
        "fk_market_observations__ds_ver_hash__fixture_raw_sources",
        "ix_economic_observations__prov_series_date_release_vintage",
        "ix_market_observations__inst_date_prov_adj_available_rev",
        "uq_economic_observations__ds_ver_job_prov_series_date_rel_vtg",
        "uq_economic_observations__ds_ver_prov_series_date_release",
        "uq_market_observations__ds_ver_job_inst_date_prov_adj_rev",
      ]);

      const functions = await client.query(
        `SELECT function_record.proname AS name, owner.rolname AS owner,
                function_record.prosecdef AS security_definer,
                function_record.proconfig AS configuration,
                pg_catalog.has_function_privilege('public', function_record.oid, 'EXECUTE') AS public_execute
           FROM pg_catalog.pg_proc AS function_record
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = function_record.proowner
          WHERE namespace.nspname = 'etf' AND function_record.proname = ANY($1::text[])`,
        [fixtureFunctionNames],
      );
      assert.deepEqual(functions.rows, [{
        name: "fixture_ingest",
        owner: "application_writer_owner",
        security_definer: true,
        configuration: ["search_path=pg_catalog, etf"],
        public_execute: false,
      }]);

      await client.query("GRANT USAGE ON SCHEMA etf TO app_runtime");
      const payload = fixturePayload();
      const first = await ingest(client, payload);
      const replay = await ingest(client, payload);
      assert.deepEqual(replay, first);
      assert.equal(first.acceptedCount, 4);
       const acceptance = await client.query(
         `SELECT accepted_at <= clock_timestamp() AS observed,
           accepted_at > clock_timestamp() - interval '1 minute' AS recent
         FROM etf.fixture_packages`,
       );
       assert.deepEqual(acceptance.rows, [{ observed: true, recent: true }]);
      const counts = await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.fixture_packages) AS packages,
                (SELECT count(*)::integer FROM etf.market_observations) AS market,
                (SELECT count(*)::integer FROM etf.economic_observations) AS economic,
                (SELECT count(*)::integer FROM etf.fixture_ingestion_replays) AS replays`,
      );
      assert.deepEqual(counts.rows, [{ packages: 1, market: 2, economic: 2, replays: 1 }]);

      const preserved = await client.query(
        `SELECT package.dataset_hash, package.manifest,
                (SELECT jsonb_agg(jsonb_build_object(
                   'path', descriptor.path,
                   'mediaType', descriptor.media_type,
                   'byteLength', descriptor.byte_length,
                   'contentHash', descriptor.content_hash,
                   'ordinal', descriptor.ordinal
                 ) ORDER BY descriptor.ordinal)
                   FROM etf.fixture_descriptors AS descriptor) AS descriptors,
                (SELECT encode(source.content, 'hex') FROM etf.fixture_raw_sources AS source) AS raw_content_hex,
                 (SELECT jsonb_agg(jsonb_build_object(
                   'revision', observation.revision::text,
                   'sourceAvailableAt', to_char(observation.source_available_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                   'value', observation.value_quantity::text,
                   'qualityCodes', observation.quality_codes
                  ) ORDER BY observation.instrument_id, observation.trading_date,
                         observation.provider_id, observation.adjustment_policy,
                         observation.source_available_at, observation.revision DESC)
                   FROM etf.market_observations AS observation) AS market_observations,
                 (SELECT jsonb_agg(jsonb_build_object(
                   'releaseTimestamp', to_char(observation.release_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                   'vintageId', observation.vintage_id,
                   'value', observation.value_rate::text
                  ) ORDER BY observation.provider_id, observation.series_id,
                         observation.observation_date, observation.release_timestamp DESC,
                         observation.vintage_id)
                   FROM etf.economic_observations AS observation) AS economic_observations
           FROM etf.fixture_packages AS package`,
      );
      assert.equal(preserved.rows[0].dataset_hash, payload.datasetHash);
      assert.deepEqual(preserved.rows[0].manifest, payload.manifest);
      assert.deepEqual(
        preserved.rows[0].descriptors,
        payload.descriptors.map(({ path, mediaType, byteLength, contentHash, ordinal }) => ({
          path,
          mediaType,
          byteLength,
          contentHash,
          ordinal,
        })),
      );
      assert.equal(
        preserved.rows[0].raw_content_hex,
        Buffer.from("approved local fixture source\n", "utf8").toString("hex"),
      );
      assert.deepEqual(preserved.rows[0].market_observations, [
        {
          revision: "1",
          sourceAvailableAt: payload.marketObservations[0].sourceAvailableAt,
          value: payload.marketObservations[0].value,
          qualityCodes: [],
        },
        {
          revision: "2",
          sourceAvailableAt: payload.marketObservations[1].sourceAvailableAt,
          value: payload.marketObservations[1].value,
          qualityCodes: ["SOURCE_DELAYED"],
        },
      ]);
      assert.deepEqual(preserved.rows[0].economic_observations, [
        {
          releaseTimestamp: payload.economicObservations[1].releaseTimestamp,
          vintageId: payload.economicObservations[1].vintageId,
          value: payload.economicObservations[1].value,
        },
        {
          releaseTimestamp: payload.economicObservations[0].releaseTimestamp,
          vintageId: payload.economicObservations[0].vintageId,
          value: payload.economicObservations[0].value,
        },
      ]);

      await assert.rejects(
        () => {
          const changedPayload = fixturePayload();
          changedPayload.marketObservations[0].value = "101.0000000000";
          return ingest(client, changedPayload);
        },
        /FIXTURE_IDEMPOTENCY_CONFLICT/,
      );
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0004 rejects noncanonical physical values before PostgreSQL casts or sorting",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await applyMigration(
        client,
        fixtureMigration,
        "2026-09-14T00:03:00.000Z",
        projectPostgresSchemaManifest,
      );
      await client.query("GRANT USAGE ON SCHEMA etf TO app_runtime");

      for (const [mutate, errorCode] of [
        [(payload) => { payload.acceptedAt = "2000-01-01T00:00:00.000Z"; }, "FIXTURE_MANIFEST_INVALID"],
        [(payload) => { payload.manifest.datasetHash = "b".repeat(64); }, "FIXTURE_DATASET_HASH_MISMATCH"],
        [(payload) => { payload.marketObservations[0].unknown = true; }, "FIXTURE_MANIFEST_INVALID"],
        [(payload) => { payload.marketObservations[0].revision = "01"; }, "FIXTURE_TEMPORAL_INVALID"],
        [(payload) => { payload.marketObservations[0].value = "100.00000000001"; }, "FIXTURE_DECIMAL_INVALID"],
        [(payload) => {
          payload.marketObservations[0].numericClass = "Money";
          payload.marketObservations[0].value = "100.000000000";
        }, "FIXTURE_DECIMAL_INVALID"],
        [(payload) => {
          payload.marketObservations[0].numericClass = "Money";
          payload.marketObservations[0].value = "100000000000000000000.00000000";
        }, "FIXTURE_DECIMAL_INVALID"],
        [(payload) => { payload.marketObservations[0].value = "-0.0000000000"; }, "FIXTURE_DECIMAL_INVALID"],
        [(payload) => { payload.marketObservations[0].tradingDate = "2026-02-30"; }, "FIXTURE_TEMPORAL_INVALID"],
        [(payload) => { payload.marketObservations[0].sourceAvailableAt = "2026-01-30 22:00:00+00"; }, "FIXTURE_TEMPORAL_INVALID"],
        [(payload) => {
          payload.marketObservations[0].qualityState = "Stale";
          payload.marketObservations[0].qualityCodes = ["Z_CODE", "A_CODE"];
        }, "FIXTURE_MANIFEST_INVALID"],
      ]) {
        const payload = fixturePayload();
        mutate(payload);
        await assert.rejects(() => ingest(client, payload), new RegExp(errorCode));
      }

      const remaining = await client.query(
        "SELECT count(*)::integer AS package_count FROM etf.fixture_packages",
      );
      assert.deepEqual(remaining.rows, [{ package_count: 0 }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0004 preserves DEC-014 Money boundaries without rounding",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await applyMigration(
        client,
        fixtureMigration,
        "2026-09-14T00:03:00.000Z",
        projectPostgresSchemaManifest,
      );
      await client.query("GRANT USAGE ON SCHEMA etf TO app_runtime");

      const payload = fixturePayload();
      const values = [
        "999999999999999999.99999999",
        "-9999999999999999999.99999999",
        "99999999999999999999.99999999",
        "-99999999999999999999.99999999",
      ];
      for (const [index, observation] of payload.marketObservations.entries()) {
        observation.numericClass = "Money";
        observation.value = values[index];
      }
      for (const [index, observation] of payload.economicObservations.entries()) {
        observation.numericClass = "Money";
        observation.value = values[index + payload.marketObservations.length];
      }

      await ingest(client, payload);
      const stored = await client.query(
        `SELECT value_money::text AS value FROM etf.market_observations
         UNION ALL
         SELECT value_money::text AS value FROM etf.economic_observations
         ORDER BY value`,
      );
      assert.deepEqual(
        stored.rows.map(({ value }) => value).sort(),
        [...values].sort(),
      );
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0004 rejects invalid observations without leaving package data",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await applyMigration(
        client,
        fixtureMigration,
        "2026-09-14T00:03:00.000Z",
        projectPostgresSchemaManifest,
      );
      await client.query("GRANT USAGE ON SCHEMA etf TO app_runtime");
      for (const mutate of [
        (payload) => { payload.marketObservations[0].providerId = "network-provider"; },
        (payload) => {
          payload.datasetId = "ETF/fixture";
          payload.manifest.datasetId = payload.datasetId;
        },
      ]) {
        const payload = fixturePayload();
        mutate(payload);
        await assert.rejects(
          () => ingest(client, payload),
          /FIXTURE_MANIFEST_INVALID/,
        );
      }
      const remaining = await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.fixture_packages) AS packages,
                (SELECT count(*)::integer FROM etf.fixture_descriptors) AS descriptors,
                (SELECT count(*)::integer FROM etf.fixture_raw_sources) AS raw_sources,
                (SELECT count(*)::integer FROM etf.market_observations) AS market,
                (SELECT count(*)::integer FROM etf.fixture_ingestion_replays) AS replays`,
      );
      assert.deepEqual(remaining.rows, [{ packages: 0, descriptors: 0, raw_sources: 0, market: 0, replays: 0 }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);
