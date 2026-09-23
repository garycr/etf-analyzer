import { types as utilTypes } from "node:util";

import { canonicalizeJson } from "../Infrastructure/CanonicalJson/canonical-json.js";

export const applicationCommandOperations = Object.freeze([
  "WatchlistPut",
  "WatchlistRemove",
  "WatchlistReorder",
  "FixtureIngestionStart",
  "JobRestart",
  "AnalyticsRun",
  "PaperOrderDraftCreate",
  "PaperOrderTransition",
  "DiagnosticsExportCreate",
] as const);

export const applicationQueryOperations = Object.freeze([
  "WatchlistGet",
  "JobGet",
  "ReadinessGet",
  "AnalyticsResultGet",
  "EvidenceGet",
  "PaperOrderGet",
  "PortfolioGet",
] as const);

export const applicationJobTypes = Object.freeze([
  "FixtureIngestion",
  "Analytics",
] as const);

export const applicationJobStatuses = Object.freeze([
  "Pending",
  "Running",
  "Succeeded",
  "Failed",
] as const);

export const applicationJobRestartability = Object.freeze([
  "Restartable",
  "NotRestartable",
] as const);

export type ApplicationCommandOperation =
  (typeof applicationCommandOperations)[number];
export type ApplicationQueryOperation =
  (typeof applicationQueryOperations)[number];
export type ApplicationOperation =
  | ApplicationCommandOperation
  | ApplicationQueryOperation;
export type ApplicationJobType = (typeof applicationJobTypes)[number];
export type ApplicationJobStatus = (typeof applicationJobStatuses)[number];
export type ApplicationJobRestartability =
  (typeof applicationJobRestartability)[number];
export type ApplicationJobTransitionTrigger = "Owner" | "JobRestart";

export interface ApplicationJobStateProjection {
  readonly jobType: ApplicationJobType;
  readonly status: ApplicationJobStatus;
  readonly restartability: ApplicationJobRestartability;
  readonly attempt: number;
}

export type ApplicationJobTransitionResult =
  Readonly<ApplicationJobStateProjection>;

export interface ApplicationOperationDefinition {
  readonly operation: ApplicationOperation;
  readonly kind: "command" | "query";
}

export interface ApplicationReplayKey {
  readonly operation: ApplicationCommandOperation;
  readonly commandId: string;
}

export interface AdmittedApplicationCommand {
  readonly definition: ApplicationOperationDefinition & {
    readonly operation: ApplicationCommandOperation;
    readonly kind: "command";
  };
  readonly requestId: string;
  readonly correlationId: string;
  readonly actorId: "local-user";
  readonly prototypeCandidate: "v1.0.0-prototype.1";
  readonly contractVersion: "1.0.0-candidate.2";
  readonly requestedAt: string;
  readonly commandId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly canonicalContent: string;
}

interface ApplicationCommandEnvelope extends Omit<AdmittedApplicationCommand, "payload"> {
  readonly payload: Record<string, unknown>;
}

export interface ApplicationReplayStore {
  execute<Result>(
    key: ApplicationReplayKey,
    canonicalContent: string,
    executeNew: () => Result,
  ): Result;
  executeAsync<Result>(
    key: ApplicationReplayKey,
    canonicalContent: string,
    executeNew: () => Promise<Result>,
  ): Promise<Result>;
}

export interface ApplicationRequestDependencies {
  readonly replayStore: ApplicationReplayStore;
  readonly completedAt: () => string;
  readonly checkReadiness: (
    definition: ApplicationOperationDefinition,
    payload: Readonly<Record<string, unknown>>,
  ) => void;
  readonly ownerDispatch: (
    definition: ApplicationOperationDefinition,
    payload: Readonly<Record<string, unknown>>,
    context?: Readonly<ApplicationOwnerCommandContext>,
  ) => unknown;
}

export interface ApplicationOwnerCommandContext {
  readonly commandId: string;
  readonly correlationId: string;
  readonly requestedAt: string;
}

export interface AsyncApplicationRequestDependencies {
  readonly replayStore: ApplicationReplayStore;
  readonly completedAt: () => string;
  readonly checkReadiness: (
    definition: ApplicationOperationDefinition,
    payload: Readonly<Record<string, unknown>>,
  ) => void | Promise<void>;
  readonly ownerDispatch: (
    definition: ApplicationOperationDefinition,
    payload: Readonly<Record<string, unknown>>,
    context?: Readonly<ApplicationOwnerCommandContext>,
  ) => unknown | Promise<unknown>;
}

export interface ApplicationResultPresentation {
  readonly statusText: "Succeeded" | "Failed";
  readonly announcement: "None" | "AssertiveAlert";
  readonly warningText:
    | "Research only — hypothetical — user makes all investment decisions."
    | null;
  readonly researchWarningRequired: boolean;
}

export type ApplicationValidationPhase =
  | "Operation"
  | "Request"
  | "Authorization"
  | "Replay"
  | "Admission"
  | "Owner"
  | "Persistence"
  | "Result";

export interface ApplicationErrorCandidate {
  readonly phase: ApplicationValidationPhase;
  readonly code: string;
  readonly operation?: unknown;
  readonly requestId?: unknown;
  readonly ownerRank?: number;
}

export interface ControllingApplicationError {
  readonly code: string;
  readonly requestId: string | null;
}

export interface CompleteVerifiedResearch<Result> {
  readonly completeness: "Complete";
  readonly integrity: "Verified";
  readonly result: Result;
}

export interface PaperOrderSubmissionRequest {
  readonly correlationId: string;
  readonly expectedVersion: number;
  readonly orderId: string;
  readonly sourceState: "Draft";
  readonly transitionCommandId: string;
}

export interface JobRestartRequest {
  readonly jobId: string;
}

export interface FailedJobForPresentation {
  readonly jobId: string;
  readonly status: "Failed";
  readonly restartability: "Restartable" | "NotRestartable";
  readonly controllingError: {
    readonly code: string;
  };
}

export type FailedJobRecovery =
  | {
    readonly actionId: "retry-job";
    readonly label: "Retry job";
    readonly targetOperation: "JobRestart";
    readonly focusTarget: "job-status";
    readonly requiresConfirmation: false;
  }
  | {
    readonly actionId: "review-job";
    readonly label: "Review job details";
    readonly targetOperation: "JobGet";
    readonly focusTarget: "job-details";
    readonly requiresConfirmation: false;
  };

export const readinessDependencyNames = Object.freeze([
  "PostgreSQL",
  "Migrations",
  "FixturePolicy",
  "LocalDependency",
  "DenialAudit",
  "LedgerIntegrity",
] as const);

export type ReadinessDependencyName =
  (typeof readinessDependencyNames)[number];

type ReadinessCheck<ErrorCode extends string> =
  | { readonly ready: true; readonly checkedAt: string }
  | {
    readonly ready: false;
    readonly checkedAt: string;
    readonly errorCode: ErrorCode;
  };

export interface ReadinessChecks {
  readonly PostgreSQL: ReadinessCheck<"APPLICATION_DATABASE_UNAVAILABLE">;
  readonly Migrations: ReadinessCheck<"APPLICATION_MIGRATIONS_INCOMPLETE">;
  readonly FixturePolicy: ReadinessCheck<"APPLICATION_CONFIGURATION_INVALID">;
  readonly LocalDependency: ReadinessCheck<"APPLICATION_DEPENDENCY_UNAVAILABLE">;
  readonly DenialAudit: ReadinessCheck<"ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED">;
  readonly LedgerIntegrity: ReadinessCheck<"LEDGER_INTEGRITY_FAILED">;
}

export type ReadinessErrorCode =
  ReadinessChecks[keyof ReadinessChecks] extends ReadinessCheck<infer ErrorCode>
    ? ErrorCode
    : never;

export interface ReadinessEvaluationRequest {
  readonly checkedAt: string;
  readonly liveness: "Live" | "NotLive";
  readonly dependencies: ReadinessChecks;
}

export interface ReadinessDependency {
  readonly dependency: ReadinessDependencyName;
  readonly state: "Ready" | "NotReady";
  readonly checkedAt: string;
  readonly code: string | null;
}

export interface ReadinessSnapshot {
  readonly state: "Ready" | "NotReady";
  readonly checkedAt: string;
  readonly displayTimezone: "UTC";
  readonly liveness: "Live" | "NotLive";
  readonly dependencies: readonly ReadinessDependency[];
  readonly controllingError: null | {
    readonly code: ReadinessErrorCode;
    readonly message: string;
    readonly boundedIdentifiers: Readonly<Record<string, never>>;
    readonly recovery: {
      readonly actionId: "review-readiness";
      readonly label: "Review readiness details";
      readonly targetOperation: "ReadinessGet";
      readonly focusTarget: "readiness-details";
      readonly requiresConfirmation: false;
    };
  };
}

export const ownerFailureCodes = Object.freeze([
  "ORDER_INVALID_TRANSITION",
  "ORDER_VERSION_CONFLICT",
  "FIXTURE_REQUIRED_QUARANTINED",
  "ANALYTICS_INPUT_INCOMPLETE",
  "ANALYTICS_INPUT_STALE",
  "ANALYTICS_INPUT_QUARANTINED",
  "ANALYTICS_AMBIGUOUS_VINTAGE",
  "ANALYTICS_AMBIGUOUS_MARKET_REVISION",
  "ANALYTICS_RIGHTS_RESTRICTED",
  "ANALYTICS_INTEGRITY_FAILED",
  "ANALYTICS_EVIDENCE_ACCESS_DENIED",
  "ANALYTICS_PUBLICATION_BLOCKED",
  "ANALYTICS_NUMERIC_CLASS_INVALID",
  "ANALYTICS_CAPACITY_BLOCKED",
  "ANALYTICS_EVIDENCE_COMMIT_FAILED",
  "ANALYTICS_DETERMINISM_FAILED",
  "ANALYTICS_IDEMPOTENCY_CONFLICT",
  "ANALYTICS_PUBLICATION_VERSION_CONFLICT",
  "APPLICATION_REQUEST_INVALID",
  "APPLICATION_IDEMPOTENCY_CONFLICT",
  "APPLICATION_JOB_NOT_RESTARTABLE",
  "APPLICATION_REDACTION_FAILED",
  "ORDER_IDEMPOTENCY_CONFLICT",
  "FIXTURE_IDEMPOTENCY_CONFLICT",
  "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
  "LEDGER_INTEGRITY_FAILED",
  "ORDER_GUARD_FAILED",
  "ORDER_TERMINAL_STATE",
  "ORDER_NOT_FOUND",
  "LEDGER_VERSION_CONFLICT",
] as const);

export type OwnerFailureCode = (typeof ownerFailureCodes)[number];

export interface OwnerFailurePresentation {
  readonly code: OwnerFailureCode;
  readonly message: string;
  readonly boundedIdentifiers: Readonly<Record<string, never>>;
  readonly recovery: null;
}

export type CanonicalValueClass =
  | "OrderStatus"
  | "Readiness"
  | "UTCInstant"
  | "SourceTime"
  | "RetrievedAt"
  | "CompletedAt"
  | "Timezone"
  | "Date"
  | "TradeDate"
  | "UnitPrice"
  | "Money"
  | "Rate";

export interface CanonicalValuePresentation {
  readonly wireValue: string;
  readonly visibleText: string;
  readonly accessibleText: string;
}

export type ResearchWarningResultKind =
  | "AnalyticalResult"
  | "Evidence"
  | "PaperAction"
  | "NonAnalytical";

export const researchWarningText =
  "Research only — hypothetical — user makes all investment decisions." as const;

export type ResearchWarningPresentation =
  | {
    readonly researchWarningRequired: true;
    readonly warningText:
      "Research only — hypothetical — user makes all investment decisions.";
  }
  | {
    readonly researchWarningRequired: false;
    readonly warningText: null;
  };

export type BlockedState =
  | "FailedRestartable"
  | "FailedNotRestartable"
  | "InputQuarantined"
  | "VersionConflict"
  | "IntegrityBlocked"
  | "NotReady"
  | "DraftAwaitingConfirmation"
  | "MissingIdentity"
  | "AccessDenied"
  | "NoSafeOperation";

export type BlockedStateRequest =
  | {
    readonly state: "FailedRestartable" | "FailedNotRestartable";
    readonly context: Readonly<{ jobId: string }>;
  }
  | {
    readonly state: "InputQuarantined";
    readonly context: Readonly<{ evidenceId: string }>;
  }
  | {
    readonly state: "VersionConflict";
    readonly context: Readonly<{ orderId: string }>;
  }
  | {
    readonly state: "IntegrityBlocked" | "NotReady" | "MissingIdentity";
    readonly context: Readonly<Record<string, never>>;
  }
  | {
    readonly state: "DraftAwaitingConfirmation";
    readonly context: Readonly<{
      orderId: string;
      aggregateVersion: string;
      confirmation: PaperOrderConfirmation;
    }>;
  }
  | {
    readonly state: "AccessDenied";
    readonly context: Readonly<{ orderId: string }>;
  }
  | {
    readonly state: "NoSafeOperation";
    readonly context: Readonly<{ code: string }>;
  };

export type BlockedStateRecovery = FailedJobRecovery
  | {
    readonly actionId: "review-evidence";
    readonly label: "Review data issue";
    readonly targetOperation: "EvidenceGet";
    readonly focusTarget: "evidence-details";
    readonly requiresConfirmation: false;
  }
  | {
    readonly actionId: "reload-order";
    readonly label: "Reload current order";
    readonly targetOperation: "PaperOrderGet";
    readonly focusTarget: "order-details";
    readonly requiresConfirmation: false;
  }
  | {
    readonly actionId: "review-integrity";
    readonly label: "Review integrity status";
    readonly targetOperation: "ReadinessGet";
    readonly focusTarget: "readiness-details";
    readonly requiresConfirmation: false;
  }
  | {
    readonly actionId: "review-readiness";
    readonly label: "Review readiness details";
    readonly targetOperation: "ReadinessGet";
    readonly focusTarget: "readiness-details";
    readonly requiresConfirmation: false;
  }
  | {
    readonly actionId: "submit-paper-order";
    readonly label: "Submit paper order";
    readonly targetOperation: "PaperOrderTransition";
    readonly focusTarget: "order-status";
    readonly requiresConfirmation: true;
  };

