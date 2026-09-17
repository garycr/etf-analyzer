import assert from "node:assert/strict";
import test from "node:test";

import {
  ApplicationJobTransitionError,
  ApplicationRequestInvalidError,
  ApplicationResultInvalidError,
  ApplicationOperationUnknownError,
  ApplicationUnauthorizedError,
  applicationCommandOperations,
  applicationJobRestartability,
  applicationJobStatuses,
  applicationJobTypes,
  applicationQueryOperations,
  activateBlockedStateRecovery,
  dispatchApplicationOperation,
  dispatchValidatedApplicationOperation,
  dispatchValidatedApplicationRequest,
  createInMemoryApplicationReplayStore,
  dispatchReplayProtectedApplicationCommand,
  displayVerifiedResearch,
  evaluateReadiness,
  executeApplicationRequest,
  executeApplicationRequestAsync,
  exportDiagnosticMetadata,
  ownerFailureCodes,
  presentCanonicalValue,
  presentBlockedState,
  presentFailedJob,
  presentOwnerFailure,
  presentResearchWarning,
  readinessDependencyNames,
  restartDurableJob,
  selectControllingApplicationError,
  submitConfirmedPaperOrder,
  transitionApplicationJobState,
  validateApplicationSuccessData,
  resolveApplicationOperation,
} from "../../dist/Application/application-boundary.js";

const expectedCommands = [
  "WatchlistPut",
  "WatchlistRemove",
  "WatchlistReorder",
  "FixtureIngestionStart",
  "JobRestart",
  "AnalyticsRun",
  "PaperOrderDraftCreate",
  "PaperOrderTransition",
  "DiagnosticsExportCreate",
];

const expectedQueries = [
  "WatchlistGet",
  "JobGet",
  "ReadinessGet",
  "AnalyticsResultGet",
  "EvidenceGet",
  "PaperOrderGet",
  "PortfolioGet",
];

test("PT-APP-001A resolves only the closed case-sensitive operation catalog", () => {
  assert.deepEqual(applicationCommandOperations, expectedCommands);
  assert.deepEqual(applicationQueryOperations, expectedQueries);

  let handlerInvocations = 0;
  const definitions = [...expectedCommands, ...expectedQueries]
    .map((operation) => dispatchApplicationOperation(operation, (definition) => {
      handlerInvocations += 1;
      return definition;
    }));
  assert.equal(new Set(definitions.map(({ operation }) => operation)).size, 16);
  assert.equal(handlerInvocations, 16);
  assert.deepEqual(
    definitions.map(({ kind }) => kind),
    [
      ...Array(expectedCommands.length).fill("command"),
      ...Array(expectedQueries.length).fill("query"),
    ],
  );

  for (const operation of [
    "watchlistput",
    "Watchlistput",
    "PortfolioGET",
    "UnknownOperation",
    "",
  ]) {
    assert.throws(
      () => dispatchApplicationOperation(operation, () => {
        handlerInvocations += 1;
      }),
      (error) =>
        error instanceof ApplicationOperationUnknownError &&
        error.code === "APPLICATION_OPERATION_UNKNOWN",
    );
  }
  assert.equal(handlerInvocations, 16);
  assert.deepEqual(resolveApplicationOperation("JobGet"), {
    operation: "JobGet",
    kind: "query",
  });
});

test("PT-APP-001B displaying verified research has no paper mutation effect", () => {
  assert.equal(displayVerifiedResearch.length, 1);
  const ownerResult = Object.freeze({
    configurationHash: "a".repeat(64),
    resultSchemaVersion: "1.0.0-candidate.2",
    signals: Object.freeze([
      Object.freeze({ instrumentId: "ETF1", state: "NoSignal" }),
    ]),
  });
  const research = Object.freeze({
    completeness: "Complete",
    integrity: "Verified",
    result: ownerResult,
  });
  const displayed = displayVerifiedResearch(research);

  assert.equal(displayed, ownerResult);
  assert.deepEqual(displayed, ownerResult);
});

test("PT-APP-001C dispatches exactly one OT-02 only after same-user confirmation", () => {
  const request = {
    correlationId: "10000000-0000-4000-8000-000000000001",
    expectedVersion: 1,
    orderId: "10000000-0000-4000-8000-000000000002",
    sourceState: "Draft",
    transitionCommandId: "10000000-0000-4000-8000-000000000003",
  };
  const dispatched = [];
  const ownerDispatch = (command) => {
    dispatched.push(command);
    return Object.freeze({ aggregateVersion: "2", state: "Submitted" });
  };

  for (const confirmationAttempt of [
    { status: "Absent" },
    { status: "Canceled" },
    { status: "Expired" },
    { status: "Incomplete" },
    {
      status: "Completed",
      confirmation: {
        actorId: "other-user",
        confirmedAt: "2026-09-16T14:00:00.000Z",
        confirmationText: "Confirm hypothetical paper order",
      },
    },
  ]) {
    assert.deepEqual(
      submitConfirmedPaperOrder(request, confirmationAttempt, ownerDispatch),
      { outcome: "NotDispatched", state: "Draft" },
    );
  }
  assert.equal(dispatched.length, 0);

  const confirmation = Object.freeze({
    actorId: "local-user",
    confirmedAt: "2026-09-16T14:00:00.000Z",
    confirmationText: "Confirm hypothetical paper order",
  });
  const result = submitConfirmedPaperOrder(
    request,
    { status: "Completed", confirmation },
    ownerDispatch,
  );

  assert.deepEqual(result, {
    outcome: "Dispatched",
    result: { aggregateVersion: "2", state: "Submitted" },
  });
  assert.equal(dispatched.length, 1);
  assert.deepEqual(dispatched[0], {
    baselineVersion: "v1.0.0",
    correlationId: request.correlationId,
    expectedVersion: request.expectedVersion,
    orderId: request.orderId,
    sourceState: "Draft",
    targetState: "Submitted",
    transition: "OT-02",
    transitionCommandId: request.transitionCommandId,
    transitionPayload: { confirmation },
    trigger: "UserConfirmedPaperAction",
  });
  assert.deepEqual(Object.keys(dispatched[0].transitionPayload), ["confirmation"]);
});

test("PT-APP-001C preserves the domain owner's error without retry", () => {
  const ownerError = new Error("ORDER_VERSION_CONFLICT");
  let dispatchCount = 0;

  assert.throws(
    () =>
      submitConfirmedPaperOrder(
        {
          correlationId: "20000000-0000-4000-8000-000000000001",
          expectedVersion: 1,
          orderId: "20000000-0000-4000-8000-000000000002",
          sourceState: "Draft",
          transitionCommandId: "20000000-0000-4000-8000-000000000003",
        },
        {
          status: "Completed",
          confirmation: {
            actorId: "local-user",
            confirmedAt: "2026-09-16T14:00:00.000Z",
            confirmationText: "Confirm hypothetical paper order",
          },
        },
        () => {
          dispatchCount += 1;
          throw ownerError;
        },
      ),
    (error) => error === ownerError,
  );
  assert.equal(dispatchCount, 1);
});

test("PT-APP-001D dispatches one exact JobRestart and returns persisted progress", () => {
  const jobId = "30000000-0000-4000-8000-000000000001";
  const ownerResult = Object.freeze({
    jobId,
    status: "Pending",
    attempt: 2,
    checkpoint: Object.freeze({ attempt: 1, sequence: 7 }),
    acceptedCount: 3,
    rejectedCount: 1,
  });
  const dispatched = [];

  const result = restartDurableJob(jobId, (request) => {
    dispatched.push(request);
    return ownerResult;
  });

  assert.equal(result, ownerResult);
  assert.deepEqual(dispatched, [{ jobId }]);
});

test("PT-APP-001D preserves restart refusal without retry or translation", () => {
  const ownerError = new Error("APPLICATION_JOB_NOT_RESTARTABLE");
  let dispatchCount = 0;

  assert.throws(
    () =>
      restartDurableJob(
        "30000000-0000-4000-8000-000000000002",
        () => {
          dispatchCount += 1;
          throw ownerError;
        },
      ),
    (error) => error === ownerError,
  );
  assert.equal(dispatchCount, 1);
});

test("PT-APP-001E zero accepted rows remains a visible failed job", () => {
  const vectors = [
    {
      code: "FIXTURE_REQUIRED_INPUT_MISSING",
      restartability: "Restartable",
      recovery: {
        actionId: "retry-job",
        label: "Retry job",
        targetOperation: "JobRestart",
        focusTarget: "job-status",
        requiresConfirmation: false,
      },
    },
    {
      code: "APPLICATION_DEPENDENCY_UNAVAILABLE",
      restartability: "NotRestartable",
      recovery: {
        actionId: "review-job",
        label: "Review job details",
        targetOperation: "JobGet",
        focusTarget: "job-details",
        requiresConfirmation: false,
      },
    },
  ];

  for (const [index, vector] of vectors.entries()) {
    const job = Object.freeze({
      jobId: `40000000-0000-4000-8000-00000000000${index + 1}`,
      status: "Failed",
      restartability: vector.restartability,
      acceptedCount: 0,
      rejectedCount: 1,
      controllingError: Object.freeze({ code: vector.code }),
    });
    const result = presentFailedJob(job);

    assert.equal(result.job, job);
    assert.equal(result.job.status, "Failed");
    assert.deepEqual(result, {
      job,
      error: {
        code: vector.code,
        message:
          vector.restartability === "Restartable"
            ? "The job failed. Correct the reported cause, then retry the job."
            : "The job failed and cannot be restarted. Review the job details.",
        boundedIdentifiers: { jobId: job.jobId },
        recovery: vector.recovery,
      },
      recoveryTarget: { jobId: job.jobId },
      dependentResearch: "Blocked",
    });
    assert.equal("outcome" in result, false);
    assert.equal("data" in result, false);
    assert.equal(JSON.stringify(result).includes("Succeeded"), false);
  }
});

test("PT-APP-001F required dependency failures produce ordered NotReady recovery", () => {
  const vectors = [
    ["PostgreSQL", "Live", "APPLICATION_DATABASE_UNAVAILABLE"],
    ["Migrations", "NotLive", "APPLICATION_MIGRATIONS_INCOMPLETE"],
    ["FixturePolicy", "Live", "APPLICATION_CONFIGURATION_INVALID"],
    ["LocalDependency", "NotLive", "APPLICATION_DEPENDENCY_UNAVAILABLE"],
    ["DenialAudit", "Live", "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED"],
    ["LedgerIntegrity", "NotLive", "LEDGER_INTEGRITY_FAILED"],
  ];
  const dependencyOrder = vectors.map(([dependency]) => dependency);

  for (const [failedDependency, liveness, errorCode] of vectors) {
    const dependencies = Object.fromEntries(
      [...dependencyOrder].reverse().map((dependency) => {
        const index = dependencyOrder.indexOf(dependency);
        return [
          dependency,
          dependency === failedDependency
            ? {
              ready: false,
              checkedAt: `2026-09-16T16:0${index}:00.000Z`,
              errorCode,
            }
            : {
              ready: true,
              checkedAt: `2026-09-16T16:0${index}:00.000Z`,
            },
        ];
      }),
    );

    const readiness = evaluateReadiness({
      checkedAt: "2026-09-16T16:10:00.000Z",
      liveness,
      dependencies,
    });

    assert.deepEqual(readiness.dependencies, dependencyOrder.map((dependency) => ({
      dependency,
      state: dependency === failedDependency ? "NotReady" : "Ready",
      checkedAt: dependencies[dependency].checkedAt,
      code: dependency === failedDependency ? errorCode : null,
    })));
    assert.equal(readiness.state, "NotReady");
    assert.equal(readiness.checkedAt, "2026-09-16T16:10:00.000Z");
    assert.equal(readiness.liveness, liveness);
    assert.equal(readiness.displayTimezone, "UTC");
    assert.equal(readiness.controllingError.code, errorCode);
    assert.ok(Object.isFrozen(readiness));
    assert.ok(Object.isFrozen(readiness.dependencies));
    assert.ok(readiness.dependencies.every(Object.isFrozen));
    assert.ok(Object.isFrozen(readiness.controllingError));
    assert.ok(Object.isFrozen(readiness.controllingError.boundedIdentifiers));
    assert.ok(Object.isFrozen(readiness.controllingError.recovery));
    assert.deepEqual(readiness.controllingError, {
      code: errorCode,
      message: "Application readiness is blocked. Review readiness details.",
      boundedIdentifiers: {},
      recovery: {
        actionId: "review-readiness",
        label: "Review readiness details",
        targetOperation: "ReadinessGet",
        focusTarget: "readiness-details",
        requiresConfirmation: false,
      },
    });
  }
});

