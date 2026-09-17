import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizePaperOrderCommand,
  selectPaperOrderTransition,
} from "../../dist/Domain/Orders/paper-order.js";
import {
  presentCanonicalValue,
  submitConfirmedPaperOrder,
} from "../../dist/Application/application-boundary.js";

const draftCommand = {
  correlationId: "55000000-0000-4000-8000-000000000101",
  occurredAt: "2026-09-14T05:01:00.000Z",
  operation: "DraftCreate",
  orderId: "55000000-0000-4000-8000-000000000002",
  transitionCommandId: "55000000-0000-4000-8000-000000000201",
  expectedVersion: 0,
  transition: "OT-01",
  transitionPayload: {
    instrumentId: "GOLDEN-ETF",
    researchEvidenceId: "55000000-0000-4000-8000-000000000003",
    side: "Buy",
    quantity: "2.0000000000",
    unitPrice: "10.0000000000",
    tradeDate: "2026-09-14",
  },
};

const expectedCanonicalContent =
  '{"correlationId":"55000000-0000-4000-8000-000000000101","expectedVersion":0,"occurredAt":"2026-09-14T05:01:00.000Z","operation":"DraftCreate","orderId":"55000000-0000-4000-8000-000000000002","transition":"OT-01","transitionCommandId":"55000000-0000-4000-8000-000000000201","transitionPayload":{"instrumentId":"GOLDEN-ETF","quantity":"2.0000000000","researchEvidenceId":"55000000-0000-4000-8000-000000000003","side":"Buy","tradeDate":"2026-09-14","unitPrice":"10.0000000000"}}';

test("OT-01 creates only a Draft from explicit research evidence", () => {
  const result = canonicalizePaperOrderCommand(draftCommand);

  assert.deepEqual(result.transition, {
    sourceState: "Initial",
    targetState: "Draft",
    trigger: "UserCreatedFromResearch",
  });
  assert.equal(result.canonicalContent, expectedCanonicalContent);
  assert.deepEqual(result.databasePayload, {
    canonicalContent: expectedCanonicalContent,
    ...draftCommand,
  });
});

test("CT-ORD-002 unconfirmed drafts remain Draft without mutation", () => {
  let dispatchCount = 0;
  const result = submitConfirmedPaperOrder(
    {
      correlationId: draftCommand.correlationId,
      expectedVersion: 1,
      orderId: draftCommand.orderId,
      sourceState: "Draft",
      transitionCommandId: draftCommand.transitionCommandId,
    },
    { status: "Incomplete" },
    () => {
      dispatchCount += 1;
    },
  );

  assert.deepEqual(result, { outcome: "NotDispatched", state: "Draft" });
  assert.equal(dispatchCount, 0);
});

const transitionCases = [
  {
    name: "OT-02 submits only after same-user confirmation",
    transition: "OT-02",
    expectedVersion: 1,
    occurredAt: "2026-09-14T05:02:00.000Z",
    transitionPayload: {
      confirmation: {
        actorId: "local-user",
        confirmedAt: "2026-09-14T05:02:00.000Z",
        confirmationText: "Confirm hypothetical paper order",
      },
    },
    expected: ["Draft", "Submitted", "UserConfirmedPaperAction"],
  },
  {
    name: "OT-03 accepts a Submitted order without a fill",
    transition: "OT-03",
    expectedVersion: 2,
    transitionPayload: {
      portfolioId: "55000000-0000-4000-8000-000000000004",
      validationSnapshotId: "55000000-0000-4000-8000-000000000005",
      expectedPortfolioVersion: 1,
    },
    expected: ["Submitted", "Accepted", "PortfolioValidationPassed"],
  },
  {
    name: "OT-04 rejects a Submitted order without ledger mutation",
    transition: "OT-04",
    expectedVersion: 2,
    transitionPayload: { rejectionCode: "PORTFOLIO_RULE_FAILED" },
    expected: ["Submitted", "Rejected", "PortfolioValidationFailed"],
  },
  {
    name: "OT-05 atomically partially fills an Accepted order",
    transition: "OT-05",
    expectedVersion: 3,
    transitionPayload: {
      portfolioId: "55000000-0000-4000-8000-000000000004",
      transactionId: "55000000-0000-4000-8000-000000000006",
      fillId: "55000000-0000-4000-8000-000000000007",
      expectedPortfolioVersion: 1,
      quantity: "1.0000000000",
      unitPrice: "10.0000000000",
      fee: "0.00000000",
    },
    expected: ["Accepted", "Partial", "LocalPartialFillSimulated"],
  },
  {
    name: "OT-06 atomically fills an Accepted order",
    transition: "OT-06",
    expectedVersion: 3,
    transitionPayload: {
      portfolioId: "55000000-0000-4000-8000-000000000004",
      transactionId: "55000000-0000-4000-8000-000000000008",
      fillId: "55000000-0000-4000-8000-000000000009",
      expectedPortfolioVersion: 1,
      quantity: "2.0000000000",
      unitPrice: "10.0000000000",
      fee: "0.00000000",
    },
    expected: ["Accepted", "Filled", "LocalCompleteFillSimulated"],
  },
  {
    name: "OT-07 cancels an unfilled Accepted order",
    transition: "OT-07",
    expectedVersion: 3,
    transitionPayload: { reasonCode: "USER_REQUESTED" },
    expected: ["Accepted", "Canceled", "UserCanceledOpenQuantity"],
  },
  {
    name: "OT-08 expires an unfilled Accepted order",
    transition: "OT-08",
    expectedVersion: 3,
    occurredAt: "2026-09-14T05:10:00.000Z",
    transitionPayload: { expiresAt: "2026-09-14T05:09:00.000Z" },
    expected: ["Accepted", "Expired", "DeterministicExpiryReached"],
  },
  {
    name: "OT-09 atomically fills the remaining Partial quantity",
    transition: "OT-09",
    expectedVersion: 4,
    transitionPayload: {
      portfolioId: "55000000-0000-4000-8000-000000000004",
      transactionId: "55000000-0000-4000-8000-000000000010",
      fillId: "55000000-0000-4000-8000-000000000011",
      expectedPortfolioVersion: 2,
      quantity: "1.0000000000",
      unitPrice: "10.0000000000",
      fee: "0.00000000",
    },
    expected: ["Partial", "Filled", "LocalRemainderFillSimulated"],
  },
  {
    name: "OT-10 cancels only the remaining Partial quantity",
    transition: "OT-10",
    expectedVersion: 4,
    transitionPayload: { reasonCode: "USER_REQUESTED" },
    expected: ["Partial", "Canceled", "UserCanceledRemainingQuantity"],
  },
];

