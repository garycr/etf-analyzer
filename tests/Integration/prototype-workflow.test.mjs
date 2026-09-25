import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import test from "node:test";

import pg from "pg";

import { executeApplicationRequestAsync } from "../../dist/Application/application-boundary.js";
import { canonicalizeJson } from "../../dist/Infrastructure/CanonicalJson/canonical-json.js";
import { startLoopbackApiServer } from "../../dist/Infrastructure/Http/api-adapter.js";
import { evaluatePrototypeOperations } from "../../dist/Infrastructure/Operations/prototype-operations.js";
import { createPostgresApplicationReplayStore } from "../../dist/Infrastructure/PostgreSQL/application-replay-store.js";
import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import { applicationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import { analyticsEvidenceMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/analytics-evidence.js";
import { controlledAccessMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/controlled-access.js";
import { denialBackendVerifierMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/denial-backend-verifier.js";
import { domainLedgerMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import { fixtureMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
import { runtimeQueriesMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/runtime-queries.js";
import { dispatchPostgresPaperOrder } from "../../dist/Infrastructure/PostgreSQL/paper-order-owner.js";
import { projectPostgresSchemaManifest } from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";
import { createRoleBootstrapSql, productRoles } from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";
import { dispatchPostgresWorkflowOperation } from "../../dist/Infrastructure/PostgreSQL/workflow-owner.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const lockSql = "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const unlockSql = "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";

function hashJson(value) {
  return createHash("sha256").update(canonicalizeJson(value), "utf8").digest("hex");
}

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

async function applyCompleteMigrationSet(client) {
  await client.query(createRoleBootstrapSql());
  const migrations = [
    foundationMigration,
    applicationMigration,
    domainLedgerMigration,
    fixtureMigration,
    analyticsEvidenceMigration,
    controlledAccessMigration,
    denialBackendVerifierMigration,
    runtimeQueriesMigration,
  ];
  for (const [index, migration] of migrations.entries()) {
    await applyMigration(
      client,
      migration,
      `2026-09-24T00:0${index}:00.000Z`,
      projectPostgresSchemaManifest,
    );
  }
}

function fixtureArtifact() {
  const rawBytes = Buffer.from("approved local fixture source\n", "utf8");
  const rawSourceHash = createHash("sha256").update(rawBytes).digest("hex");
  const fixturePackageHash = "5c68a8c394aecb6e27833f4216bfcd5f5c724e3aff6cfad7980192ec8d1e0b68";
  return {
    fixturePackageHash,
    databasePayload: {
      datasetId: "etf-prototype-core",
      datasetVersion: "2026.01.0",
      datasetHash: fixturePackageHash,
      manifest: {
        contractVersion: "1.0.0-candidate.2",
        datasetHash: fixturePackageHash,
        datasetId: "etf-prototype-core",
        datasetVersion: "2026.01.0",
        economicCoverage: [{ observationDates: ["2025-12-01"], providerId: "FRED", seriesId: "CPI" }],
        files: [
          { byteLength: 489, mediaType: "application/x-ndjson", recordCount: 1, relativePath: "economic-vintages.jsonl", sha256: "6d274e625f2f3efbe6e2b6f3160531b8f3b96ab86e846f7167e17ecf3e5ceb13" },
          { byteLength: 543, mediaType: "application/x-ndjson", recordCount: 1, relativePath: "market-observations.jsonl", sha256: "bf5e14badd7df4312cc69f818ba8e9123dfe33d0e934223eef5308520aa45cab" },
          { byteLength: rawBytes.length, mediaType: "application/octet-stream", recordCount: 1, relativePath: `raw-sources/${rawSourceHash}`, sha256: rawSourceHash },
        ],
        fixturePolicyId: "fixture-policy-1",
        marketCoverage: [{ adjustmentPolicy: "split-adjusted", instrumentId: "ETF-1", requiredTradingDates: ["2026-01-30"] }],
        prototypeCandidate: "v1.0.0-prototype.1",
        schemaVersion: "1.0.0",
      },
      jobId: "81000000-0000-4000-8000-000000000001",
      descriptors: [
        { path: "economic-vintages.jsonl", mediaType: "application/x-ndjson", byteLength: 489, contentHash: "6d274e625f2f3efbe6e2b6f3160531b8f3b96ab86e846f7167e17ecf3e5ceb13", ordinal: 0 },
        { path: "market-observations.jsonl", mediaType: "application/x-ndjson", byteLength: 543, contentHash: "bf5e14badd7df4312cc69f818ba8e9123dfe33d0e934223eef5308520aa45cab", ordinal: 1 },
        { path: `raw-sources/${rawSourceHash}`, mediaType: "application/octet-stream", byteLength: rawBytes.length, contentHash: rawSourceHash, ordinal: 2 },
      ],
      rawSources: [{ rawSourceHash, contentBase64: rawBytes.toString("base64"), byteLength: rawBytes.length }],
      marketObservations: [{
        instrumentId: "ETF-1", tradingDate: "2026-01-30", providerId: "fixture",
        adjustmentPolicy: "split-adjusted", revision: "1", sourceAvailableAt: "2026-01-30T22:00:00.000Z",
        numericClass: "UnitPrice", value: "100.0000000000", currency: "USD",
        rawSourceRef: `raw-sources/${rawSourceHash}`, rawSourceHash,
        normalizationId: "fixture-normalization@1.0.0", ingestionJobId: "fixture-build-1",
        qualityState: "Valid", qualityCodes: [],
      }],
      economicObservations: [{
        providerId: "FRED", seriesId: "CPI", observationDate: "2025-12-01",
        releaseTimestamp: "2026-01-15T13:30:00.000Z", vintageId: "2026-01-15",
        numericClass: "Rate", value: "3.000000000000",
        rawSourceRef: `raw-sources/${rawSourceHash}`, rawSourceHash,
        normalizationId: "fixture-normalization@1.0.0", ingestionJobId: "fixture-build-1",
        qualityState: "Valid", qualityCodes: [],
      }],
    },
  };
}

function analyticsArtifact(fixtureEvidenceId) {
  const canonicalInput = {
    domain: "etf.analytics.input.v1",
    economicVintages: [{
      observationDate: "2025-12-01", providerId: "FRED",
      releaseTimestamp: "2026-01-15T13:30:00.000Z", seriesId: "CPI",
      value: "3.0000000000", vintageId: "2026-01-15",
    }],
    evaluationAt: "2026-01-31T00:00:00.000Z",
    inputSchemaVersion: "1.0.0",
    marketObservations: [{
      adjustmentPolicy: "split-adjusted", instrumentId: "ETF-1", providerId: "fixture",
      revision: "1", sourceAvailableAt: "2026-01-30T22:00:00.000Z",
      tradingDate: "2026-01-30", value: "100.0000000000",
    }],
    portfolioContextHash: "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
    transformationLineage: [],
  };
  const canonicalConfiguration = {
    assumptions: { costRate: "0.001000000000", fillTiming: "next-session-open", slippageRate: "0.000500000000" },
    baselineVersion: "v1.0.0",
    benchmark: { instrumentId: "BENCH-1", version: "1" },
    codeHash: "1".repeat(64),
    domain: "etf.analytics.configuration.v1",
    environment: { dependencyLockHash: "2".repeat(64), runtime: "node-20" },
    evaluationAt: canonicalInput.evaluationAt,
    inputHash: hashJson(canonicalInput),
    parameters: { lookbackSessions: "20" },
    providerPolicyReferences: ["fixture-policy-1"],
    ruleId: "p0-rule",
    ruleVersion: "1.0.0",
    seed: "42",
  };
  const configurationHash = hashJson(canonicalConfiguration);
  return {
    configurationHash,
    inputEvidenceIds: [fixtureEvidenceId],
    databasePayload: {
      evidenceId: "81000000-0000-4000-8000-000000000005",
      evidenceCommitCommandId: "81000000-0000-4000-8000-000000000004",
      publicationTargetId: "81000000-0000-4000-8000-000000000006",
      expectedPublicationVersion: 0,
      baselineVersion: "v1.0.0",
      retentionPolicyVersion: "RET-A-1.0",
      inputSetId: "input-prototype-workflow",
      inputSchemaVersion: "1.0.0",
      evaluationAt: canonicalInput.evaluationAt,
      canonicalInput,
      evidenceSchemaVersion: "1.0.0",
      canonicalConfiguration,
      canonicalResult: {
        configurationHash,
        domain: "etf.analytics.result.v1",
        metrics: [{ metricId: "totalReturn", numericClass: "Rate", value: "0.010000000000" }],
        resultSchemaVersion: "1.0.0",
        signals: [{ instrumentId: "ETF-1", label: "Neutral", score: "0.000000000000" }],
        trades: [],
        warnings: [],
      },
      reproducibilityStatus: "Complete",
      reproducibilityReason: null,
    },
  };
}

function send({ port, method, path, body, requestId, correlationId, requestedAt, commandId }) {
  const encoded = body === undefined ? "" : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      method,
      path,
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json", "content-length": Buffer.byteLength(encoded) }),
        host: `127.0.0.1:${port}`,
        "x-request-id": requestId,
        "x-correlation-id": correlationId,
        "x-requested-at": requestedAt,
        ...(commandId === undefined ? {} : { "idempotency-key": commandId }),
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      }));
    });
    request.on("error", reject);
    request.end(encoded);
  });
}