test("PT-APP-001G Ready remains distinct from blocked analytical eligibility", () => {
  const checkedAt = "2026-09-16T16:20:00.000Z";
  const dependencies = Object.fromEntries(
    [...readinessDependencyNames].reverse().map((dependency, index) => [
      dependency,
      {
        ready: true,
        checkedAt: `2026-09-16T16:${String(index).padStart(2, "0")}:00.000Z`,
      },
    ]),
  );

  for (const liveness of ["Live", "NotLive"]) {
    const readiness = evaluateReadiness({ checkedAt, liveness, dependencies });

    assert.deepEqual(new Set(Object.keys(readiness)), new Set([
      "state",
      "checkedAt",
      "displayTimezone",
      "liveness",
      "dependencies",
      "controllingError",
    ]));
    assert.equal(readiness.state, "Ready");
    assert.equal(readiness.checkedAt, checkedAt);
    assert.equal(readiness.liveness, liveness);
    assert.equal(readiness.controllingError, null);
    assert.deepEqual(readiness.dependencies.map(({ dependency, state, code }) => ({
      dependency,
      state,
      code,
    })), readinessDependencyNames.map((dependency) => ({
      dependency,
      state: "Ready",
      code: null,
    })));
    for (const prohibitedClaim of [
      "providerRights",
      "fixtureFreshness",
      "analyticalValidity",
      "evidenceCompleteness",
      "ledgerReconciliation",
      "releaseReadiness",
    ]) {
      assert.equal(prohibitedClaim in readiness, false);
    }
  }
});

test("PT-APP-001H preserves owning codes with fixed redacted causes", () => {
  const vectors = [
    ["ORDER_INVALID_TRANSITION", "The paper order transition is not allowed."],
    ["ORDER_VERSION_CONFLICT", "The paper order changed. Reload the current order before retrying."],
    ["FIXTURE_REQUIRED_QUARANTINED", "Required fixture data is quarantined."],
    ["ANALYTICS_INPUT_INCOMPLETE", "Required analytical input is incomplete."],
    ["ANALYTICS_INPUT_STALE", "Required analytical input is stale."],
    ["ANALYTICS_INPUT_QUARANTINED", "Required analytical input is quarantined."],
    ["ANALYTICS_AMBIGUOUS_VINTAGE", "The analytical input vintage is ambiguous."],
    ["ANALYTICS_AMBIGUOUS_MARKET_REVISION", "The analytical market revision is ambiguous."],
    ["ANALYTICS_RIGHTS_RESTRICTED", "Provider rights do not permit the required analytical evidence."],
    ["ANALYTICS_INTEGRITY_FAILED", "Analytical evidence failed integrity verification."],
    ["ANALYTICS_EVIDENCE_ACCESS_DENIED", "Access to analytical evidence is denied."],
    ["ANALYTICS_PUBLICATION_BLOCKED", "Analytical publication is blocked."],
    ["ANALYTICS_NUMERIC_CLASS_INVALID", "An analytical numeric value is invalid."],
    ["ANALYTICS_CAPACITY_BLOCKED", "Analytical evidence capacity is exhausted."],
    ["ANALYTICS_EVIDENCE_COMMIT_FAILED", "Analytical evidence could not be committed."],
    ["ANALYTICS_DETERMINISM_FAILED", "Analytical reproducibility verification failed."],
    ["ANALYTICS_IDEMPOTENCY_CONFLICT", "The analytical evidence identity was reused with different content."],
    ["ANALYTICS_PUBLICATION_VERSION_CONFLICT", "The analytical publication changed before completion."],
    ["APPLICATION_REQUEST_INVALID", "The application request is invalid."],
    ["APPLICATION_IDEMPOTENCY_CONFLICT", "The application command identity was reused with different content."],
    ["APPLICATION_JOB_NOT_RESTARTABLE", "The job cannot be restarted."],
    ["APPLICATION_REDACTION_FAILED", "Safe diagnostic redaction could not be verified."],
    ["ORDER_IDEMPOTENCY_CONFLICT", "The paper order command identity was reused with different content."],
    ["FIXTURE_IDEMPOTENCY_CONFLICT", "The fixture identity was reused with different content."],
    ["ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED", "The analytics access denial could not be recorded."],
    ["LEDGER_INTEGRITY_FAILED", "Ledger integrity verification failed."],
    ["ORDER_GUARD_FAILED", "The paper order transition guard failed."],
    ["ORDER_TERMINAL_STATE", "The paper order is already in a terminal state."],
    ["ORDER_NOT_FOUND", "The paper order was not found."],
    ["LEDGER_VERSION_CONFLICT", "The ledger changed. Reload the current portfolio before retrying."],
  ];
  assert.deepEqual(ownerFailureCodes, vectors.map(([code]) => code));

  for (const [code, message] of vectors) {
    const error = presentOwnerFailure(code);

    assert.deepEqual(Object.keys(error), [
      "code",
      "message",
      "boundedIdentifiers",
      "recovery",
    ]);
    assert.deepEqual(error, {
      code,
      message,
      boundedIdentifiers: {},
      recovery: null,
    });
    assert.ok(Object.isFrozen(error));
    assert.ok(Object.isFrozen(error.boundedIdentifiers));
  }
});

test("PT-APP-001I presents canonical values without semantic drift", () => {
  const vectors = [
    ["OrderStatus", "Partial", "Partially Filled"],
    ["Readiness", "NotReady", "Not Ready"],
    ["UTCInstant", "2026-01-31T00:00:00.000Z", "2026-01-31 00:00:00.000 UTC"],
    ["SourceTime", "2026-01-30T22:00:00.000Z", "Source time: 2026-01-30 22:00:00.000 UTC"],
    ["RetrievedAt", "2026-01-30T22:01:00.000Z", "Retrieved at: 2026-01-30 22:01:00.000 UTC"],
    ["CompletedAt", "2026-01-31T00:00:00.000Z", "Completed at: 2026-01-31 00:00:00.000 UTC"],
    ["Timezone", "UTC", "Display timezone: UTC"],
    ["Date", "2026-01-30", "2026-01-30"],
    ["TradeDate", "2026-01-30", "Trade date: 2026-01-30"],
    ["UnitPrice", "100.0000000000", "100.0000000000"],
    ["Money", "1000.00000000", "1000.00000000"],
    ["Rate", "0.012500000000", "0.012500000000"],
  ];

  for (const [valueClass, wireValue, displayValue] of vectors) {
    const presentation = presentCanonicalValue(valueClass, wireValue);

    assert.deepEqual(presentation, {
      wireValue,
      visibleText: displayValue,
      accessibleText: displayValue,
    });
    assert.deepEqual(Object.keys(presentation), [
      "wireValue",
      "visibleText",
      "accessibleText",
    ]);
    assert.ok(Object.isFrozen(presentation));
  }
});

test("PT-APP-001J retains exact research warning metadata on refresh", () => {
  const warningText =
    "Research only — hypothetical — user makes all investment decisions.";

  for (const resultKind of ["AnalyticalResult", "Evidence", "PaperAction"]) {
    const initial = presentResearchWarning(resultKind);
    const refreshed = presentResearchWarning(resultKind);

    assert.deepEqual(initial, {
      researchWarningRequired: true,
      warningText,
    });
    assert.deepEqual(refreshed, initial);
    assert.ok(Object.isFrozen(initial));
    assert.deepEqual(Object.keys(initial), [
      "researchWarningRequired",
      "warningText",
    ]);
  }

  const nonAnalytical = presentResearchWarning("NonAnalytical");
  assert.deepEqual(nonAnalytical, {
    researchWarningRequired: false,
    warningText: null,
  });
  assert.ok(Object.isFrozen(nonAnalytical));
  assert.deepEqual(Object.keys(nonAnalytical), [
    "researchWarningRequired",
    "warningText",
  ]);
  assert.throws(
    () => presentResearchWarning("Unclassified"),
    /Research warning result kind is not supported/,
  );
});

test("PT-APP-001K exports only allowlisted metadata and fails closed", () => {
  const correlationId = "90000000-0000-4000-8000-000000000001";
  const configurationHash = "a".repeat(64);
  const created = [];
  const recordedFailures = [];
  const createExport = (records) => {
    created.push(records);
    return { exportId: "diagnostic-export-1", records };
  };
  const recordFailure = (failure) => recordedFailures.push(failure);

  const success = exportDiagnosticMetadata(
    [{
      code: "ANALYTICS_INPUT_INCOMPLETE",
      codes: ["ANALYTICS_INPUT_INCOMPLETE", "ANALYTICS_PUBLICATION_BLOCKED"],
      correlationId,
      datasetId: "golden-fixture",
      datasetVersion: "1.0.0",
      jobId: "90000000-0000-4000-8000-000000000002",
      status: "Failed",
      occurredAt: "2026-09-16T17:00:00.000Z",
      acceptedCount: 0,
      durationMs: 12,
      contractVersion: "1.0.0-candidate.2",
      configurationHash,
      password: "protected-password",
      rawProviderBytes: "protected-provider-bytes",
      stackTrace: "protected-stack",
      commandPayload: { token: "protected-token" },
    }],
    createExport,
    recordFailure,
  );

  assert.deepEqual(success, {
    outcome: "Succeeded",
    export: {
      exportId: "diagnostic-export-1",
      records: [{
        code: "ANALYTICS_INPUT_INCOMPLETE",
        codes: ["ANALYTICS_INPUT_INCOMPLETE", "ANALYTICS_PUBLICATION_BLOCKED"],
        correlationId,
        datasetId: "golden-fixture",
        datasetVersion: "1.0.0",
        jobId: "90000000-0000-4000-8000-000000000002",
        status: "Failed",
        occurredAt: "2026-09-16T17:00:00.000Z",
        acceptedCount: 0,
        durationMs: 12,
        contractVersion: "1.0.0-candidate.2",
        configurationHash,
      }],
    },
  });
  assert.equal(JSON.stringify(success).includes("protected"), false);
  assert.equal(created.length, 1);
  assert.equal(recordedFailures.length, 0);
  assert.ok(Object.isFrozen(success));
  assert.ok(Object.isFrozen(success.export));
  assert.ok(Object.isFrozen(created[0]));
  assert.ok(Object.isFrozen(created[0][0]));
  assert.ok(Object.isFrozen(created[0][0].codes));

  const failure = exportDiagnosticMetadata(
    [
      { correlationId, status: "Failed" },
      {
        correlationId: "90000000-0000-4000-8000-000000000003",
        unclassifiedDetail: "must-not-escape",
      },
    ],
    createExport,
    recordFailure,
  );

  assert.deepEqual(failure, {
    outcome: "Failed",
    error: {
      code: "APPLICATION_REDACTION_FAILED",
      boundedIdentifiers: {
        correlationId: "90000000-0000-4000-8000-000000000003",
      },
    },
  });
  assert.equal(created.length, 1);
  assert.deepEqual(recordedFailures, [failure.error]);
  assert.equal(JSON.stringify(failure).includes("must-not-escape"), false);
  assert.ok(Object.isFrozen(failure));
  assert.ok(Object.isFrozen(failure.error));
  assert.ok(Object.isFrozen(failure.error.boundedIdentifiers));

  for (const unsafeRecord of [
    { correlationId, status: { password: "protected-password" } },
    { correlationId, code: "protected-secret" },
    { correlationId, configurationHash: "protected-secret" },
  ]) {
    const unsafeFailure = exportDiagnosticMetadata(
      [unsafeRecord],
      createExport,
      recordFailure,
    );
    assert.equal(unsafeFailure.outcome, "Failed");
    assert.equal(JSON.stringify(unsafeFailure).includes("protected"), false);
  }
  assert.equal(created.length, 1);
  assert.equal(recordedFailures.length, 4);

  let prohibitedGetterReads = 0;
  const accessorRecord = { correlationId };
  Object.defineProperty(accessorRecord, "password", {
    enumerable: true,
    get() {
      prohibitedGetterReads += 1;
      return "protected-password";
    },
  });
  const accessorFailure = exportDiagnosticMetadata(
    [accessorRecord],
    createExport,
    recordFailure,
  );
  assert.equal(accessorFailure.outcome, "Failed");
  assert.equal(accessorFailure.error.code, "APPLICATION_REDACTION_FAILED");
  assert.equal(prohibitedGetterReads, 0);
});

