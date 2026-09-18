import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import pg from "pg";

import { createAnalyticsEvidenceService } from "../../dist/Application/analytics-evidence-service.js";
import { createCanonicalAnalyticsEvidence } from "../../dist/Domain/Analytics/analytics.js";
import { canonicalizeJson } from "../../dist/Infrastructure/CanonicalJson/canonical-json.js";
import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import { applicationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import {
  analyticsEvidenceFunctionNames,
  analyticsEvidenceMigration,
  analyticsEvidenceTableNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/analytics-evidence.js";
import { domainLedgerMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import { fixtureMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
import { projectPostgresSchemaManifest } from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";
import {
  createRoleBootstrapSql,
  productRoles,
} from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const lockSql =
  "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const unlockSql =
  "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const analyticsEvidenceContentHash = "638fdcb40695be04a30c56807e529f753fd37c80ccfdcd6ad58f04e603287cc4";
const analyticsEvidenceManifestHash = "7832569fded48a31c07b400d599e9f3c94d94cd7f23062062a0627e8fd74efc4";

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
    [fixtureMigration, "2026-09-14T00:03:00.000Z"],
  ]) {
    await applyMigration(client, migration, appliedAt, projectPostgresSchemaManifest);
  }
}

function hashJson(value) {
  return createHash("sha256").update(canonicalizeJson(value), "utf8").digest("hex");
}

function evidencePayload(overrides = {}) {
  const canonicalInput = {
    domain: "etf.analytics.input.v1",
    economicVintages: [],
    evaluationAt: "2026-01-31T00:00:00.000Z",
    inputSchemaVersion: "1.0.0",
    marketObservations: [],
    portfolioContextHash: "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
    transformationLineage: [],
  };
  const inputHash = hashJson(canonicalInput);
  const canonicalConfiguration = {
    assumptions: {
      costRate: "0.001000000000",
      fillTiming: "next-session-open",
      slippageRate: "0.000500000000",
    },
    baselineVersion: "v1.0.0",
    benchmark: { instrumentId: "BENCH-1", version: "1" },
    codeHash: "1".repeat(64),
    domain: "etf.analytics.configuration.v1",
    environment: { dependencyLockHash: "2".repeat(64), runtime: "node-20" },
    evaluationAt: "2026-01-31T00:00:00.000Z",
    inputHash,
    parameters: { lookbackSessions: "20" },
    providerPolicyReferences: ["fixture-policy-1"],
    ruleId: "p0-rule",
    ruleVersion: "1.0.0",
    seed: "42",
  };
  const configurationHash = hashJson(canonicalConfiguration);
  const canonicalResult = {
    configurationHash,
    domain: "etf.analytics.result.v1",
    metrics: [{ metricId: "totalReturn", numericClass: "Rate", value: "0.010000000000" }],
    resultSchemaVersion: "1.0.0",
    signals: [{ instrumentId: "ETF-1", label: "Neutral", score: "0.000000000000" }],
    trades: [],
    warnings: [],
  };
  return {
    evidenceId: "evidence-fixture-1",
    evidenceCommitCommandId: "50000000-0000-4000-8000-000000000001",
    publicationTargetId: "p0-current",
    expectedPublicationVersion: 0,
    baselineVersion: "v1.0.0",
    retentionPolicyVersion: "RET-A-1.0",
    inputSetId: "input-fixture-1",
    inputSchemaVersion: "1.0.0",
    evaluationAt: "2026-01-31T00:00:00.000Z",
    canonicalInput,
    evidenceSchemaVersion: "1.0.0",
    canonicalConfiguration,
    canonicalResult,
    reproducibilityStatus: "Complete",
    reproducibilityReason: null,
    ...overrides,
  };
}

function rehashEvidence(payload, overrides = {}) {
  const canonicalInput = overrides.canonicalInput ?? payload.canonicalInput;
  const canonicalConfiguration = {
    ...(overrides.canonicalConfiguration ?? payload.canonicalConfiguration),
    inputHash: hashJson(canonicalInput),
  };
  const canonicalResult = {
    ...(overrides.canonicalResult ?? payload.canonicalResult),
    configurationHash: hashJson(canonicalConfiguration),
  };
  return {
    ...payload,
    ...overrides,
    canonicalInput,
    canonicalConfiguration,
    canonicalResult,
  };
}

async function commitEvidence(client, payload) {
  await client.query("SET SESSION AUTHORIZATION app_runtime");
  try {
    const result = await client.query(
      "SELECT etf.evidence_commit($1::jsonb) AS result",
      [payload],
    );
    return result.rows[0].result;
  } finally {
    await client.query("RESET SESSION AUTHORIZATION");
  }
}

test(
  "0005 rolls back its complete catalog on manifest failure",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await assert.rejects(
        () => applyMigration(
          client,
          analyticsEvidenceMigration,
          "2026-09-14T00:04:00.000Z",
          async () => { throw new Error("forced 0005 manifest stop"); },
        ),
        /forced 0005 manifest stop/,
      );
      const objects = await client.query(
        `SELECT count(*)::integer AS object_count
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'etf' AND relation.relname = ANY($1::text[])`,
        [analyticsEvidenceTableNames],
      );
      assert.deepEqual(objects.rows, [{ object_count: 0 }]);
      const functions = await client.query(
        `SELECT count(*)::integer AS function_count
           FROM pg_catalog.pg_proc AS function_record
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
          WHERE namespace.nspname = 'etf' AND function_record.proname = ANY($1::text[])`,
        [analyticsEvidenceFunctionNames],
      );
      assert.deepEqual(functions.rows, [{ function_count: 0 }]);
      const migrations = await client.query(
        "SELECT count(*)::integer AS migration_count FROM etf.schema_migrations",
      );
      assert.deepEqual(migrations.rows, [{ migration_count: 4 }]);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(unlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0005 commits its exact catalog and hardened authority",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      const applied = await applyMigration(
        client,
        analyticsEvidenceMigration,
        "2026-09-14T00:04:00.000Z",
        projectPostgresSchemaManifest,
      );
      assert.equal(applied.contentHash, analyticsEvidenceContentHash);
      assert.equal(applied.schemaManifestHash, analyticsEvidenceManifestHash);

      const owners = await client.query(
        `SELECT relation.relname AS name, owner.rolname AS owner
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = relation.relowner
          WHERE namespace.nspname = 'etf' AND relation.relkind = 'r'
            AND relation.relname = ANY($1::text[])
          ORDER BY relation.relname`,
        [analyticsEvidenceTableNames],
      );
      assert.deepEqual(
        owners.rows,
        [...analyticsEvidenceTableNames].sort().map((name) => ({
          name,
          owner: "evidence_writer_owner",
        })),
      );
      const functions = await client.query(
        `SELECT function_record.proname AS name, owner.rolname AS owner,
                function_record.prosecdef AS security_definer,
                function_record.proisstrict AS strict,
                function_record.proconfig AS configuration,
                pg_catalog.has_function_privilege('public', function_record.oid, 'EXECUTE') AS public_execute
           FROM pg_catalog.pg_proc AS function_record
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = function_record.proowner
          WHERE namespace.nspname = 'etf' AND function_record.proname = ANY($1::text[])
          ORDER BY function_record.proname`,
        [analyticsEvidenceFunctionNames],
      );
      assert.deepEqual(functions.rows, [
        { name: "_evidence_rfc8785", owner: "evidence_writer_owner", security_definer: false, strict: true, configuration: ["search_path=pg_catalog, etf"], public_execute: false },
        { name: "evidence_commit", owner: "evidence_writer_owner", security_definer: true, strict: false, configuration: ["search_path=pg_catalog, etf"], public_execute: false },
        { name: "evidence_read", owner: "evidence_writer_owner", security_definer: true, strict: false, configuration: ["search_path=pg_catalog, etf"], public_execute: false },
      ]);

      const helperAuthority = await client.query(
        `SELECT pg_catalog.has_function_privilege('app_runtime', 'etf._evidence_rfc8785(jsonb)', 'EXECUTE') AS app_runtime_execute,
                pg_catalog.has_function_privilege('projection_runtime', 'etf._evidence_rfc8785(jsonb)', 'EXECUTE') AS projection_runtime_execute,
                pg_catalog.has_function_privilege('audit_runtime', 'etf._evidence_rfc8785(jsonb)', 'EXECUTE') AS audit_runtime_execute,
                pg_catalog.has_function_privilege('key_injector', 'etf._evidence_rfc8785(jsonb)', 'EXECUTE') AS key_injector_execute`,
      );
      assert.deepEqual(helperAuthority.rows, [{
        app_runtime_execute: false,
        projection_runtime_execute: false,
        audit_runtime_execute: false,
        key_injector_execute: false,
      }]);

      await client.query("SET ROLE evidence_writer_owner");
      try {
        for (const [value, expected] of [
          [{ b: [true, null, "line\nquote\""], a: "text" }, '{"a":"text","b":[true,null,"line\\nquote\\\""]}'],
          [{ "\uE000": 1, "😀": 2 }, '{"😀":2,"":1}'],
          [9007199254740991, "9007199254740991"],
        ]) {
          const canonical = await client.query(
            "SELECT etf._evidence_rfc8785($1::jsonb) AS value",
            [value],
          );
          assert.equal(canonical.rows[0].value, expected);
        }
        await assert.rejects(
          () => client.query("SELECT etf._evidence_rfc8785('1.5'::jsonb)"),
          /ANALYTICS_NUMERIC_CLASS_INVALID/,
        );
      } finally {
        await client.query("RESET ROLE");
      }
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(unlockSql);
        await client.end();
      }
    }
  },
);

