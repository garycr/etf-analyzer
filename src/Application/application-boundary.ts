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