test("PT-APP-001L blocked states expose perceivable explicit recovery", () => {
  const vectors = [
    {
      state: "FailedRestartable",
      context: { jobId: "73000000-0000-4000-8000-000000000001" },
      recovery: {
        actionId: "retry-job",
        label: "Retry job",
        targetOperation: "JobRestart",
        focusTarget: "job-status",
        requiresConfirmation: false,
      },
      payload: { jobId: "73000000-0000-4000-8000-000000000001" },
      announcement: "PoliteStatus",
    },
    {
      state: "FailedNotRestartable",
      context: { jobId: "73000000-0000-4000-8000-000000000002" },
      recovery: {
        actionId: "review-job",
        label: "Review job details",
        targetOperation: "JobGet",
        focusTarget: "job-details",
        requiresConfirmation: false,
      },
      payload: { jobId: "73000000-0000-4000-8000-000000000002" },
      announcement: "PoliteStatus",
    },
    {
      state: "InputQuarantined",
      context: { evidenceId: "73000000-0000-4000-8000-000000000003" },
      recovery: {
        actionId: "review-evidence",
        label: "Review data issue",
        targetOperation: "EvidenceGet",
        focusTarget: "evidence-details",
        requiresConfirmation: false,
      },
      payload: { evidenceId: "73000000-0000-4000-8000-000000000003" },
      announcement: "AssertiveAlert",
    },
    {
      state: "VersionConflict",
      context: { orderId: "73000000-0000-4000-8000-000000000004" },
      recovery: {
        actionId: "reload-order",
        label: "Reload current order",
        targetOperation: "PaperOrderGet",
        focusTarget: "order-details",
        requiresConfirmation: false,
      },
      payload: { orderId: "73000000-0000-4000-8000-000000000004" },
      announcement: "PoliteStatus",
    },
    {
      state: "IntegrityBlocked",
      context: {},
      recovery: {
        actionId: "review-integrity",
        label: "Review integrity status",
        targetOperation: "ReadinessGet",
        focusTarget: "readiness-details",
        requiresConfirmation: false,
      },
      payload: {},
      announcement: "AssertiveAlert",
    },
    {
      state: "NotReady",
      context: {},
      recovery: {
        actionId: "review-readiness",
        label: "Review readiness details",
        targetOperation: "ReadinessGet",
        focusTarget: "readiness-details",
        requiresConfirmation: false,
      },
      payload: {},
      announcement: "AssertiveAlert",
    },
    {
      state: "DraftAwaitingConfirmation",
      context: {
        orderId: "73000000-0000-4000-8000-000000000005",
        aggregateVersion: "4",
        confirmation: {
          actorId: "local-user",
          confirmedAt: "2026-01-30T12:00:00.000Z",
          confirmationText: "Submit paper order",
        },
      },
      recovery: {
        actionId: "submit-paper-order",
        label: "Submit paper order",
        targetOperation: "PaperOrderTransition",
        focusTarget: "order-status",
        requiresConfirmation: true,
      },
      payload: {
        orderId: "73000000-0000-4000-8000-000000000005",
        transitionCommandId: "73000000-0000-4000-8000-000000000006",
        expectedVersion: "4",
        transition: "OT-02",
        transitionPayload: {
          confirmation: {
            actorId: "local-user",
            confirmedAt: "2026-01-30T12:00:00.000Z",
            confirmationText: "Submit paper order",
          },
        },
      },
      announcement: "PoliteStatus",
    },
    {
      state: "MissingIdentity",
      context: {},
      recovery: null,
      payload: null,
      announcement: "PoliteStatus",
      causeText: "This item is no longer available. Return to the previous view to continue.",
    },
    {
      state: "AccessDenied",
      context: { orderId: "73000000-0000-4000-8000-000000000007" },
      recovery: null,
      payload: null,
      announcement: "AssertiveAlert",
      causeText: "Access to this item was denied. Verify local access before trying again.",
    },
    {
      state: "NoSafeOperation",
      context: { code: "APPLICATION_DEPENDENCY_UNAVAILABLE" },
      recovery: null,
      payload: null,
      announcement: "PoliteStatus",
      causeText: "This action cannot be completed safely. Review readiness details or contact the workspace owner.",
    },
  ];
  const dispatches = [];
  let commandIdsCreated = 0;
  const createTransitionCommandId = () => {
    commandIdsCreated += 1;
    return "73000000-0000-4000-8000-000000000006";
  };

  for (const vector of vectors) {
    const dispatchesBeforePresentation = dispatches.length;
    const commandIdsBeforePresentation = commandIdsCreated;
    const presented = presentBlockedState(
      { state: vector.state, context: vector.context },
      null,
    );
    assert.equal(dispatches.length, dispatchesBeforePresentation);
    assert.equal(commandIdsCreated, commandIdsBeforePresentation);
    assert.equal(presented.state, vector.state);
    assert.ok(presented.statusText.length > 0);
    assert.ok(presented.causeText.length > 0);
    if (vector.causeText !== undefined) {
      assert.equal(presented.causeText, vector.causeText);
    }
    assert.equal(presented.programmaticRole, vector.announcement === "AssertiveAlert" ? "alert" : "status");
    assert.equal(presented.announcement, vector.announcement);
    assert.deepEqual(presented.recovery, vector.recovery);
    assert.equal(presented.keyboardOperable, vector.recovery !== null);
    assert.deepEqual(presented.focusPlan, {
      processing: "trigger",
      validationFailure: "first-actionable-error",
      success: vector.recovery?.focusTarget ?? null,
    });
    assert.ok(Object.isFrozen(presented));
    assert.ok(Object.isFrozen(presented.focusPlan));
    if (presented.recovery !== null) {
      assert.ok(Object.isFrozen(presented.recovery));
    }

    const repeated = presentBlockedState(
      { state: vector.state, context: vector.context },
      vector.state,
    );
    assert.equal(repeated.announcement, "None");
    assert.equal(repeated.programmaticRole, presented.programmaticRole);
    assert.equal(dispatches.length, dispatchesBeforePresentation);
    assert.equal(commandIdsCreated, commandIdsBeforePresentation);

    for (const activationMethod of ["Keyboard", "Pointer"]) {
      const beforeDispatch = dispatches.length;
      const outcome = activateBlockedStateRecovery(
        { state: vector.state, context: vector.context },
        activationMethod,
        createTransitionCommandId,
        (operation, payload) => {
          dispatches.push({ operation, payload });
          return Object.freeze({ accepted: true });
        },
      );
      if (vector.recovery === null) {
        assert.deepEqual(outcome, { outcome: "NotDispatched" });
        assert.equal(dispatches.length, beforeDispatch);
      } else {
        assert.equal(outcome.outcome, "Dispatched");
        assert.equal(outcome.activationMethod, activationMethod);
        assert.deepEqual(dispatches.at(-1), {
          operation: vector.recovery.targetOperation,
          payload: vector.payload,
        });
      }
    }
  }

  assert.equal(commandIdsCreated, 2);
  assert.equal(dispatches.length, 14);
  assert.deepEqual(
    dispatches.filter(({ operation }) => operation === "PaperOrderTransition")[0],
    dispatches.filter(({ operation }) => operation === "PaperOrderTransition")[1],
  );
});

test("PT-APP-001M rejects malformed operation records before owner dispatch", () => {
  const vectors = [
    ["WatchlistPut", '{"displayName":"ETF A","expectedVersion":"0","instrumentId":"ETF-A"}', '{"expectedVersion":"0","instrumentId":"ETF-A"}'],
    ["WatchlistRemove", '{"expectedVersion":"1","instrumentId":"ETF-A"}', '{"expectedVersion":"1","instrumentId":"ETF-A","instrumentId":"ETF-B"}'],
    ["WatchlistReorder", '{"expectedVersion":"2","orderedInstrumentIds":["ETF-B","ETF-A"]}', '{"expectedVersion":"2","extra":true,"orderedInstrumentIds":["ETF-B","ETF-A"]}'],
    ["FixtureIngestionStart", '{"datasetId":"prices","datasetVersion":"2026-01-30","fixturePackageHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","jobId":"10000000-0000-4000-8000-000000000001"}', '{"datasetId":"prices","datasetVersion":"2026-01-30","fixturePackageHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","jobId":null}'],
    ["JobRestart", '{"jobId":"10000000-0000-4000-8000-000000000001"}', '{"jobId":"not-a-uuid"}'],
    ["AnalyticsRun", '{"asOfDate":"2026-01-30","configurationHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","evidenceCommandId":"20000000-0000-4000-8000-000000000002","inputEvidenceIds":["20000000-0000-4000-8000-000000000003"],"jobId":"20000000-0000-4000-8000-000000000001"}', '{"asOfDate":"2026-01-30","configurationHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","inputEvidenceIds":[],"jobId":"20000000-0000-4000-8000-000000000001"}'],
    ["PaperOrderDraftCreate", '{"instrumentId":"ETF-A","orderId":"30000000-0000-4000-8000-000000000001","quantity":"1.0000000000","researchEvidenceId":"30000000-0000-4000-8000-000000000002","side":"Buy","tradeDate":"2026-01-30","unitPrice":"100.0000000000"}', '{"extra":0,"instrumentId":"ETF-A","orderId":"30000000-0000-4000-8000-000000000001","quantity":"1.0000000000","researchEvidenceId":"30000000-0000-4000-8000-000000000002","side":"Buy","tradeDate":"2026-01-30","unitPrice":"100.0000000000"}'],
    ["PaperOrderTransition", '{"expectedVersion":"1","orderId":"30000000-0000-4000-8000-000000000001","transition":"OT-02","transitionCommandId":"30000000-0000-4000-8000-000000000003","transitionPayload":{"confirmation":{"actorId":"local-user","confirmationText":"Submit paper order","confirmedAt":"2026-01-30T12:00:00.000Z"}}}', '{"expectedVersion":null,"orderId":"30000000-0000-4000-8000-000000000001","transition":"OT-02","transitionCommandId":"30000000-0000-4000-8000-000000000003","transitionPayload":{}}'],
    ["DiagnosticsExportCreate", '{"exportId":"40000000-0000-4000-8000-000000000001","from":"2026-01-30T00:00:00.000Z","requestedCodes":["APPLICATION_REQUEST_INVALID"],"through":"2026-01-31T00:00:00.000Z"}', '{"exportId":"40000000-0000-4000-8000-000000000001","from":"yesterday","requestedCodes":[],"through":"2026-01-31T00:00:00.000Z"}'],
    ["WatchlistGet", '{}', '{"unexpected":true}'],
    ["JobGet", '{"jobId":"10000000-0000-4000-8000-000000000001"}', '{"jobId":null}'],
    ["ReadinessGet", '{}', '{"repair":true}'],
    ["AnalyticsResultGet", '{"publicationTargetId":"50000000-0000-4000-8000-000000000001"}', '{"publicationTargetId":"bad"}'],
    ["EvidenceGet", '{"evidenceId":"evidence-fixture-1"}', '{"evidenceId":42}'],
    ["PaperOrderGet", '{"orderId":"30000000-0000-4000-8000-000000000001"}', '{"orderId":"30000000-0000-4000-8000-000000000001","orderId":"30000000-0000-4000-8000-000000000002"}'],
    ["PortfolioGet", '{"asOf":"2026-01-31T00:00:00.000Z","portfolioId":"60000000-0000-4000-8000-000000000001"}', '{"asOf":"2026-01-31","portfolioId":"60000000-0000-4000-8000-000000000001"}'],
  ];
  const ownerCalls = [];

  for (const [operation, validPayload, malformedPayload] of vectors) {
    const result = dispatchValidatedApplicationRequest(
      operation,
      validPayload,
      (definition, payload) => {
        ownerCalls.push({ operation: definition.operation, payload });
        return definition.operation;
      },
    );
    assert.equal(result, operation);
    assert.deepEqual(ownerCalls.at(-1), {
      operation,
      payload: JSON.parse(validPayload),
    });
    assert.ok(Object.isFrozen(ownerCalls.at(-1).payload));

    const callsBeforeMalformed = ownerCalls.length;
    assert.throws(
      () => dispatchValidatedApplicationRequest(
        operation,
        malformedPayload,
        () => ownerCalls.push({ operation, malformedPayload }),
      ),
      (error) =>
        error instanceof ApplicationRequestInvalidError &&
        error.code === "APPLICATION_REQUEST_INVALID",
      operation,
    );
    assert.equal(ownerCalls.length, callsBeforeMalformed, operation);
  }

  assert.equal(
    dispatchValidatedApplicationRequest(
      "EvidenceGet",
      '{"evidenceId":"10000000-0000-4000-8000-000000000001"}',
      (_definition, payload) => payload.evidenceId,
    ),
    "10000000-0000-4000-8000-000000000001",
  );
  assert.equal(
    dispatchValidatedApplicationRequest(
      "JobGet",
      '{"jobId":"10000000-0000-7000-8000-000000000001"}',
      (_definition, payload) => payload.jobId,
    ),
    "10000000-0000-7000-8000-000000000001",
  );

  for (const malformedPayload of [
    '{"evidenceId":"first","e\\u0076idenceId":"second"}',
    '{"evidenceId":"unterminated}',
    '[{"evidenceId":"not-an-object"}]',
    '{"evidenceId":{"nested":"first","nested":"second"}}',
  ]) {
    const callsBeforeMalformed = ownerCalls.length;
    assert.throws(
      () => dispatchValidatedApplicationRequest(
        "EvidenceGet",
        malformedPayload,
        () => ownerCalls.push({ malformedPayload }),
      ),
      (error) => error instanceof ApplicationRequestInvalidError,
    );
    assert.equal(ownerCalls.length, callsBeforeMalformed);
  }

  const unsortedEvidenceIds = [
    "20000000-0000-4000-8000-000000000009",
    "20000000-0000-4000-8000-000000000003",
  ];
  const sortedAnalyticsPayload = dispatchValidatedApplicationRequest(
    "AnalyticsRun",
    JSON.stringify({
      jobId: "20000000-0000-4000-8000-000000000001",
      evidenceCommandId: "20000000-0000-4000-8000-000000000002",
      asOfDate: "2026-01-30",
      configurationHash: "b".repeat(64),
      inputEvidenceIds: unsortedEvidenceIds,
    }),
    (_definition, payload) => payload,
  );
  assert.deepEqual(sortedAnalyticsPayload.inputEvidenceIds, [...unsortedEvidenceIds].reverse());
  assert.ok(Object.isFrozen(sortedAnalyticsPayload.inputEvidenceIds));

  const transitionVectors = [
    ["OT-02", { confirmation: { actorId: "local-user", confirmedAt: "2026-01-30T12:00:00.000Z", confirmationText: "Submit paper order" } }, {}],
    ["OT-03", { portfolioId: "30000000-0000-4000-8000-000000000010", validationSnapshotId: "30000000-0000-4000-8000-000000000011", expectedPortfolioVersion: "1" }, { portfolioId: "bad", validationSnapshotId: "30000000-0000-4000-8000-000000000011", expectedPortfolioVersion: "1" }],
    ["OT-04", { rejectionCode: "PORTFOLIO_VALIDATION_FAILED" }, { reasonCode: "wrong-field" }],
    ["OT-05", { portfolioId: "30000000-0000-4000-8000-000000000010", transactionId: "30000000-0000-4000-8000-000000000012", fillId: "30000000-0000-4000-8000-000000000013", expectedPortfolioVersion: "1", quantity: "0.5000000000", unitPrice: "100.0000000000", fee: "0.00000000" }, { portfolioId: "30000000-0000-4000-8000-000000000010", transactionId: "30000000-0000-4000-8000-000000000012", fillId: "30000000-0000-4000-8000-000000000013", expectedPortfolioVersion: "1", quantity: "0.5", unitPrice: "100.0000000000", fee: "0.00000000" }],
    ["OT-06", { portfolioId: "30000000-0000-4000-8000-000000000010", transactionId: "30000000-0000-4000-8000-000000000012", fillId: "30000000-0000-4000-8000-000000000013", expectedPortfolioVersion: "1", quantity: "1.0000000000", unitPrice: "100.0000000000", fee: "0.00000000" }, { portfolioId: "30000000-0000-4000-8000-000000000010", transactionId: "bad", fillId: "30000000-0000-4000-8000-000000000013", expectedPortfolioVersion: "1", quantity: "1.0000000000", unitPrice: "100.0000000000", fee: "0.00000000" }],
    ["OT-07", { reasonCode: "USER_REQUESTED" }, { rejectionCode: "wrong-field" }],
    ["OT-08", { expiresAt: "2026-01-31T00:00:00.000Z" }, { expiresAt: "2026-01-31" }],
    ["OT-09", { portfolioId: "30000000-0000-4000-8000-000000000010", transactionId: "30000000-0000-4000-8000-000000000012", fillId: "30000000-0000-4000-8000-000000000013", expectedPortfolioVersion: "2", quantity: "0.5000000000", unitPrice: "100.0000000000", fee: "0.00000000" }, { portfolioId: "30000000-0000-4000-8000-000000000010", transactionId: "30000000-0000-4000-8000-000000000012", fillId: "30000000-0000-4000-8000-000000000013", expectedPortfolioVersion: "2", quantity: "0.5000000000", unitPrice: "100.0000000000", fee: "0" }],
    ["OT-10", { reasonCode: "USER_REQUESTED" }, {}],
  ];
  let transitionCalls = 0;
  for (const [transition, transitionPayload, malformedTransitionPayload] of transitionVectors) {
    const base = {
      orderId: "30000000-0000-4000-8000-000000000001",
      transitionCommandId: "30000000-0000-4000-8000-000000000003",
      expectedVersion: "1",
      transition,
    };
    dispatchValidatedApplicationRequest(
      "PaperOrderTransition",
      JSON.stringify({ ...base, transitionPayload }),
      () => { transitionCalls += 1; },
    );
    assert.throws(
      () => dispatchValidatedApplicationRequest(
        "PaperOrderTransition",
        JSON.stringify({ ...base, transitionPayload: malformedTransitionPayload }),
        () => { transitionCalls += 1; },
      ),
      (error) => error instanceof ApplicationRequestInvalidError,
      transition,
    );
  }
  assert.equal(transitionCalls, transitionVectors.length);

  assert.throws(
    () => dispatchValidatedApplicationRequest(
      "DiagnosticsExportCreate",
      '{"exportId":"40000000-0000-4000-8000-000000000001","from":"2026-02-01T00:00:00.000Z","requestedCodes":["APPLICATION_REQUEST_INVALID"],"through":"2026-01-31T00:00:00.000Z"}',
      () => ownerCalls.push({ inverted: true }),
    ),
    (error) => error instanceof ApplicationRequestInvalidError,
  );
});