export interface BlockedStatePresentation {
  readonly state: BlockedState;
  readonly statusText: string;
  readonly causeText: string;
  readonly programmaticRole: "status" | "alert";
  readonly announcement: "None" | "PoliteStatus" | "AssertiveAlert";
  readonly recovery: BlockedStateRecovery | null;
  readonly keyboardOperable: boolean;
  readonly focusPlan: Readonly<{
    processing: "trigger";
    validationFailure: "first-actionable-error";
    success: BlockedStateRecovery["focusTarget"] | null;
  }>;
}

export type RecoveryActivationMethod = "Keyboard" | "Pointer";

export type BlockedStateRecoveryActivation<Result> =
  | { readonly outcome: "NotDispatched" }
  | {
    readonly outcome: "Dispatched";
    readonly activationMethod: RecoveryActivationMethod;
    readonly result: Result;
  };

type DiagnosticScalar = string | number;
type DiagnosticValue = DiagnosticScalar | readonly string[];
export type DiagnosticRecord = Readonly<Record<string, unknown>>;
export type ExportedDiagnosticRecord = Readonly<Record<string, DiagnosticValue>>;

export interface DiagnosticRedactionFailure {
  readonly code: "APPLICATION_REDACTION_FAILED";
  readonly boundedIdentifiers: Readonly<{ correlationId?: string }>;
}

export type DiagnosticExportResult<Result extends Readonly<Record<string, unknown>>> =
  | { readonly outcome: "Succeeded"; readonly export: Readonly<Result> }
  | { readonly outcome: "Failed"; readonly error: DiagnosticRedactionFailure };

export interface FailedJobPresentation<Job extends FailedJobForPresentation> {
  readonly job: Job;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly boundedIdentifiers: { readonly jobId: string };
    readonly recovery: FailedJobRecovery;
  };
  readonly recoveryTarget: { readonly jobId: string };
  readonly dependentResearch: "Blocked";
}

export interface PaperOrderConfirmation {
  readonly actorId: "local-user";
  readonly confirmedAt: string;
  readonly confirmationText: string;
}

export type PaperOrderConfirmationAttempt =
  | { readonly status: "Absent" | "Canceled" | "Expired" | "Incomplete" }
  | {
    readonly status: "Completed";
    readonly confirmation: PaperOrderConfirmation;
  };

export interface SubmitPaperOrderCommand {
  readonly baselineVersion: "v1.0.0";
  readonly correlationId: string;
  readonly expectedVersion: number;
  readonly orderId: string;
  readonly sourceState: "Draft";
  readonly targetState: "Submitted";
  readonly transition: "OT-02";
  readonly transitionCommandId: string;
  readonly transitionPayload: {
    readonly confirmation: PaperOrderConfirmation;
  };
  readonly trigger: "UserConfirmedPaperAction";
}

export type PaperOrderSubmissionResult<Result> =
  | { readonly outcome: "NotDispatched"; readonly state: "Draft" }
  | { readonly outcome: "Dispatched"; readonly result: Result };

export class ApplicationOperationUnknownError extends Error {
  readonly code = "APPLICATION_OPERATION_UNKNOWN";
  readonly requestId: string | null;

  constructor(requestId: string | null = null) {
    super("Application operation is unknown");
    this.name = "ApplicationOperationUnknownError";
    this.requestId = requestId;
  }
}

export class ApplicationRequestInvalidError extends Error {
  readonly code = "APPLICATION_REQUEST_INVALID";
  readonly requestId: string | null;

  constructor(requestId: string | null = null) {
    super("The application request is invalid");
    this.name = "ApplicationRequestInvalidError";
    this.requestId = requestId;
  }
}

export class ApplicationUnauthorizedError extends Error {
  readonly code = "APPLICATION_UNAUTHORIZED";
  readonly requestId: string | null;

  constructor(requestId: string | null = null) {
    super("The local actor is not authorized for the application operation");
    this.name = "ApplicationUnauthorizedError";
    this.requestId = requestId;
  }
}

export class ApplicationResultInvalidError extends Error {
  readonly code = "APPLICATION_RESULT_INVALID";

  constructor() {
    super("The application result is invalid");
    this.name = "ApplicationResultInvalidError";
  }
}

export class ApplicationJobTransitionError extends Error {
  constructor(
    readonly code:
      | "APPLICATION_JOB_NOT_RESTARTABLE"
      | "APPLICATION_RESULT_INVALID",
  ) {
    super(code === "APPLICATION_JOB_NOT_RESTARTABLE"
      ? "The job cannot be restarted"
      : "The application job transition is invalid");
    this.name = "ApplicationJobTransitionError";
  }
}

export class ApplicationIdempotencyConflictError extends Error {
  readonly code = "APPLICATION_IDEMPOTENCY_CONFLICT";

  constructor() {
    super("The application command identity was reused with different content");
    this.name = "ApplicationIdempotencyConflictError";
  }
}

class JsonMemberScanner {
  private index = 0;

  constructor(private readonly text: string) {}

  scan(): void {
    this.skipWhitespace();
    this.scanValue();
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      throw new ApplicationRequestInvalidError();
    }
  }

  private skipWhitespace(): void {
    while (/\s/u.test(this.text[this.index] ?? "")) {
      this.index += 1;
    }
  }

  private scanValue(): void {
    this.skipWhitespace();
    const character = this.text[this.index];
    if (character === "{") {
      this.scanObject();
      return;
    }
    if (character === "[") {
      this.scanArray();
      return;
    }
    if (character === '"') {
      this.scanString();
      return;
    }
    const start = this.index;
    while (
      this.index < this.text.length &&
      !/[\s,}\]]/u.test(this.text[this.index] ?? "")
    ) {
      this.index += 1;
    }
    if (start === this.index) {
      throw new ApplicationRequestInvalidError();
    }
  }

  private scanObject(): void {
    this.index += 1;
    this.skipWhitespace();
    const members = new Set<string>();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return;
    }
    while (true) {
      if (this.text[this.index] !== '"') {
        throw new ApplicationRequestInvalidError();
      }
      const member = this.scanString();
      if (members.has(member)) {
        throw new ApplicationRequestInvalidError();
      }
      members.add(member);
      this.skipWhitespace();
      if (this.text[this.index] !== ":") {
        throw new ApplicationRequestInvalidError();
      }
      this.index += 1;
      this.scanValue();
      this.skipWhitespace();
      if (this.text[this.index] === "}") {
        this.index += 1;
        return;
      }
      if (this.text[this.index] !== ",") {
        throw new ApplicationRequestInvalidError();
      }
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private scanArray(): void {
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return;
    }
    while (true) {
      this.scanValue();
      this.skipWhitespace();
      if (this.text[this.index] === "]") {
        this.index += 1;
        return;
      }
      if (this.text[this.index] !== ",") {
        throw new ApplicationRequestInvalidError();
      }
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private scanString(): string {
    const start = this.index;
    this.index += 1;
    while (this.index < this.text.length) {
      const character = this.text[this.index];
      if (character === "\\") {
        this.index += 2;
        continue;
      }
      this.index += 1;
      if (character === '"') {
        try {
          return JSON.parse(this.text.slice(start, this.index)) as string;
        } catch {
          throw new ApplicationRequestInvalidError();
        }
      }
    }
    throw new ApplicationRequestInvalidError();
  }
}

function invalidApplicationRequest(): never {
  throw new ApplicationRequestInvalidError();
}

function requireClosedRecord(
  value: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return invalidApplicationRequest();
  }
  const actualFields = Object.keys(value).sort();
  const expectedFields = [...fields].sort();
  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field, index) => field !== expectedFields[index])
  ) {
    return invalidApplicationRequest();
  }
  return value as Record<string, unknown>;
}

function isClosedRecord(
  value: unknown,
  fields: readonly string[],
): value is Record<string, unknown> {
  if (!isPlainRecord(value)) return false;
  const actualFields = Object.keys(value).sort();
  const expectedFields = [...fields].sort();
  return actualFields.length === expectedFields.length &&
    actualFields.every((field, index) => field === expectedFields[index]);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !(
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isUInt(value: unknown): value is string {
  return typeof value === "string" &&
    /^(?:0|[1-9][0-9]*)$/u.test(value) &&
    (value.length < 16 || (value.length === 16 && value <= "9007199254740991"));
}

function isCanonicalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isUtcInstant(value: unknown): value is string {
  if (typeof value !== "string" || !utcInstantPattern.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function isScale10(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9][0-9]*)\.[0-9]{10}$/u.test(value);
}

function isScale8(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9][0-9]*)\.[0-9]{8}$/u.test(value);
}

function isSignedScale8(value: unknown): value is string {
  return typeof value === "string" && /^-?(?:0|[1-9][0-9]*)\.[0-9]{8}$/u.test(value);
}

function requireStringArray(
  value: unknown,
  options: Readonly<{ nonEmpty?: boolean; unique?: boolean; uuid?: boolean }> = {},
): readonly string[] {
  if (
    !Array.isArray(value) ||
    (options.nonEmpty === true && value.length === 0) ||
    !value.every((item) => options.uuid === true ? isUuid(item) : isString(item)) ||
    (options.unique === true && new Set(value).size !== value.length)
  ) {
    return invalidApplicationRequest();
  }
  return value;
}

function requireConfirmation(value: unknown): void {
  const confirmation = requireClosedRecord(
    value,
    ["actorId", "confirmedAt", "confirmationText"],
  );
  if (
    confirmation.actorId !== "local-user" ||
    !isUtcInstant(confirmation.confirmedAt) ||
    !isString(confirmation.confirmationText)
  ) {
    invalidApplicationRequest();
  }
}

function requireTransitionPayload(transition: unknown, value: unknown): void {
  if (typeof transition !== "string") {
    invalidApplicationRequest();
  }
  let payload: Record<string, unknown>;
  switch (transition) {
    case "OT-02":
      payload = requireClosedRecord(value, ["confirmation"]);
      requireConfirmation(payload.confirmation);
      return;
    case "OT-03":
      payload = requireClosedRecord(
        value,
        ["portfolioId", "validationSnapshotId", "expectedPortfolioVersion"],
      );
      if (
        !isUuid(payload.portfolioId) ||
        !isUuid(payload.validationSnapshotId) ||
        !isUInt(payload.expectedPortfolioVersion)
      ) invalidApplicationRequest();
      return;
    case "OT-04":
    case "OT-07":
    case "OT-10": {
      const field = transition === "OT-04" ? "rejectionCode" : "reasonCode";
      payload = requireClosedRecord(value, [field]);
      if (!isString(payload[field])) invalidApplicationRequest();
      return;
    }
    case "OT-05":
    case "OT-06":
    case "OT-09":
      payload = requireClosedRecord(value, [
        "portfolioId",
        "transactionId",
        "fillId",
        "expectedPortfolioVersion",
        "quantity",
        "unitPrice",
        "fee",
      ]);
      if (
        !isUuid(payload.portfolioId) ||
        !isUuid(payload.transactionId) ||
        !isUuid(payload.fillId) ||
        !isUInt(payload.expectedPortfolioVersion) ||
        !isScale10(payload.quantity) ||
        !isScale10(payload.unitPrice) ||
        !isScale8(payload.fee)
      ) invalidApplicationRequest();
      return;
    case "OT-08":
      payload = requireClosedRecord(value, ["expiresAt"]);
      if (!isUtcInstant(payload.expiresAt)) invalidApplicationRequest();
      return;
    default:
      invalidApplicationRequest();
  }
}

function validateApplicationPayload(
  operation: ApplicationOperation,
  payload: Record<string, unknown>,
): Readonly<Record<string, unknown>> {
  switch (operation) {
    case "WatchlistPut": {
      const record = requireClosedRecord(payload, ["instrumentId", "displayName", "expectedVersion"]);
      if (!isString(record.instrumentId) || !isString(record.displayName) || !isUInt(record.expectedVersion)) invalidApplicationRequest();
      return payload;
    }
    case "WatchlistRemove": {
      const record = requireClosedRecord(payload, ["instrumentId", "expectedVersion"]);
      if (!isString(record.instrumentId) || !isUInt(record.expectedVersion)) invalidApplicationRequest();
      return payload;
    }
    case "WatchlistReorder": {
      const record = requireClosedRecord(payload, ["orderedInstrumentIds", "expectedVersion"]);
      requireStringArray(record.orderedInstrumentIds, { nonEmpty: true, unique: true });
      if (!isUInt(record.expectedVersion)) invalidApplicationRequest();
      return payload;
    }
    case "FixtureIngestionStart": {
      const record = requireClosedRecord(payload, ["jobId", "datasetId", "datasetVersion", "fixturePackageHash"]);
      if (!isUuid(record.jobId) || !isString(record.datasetId) || !isString(record.datasetVersion) || typeof record.fixturePackageHash !== "string" || !sha256Pattern.test(record.fixturePackageHash)) invalidApplicationRequest();
      return payload;
    }
    case "JobRestart":
    case "JobGet": {
      const record = requireClosedRecord(payload, ["jobId"]);
      if (!isUuid(record.jobId)) invalidApplicationRequest();
      return payload;
    }
    case "AnalyticsRun": {
      const record = requireClosedRecord(payload, ["jobId", "evidenceCommandId", "asOfDate", "configurationHash", "inputEvidenceIds"]);
      if (!isUuid(record.jobId) || !isUuid(record.evidenceCommandId) || !isCanonicalDate(record.asOfDate) || typeof record.configurationHash !== "string" || !sha256Pattern.test(record.configurationHash)) invalidApplicationRequest();
      const inputEvidenceIds = requireStringArray(
        record.inputEvidenceIds,
        { nonEmpty: true, unique: true, uuid: true },
      );
      return Object.freeze({
        ...payload,
        inputEvidenceIds: Object.freeze([...inputEvidenceIds].sort(compareCodePoints)),
      });
    }
    case "PaperOrderDraftCreate": {
      const record = requireClosedRecord(payload, ["orderId", "instrumentId", "researchEvidenceId", "side", "quantity", "unitPrice", "tradeDate"]);
      if (!isUuid(record.orderId) || !isString(record.instrumentId) || !isUuid(record.researchEvidenceId) || (record.side !== "Buy" && record.side !== "Sell") || !isScale10(record.quantity) || !isScale10(record.unitPrice) || !isCanonicalDate(record.tradeDate)) invalidApplicationRequest();
      return payload;
    }
    case "PaperOrderTransition": {
      const record = requireClosedRecord(payload, ["orderId", "transitionCommandId", "expectedVersion", "transition", "transitionPayload"]);
      if (!isUuid(record.orderId) || !isUuid(record.transitionCommandId) || !isUInt(record.expectedVersion)) invalidApplicationRequest();
      requireTransitionPayload(record.transition, record.transitionPayload);
      return payload;
    }
    case "DiagnosticsExportCreate": {
      const record = requireClosedRecord(payload, ["exportId", "from", "through", "requestedCodes"]);
      if (
        !isUuid(record.exportId) ||
        !isUtcInstant(record.from) ||
        !isUtcInstant(record.through) ||
        compareCodePoints(record.from, record.through) > 0
      ) invalidApplicationRequest();
      const codes = requireStringArray(record.requestedCodes, { nonEmpty: true, unique: true });
      if (!codes.every((code) => stableCodePattern.test(code))) invalidApplicationRequest();
      return payload;
    }
    case "WatchlistGet":
    case "ReadinessGet":
      requireClosedRecord(payload, []);
      return payload;
    case "AnalyticsResultGet": {
      const record = requireClosedRecord(payload, ["publicationTargetId"]);
      if (!isUuid(record.publicationTargetId)) invalidApplicationRequest();
      return payload;
    }
    case "EvidenceGet": {
      const record = requireClosedRecord(payload, ["evidenceId"]);
      if (!isString(record.evidenceId)) invalidApplicationRequest();
      return payload;
    }
    case "PaperOrderGet": {
      const record = requireClosedRecord(payload, ["orderId"]);
      if (!isUuid(record.orderId)) invalidApplicationRequest();
      return payload;
    }
    case "PortfolioGet": {
      const record = requireClosedRecord(payload, ["portfolioId", "asOf"]);
      if (!isUuid(record.portfolioId) || !isUtcInstant(record.asOf)) invalidApplicationRequest();
      return payload;
    }
  }
}

function freezeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    value.forEach(freezeJsonValue);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freezeJsonValue);
    return Object.freeze(value);
  }
  return value;
}

export function parseApplicationPayload(payloadJson: string): Record<string, unknown> {
  try {
    new JsonMemberScanner(payloadJson).scan();
    const parsed: unknown = JSON.parse(payloadJson);
    const payload = requireClosedRecord(parsed, Object.keys(parsed as object));
    return freezeJsonValue(payload) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApplicationRequestInvalidError) {
      throw error;
    }
    throw new ApplicationRequestInvalidError();
  }
}

function createOperationDefinitions(): Map<string, ApplicationOperationDefinition> {
  const definitions = new Map<string, ApplicationOperationDefinition>();
  for (const [kind, operations] of [
    ["command", applicationCommandOperations],
    ["query", applicationQueryOperations],
  ] as const) {
    for (const operation of operations) {
      if (definitions.has(operation)) {
        throw new Error("Application operation catalog contains a duplicate definition");
      }
      definitions.set(operation, Object.freeze({ operation, kind }));
    }
  }
  return definitions;
}

const operationDefinitions = createOperationDefinitions();

export function resolveApplicationOperation(
  operation: string,
): ApplicationOperationDefinition {
  const definition = operationDefinitions.get(operation);
  if (definition === undefined) {
    throw new ApplicationOperationUnknownError();
  }
  return definition;
}

const applicationPhaseRanks: Readonly<Record<ApplicationValidationPhase, number>> =
  Object.freeze({
    Operation: 10,
    Request: 20,
    Authorization: 30,
    Replay: 40,
    Admission: 50,
    Owner: 60,
    Persistence: 70,
    Result: 80,
  });
const applicationCodesByPhase: Readonly<
  Record<ApplicationValidationPhase, ReadonlySet<string>>
> = Object.freeze({
  Operation: new Set(["APPLICATION_OPERATION_UNKNOWN"]),
  Request: new Set(["APPLICATION_REQUEST_INVALID"]),
  Authorization: new Set(["APPLICATION_UNAUTHORIZED"]),
  Replay: new Set(["APPLICATION_IDEMPOTENCY_CONFLICT"]),
  Admission: new Set([
    "APPLICATION_JOB_NOT_FOUND",
    "APPLICATION_JOB_NOT_RESTARTABLE",
    "APPLICATION_DATABASE_UNAVAILABLE",
    "APPLICATION_MIGRATIONS_INCOMPLETE",
    "APPLICATION_CONFIGURATION_INVALID",
    "APPLICATION_DEPENDENCY_UNAVAILABLE",
    "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
    "LEDGER_INTEGRITY_FAILED",
  ]),
  Owner: new Set([
    "APPLICATION_JOB_NOT_FOUND",
    "APPLICATION_JOB_NOT_RESTARTABLE",
    "ORDER_INVALID_TRANSITION",
    "ORDER_GUARD_FAILED",
    "ORDER_TERMINAL_STATE",
    "ORDER_NOT_FOUND",
    "ORDER_VERSION_CONFLICT",
    "ORDER_IDEMPOTENCY_CONFLICT",
    "FIXTURE_REQUIRED_QUARANTINED",
    "FIXTURE_REQUIRED_INPUT_MISSING",
    "FIXTURE_IDEMPOTENCY_CONFLICT",
    "ANALYTICS_INPUT_INCOMPLETE",
    "ANALYTICS_INPUT_STALE",
    "ANALYTICS_INPUT_QUARANTINED",
    "ANALYTICS_AMBIGUOUS_VINTAGE",
    "ANALYTICS_AMBIGUOUS_MARKET_REVISION",
    "ANALYTICS_RIGHTS_RESTRICTED",
    "ANALYTICS_INTEGRITY_FAILED",
    "ANALYTICS_EVIDENCE_ACCESS_DENIED",
    "ANALYTICS_PUBLICATION_BLOCKED",
    "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
    "ANALYTICS_NUMERIC_CLASS_INVALID",
    "ANALYTICS_CAPACITY_BLOCKED",
    "ANALYTICS_EVIDENCE_COMMIT_FAILED",
    "ANALYTICS_DETERMINISM_FAILED",
    "ANALYTICS_IDEMPOTENCY_CONFLICT",
    "ANALYTICS_PUBLICATION_VERSION_CONFLICT",
    "LEDGER_VERSION_CONFLICT",
    "LEDGER_INTEGRITY_FAILED",
  ]),
  Persistence: new Set(["APPLICATION_PERSISTENCE_FAILED"]),
  Result: new Set([
    "APPLICATION_REDACTION_FAILED",
    "APPLICATION_RESULT_INVALID",
  ]),
});

function compareApplicationErrorCandidates(
  left: ApplicationErrorCandidate,
  right: ApplicationErrorCandidate,
): number {
  const phaseComparison = applicationPhaseRanks[left.phase] - applicationPhaseRanks[right.phase];
  if (phaseComparison !== 0) return phaseComparison;
  if (left.phase === "Owner" && right.phase === "Owner") {
    const ownerComparison = left.ownerRank! - right.ownerRank!;
    if (ownerComparison !== 0) return ownerComparison;
  }
  const leftOperation = typeof left.operation === "string" && operationDefinitions.has(left.operation)
    ? left.operation
    : "";
  const rightOperation = typeof right.operation === "string" && operationDefinitions.has(right.operation)
    ? right.operation
    : "";
  const operationComparison = compareCodePoints(leftOperation, rightOperation);
  if (operationComparison !== 0) return operationComparison;
  const leftRequestId = isUuid(left.requestId) ? left.requestId : "";
  const rightRequestId = isUuid(right.requestId) ? right.requestId : "";
  const requestComparison = compareCodePoints(leftRequestId, rightRequestId);
  if (requestComparison !== 0) return requestComparison;
  return compareCodePoints(left.code, right.code);
}

export function selectControllingApplicationError(
  candidates: readonly ApplicationErrorCandidate[],
): ControllingApplicationError {
  if (candidates.length === 0) invalidApplicationResult();
  for (const candidate of candidates) {
    if (
      !(candidate.phase in applicationPhaseRanks) ||
      !isString(candidate.code) ||
      !stableCodePattern.test(candidate.code) ||
      !applicationCodesByPhase[candidate.phase]?.has(candidate.code) ||
      (candidate.phase === "Owner" &&
        (!Number.isSafeInteger(candidate.ownerRank) || candidate.ownerRank! <= 0)) ||
      (candidate.phase !== "Owner" && candidate.ownerRank !== undefined)
    ) invalidApplicationResult();
  }
  const selected = [...candidates].sort(compareApplicationErrorCandidates)[0]!;
  return Object.freeze({
    code: selected.code,
    requestId: isUuid(selected.requestId) ? selected.requestId : null,
  });
}

export function dispatchApplicationOperation<Result>(
  operation: string,
  handler: (definition: ApplicationOperationDefinition) => Result,
): Result {
  return handler(resolveApplicationOperation(operation));
}

export function dispatchValidatedApplicationRequest<Result>(
  operation: string,
  payloadJson: string,
  ownerDispatch: (
    definition: ApplicationOperationDefinition,
    payload: Readonly<Record<string, unknown>>,
  ) => Result,
): Result {
  const definition = resolveApplicationOperation(operation);
  const payload = parseApplicationPayload(payloadJson);
  const validatedPayload = validateApplicationPayload(definition.operation, payload);
  return ownerDispatch(definition, validatedPayload);
}

const applicationCommandEnvelopeFields = Object.freeze([
  "operation",
  "requestId",
  "correlationId",
  "actorId",
  "prototypeCandidate",
  "contractVersion",
  "requestedAt",
  "commandId",
  "payload",
]);

function throwSelectedCommandAdmissionError(
  selected: ControllingApplicationError,
): never {
  switch (selected.code) {
    case "APPLICATION_OPERATION_UNKNOWN":
      throw new ApplicationOperationUnknownError(selected.requestId);
    case "APPLICATION_REQUEST_INVALID":
      throw new ApplicationRequestInvalidError(selected.requestId);
    case "APPLICATION_UNAUTHORIZED":
      throw new ApplicationUnauthorizedError(selected.requestId);
    default:
      return invalidApplicationResult();
  }
}

function admitApplicationCommandEnvelope(requestJson: string): ApplicationCommandEnvelope {
  const request = parseApplicationPayload(requestJson);
  const requestId = isUuid(request.requestId) ? request.requestId : null;
  const definition = typeof request.operation === "string"
    ? operationDefinitions.get(request.operation)
    : undefined;
  const candidates: ApplicationErrorCandidate[] = [];
  if (definition === undefined) {
    candidates.push({
      phase: "Operation",
      code: "APPLICATION_OPERATION_UNKNOWN",
      operation: request.operation,
      requestId: request.requestId,
    });
  }
  if (
    !isClosedRecord(request, applicationCommandEnvelopeFields) ||
    !isUuid(request.requestId) ||
    !isUuid(request.correlationId) ||
    !isString(request.actorId) ||
    request.prototypeCandidate !== "v1.0.0-prototype.1" ||
    request.contractVersion !== "1.0.0-candidate.2" ||
    !isUtcInstant(request.requestedAt) ||
    !isUuid(request.commandId) ||
    !isPlainRecord(request.payload) ||
    (definition !== undefined && definition.kind !== "command")
  ) {
    candidates.push({
      phase: "Request",
      code: "APPLICATION_REQUEST_INVALID",
      operation: request.operation,
      requestId: request.requestId,
    });
  }
  if (isString(request.actorId) && request.actorId !== "local-user") {
    candidates.push({
      phase: "Authorization",
      code: "APPLICATION_UNAUTHORIZED",
      operation: request.operation,
      requestId: request.requestId,
    });
  }
  if (candidates.length > 0) {
    throwSelectedCommandAdmissionError(selectControllingApplicationError(candidates));
  }

  if (
    definition === undefined ||
    definition.kind !== "command" ||
    requestId === null ||
    !isUuid(request.correlationId) ||
    request.actorId !== "local-user" ||
    request.prototypeCandidate !== "v1.0.0-prototype.1" ||
    request.contractVersion !== "1.0.0-candidate.2" ||
    !isUtcInstant(request.requestedAt) ||
    !isUuid(request.commandId) ||
    !isPlainRecord(request.payload)
  ) return invalidApplicationResult();
  const commandDefinition = definition as AdmittedApplicationCommand["definition"];
  const payloadRecord = request.payload;
  const replayPayload = normalizeApplicationReplayPayload(
    commandDefinition.operation,
    payloadRecord,
  );
  const canonicalContent = canonicalizeJson({
    operation: commandDefinition.operation,
    actorId: request.actorId,
    prototypeCandidate: request.prototypeCandidate,
    contractVersion: request.contractVersion,
    payload: replayPayload,
  });
  return Object.freeze({
    definition: commandDefinition,
    requestId,
    correlationId: request.correlationId,
    actorId: request.actorId,
    prototypeCandidate: request.prototypeCandidate,
    contractVersion: request.contractVersion,
    requestedAt: request.requestedAt,
    commandId: request.commandId,
    payload: payloadRecord,
    canonicalContent,
  });
}

function normalizeApplicationReplayPayload(
  operation: ApplicationCommandOperation,
  payload: Record<string, unknown>,
): Readonly<Record<string, unknown>> {
  if (
    operation === "AnalyticsRun" &&
    Array.isArray(payload.inputEvidenceIds) &&
    payload.inputEvidenceIds.every(isString)
  ) {
    return Object.freeze({
      ...payload,
      inputEvidenceIds: Object.freeze(
        [...payload.inputEvidenceIds].sort(compareCodePoints),
      ),
    });
  }
  return payload;
}

class ApplicationReplayInProgressError extends Error {
  readonly code = "APPLICATION_IDEMPOTENCY_CONFLICT";

  constructor() {
    super("Application replay execution is already in progress");
    this.name = "ApplicationReplayInProgressError";
  }
}

class InMemoryApplicationReplayStore implements ApplicationReplayStore {
  readonly #entries = new Map<string, Readonly<
    | { canonicalContent: string; outcome: "Executing"; pending?: Promise<unknown> }
    | { canonicalContent: string; outcome: "Returned"; result: unknown }
    | { canonicalContent: string; outcome: "Threw"; error: unknown }
  >>();

