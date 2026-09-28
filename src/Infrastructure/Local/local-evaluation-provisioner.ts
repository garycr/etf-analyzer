import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import pg from "pg";

import { validateFixturePackage } from "../../Application/fixture-package.js";
import { evaluateReadiness, type ReadinessChecks } from "../../Application/application-boundary.js";
import { canonicalizeJson } from "../CanonicalJson/canonical-json.js";
import { applyMigration, type MigrationClient } from "../PostgreSQL/migration-runner.js";
import { analyticsEvidenceMigration } from "../PostgreSQL/migrations/analytics-evidence.js";
import { applicationMigration } from "../PostgreSQL/migrations/application.js";
import { controlledAccessMigration } from "../PostgreSQL/migrations/controlled-access.js";
import { denialBackendVerifierMigration } from "../PostgreSQL/migrations/denial-backend-verifier.js";
import { domainLedgerMigration } from "../PostgreSQL/migrations/domain-ledger.js";
import { fixtureMigration } from "../PostgreSQL/migrations/fixtures.js";
import { foundationMigration } from "../PostgreSQL/migrations/foundation.js";
import { runtimeQueriesMigration } from "../PostgreSQL/migrations/runtime-queries.js";
import { projectPostgresSchemaManifest } from "../PostgreSQL/postgres-schema-manifest.js";
import {
  checkPostgresBaseline,
  checkPostgresMigrationState,
  checkPostgresSchemaManifest,
  composePostgresReadinessChecks,
} from "../PostgreSQL/readiness.js";
import { createRoleBootstrapSql } from "../PostgreSQL/role-bootstrap.js";

const rawSource = Buffer.from("approved local fixture source\n", "utf8");
const market = Buffer.from(
  '{"adjustmentPolicy":"split-adjusted","currency":"USD","ingestionJobId":"fixture-build-1","instrumentId":"ETF-1","normalizationId":"fixture-normalization@1.0.0","numericClass":"UnitPrice","providerId":"fixture","qualityCodes":[],"qualityState":"Valid","rawSourceHash":"70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","rawSourceRef":"raw-sources/70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","revision":"1","sourceAvailableAt":"2026-01-30T22:00:00.000Z","tradingDate":"2026-01-30","value":"100.0000000000"}\n',
  "utf8",
);
const economic = Buffer.from(
  '{"ingestionJobId":"fixture-build-1","normalizationId":"fixture-normalization@1.0.0","numericClass":"Rate","observationDate":"2025-12-01","providerId":"FRED","qualityCodes":[],"qualityState":"Valid","rawSourceHash":"70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","rawSourceRef":"raw-sources/70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","releaseTimestamp":"2026-01-15T13:30:00.000Z","seriesId":"CPI","value":"3.000000000000","vintageId":"2026-01-15"}\n',
  "utf8",
);
const manifest = Buffer.from(
  '{"contractVersion":"1.0.0-candidate.2","datasetHash":"5c68a8c394aecb6e27833f4216bfcd5f5c724e3aff6cfad7980192ec8d1e0b68","datasetId":"etf-prototype-core","datasetVersion":"2026.01.0","economicCoverage":[{"observationDates":["2025-12-01"],"providerId":"FRED","seriesId":"CPI"}],"files":[{"byteLength":489,"mediaType":"application/x-ndjson","recordCount":1,"relativePath":"economic-vintages.jsonl","sha256":"6d274e625f2f3efbe6e2b6f3160531b8f3b96ab86e846f7167e17ecf3e5ceb13"},{"byteLength":543,"mediaType":"application/x-ndjson","recordCount":1,"relativePath":"market-observations.jsonl","sha256":"bf5e14badd7df4312cc69f818ba8e9123dfe33d0e934223eef5308520aa45cab"},{"byteLength":30,"mediaType":"application/octet-stream","recordCount":1,"relativePath":"raw-sources/70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","sha256":"70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df"}],"fixturePolicyId":"fixture-policy-1","marketCoverage":[{"adjustmentPolicy":"split-adjusted","instrumentId":"ETF-1","requiredTradingDates":["2026-01-30"]}],"prototypeCandidate":"v1.0.0-prototype.1","schemaVersion":"1.0.0"}',
  "utf8",
);

const rawSourceHash = createHash("sha256").update(rawSource).digest("hex");
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

function hashJson(value: unknown): string {
  return createHash("sha256").update(canonicalizeJson(value), "utf8").digest("hex");
}