test("PT-APP-001M validates exact success data and canonical collection order", () => {
  const watchlistItems = [
    { instrumentId: "ETF-B", displayName: "ETF B", validationState: "Valid", position: "1" },
    { instrumentId: "ETF-C", displayName: "ETF C", validationState: "Invalid", position: "0" },
    { instrumentId: "ETF-A", displayName: "ETF A", validationState: "Valid", position: "0" },
  ];
  const job = {
    jobId: "10000000-0000-4000-8000-000000000001",
    jobType: "FixtureIngestion",
    status: "Failed",
    restartability: "Restartable",
    attempt: "1",
    operation: "FixtureIngestionStart",
    originalCommandId: "10000000-0000-4000-8000-000000000002",
    inputIdentity: {
      datasetId: "prices",
      datasetVersion: "2026-01-30",
      fixturePackageHash: "a".repeat(64),
    },
    createdAt: "2026-01-30T00:00:00.000Z",
    startedAt: "2026-01-30T00:01:00.000Z",
    completedAt: "2026-01-30T00:02:00.000Z",
    checkpoint: null,
    acceptedCount: "0",
    rejectedCount: "1",
    controllingError: {
      code: "FIXTURE_REQUIRED_INPUT_MISSING",
      message: "Required fixture input is missing.",
      boundedIdentifiers: { jobId: "10000000-0000-4000-8000-000000000001" },
      recovery: {
        actionId: "retry-job",
        label: "Retry job",
        targetOperation: "JobRestart",
        focusTarget: "job-status",
        requiresConfirmation: false,
      },
    },
  };
  const readiness = {
    state: "NotReady",
    checkedAt: "2026-01-30T00:00:00.000Z",
    displayTimezone: "UTC",
    liveness: "Live",
    dependencies: [...readinessDependencyNames].reverse().map((dependency) => ({
      dependency,
      state: dependency === "PostgreSQL" ? "NotReady" : "Ready",
      checkedAt: "2026-01-30T00:00:00.000Z",
      code: dependency === "PostgreSQL" ? "APPLICATION_DATABASE_UNAVAILABLE" : null,
    })),
    controllingError: {
      code: "APPLICATION_DATABASE_UNAVAILABLE",
      message: "Application readiness is blocked. Review readiness details.",
      boundedIdentifiers: {},
      recovery: {
        actionId: "review-readiness",
        label: "Review readiness details",
        targetOperation: "ReadinessGet",
        focusTarget: "readiness-details",
        requiresConfirmation: false,
      },
    },
  };
  const order = {
    orderId: "30000000-0000-4000-8000-000000000001",
    instrumentId: "ETF-A",
    state: "Submitted",
    aggregateVersion: "2",
    researchEvidenceId: "30000000-0000-4000-8000-000000000002",
    side: "Buy",
    requestedQuantity: "1.0000000000",
    filledQuantity: "0.0000000000",
    openQuantity: "1.0000000000",
    unitPrice: "100.0000000000",
    tradeDate: "2026-01-30",
    confirmation: {
      actorId: "local-user",
      confirmedAt: "2026-01-30T12:00:00.000Z",
      confirmationText: "Submit paper order",
    },
    transitionHistory: [
      {
        transitionCommandId: "30000000-0000-4000-8000-000000000004",
        transition: "OT-02",
        sourceState: "Draft",
        targetState: "Submitted",
        trigger: "UserConfirmedPaperAction",
        occurredAt: "2026-01-30T12:00:00.000Z",
        actorId: "local-user",
        correlationId: "30000000-0000-4000-8000-000000000006",
        priorVersion: "1",
        resultingVersion: "2",
        baselineVersion: "v1.0.0",
      },
      {
        transitionCommandId: "30000000-0000-4000-8000-000000000003",
        transition: "OT-01",
        sourceState: "Initial",
        targetState: "Draft",
        trigger: "UserCreatedFromResearch",
        occurredAt: "2026-01-30T11:00:00.000Z",
        actorId: "local-user",
        correlationId: "30000000-0000-4000-8000-000000000005",
        priorVersion: "0",
        resultingVersion: "1",
        baselineVersion: "v1.0.0",
      },
    ],
  };
  const diagnosticExport = {
    exportId: "40000000-0000-4000-8000-000000000001",
    createdAt: "2026-01-31T00:00:00.000Z",
    codes: ["LEDGER_INTEGRITY_FAILED", "APPLICATION_REQUEST_INVALID"],
    itemCount: "2",
    contentHash: "c".repeat(64),
  };
  const portfolio = {
    portfolioId: "60000000-0000-4000-8000-000000000001",
    portfolioVersion: "2",
    asOf: "2026-01-31T00:00:00.000Z",
    valuationSnapshotId: "60000000-0000-4000-8000-000000000002",
    precisionPolicyVersion: "DEC-014",
    baselineVersion: "v1.0.0",
    cash: "1000.00000000",
    lots: [
      { lotId: "60000000-0000-4000-8000-000000000004", instrumentId: "ETF-B", acquiredAt: "2026-01-30T12:00:00.000Z", ledgerSequence: "2", openQuantity: "1.0000000000", openBasis: "100.00000000" },
      { lotId: "60000000-0000-4000-8000-000000000003", instrumentId: "ETF-A", acquiredAt: "2026-01-30T11:00:00.000Z", ledgerSequence: "1", openQuantity: "2.0000000000", openBasis: "200.00000000" },
    ],
    positions: [
      { instrumentId: "ETF-B", quantity: "1.0000000000", basis: "100.00000000", valuation: "110.00000000", unrealizedPnL: "10.00000000" },
      { instrumentId: "ETF-A", quantity: "2.0000000000", basis: "200.00000000", valuation: "220.00000000", unrealizedPnL: "20.00000000" },
    ],
    realizedPnL: "0.00000000",
    totalEquity: "1330.00000000",
    reconciliationState: "Reconciled",
  };
  const analyticsResult = Object.freeze({
    domain: "etf.analytics.result.v1",
    resultSchemaVersion: "1.0.0",
    configurationHash: "b".repeat(64),
    signals: Object.freeze([]),
    trades: Object.freeze([]),
    metrics: Object.freeze([]),
    warnings: Object.freeze([]),
  });
  const evidence = Object.freeze({
    domain: "etf.analytics.bundle.v1",
    evidenceSchemaVersion: "1.0.0",
    evidenceId: "evidence-fixture-1",
    baselineVersion: "v1.0.0",
    inputSetId: "input-fixture-1",
    evaluationAt: "2026-01-31T00:00:00.000Z",
    ruleId: "p0-rule",
    ruleVersion: "1.0.0",
    parameters: Object.freeze({ lookbackSessions: "20" }),
    codeHash: "1".repeat(64),
    seed: "42",
    benchmark: Object.freeze({ instrumentId: "BENCH-1", version: "1" }),
    providerPolicyReferences: Object.freeze(["fixture-policy-1"]),
    environment: Object.freeze({ dependencyLockHash: "2".repeat(64), runtime: "node-20" }),
    assumptions: Object.freeze({
      costRate: "0.001000000000",
      fillTiming: "next-session-open",
      slippageRate: "0.000500000000",
    }),
    result: analyticsResult,
    inputHash: "3".repeat(64),
    configurationHash: "b".repeat(64),
    resultHash: "4".repeat(64),
    bundleHash: "5".repeat(64),
    reproducibilityStatus: "Complete",
    reproducibilityReason: null,
    retentionPolicyVersion: "RET-A-1.0",
    retentionEpoch: "2026-01-31T00:00:00.000Z",
  });
  const analyticsJob = {
    ...job,
    jobId: "20000000-0000-4000-8000-000000000001",
    jobType: "Analytics",
    operation: "AnalyticsRun",
    inputIdentity: {
      evidenceCommandId: "20000000-0000-4000-8000-000000000002",
      asOfDate: "2026-01-30",
      configurationHash: "b".repeat(64),
      inputEvidenceIds: [
        "20000000-0000-4000-8000-000000000009",
        "20000000-0000-4000-8000-000000000003",
      ],
    },
  };
  const vectors = [
    ["WatchlistPut", { item: watchlistItems[0], version: "2" }],
    ["WatchlistRemove", { version: "2" }],
    ["WatchlistReorder", { orderedItems: watchlistItems, version: "2" }],
    ["FixtureIngestionStart", { job }],
    ["JobRestart", { job }],
    ["AnalyticsRun", { job }],
    ["PaperOrderDraftCreate", { order }],
    ["PaperOrderTransition", { order }],
    ["DiagnosticsExportCreate", { export: diagnosticExport }],
    ["WatchlistGet", { orderedItems: watchlistItems, version: "2" }],
    ["JobGet", { job }],
    ["ReadinessGet", { readiness }],
    ["AnalyticsResultGet", { result: analyticsResult }],
    ["EvidenceGet", { evidence }],
    ["PaperOrderGet", { order }],
    ["PortfolioGet", { portfolio }],
  ];

  for (const [operation, data] of vectors) {
    let validated;
    assert.doesNotThrow(() => {
      validated = validateApplicationSuccessData(operation, data);
    }, operation);
    assert.ok(Object.isFrozen(validated), operation);
    assert.deepEqual(Object.keys(validated).sort(), Object.keys(data).sort(), operation);
    assert.throws(
      () => validateApplicationSuccessData(operation, { ...data, extra: true }),
      (error) =>
        error instanceof ApplicationResultInvalidError &&
        error.code === "APPLICATION_RESULT_INVALID",
      operation,
    );
  }

  assert.deepEqual(
    validateApplicationSuccessData("WatchlistGet", { orderedItems: watchlistItems, version: "2" })
      .orderedItems.map(({ instrumentId }) => instrumentId),
    ["ETF-A", "ETF-C", "ETF-B"],
  );
  assert.deepEqual(
    validateApplicationSuccessData("ReadinessGet", { readiness }).readiness.dependencies
      .map(({ dependency }) => dependency),
    readinessDependencyNames,
  );
  assert.deepEqual(
    validateApplicationSuccessData("PaperOrderGet", { order }).order.transitionHistory
      .map(({ resultingVersion }) => resultingVersion),
    ["1", "2"],
  );
  assert.deepEqual(
    validateApplicationSuccessData("DiagnosticsExportCreate", { export: diagnosticExport }).export.codes,
    ["APPLICATION_REQUEST_INVALID", "LEDGER_INTEGRITY_FAILED"],
  );
  const orderedPortfolio = validateApplicationSuccessData("PortfolioGet", { portfolio }).portfolio;
  assert.deepEqual(orderedPortfolio.lots.map(({ instrumentId }) => instrumentId), ["ETF-A", "ETF-B"]);
  assert.deepEqual(orderedPortfolio.positions.map(({ instrumentId }) => instrumentId), ["ETF-A", "ETF-B"]);
  assert.equal(validateApplicationSuccessData("AnalyticsResultGet", { result: analyticsResult }).result, analyticsResult);
  assert.equal(validateApplicationSuccessData("EvidenceGet", { evidence }).evidence, evidence);
  assert.deepEqual(
    validateApplicationSuccessData("AnalyticsRun", { job: analyticsJob }).job
      .inputIdentity.inputEvidenceIds,
    [
      "20000000-0000-4000-8000-000000000003",
      "20000000-0000-4000-8000-000000000009",
    ],
  );

  const composed = dispatchValidatedApplicationOperation(
    "WatchlistGet",
    "{}",
    () => ({ orderedItems: watchlistItems, version: "2" }),
  );
  assert.deepEqual(
    composed.orderedItems.map(({ instrumentId }) => instrumentId),
    ["ETF-A", "ETF-C", "ETF-B"],
  );
  assert.throws(
    () => dispatchValidatedApplicationOperation(
      "WatchlistGet",
      "{}",
      () => ({ orderedItems: watchlistItems, version: "2", extra: true }),
    ),
    (error) => error instanceof ApplicationResultInvalidError,
  );

  assert.throws(
    () => validateApplicationSuccessData("WatchlistGet", {
      orderedItems: [{ ...watchlistItems[0], secret: "must-not-pass" }],
      version: "2",
    }),
    (error) => error instanceof ApplicationResultInvalidError,
  );
  let resultGetterReads = 0;
  const accessorItem = { ...watchlistItems[0] };
  Object.defineProperty(accessorItem, "displayName", {
    enumerable: true,
    get() {
      resultGetterReads += 1;
      return "ETF A";
    },
  });
  const symbolItem = { ...watchlistItems[0] };
  symbolItem[Symbol("capability")] = () => undefined;
  const hiddenItem = { ...watchlistItems[0] };
  Object.defineProperty(hiddenItem, "hidden", { value: "must-not-pass" });
  for (const [label, orderedItems] of [
    ["accessor", [accessorItem]],
    ["symbol", [symbolItem]],
    ["hidden", [hiddenItem]],
    ["sparse", new Array(1)],
  ]) {
    assert.throws(
      () => validateApplicationSuccessData("WatchlistGet", { orderedItems, version: "2" }),
      (error) => error instanceof ApplicationResultInvalidError,
      label,
    );
  }
  assert.equal(resultGetterReads, 0);

  assert.throws(
    () => validateApplicationSuccessData("PaperOrderGet", {
      order: {
        ...order,
        transitionHistory: [{
          ...order.transitionHistory[0],
          sourceState: "Filled",
        }],
      },
    }),
    (error) => error instanceof ApplicationResultInvalidError,
  );
  for (const contradictoryJob of [
    { ...job, status: "Succeeded", controllingError: job.controllingError },
    { ...job, status: "Failed", completedAt: null },
    { ...job, status: "Running", startedAt: null, completedAt: null, controllingError: null },
    { ...job, attempt: "0" },
    {
      ...job,
      checkpoint: {
        checkpointId: "10000000-0000-4000-8000-000000000003",
        attempt: "2",
        sequence: "1",
        committedAt: "2026-01-30T00:01:30.000Z",
        contentHash: "b".repeat(64),
      },
    },
    {
      ...job,
      controllingError: { ...job.controllingError, message: "secret database host" },
    },
    {
      ...job,
      controllingError: {
        ...job.controllingError,
        boundedIdentifiers: { password: "must-not-pass" },
      },
    },
    {
      ...job,
      controllingError: {
        ...job.controllingError,
        recovery: {
          ...job.controllingError.recovery,
          label: "Run arbitrary command",
          targetOperation: "DiagnosticsExportCreate",
        },
      },
    },
    {
      ...job,
      controllingError: {
        ...job.controllingError,
        recovery: {
          actionId: "review-job",
          label: "Review job details",
          targetOperation: "JobGet",
          focusTarget: "job-details",
          requiresConfirmation: false,
        },
      },
    },
  ]) {
    assert.throws(
      () => validateApplicationSuccessData("JobGet", { job: contradictoryJob }),
      (error) => error instanceof ApplicationResultInvalidError,
    );
  }
  for (const contradictoryReadiness of [
    { ...readiness, state: "Ready", controllingError: null },
    {
      ...readiness,
      dependencies: readiness.dependencies.map((dependency) => ({
        ...dependency,
        state: "Ready",
        code: null,
      })),
    },
    {
      ...readiness,
      dependencies: readiness.dependencies.map((dependency) =>
        dependency.dependency === "PostgreSQL"
          ? { ...dependency, code: "ORDER_VERSION_CONFLICT" }
          : dependency
      ),
      controllingError: {
        ...readiness.controllingError,
        code: "ORDER_VERSION_CONFLICT",
        message: "The paper order changed. Reload the current order before retrying.",
      },
    },
    {
      ...readiness,
      controllingError: {
        ...readiness.controllingError,
        code: "APPLICATION_MIGRATIONS_INCOMPLETE",
        message: "Required database migrations are incomplete.",
      },
    },
  ]) {
    assert.throws(
      () => validateApplicationSuccessData("ReadinessGet", {
        readiness: contradictoryReadiness,
      }),
      (error) => error instanceof ApplicationResultInvalidError,
    );
  }
  assert.throws(
    () => validateApplicationSuccessData("DiagnosticsExportCreate", {
      export: { ...diagnosticExport, codes: [] },
    }),
    (error) => error instanceof ApplicationResultInvalidError,
  );
  assert.throws(
    () => validateApplicationSuccessData("PortfolioGet", {
      portfolio: { ...portfolio, reconciliationState: "IntegrityBlocked" },
    }),
    (error) => error instanceof ApplicationResultInvalidError,
  );
  assert.doesNotThrow(() => validateApplicationSuccessData("PortfolioGet", {
    portfolio: {
      ...portfolio,
      reconciliationState: "IntegrityBlocked",
      cash: "0.00000000",
      lots: [],
      positions: [],
      realizedPnL: "0.00000000",
      totalEquity: "0.00000000",
    },
  }));
  for (const [operation, data] of [
    ["AnalyticsResultGet", { result: Object.freeze({ ...analyticsResult, secret: "no" }) }],
    ["AnalyticsResultGet", { result: Object.freeze({ ...analyticsResult, domain: "wrong" }) }],
    ["EvidenceGet", { evidence: Object.freeze({ ...evidence, secret: "no" }) }],
    ["EvidenceGet", { evidence: Object.freeze({ ...evidence, evidenceSchemaVersion: "unknown" }) }],
  ]) {
    assert.throws(
      () => validateApplicationSuccessData(operation, data),
      (error) => error instanceof ApplicationResultInvalidError,
      operation,
    );
  }
  const opaqueClassInstance = Object.freeze(new class {
    evidenceSchemaVersion = "1.0.0-candidate.2";
  }());
  assert.throws(
    () => validateApplicationSuccessData("EvidenceGet", { evidence: opaqueClassInstance }),
    (error) => error instanceof ApplicationResultInvalidError,
  );
  const nullPrototypeEvidence = Object.freeze(Object.assign(Object.create(null), {
    evidenceSchemaVersion: "1.0.0-candidate.2",
  }));
  assert.throws(
    () => validateApplicationSuccessData("EvidenceGet", { evidence: nullPrototypeEvidence }),
    (error) => error instanceof ApplicationResultInvalidError,
  );
  const circularEvidence = { evidenceSchemaVersion: "1.0.0-candidate.2" };
  circularEvidence.self = circularEvidence;
  Object.freeze(circularEvidence);
  assert.throws(
    () => validateApplicationSuccessData("EvidenceGet", { evidence: circularEvidence }),
    (error) => error instanceof ApplicationResultInvalidError,
  );
  let opaqueAccessorReads = 0;
  const accessorArray = [];
  Object.defineProperty(accessorArray, "0", {
    enumerable: true,
    get() {
      opaqueAccessorReads += 1;
      return {};
    },
  });
  Object.freeze(accessorArray);
  const symbolArray = [];
  symbolArray[Symbol("capability")] = "no";
  Object.freeze(symbolArray);
  const hiddenArray = [];
  Object.defineProperty(hiddenArray, "hidden", { value: "no" });
  Object.freeze(hiddenArray);
  const cyclicArray = [];
  cyclicArray.push(cyclicArray);
  Object.freeze(cyclicArray);
  let proxyArrayReads = 0;
  const proxyArray = new Proxy(Object.freeze([]), {
    get(target, property, receiver) {
      proxyArrayReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  for (const [label, metrics] of [
    ["accessor", accessorArray],
    ["symbol", symbolArray],
    ["hidden", hiddenArray],
    ["function", Object.freeze([() => undefined])],
    ["sparse", Object.freeze(new Array(1))],
    ["cycle", cyclicArray],
    ["non-plain nested", Object.freeze([Object.freeze(new Date(0))])],
  ]) {
    assert.throws(
      () => validateApplicationSuccessData("AnalyticsResultGet", {
        result: Object.freeze({ ...analyticsResult, metrics }),
      }),
      (error) => error instanceof ApplicationResultInvalidError,
      label,
    );
  }
  assert.throws(
    () => validateApplicationSuccessData("AnalyticsResultGet", {
      result: Object.freeze({ ...analyticsResult, metrics: proxyArray }),
    }),
    (error) => error instanceof ApplicationResultInvalidError,
  );
  assert.equal(opaqueAccessorReads, 0);
  assert.equal(proxyArrayReads, 0);
});

test("PT-APP-001N keeps application and owning replay identities distinct", () => {
  const replayStore = createInMemoryApplicationReplayStore();
  const originalResult = Object.freeze({ outcome: "Succeeded", marker: "original" });
  const originalRequest = {
    operation: "PaperOrderTransition",
    requestId: "71000000-0000-4000-8000-000000000001",
    correlationId: "71000000-0000-4000-8000-000000000002",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-01-30T12:00:00.000Z",
    commandId: "70000000-0000-4000-8000-000000000001",
    payload: {
      orderId: "30000000-0000-4000-8000-000000000001",
      transitionCommandId: "70000000-0000-4000-8000-000000000002",
      expectedVersion: "1",
      transition: "OT-02",
      transitionPayload: {
        confirmation: {
          actorId: "local-user",
          confirmedAt: "2026-01-30T12:00:00.000Z",
          confirmationText: "Submit paper order",
        },
      },
    },
  };
  const expectedCanonicalContent = '{"actorId":"local-user","contractVersion":"1.0.0-candidate.2","operation":"PaperOrderTransition","payload":{"expectedVersion":"1","orderId":"30000000-0000-4000-8000-000000000001","transition":"OT-02","transitionCommandId":"70000000-0000-4000-8000-000000000002","transitionPayload":{"confirmation":{"actorId":"local-user","confirmationText":"Submit paper order","confirmedAt":"2026-01-30T12:00:00.000Z"}}},"prototypeCandidate":"v1.0.0-prototype.1"}';
  let readinessCalls = 0;
  let ownerCalls = 0;
  const admittedCanonicalContent = [];
  const dispatch = (request, result = originalResult) =>
    dispatchReplayProtectedApplicationCommand(
      JSON.stringify(request),
      replayStore,
      ({ canonicalContent }) => {
        readinessCalls += 1;
        admittedCanonicalContent.push(canonicalContent);
      },
      () => {
        ownerCalls += 1;
        if (result instanceof Error) throw result;
        return result;
      },
    );

  assert.equal(dispatch(originalRequest), originalResult);
  assert.equal(dispatch({
    ...originalRequest,
    requestId: "71000000-0000-4000-8000-000000000003",
    correlationId: "71000000-0000-4000-8000-000000000004",
    requestedAt: "2026-01-30T12:01:00.000Z",
  }), originalResult);
  assert.equal(readinessCalls, 1);
  assert.equal(ownerCalls, 1);
  assert.deepEqual(admittedCanonicalContent, [expectedCanonicalContent]);

  assert.throws(
    () => dispatch({
      ...originalRequest,
      requestId: "71000000-0000-4000-8000-000000000005",
      correlationId: "71000000-0000-4000-8000-000000000006",
      requestedAt: "2026-01-30T12:02:00.000Z",
      payload: {
        ...originalRequest.payload,
        transitionPayload: {
          confirmation: {
            ...originalRequest.payload.transitionPayload.confirmation,
            confirmationText: "Submit changed paper order",
          },
        },
      },
    }),
    (error) => error.code === "APPLICATION_IDEMPOTENCY_CONFLICT",
  );
  assert.equal(readinessCalls, 1);
  assert.equal(ownerCalls, 1);

  assert.throws(
    () => dispatch({
      ...originalRequest,
      requestId: "71000000-0000-4000-8000-000000000009",
      payload: {
        ...originalRequest.payload,
        expectedVersion: null,
      },
    }),
    (error) => error.code === "APPLICATION_REQUEST_INVALID",
  );
  assert.equal(readinessCalls, 1);
  assert.equal(ownerCalls, 1);

  assert.throws(
    () => dispatch({
      ...originalRequest,
      requestId: "71000000-0000-4000-8000-000000000012",
      payload: {
        ...originalRequest.payload,
        expectedVersion: "9007199254740992",
      },
    }),
    (error) => error.code === "APPLICATION_REQUEST_INVALID",
  );
  assert.equal(readinessCalls, 1);
  assert.equal(ownerCalls, 1);

  const ownerConflict = Object.assign(new Error("Owner conflict"), {
    code: "ORDER_IDEMPOTENCY_CONFLICT",
  });
  assert.throws(
    () => dispatch({
      ...originalRequest,
      requestId: "71000000-0000-4000-8000-000000000007",
      correlationId: "71000000-0000-4000-8000-000000000008",
      requestedAt: "2026-01-30T12:03:00.000Z",
      commandId: "70000000-0000-4000-8000-000000000003",
      payload: {
        ...originalRequest.payload,
        transitionPayload: {
          confirmation: {
            ...originalRequest.payload.transitionPayload.confirmation,
            confirmationText: "Submit owner-conflicting paper order",
          },
        },
      },
    }, ownerConflict),
    (error) => error === ownerConflict,
  );
  assert.equal(readinessCalls, 2);
  assert.equal(ownerCalls, 2);
  assert.notEqual(admittedCanonicalContent[1], expectedCanonicalContent);
  assert.throws(
    () => dispatch({
      ...originalRequest,
      requestId: "71000000-0000-4000-8000-000000000010",
      correlationId: "71000000-0000-4000-8000-000000000011",
      requestedAt: "2026-01-30T12:04:00.000Z",
      commandId: "70000000-0000-4000-8000-000000000003",
      payload: {
        ...originalRequest.payload,
        transitionPayload: {
          confirmation: {
            ...originalRequest.payload.transitionPayload.confirmation,
            confirmationText: "Submit owner-conflicting paper order",
          },
        },
      },
    }),
    (error) => error === ownerConflict,
  );
  assert.equal(readinessCalls, 2);
  assert.equal(ownerCalls, 2);
});

test("PT-APP-001N rejects malformed envelopes and canonicalizes normalized payloads", () => {
  const commandId = "74000000-0000-4000-8000-000000000001";
  const envelope = (operation, payload, overrides = {}) => ({
    operation,
    requestId: "74000000-0000-4000-8000-000000000002",
    correlationId: "74000000-0000-4000-8000-000000000003",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-01-30T12:00:00.000Z",
    commandId,
    payload,
    ...overrides,
  });
  const replayStore = createInMemoryApplicationReplayStore();
  let readinessCalls = 0;
  let ownerCalls = 0;
  const admittedPayloads = [];
  const dispatchJson = (requestJson, result = Object.freeze({ outcome: "Succeeded" })) =>
    dispatchReplayProtectedApplicationCommand(
      requestJson,
      replayStore,
      () => { readinessCalls += 1; },
      ({ payload }) => {
        ownerCalls += 1;
        admittedPayloads.push(payload);
        if (result instanceof Error) throw result;
        return result;
      },
    );

  const watchlistPayload = { instrumentId: "ETF-A", expectedVersion: "1" };
  for (const malformedRequestJson of [
    JSON.stringify(envelope("WatchlistRemove", watchlistPayload, { actorId: null })),
    JSON.stringify(envelope("WatchlistRemove", watchlistPayload, { requestedAt: "2026-01-30" })),
    JSON.stringify({ ...envelope("WatchlistRemove", watchlistPayload), extra: true }),
    JSON.stringify(envelope("WatchlistGet", {})),
    '{"operation":"WatchlistRemove","requestId":"74000000-0000-4000-8000-000000000002","correlationId":"74000000-0000-4000-8000-000000000003","actorId":"local-user","prototypeCandidate":"v1.0.0-prototype.1","contractVersion":"1.0.0-candidate.2","requestedAt":"2026-01-30T12:00:00.000Z","commandId":"74000000-0000-4000-8000-000000000001","commandId":"74000000-0000-4000-8000-000000000004","payload":{"instrumentId":"ETF-A","expectedVersion":"1"}}',
  ]) {
    assert.throws(
      () => dispatchJson(malformedRequestJson),
      (error) => error instanceof ApplicationRequestInvalidError,
    );
  }
  assert.equal(readinessCalls, 0);
  assert.equal(ownerCalls, 0);

  dispatchJson(JSON.stringify(envelope("WatchlistRemove", watchlistPayload)));
  dispatchJson(JSON.stringify(envelope("WatchlistPut", {
    instrumentId: "ETF-A",
    displayName: "ETF A",
    expectedVersion: "1",
  })));
  assert.equal(ownerCalls, 2);

  const retryCommand = envelope("WatchlistRemove", watchlistPayload, {
    commandId: "74000000-0000-4000-8000-000000000005",
  });
  const ownerFailure = new Error("transient owner failure");
  assert.throws(() => dispatchJson(JSON.stringify(retryCommand), ownerFailure), (error) => error === ownerFailure);
  assert.throws(() => dispatchJson(JSON.stringify(retryCommand)), (error) => error === ownerFailure);
  assert.equal(ownerCalls, 3);

  const analyticsBase = envelope("AnalyticsRun", {
    jobId: "74000000-0000-4000-8000-000000000010",
    evidenceCommandId: "74000000-0000-4000-8000-000000000011",
    asOfDate: "2026-01-30",
    configurationHash: "c".repeat(64),
    inputEvidenceIds: [
      "74000000-0000-4000-8000-000000000013",
      "74000000-0000-4000-8000-000000000012",
    ],
  }, { commandId: "74000000-0000-4000-8000-000000000014" });
  const analyticsResult = Object.freeze({ outcome: "Succeeded", job: "analytics" });
  assert.equal(dispatchJson(JSON.stringify(analyticsBase), analyticsResult), analyticsResult);
  assert.deepEqual(admittedPayloads.at(-1).inputEvidenceIds, [
    "74000000-0000-4000-8000-000000000012",
    "74000000-0000-4000-8000-000000000013",
  ]);
  assert.equal(
    dispatchJson(JSON.stringify({
      ...analyticsBase,
      requestId: "74000000-0000-4000-8000-000000000015",
      payload: {
        ...analyticsBase.payload,
        inputEvidenceIds: [...analyticsBase.payload.inputEvidenceIds].reverse(),
      },
    })),
    analyticsResult,
  );
  assert.equal(ownerCalls, 4);
});

test("PT-APP-001N fails closed on synchronous same-key reentrancy", () => {
  const replayStore = createInMemoryApplicationReplayStore();
  const requestJson = JSON.stringify({
    operation: "WatchlistRemove",
    requestId: "75000000-0000-4000-8000-000000000001",
    correlationId: "75000000-0000-4000-8000-000000000002",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-01-30T12:00:00.000Z",
    commandId: "75000000-0000-4000-8000-000000000003",
    payload: { instrumentId: "ETF-A", expectedVersion: "1" },
  });
  let readinessCalls = 0;
  let ownerCalls = 0;
  const dispatch = () => dispatchReplayProtectedApplicationCommand(
    requestJson,
    replayStore,
    () => { readinessCalls += 1; },
    () => {
      ownerCalls += 1;
      if (ownerCalls === 1) return dispatch();
      return Object.freeze({ outcome: "Duplicated" });
    },
  );

  let firstError;
  assert.throws(
    dispatch,
    (error) => {
      firstError = error;
      return error.name === "ApplicationReplayInProgressError";
    },
  );
  assert.equal(readinessCalls, 1);
  assert.equal(ownerCalls, 1);
  assert.throws(dispatch, (error) => error === firstError);
  assert.equal(readinessCalls, 1);
  assert.equal(ownerCalls, 1);
});

test("PT-APP-001O selects one deterministic controlling error", () => {
  const requestId = (suffix) => `72000000-0000-4000-8000-${suffix}`;
  const candidate = (phase, code, requestIdentity, overrides = {}) => ({
    phase,
    code,
    operation: "PaperOrderTransition",
    requestId: requestIdentity,
    ...overrides,
  });
  const vectors = [
    [
      candidate("Operation", "APPLICATION_OPERATION_UNKNOWN", requestId("000000000001"), { operation: "Unknown" }),
      candidate("Request", "APPLICATION_REQUEST_INVALID", requestId("000000000001")),
      "APPLICATION_OPERATION_UNKNOWN",
      requestId("000000000001"),
    ],
    [
      candidate("Request", "APPLICATION_REQUEST_INVALID", requestId("000000000002")),
      candidate("Authorization", "APPLICATION_UNAUTHORIZED", requestId("000000000002")),
      "APPLICATION_REQUEST_INVALID",
      requestId("000000000002"),
    ],
    [
      candidate("Authorization", "APPLICATION_UNAUTHORIZED", requestId("000000000003")),
      candidate("Replay", "APPLICATION_IDEMPOTENCY_CONFLICT", requestId("000000000003")),
      "APPLICATION_UNAUTHORIZED",
      requestId("000000000003"),
    ],
    [
      candidate("Replay", "APPLICATION_IDEMPOTENCY_CONFLICT", requestId("000000000004")),
      candidate("Admission", "APPLICATION_DATABASE_UNAVAILABLE", requestId("000000000004")),
      "APPLICATION_IDEMPOTENCY_CONFLICT",
      requestId("000000000004"),
    ],
    [
      candidate("Admission", "APPLICATION_MIGRATIONS_INCOMPLETE", requestId("000000000005")),
      candidate("Admission", "APPLICATION_DATABASE_UNAVAILABLE", requestId("000000000005")),
      "APPLICATION_DATABASE_UNAVAILABLE",
      requestId("000000000005"),
    ],
    [
      candidate("Admission", "APPLICATION_DATABASE_UNAVAILABLE", requestId("000000000006")),
      candidate("Owner", "ORDER_IDEMPOTENCY_CONFLICT", requestId("000000000006"), { ownerRank: 10 }),
      "APPLICATION_DATABASE_UNAVAILABLE",
      requestId("000000000006"),
    ],
    [
      candidate("Owner", "ANALYTICS_INPUT_INCOMPLETE", requestId("000000000007"), { ownerRank: 40 }),
      candidate("Owner", "ANALYTICS_INTEGRITY_FAILED", requestId("000000000007"), { ownerRank: 80 }),
      "ANALYTICS_INPUT_INCOMPLETE",
      requestId("000000000007"),
    ],
    [
      candidate("Owner", "ORDER_IDEMPOTENCY_CONFLICT", requestId("000000000008"), { ownerRank: 10 }),
      candidate("Persistence", "APPLICATION_PERSISTENCE_FAILED", requestId("000000000008")),
      "ORDER_IDEMPOTENCY_CONFLICT",
      requestId("000000000008"),
    ],
    [
      candidate("Persistence", "APPLICATION_PERSISTENCE_FAILED", requestId("000000000009")),
      candidate("Result", "APPLICATION_RESULT_INVALID", requestId("000000000009")),
      "APPLICATION_PERSISTENCE_FAILED",
      requestId("000000000009"),
    ],
    [
      candidate("Operation", "APPLICATION_OPERATION_UNKNOWN", requestId("000000000011"), { operation: undefined }),
      candidate("Operation", "APPLICATION_OPERATION_UNKNOWN", requestId("000000000010"), { operation: "invalid" }),
      "APPLICATION_OPERATION_UNKNOWN",
      requestId("000000000010"),
    ],
    [
      candidate("Operation", "APPLICATION_OPERATION_UNKNOWN", undefined, { operation: "invalid-a" }),
      candidate("Operation", "APPLICATION_OPERATION_UNKNOWN", requestId("000000000012"), { operation: "invalid-b" }),
      "APPLICATION_OPERATION_UNKNOWN",
      null,
    ],
  ];

  for (const [first, second, expectedCode, expectedRequestId] of vectors) {
    const selected = selectControllingApplicationError([second, first]);
    assert.deepEqual(selected, {
      code: expectedCode,
      requestId: expectedRequestId,
    });
    assert.ok(Object.isFrozen(selected));
  }
});

test("PT-APP-001O rejects invalid candidates and applies tuple ties", () => {
  const sameRankCandidates = Object.freeze([
    Object.freeze({
      phase: "Admission",
      code: "APPLICATION_MIGRATIONS_INCOMPLETE",
      operation: "WatchlistPut",
      requestId: "76000000-0000-4000-8000-000000000002",
    }),
    Object.freeze({
      phase: "Admission",
      code: "APPLICATION_DATABASE_UNAVAILABLE",
      operation: "WatchlistGet",
      requestId: "76000000-0000-4000-8000-000000000001",
    }),
  ]);
  assert.deepEqual(selectControllingApplicationError(sameRankCandidates), {
    code: "APPLICATION_DATABASE_UNAVAILABLE",
    requestId: "76000000-0000-4000-8000-000000000001",
  });
  assert.equal(sameRankCandidates[0].code, "APPLICATION_MIGRATIONS_INCOMPLETE");

  for (const invalidCandidates of [
    [],
    [{ phase: "Result", code: "APPLICATION_OPERATION_UNKNOWN" }],
    [{ phase: "Owner", code: "ANALYTICS_INPUT_INCOMPLETE" }],
    [{ phase: "Owner", code: "ANALYTICS_INPUT_INCOMPLETE", ownerRank: 0 }],
    [{ phase: "Admission", code: "APPLICATION_DATABASE_UNAVAILABLE", ownerRank: 10 }],
    [{ phase: "Unknown", code: "APPLICATION_DATABASE_UNAVAILABLE" }],
    [{ phase: "Admission", code: "not-stable" }],
  ]) {
    assert.throws(
      () => selectControllingApplicationError(invalidCandidates),
      (error) => error instanceof ApplicationResultInvalidError,
    );
  }
});

test("PT-APP-001O applies precedence on the command admission path", () => {
  const replayStore = createInMemoryApplicationReplayStore();
  const validRequest = {
    operation: "WatchlistRemove",
    requestId: "77000000-0000-4000-8000-000000000001",
    correlationId: "77000000-0000-4000-8000-000000000002",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-01-30T12:00:00.000Z",
    commandId: "77000000-0000-4000-8000-000000000003",
    payload: { instrumentId: "ETF-A", expectedVersion: "1" },
  };
  let readinessCalls = 0;
  let ownerCalls = 0;
  const dispatch = (request) => dispatchReplayProtectedApplicationCommand(
    JSON.stringify(request),
    replayStore,
    () => { readinessCalls += 1; },
    () => { ownerCalls += 1; },
  );

  const unknownWithoutActor = { ...validRequest, operation: "UnknownOperation" };
  delete unknownWithoutActor.actorId;
  assert.throws(
    () => dispatch(unknownWithoutActor),
    (error) =>
      error instanceof ApplicationOperationUnknownError &&
      error.requestId === validRequest.requestId,
  );
  assert.throws(
    () => dispatch({ ...validRequest, actorId: "other-user", extra: true }),
    (error) =>
      error instanceof ApplicationRequestInvalidError &&
      error.requestId === validRequest.requestId,
  );
  assert.throws(
    () => dispatch({ ...validRequest, actorId: "other-user" }),
    (error) =>
      error instanceof ApplicationUnauthorizedError &&
      error.requestId === validRequest.requestId,
  );
  assert.equal(readinessCalls, 0);
  assert.equal(ownerCalls, 0);
});

test("PT-APP-001P admits only the closed immutable job transitions", () => {
  assert.deepEqual(applicationJobTypes, ["FixtureIngestion", "Analytics"]);
  assert.deepEqual(applicationJobStatuses, ["Pending", "Running", "Succeeded", "Failed"]);
  assert.deepEqual(applicationJobRestartability, ["Restartable", "NotRestartable"]);

  const legalOwnerTransitions = new Set([
    "Pending:Running",
    "Pending:Failed",
    "Running:Succeeded",
    "Running:Failed",
  ]);

  for (const jobType of applicationJobTypes) {
    for (const restartability of applicationJobRestartability) {
      for (const sourceStatus of applicationJobStatuses) {
        for (const targetStatus of applicationJobStatuses) {
          for (const trigger of ["Owner", "JobRestart"]) {
            const job = Object.freeze({
              jobType,
              status: sourceStatus,
              restartability,
              attempt: 2,
            });
            const before = JSON.stringify(job);
            const transition = `${sourceStatus}:${targetStatus}`;
            const vector = `${jobType}/${restartability}/${transition}/${trigger}`;
            const isOwnerTransition =
              trigger === "Owner" && legalOwnerTransitions.has(transition);
            const isRestart =
              trigger === "JobRestart" &&
              restartability === "Restartable" &&
              transition === "Failed:Pending";

            if (isOwnerTransition || isRestart) {
              const result = transitionApplicationJobState(job, targetStatus, trigger);
              assert.notEqual(result, job, vector);
              assert.equal(Object.isFrozen(result), true, vector);
              assert.deepEqual(
                Object.keys(result).sort(),
                ["attempt", "jobType", "restartability", "status"],
                vector,
              );
              assert.equal(result.status, targetStatus, vector);
              assert.equal(result.attempt, isRestart ? 3 : 2, vector);
            } else {
              const code = trigger === "JobRestart"
                ? "APPLICATION_JOB_NOT_RESTARTABLE"
                : "APPLICATION_RESULT_INVALID";
              assert.throws(
                () => transitionApplicationJobState(job, targetStatus, trigger),
                (error) =>
                  error instanceof ApplicationJobTransitionError &&
                  error.code === code,
                vector,
              );
            }
            assert.equal(JSON.stringify(job), before, vector);
          }
        }
      }
    }
  }

  const failedJob = Object.freeze({
    jobType: "Analytics",
    status: "Failed",
    restartability: "NotRestartable",
    attempt: 1,
  });
  for (const [job, targetStatus, trigger, code] of [
    [failedJob, "Pending", "JobRestart", "APPLICATION_JOB_NOT_RESTARTABLE"],
    [{ ...failedJob, status: "Running", restartability: "Restartable" }, "Pending", "JobRestart", "APPLICATION_JOB_NOT_RESTARTABLE"],
    [{ ...failedJob, restartability: "Restartable" }, "Pending", "Owner", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, status: "Canceled" }, "Pending", "JobRestart", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, jobType: "Reconciliation" }, "Pending", "JobRestart", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, attempt: 0 }, "Pending", "JobRestart", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, attempt: -1 }, "Pending", "JobRestart", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, attempt: 1.5 }, "Pending", "JobRestart", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, attempt: Number.NaN }, "Pending", "JobRestart", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, attempt: Number.POSITIVE_INFINITY }, "Pending", "JobRestart", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, attempt: Number.MAX_SAFE_INTEGER + 1 }, "Pending", "JobRestart", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, attempt: Number.MAX_SAFE_INTEGER, restartability: "Restartable" }, "Pending", "JobRestart", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, restartability: "Sometimes" }, "Pending", "JobRestart", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, restartability: "Restartable" }, "Canceled", "Owner", "APPLICATION_RESULT_INVALID"],
    [{ ...failedJob, restartability: "Restartable" }, "Pending", "DelayedConsumer", "APPLICATION_RESULT_INVALID"],
  ]) {
    const before = JSON.stringify(job);
    const vector = `${JSON.stringify(job)}/${targetStatus}/${trigger}`;
    assert.throws(
      () => transitionApplicationJobState(job, targetStatus, trigger),
      (error) => error instanceof ApplicationJobTransitionError && error.code === code,
      vector,
    );
    assert.equal(JSON.stringify(job), before, vector);
  }

  const validState = {
    jobType: "Analytics",
    status: "Failed",
    restartability: "Restartable",
    attempt: 1,
  };
  let statusReads = 0;
  const accessorState = { ...validState };
  Object.defineProperty(accessorState, "status", {
    enumerable: true,
    get() {
      statusReads += 1;
      return "Failed";
    },
  });
  const inheritedState = Object.create(validState);
  const throwingProxy = new Proxy(validState, {
    getPrototypeOf() {
      throw new Error("attacker-controlled prototype failure");
    },
  });
  for (const [job, label] of [
    [{ ...validState, checkpoint: { sequence: 1 } }, "extra checkpoint"],
    [{ ...validState, queue: () => undefined }, "capability field"],
    [accessorState, "accessor"],
    [inheritedState, "inherited fields"],
    [throwingProxy, "throwing proxy"],
  ]) {
    assert.throws(
      () => transitionApplicationJobState(job, "Pending", "JobRestart"),
      (error) =>
        error instanceof ApplicationJobTransitionError &&
        error.code === "APPLICATION_RESULT_INVALID",
      label,
    );
  }
  assert.equal(statusReads, 0);
});

