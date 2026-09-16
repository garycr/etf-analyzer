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

export type ApplicationCommandOperation =
  (typeof applicationCommandOperations)[number];
export type ApplicationQueryOperation =
  (typeof applicationQueryOperations)[number];
export type ApplicationOperation =
  | ApplicationCommandOperation
  | ApplicationQueryOperation;

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
  readonly acceptedCount: number;
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
  "ANALYTICS_INTEGRITY_FAILED",
  "ANALYTICS_PUBLICATION_BLOCKED",
  "APPLICATION_REQUEST_INVALID",
  "APPLICATION_IDEMPOTENCY_CONFLICT",
  "APPLICATION_JOB_NOT_RESTARTABLE",
  "APPLICATION_REDACTION_FAILED",
  "ORDER_IDEMPOTENCY_CONFLICT",
  "FIXTURE_IDEMPOTENCY_CONFLICT",
  "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
  "LEDGER_INTEGRITY_FAILED",
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

  constructor() {
    super("Application operation is unknown");
    this.name = "ApplicationOperationUnknownError";
  }
}

export class ApplicationRequestInvalidError extends Error {
  readonly code = "APPLICATION_REQUEST_INVALID";

  constructor() {
    super("The application request is invalid");
    this.name = "ApplicationRequestInvalidError";
  }
}

export class ApplicationResultInvalidError extends Error {
  readonly code = "APPLICATION_RESULT_INVALID";