  execute<Result>(
    key: ApplicationReplayKey,
    canonicalContent: string,
    executeNew: () => Result,
  ): Result {
    const serializedKey = canonicalizeJson([key.operation, key.commandId]);
    const existing = this.#entries.get(serializedKey);
    if (existing !== undefined) {
      if (existing.canonicalContent !== canonicalContent) {
        throw new ApplicationIdempotencyConflictError();
      }
      if (existing.outcome === "Executing") {
        throw new ApplicationReplayInProgressError();
      }
      if (existing.outcome === "Threw") {
        throw existing.error;
      }
      return existing.result as Result;
    }
    this.#entries.set(serializedKey, Object.freeze({
      canonicalContent,
      outcome: "Executing",
    }));
    try {
      const result = executeNew();
      this.#entries.set(serializedKey, Object.freeze({
        canonicalContent,
        outcome: "Returned",
        result,
      }));
      return result;
    } catch (error) {
      this.#entries.set(serializedKey, Object.freeze({
        canonicalContent,
        outcome: "Threw",
        error,
      }));
      throw error;
    }
  }

  async executeAsync<Result>(
    key: ApplicationReplayKey,
    canonicalContent: string,
    executeNew: () => Promise<Result>,
  ): Promise<Result> {
    const serializedKey = canonicalizeJson([key.operation, key.commandId]);
    const existing = this.#entries.get(serializedKey);
    if (existing !== undefined) {
      if (existing.canonicalContent !== canonicalContent) {
        throw new ApplicationIdempotencyConflictError();
      }
      if (existing.outcome === "Executing") {
        if (existing.pending === undefined) throw new ApplicationReplayInProgressError();
        return await existing.pending as Result;
      }
      if (existing.outcome === "Threw") {
        throw existing.error;
      }
      return existing.result as Result;
    }
    let resolvePending!: (result: Result) => void;
    let rejectPending!: (error: unknown) => void;
    const pending = new Promise<Result>((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    void pending.catch(() => undefined);
    this.#entries.set(serializedKey, Object.freeze({
      canonicalContent,
      outcome: "Executing",
      pending,
    }));
    try {
      const result = await executeNew();
      this.#entries.set(serializedKey, Object.freeze({
        canonicalContent,
        outcome: "Returned",
        result,
      }));
      resolvePending(result);
      return result;
    } catch (error) {
      this.#entries.set(serializedKey, Object.freeze({
        canonicalContent,
        outcome: "Threw",
        error,
      }));
      rejectPending(error);
      throw error;
    }
  }
}

export function createInMemoryApplicationReplayStore(): ApplicationReplayStore {
  return new InMemoryApplicationReplayStore();
}

export function dispatchReplayProtectedApplicationCommand<Result>(
  requestJson: string,
  replayStore: ApplicationReplayStore,
  checkReadiness: (command: AdmittedApplicationCommand) => void,
  ownerDispatch: (command: AdmittedApplicationCommand) => Result,
): Result {
  const envelope = admitApplicationCommandEnvelope(requestJson);
  const command = Object.freeze({
    ...envelope,
    payload: validateApplicationPayload(
      envelope.definition.operation,
      envelope.payload,
    ),
  });
  return replayStore.execute(
    Object.freeze({
      operation: envelope.definition.operation,
      commandId: envelope.commandId,
    }),
    envelope.canonicalContent,
    () => {
      checkReadiness(command);
      return ownerDispatch(command);
    },
  );
}

function invalidApplicationResult(): never {
  throw new ApplicationResultInvalidError();
}

function requireClosedResultRecord(
  value: unknown,
  fields?: readonly string[],
): Record<string, unknown> {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    return invalidApplicationResult();
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (!ownKeys.every((field): field is string => typeof field === "string")) {
    return invalidApplicationResult();
  }
  const actualFields = [...ownKeys].sort();
  const expectedFields = fields === undefined ? actualFields : [...fields].sort();
  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field, index) => field !== expectedFields[index])
  ) {
    return invalidApplicationResult();
  }
  const entries = actualFields.map((field): [string, unknown] => {
    const descriptor = descriptors[field];
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      return invalidApplicationResult();
    }
    return [field, descriptor.value];
  });
  return Object.freeze(Object.fromEntries(entries));
}

function requireDenseResultArray(value: unknown): readonly unknown[] {
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) return invalidApplicationResult();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (!ownKeys.every((field): field is string => typeof field === "string")) {
    return invalidApplicationResult();
  }
  const descriptorMap = descriptors as unknown as Record<string, PropertyDescriptor>;
  const lengthDescriptor = descriptorMap["length"];
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    (lengthDescriptor.value as number) < 0 ||
    lengthDescriptor.enumerable
  ) return invalidApplicationResult();
  const arrayLength = lengthDescriptor.value as number;
  if (ownKeys.length !== arrayLength + 1 || !ownKeys.includes("length")) {
    return invalidApplicationResult();
  }
  return Object.freeze(Array.from({ length: arrayLength }, (_, index) => {
    const descriptor = descriptorMap[String(index)];
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      return invalidApplicationResult();
    }
    return descriptor.value;
  }));
}

function requireResultUInt(value: unknown): string {
  if (!isUInt(value)) return invalidApplicationResult();
  return value;
}

function compareUInt(left: string, right: string): number {
  return left.length - right.length || (left < right ? -1 : left > right ? 1 : 0);
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0) ?? 0);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0) ?? 0);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function validateResultRecovery(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  const recovery = requireClosedResultRecord(value, [
    "actionId",
    "label",
    "targetOperation",
    "focusTarget",
    "requiresConfirmation",
  ]);
  if (
    !isString(recovery.actionId) ||
    !isString(recovery.label) ||
    !isString(recovery.targetOperation) ||
    !isString(recovery.focusTarget) ||
    typeof recovery.requiresConfirmation !== "boolean"
  ) invalidApplicationResult();
  const expectedRecoveries: Readonly<Record<string, readonly [string, string, string]>> = {
    "retry-job": ["Retry job", "JobRestart", "job-status"],
    "review-job": ["Review job details", "JobGet", "job-details"],
    "review-evidence": ["Review data issue", "EvidenceGet", "evidence-details"],
    "reload-order": ["Reload current order", "PaperOrderGet", "order-details"],
    "review-integrity": ["Review integrity status", "ReadinessGet", "readiness-details"],
    "review-readiness": ["Review readiness details", "ReadinessGet", "readiness-details"],
  };
  const expected = expectedRecoveries[recovery.actionId];
  if (
    expected === undefined ||
    recovery.label !== expected[0] ||
    recovery.targetOperation !== expected[1] ||
    recovery.focusTarget !== expected[2] ||
    recovery.requiresConfirmation !== false
  ) invalidApplicationResult();
  return Object.freeze({ ...recovery });
}

function validateResultError(
  value: unknown,
  expectedMessage?: string,
): Readonly<Record<string, unknown>> {
  const error = requireClosedResultRecord(value, [
    "code",
    "message",
    "boundedIdentifiers",
    "recovery",
  ]);
  if (
    !isString(error.code) ||
    !isString(error.message) ||
    (expectedMessage ?? applicationFailureMessages[error.code]) !== error.message
  ) invalidApplicationResult();
  const identifiers = requireClosedResultRecord(error.boundedIdentifiers);
  const allowedIdentifierFields = new Set([
    "requestId",
    "correlationId",
    "jobId",
    "orderId",
    "evidenceId",
    "datasetId",
    "datasetVersion",
  ]);
  if (
    !Object.entries(identifiers).every(([field, value]) =>
      allowedIdentifierFields.has(field) &&
      isString(value) &&
      boundedIdentifierPattern.test(value)
    )
  ) invalidApplicationResult();
  return Object.freeze({
    code: error.code,
    message: error.message,
    boundedIdentifiers: Object.freeze({ ...identifiers }),
    recovery: validateResultRecovery(error.recovery),
  });
}

function validateWatchlistItem(value: unknown): Readonly<Record<string, unknown>> {
  const item = requireClosedResultRecord(value, [
    "instrumentId",
    "displayName",
    "validationState",
    "position",
  ]);
  if (
    !isString(item.instrumentId) ||
    !isString(item.displayName) ||
    (item.validationState !== "Valid" && item.validationState !== "Invalid") ||
    !isUInt(item.position)
  ) invalidApplicationResult();
  return Object.freeze({ ...item });
}

function validateWatchlistItems(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  const items = requireDenseResultArray(value).map(validateWatchlistItem);
  const identities = items.map((item) => item.instrumentId as string);
  if (new Set(identities).size !== identities.length) invalidApplicationResult();
  return Object.freeze(items.sort((left, right) =>
    compareUInt(left.position as string, right.position as string) ||
    compareCodePoints(left.instrumentId as string, right.instrumentId as string)
  ));
}

function validateJobInputIdentity(
  jobType: unknown,
  value: unknown,
): Readonly<Record<string, unknown>> {
  if (jobType === "FixtureIngestion") {
    const identity = requireClosedResultRecord(value, [
      "datasetId",
      "datasetVersion",
      "fixturePackageHash",
    ]);
    if (
      !isString(identity.datasetId) ||
      !isString(identity.datasetVersion) ||
      typeof identity.fixturePackageHash !== "string" ||
      !sha256Pattern.test(identity.fixturePackageHash)
    ) invalidApplicationResult();
    return Object.freeze({ ...identity });
  }
  if (jobType === "Analytics") {
    const identity = requireClosedResultRecord(value, [
      "evidenceCommandId",
      "asOfDate",
      "configurationHash",
      "inputEvidenceIds",
    ]);
    const inputEvidenceIds = requireDenseResultArray(identity.inputEvidenceIds);
    if (
      !isUuid(identity.evidenceCommandId) ||
      !isCanonicalDate(identity.asOfDate) ||
      typeof identity.configurationHash !== "string" ||
      !sha256Pattern.test(identity.configurationHash) ||
      inputEvidenceIds.length === 0 ||
      !inputEvidenceIds.every(isUuid) ||
      new Set(inputEvidenceIds).size !== inputEvidenceIds.length
    ) invalidApplicationResult();
    return Object.freeze({
      ...identity,
      inputEvidenceIds: Object.freeze([...inputEvidenceIds].sort(compareCodePoints)),
    });
  }
  return invalidApplicationResult();
}

function validateJobCheckpoint(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  const checkpoint = requireClosedResultRecord(value, [
    "checkpointId",
    "attempt",
    "sequence",
    "committedAt",
    "contentHash",
  ]);
  if (
    !isUuid(checkpoint.checkpointId) ||
    !isUInt(checkpoint.attempt) ||
    !isUInt(checkpoint.sequence) ||
    !isUtcInstant(checkpoint.committedAt) ||
    typeof checkpoint.contentHash !== "string" ||
    !sha256Pattern.test(checkpoint.contentHash)
  ) invalidApplicationResult();
  return Object.freeze({ ...checkpoint });
}

function validateJob(value: unknown): Readonly<Record<string, unknown>> {
  const job = requireClosedResultRecord(value, [
    "jobId", "jobType", "status", "restartability", "attempt", "operation",
    "originalCommandId", "inputIdentity", "createdAt", "startedAt", "completedAt",
    "checkpoint", "acceptedCount", "rejectedCount", "controllingError",
  ]);
  if (
    !isUuid(job.jobId) ||
    (job.jobType !== "FixtureIngestion" && job.jobType !== "Analytics") ||
    !["Pending", "Running", "Succeeded", "Failed"].includes(job.status as string) ||
    (job.restartability !== "Restartable" && job.restartability !== "NotRestartable") ||
    !isUInt(job.attempt) ||
    job.attempt === "0" ||
    (job.operation !== "FixtureIngestionStart" && job.operation !== "AnalyticsRun") ||
    !isUuid(job.originalCommandId) ||
    !isUtcInstant(job.createdAt) ||
    (job.startedAt !== null && !isUtcInstant(job.startedAt)) ||
    (job.completedAt !== null && !isUtcInstant(job.completedAt)) ||
    !isUInt(job.acceptedCount) ||
    !isUInt(job.rejectedCount) ||
    (job.jobType === "FixtureIngestion" && job.operation !== "FixtureIngestionStart") ||
    (job.jobType === "Analytics" && job.operation !== "AnalyticsRun") ||
    (job.status === "Pending" &&
      (job.startedAt !== null || job.completedAt !== null || job.controllingError !== null)) ||
    (job.status === "Running" &&
      (job.startedAt === null || job.completedAt !== null || job.controllingError !== null)) ||
    (job.status === "Succeeded" &&
      (job.startedAt === null || job.completedAt === null || job.controllingError !== null)) ||
    (job.status === "Failed" &&
      (job.completedAt === null || job.controllingError === null))
  ) invalidApplicationResult();
  const checkpoint = validateJobCheckpoint(job.checkpoint);
  if (
    checkpoint !== null &&
    compareUInt(checkpoint.attempt as string, job.attempt) > 0
  ) invalidApplicationResult();
  const controllingError = job.controllingError === null
    ? null
    : validateResultError(job.controllingError);
  if (
    controllingError !== null &&
    ((job.restartability === "Restartable" &&
      (controllingError.recovery as Record<string, unknown> | null)?.actionId !== "retry-job") ||
      (job.restartability === "NotRestartable" &&
        (controllingError.recovery as Record<string, unknown> | null)?.actionId !== "review-job"))
  ) invalidApplicationResult();
  return Object.freeze({
    ...job,
    inputIdentity: validateJobInputIdentity(job.jobType, job.inputIdentity),
    checkpoint,
    controllingError,
  });
}