test("WP-3 composes command and query admission into complete result envelopes", () => {
  const replayStore = createInMemoryApplicationReplayStore();
  const commandEnvelope = (operation, payload, overrides = {}) => ({
    operation,
    requestId: "74000000-0000-4000-8000-000000000002",
    correlationId: "74000000-0000-4000-8000-000000000003",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-01-30T12:00:00.000Z",
    commandId: "74000000-0000-4000-8000-000000000001",
    payload,
    ...overrides,
  });
  let readinessCalls = 0;
  let ownerCalls = 0;
  let clockCalls = 0;
  const completedAt = () => {
    clockCalls += 1;
    return `2026-01-30T12:00:0${clockCalls}.000Z`;
  };
  const dependencies = {
    replayStore,
    completedAt,
    checkReadiness: () => { readinessCalls += 1; },
    ownerDispatch: (definition) => {
      ownerCalls += 1;
      if (definition.operation === "WatchlistRemove") return { version: "2" };
      if (definition.operation === "WatchlistGet") {
        return { orderedItems: [], version: "2" };
      }
      throw Object.assign(new Error("secret database host"), {
        code: "FIXTURE_REQUIRED_QUARANTINED",
      });
    },
  };
  const commandJson = JSON.stringify(commandEnvelope(
    "WatchlistRemove",
    { instrumentId: "ETF-A", expectedVersion: "1" },
  ));

  const commandResult = executeApplicationRequest(commandJson, dependencies);
  const replayedResult = executeApplicationRequest(commandJson, dependencies);
  assert.equal(replayedResult, commandResult);
  assert.deepEqual(commandResult, {
    operation: "WatchlistRemove",
    requestId: "74000000-0000-4000-8000-000000000002",
    correlationId: "74000000-0000-4000-8000-000000000003",
    outcome: "Succeeded",
    completedAt: "2026-01-30T12:00:01.000Z",
    data: { version: "2" },
    warnings: [],
    presentation: {
      statusText: "Succeeded",
      announcement: "None",
      warningText: null,
      researchWarningRequired: false,
    },
  });
  assert.equal(readinessCalls, 1);
  assert.equal(ownerCalls, 1);
  assert.equal(clockCalls, 1);

  const queryJson = JSON.stringify({
    operation: "WatchlistGet",
    requestId: "75000000-0000-4000-8000-000000000002",
    correlationId: "75000000-0000-4000-8000-000000000003",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-01-30T12:00:00.000Z",
    payload: {},
  });
  const queryResult = executeApplicationRequest(queryJson, dependencies);
  assert.equal(queryResult.outcome, "Succeeded");
  assert.deepEqual(queryResult.data, { orderedItems: [], version: "2" });
  assert.equal(ownerCalls, 2);
  assert.equal(readinessCalls, 2);

  const failedJson = JSON.stringify(commandEnvelope(
    "FixtureIngestionStart",
    {
      jobId: "76000000-0000-4000-8000-000000000001",
      datasetId: "prices",
      datasetVersion: "2026-01-30",
      fixturePackageHash: "a".repeat(64),
    },
    { commandId: "76000000-0000-4000-8000-000000000004" },
  ));
  const failedResult = executeApplicationRequest(failedJson, dependencies);
  assert.deepEqual(failedResult.error, {
    code: "FIXTURE_REQUIRED_QUARANTINED",
    message: "Required fixture data is quarantined.",
    boundedIdentifiers: {},
    recovery: null,
  });
  assert.equal(JSON.stringify(failedResult).includes("secret"), false);
  assert.equal(failedResult.outcome, "Failed");
  assert.equal("data" in failedResult, false);

  const malformedReplay = executeApplicationRequest(
    JSON.stringify(commandEnvelope(
      "WatchlistRemove",
      { instrumentId: "ETF-A", expectedVersion: "1", extra: true },
    )),
    dependencies,
  );
  assert.equal(malformedReplay.error.code, "APPLICATION_REQUEST_INVALID");

  const wrongReadinessCode = executeApplicationRequest(queryJson, {
    ...dependencies,
    checkReadiness: () => {
      throw Object.assign(new Error("wrong phase"), { code: "ORDER_VERSION_CONFLICT" });
    },
  });
  assert.equal(wrongReadinessCode.error.code, "APPLICATION_DEPENDENCY_UNAVAILABLE");

  const wrongOwnerCode = executeApplicationRequest(queryJson, {
    ...dependencies,
    ownerDispatch: () => {
      throw new ApplicationOperationUnknownError();
    },
  });
  assert.equal(wrongOwnerCode.error.code, "APPLICATION_DEPENDENCY_UNAVAILABLE");
  const unknownOwnerCode = executeApplicationRequest(queryJson, {
    ...dependencies,
    ownerDispatch: () => {
      throw Object.assign(new Error("must not escape"), {
        code: "ANALYTICS_UNKNOWN_FAILURE",
      });
    },
  });
  assert.equal(unknownOwnerCode.error.code, "APPLICATION_DEPENDENCY_UNAVAILABLE");
  assert.equal(JSON.stringify(unknownOwnerCode).includes("must not escape"), false);

  const analyticsQueryJson = JSON.stringify({
    ...JSON.parse(queryJson),
    operation: "AnalyticsResultGet",
    payload: { publicationTargetId: "75000000-0000-4000-8000-000000000004" },
  });
  for (const code of [
    "ANALYTICS_INPUT_INCOMPLETE",
    "ANALYTICS_INPUT_STALE",
    "ANALYTICS_INPUT_QUARANTINED",
    "ANALYTICS_AMBIGUOUS_VINTAGE",
    "ANALYTICS_AMBIGUOUS_MARKET_REVISION",
    "ANALYTICS_RIGHTS_RESTRICTED",
    "ANALYTICS_INTEGRITY_FAILED",
    "ANALYTICS_EVIDENCE_ACCESS_DENIED",
    "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
    "ANALYTICS_NUMERIC_CLASS_INVALID",
    "ANALYTICS_CAPACITY_BLOCKED",
    "ANALYTICS_EVIDENCE_COMMIT_FAILED",
    "ANALYTICS_PUBLICATION_BLOCKED",
    "ANALYTICS_DETERMINISM_FAILED",
    "ANALYTICS_IDEMPOTENCY_CONFLICT",
    "ANALYTICS_PUBLICATION_VERSION_CONFLICT",
  ]) {
    const ownerFailure = executeApplicationRequest(analyticsQueryJson, {
      ...dependencies,
      completedAt: () => "2026-01-30T12:00:09.000Z",
      ownerDispatch: () => {
        throw Object.assign(new Error("must not escape"), { code });
      },
    });
    assert.equal(ownerFailure.error.code, code);
    assert.equal(JSON.stringify(ownerFailure).includes("must not escape"), false);
  }

  const invalidOwnerResult = executeApplicationRequest(queryJson, {
    ...dependencies,
    ownerDispatch: () => ({ orderedItems: [], version: "2", secret: "no" }),
  });
  assert.equal(invalidOwnerResult.error.code, "APPLICATION_REDACTION_FAILED");
});