test(
  "WP-5 composes canonical analytics through authorized PostgreSQL commit and read",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await applyMigration(
        client,
        analyticsEvidenceMigration,
        "2026-09-14T00:04:00.000Z",
        projectPostgresSchemaManifest,
      );
      await client.query("GRANT USAGE ON SCHEMA etf TO app_runtime");
      const payload = evidencePayload();
      const canonical = createCanonicalAnalyticsEvidence({
        configuration: payload.canonicalConfiguration,
        input: payload.canonicalInput,
        result: payload.canonicalResult,
      });
      const asRuntime = async (query, parameters) => {
        await client.query("SET SESSION AUTHORIZATION app_runtime");
        try {
          return await client.query(query, parameters);
        } finally {
          await client.query("RESET SESSION AUTHORIZATION");
        }
      };
      const service = createAnalyticsEvidenceService({
        async commit(value) {
          const result = await asRuntime("SELECT etf.evidence_commit($1::jsonb) AS result", [value]);
          return result.rows[0].result;
        },
        async read(evidenceId) {
          const result = await asRuntime("SELECT etf.evidence_read($1) AS result", [evidenceId]);
          return result.rows[0].result;
        },
        async recordDeniedAccess() {
          throw new Error("authorized composition must not record denial");
        },
        async verify(evidenceId) {
          const result = await asRuntime("SELECT etf.evidence_read($1) AS result", [evidenceId]);
          return result.rows[0].result;
        },
      }, {
        async authorize() {
          return true;
        },
      }, {
        async actorId() {
          return "analytics-worker";
        },
      });

      const committed = await service.commit(payload.evidenceId, JSON.stringify(payload));
      const read = await service.read(payload.evidenceId);

      assert.equal(committed.inputHash, canonical.inputHash);
      assert.equal(committed.configurationHash, canonical.configurationHash);
      assert.equal(committed.resultHash, canonical.resultHash);
      assert.equal(read.evidence.bundleHash, committed.bundleHash);
      assert.deepEqual(read.evidence.result, payload.canonicalResult);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(unlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0005 atomically generates retention evidence and stable replay hashes",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await applyMigration(
        client,
        analyticsEvidenceMigration,
        "2026-09-14T00:04:00.000Z",
        projectPostgresSchemaManifest,
      );
      await client.query("GRANT USAGE ON SCHEMA etf TO app_runtime");
      await client.query("SET TIME ZONE 'America/New_York'");
      const payload = evidencePayload();
      const first = await commitEvidence(client, payload);
      const replay = await commitEvidence(client, { ...payload, expectedPublicationVersion: 99 });
      assert.deepEqual(replay, first);
      await assert.rejects(
        () => commitEvidence(client, { ...payload, expectedPublicationVersion: 9_223_372_036_854_776_000 }),
        /ANALYTICS_INPUT_INCOMPLETE/,
      );

      const expectedBundle = {
        assumptions: payload.canonicalConfiguration.assumptions,
        baselineVersion: payload.baselineVersion,
        benchmark: payload.canonicalConfiguration.benchmark,
        codeHash: payload.canonicalConfiguration.codeHash,
        configurationHash: first.configurationHash,
        domain: "etf.analytics.bundle.v1",
        environment: payload.canonicalConfiguration.environment,
        evaluationAt: payload.evaluationAt,
        evidenceId: payload.evidenceId,
        evidenceSchemaVersion: payload.evidenceSchemaVersion,
        inputHash: first.inputHash,
        inputSetId: payload.inputSetId,
        parameters: payload.canonicalConfiguration.parameters,
        providerPolicyReferences: payload.canonicalConfiguration.providerPolicyReferences,
        reproducibilityReason: null,
        reproducibilityStatus: "Complete",
        result: payload.canonicalResult,
        resultHash: first.resultHash,
        retentionEpoch: first.retentionEpoch,
        retentionPolicyVersion: payload.retentionPolicyVersion,
        ruleId: payload.canonicalConfiguration.ruleId,
        ruleVersion: payload.canonicalConfiguration.ruleVersion,
        seed: payload.canonicalConfiguration.seed,
      };
      assert.equal(first.inputHash, hashJson(payload.canonicalInput));
      assert.equal(first.configurationHash, hashJson(payload.canonicalConfiguration));
      assert.equal(first.resultHash, hashJson(payload.canonicalResult));
      assert.equal(first.bundleHash, hashJson(expectedBundle));

      await client.query("SET SESSION AUTHORIZATION app_runtime");
      const read = await client.query(
        "SELECT etf.evidence_read($1) AS result",
        [payload.evidenceId],
      );
      await client.query("RESET SESSION AUTHORIZATION");
      assert.deepEqual(read.rows[0].result, {
        evidence: { ...expectedBundle, bundleHash: first.bundleHash },
      });

      await client.query(
        "UPDATE etf.analytics_input_sets SET canonical_content = canonical_content || '{\"tampered\":true}'::jsonb WHERE input_set_id = $1",
        [payload.inputSetId],
      );
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      await assert.rejects(
        () => client.query("SELECT etf.evidence_read($1)", [payload.evidenceId]),
        /ANALYTICS_INTEGRITY_FAILED/,
      );
      await client.query("RESET SESSION AUTHORIZATION");
      await client.query(
        "UPDATE etf.analytics_input_sets SET canonical_content = $2::jsonb WHERE input_set_id = $1",
        [payload.inputSetId, payload.canonicalInput],
      );
      await client.query(
        "UPDATE etf.analytics_input_sets SET portfolio_context_hash = $2 WHERE input_set_id = $1",
        [payload.inputSetId, "f".repeat(64)],
      );
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      await assert.rejects(
        () => client.query("SELECT etf.evidence_read($1)", [payload.evidenceId]),
        /ANALYTICS_INTEGRITY_FAILED/,
      );
      await client.query("RESET SESSION AUTHORIZATION");
      await client.query(
        "UPDATE etf.analytics_input_sets SET portfolio_context_hash = $2 WHERE input_set_id = $1",
        [payload.inputSetId, payload.canonicalInput.portfolioContextHash],
      );
      await client.query(
        "UPDATE etf.analytics_retention_bindings SET retain_through = retain_through + interval '1 hour' WHERE evidence_id = $1 AND target_class = 'FullBundle'",
        [payload.evidenceId],
      );
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      await assert.rejects(
        () => client.query("SELECT etf.evidence_read($1)", [payload.evidenceId]),
        /ANALYTICS_INTEGRITY_FAILED/,
      );
      await client.query("RESET SESSION AUTHORIZATION");
      await client.query(
        "UPDATE etf.analytics_retention_bindings SET retain_through = retain_through - interval '1 hour' WHERE evidence_id = $1 AND target_class = 'FullBundle'",
        [payload.evidenceId],
      );

      const stored = await client.query(
        `SELECT manifest.retention_epoch = lifecycle.event_at AS manifest_lifecycle_epoch,
                manifest.retention_epoch = publication.published_at AS manifest_publication_epoch,
                manifest.manifest_hash,
                manifest.canonical_content,
                array_agg(EXTRACT(EPOCH FROM (binding.retain_through - binding.retention_epoch)) / 3600 ORDER BY binding.target_class) AS deadline_hours,
                count(DISTINCT replay.evidence_commit_command_id)::integer AS replay_count
           FROM etf.analytics_manifests AS manifest
           JOIN etf.analytics_lifecycle_references AS lifecycle USING (evidence_id)
           JOIN etf.analytics_publications AS publication USING (evidence_id)
           JOIN etf.analytics_retention_bindings AS binding USING (evidence_id)
           JOIN etf.analytics_evidence_replays AS replay USING (evidence_id)
          GROUP BY manifest.retention_epoch, lifecycle.event_at, publication.published_at,
                   manifest.manifest_hash, manifest.canonical_content`,
      );
      assert.equal(stored.rows[0].manifest_lifecycle_epoch, true);
      assert.equal(stored.rows[0].manifest_publication_epoch, true);
      assert.equal(stored.rows[0].manifest_hash, hashJson(stored.rows[0].canonical_content));
      assert.equal(stored.rows[0].manifest_hash, first.manifestHash);
      assert.deepEqual(stored.rows[0].deadline_hours.map(Number), [43800, 43800, 17520, 8760, 2160]);
      assert.equal(stored.rows[0].replay_count, 1);

      await assert.rejects(
        () => commitEvidence(client, { ...payload, canonicalResult: { ...payload.canonicalResult, warnings: [{ warningCode: "changed", subjectId: null }] } }),
        /ANALYTICS_IDEMPOTENCY_CONFLICT/,
      );
      for (const forbidden of [
        { retentionEpoch: "2026-01-31T00:00:00.000Z" },
        { retainThrough: "2028-01-31T00:00:00.000Z" },
        { bundleHash: "0".repeat(64) },
        { manifestHash: "0".repeat(64) },
      ]) {
        await assert.rejects(
          () => commitEvidence(client, evidencePayload({
            evidenceId: `evidence-forbidden-${Object.keys(forbidden)[0]}`,
            evidenceCommitCommandId: `50000000-0000-4000-8000-00000000000${Object.keys(forbidden)[0].length % 9}`,
            ...forbidden,
          })),
          /ANALYTICS_INPUT_INCOMPLETE/,
        );
      }
      const malformed = [
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-unknown-input-field",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000020",
          publicationTargetId: "invalid-unknown-input-field",
          inputSetId: "input-invalid-unknown-field",
          canonicalInput: { ...payload.canonicalInput, unexpected: true },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-evaluation-mismatch",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000021",
          publicationTargetId: "invalid-evaluation-mismatch",
          inputSetId: "input-invalid-evaluation",
          canonicalConfiguration: {
            ...payload.canonicalConfiguration,
            evaluationAt: "2026-01-30T00:00:00.000Z",
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-unsorted-policies",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000022",
          publicationTargetId: "invalid-unsorted-policies",
          inputSetId: "input-invalid-policies",
          canonicalConfiguration: {
            ...payload.canonicalConfiguration,
            providerPolicyReferences: ["policy-z", "policy-a"],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-open-signal",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000023",
          publicationTargetId: "invalid-open-signal",
          inputSetId: "input-invalid-signal",
          canonicalResult: {
            ...payload.canonicalResult,
            signals: [{ ...payload.canonicalResult.signals[0], unexpected: true }],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-open-market",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000025",
          publicationTargetId: "invalid-open-market",
          inputSetId: "input-invalid-market",
          canonicalInput: {
            ...payload.canonicalInput,
            marketObservations: [{
              adjustmentPolicy: "SplitAdjusted",
              instrumentId: "ETF-1",
              providerId: "provider-1",
              revision: "1",
              sourceAvailableAt: payload.evaluationAt,
              tradingDate: "2026-01-30",
              unexpected: true,
              value: "1.0000000000",
            }],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-unordered-economic",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000026",
          publicationTargetId: "invalid-unordered-economic",
          inputSetId: "input-invalid-economic",
          canonicalInput: {
            ...payload.canonicalInput,
            economicVintages: ["z", "a"].map((providerId) => ({
              observationDate: "2026-01-01",
              providerId,
              releaseTimestamp: "2026-01-02T00:00:00.000Z",
              seriesId: "SERIES-1",
              value: "1.0000000000",
              vintageId: "1",
            })),
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-numeric-parameter",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000027",
          publicationTargetId: "invalid-numeric-parameter",
          inputSetId: "input-invalid-transformation",
          canonicalInput: {
            ...payload.canonicalInput,
            transformationLineage: [{
              algorithmId: "algorithm-1",
              algorithmVersion: "1.0.0",
              numericClass: "Quantity",
              outputHash: "3".repeat(64),
              outputValue: "1.0000000000",
              parameters: { window: 20 },
              parentTransformationIds: [],
              sourceObservationIds: [],
              transformationId: "transform-1",
            }],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-duplicate-trades",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000028",
          publicationTargetId: "invalid-duplicate-trades",
          inputSetId: "input-invalid-trades",
          canonicalResult: {
            ...payload.canonicalResult,
            trades: ["ETF-1", "ETF-2"].map((instrumentId) => ({
              effectiveAt: payload.evaluationAt,
              fee: "0.00000000",
              grossValue: "1.00000000",
              instrumentId,
              quantity: "1.0000000000",
              side: "Buy",
              tradeOrdinal: 0,
              unitPrice: "1.0000000000",
            })),
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-metric-scale",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000029",
          publicationTargetId: "invalid-metric-scale",
          inputSetId: "input-invalid-metric",
          canonicalResult: {
            ...payload.canonicalResult,
            metrics: [{ metricId: "totalReturn", numericClass: "Rate", value: "0.0100" }],
          },
        }), /ANALYTICS_NUMERIC_CLASS_INVALID/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-open-warning",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000030",
          publicationTargetId: "invalid-open-warning",
          inputSetId: "input-invalid-warning",
          canonicalResult: {
            ...payload.canonicalResult,
            warnings: [{ subjectId: null, unexpected: true, warningCode: "warning-1" }],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-null-market-identity",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000031",
          publicationTargetId: "invalid-null-market-identity",
          inputSetId: "input-invalid-null-market",
          canonicalInput: {
            ...payload.canonicalInput,
            marketObservations: [{
              adjustmentPolicy: "SplitAdjusted", instrumentId: "ETF-1", providerId: null,
              revision: "1", sourceAvailableAt: payload.evaluationAt,
              tradingDate: "2026-01-30", value: "1.0000000000",
            }],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-invalid-calendar-date",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000032",
          publicationTargetId: "invalid-calendar-date",
          inputSetId: "input-invalid-calendar-date",
          canonicalInput: {
            ...payload.canonicalInput,
            marketObservations: [{
              adjustmentPolicy: "SplitAdjusted", instrumentId: "ETF-1", providerId: "provider-1",
              revision: "1", sourceAvailableAt: payload.evaluationAt,
              tradingDate: "2026-02-31", value: "1.0000000000",
            }],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-json-number-decimal",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000033",
          publicationTargetId: "invalid-json-number-decimal",
          inputSetId: "input-invalid-json-number",
          canonicalResult: {
            ...payload.canonicalResult,
            metrics: [{ metricId: "totalReturn", numericClass: "Rate", value: 0.01 }],
          },
        }), /ANALYTICS_NUMERIC_CLASS_INVALID/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-unordered-sources",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000034",
          publicationTargetId: "invalid-unordered-sources",
          inputSetId: "input-invalid-unordered-sources",
          canonicalInput: {
            ...payload.canonicalInput,
            transformationLineage: [{
              algorithmId: "algorithm-1", algorithmVersion: "1.0.0", numericClass: "Quantity",
              outputHash: "3".repeat(64), outputValue: "1.0000000000", parameters: {},
              parentTransformationIds: [], sourceObservationIds: ["market|1:z", "market|1:a"],
              transformationId: "transform-1",
            }],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-null-signal-label",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000035",
          publicationTargetId: "invalid-null-signal-label",
          inputSetId: "input-invalid-null-signal",
          canonicalResult: {
            ...payload.canonicalResult,
            signals: [{ ...payload.canonicalResult.signals[0], label: null }],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-unresolved-source",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000036",
          publicationTargetId: "invalid-unresolved-source",
          inputSetId: "input-invalid-unresolved-source",
          canonicalInput: {
            ...payload.canonicalInput,
            transformationLineage: [{
              algorithmId: "algorithm-1", algorithmVersion: "1.0.0", numericClass: "Quantity",
              outputHash: "3".repeat(64), outputValue: "1.0000000000", parameters: {},
              parentTransformationIds: [], sourceObservationIds: ["market|arbitrary"],
              transformationId: "transform-1",
            }],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-empty-metric-id",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000040",
          publicationTargetId: "invalid-empty-metric-id",
          inputSetId: "input-invalid-empty-metric",
          canonicalResult: {
            ...payload.canonicalResult,
            metrics: [{ metricId: "", numericClass: "Rate", value: "0.010000000000" }],
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
        [rehashEvidence(evidencePayload(), {
          evidenceId: "evidence-object-signals",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000041",
          publicationTargetId: "invalid-object-signals",
          inputSetId: "input-invalid-object-signals",
          canonicalResult: {
            ...payload.canonicalResult,
            signals: {},
          },
        }), /ANALYTICS_INTEGRITY_FAILED/],
      ];
      for (const [invalidPayload, expectedError] of malformed) {
        await assert.rejects(
          () => commitEvidence(client, invalidPayload),
          expectedError,
          invalidPayload.evidenceId,
        );
      }
      const negativeZeroPayload = rehashEvidence(evidencePayload(), {
        evidenceId: "evidence-negative-zero",
        evidenceCommitCommandId: "50000000-0000-4000-8000-000000000024",
        publicationTargetId: "normalized-negative-zero",
        inputSetId: "input-normalized-negative-zero",
        canonicalResult: {
          ...payload.canonicalResult,
          signals: [{ ...payload.canonicalResult.signals[0], score: "-0.000000000000" }],
        },
        canonicalConfiguration: {
          ...payload.canonicalConfiguration,
          assumptions: { ...payload.canonicalConfiguration.assumptions, costRate: "-0.000000000000" },
        },
      });
      const normalized = await commitEvidence(client, negativeZeroPayload);
      const normalizedConfiguration = {
        ...negativeZeroPayload.canonicalConfiguration,
        assumptions: { ...negativeZeroPayload.canonicalConfiguration.assumptions, costRate: "0.000000000000" },
      };
      const normalizedResult = {
        ...negativeZeroPayload.canonicalResult,
        configurationHash: hashJson(normalizedConfiguration),
        signals: [{ ...negativeZeroPayload.canonicalResult.signals[0], score: "0.000000000000" }],
      };
      assert.equal(normalized.configurationHash, hashJson(normalizedConfiguration));
      assert.equal(normalized.resultHash, hashJson(normalizedResult));
      const storedNormalized = await client.query(
        "SELECT configuration #>> '{assumptions,costRate}' AS cost_rate, result #>> '{signals,0,score}' AS score FROM etf.analytics_evidence_bundles WHERE evidence_id = $1",
        [negativeZeroPayload.evidenceId],
      );
      assert.equal(storedNormalized.rows[0].cost_rate, "0.000000000000");
      assert.equal(storedNormalized.rows[0].score, "0.000000000000");
      const degradedPayload = evidencePayload({
        evidenceId: "evidence-degraded",
        evidenceCommitCommandId: "50000000-0000-4000-8000-000000000039",
        publicationTargetId: "blocked-degraded-publication",
        inputSetId: "input-degraded",
        expectedPublicationVersion: 99,
        reproducibilityStatus: "Degraded",
        reproducibilityReason: "rights-policy-1",
      });
      const degraded = await commitEvidence(client, degradedPayload);
      assert.equal(degraded.publicationVersion, 0);
      const degradedState = await client.query(
        `SELECT bundle.reproducibility_status, bundle.reason,
                EXISTS (SELECT 1 FROM etf.analytics_publications AS publication WHERE publication.evidence_id = bundle.evidence_id) AS published
           FROM etf.analytics_evidence_bundles AS bundle
          WHERE bundle.evidence_id = $1`,
        [degradedPayload.evidenceId],
      );
      assert.deepEqual(degradedState.rows[0], {
        reproducibility_status: "Degraded",
        reason: "rights-policy-1",
        published: false,
      });
      await assert.rejects(
        () => commitEvidence(client, evidencePayload({
          evidenceId: "evidence-fractional-version",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000037",
          publicationTargetId: "invalid-fractional-version",
          expectedPublicationVersion: 0.4,
        })),
        /ANALYTICS_INPUT_INCOMPLETE/,
      );
      await assert.rejects(
        () => commitEvidence(client, evidencePayload({
          evidenceId: "",
          evidenceCommitCommandId: "50000000-0000-4000-8000-000000000038",
          publicationTargetId: "invalid-empty-identity",
        })),
        /ANALYTICS_INPUT_INCOMPLETE/,
      );
      const counts = await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.analytics_evidence_bundles) AS bundles,
                (SELECT count(*)::integer FROM etf.analytics_publications) AS publications,
                (SELECT count(*)::integer FROM etf.analytics_evidence_replays) AS replays`,
      );
      assert.deepEqual(counts.rows, [{ bundles: 3, publications: 2, replays: 3 }]);

      const manifestForDuplicate = await client.query(
        `SELECT manifest_id, canonical_content,
                to_char(retention_epoch AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS event_at
           FROM etf.analytics_manifests
          WHERE evidence_id = $1`,
        [payload.evidenceId],
      );
      const duplicateLifecycle = {
        eventAt: manifestForDuplicate.rows[0].event_at,
        lifecycleSequence: 1,
        state: "Hot",
      };
      duplicateLifecycle.eventHash = hashJson({
        domain: "etf.analytics.lifecycle.v1",
        ...duplicateLifecycle,
      });
      await client.query(
        `INSERT INTO etf.analytics_lifecycle_references
           (evidence_id, lifecycle_sequence, state, event_at, event_hash)
         VALUES ($1, 1, 'Hot', $2::timestamp(3) with time zone, $3)`,
        [payload.evidenceId, duplicateLifecycle.eventAt, duplicateLifecycle.eventHash],
      );
      const duplicateManifest = {
        ...manifestForDuplicate.rows[0].canonical_content,
        lifecycleReferences: [
          ...manifestForDuplicate.rows[0].canonical_content.lifecycleReferences,
          duplicateLifecycle,
        ],
      };
      await client.query(
        "UPDATE etf.analytics_manifests SET canonical_content = $2::jsonb, manifest_hash = $3 WHERE manifest_id = $1",
        [manifestForDuplicate.rows[0].manifest_id, duplicateManifest, hashJson(duplicateManifest)],
      );
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      await assert.rejects(
        () => client.query("SELECT etf.evidence_read($1)", [payload.evidenceId]),
        /ANALYTICS_INTEGRITY_FAILED/,
      );
      await client.query("RESET SESSION AUTHORIZATION");
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(unlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0005 serializes publication replacement and reuses immutable inputs without identity collisions",
  { skip: !connectionString },
  async () => {
    const admin = new pg.Client({ connectionString });
    const contenderA = new pg.Client({ connectionString });
    const contenderB = new pg.Client({ connectionString });
    await admin.connect();
    await admin.query(lockSql);
    try {
      await cleanBootstrap(admin);
      await applyPrerequisites(admin);
      await applyMigration(
        admin,
        analyticsEvidenceMigration,
        "2026-09-14T00:04:00.000Z",
        projectPostgresSchemaManifest,
      );
      await admin.query("GRANT USAGE ON SCHEMA etf TO app_runtime");
      await contenderA.connect();
      await contenderB.connect();

      const shared = evidencePayload({
        evidenceId: "x",
        evidenceCommitCommandId: "50000000-0000-4000-8000-000000000010",
        publicationTargetId: "shared-input-a",
      });
      const reused = evidencePayload({
        evidenceId: "evidence-x",
        evidenceCommitCommandId: "50000000-0000-4000-8000-000000000011",
        publicationTargetId: "shared-input-b",
      });
      const first = await commitEvidence(contenderA, shared);
      const second = await commitEvidence(contenderB, reused);
      assert.notEqual(first.manifestId, second.manifestId);
      await contenderB.query("SET SESSION AUTHORIZATION app_runtime");
      const secondRead = await contenderB.query(
        "SELECT etf.evidence_read($1) AS result",
        [reused.evidenceId],
      );
      await contenderB.query("RESET SESSION AUTHORIZATION");
      assert.equal(secondRead.rows[0].result.evidence.evidenceId, reused.evidenceId);

      const inputRows = await admin.query(
        "SELECT count(*)::integer AS count FROM etf.analytics_input_sets WHERE input_set_id = 'input-fixture-1'",
      );
      assert.equal(inputRows.rows[0].count, 1);

      const raceA = evidencePayload({
        evidenceId: "race-a",
        evidenceCommitCommandId: "50000000-0000-4000-8000-000000000012",
        publicationTargetId: "raced-publication",
      });
      const raceB = evidencePayload({
        evidenceId: "race-b",
        evidenceCommitCommandId: "50000000-0000-4000-8000-000000000013",
        publicationTargetId: "raced-publication",
      });
      const outcomes = await Promise.allSettled([
        commitEvidence(contenderA, raceA),
        commitEvidence(contenderB, raceB),
      ]);
      assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
      const rejected = outcomes.find(({ status }) => status === "rejected");
      assert.match(rejected.reason.message, /ANALYTICS_PUBLICATION_VERSION_CONFLICT/);

      const publication = await admin.query(
        "SELECT publication_version, evidence_id FROM etf.analytics_publications WHERE publication_target_id = 'raced-publication'",
      );
      assert.equal(publication.rows[0].publication_version, "1");
      assert.ok(["race-a", "race-b"].includes(publication.rows[0].evidence_id));

      const equivalentRetry = evidencePayload({
        evidenceId: "concurrent-replay-equivalent",
        evidenceCommitCommandId: "50000000-0000-4000-8000-000000000014",
        publicationTargetId: "concurrent-replay-equivalent",
      });
      const equivalentOutcomes = await Promise.all([
        commitEvidence(contenderA, equivalentRetry),
        commitEvidence(contenderB, equivalentRetry),
      ]);
      assert.deepEqual(equivalentOutcomes[1], equivalentOutcomes[0]);

      const conflictingRetry = evidencePayload({
        evidenceId: "concurrent-replay-conflict",
        evidenceCommitCommandId: "50000000-0000-4000-8000-000000000015",
        publicationTargetId: "concurrent-replay-conflict-a",
      });
      const conflictingOutcomes = await Promise.allSettled([
        commitEvidence(contenderA, conflictingRetry),
        commitEvidence(contenderB, {
          ...conflictingRetry,
          publicationTargetId: "concurrent-replay-conflict-b",
        }),
      ]);
      assert.equal(conflictingOutcomes.filter(({ status }) => status === "fulfilled").length, 1);
      const conflict = conflictingOutcomes.find(({ status }) => status === "rejected");
      assert.match(conflict.reason.message, /ANALYTICS_IDEMPOTENCY_CONFLICT/);
    } finally {
      await contenderA.end().catch(() => undefined);
      await contenderB.end().catch(() => undefined);
      try {
        await cleanBootstrap(admin);
      } finally {
        await admin.query(unlockSql);
        await admin.end();
      }
    }
  },
);

test(
  "0005 maps late persistence failures and rolls back the complete commit",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyPrerequisites(client);
      await applyMigration(
        client,
        analyticsEvidenceMigration,
        "2026-09-14T00:04:00.000Z",
        projectPostgresSchemaManifest,
      );
      await client.query("GRANT USAGE ON SCHEMA etf TO app_runtime");
      await client.query(`
        CREATE FUNCTION etf.reject_analytics_audit() RETURNS trigger
        LANGUAGE plpgsql AS $function$
        BEGIN
          RAISE EXCEPTION 'forced late audit failure';
        END;
        $function$;
        CREATE TRIGGER reject_analytics_audit
        BEFORE INSERT ON etf.analytics_audit
        FOR EACH ROW EXECUTE FUNCTION etf.reject_analytics_audit();
      `);

      await assert.rejects(
        () => commitEvidence(client, evidencePayload()),
        /ANALYTICS_EVIDENCE_COMMIT_FAILED/,
      );
      const counts = await client.query(`
        SELECT (SELECT count(*)::integer FROM etf.analytics_input_sets) AS inputs,
               (SELECT count(*)::integer FROM etf.analytics_evidence_bundles) AS bundles,
               (SELECT count(*)::integer FROM etf.analytics_manifests) AS manifests,
               (SELECT count(*)::integer FROM etf.analytics_lifecycle_references) AS lifecycle,
               (SELECT count(*)::integer FROM etf.analytics_retention_bindings) AS retention,
               (SELECT count(*)::integer FROM etf.analytics_publications) AS publications,
               (SELECT count(*)::integer FROM etf.analytics_audit) AS audit,
               (SELECT count(*)::integer FROM etf.analytics_evidence_replays) AS replays
      `);
      assert.deepEqual(counts.rows[0], {
        inputs: 0,
        bundles: 0,
        manifests: 0,
        lifecycle: 0,
        retention: 0,
        publications: 0,
        audit: 0,
        replays: 0,
      });
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(unlockSql);
        await client.end();
      }
    }
  },
);
