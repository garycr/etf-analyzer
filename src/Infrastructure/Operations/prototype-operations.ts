export type PrototypeWorkflowCounts = Readonly<Record<string, number>>;

export interface PrototypeOperationsInput {
  readonly apiDurationsMs: readonly number[];
  readonly cpuPercent: number;
  readonly dashboardDurationsMs: readonly number[];
  readonly databaseConnections: number;
  readonly databaseMaxConnections: number;
  readonly evidenceCapacityBytes: number;
  readonly evidenceManagedBytes: number;
  readonly expectedWorkflowCounts: PrototypeWorkflowCounts;
  readonly hashMismatchCount: number;
  readonly memoryBytes: number;
  readonly queueOrOutboxObjectCount: number;
  readonly reconciliationDifferenceCount: number;
  readonly unexpectedServerErrorCount: number;
  readonly unresolvedIntentCount: number;
  readonly workflowCounts: PrototypeWorkflowCounts;
}

export type PrototypeOperationsFailure =
  | "API_P95_THRESHOLD_EXCEEDED"
  | "DASHBOARD_P95_THRESHOLD_EXCEEDED"
  | "WORKFLOW_COUNT_MISMATCH"
  | "UNEXPECTED_SERVER_ERROR"
  | "HASH_MISMATCH"
  | "RECONCILIATION_DIFFERENCE"
  | "UNRESOLVED_INTENT"
  | "DURABLE_HANDOFF_PRESENT"
  | "EVIDENCE_CAPACITY_THRESHOLD_REACHED"
  | "DATABASE_CONNECTION_LIMIT_REACHED";

interface PrototypeOperationsEvidence {
  readonly capacityUtilizationPercent: number;
  readonly goldenSignals: {
    readonly errors: number;
    readonly latency: {
      readonly apiP95Ms: number;
      readonly dashboardP95Ms: number;
    };
    readonly saturation: {
      readonly databaseConnectionUtilizationPercent: number;
      readonly evidenceCapacityUtilizationPercent: number;
    };
    readonly traffic: { readonly applicationRequests: number };
  };
  readonly recordedResources: {
    readonly cpuPercent: number;
    readonly memoryBytes: number;
  };
}

export type PrototypeOperationsResult = PrototypeOperationsEvidence & (
  | { readonly status: "Pass" }
  | {
      readonly status: "Fail";
      readonly failures: readonly PrototypeOperationsFailure[];
    }
);

function percentile95(values: readonly number[]): number {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("operations durations must contain nonnegative finite values");
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!;
}

function utilizationPercent(used: number, capacity: number): number {
  if (!Number.isFinite(used) || used < 0 || !Number.isFinite(capacity) || capacity <= 0) {
    throw new RangeError("operations utilization inputs are invalid");
  }
  return Number(((used / capacity) * 100).toFixed(2));
}

function countsMatch(
  actual: PrototypeWorkflowCounts,
  expected: PrototypeWorkflowCounts,
): boolean {
  const actualEntries = Object.entries(actual).sort(([left], [right]) => left.localeCompare(right));
  const expectedEntries = Object.entries(expected).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(actualEntries) === JSON.stringify(expectedEntries);
}

export function evaluatePrototypeOperations(
  input: PrototypeOperationsInput,
): PrototypeOperationsResult {
  const apiP95Ms = percentile95(input.apiDurationsMs);
  const dashboardP95Ms = percentile95(input.dashboardDurationsMs);
  const evidenceCapacityUtilizationPercent = utilizationPercent(
    input.evidenceManagedBytes,
    input.evidenceCapacityBytes,
  );
  const databaseConnectionUtilizationPercent = utilizationPercent(
    input.databaseConnections,
    input.databaseMaxConnections,
  );
  const failures: PrototypeOperationsFailure[] = [];

  if (apiP95Ms >= 1_000) failures.push("API_P95_THRESHOLD_EXCEEDED");
  if (dashboardP95Ms >= 2_000) failures.push("DASHBOARD_P95_THRESHOLD_EXCEEDED");
  if (!countsMatch(input.workflowCounts, input.expectedWorkflowCounts)) failures.push("WORKFLOW_COUNT_MISMATCH");
  if (input.unexpectedServerErrorCount !== 0) failures.push("UNEXPECTED_SERVER_ERROR");
  if (input.hashMismatchCount !== 0) failures.push("HASH_MISMATCH");
  if (input.reconciliationDifferenceCount !== 0) failures.push("RECONCILIATION_DIFFERENCE");
  if (input.unresolvedIntentCount !== 0) failures.push("UNRESOLVED_INTENT");
  if (input.queueOrOutboxObjectCount !== 0) failures.push("DURABLE_HANDOFF_PRESENT");
  if (evidenceCapacityUtilizationPercent >= 80) failures.push("EVIDENCE_CAPACITY_THRESHOLD_REACHED");
  if (input.databaseConnections >= input.databaseMaxConnections) failures.push("DATABASE_CONNECTION_LIMIT_REACHED");

  const evidence: PrototypeOperationsEvidence = {
    capacityUtilizationPercent: evidenceCapacityUtilizationPercent,
    goldenSignals: {
      errors: input.unexpectedServerErrorCount,
      latency: { apiP95Ms, dashboardP95Ms },
      saturation: {
        databaseConnectionUtilizationPercent,
        evidenceCapacityUtilizationPercent,
      },
      traffic: { applicationRequests: input.workflowCounts.applicationReplays ?? 0 },
    },
    recordedResources: {
      cpuPercent: input.cpuPercent,
      memoryBytes: input.memoryBytes,
    },
  };

  return failures.length === 0
    ? { ...evidence, status: "Pass" }
    : { ...evidence, failures, status: "Fail" };
}