test("WP-6 command owner dispatch receives immutable admitted context", () => {
  let observedContext;
  const request = JSON.stringify({
    operation: "PaperOrderDraftCreate",
    requestId: "75000000-0000-4000-8000-000000000001",
    correlationId: "75000000-0000-4000-8000-000000000002",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-09-17T12:00:00.000Z",
    commandId: "75000000-0000-4000-8000-000000000003",
    payload: {
      orderId: "75000000-0000-4000-8000-000000000004",
      instrumentId: "GOLDEN-ETF",
      researchEvidenceId: "75000000-0000-4000-8000-000000000005",
      side: "Buy",
      quantity: "2.0000000000",
      unitPrice: "10.0000000000",
      tradeDate: "2026-09-17",
    },
  });

  const result = executeApplicationRequest(request, {
    replayStore: createInMemoryApplicationReplayStore(),
    completedAt: () => "2026-09-17T12:00:01.000Z",
    checkReadiness: () => undefined,
    ownerDispatch: (_definition, _payload, context) => {
      observedContext = context;
      return {
        order: {
          orderId: "75000000-0000-4000-8000-000000000004",
          instrumentId: "GOLDEN-ETF",
          state: "Draft",
          aggregateVersion: "1",
          researchEvidenceId: "75000000-0000-4000-8000-000000000005",
          side: "Buy",
          requestedQuantity: "2.0000000000",
          filledQuantity: "0.0000000000",
          openQuantity: "2.0000000000",
          unitPrice: "10.0000000000",
          tradeDate: "2026-09-17",
          confirmation: null,
          transitionHistory: [],
        },
      };
    },
  });

  assert.deepEqual(observedContext, {
    commandId: "75000000-0000-4000-8000-000000000003",
    correlationId: "75000000-0000-4000-8000-000000000002",
    requestedAt: "2026-09-17T12:00:00.000Z",
  });
  assert.equal(Object.isFrozen(observedContext), true);
  assert.equal(result.outcome, "Succeeded");
});

