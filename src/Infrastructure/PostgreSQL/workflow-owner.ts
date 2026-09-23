import type {
  ApplicationOperationDefinition,
  ApplicationOwnerCommandContext,
} from "../../Application/application-boundary.js";
import { createHash } from "node:crypto";
import { canonicalizeJson } from "../CanonicalJson/canonical-json.js";

interface QueryResult {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

export interface WorkflowQueryClient {
  query(sql: string, values: readonly unknown[]): Promise<QueryResult>;
}

export interface ApprovedFixtureArtifact {
  readonly fixturePackageHash: string;
  readonly databasePayload: Readonly<Record<string, unknown>>;
}

export interface ApprovedAnalyticsArtifact {
  readonly configurationHash: string;
  readonly inputEvidenceIds: readonly string[];
  readonly databasePayload: Readonly<Record<string, unknown>>;
}

export interface WorkflowArtifactResolver {
  resolveFixture(
    payload: Readonly<Record<string, unknown>>,
  ): ApprovedFixtureArtifact | undefined;
  resolveAnalytics(
    payload: Readonly<Record<string, unknown>>,
  ): ApprovedAnalyticsArtifact | undefined;
}

function ownerError(code: string): never {
  throw Object.assign(new Error(code), { code });
}

function invalidOwnerRequest(): never {
  return ownerError("APPLICATION_REQUEST_INVALID");
}

function property(record: Readonly<Record<string, unknown>>, name: string): unknown {
  return Object.getOwnPropertyDescriptor(record, name)?.value;
}

function sameStrings(left: unknown, right: readonly string[]): boolean {
  return Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(canonicalizeJson(value), "utf8")
    .digest("hex");
}

const postgresErrors: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  "22023": Object.freeze({
    APPLICATION_REQUEST_INVALID: "APPLICATION_REQUEST_INVALID",
    ANALYTICS_INPUT_INCOMPLETE: "ANALYTICS_INPUT_INCOMPLETE",
    ANALYTICS_INTEGRITY_FAILED: "ANALYTICS_INTEGRITY_FAILED",
    ANALYTICS_NUMERIC_CLASS_INVALID: "ANALYTICS_NUMERIC_CLASS_INVALID",
  }),
  "23505": Object.freeze({
    APPLICATION_IDEMPOTENCY_CONFLICT: "APPLICATION_IDEMPOTENCY_CONFLICT",
    FIXTURE_IDEMPOTENCY_CONFLICT: "FIXTURE_IDEMPOTENCY_CONFLICT",
    ANALYTICS_IDEMPOTENCY_CONFLICT: "ANALYTICS_IDEMPOTENCY_CONFLICT",
  }),
  "40001": Object.freeze({
    ANALYTICS_PUBLICATION_VERSION_CONFLICT: "ANALYTICS_PUBLICATION_VERSION_CONFLICT",
  }),
  "42501": Object.freeze({
    "permission denied": "APPLICATION_UNAUTHORIZED",
    ANALYTICS_RIGHTS_RESTRICTED: "ANALYTICS_RIGHTS_RESTRICTED",
  }),
  "53100": Object.freeze({
    ANALYTICS_CAPACITY_BLOCKED: "ANALYTICS_CAPACITY_BLOCKED",
  }),
  P0001: Object.freeze({
    APPLICATION_JOB_MISMATCH: "APPLICATION_REQUEST_INVALID",
    APPLICATION_JOB_NOT_COMPLETABLE: "APPLICATION_REQUEST_INVALID",
    ANALYTICS_EVIDENCE_COMMIT_FAILED: "ANALYTICS_EVIDENCE_COMMIT_FAILED",
  }),
  P0002: Object.freeze({
    APPLICATION_JOB_NOT_FOUND: "APPLICATION_JOB_NOT_FOUND",
  }),
});