function validateReadiness(value: unknown): Readonly<Record<string, unknown>> {
  const readiness = requireClosedResultRecord(value, [
    "state", "checkedAt", "displayTimezone", "liveness", "dependencies", "controllingError",
  ]);
  if (
    (readiness.state !== "Ready" && readiness.state !== "NotReady") ||
    !isUtcInstant(readiness.checkedAt) ||
    readiness.displayTimezone !== "UTC" ||
    (readiness.liveness !== "Live" && readiness.liveness !== "NotLive") ||
    (readiness.state === "Ready") !== (readiness.controllingError === null)
  ) invalidApplicationResult();
  const dependencies = requireDenseResultArray(readiness.dependencies).map((value) => {
    const dependency = requireClosedResultRecord(
      value,
      ["dependency", "state", "checkedAt", "code"],
    );
    if (
      !readinessDependencyNames.includes(dependency.dependency as ReadinessDependencyName) ||
      (dependency.state !== "Ready" && dependency.state !== "NotReady") ||
      !isUtcInstant(dependency.checkedAt) ||
      (dependency.code !== null && !isString(dependency.code)) ||
      (dependency.state === "Ready") !== (dependency.code === null)
    ) invalidApplicationResult();
    const expectedCodes: Readonly<Record<ReadinessDependencyName, string>> = {
      PostgreSQL: "APPLICATION_DATABASE_UNAVAILABLE",
      Migrations: "APPLICATION_MIGRATIONS_INCOMPLETE",
      FixturePolicy: "APPLICATION_CONFIGURATION_INVALID",
      LocalDependency: "APPLICATION_DEPENDENCY_UNAVAILABLE",
      DenialAudit: "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
      LedgerIntegrity: "LEDGER_INTEGRITY_FAILED",
    };
    if (
      dependency.state === "NotReady" &&
      dependency.code !== expectedCodes[dependency.dependency as ReadinessDependencyName]
    ) invalidApplicationResult();
    return Object.freeze({ ...dependency });
  });
  if (
    dependencies.length !== readinessDependencyNames.length ||
    new Set(dependencies.map((item) => item.dependency)).size !== dependencies.length ||
    (readiness.state === "Ready") !==
      dependencies.every((dependency) => dependency.state === "Ready")
  ) invalidApplicationResult();
  dependencies.sort((left, right) =>
    readinessDependencyNames.indexOf(left.dependency as ReadinessDependencyName) -
    readinessDependencyNames.indexOf(right.dependency as ReadinessDependencyName)
  );
  const controllingError = readiness.controllingError === null
    ? null
    : validateResultError(
      readiness.controllingError,
      "Application readiness is blocked. Review readiness details.",
    );
  const firstFailedDependency = dependencies.find(
    (dependency) => dependency.state === "NotReady",
  );
  if (
    (controllingError === null) !== (firstFailedDependency === undefined) ||
    (controllingError !== null &&
      controllingError.code !== firstFailedDependency?.code) ||
    (controllingError !== null &&
      (controllingError.recovery as Record<string, unknown> | null)?.actionId !==
        "review-readiness")
  ) invalidApplicationResult();
  return Object.freeze({
    ...readiness,
    dependencies: Object.freeze(dependencies),
    controllingError,
  });
}

function validateResultConfirmation(value: unknown): Readonly<Record<string, unknown>> | null {
  if (value === null) return null;
  const confirmation = requireClosedResultRecord(
    value,
    ["actorId", "confirmedAt", "confirmationText"],
  );
  if (
    confirmation.actorId !== "local-user" ||
    !isUtcInstant(confirmation.confirmedAt) ||
    !isString(confirmation.confirmationText)
  ) invalidApplicationResult();
  return Object.freeze({ ...confirmation });
}

const orderStates = new Set([
  "Draft", "Submitted", "Accepted", "Partial", "Filled", "Rejected", "Canceled", "Expired",
]);
const orderTransitions = new Set([
  "OT-01", "OT-02", "OT-03", "OT-04", "OT-05", "OT-06", "OT-07", "OT-08", "OT-09", "OT-10",
]);
const orderTransitionRows = Object.freeze({
  "OT-01": Object.freeze({ sourceState: "Initial", targetState: "Draft", trigger: "UserCreatedFromResearch" }),
  "OT-02": Object.freeze({ sourceState: "Draft", targetState: "Submitted", trigger: "UserConfirmedPaperAction" }),
  "OT-03": Object.freeze({ sourceState: "Submitted", targetState: "Accepted", trigger: "PortfolioValidationPassed" }),
  "OT-04": Object.freeze({ sourceState: "Submitted", targetState: "Rejected", trigger: "PortfolioValidationFailed" }),
  "OT-05": Object.freeze({ sourceState: "Accepted", targetState: "Partial", trigger: "LocalPartialFillSimulated" }),
  "OT-06": Object.freeze({ sourceState: "Accepted", targetState: "Filled", trigger: "LocalCompleteFillSimulated" }),
  "OT-07": Object.freeze({ sourceState: "Accepted", targetState: "Canceled", trigger: "UserCanceledOpenQuantity" }),
  "OT-08": Object.freeze({ sourceState: "Accepted", targetState: "Expired", trigger: "DeterministicExpiryReached" }),
  "OT-09": Object.freeze({ sourceState: "Partial", targetState: "Filled", trigger: "LocalRemainderFillSimulated" }),
  "OT-10": Object.freeze({ sourceState: "Partial", targetState: "Canceled", trigger: "UserCanceledRemainingQuantity" }),
});

function validateOrderTransitionRecord(value: unknown): Readonly<Record<string, unknown>> {
  const transition = requireClosedResultRecord(value, [
    "transitionCommandId", "transition", "sourceState", "targetState", "trigger",
    "occurredAt", "actorId", "correlationId", "priorVersion", "resultingVersion", "baselineVersion",
  ]);
  const row = orderTransitionRows[transition.transition as keyof typeof orderTransitionRows];
  if (
    !isUuid(transition.transitionCommandId) ||
    !orderTransitions.has(transition.transition as string) ||
    (transition.sourceState !== "Initial" && !orderStates.has(transition.sourceState as string)) ||
    !orderStates.has(transition.targetState as string) ||
    !isString(transition.trigger) ||
    !isUtcInstant(transition.occurredAt) ||
    transition.actorId !== "local-user" ||
    !isUuid(transition.correlationId) ||
    !isUInt(transition.priorVersion) ||
    !isUInt(transition.resultingVersion) ||
    transition.baselineVersion !== "v1.0.0" ||
    row === undefined ||
    transition.sourceState !== row.sourceState ||
    transition.targetState !== row.targetState ||
    transition.trigger !== row.trigger
  ) invalidApplicationResult();
  return Object.freeze({ ...transition });
}

function validatePaperOrder(value: unknown): Readonly<Record<string, unknown>> {
  const order = requireClosedResultRecord(value, [
    "orderId", "instrumentId", "state", "aggregateVersion", "researchEvidenceId", "side",
    "requestedQuantity", "filledQuantity", "openQuantity", "unitPrice", "tradeDate",
    "confirmation", "transitionHistory",
  ]);
  if (
    !isUuid(order.orderId) ||
    !isString(order.instrumentId) ||
    !orderStates.has(order.state as string) ||
    !isUInt(order.aggregateVersion) ||
    !isUuid(order.researchEvidenceId) ||
    (order.side !== "Buy" && order.side !== "Sell") ||
    !isScale10(order.requestedQuantity) ||
    !isScale10(order.filledQuantity) ||
    !isScale10(order.openQuantity) ||
    !isScale10(order.unitPrice) ||
    !isCanonicalDate(order.tradeDate)
  ) invalidApplicationResult();
  const transitionHistory = requireDenseResultArray(order.transitionHistory)
    .map(validateOrderTransitionRecord)
    .sort((left, right) =>
      compareUInt(left.resultingVersion as string, right.resultingVersion as string) ||
      compareCodePoints(left.transitionCommandId as string, right.transitionCommandId as string)
    );
  return Object.freeze({
    ...order,
    confirmation: validateResultConfirmation(order.confirmation),
    transitionHistory: Object.freeze(transitionHistory),
  });
}

function validateDiagnosticExport(value: unknown): Readonly<Record<string, unknown>> {
  const diagnosticExport = requireClosedResultRecord(value, [
    "exportId", "createdAt", "codes", "itemCount", "contentHash",
  ]);
  const codes = requireDenseResultArray(diagnosticExport.codes);
  if (
    !isUuid(diagnosticExport.exportId) ||
    !isUtcInstant(diagnosticExport.createdAt) ||
    codes.length === 0 ||
    !codes.every((code) =>
      typeof code === "string" && stableCodePattern.test(code)
    ) ||
    new Set(codes).size !== codes.length ||
    !isUInt(diagnosticExport.itemCount) ||
    typeof diagnosticExport.contentHash !== "string" ||
    !sha256Pattern.test(diagnosticExport.contentHash)
  ) invalidApplicationResult();
  return Object.freeze({
    ...diagnosticExport,
    codes: Object.freeze([...(codes as string[])].sort(compareCodePoints)),
  });
}

function validatePortfolioLot(value: unknown): Readonly<Record<string, unknown>> {
  const lot = requireClosedResultRecord(value, [
    "lotId", "instrumentId", "acquiredAt", "ledgerSequence", "openQuantity", "openBasis",
  ]);
  if (
    !isUuid(lot.lotId) || !isString(lot.instrumentId) || !isUtcInstant(lot.acquiredAt) ||
    !isUInt(lot.ledgerSequence) || !isScale10(lot.openQuantity) || !isSignedScale8(lot.openBasis)
  ) invalidApplicationResult();
  return Object.freeze({ ...lot });
}

function validatePortfolioPosition(value: unknown): Readonly<Record<string, unknown>> {
  const position = requireClosedResultRecord(value, [
    "instrumentId", "quantity", "basis", "valuation", "unrealizedPnL",
  ]);
  if (
    !isString(position.instrumentId) || !isScale10(position.quantity) ||
    !isSignedScale8(position.basis) || !isSignedScale8(position.valuation) ||
    !isSignedScale8(position.unrealizedPnL)
  ) invalidApplicationResult();
  return Object.freeze({ ...position });
}

function validatePortfolio(value: unknown): Readonly<Record<string, unknown>> {
  const portfolio = requireClosedResultRecord(value, [
    "portfolioId", "portfolioVersion", "asOf", "valuationSnapshotId",
    "precisionPolicyVersion", "baselineVersion", "cash", "lots", "positions",
    "realizedPnL", "totalEquity", "reconciliationState",
  ]);
  if (
    !isUuid(portfolio.portfolioId) || !isUInt(portfolio.portfolioVersion) ||
    !isUtcInstant(portfolio.asOf) || !isUuid(portfolio.valuationSnapshotId) ||
    portfolio.precisionPolicyVersion !== "DEC-014" || portfolio.baselineVersion !== "v1.0.0" ||
    !isSignedScale8(portfolio.cash) || !isSignedScale8(portfolio.realizedPnL) ||
    !isSignedScale8(portfolio.totalEquity) ||
    (portfolio.reconciliationState !== "Reconciled" && portfolio.reconciliationState !== "IntegrityBlocked")
  ) invalidApplicationResult();
  const lots = requireDenseResultArray(portfolio.lots).map(validatePortfolioLot).sort((left, right) =>
    compareCodePoints(left.acquiredAt as string, right.acquiredAt as string) ||
    compareUInt(left.ledgerSequence as string, right.ledgerSequence as string) ||
    compareCodePoints(left.lotId as string, right.lotId as string)
  );
  const positions = requireDenseResultArray(portfolio.positions).map(validatePortfolioPosition).sort((left, right) =>
    compareCodePoints(left.instrumentId as string, right.instrumentId as string)
  );
  if (
    new Set(lots.map((lot) => lot.lotId)).size !== lots.length ||
    new Set(positions.map((position) => position.instrumentId)).size !== positions.length ||
    portfolio.reconciliationState === "IntegrityBlocked" &&
    (lots.length !== 0 ||
      positions.length !== 0 ||
      portfolio.cash !== "0.00000000" ||
      portfolio.realizedPnL !== "0.00000000" ||
      portfolio.totalEquity !== "0.00000000")
  ) invalidApplicationResult();
  return Object.freeze({
    ...portfolio,
    lots: Object.freeze(lots),
    positions: Object.freeze(positions),
  });
}

function requireOpaqueOwnerRecord(
  value: unknown,
  fields: readonly string[],
): Readonly<Record<string, unknown>> {
  try {
    if (isClosedFrozenJsonRecord(value, fields)) return value;
  } catch {
    return invalidApplicationResult();
  }
  return invalidApplicationResult();
}

function isClosedFrozenJsonRecord(
  value: unknown,
  fields: readonly string[],
): value is Readonly<Record<string, unknown>> {
  if (
    value === null || Array.isArray(value) || typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(descriptors);
  if (!ownKeys.every((field): field is string => typeof field === "string")) return false;
  const actualFields = ownKeys.sort();
  const expectedFields = [...fields].sort();
  return actualFields.length === expectedFields.length &&
    actualFields.every((field, index) => field === expectedFields[index]) &&
    isRecursivelyFrozenJson(value);
}

function isRecursivelyFrozenJson(
  value: unknown,
  activeObjects = new WeakSet<object>(),
): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value !== "object" || utilTypes.isProxy(value) || !Object.isFrozen(value)) return false;
  if (activeObjects.has(value)) {
    return false;
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (!ownKeys.every((field): field is string => typeof field === "string")) return false;
    const descriptorMap = descriptors as unknown as Record<string, PropertyDescriptor>;
    const lengthDescriptor = descriptorMap["length"];
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      (lengthDescriptor.value as number) < 0 ||
      lengthDescriptor.enumerable
    ) return false;
    const arrayLength = lengthDescriptor.value as number;
    if (
      ownKeys.length !== arrayLength + 1 ||
      !ownKeys.includes("length")
    ) return false;
    activeObjects.add(value);
    const recursivelyFrozen = Array.from({ length: arrayLength }, (_, index) => {
      const descriptor = descriptors[String(index)];
      return descriptor !== undefined && "value" in descriptor && descriptor.enumerable &&
        isRecursivelyFrozenJson(descriptor.value, activeObjects);
    }).every(Boolean);
    activeObjects.delete(value);
    return recursivelyFrozen;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  activeObjects.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const recursivelyFrozen = Reflect.ownKeys(descriptors).every((field) => {
    if (typeof field !== "string") return false;
    const descriptor = descriptors[field];
    return descriptor !== undefined && "value" in descriptor && descriptor.enumerable &&
      isRecursivelyFrozenJson(descriptor.value, activeObjects);
  });
  activeObjects.delete(value);
  return recursivelyFrozen;
}

function validateAnalyticsResult(value: unknown): Readonly<Record<string, unknown>> {
  const result = requireOpaqueOwnerRecord(value, [
    "configurationHash", "domain", "metrics", "resultSchemaVersion",
    "signals", "trades", "warnings",
  ]);
  if (
    result.domain !== "etf.analytics.result.v1" ||
    result.resultSchemaVersion !== "1.0.0" ||
    !isString(result.configurationHash) ||
    !sha256Pattern.test(result.configurationHash) ||
    !Array.isArray(result.signals) ||
    !Array.isArray(result.trades) ||
    !Array.isArray(result.metrics) ||
    !Array.isArray(result.warnings)
  ) invalidApplicationResult();
  return result;
}