  constructor() {
    super("The application result is invalid");
    this.name = "ApplicationResultInvalidError";
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

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isUInt(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9][0-9]*)$/u.test(value);
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

function parseApplicationPayload(payloadJson: string): Record<string, unknown> {
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

function admitApplicationCommandEnvelope(requestJson: string): ApplicationCommandEnvelope {
  const request = parseApplicationPayload(requestJson);
  const record = requireClosedRecord(request, [
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
  if (
    typeof record.operation !== "string" ||
    !isUuid(record.requestId) ||
    !isUuid(record.correlationId) ||
    record.actorId !== "local-user" ||
    record.prototypeCandidate !== "v1.0.0-prototype.1" ||
    record.contractVersion !== "1.0.0-candidate.2" ||
    !isUtcInstant(record.requestedAt) ||
    !isUuid(record.commandId)
  ) invalidApplicationRequest();

  const definition = resolveApplicationOperation(record.operation);
  if (definition.kind !== "command") invalidApplicationRequest();
  const commandDefinition = definition as AdmittedApplicationCommand["definition"];
  const payloadRecord = requireClosedRecord(
    record.payload,
    Object.keys(record.payload as object),
  );
  const replayPayload = normalizeApplicationReplayPayload(
    commandDefinition.operation,
    payloadRecord,
  );
  const canonicalContent = canonicalizeJson({
    operation: definition.operation,
    actorId: record.actorId,
    prototypeCandidate: record.prototypeCandidate,
    contractVersion: record.contractVersion,
    payload: replayPayload,
  });
  return Object.freeze({
    definition: commandDefinition,
    requestId: record.requestId,
    correlationId: record.correlationId,
    actorId: record.actorId,
    prototypeCandidate: record.prototypeCandidate,
    contractVersion: record.contractVersion,
    requestedAt: record.requestedAt,
    commandId: record.commandId,
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
  constructor() {
    super("Application replay execution is already in progress");
    this.name = "ApplicationReplayInProgressError";
  }
}

class InMemoryApplicationReplayStore implements ApplicationReplayStore {
  readonly #entries = new Map<string, Readonly<
    | { canonicalContent: string; outcome: "Executing" }
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
  return replayStore.execute(
    Object.freeze({
      operation: envelope.definition.operation,
      commandId: envelope.commandId,
    }),
    envelope.canonicalContent,
    () => {
      const command = Object.freeze({
        ...envelope,
        payload: validateApplicationPayload(
          envelope.definition.operation,
          envelope.payload,
        ),
      });
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
  fields: readonly string[],
): Record<string, unknown> {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    return invalidApplicationResult();
  }
  const actualFields = Object.keys(value).sort();
  const expectedFields = [...fields].sort();
  if (
    actualFields.length !== expectedFields.length ||
    actualFields.some((field, index) => field !== expectedFields[index])
  ) {
    return invalidApplicationResult();
  }
  return value as Record<string, unknown>;
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
  try {
    resolveApplicationOperation(recovery.targetOperation);
  } catch {
    invalidApplicationResult();
  }
  return Object.freeze({ ...recovery });
}

function validateResultError(value: unknown): Readonly<Record<string, unknown>> {
  const error = requireClosedResultRecord(value, [
    "code",
    "message",
    "boundedIdentifiers",
    "recovery",
  ]);
  if (!isString(error.code) || !isString(error.message)) invalidApplicationResult();
  const identifiers = requireClosedResultRecord(
    error.boundedIdentifiers,
    Object.keys(error.boundedIdentifiers as object),
  );
  if (!Object.values(identifiers).every(isString)) invalidApplicationResult();
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
  if (!Array.isArray(value)) return invalidApplicationResult();
  const items = value.map(validateWatchlistItem);
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
    const inputEvidenceIds = Array.isArray(identity.inputEvidenceIds)
      ? identity.inputEvidenceIds
      : invalidApplicationResult();
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
  return Object.freeze({
    ...job,
    inputIdentity: validateJobInputIdentity(job.jobType, job.inputIdentity),
    checkpoint: validateJobCheckpoint(job.checkpoint),
    controllingError: job.controllingError === null
      ? null
      : validateResultError(job.controllingError),
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
    !Array.isArray(readiness.dependencies) ||
    (readiness.state === "Ready") !== (readiness.controllingError === null)
  ) invalidApplicationResult();
  const dependencies = readiness.dependencies.map((value) => {
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
    return Object.freeze({ ...dependency });
  });
  if (
    dependencies.length !== readinessDependencyNames.length ||
    new Set(dependencies.map((item) => item.dependency)).size !== dependencies.length
  ) invalidApplicationResult();
  dependencies.sort((left, right) =>
    readinessDependencyNames.indexOf(left.dependency as ReadinessDependencyName) -
    readinessDependencyNames.indexOf(right.dependency as ReadinessDependencyName)
  );
  return Object.freeze({
    ...readiness,
    dependencies: Object.freeze(dependencies),
    controllingError: readiness.controllingError === null
      ? null
      : validateResultError(readiness.controllingError),
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
    !isCanonicalDate(order.tradeDate) ||
    !Array.isArray(order.transitionHistory)
  ) invalidApplicationResult();
  const transitionHistory = order.transitionHistory.map(validateOrderTransitionRecord)
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
  if (
    !isUuid(diagnosticExport.exportId) ||
    !isUtcInstant(diagnosticExport.createdAt) ||
    !Array.isArray(diagnosticExport.codes) ||
    diagnosticExport.codes.length === 0 ||
    !diagnosticExport.codes.every((code) =>
      typeof code === "string" && stableCodePattern.test(code)
    ) ||
    new Set(diagnosticExport.codes).size !== diagnosticExport.codes.length ||
    !isUInt(diagnosticExport.itemCount) ||
    typeof diagnosticExport.contentHash !== "string" ||
    !sha256Pattern.test(diagnosticExport.contentHash)
  ) invalidApplicationResult();
  return Object.freeze({
    ...diagnosticExport,
    codes: Object.freeze([...diagnosticExport.codes].sort(compareCodePoints)),
  });
}

function validatePortfolioLot(value: unknown): Readonly<Record<string, unknown>> {
  const lot = requireClosedResultRecord(value, [
    "lotId", "instrumentId", "acquiredAt", "ledgerSequence", "openQuantity", "openBasis",
  ]);
  if (
    !isUuid(lot.lotId) || !isString(lot.instrumentId) || !isUtcInstant(lot.acquiredAt) ||
    !isUInt(lot.ledgerSequence) || !isScale10(lot.openQuantity) || !isScale8(lot.openBasis)
  ) invalidApplicationResult();
  return Object.freeze({ ...lot });
}

function validatePortfolioPosition(value: unknown): Readonly<Record<string, unknown>> {
  const position = requireClosedResultRecord(value, [
    "instrumentId", "quantity", "basis", "valuation", "unrealizedPnL",
  ]);
  if (
    !isString(position.instrumentId) || !isScale10(position.quantity) ||
    !isScale8(position.basis) || !isScale8(position.valuation) ||
    !isScale8(position.unrealizedPnL)
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
    !isScale8(portfolio.cash) || !Array.isArray(portfolio.lots) ||
    !Array.isArray(portfolio.positions) || !isScale8(portfolio.realizedPnL) ||
    !isScale8(portfolio.totalEquity) ||
    (portfolio.reconciliationState !== "Reconciled" && portfolio.reconciliationState !== "IntegrityBlocked")
  ) invalidApplicationResult();
  const lots = portfolio.lots.map(validatePortfolioLot).sort((left, right) =>
    compareCodePoints(left.acquiredAt as string, right.acquiredAt as string) ||
    compareUInt(left.ledgerSequence as string, right.ledgerSequence as string) ||
    compareCodePoints(left.lotId as string, right.lotId as string)
  );
  const positions = portfolio.positions.map(validatePortfolioPosition).sort((left, right) =>
    compareCodePoints(left.instrumentId as string, right.instrumentId as string)
  );
  if (
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

function requireOpaqueOwnerRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (
    value === null || Array.isArray(value) || typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    !isRecursivelyFrozen(value)
  ) invalidApplicationResult();
  return value as Readonly<Record<string, unknown>>;
}

function isRecursivelyFrozen(
  value: unknown,
  activeObjects = new WeakSet<object>(),
): boolean {
  if (value === null || typeof value !== "object" || !Object.isFrozen(value)) {
    return value === null || typeof value !== "object";
  }
  if (activeObjects.has(value)) {
    return false;
  }
  activeObjects.add(value);
  const recursivelyFrozen = Object.values(value).every((member) =>
    isRecursivelyFrozen(member, activeObjects)
  );
  activeObjects.delete(value);
  return recursivelyFrozen;
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
      return Object.freeze({ result: requireOpaqueOwnerRecord(data.result) });
    case "EvidenceGet":
      data = requireClosedResultRecord(value, ["evidence"]);
      return Object.freeze({ evidence: requireOpaqueOwnerRecord(data.evidence) });
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
    ORDER_VERSION_CONFLICT:
      "The paper order changed. Reload the current order before retrying.",
    FIXTURE_REQUIRED_QUARANTINED: "Required fixture data is quarantined.",
    ANALYTICS_INPUT_INCOMPLETE: "Required analytical input is incomplete.",
    ANALYTICS_INTEGRITY_FAILED:
      "Analytical evidence failed integrity verification.",
    ANALYTICS_PUBLICATION_BLOCKED: "Analytical publication is blocked.",
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
  warningText:
    "Research only — hypothetical — user makes all investment decisions." as const,
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
  const exportedEntries: [string, DiagnosticValue][] = [];
  for (const [name, value] of Object.entries(record)) {
    const normalizedName = name.replaceAll(/[^a-z0-9]/gi, "");
    if (prohibitedDiagnosticFieldPattern.test(normalizedName)) {
      continue;
    }
    if (!allowedDiagnosticFields.has(name)) {
      return null;
    }
    if (!isAllowedDiagnosticValue(name, value)) {
      return null;
    }
    exportedEntries.push([
      name,
      Array.isArray(value) ? Object.freeze([...value]) : value,
    ]);
  }
  return Object.freeze(Object.fromEntries(exportedEntries));
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
      const correlationId = typeof record.correlationId === "string" &&
          uuidPattern.test(record.correlationId)
        ? record.correlationId
        : undefined;
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
