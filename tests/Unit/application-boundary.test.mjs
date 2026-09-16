import assert from "node:assert/strict";
import test from "node:test";

import {
  ApplicationRequestInvalidError,
  ApplicationResultInvalidError,
  ApplicationOperationUnknownError,
  applicationCommandOperations,
  applicationQueryOperations,
  activateBlockedStateRecovery,
  dispatchApplicationOperation,
  dispatchValidatedApplicationOperation,
  dispatchValidatedApplicationRequest,
  displayVerifiedResearch,
  evaluateReadiness,
  exportDiagnosticMetadata,
  ownerFailureCodes,
  presentCanonicalValue,
  presentBlockedState,
  presentFailedJob,
  presentOwnerFailure,
  presentResearchWarning,
  readinessDependencyNames,
  restartDurableJob,
  submitConfirmedPaperOrder,
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
    ["ANALYTICS_INTEGRITY_FAILED", "Analytical evidence failed integrity verification."],
    ["ANALYTICS_PUBLICATION_BLOCKED", "Analytical publication is blocked."],
    ["APPLICATION_REQUEST_INVALID", "The application request is invalid."],
    ["APPLICATION_IDEMPOTENCY_CONFLICT", "The application command identity was reused with different content."],
    ["APPLICATION_JOB_NOT_RESTARTABLE", "The job cannot be restarted."],
    ["APPLICATION_REDACTION_FAILED", "Safe diagnostic redaction could not be verified."],
    ["ORDER_IDEMPOTENCY_CONFLICT", "The paper order command identity was reused with different content."],
    ["FIXTURE_IDEMPOTENCY_CONFLICT", "The fixture identity was reused with different content."],
    ["ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED", "The analytics access denial could not be recorded."],
    ["LEDGER_INTEGRITY_FAILED", "Ledger integrity verification failed."],
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
    resultSchemaVersion: "1.0.0-candidate.2",
    configurationHash: "b".repeat(64),
    signals: Object.freeze([]),
    trades: Object.freeze([]),
    metrics: Object.freeze({}),
    warnings: Object.freeze([]),
  });
  const evidence = Object.freeze({
    evidenceSchemaVersion: "1.0.0-candidate.2",
    evidenceId: "evidence-fixture-1",
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
    const validated = validateApplicationSuccessData(operation, data);
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
  ]) {
    assert.throws(
      () => validateApplicationSuccessData("JobGet", { job: contradictoryJob }),
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
});