function createAnalyticsArtifact() {
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
    inputEvidenceIds: ["81000000-0000-4000-8000-000000000002"],
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

export async function writeLocalEvaluationArtifacts(root: string) {
  const fixtureDirectory = path.join(root, "fixture");
  const rawDirectory = path.join(fixtureDirectory, "raw-sources");
  await mkdir(rawDirectory, { recursive: true });
  validateFixturePackage({
    manifest,
    files: {
      "economic-vintages.jsonl": economic,
      "market-observations.jsonl": market,
      [`raw-sources/${rawSourceHash}`]: rawSource,
    },
  });
  const analytics = createAnalyticsArtifact();
  await Promise.all([
    writeFile(path.join(fixtureDirectory, "manifest.json"), manifest),
    writeFile(path.join(fixtureDirectory, "economic-vintages.jsonl"), economic),
    writeFile(path.join(fixtureDirectory, "market-observations.jsonl"), market),
    writeFile(path.join(rawDirectory, rawSourceHash), rawSource),
    writeFile(path.join(root, "analytics.json"), `${canonicalizeJson(analytics)}\n`, "utf8"),
  ]);
  return Object.freeze({
    configurationHash: analytics.configurationHash,
    datasetId: "etf-prototype-core",
    datasetVersion: "2026.01.0",
    rawSourceHash,
  });
}

interface ProvisionClient extends MigrationClient {
  connect(): Promise<void>;
  end(): Promise<void>;
}

export interface LocalEvaluationProvisioningOptions {
  readonly adminConnectionString: string;
  readonly appliedAt: string;
  readonly artifactRoot: string;
  readonly createClient?: (connectionString: string) => ProvisionClient;
  readonly composeReadiness?: typeof composePostgresReadinessChecks;
  readonly createAnchorKey?: () => Buffer;
}

async function verifyLocalEvaluationArtifacts(root: string): Promise<void> {
  const fixtureDirectory = path.join(root, "fixture");
  const [storedManifest, storedEconomic, storedMarket, storedRawSource, storedAnalytics] = await Promise.all([
    readFile(path.join(fixtureDirectory, "manifest.json")),
    readFile(path.join(fixtureDirectory, "economic-vintages.jsonl")),
    readFile(path.join(fixtureDirectory, "market-observations.jsonl")),
    readFile(path.join(fixtureDirectory, "raw-sources", rawSourceHash)),
    readFile(path.join(root, "analytics.json"), "utf8"),
  ]);
  validateFixturePackage({
    manifest: storedManifest,
    files: {
      "economic-vintages.jsonl": storedEconomic,
      "market-observations.jsonl": storedMarket,
      [`raw-sources/${rawSourceHash}`]: storedRawSource,
    },
  });
  if (canonicalizeJson(JSON.parse(storedAnalytics)) !== canonicalizeJson(createAnalyticsArtifact())) {
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
}

function validateProvisioningInputs(options: LocalEvaluationProvisioningOptions): Date {
  let connectionUrl: URL;
  try {
    connectionUrl = new URL(options.adminConnectionString);
  } catch {
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
  if (
    !["postgres:", "postgresql:"].includes(connectionUrl.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(connectionUrl.hostname) ||
    connectionUrl.pathname !== "/etf_analyzer"
  ) {
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
  const baseTime = new Date(options.appliedAt);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(options.appliedAt) ||
    Number.isNaN(baseTime.getTime()) ||
    baseTime.toISOString() !== options.appliedAt
  ) {
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
  return baseTime;
}

interface PrepareLocalEvaluationDependencies {
  readonly provision: typeof provisionLocalEvaluation;
  readonly writeArtifacts: typeof writeLocalEvaluationArtifacts;
}

export async function prepareLocalEvaluation(
  outputRoot: string,
  adminConnectionString: string | undefined,
  appliedAt: string,
  dependencies: PrepareLocalEvaluationDependencies = {
    provision: provisionLocalEvaluation,
    writeArtifacts: writeLocalEvaluationArtifacts,
  },
) {
  if (outputRoot.length === 0 || adminConnectionString === undefined || adminConnectionString.length === 0) {
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
  const canonicalRoot = path.resolve(outputRoot);
  const artifactRoot = path.join(canonicalRoot, "reviewed-artifacts");
  const artifacts = await dependencies.writeArtifacts(artifactRoot);
  await dependencies.provision({ adminConnectionString, appliedAt, artifactRoot });
  const configPath = path.join(canonicalRoot, "local-runtime.json");
  await mkdir(canonicalRoot, { recursive: true });
  await writeFile(configPath, `${JSON.stringify({
    allowedOrigins: ["http://127.0.0.1:43123"],
    analyticsArtifactPath: "analytics.json",
    artifactRoot: path.join(canonicalRoot, "reviewed-artifacts"),
    bodyLimitBytes: 1_048_576,
    fixtureEvaluationAt: "2026-01-31T00:00:00.000Z",
    fixturePackageDirectory: "fixture",
    maxConcurrentRequests: 8,
    port: 43123,
    requestRateLimit: 120,
    requestRateWindowMs: 60_000,
    requestTimeoutMs: 5_000,
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return Object.freeze({ ...artifacts, configPath, outputRoot: canonicalRoot });
}

export async function provisionLocalEvaluation(options: LocalEvaluationProvisioningOptions): Promise<void> {
  const baseTime = validateProvisioningInputs(options);
  await verifyLocalEvaluationArtifacts(options.artifactRoot).catch((cause: unknown) => {
    throw new Error("APPLICATION_CONFIGURATION_INVALID", { cause });
  });
  const client = (options.createClient ?? ((connectionString) => new pg.Client({ connectionString })))(
    options.adminConnectionString,
  );
  await client.connect();
  try {
    const environment = await client.query(
      `SELECT current_setting('server_version') || '|' ||
              current_setting('server_encoding') || '|' ||
              current_setting('TimeZone') || '|' ||
              current_setting('standard_conforming_strings') || '|' ||
              datcollate AS environment
         FROM pg_catalog.pg_database
        WHERE datname = current_database()`,
    );
    if (environment.rows[0]?.environment !== "16.15|UTF8|UTC|on|C") {
      throw new Error("APPLICATION_DATABASE_UNAVAILABLE");
    }
    await client.query(createRoleBootstrapSql());
    for (const [index, migration] of migrations.entries()) {
      await applyMigration(
        client,
        migration,
        new Date(baseTime.getTime() + index * 60_000).toISOString(),
        projectPostgresSchemaManifest,
      );
      if (migration.sequence === 3) {
        await client.query(
          "GRANT EXECUTE ON FUNCTION etf.anchor_key_inject(text,bytea,timestamp with time zone) TO key_injector",
        );
        await client.query("SET SESSION AUTHORIZATION key_injector");
        try {
          await client.query(
            "SELECT etf.anchor_key_inject('primary', $1::bytea, $2::timestamp with time zone)",
            [(options.createAnchorKey ?? (() => randomBytes(32)))(), options.appliedAt],
          );
        } finally {
          await client.query("RESET SESSION AUTHORIZATION");
        }
      }
    }
    for (const result of [
      await checkPostgresBaseline(client),
      await checkPostgresMigrationState(client),
      await checkPostgresSchemaManifest(client),
    ]) {
      if (!result.ready) throw new Error(result.errorCode);
    }
    const createRuntimeClient = (role: "audit_runtime" | "projection_runtime") => async () => {
      const runtimeUrl = new URL(options.adminConnectionString);
      runtimeUrl.username = role;
      runtimeUrl.password = "";
      const runtimeClient = new pg.Client({ connectionString: runtimeUrl.toString() });
      await runtimeClient.connect();
      return {
        query: runtimeClient.query.bind(runtimeClient),
        close: () => runtimeClient.end(),
      };
    };
    const composed = await (options.composeReadiness ?? composePostgresReadinessChecks)({
      checkedAt: options.appliedAt,
      controlClient: client,
      createAuditClient: createRuntimeClient("audit_runtime"),
      createProjectionClient: createRuntimeClient("projection_runtime"),
    });
    const checks: ReadinessChecks = {
      ...composed,
      FixturePolicy: { ready: true, checkedAt: options.appliedAt },
      LocalDependency: { ready: true, checkedAt: options.appliedAt },
    };
    const readiness = evaluateReadiness({
      checkedAt: options.appliedAt,
      dependencies: checks,
      liveness: "Live",
    });
    if (readiness.controllingError !== null) throw new Error(readiness.controllingError.code);
    await client.query("SELECT etf.readiness_append($1::jsonb)", [{
      readinessId: "81000000-0000-4000-8000-000000000014",
      ...readiness,
    }]);
  } finally {
    await client.end();
  }
}
