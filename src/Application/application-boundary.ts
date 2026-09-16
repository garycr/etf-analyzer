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
