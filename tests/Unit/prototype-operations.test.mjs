import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePrototypeOperations } from "../../dist/Infrastructure/Operations/prototype-operations.js";

test("PT-OPS-001 evaluates the closed local prototype operations thresholds", () => {
  const result = evaluatePrototypeOperations({
    apiDurationsMs: [10, 20, 30, 40, 50],
    cpuPercent: 12.5,
    dashboardDurationsMs: [100, 200, 300, 400, 500],
    databaseConnections: 4,
    databaseMaxConnections: 100,
    evidenceCapacityBytes: 1_000,
    evidenceManagedBytes: 799,
    expectedWorkflowCounts: {
      applicationReplays: 5,
      analyticsPublications: 1,
      fixturePackages: 1,
      jobs: 2,
      orderTransitions: 2,
      paperOrders: 1,
    },
    hashMismatchCount: 0,
    memoryBytes: 64_000_000,
    queueOrOutboxObjectCount: 0,
    reconciliationDifferenceCount: 0,
    unexpectedServerErrorCount: 0,
    unresolvedIntentCount: 0,
    workflowCounts: {
      applicationReplays: 5,
      analyticsPublications: 1,
      fixturePackages: 1,
      jobs: 2,
      orderTransitions: 2,
      paperOrders: 1,
    },
  });

  assert.deepEqual(result, {
    capacityUtilizationPercent: 79.9,
    goldenSignals: {
      errors: 0,
      latency: { apiP95Ms: 50, dashboardP95Ms: 500 },
      saturation: {
        databaseConnectionUtilizationPercent: 4,
        evidenceCapacityUtilizationPercent: 79.9,
      },
      traffic: { applicationRequests: 5 },
    },
    recordedResources: { cpuPercent: 12.5, memoryBytes: 64_000_000 },
    status: "Pass",
  });
});

test("PT-OPS-001 fails closed when any approved threshold or exact count is violated", () => {
  const result = evaluatePrototypeOperations({
    apiDurationsMs: [1_000],
    cpuPercent: 90,
    dashboardDurationsMs: [2_000],
    databaseConnections: 10,
    databaseMaxConnections: 10,
    evidenceCapacityBytes: 100,
    evidenceManagedBytes: 80,
    expectedWorkflowCounts: { applicationReplays: 5 },
    hashMismatchCount: 1,
    memoryBytes: 1_000_000_000,
    queueOrOutboxObjectCount: 1,
    reconciliationDifferenceCount: 1,
    unexpectedServerErrorCount: 1,
    unresolvedIntentCount: 1,
    workflowCounts: { applicationReplays: 4 },
  });

  assert.equal(result.status, "Fail");
  assert.deepEqual(result.failures, [
    "API_P95_THRESHOLD_EXCEEDED",
    "DASHBOARD_P95_THRESHOLD_EXCEEDED",
    "WORKFLOW_COUNT_MISMATCH",
    "UNEXPECTED_SERVER_ERROR",
    "HASH_MISMATCH",
    "RECONCILIATION_DIFFERENCE",
    "UNRESOLVED_INTENT",
    "DURABLE_HANDOFF_PRESENT",
    "EVIDENCE_CAPACITY_THRESHOLD_REACHED",
    "DATABASE_CONNECTION_LIMIT_REACHED",
  ]);
});