function mapPostgresError(error: unknown): never {
  if (error !== null && typeof error === "object") {
    const sqlState = Object.getOwnPropertyDescriptor(error, "code")?.value;
    const message = Object.getOwnPropertyDescriptor(error, "message")?.value;
    if (typeof sqlState === "string" && typeof message === "string") {
      const code = postgresErrors[sqlState]?.[message];
      if (code !== undefined) return ownerError(code);
    }
  }
  return ownerError("APPLICATION_DEPENDENCY_UNAVAILABLE");
}

function requireSingleResult(result: QueryResult, column: string): unknown {
  if (result.rows.length !== 1 || !(column in result.rows[0]!)) {
    return ownerError("APPLICATION_RESULT_INVALID");
  }
  return result.rows[0]![column];
}

function jobStartPayload(
  operation: "FixtureIngestionStart" | "AnalyticsRun",
  payload: Readonly<Record<string, unknown>>,
  context: Readonly<ApplicationOwnerCommandContext>,
): Readonly<Record<string, unknown>> {
  const inputIdentity = operation === "FixtureIngestionStart"
    ? {
      datasetId: property(payload, "datasetId"),
      datasetVersion: property(payload, "datasetVersion"),
      fixturePackageHash: property(payload, "fixturePackageHash"),
    }
    : {
      evidenceCommandId: property(payload, "evidenceCommandId"),
      asOfDate: property(payload, "asOfDate"),
      configurationHash: property(payload, "configurationHash"),
      inputEvidenceIds: property(payload, "inputEvidenceIds"),
    };
  return {
    jobId: property(payload, "jobId"),
    jobType: operation === "FixtureIngestionStart" ? "FixtureIngestion" : "Analytics",
    restartability: "Restartable",
    operation,
    originalCommandId: context.commandId,
    inputIdentity,
    createdAt: context.requestedAt,
  };
}

async function completeJob(
  client: WorkflowQueryClient,
  operation: "FixtureIngestionStart" | "AnalyticsRun",
  payload: Readonly<Record<string, unknown>>,
  context: Readonly<ApplicationOwnerCommandContext>,
  acceptedCount: string,
  completedAt: string,
): Promise<Readonly<{ job: unknown }>> {
  const result = await client.query(
    "SELECT etf.job_succeed($1::jsonb) AS job",
    [JSON.stringify({
      jobId: property(payload, "jobId"),
      originalCommandId: context.commandId,
      operation,
      acceptedCount,
      rejectedCount: "0",
      startedAt: context.requestedAt,
      completedAt,
    })],
  );
  return Object.freeze({ job: requireSingleResult(result, "job") });
}

async function dispatchFixture(
  client: WorkflowQueryClient,
  resolver: WorkflowArtifactResolver,
  completedAt: () => string,
  payload: Readonly<Record<string, unknown>>,
  context: Readonly<ApplicationOwnerCommandContext>,
): Promise<Readonly<{ job: unknown }>> {
  const artifact = resolver.resolveFixture(payload);
  if (artifact === undefined) return invalidOwnerRequest();
  const databasePayload = artifact.databasePayload;
  if (
    artifact.fixturePackageHash !== property(payload, "fixturePackageHash") ||
    property(databasePayload, "datasetHash") !== artifact.fixturePackageHash ||
    property(databasePayload, "jobId") !== property(payload, "jobId") ||
    property(databasePayload, "datasetId") !== property(payload, "datasetId") ||
    property(databasePayload, "datasetVersion") !== property(payload, "datasetVersion")
  ) return invalidOwnerRequest();
  const marketObservations = property(databasePayload, "marketObservations");
  const economicObservations = property(databasePayload, "economicObservations");
  if (!Array.isArray(marketObservations) || !Array.isArray(economicObservations)) {
    return invalidOwnerRequest();
  }
  const expectedAcceptedCount = marketObservations.length + economicObservations.length;
  if (expectedAcceptedCount === 0) return invalidOwnerRequest();

  await client.query(
    "SELECT etf.job_start($1::jsonb) AS job",
    [JSON.stringify(jobStartPayload("FixtureIngestionStart", payload, context))],
  );
  const ingestion = requireSingleResult(await client.query(
    "SELECT etf.fixture_ingest($1::jsonb) AS result",
    [JSON.stringify(databasePayload)],
  ), "result");
  if (ingestion === null || typeof ingestion !== "object" || Array.isArray(ingestion)) {
    return ownerError("APPLICATION_RESULT_INVALID");
  }
  const acceptedCount = Object.getOwnPropertyDescriptor(ingestion, "acceptedCount")?.value;
  if (acceptedCount !== expectedAcceptedCount) return ownerError("APPLICATION_RESULT_INVALID");
  return completeJob(
    client,
    "FixtureIngestionStart",
    payload,
    context,
    String(acceptedCount),
    completedAt(),
  );
}

