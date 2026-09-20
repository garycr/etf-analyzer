import {
  presentFailedJob,
  validateApplicationSuccessData,
  type FailedJobForPresentation,
  type FailedJobPresentation,
  type ReadinessSnapshot,
} from "../../Application/application-boundary.js";
import type { ApiApplicationExecutor } from "../Http/api-adapter.js";
import type { WorkbenchDocumentInput } from "./workbench.js";

export interface WorkbenchDegradedEvent {
  readonly code: "WORKBENCH_MODEL_DEGRADED";
  readonly stage: "Readiness" | "Jobs";
  readonly reason:
    | "EnvelopeConstructionFailed"
    | "ExecutionFailed"
    | "QueryFailed"
    | "ResultInvalid"
    | "PresentationFailed";
}

export interface WorkbenchModelProviderDependencies {
  readonly execute: ApiApplicationExecutor;
  readonly now: () => string;
  readonly createId: () => string;
  readonly knownJobIds: readonly string[];
  readonly onDegraded: (event: WorkbenchDegradedEvent) => void;
}

export type WorkbenchModelProvider = () => WorkbenchDocumentInput;

type WorkbenchDegradedReason = WorkbenchDegradedEvent["reason"];

class WorkbenchModelError extends Error {
  constructor(readonly reason: WorkbenchDegradedReason) {
    super(reason);
  }
}

function queryEnvelope(
  operation: "ReadinessGet" | "JobGet",
  payload: Readonly<Record<string, unknown>>,
  dependencies: WorkbenchModelProviderDependencies,
): string {
  return JSON.stringify({
    operation,
    requestId: dependencies.createId(),
    correlationId: dependencies.createId(),
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: dependencies.now(),
    payload,
  });
}

function successfulData(
  operation: "ReadinessGet" | "JobGet",
  result: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | null {
  if (result.operation !== operation) throw new TypeError("Unexpected application result operation");
  if (result.outcome === "Failed") {
    const error = result.error;
    if (
      operation === "JobGet" &&
      typeof error === "object" &&
      error !== null &&
      !Array.isArray(error) &&
      (error as Readonly<Record<string, unknown>>).code === "APPLICATION_JOB_NOT_FOUND"
    ) return null;
    throw new WorkbenchModelError("QueryFailed");
  }
  if (result.outcome !== "Succeeded") throw new TypeError("Unexpected application result outcome");
  return validateApplicationSuccessData(operation, result.data);
}

function executeQuery(
  operation: "ReadinessGet" | "JobGet",
  payload: Readonly<Record<string, unknown>>,
  dependencies: WorkbenchModelProviderDependencies,
): Readonly<Record<string, unknown>> | null {
  let requestJson: string;
  try {
    requestJson = queryEnvelope(operation, payload, dependencies);
  } catch {
    throw new WorkbenchModelError("EnvelopeConstructionFailed");
  }
  let result: Readonly<Record<string, unknown>>;
  try {
    result = dependencies.execute(requestJson);
  } catch {
    throw new WorkbenchModelError("ExecutionFailed");
  }
  try {
    return successfulData(operation, result);
  } catch (error) {
    if (error instanceof WorkbenchModelError) throw error;
    throw new WorkbenchModelError("ResultInvalid");
  }
}

function isFailedJob(value: unknown): value is FailedJobForPresentation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  const error = candidate.controllingError;
  return typeof candidate.jobId === "string" &&
    candidate.status === "Failed" &&
    (candidate.restartability === "Restartable" ||
      candidate.restartability === "NotRestartable") &&
    typeof error === "object" &&
    error !== null &&
    !Array.isArray(error) &&
    typeof (error as Readonly<Record<string, unknown>>).code === "string";
}

export function createWorkbenchModelProvider(
  dependencies: WorkbenchModelProviderDependencies,
): WorkbenchModelProvider {
  return () => {
    let stage: WorkbenchDegradedEvent["stage"] = "Readiness";
    try {
      const readinessData = executeQuery("ReadinessGet", {}, dependencies);
      if (readinessData === null) throw new TypeError("Readiness query failed");
      const readiness = readinessData.readiness as ReadinessSnapshot;
      const failedJobs: FailedJobPresentation<FailedJobForPresentation>[] = [];

      stage = "Jobs";
      for (const jobId of dependencies.knownJobIds) {
        const data = executeQuery("JobGet", { jobId }, dependencies);
        if (data === null) continue;
        if (isFailedJob(data.job)) {
          try {
            failedJobs.push(presentFailedJob(data.job));
          } catch {
            throw new WorkbenchModelError("PresentationFailed");
          }
        }
      }

      return Object.freeze({ readiness, failedJobs: Object.freeze(failedJobs) });
    } catch (error) {
      const reason = error instanceof WorkbenchModelError
        ? error.reason
        : "PresentationFailed";
      try {
        dependencies.onDegraded(Object.freeze({
          code: "WORKBENCH_MODEL_DEGRADED",
          stage,
          reason,
        }));
      } catch {
        // Observability failures cannot make the loopback workbench unavailable.
      }
      return Object.freeze({ readiness: "NotReady" });
    }
  };
}