test("WP-6 async command owner dispatch is awaited and replayed once", async () => {
  let ownerCalls = 0;
  const request = JSON.stringify({
    operation: "PaperOrderDraftCreate",
    requestId: "76000000-0000-4000-8000-000000000001",
    correlationId: "76000000-0000-4000-8000-000000000002",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-09-17T12:00:00.000Z",
    commandId: "76000000-0000-4000-8000-000000000003",
    payload: {
      orderId: "76000000-0000-4000-8000-000000000004",
      instrumentId: "GOLDEN-ETF",
      researchEvidenceId: "76000000-0000-4000-8000-000000000005",
      side: "Buy",
      quantity: "2.0000000000",
      unitPrice: "10.0000000000",
      tradeDate: "2026-09-17",
    },
  });
  const dependencies = {
    replayStore: createInMemoryApplicationReplayStore(),
    completedAt: () => "2026-09-17T12:00:01.000Z",
    checkReadiness: () => undefined,
    ownerDispatch: async () => {
      ownerCalls += 1;
      return {
        order: {
          orderId: "76000000-0000-4000-8000-000000000004",
          instrumentId: "GOLDEN-ETF",
          state: "Draft",
          aggregateVersion: "1",
          researchEvidenceId: "76000000-0000-4000-8000-000000000005",
          side: "Buy",
          requestedQuantity: "2.0000000000",
          filledQuantity: "0.0000000000",
          openQuantity: "2.0000000000",
          unitPrice: "10.0000000000",
          tradeDate: "2026-09-17",
          confirmation: null,
          transitionHistory: [],
        },
      };
    },
  };

  const first = await executeApplicationRequestAsync(request, dependencies);
  const replay = await executeApplicationRequestAsync(request, dependencies);

  assert.equal(first.outcome, "Succeeded");
  assert.equal(replay, first);
  assert.equal(ownerCalls, 1);
});