async function dispatchAnalytics(
  client: WorkflowQueryClient,
  resolver: WorkflowArtifactResolver,
  completedAt: () => string,
  payload: Readonly<Record<string, unknown>>,
  context: Readonly<ApplicationOwnerCommandContext>,
): Promise<Readonly<{ job: unknown }>> {
  const artifact = resolver.resolveAnalytics(payload);
  if (artifact === undefined) return invalidOwnerRequest();
  const databasePayload = artifact.databasePayload;
  if (
    artifact.configurationHash !== property(payload, "configurationHash") ||
    sha256(property(databasePayload, "canonicalConfiguration")) !== artifact.configurationHash ||
    !sameStrings(property(payload, "inputEvidenceIds"), artifact.inputEvidenceIds) ||
    property(databasePayload, "evidenceCommitCommandId") !== property(payload, "evidenceCommandId") ||
    typeof property(databasePayload, "evaluationAt") !== "string" ||
    (property(databasePayload, "evaluationAt") as string).slice(0, 10) !== property(payload, "asOfDate")
  ) return invalidOwnerRequest();

  await client.query(
    "SELECT etf.job_start($1::jsonb) AS job",
    [JSON.stringify(jobStartPayload("AnalyticsRun", payload, context))],
  );
  requireSingleResult(await client.query(
    "SELECT etf.evidence_commit($1::jsonb) AS result",
    [JSON.stringify(databasePayload)],
  ), "result");
  return completeJob(client, "AnalyticsRun", payload, context, "1", completedAt());
}

export async function dispatchPostgresWorkflowOperation(
  client: WorkflowQueryClient,
  resolver: WorkflowArtifactResolver,
  completedAt: () => string,
  definition: ApplicationOperationDefinition,
  payload: Readonly<Record<string, unknown>>,
  context: Readonly<ApplicationOwnerCommandContext> | undefined,
): Promise<Readonly<Record<string, unknown>>> {
  try {
    if (definition.operation === "FixtureIngestionStart") {
      if (definition.kind !== "command" || context === undefined) return invalidOwnerRequest();
      return await dispatchFixture(client, resolver, completedAt, payload, context);
    }
    if (definition.operation === "AnalyticsRun") {
      if (definition.kind !== "command" || context === undefined) return invalidOwnerRequest();
      return await dispatchAnalytics(client, resolver, completedAt, payload, context);
    }
    if (definition.operation === "PortfolioGet") {
      if (definition.kind !== "query" || context !== undefined) return invalidOwnerRequest();
      const result = requireSingleResult(await client.query(
        "SELECT etf.portfolio_get($1::uuid, $2::timestamptz) AS result",
        [property(payload, "portfolioId"), property(payload, "asOf")],
      ), "result");
      if (result === null || typeof result !== "object" || Array.isArray(result) || !("portfolio" in result)) {
        return ownerError("APPLICATION_RESULT_INVALID");
      }
      return Object.freeze({ portfolio: result.portfolio });
    }
    return invalidOwnerRequest();
  } catch (error) {
    if (error !== null && typeof error === "object") {
      const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
      if (typeof code === "string" && code.startsWith("APPLICATION_") && code !== "APPLICATION_JOB_NOT_COMPLETABLE") {
        throw error;
      }
    }
    return mapPostgresError(error);
  }
}