function validateEvidence(value: unknown): Readonly<Record<string, unknown>> {
  const evidence = requireOpaqueOwnerRecord(value, [
    "assumptions", "baselineVersion", "benchmark", "bundleHash", "codeHash",
    "configurationHash", "domain", "environment", "evaluationAt", "evidenceId",
    "evidenceSchemaVersion", "inputHash", "inputSetId", "parameters",
    "providerPolicyReferences", "reproducibilityReason", "reproducibilityStatus",
    "result", "resultHash", "retentionEpoch", "retentionPolicyVersion", "ruleId",
    "ruleVersion", "seed",
  ]);
  if (
    evidence.domain !== "etf.analytics.bundle.v1" ||
    evidence.evidenceSchemaVersion !== "1.0.0" ||
    evidence.baselineVersion !== "v1.0.0" ||
    !isString(evidence.evidenceId) ||
    !isString(evidence.inputSetId) ||
    !isUtcInstant(evidence.evaluationAt) ||
    !isUtcInstant(evidence.retentionEpoch) ||
    !isString(evidence.codeHash) || !sha256Pattern.test(evidence.codeHash) ||
    !isString(evidence.inputHash) || !sha256Pattern.test(evidence.inputHash) ||
    !isString(evidence.configurationHash) || !sha256Pattern.test(evidence.configurationHash) ||
    !isString(evidence.resultHash) || !sha256Pattern.test(evidence.resultHash) ||
    !isString(evidence.bundleHash) || !sha256Pattern.test(evidence.bundleHash) ||
    evidence.reproducibilityStatus !== "Complete" ||
    evidence.reproducibilityReason !== null
  ) invalidApplicationResult();
  const result = validateAnalyticsResult(evidence.result);
  if (result.configurationHash !== evidence.configurationHash) invalidApplicationResult();
  return evidence;
}

export function validateApplicationSuccessData(
  operation: string,
  value: unknown,
): Readonly<Record<string, unknown>> {
  const definition = resolveApplicationOperation(operation);
  let data: Record<string, unknown>;
  switch (definition.operation) {
    case "WatchlistPut":
      data = requireClosedResultRecord(value, ["item", "version"]);
      return Object.freeze({ item: validateWatchlistItem(data.item), version: requireResultUInt(data.version) });
    case "WatchlistRemove":
      data = requireClosedResultRecord(value, ["version"]);
      return Object.freeze({ version: requireResultUInt(data.version) });
    case "WatchlistReorder":
    case "WatchlistGet":
      data = requireClosedResultRecord(value, ["orderedItems", "version"]);
      return Object.freeze({ orderedItems: validateWatchlistItems(data.orderedItems), version: requireResultUInt(data.version) });
    case "FixtureIngestionStart":
    case "JobRestart":
    case "AnalyticsRun":
    case "JobGet":
      data = requireClosedResultRecord(value, ["job"]);
      return Object.freeze({ job: validateJob(data.job) });
    case "PaperOrderDraftCreate":
    case "PaperOrderTransition":
    case "PaperOrderGet":
      data = requireClosedResultRecord(value, ["order"]);
      return Object.freeze({ order: validatePaperOrder(data.order) });
    case "DiagnosticsExportCreate":
      data = requireClosedResultRecord(value, ["export"]);
      return Object.freeze({ export: validateDiagnosticExport(data.export) });
    case "ReadinessGet":
      data = requireClosedResultRecord(value, ["readiness"]);
      return Object.freeze({ readiness: validateReadiness(data.readiness) });
    case "AnalyticsResultGet":
      data = requireClosedResultRecord(value, ["result"]);
      return Object.freeze({ result: validateAnalyticsResult(data.result) });
    case "EvidenceGet":
      data = requireClosedResultRecord(value, ["evidence"]);
      return Object.freeze({ evidence: validateEvidence(data.evidence) });
    case "PortfolioGet":
      data = requireClosedResultRecord(value, ["portfolio"]);
      return Object.freeze({ portfolio: validatePortfolio(data.portfolio) });
  }
}

export function dispatchValidatedApplicationOperation(
  operation: string,
  payloadJson: string,
  ownerDispatch: (
    definition: ApplicationOperationDefinition,
    payload: Readonly<Record<string, unknown>>,
  ) => unknown,
): Readonly<Record<string, unknown>> {
  return dispatchValidatedApplicationRequest(
    operation,
    payloadJson,
    (definition, payload) =>
      validateApplicationSuccessData(
        definition.operation,
        ownerDispatch(definition, payload),
      ),
  );
}

export function displayVerifiedResearch<Result>(
  research: CompleteVerifiedResearch<Result>,
): Result {
  return research.result;
}

const ownerFailureMessages: Readonly<Record<OwnerFailureCode, string>> =
  Object.freeze({
    ORDER_INVALID_TRANSITION: "The paper order transition is not allowed.",
    ORDER_GUARD_FAILED: "The paper order transition guard failed.",
    ORDER_TERMINAL_STATE: "The paper order is already in a terminal state.",
    ORDER_NOT_FOUND: "The paper order was not found.",
    ORDER_VERSION_CONFLICT:
      "The paper order changed. Reload the current order before retrying.",
    FIXTURE_REQUIRED_QUARANTINED: "Required fixture data is quarantined.",
    ANALYTICS_INPUT_INCOMPLETE: "Required analytical input is incomplete.",
    ANALYTICS_INPUT_STALE: "Required analytical input is stale.",
    ANALYTICS_INPUT_QUARANTINED: "Required analytical input is quarantined.",
    ANALYTICS_AMBIGUOUS_VINTAGE: "The analytical input vintage is ambiguous.",
    ANALYTICS_AMBIGUOUS_MARKET_REVISION:
      "The analytical market revision is ambiguous.",
    ANALYTICS_RIGHTS_RESTRICTED:
      "Provider rights do not permit the required analytical evidence.",
    ANALYTICS_INTEGRITY_FAILED:
      "Analytical evidence failed integrity verification.",
    ANALYTICS_EVIDENCE_ACCESS_DENIED: "Access to analytical evidence is denied.",
    ANALYTICS_PUBLICATION_BLOCKED: "Analytical publication is blocked.",
    ANALYTICS_NUMERIC_CLASS_INVALID: "An analytical numeric value is invalid.",
    ANALYTICS_CAPACITY_BLOCKED: "Analytical evidence capacity is exhausted.",
    ANALYTICS_EVIDENCE_COMMIT_FAILED: "Analytical evidence could not be committed.",
    ANALYTICS_DETERMINISM_FAILED: "Analytical reproducibility verification failed.",
    ANALYTICS_IDEMPOTENCY_CONFLICT:
      "The analytical evidence identity was reused with different content.",
    ANALYTICS_PUBLICATION_VERSION_CONFLICT:
      "The analytical publication changed before completion.",
    APPLICATION_REQUEST_INVALID: "The application request is invalid.",
    APPLICATION_IDEMPOTENCY_CONFLICT:
      "The application command identity was reused with different content.",
    APPLICATION_JOB_NOT_RESTARTABLE: "The job cannot be restarted.",
    APPLICATION_REDACTION_FAILED:
      "Safe diagnostic redaction could not be verified.",
    ORDER_IDEMPOTENCY_CONFLICT:
      "The paper order command identity was reused with different content.",
    FIXTURE_IDEMPOTENCY_CONFLICT:
      "The fixture identity was reused with different content.",
    ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED:
      "The analytics access denial could not be recorded.",
    LEDGER_VERSION_CONFLICT:
      "The ledger changed. Reload the current portfolio before retrying.",
    LEDGER_INTEGRITY_FAILED: "Ledger integrity verification failed.",
  });
const emptyBoundedIdentifiers = Object.freeze({});

export function presentOwnerFailure(
  code: OwnerFailureCode,
): OwnerFailurePresentation {
  return Object.freeze({
    code,
    message: ownerFailureMessages[code],
    boundedIdentifiers: emptyBoundedIdentifiers,
    recovery: null,
  });
}

const applicationFailureMessages: Readonly<Record<string, string>> = Object.freeze({
  ...ownerFailureMessages,
  FIXTURE_REQUIRED_INPUT_MISSING: "Required fixture input is missing.",
  APPLICATION_OPERATION_UNKNOWN: "Application operation is unknown.",
  APPLICATION_UNAUTHORIZED: "The local actor is not authorized for the application operation.",
  APPLICATION_JOB_NOT_FOUND: "The requested job was not found.",
  APPLICATION_DATABASE_UNAVAILABLE: "Application readiness is blocked. Review readiness details.",
  APPLICATION_MIGRATIONS_INCOMPLETE: "Required database migrations are incomplete.",
  APPLICATION_CONFIGURATION_INVALID: "Required application configuration is invalid.",
  APPLICATION_DEPENDENCY_UNAVAILABLE: "A required local dependency is unavailable.",
  APPLICATION_PERSISTENCE_FAILED: "Application persistence failed.",
  APPLICATION_RESULT_INVALID: "The application result is invalid.",
});

const queryEnvelopeFields = Object.freeze([
  "operation",
  "requestId",
  "correlationId",
  "actorId",
  "prototypeCandidate",
  "contractVersion",
  "requestedAt",
  "payload",
]);