test(
  "PT-E2E-001 completes fixture analysis confirmed paper order and reconciliation through reviewed HTTP operations",
  { skip: !connectionString },
  async (context) => {
    const client = new pg.Client({ connectionString });
    const fixture = fixtureArtifact();
    const fixtureEvidenceId = "81000000-0000-4000-8000-000000000002";
    const analytics = analyticsArtifact(fixtureEvidenceId);
    const portfolioId = "81000000-0000-4000-8000-000000000010";
    const orderId = "81000000-0000-4000-8000-000000000020";
    let server;
    await client.connect();
    await client.query(lockSql);
    try {
      await cleanBootstrap(client);
      await applyCompleteMigrationSet(client);
      await client.query("GRANT USAGE ON SCHEMA etf TO key_injector");
      await client.query(
        "GRANT EXECUTE ON FUNCTION etf.anchor_key_inject(text,bytea,timestamp with time zone) TO key_injector",
      );
      await client.query("SET SESSION AUTHORIZATION key_injector");
      await client.query(
        "SELECT etf.anchor_key_inject('primary', decode('00112233445566778899aabbccddeeff', 'hex'), '2020-01-01T00:00:00.000Z')",
      );
      await client.query("RESET SESSION AUTHORIZATION");

      const ledgerCommand = {
        amount: "100.00000000",
        correlationId: "81000000-0000-4000-8000-000000000011",
        effectiveAt: "2026-09-24T09:00:00.000Z",
        expectedPortfolioVersion: 0,
        keyIdentifier: "primary",
        portfolioId,
        transactionId: "81000000-0000-4000-8000-000000000012",
        type: "CashDeposit",
      };
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      await client.query("SELECT etf.ledger_append($1::jsonb)", [{
        canonicalContent: canonicalizeJson(ledgerCommand),
        ...ledgerCommand,
      }]);
      await client.query("RESET SESSION AUTHORIZATION");
      const commitment = (await client.query(
        "SELECT commitment_hash FROM etf.ledger_commitments WHERE portfolio_id = $1::uuid AND ledger_sequence = 1",
        [portfolioId],
      )).rows[0].commitment_hash;
      const expectedPortfolio = {
        allocations: [], asOf: "2026-09-24T09:01:00.000Z", baselineVersion: "v1.0.0",
        cash: "100.00000000", keyIdentifier: "primary", lots: [], portfolioId,
        portfolioVersion: 1, precisionPolicyVersion: "DEC-014", positions: [],
        realizedPnL: "0.00000000", reconciliationState: "Reconciled",
        sourceCommitmentHash: commitment, totalEquity: "100.00000000",
        valuationSnapshotId: "81000000-0000-4000-8000-000000000013",
      };
      await client.query("SET SESSION AUTHORIZATION projection_runtime");
      await client.query("SELECT etf.projection_publish($1::jsonb)", [expectedPortfolio]);
      await client.query("RESET SESSION AUTHORIZATION");
      const beforeSubmission = (await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.ledger_transactions WHERE portfolio_id = $1::uuid) AS transactions,
                (SELECT count(*)::integer FROM etf.portfolio_projections WHERE portfolio_id = $1::uuid) AS projections`,
        [portfolioId],
      )).rows[0];

      const resolver = {
        resolveFixture: () => fixture,
        resolveAnalytics: () => analytics,
      };
      let completionIndex = 0;
      const completionTimes = [
        "2026-09-24T10:00:01.000Z",
        "2026-09-24T10:01:01.000Z",
        "2026-09-24T10:02:01.000Z",
        "2026-09-24T10:03:01.000Z",
      ];
      let ownerDatabaseError;
      const ownerClient = {
        query: async (sql, values) => {
          try {
            return await client.query(sql, values);
          } catch (error) {
            ownerDatabaseError = error;
            throw error;
          }
        },
      };
      await client.query("SET SESSION AUTHORIZATION app_runtime");
      await client.query("SELECT etf.readiness_append($1::jsonb)", [JSON.stringify({
        readinessId: "81000000-0000-4000-8000-000000000014",
        state: "Ready",
        checkedAt: "2026-09-24T09:59:00.000Z",
        displayTimezone: "UTC",
        liveness: "Live",
        dependencies: [
          "PostgreSQL", "Migrations", "FixturePolicy", "LocalDependency", "DenialAudit", "LedgerIntegrity",
        ].map((dependency) => ({
          dependency,
          state: "Ready",
          checkedAt: "2026-09-24T09:59:00.000Z",
          code: null,
        })),
        controllingError: null,
      })]);
      server = await startLoopbackApiServer(
        { allowedOrigins: ["http://127.0.0.1:5173"], bodyLimitBytes: 1_048_576, port: 0 },
        (requestJson) => executeApplicationRequestAsync(requestJson, {
          replayStore: createPostgresApplicationReplayStore(client),
          completedAt: () => completionTimes[completionIndex++] ?? "2026-09-24T10:04:01.000Z",
          checkReadiness: () => undefined,
          ownerDispatch: (definition, payload, commandContext) => {
            if (definition.operation === "PaperOrderDraftCreate" || definition.operation === "PaperOrderTransition") {
              return dispatchPostgresPaperOrder(ownerClient, definition, payload, commandContext);
            }
            return dispatchPostgresWorkflowOperation(
              ownerClient,
              resolver,
              () => completionTimes[completionIndex++] ?? "2026-09-24T10:04:01.000Z",
              definition,
              payload,
              commandContext,
            );
          },
        }),
      );
      const address = server.address();
      assert.notEqual(address, null);
      assert.equal(typeof address, "object");
      const port = address.port;
      const invoke = (operation) => send({ port, ...operation });

      const fixtureResponse = await invoke({
        method: "POST", path: "/api/v1/fixture-ingestions",
        requestId: "81000000-0000-4000-8000-000000000101",
        correlationId: "81000000-0000-4000-8000-000000000102",
        requestedAt: "2026-09-24T10:00:00.000Z",
        commandId: "81000000-0000-4000-8000-000000000103",
        body: {
          jobId: fixture.databasePayload.jobId,
          datasetId: fixture.databasePayload.datasetId,
          datasetVersion: fixture.databasePayload.datasetVersion,
          fixturePackageHash: fixture.fixturePackageHash,
        },
      });
      assert.equal(
        fixtureResponse.status,
        201,
        `${JSON.stringify(fixtureResponse.body)} database=${ownerDatabaseError?.code}:${ownerDatabaseError?.message}`,
      );
      assert.equal(fixtureResponse.body.data.job.acceptedCount, "2");

      const analyticsResponse = await invoke({
        method: "POST", path: "/api/v1/analytics/runs",
        requestId: "81000000-0000-4000-8000-000000000104",
        correlationId: "81000000-0000-4000-8000-000000000105",
        requestedAt: "2026-09-24T10:01:00.000Z",
        commandId: "81000000-0000-4000-8000-000000000106",
        body: {
          jobId: "81000000-0000-4000-8000-000000000003",
          evidenceCommandId: analytics.databasePayload.evidenceCommitCommandId,
          asOfDate: "2026-01-31",
          configurationHash: analytics.configurationHash,
          inputEvidenceIds: [fixtureEvidenceId],
        },
      });
      assert.equal(analyticsResponse.status, 201, JSON.stringify(analyticsResponse.body));
      assert.equal(analyticsResponse.body.data.job.acceptedCount, "1");

      const draftResponse = await invoke({
        method: "POST", path: "/api/v1/paper-orders",
        requestId: "81000000-0000-4000-8000-000000000107",
        correlationId: "81000000-0000-4000-8000-000000000108",
        requestedAt: "2026-09-24T10:02:00.000Z",
        commandId: "81000000-0000-4000-8000-000000000109",
        body: {
          orderId, instrumentId: "ETF-1",
          researchEvidenceId: analytics.databasePayload.evidenceId,
          side: "Buy", quantity: "1.0000000000", unitPrice: "100.0000000000",
          tradeDate: "2026-09-24",
        },
      });
      assert.equal(draftResponse.status, 201, JSON.stringify(draftResponse.body));
      assert.equal(draftResponse.body.data.order.state, "Draft");

      const transitionResponse = await invoke({
        method: "POST", path: `/api/v1/paper-orders/${orderId}/transitions`,
        requestId: "81000000-0000-4000-8000-000000000110",
        correlationId: "81000000-0000-4000-8000-000000000111",
        requestedAt: "2026-09-24T10:03:00.000Z",
        commandId: "81000000-0000-4000-8000-000000000112",
        body: {
          transitionCommandId: "81000000-0000-4000-8000-000000000113",
          expectedVersion: "1",
          transition: "OT-02",
          transitionPayload: {
            confirmation: {
              actorId: "local-user",
              confirmationText: "Submit paper order",
              confirmedAt: "2026-09-24T10:03:00.000Z",
            },
          },
        },
      });
      assert.equal(transitionResponse.status, 200, JSON.stringify(transitionResponse.body));
      assert.equal(transitionResponse.body.data.order.state, "Submitted");

      const runtimeQueries = [
        ["/api/v1/readiness", (data) => assert.equal(data.readiness.state, "Ready")],
        ["/api/v1/watchlist", (data) => assert.deepEqual(data.orderedItems, [])],
        [`/api/v1/jobs/${analytics.databasePayload.jobId}`, (data) => assert.equal(data.job.status, "Succeeded")],
        [`/api/v1/analytics/results/${analytics.databasePayload.publicationTargetId}`, (data) => assert.equal(data.result.domain, "etf.analytics.result.v1")],
        [`/api/v1/evidence?evidenceId=${analytics.databasePayload.evidenceId}`, (data) => assert.equal(data.evidence.evidenceId, analytics.databasePayload.evidenceId)],
        [`/api/v1/paper-orders/${orderId}`, (data) => assert.equal(data.order.state, "Submitted")],
      ];
      for (const [index, [path, assertData]] of runtimeQueries.entries()) {
        const queryResponse = await invoke({
          method: "GET",
          path,
          requestId: `81000000-0000-4000-8005-${String(index + 1).padStart(12, "0")}`,
          correlationId: `81000000-0000-4000-8006-${String(index + 1).padStart(12, "0")}`,
          requestedAt: "2026-09-24T10:04:00.000Z",
        });
        assert.equal(queryResponse.status, 200, `${path}: ${JSON.stringify(queryResponse.body)}`);
        assertData(queryResponse.body.data);
      }

      const portfolioResponse = await invoke({
        method: "GET",
        path: `/api/v1/portfolios/${portfolioId}?asOf=${encodeURIComponent(expectedPortfolio.asOf)}`,
        requestId: "81000000-0000-4000-8000-000000000114",
        correlationId: "81000000-0000-4000-8000-000000000115",
        requestedAt: "2026-09-24T10:04:00.000Z",
      });
      assert.equal(portfolioResponse.status, 200, JSON.stringify(portfolioResponse.body));
      assert.deepEqual(portfolioResponse.body.data.portfolio, {
        asOf: expectedPortfolio.asOf,
        baselineVersion: expectedPortfolio.baselineVersion,
        cash: expectedPortfolio.cash,
        lots: expectedPortfolio.lots,
        portfolioId,
        portfolioVersion: "1",
        positions: expectedPortfolio.positions,
        precisionPolicyVersion: expectedPortfolio.precisionPolicyVersion,
        realizedPnL: expectedPortfolio.realizedPnL,
        reconciliationState: "Reconciled",
        totalEquity: expectedPortfolio.totalEquity,
        valuationSnapshotId: expectedPortfolio.valuationSnapshotId,
      });

      await client.query("RESET SESSION AUTHORIZATION");
      const persisted = await client.query(
        `SELECT package.dataset_hash,
                evidence.evidence_id::text,
                input_set.canonical_content,
                paper_order.research_evidence_id::text,
                paper_order.state,
                (SELECT count(*)::integer FROM etf.ledger_transactions WHERE portfolio_id = $1::uuid) AS transactions,
                (SELECT count(*)::integer FROM etf.portfolio_projections WHERE portfolio_id = $1::uuid) AS projections
           FROM etf.fixture_packages AS package
           CROSS JOIN etf.analytics_evidence_bundles AS evidence
           JOIN etf.analytics_input_sets AS input_set
             ON input_set.input_set_id = evidence.input_set_id
           JOIN etf.paper_orders AS paper_order ON paper_order.order_id = $2::uuid
          WHERE package.dataset_id = $3 AND package.dataset_version = $4`,
        [portfolioId, orderId, fixture.databasePayload.datasetId, fixture.databasePayload.datasetVersion],
      );
      assert.equal(persisted.rowCount, 1);
      assert.equal(persisted.rows[0].dataset_hash, fixture.fixturePackageHash);
      assert.equal(persisted.rows[0].evidence_id, analytics.databasePayload.evidenceId);
      assert.deepEqual(persisted.rows[0].canonical_content.marketObservations, analytics.databasePayload.canonicalInput.marketObservations);
      assert.deepEqual(persisted.rows[0].canonical_content.economicVintages, analytics.databasePayload.canonicalInput.economicVintages);
      assert.equal(persisted.rows[0].research_evidence_id, analytics.databasePayload.evidenceId);
      assert.equal(persisted.rows[0].state, "Submitted");
      assert.deepEqual(
        { transactions: persisted.rows[0].transactions, projections: persisted.rows[0].projections },
        beforeSubmission,
      );

      const operations = (await client.query(
        `SELECT (SELECT count(*)::integer FROM etf.application_replays) AS application_replays,
                (SELECT count(*)::integer FROM etf.analytics_publications) AS analytics_publications,
                (SELECT count(*)::integer FROM etf.fixture_packages) AS fixture_packages,
                (SELECT count(*)::integer FROM etf.jobs) AS jobs,
                (SELECT count(*)::integer FROM etf.order_transitions) AS order_transitions,
                (SELECT count(*)::integer FROM etf.paper_orders) AS paper_orders,
                (SELECT count(*)::integer
                   FROM etf.analytics_publications AS publication
                   JOIN etf.analytics_evidence_bundles AS bundle ON bundle.evidence_id = publication.evidence_id
                  WHERE publication.bundle_hash <> bundle.bundle_hash) AS hash_mismatches,
                (SELECT count(*)::integer
                   FROM etf.portfolio_projections
                  WHERE reconciliation_state <> 'Reconciled') AS reconciliation_differences,
                ((SELECT count(*) FROM etf.order_audit WHERE outcome = 'IntentRecorded') +
                 (SELECT count(*) FROM etf.ledger_audit WHERE outcome = 'IntentRecorded'))::integer AS unresolved_intents`,
      )).rows[0];
      const workflowCounts = {
        applicationReplays: operations.application_replays,
        analyticsPublications: operations.analytics_publications,
        fixturePackages: operations.fixture_packages,
        jobs: operations.jobs,
        orderTransitions: operations.order_transitions,
        paperOrders: operations.paper_orders,
      };
      const workflowEvidence = evaluatePrototypeOperations({
        apiDurationsMs: [0],
        cpuPercent: 0,
        dashboardDurationsMs: [0],
        databaseConnections: 0,
        databaseMaxConnections: 1,
        evidenceCapacityBytes: 1,
        evidenceManagedBytes: 0,
        expectedWorkflowCounts: {
          applicationReplays: 4,
          analyticsPublications: 1,
          fixturePackages: 1,
          jobs: 2,
          orderTransitions: 2,
          paperOrders: 1,
        },
        hashMismatchCount: operations.hash_mismatches,
        memoryBytes: 0,
        queueOrOutboxObjectCount: 0,
        reconciliationDifferenceCount: operations.reconciliation_differences,
        unexpectedServerErrorCount: 0,
        unresolvedIntentCount: operations.unresolved_intents,
        workflowCounts,
      });
      assert.equal(workflowEvidence.status, "Pass", JSON.stringify(workflowEvidence));

      for (const [index, failurePoint] of [
        "after-job-start",
        "after-domain-mutation",
        "after-job-completion",
      ].entries()) {
        const suffix = index + 30;
        const datasetId = `etf-prototype-failure-${suffix}`;
        const datasetVersion = `2026.01.${suffix}`;
        const jobId = `81000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
        const commandId = `81000000-0000-4000-8001-${String(suffix).padStart(12, "0")}`;
        const failureArtifact = {
          ...fixture,
          databasePayload: {
            ...fixture.databasePayload,
            datasetId,
            datasetVersion,
            jobId,
            manifest: {
              ...fixture.databasePayload.manifest,
              datasetId,
              datasetVersion,
            },
          },
        };
        let ownerCalls = 0;
        const failingClient = {
          query: async (sql, values) => {
            if (sql.includes("job_start") || sql.includes("fixture_ingest") || sql.includes("job_succeed")) {
              ownerCalls += 1;
            }
            if (failurePoint === "after-job-start" && sql.includes("fixture_ingest")) {
              throw new Error(failurePoint);
            }
            const result = await client.query(sql, values);
            if (
              failurePoint === "after-domain-mutation" && sql.includes("fixture_ingest") ||
              failurePoint === "after-job-completion" && sql.includes("job_succeed")
            ) throw new Error(failurePoint);
            return result;
          },
        };
        const request = JSON.stringify({
          operation: "FixtureIngestionStart",
          requestId: `81000000-0000-4000-8002-${String(suffix).padStart(12, "0")}`,
          correlationId: `81000000-0000-4000-8003-${String(suffix).padStart(12, "0")}`,
          actorId: "local-user",
          prototypeCandidate: "v1.0.0-prototype.1",
          contractVersion: "1.0.0-candidate.2",
          requestedAt: `2026-09-24T11:0${index}:00.000Z`,
          commandId,
          payload: { jobId, datasetId, datasetVersion, fixturePackageHash: fixture.fixturePackageHash },
        });
        const executeFailure = () => executeApplicationRequestAsync(request, {
          replayStore: createPostgresApplicationReplayStore(failingClient),
          completedAt: () => `2026-09-24T11:0${index}:01.000Z`,
          checkReadiness: () => undefined,
          ownerDispatch: (definition, payload, commandContext) => dispatchPostgresWorkflowOperation(
            failingClient,
            { resolveFixture: () => failureArtifact, resolveAnalytics: () => undefined },
            () => `2026-09-24T11:0${index}:01.000Z`,
            definition,
            payload,
            commandContext,
          ),
        });
        await client.query("SET SESSION AUTHORIZATION app_runtime");
        const failed = await executeFailure();
        assert.equal(failed.outcome, "Failed");
        assert.equal(failed.error.code, "APPLICATION_DEPENDENCY_UNAVAILABLE");
        const callsAfterFailure = ownerCalls;
        assert.deepEqual(await executeFailure(), failed);
        assert.equal(ownerCalls, callsAfterFailure, `${failurePoint} replay must not redispatch owner SQL`);
        const conflictingRequest = JSON.stringify({
          ...JSON.parse(request),
          payload: { ...JSON.parse(request).payload, datasetVersion: `${datasetVersion}-conflict` },
        });
        const conflict = await executeApplicationRequestAsync(conflictingRequest, {
          replayStore: createPostgresApplicationReplayStore(failingClient),
          completedAt: () => `2026-09-24T11:0${index}:02.000Z`,
          checkReadiness: () => undefined,
          ownerDispatch: (definition, payload, commandContext) => dispatchPostgresWorkflowOperation(
            failingClient,
            { resolveFixture: () => failureArtifact, resolveAnalytics: () => undefined },
            () => `2026-09-24T11:0${index}:02.000Z`,
            definition,
            payload,
            commandContext,
          ),
        });
        assert.equal(conflict.outcome, "Failed");
        assert.equal(conflict.error.code, "APPLICATION_IDEMPOTENCY_CONFLICT");
        assert.equal(ownerCalls, callsAfterFailure, `${failurePoint} conflict must not redispatch owner SQL`);
        await client.query("RESET SESSION AUTHORIZATION");
        const rollback = (await client.query(
          `SELECT (SELECT count(*)::integer FROM etf.jobs WHERE job_id = $1::uuid) AS jobs,
                  (SELECT count(*)::integer FROM etf.fixture_packages WHERE dataset_id = $2 AND dataset_version = $3) AS packages,
                  (SELECT count(*)::integer FROM etf.application_replays WHERE operation = 'FixtureIngestionStart' AND command_id = $4::uuid) AS replays`,
          [jobId, datasetId, datasetVersion, commandId],
        )).rows[0];
        assert.deepEqual(rollback, { jobs: 0, packages: 0, replays: 1 }, failurePoint);
      }
    } finally {
      if (server !== undefined) {
        await new Promise((resolve) => server.close(() => resolve()));
        server = undefined;
      }
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(unlockSql).catch(() => undefined);
        await client.end();
      }
    }
  },
);