for (const [index, transitionCase] of transitionCases.entries()) {
  test(transitionCase.name, () => {
    const command = {
      correlationId: `55000000-0000-4000-8000-${String(301 + index).padStart(12, "0")}`,
      occurredAt: transitionCase.occurredAt ?? "2026-09-14T05:03:00.000Z",
      operation: "Transition",
      orderId: draftCommand.orderId,
      transitionCommandId: `55000000-0000-4000-8000-${String(401 + index).padStart(12, "0")}`,
      expectedVersion: transitionCase.expectedVersion,
      transition: transitionCase.transition,
      transitionPayload: transitionCase.transitionPayload,
    };

    const result = canonicalizePaperOrderCommand(command);

    assert.deepEqual(result.transition, {
      sourceState: transitionCase.expected[0],
      targetState: transitionCase.expected[1],
      trigger: transitionCase.expected[2],
    });
    assert.deepEqual(JSON.parse(result.canonicalContent), command);
    assert.deepEqual(result.databasePayload, {
      canonicalContent: result.canonicalContent,
      ...command,
    });
  });
}

test("CT-ORD-007 rejects all 62 transition complements atomically", () => {
  const sources = [
    "Initial",
    "Draft",
    "Submitted",
    "Accepted",
    "Partial",
    "Filled",
    "Rejected",
    "Canceled",
    "Expired",
  ];
  const targets = [
    "Draft",
    "Submitted",
    "Accepted",
    "Partial",
    "Filled",
    "Rejected",
    "Canceled",
    "Expired",
  ];
  const allowed = new Set([
    "Initial:Draft",
    "Draft:Submitted",
    "Submitted:Accepted",
    "Submitted:Rejected",
    "Accepted:Partial",
    "Accepted:Filled",
    "Accepted:Canceled",
    "Accepted:Expired",
    "Partial:Filled",
    "Partial:Canceled",
  ]);
  let rejected = 0;

  for (const source of sources) {
    for (const target of targets) {
      const pair = `${source}:${target}`;
      if (allowed.has(pair)) {
        assert.match(selectPaperOrderTransition(source, target), /^OT-\d{2}$/);
        continue;
      }
      assert.throws(
        () => selectPaperOrderTransition(source, target),
        (error) => {
          assert.equal(
            error.code,
            ["Filled", "Rejected", "Canceled", "Expired"].includes(source)
              ? "ORDER_TERMINAL_STATE"
              : "ORDER_INVALID_TRANSITION",
          );
          return true;
        },
        pair,
      );
      rejected += 1;
    }
  }

  assert.equal(rejected, 62);
});

test("CT-ORD-008 terminal states reject every transition atomically", () => {
  for (const source of ["Filled", "Rejected", "Canceled", "Expired"]) {
    assert.throws(
      () => selectPaperOrderTransition(source, "Draft"),
      (error) => error.code === "ORDER_TERMINAL_STATE",
    );
  }
});

test("CT-ORD-010 Partial serializes with the Partially Filled label", () => {
  assert.deepEqual(presentCanonicalValue("OrderStatus", "Partial"), {
    wireValue: "Partial",
    visibleText: "Partially Filled",
    accessibleText: "Partially Filled",
  });
});

test("OT-02 accepts bounded confirmation text from the application contract", () => {
  const command = {
    correlationId: "55000000-0000-4000-8000-000000000501",
    occurredAt: "2026-09-14T05:02:00.000Z",
    operation: "Transition",
    orderId: draftCommand.orderId,
    transitionCommandId: "55000000-0000-4000-8000-000000000502",
    expectedVersion: 1,
    transition: "OT-02",
    transitionPayload: {
      confirmation: {
        actorId: "local-user",
        confirmedAt: "2026-09-14T05:02:00.000Z",
        confirmationText: "Submit paper order",
      },
    },
  };

  assert.deepEqual(JSON.parse(canonicalizePaperOrderCommand(command).canonicalContent), command);
});

test("unknown state names fail with ORDER_UNKNOWN_STATE", () => {
  for (const [source, target] of [["partial", "Filled"], ["Draft", "Cancelled"]]) {
    assert.throws(
      () => selectPaperOrderTransition(source, target),
      (error) => error.code === "ORDER_UNKNOWN_STATE",
    );
  }
});
