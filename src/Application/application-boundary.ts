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