test("WP-6 async replay stays in progress until owner settlement", async () => {
  let ownerCalls = 0;
  let releaseOwner;
  const ownerPending = new Promise((resolve) => { releaseOwner = resolve; });
  const request = JSON.stringify({
    operation: "PaperOrderDraftCreate",
    requestId: "76100000-0000-4000-8000-000000000001",
    correlationId: "76100000-0000-4000-8000-000000000002",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-09-17T12:00:00.000Z",
    commandId: "76100000-0000-4000-8000-000000000003",
    payload: {
      orderId: "76100000-0000-4000-8000-000000000004",
      instrumentId: "GOLDEN-ETF",
      researchEvidenceId: "76100000-0000-4000-8000-000000000005",
      side: "Buy",
      quantity: "2.0000000000",
      unitPrice: "10.0000000000",
      tradeDate: "2026-09-17",
    },
  });
  const dependencies = {
    replayStore: createInMemoryApplicationReplayStore(),
    completedAt: () => "2026-09-17T12:00:01.000Z",
    checkReadiness: () => undefined,
    ownerDispatch: async () => {
      ownerCalls += 1;
      return ownerPending;
    },
  };

  const first = executeApplicationRequestAsync(request, dependencies);
  await Promise.resolve();
  const concurrent = executeApplicationRequestAsync(request, dependencies);

  releaseOwner({
    order: {
      orderId: "76100000-0000-4000-8000-000000000004",
      instrumentId: "GOLDEN-ETF",
      state: "Draft",
      aggregateVersion: "1",
      researchEvidenceId: "76100000-0000-4000-8000-000000000005",
      side: "Buy",
      requestedQuantity: "2.0000000000",
      filledQuantity: "0.0000000000",
      openQuantity: "2.0000000000",
      unitPrice: "10.0000000000",
      tradeDate: "2026-09-17",
      confirmation: null,
      transitionHistory: [],
    },
  });
  const firstResult = await first;
  const concurrentResult = await concurrent;
  assert.equal(firstResult.outcome, "Succeeded");
  assert.equal(concurrentResult, firstResult);
  assert.equal(ownerCalls, 1);
});

test("WP-6 async failures preserve phase and replay the settled result", async () => {
  const request = JSON.stringify({
    operation: "PaperOrderDraftCreate",
    requestId: "76200000-0000-4000-8000-000000000001",
    correlationId: "76200000-0000-4000-8000-000000000002",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-09-17T12:00:00.000Z",
    commandId: "76200000-0000-4000-8000-000000000003",
    payload: {
      orderId: "76200000-0000-4000-8000-000000000004",
      instrumentId: "GOLDEN-ETF",
      researchEvidenceId: "76200000-0000-4000-8000-000000000005",
      side: "Buy",
      quantity: "2.0000000000",
      unitPrice: "10.0000000000",
      tradeDate: "2026-09-17",
    },
  });
  let readinessOwnerCalls = 0;
  const readinessFailure = await executeApplicationRequestAsync(request, {
    replayStore: createInMemoryApplicationReplayStore(),
    completedAt: () => "2026-09-17T12:00:01.000Z",
    checkReadiness: async () => {
      throw Object.assign(new Error("must not escape"), {
        code: "APPLICATION_MIGRATIONS_INCOMPLETE",
      });
    },
    ownerDispatch: async () => {
      readinessOwnerCalls += 1;
      return {};
    },
  });
  assert.equal(readinessFailure.error.code, "APPLICATION_MIGRATIONS_INCOMPLETE");
  assert.equal(readinessOwnerCalls, 0);

  let ownerCalls = 0;
  const dependencies = {
    replayStore: createInMemoryApplicationReplayStore(),
    completedAt: () => "2026-09-17T12:00:02.000Z",
    checkReadiness: async () => undefined,
    ownerDispatch: async () => {
      ownerCalls += 1;
      throw Object.assign(new Error("database role details must not escape"), {
        code: "APPLICATION_UNAUTHORIZED",
      });
    },
  };
  const ownerFailure = await executeApplicationRequestAsync(request, dependencies);
  const replay = await executeApplicationRequestAsync(request, dependencies);

  assert.equal(ownerFailure.error.code, "APPLICATION_UNAUTHORIZED");
  assert.equal(JSON.stringify(ownerFailure).includes("database role"), false);
  assert.equal(replay, ownerFailure);
  assert.equal(ownerCalls, 1);
});

test("WP-6 preserves every allowlisted PostgreSQL owner failure code", async () => {
  const request = JSON.stringify({
    operation: "PaperOrderDraftCreate",
    requestId: "76300000-0000-4000-8000-000000000001",
    correlationId: "76300000-0000-4000-8000-000000000002",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: "2026-09-17T12:00:00.000Z",
    commandId: "76300000-0000-4000-8000-000000000003",
    payload: {
      orderId: "76300000-0000-4000-8000-000000000004",
      instrumentId: "GOLDEN-ETF",
      researchEvidenceId: "76300000-0000-4000-8000-000000000005",
      side: "Buy",
      quantity: "2.0000000000",
      unitPrice: "10.0000000000",
      tradeDate: "2026-09-17",
    },
  });

  for (const code of [
    "ORDER_GUARD_FAILED",
    "ORDER_TERMINAL_STATE",
    "LEDGER_VERSION_CONFLICT",
    "ORDER_NOT_FOUND",
  ]) {
    const result = await executeApplicationRequestAsync(request, {
      replayStore: createInMemoryApplicationReplayStore(),
      completedAt: () => "2026-09-17T12:00:01.000Z",
      checkReadiness: async () => undefined,
      ownerDispatch: async () => {
        throw Object.assign(new Error("must not escape"), { code });
      },
    });
    assert.equal(result.error.code, code);
    assert.equal(JSON.stringify(result).includes("must not escape"), false);
  }
});
