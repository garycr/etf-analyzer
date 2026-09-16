import assert from "node:assert/strict";
import test from "node:test";

import {
  ApplicationOperationUnknownError,
  applicationCommandOperations,
  applicationQueryOperations,
  dispatchApplicationOperation,
  displayVerifiedResearch,
  evaluateReadiness,
  exportDiagnosticMetadata,
  ownerFailureCodes,
  presentCanonicalValue,
  presentFailedJob,
  presentOwnerFailure,
  presentResearchWarning,
  readinessDependencyNames,
  restartDurableJob,
  submitConfirmedPaperOrder,
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