interface AdmittedApplicationQuery {
  readonly definition: ApplicationOperationDefinition & {
    readonly operation: ApplicationQueryOperation;
    readonly kind: "query";
  };
  readonly requestId: string;
  readonly correlationId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

function admitApplicationQueryEnvelope(requestJson: string): AdmittedApplicationQuery {
  const request = parseApplicationPayload(requestJson);
  if (!isString(request.operation)) throw new ApplicationOperationUnknownError();
  const definition = resolveApplicationOperation(request.operation);
  if (definition.kind !== "query") throw new ApplicationRequestInvalidError();
  const envelope = requireClosedRecord(request, queryEnvelopeFields);
  if (
    !isUuid(envelope.requestId) ||
    !isUuid(envelope.correlationId) ||
    envelope.prototypeCandidate !== "v1.0.0-prototype.1" ||
    envelope.contractVersion !== "1.0.0-candidate.2" ||
    !isUtcInstant(envelope.requestedAt) ||
    !isPlainRecord(envelope.payload)
  ) throw new ApplicationRequestInvalidError();
  if (envelope.actorId !== "local-user") {
    throw new ApplicationUnauthorizedError(envelope.requestId);
  }
  return Object.freeze({
    definition: definition as AdmittedApplicationQuery["definition"],
    requestId: envelope.requestId,
    correlationId: envelope.correlationId,
    payload: validateApplicationPayload(definition.operation, envelope.payload),
  });
}

function requiresResearchWarning(operation: ApplicationOperation): boolean {
  return operation === "AnalyticsRun" ||
    operation === "AnalyticsResultGet" ||
    operation === "EvidenceGet" ||
    operation === "PaperOrderDraftCreate" ||
    operation === "PaperOrderTransition" ||
    operation === "PaperOrderGet";
}

function createApplicationResultPresentation(
  operation: ApplicationOperation | null,
  outcome: "Succeeded" | "Failed",
): Readonly<ApplicationResultPresentation> {
  const warningRequired = operation !== null && requiresResearchWarning(operation);
  return Object.freeze({
    statusText: outcome,
    announcement: outcome === "Succeeded" ? "None" : "AssertiveAlert",
    warningText: warningRequired
      ? researchWarningText
      : null,
    researchWarningRequired: warningRequired,
  });
}

function completeApplicationSuccess(
  definition: ApplicationOperationDefinition,
  requestId: string,
  correlationId: string,
  data: Readonly<Record<string, unknown>>,
  completedAt: () => string,
): Readonly<Record<string, unknown>> {
  const completion = completedAt();
  if (!isUtcInstant(completion)) invalidApplicationResult();
  return Object.freeze({
    operation: definition.operation,
    requestId,
    correlationId,
    outcome: "Succeeded",
    completedAt: completion,
    data,
    warnings: Object.freeze([]),
    presentation: createApplicationResultPresentation(definition.operation, "Succeeded"),
  });
}

function completeApplicationFailure(
  operation: ApplicationOperation | null,
  requestId: string | null,
  correlationId: string | null,
  error: unknown,
  phase: ApplicationValidationPhase,
  completedAt: () => string,
): Readonly<Record<string, unknown>> {
  const completion = completedAt();
  if (!isUtcInstant(completion)) invalidApplicationResult();
  let suppliedCode: string | null = null;
  try {
    if (error !== null && (typeof error === "object" || typeof error === "function")) {
      const descriptor = Object.getOwnPropertyDescriptor(error, "code");
      if (descriptor !== undefined && "value" in descriptor && isString(descriptor.value)) {
        suppliedCode = descriptor.value;
      }
    }
  } catch {
    suppliedCode = null;
  }
  const code = phase === "Result" && error instanceof ApplicationResultInvalidError
    ? "APPLICATION_REDACTION_FAILED"
    : suppliedCode !== null &&
      applicationCodesByPhase[phase].has(suppliedCode) &&
      suppliedCode in applicationFailureMessages
    ? suppliedCode
    : "APPLICATION_DEPENDENCY_UNAVAILABLE";
  return Object.freeze({
    operation,
    requestId,
    correlationId,
    outcome: "Failed",
    completedAt: completion,
    error: Object.freeze({
      code,
      message: applicationFailureMessages[code]!,
      boundedIdentifiers: emptyBoundedIdentifiers,
      recovery: null,
    }),
    warnings: Object.freeze([]),
    presentation: createApplicationResultPresentation(operation, "Failed"),
  });
}

function applicationFailurePhase(error: unknown): ApplicationValidationPhase {
  if (error instanceof ApplicationOperationUnknownError) return "Operation";
  if (error instanceof ApplicationRequestInvalidError) return "Request";
  if (error instanceof ApplicationUnauthorizedError) return "Authorization";
  if (error instanceof ApplicationIdempotencyConflictError) return "Replay";
  return "Admission";
}

function ownerFailurePhase(error: unknown): "Authorization" | "Owner" {
  if (error !== null && typeof error === "object") {
    const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
    if (code === "APPLICATION_UNAUTHORIZED") return "Authorization";
  }
  return "Owner";
}

function readApplicationResultIdentity(requestJson: string): Readonly<{
  operation: ApplicationOperation | null;
  requestId: string | null;
  correlationId: string | null;
}> {
  try {
    const request = parseApplicationPayload(requestJson);
    return Object.freeze({
      operation: isString(request.operation) && operationDefinitions.has(request.operation)
        ? request.operation as ApplicationOperation
        : null,
      requestId: isUuid(request.requestId) ? request.requestId : null,
      correlationId: isUuid(request.correlationId) ? request.correlationId : null,
    });
  } catch {
    return Object.freeze({ operation: null, requestId: null, correlationId: null });
  }
}

export function executeApplicationRequest(
  requestJson: string,
  dependencies: ApplicationRequestDependencies,
): Readonly<Record<string, unknown>> {
  const identity = readApplicationResultIdentity(requestJson);
  if (identity.operation !== null && applicationQueryOperations.includes(
    identity.operation as ApplicationQueryOperation,
  )) {
    let query: AdmittedApplicationQuery;
    try {
      query = admitApplicationQueryEnvelope(requestJson);
    } catch (error) {
      return completeApplicationFailure(
        identity.operation,
        identity.requestId,
        identity.correlationId,
        error,
        applicationFailurePhase(error),
        dependencies.completedAt,
      );
    }
    try {
      dependencies.checkReadiness(query.definition, query.payload);
    } catch (error) {
      return completeApplicationFailure(
        query.definition.operation, query.requestId, query.correlationId,
        error, "Admission", dependencies.completedAt,
      );
    }
    let ownerResult: unknown;
    try {
      ownerResult = dependencies.ownerDispatch(query.definition, query.payload);
    } catch (error) {
      return completeApplicationFailure(
        query.definition.operation, query.requestId, query.correlationId,
        error, ownerFailurePhase(error), dependencies.completedAt,
      );
    }
    let data: Readonly<Record<string, unknown>>;
    try {
      data = validateApplicationSuccessData(query.definition.operation, ownerResult);
    } catch (error) {
      return completeApplicationFailure(
        query.definition.operation, query.requestId, query.correlationId,
        error, "Result", dependencies.completedAt,
      );
    }
    return completeApplicationSuccess(
      query.definition, query.requestId, query.correlationId, data,
      dependencies.completedAt,
    );
  }

  let command: ApplicationCommandEnvelope;
  try {
    command = admitApplicationCommandEnvelope(requestJson);
  } catch (error) {
    return completeApplicationFailure(
      identity.operation, identity.requestId, identity.correlationId,
      error, applicationFailurePhase(error), dependencies.completedAt,
    );
  }
  let payload: Readonly<Record<string, unknown>>;
  try {
    payload = validateApplicationPayload(command.definition.operation, command.payload);
  } catch (error) {
    return completeApplicationFailure(
      command.definition.operation, command.requestId, command.correlationId,
      error, "Request", dependencies.completedAt,
    );
  }
  try {
    return dependencies.replayStore.execute(
      Object.freeze({
        operation: command.definition.operation,
        commandId: command.commandId,
      }),
      command.canonicalContent,
      () => {
        try {
          dependencies.checkReadiness(command.definition, payload);
        } catch (error) {
          return completeApplicationFailure(
            command.definition.operation, command.requestId, command.correlationId,
            error, "Admission", dependencies.completedAt,
          );
        }
        let ownerResult: unknown;
        try {
          ownerResult = dependencies.ownerDispatch(
            command.definition,
            payload,
            Object.freeze({
              commandId: command.commandId,
              correlationId: command.correlationId,
              requestedAt: command.requestedAt,
            }),
          );
        } catch (error) {
          return completeApplicationFailure(
            command.definition.operation, command.requestId, command.correlationId,
            error, ownerFailurePhase(error), dependencies.completedAt,
          );
        }
        let data: Readonly<Record<string, unknown>>;
        try {
          data = validateApplicationSuccessData(command.definition.operation, ownerResult);
        } catch (error) {
          return completeApplicationFailure(
            command.definition.operation, command.requestId, command.correlationId,
            error, "Result", dependencies.completedAt,
          );
        }
        return completeApplicationSuccess(
          command.definition, command.requestId, command.correlationId, data,
          dependencies.completedAt,
        );
      },
    );
  } catch (error) {
    if (error instanceof ApplicationResultInvalidError) throw error;
    return completeApplicationFailure(
      command.definition.operation, command.requestId, command.correlationId,
      error, "Replay", dependencies.completedAt,
    );
  }
}

export async function executeApplicationRequestAsync(
  requestJson: string,
  dependencies: AsyncApplicationRequestDependencies,
): Promise<Readonly<Record<string, unknown>>> {
  const identity = readApplicationResultIdentity(requestJson);
  if (identity.operation !== null && applicationQueryOperations.includes(
    identity.operation as ApplicationQueryOperation,
  )) {
    let query: AdmittedApplicationQuery;
    try {
      query = admitApplicationQueryEnvelope(requestJson);
    } catch (error) {
      return completeApplicationFailure(
        identity.operation,
        identity.requestId,
        identity.correlationId,
        error,
        applicationFailurePhase(error),
        dependencies.completedAt,
      );
    }
    try {
      await dependencies.checkReadiness(query.definition, query.payload);
    } catch (error) {
      return completeApplicationFailure(
        query.definition.operation, query.requestId, query.correlationId,
        error, "Admission", dependencies.completedAt,
      );
    }
    let ownerResult: unknown;
    try {
      ownerResult = await dependencies.ownerDispatch(query.definition, query.payload);
    } catch (error) {
      return completeApplicationFailure(
        query.definition.operation, query.requestId, query.correlationId,
        error, ownerFailurePhase(error), dependencies.completedAt,
      );
    }
    let data: Readonly<Record<string, unknown>>;
    try {
      data = validateApplicationSuccessData(query.definition.operation, ownerResult);
    } catch (error) {
      return completeApplicationFailure(
        query.definition.operation, query.requestId, query.correlationId,
        error, "Result", dependencies.completedAt,
      );
    }
    return completeApplicationSuccess(
      query.definition, query.requestId, query.correlationId, data,
      dependencies.completedAt,
    );
  }

  let command: ApplicationCommandEnvelope;
  try {
    command = admitApplicationCommandEnvelope(requestJson);
  } catch (error) {
    return completeApplicationFailure(
      identity.operation, identity.requestId, identity.correlationId,
      error, applicationFailurePhase(error), dependencies.completedAt,
    );
  }
  let payload: Readonly<Record<string, unknown>>;
  try {
    payload = validateApplicationPayload(command.definition.operation, command.payload);
  } catch (error) {
    return completeApplicationFailure(
      command.definition.operation, command.requestId, command.correlationId,
      error, "Request", dependencies.completedAt,
    );
  }
  try {
    return await dependencies.replayStore.executeAsync(
      Object.freeze({
        operation: command.definition.operation,
        commandId: command.commandId,
      }),
      command.canonicalContent,
      async () => {
        try {
          await dependencies.checkReadiness(command.definition, payload);
        } catch (error) {
          return completeApplicationFailure(
            command.definition.operation, command.requestId, command.correlationId,
            error, "Admission", dependencies.completedAt,
          );
        }
        let ownerResult: unknown;
        try {
          ownerResult = await dependencies.ownerDispatch(
            command.definition,
            payload,
            Object.freeze({
              commandId: command.commandId,
              correlationId: command.correlationId,
              requestedAt: command.requestedAt,
            }),
          );
        } catch (error) {
          return completeApplicationFailure(
            command.definition.operation, command.requestId, command.correlationId,
            error, ownerFailurePhase(error), dependencies.completedAt,
          );
        }
        let data: Readonly<Record<string, unknown>>;
        try {
          data = validateApplicationSuccessData(command.definition.operation, ownerResult);
        } catch (error) {
          return completeApplicationFailure(
            command.definition.operation, command.requestId, command.correlationId,
            error, "Result", dependencies.completedAt,
          );
        }
        return completeApplicationSuccess(
          command.definition, command.requestId, command.correlationId, data,
          dependencies.completedAt,
        );
      },
    );
  } catch (error) {
    if (error instanceof ApplicationResultInvalidError) throw error;
    return completeApplicationFailure(
      command.definition.operation, command.requestId, command.correlationId,
      error, "Replay", dependencies.completedAt,
    );
  }
}

function presentUtcInstant(wireValue: string): string {
  return `${wireValue.slice(0, 10)} ${wireValue.slice(11, -1)} UTC`;
}

export function presentCanonicalValue(
  valueClass: CanonicalValueClass,
  wireValue: string,
): CanonicalValuePresentation {
  let visibleText: string;
  switch (valueClass) {
    case "OrderStatus":
      visibleText = wireValue === "Partial" ? "Partially Filled" : wireValue;
      break;
    case "Readiness":
      visibleText = wireValue === "NotReady" ? "Not Ready" : wireValue;
      break;
    case "UTCInstant":
      visibleText = presentUtcInstant(wireValue);
      break;
    case "SourceTime":
      visibleText = `Source time: ${presentUtcInstant(wireValue)}`;
      break;
    case "RetrievedAt":
      visibleText = `Retrieved at: ${presentUtcInstant(wireValue)}`;
      break;
    case "CompletedAt":
      visibleText = `Completed at: ${presentUtcInstant(wireValue)}`;
      break;
    case "Timezone":
      visibleText = `Display timezone: ${wireValue}`;
      break;
    case "TradeDate":
      visibleText = `Trade date: ${wireValue}`;
      break;
    case "Date":
    case "UnitPrice":
    case "Money":
    case "Rate":
      visibleText = wireValue;
      break;
    default:
      valueClass satisfies never;
      throw new Error("Canonical value class is not supported");
  }

  return Object.freeze({
    wireValue,
    visibleText,
    accessibleText: visibleText,
  });
}

const requiredResearchWarning = Object.freeze({
  researchWarningRequired: true as const,
  warningText: researchWarningText,
});
const absentResearchWarning = Object.freeze({
  researchWarningRequired: false as const,
  warningText: null,
});

export function presentResearchWarning(
  resultKind: ResearchWarningResultKind,
): ResearchWarningPresentation {
  switch (resultKind) {
    case "AnalyticalResult":
    case "Evidence":
    case "PaperAction":
      return requiredResearchWarning;
    case "NonAnalytical":
      return absentResearchWarning;
    default:
      resultKind satisfies never;
      throw new Error("Research warning result kind is not supported");
  }
}

const blockedStateMetadata: Readonly<Record<BlockedState, Readonly<{
  statusText: string;
  causeText: string;
  announcement: "PoliteStatus" | "AssertiveAlert";
}>>> = Object.freeze({
  FailedRestartable: Object.freeze({
    statusText: "Job failed",
    causeText: "The job failed and can be retried after its cause is corrected.",
    announcement: "PoliteStatus",
  }),
  FailedNotRestartable: Object.freeze({
    statusText: "Job failed",
    causeText: "The job failed and cannot be restarted.",
    announcement: "PoliteStatus",
  }),
  InputQuarantined: Object.freeze({
    statusText: "Input quarantined",
    causeText: "Required input did not pass data-quality controls.",
    announcement: "AssertiveAlert",
  }),
  VersionConflict: Object.freeze({
    statusText: "Paper order changed",
    causeText: "The paper order version changed before the requested action.",
    announcement: "PoliteStatus",
  }),
  IntegrityBlocked: Object.freeze({
    statusText: "Integrity blocked",
    causeText: "Integrity verification blocks this operation.",
    announcement: "AssertiveAlert",
  }),
  NotReady: Object.freeze({
    statusText: "Application not ready",
    causeText: "A required readiness dependency is unavailable.",
    announcement: "AssertiveAlert",
  }),
  DraftAwaitingConfirmation: Object.freeze({
    statusText: "Confirmation required",
    causeText: "The draft paper order requires explicit confirmation.",
    announcement: "PoliteStatus",
  }),
  MissingIdentity: Object.freeze({
    statusText: "Item unavailable",
    causeText: "This item is no longer available. Return to the previous view to continue.",
    announcement: "PoliteStatus",
  }),
  AccessDenied: Object.freeze({
    statusText: "Access denied",
    causeText: "Access to this item was denied. Verify local access before trying again.",
    announcement: "AssertiveAlert",
  }),
  NoSafeOperation: Object.freeze({
    statusText: "Recovery unavailable",
    causeText: "This action cannot be completed safely. Review readiness details or contact the workspace owner.",
    announcement: "PoliteStatus",
  }),
});

function createBlockedStateRecovery(
  state: BlockedState,
): BlockedStateRecovery | null {
  switch (state) {
    case "FailedRestartable":
      return Object.freeze({
        actionId: "retry-job",
        label: "Retry job",
        targetOperation: "JobRestart",
        focusTarget: "job-status",
        requiresConfirmation: false,
      });
    case "FailedNotRestartable":
      return Object.freeze({
        actionId: "review-job",
        label: "Review job details",
        targetOperation: "JobGet",
        focusTarget: "job-details",
        requiresConfirmation: false,
      });
    case "InputQuarantined":
      return Object.freeze({
        actionId: "review-evidence",
        label: "Review data issue",
        targetOperation: "EvidenceGet",
        focusTarget: "evidence-details",
        requiresConfirmation: false,
      });
    case "VersionConflict":
      return Object.freeze({
        actionId: "reload-order",
        label: "Reload current order",
        targetOperation: "PaperOrderGet",
        focusTarget: "order-details",
        requiresConfirmation: false,
      });
    case "IntegrityBlocked":
      return Object.freeze({
        actionId: "review-integrity",
        label: "Review integrity status",
        targetOperation: "ReadinessGet",
        focusTarget: "readiness-details",
        requiresConfirmation: false,
      });
    case "NotReady":
      return Object.freeze({
        actionId: "review-readiness",
        label: "Review readiness details",
        targetOperation: "ReadinessGet",
        focusTarget: "readiness-details",
        requiresConfirmation: false,
      });
    case "DraftAwaitingConfirmation":
      return Object.freeze({
        actionId: "submit-paper-order",
        label: "Submit paper order",
        targetOperation: "PaperOrderTransition",
        focusTarget: "order-status",
        requiresConfirmation: true,
      });
    case "MissingIdentity":
    case "AccessDenied":
    case "NoSafeOperation":
      return null;
  }
}

export function presentBlockedState(
  request: BlockedStateRequest,
  previousState: BlockedState | null,
): BlockedStatePresentation {
  const metadata = blockedStateMetadata[request.state];
  const recovery = createBlockedStateRecovery(request.state);
  const announcement = previousState === request.state
    ? "None" as const
    : metadata.announcement;
  return Object.freeze({
    state: request.state,
    statusText: metadata.statusText,
    causeText: metadata.causeText,
    programmaticRole: metadata.announcement === "AssertiveAlert" ? "alert" : "status",
    announcement,
    recovery,
    keyboardOperable: recovery !== null,
    focusPlan: Object.freeze({
      processing: "trigger" as const,
      validationFailure: "first-actionable-error" as const,
      success: recovery?.focusTarget ?? null,
    }),
  });
}

function createRecoveryPayload(
  request: BlockedStateRequest,
  createTransitionCommandId: () => string,
): Readonly<Record<string, unknown>> | null {
  switch (request.state) {
    case "FailedRestartable":
    case "FailedNotRestartable":
      return Object.freeze({ jobId: request.context.jobId });
    case "InputQuarantined":
      return Object.freeze({ evidenceId: request.context.evidenceId });
    case "VersionConflict":
      return Object.freeze({ orderId: request.context.orderId });
    case "IntegrityBlocked":
    case "NotReady":
      return Object.freeze({});
    case "DraftAwaitingConfirmation":
      return Object.freeze({
        orderId: request.context.orderId,
        transitionCommandId: createTransitionCommandId(),
        expectedVersion: request.context.aggregateVersion,
        transition: "OT-02" as const,
        transitionPayload: Object.freeze({
          confirmation: Object.freeze({ ...request.context.confirmation }),
        }),
      });
    case "MissingIdentity":
    case "AccessDenied":
    case "NoSafeOperation":
      return null;
  }
}

export function activateBlockedStateRecovery<Result>(
  request: BlockedStateRequest,
  activationMethod: RecoveryActivationMethod,
  createTransitionCommandId: () => string,
  dispatch: (
    operation: ApplicationOperation,
    payload: Readonly<Record<string, unknown>>,
  ) => Result,
): BlockedStateRecoveryActivation<Result> {
  const recovery = createBlockedStateRecovery(request.state);
  if (recovery === null) {
    return Object.freeze({ outcome: "NotDispatched" });
  }
  const payload = createRecoveryPayload(request, createTransitionCommandId);
  if (payload === null) {
    return Object.freeze({ outcome: "NotDispatched" });
  }
  return Object.freeze({
    outcome: "Dispatched",
    activationMethod,
    result: dispatch(recovery.targetOperation, payload),
  });
}

const allowedDiagnosticFields = new Set([
  "code",
  "codes",
  "warningCode",
  "warningCodes",
  "requestId",
  "correlationId",
  "jobId",
  "orderId",
  "evidenceId",
  "datasetId",
  "datasetVersion",
  "status",
  "occurredAt",
  "createdAt",
  "completedAt",
  "checkedAt",
  "acceptedCount",
  "rejectedCount",
  "itemCount",
  "durationMs",
  "schemaVersion",
  "contractVersion",
  "baselineVersion",
  "contentHash",
  "evidenceHash",
  "configurationHash",
]);
const prohibitedDiagnosticFieldPattern =
  /(apikey|brokerageartifact|commandpayload|connectionstring|credential|databaseurl|environmentsecret|kubernetessecret|password|protectedanchorkey|rawfixturesource|rawprovider|requestpayload|secret|sourceurl|sql|stack|symbol|token|userenteredtext)/i;
const stableCodePattern = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/u;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const utcInstantPattern =
  /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;
const boundedIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/u;
const versionPattern = /^(?:v)?[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/u;
const canonicalDiagnosticStatuses = new Set([
  "Pending",
  "Running",
  "Succeeded",
  "Failed",
  "Ready",
  "NotReady",
  "Draft",
  "Submitted",
  "Accepted",
  "Partial",
  "Filled",
  "Rejected",
  "Canceled",
  "Expired",
  "Valid",
  "Invalid",
  "Complete",
  "Incomplete",
  "Verified",
  "Blocked",
  "Quarantined",
]);

function isAllowedDiagnosticValue(
  name: string,
  value: unknown,
): value is DiagnosticValue {
  switch (name) {
    case "code":
    case "warningCode":
      return typeof value === "string" && stableCodePattern.test(value);
    case "codes":
    case "warningCodes":
      return Array.isArray(value) &&
        value.every((item) =>
          typeof item === "string" && stableCodePattern.test(item)
        );
    case "requestId":
    case "correlationId":
    case "jobId":
    case "orderId":
      return typeof value === "string" && uuidPattern.test(value);
    case "evidenceId":
    case "datasetId":
    case "datasetVersion":
      return typeof value === "string" && boundedIdentifierPattern.test(value);
    case "status":
      return typeof value === "string" && canonicalDiagnosticStatuses.has(value);
    case "occurredAt":
    case "createdAt":
    case "completedAt":
    case "checkedAt":
      return typeof value === "string" && utcInstantPattern.test(value);
    case "acceptedCount":
    case "rejectedCount":
    case "itemCount":
    case "durationMs":
      return typeof value === "number" &&
        Number.isSafeInteger(value) && value >= 0;
    case "schemaVersion":
    case "contractVersion":
    case "baselineVersion":
      return typeof value === "string" && versionPattern.test(value);
    case "contentHash":
    case "evidenceHash":
    case "configurationHash":
      return typeof value === "string" && sha256Pattern.test(value);
    default:
      return false;
  }
}

function classifyDiagnosticRecord(
  record: DiagnosticRecord,
): ExportedDiagnosticRecord | null {
  try {
    const captured = requireClosedResultRecord(record);
    const exportedEntries: [string, DiagnosticValue][] = [];
    for (const [name, value] of Object.entries(captured)) {
      const normalizedName = name.replaceAll(/[^a-z0-9]/gi, "");
      if (prohibitedDiagnosticFieldPattern.test(normalizedName)) {
        continue;
      }
      if (!allowedDiagnosticFields.has(name)) {
        return null;
      }
      const capturedValue = Array.isArray(value)
        ? requireDenseResultArray(value)
        : value;
      if (!isAllowedDiagnosticValue(name, capturedValue)) {
        return null;
      }
      exportedEntries.push([
        name,
        Array.isArray(capturedValue)
          ? Object.freeze([...capturedValue]) as DiagnosticValue
          : capturedValue,
      ]);
    }
    return Object.freeze(Object.fromEntries(exportedEntries));
  } catch {
    return null;
  }
}

function safeDiagnosticCorrelationId(record: DiagnosticRecord): string | undefined {
  try {
    const captured = requireClosedResultRecord(record);
    return typeof captured.correlationId === "string" && uuidPattern.test(captured.correlationId)
      ? captured.correlationId
      : undefined;
  } catch {
    return undefined;
  }
}

export function exportDiagnosticMetadata<
  Result extends Readonly<Record<string, unknown>>,
>(
  records: readonly DiagnosticRecord[],
  createExport: (records: readonly ExportedDiagnosticRecord[]) => Result,
  recordFailure: (failure: DiagnosticRedactionFailure) => void,
): DiagnosticExportResult<Result> {
  const exportedRecords: ExportedDiagnosticRecord[] = [];
  for (const record of records) {
    const exportedRecord = classifyDiagnosticRecord(record);
    if (exportedRecord === null) {
      const correlationId = safeDiagnosticCorrelationId(record);
      const boundedIdentifiers = correlationId === undefined
        ? Object.freeze({})
        : Object.freeze({ correlationId });
      const error = Object.freeze({
        code: "APPLICATION_REDACTION_FAILED" as const,
        boundedIdentifiers,
      });
      recordFailure(error);
      return Object.freeze({ outcome: "Failed" as const, error });
    }
    exportedRecords.push(exportedRecord);
  }

  const frozenRecords = Object.freeze(exportedRecords);
  const diagnosticExport = Object.freeze({ ...createExport(frozenRecords) });
  return Object.freeze({
    outcome: "Succeeded" as const,
    export: diagnosticExport,
  });
}

export function evaluateReadiness(
  request: ReadinessEvaluationRequest,
): ReadinessSnapshot {
  let controllingCode: ReadinessErrorCode | null = null;
  const dependencies = readinessDependencyNames.map((dependency) => {
    const check = request.dependencies[dependency];
    if (!check.ready && controllingCode === null) {
      controllingCode = check.errorCode;
    }
    return Object.freeze({
      dependency,
      state: check.ready ? "Ready" as const : "NotReady" as const,
      checkedAt: check.checkedAt,
      code: check.ready ? null : check.errorCode,
    });
  });

  const controllingError = controllingCode === null
    ? null
    : Object.freeze({
      code: controllingCode,
      message: "Application readiness is blocked. Review readiness details.",
      boundedIdentifiers: Object.freeze({}),
      recovery: Object.freeze({
        actionId: "review-readiness" as const,
        label: "Review readiness details" as const,
        targetOperation: "ReadinessGet" as const,
        focusTarget: "readiness-details" as const,
        requiresConfirmation: false as const,
      }),
    });

  return Object.freeze({
    state: controllingError === null ? "Ready" : "NotReady",
    checkedAt: request.checkedAt,
    displayTimezone: "UTC",
    liveness: request.liveness,
    dependencies: Object.freeze(dependencies),
    controllingError,
  });
}

export function presentFailedJob<Job extends FailedJobForPresentation>(
  job: Job,
): FailedJobPresentation<Job> {
  const recovery = job.restartability === "Restartable"
    ? Object.freeze({
      actionId: "retry-job" as const,
      label: "Retry job" as const,
      targetOperation: "JobRestart" as const,
      focusTarget: "job-status" as const,
      requiresConfirmation: false as const,
    })
    : Object.freeze({
      actionId: "review-job" as const,
      label: "Review job details" as const,
      targetOperation: "JobGet" as const,
      focusTarget: "job-details" as const,
      requiresConfirmation: false as const,
    });
  const message = job.restartability === "Restartable"
    ? "The job failed. Correct the reported cause, then retry the job."
    : "The job failed and cannot be restarted. Review the job details.";

  return Object.freeze({
    job,
    error: Object.freeze({
      code: job.controllingError.code,
      message,
      boundedIdentifiers: Object.freeze({ jobId: job.jobId }),
      recovery,
    }),
    recoveryTarget: Object.freeze({ jobId: job.jobId }),
    dependentResearch: "Blocked",
  });
}

export function restartDurableJob<Result>(
  jobId: string,
  ownerDispatch: (request: JobRestartRequest) => Result,
): Result {
  return ownerDispatch(Object.freeze({ jobId }));
}

function captureApplicationJobState(
  value: unknown,
): ApplicationJobStateProjection | null {
  try {
    if (
      value === null ||
      Array.isArray(value) ||
      typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const fields = ["attempt", "jobType", "restartability", "status"] as const;
    const actualFields = Reflect.ownKeys(descriptors).sort();
    if (
      actualFields.length !== fields.length ||
      actualFields.some((field, index) => field !== fields[index])
    ) return null;

    const values: Record<(typeof fields)[number], unknown> = {
      attempt: undefined,
      jobType: undefined,
      restartability: undefined,
      status: undefined,
    };
    for (const field of fields) {
      const descriptor = descriptors[field];
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        !descriptor.enumerable
      ) return null;
      values[field] = descriptor.value;
    }
    if (
      !applicationJobTypes.includes(values.jobType as ApplicationJobType) ||
      !applicationJobStatuses.includes(values.status as ApplicationJobStatus) ||
      !applicationJobRestartability.includes(
        values.restartability as ApplicationJobRestartability,
      ) ||
      !Number.isSafeInteger(values.attempt) ||
      (values.attempt as number) < 1
    ) return null;

    return Object.freeze({
      jobType: values.jobType as ApplicationJobType,
      status: values.status as ApplicationJobStatus,
      restartability: values.restartability as ApplicationJobRestartability,
      attempt: values.attempt as number,
    });
  } catch {
    return null;
  }
}

export function transitionApplicationJobState(
  job: ApplicationJobStateProjection,
  targetStatus: ApplicationJobStatus,
  trigger: ApplicationJobTransitionTrigger,
): ApplicationJobTransitionResult {
  const state = captureApplicationJobState(job);
  if (
    state === null ||
    !applicationJobStatuses.includes(targetStatus) ||
    (trigger !== "Owner" && trigger !== "JobRestart")
  ) {
    throw new ApplicationJobTransitionError("APPLICATION_RESULT_INVALID");
  }

  if (trigger === "JobRestart") {
    if (
      state.status !== "Failed" ||
      targetStatus !== "Pending" ||
      state.restartability !== "Restartable"
    ) {
      throw new ApplicationJobTransitionError("APPLICATION_JOB_NOT_RESTARTABLE");
    }
    if (state.attempt === Number.MAX_SAFE_INTEGER) {
      throw new ApplicationJobTransitionError("APPLICATION_RESULT_INVALID");
    }
    return Object.freeze({
      jobType: state.jobType,
      status: targetStatus,
      restartability: state.restartability,
      attempt: state.attempt + 1,
    });
  }

  const isLegalOwnerTransition =
    (state.status === "Pending" &&
      (targetStatus === "Running" || targetStatus === "Failed")) ||
    (state.status === "Running" &&
      (targetStatus === "Succeeded" || targetStatus === "Failed"));
  if (!isLegalOwnerTransition) {
    throw new ApplicationJobTransitionError("APPLICATION_RESULT_INVALID");
  }

  return Object.freeze({
    jobType: state.jobType,
    status: targetStatus,
    restartability: state.restartability,
    attempt: state.attempt,
  });
}

const paperOrderNotDispatched = Object.freeze({
  outcome: "NotDispatched" as const,
  state: "Draft" as const,
});

export function submitConfirmedPaperOrder<Result>(
  request: PaperOrderSubmissionRequest,
  confirmationAttempt: PaperOrderConfirmationAttempt,
  ownerDispatch: (command: SubmitPaperOrderCommand) => Result,
): PaperOrderSubmissionResult<Result> {
  if (
    confirmationAttempt.status !== "Completed" ||
    confirmationAttempt.confirmation.actorId !== "local-user"
  ) {
    return paperOrderNotDispatched;
  }

  const command = Object.freeze({
    baselineVersion: "v1.0.0" as const,
    correlationId: request.correlationId,
    expectedVersion: request.expectedVersion,
    orderId: request.orderId,
    sourceState: "Draft" as const,
    targetState: "Submitted" as const,
    transition: "OT-02" as const,
    transitionCommandId: request.transitionCommandId,
    transitionPayload: Object.freeze({
      confirmation: confirmationAttempt.confirmation,
    }),
    trigger: "UserConfirmedPaperAction" as const,
  });

  return Object.freeze({ outcome: "Dispatched", result: ownerDispatch(command) });
}
