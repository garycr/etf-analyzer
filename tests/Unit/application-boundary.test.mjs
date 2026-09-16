import assert from "node:assert/strict";
import test from "node:test";

import {
  ApplicationOperationUnknownError,
  applicationCommandOperations,
  applicationQueryOperations,
  dispatchApplicationOperation,
  displayVerifiedResearch,
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
