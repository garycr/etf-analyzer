import assert from "node:assert/strict";
import test from "node:test";

import { dispatchPostgresPaperOrder } from "../../dist/Infrastructure/PostgreSQL/paper-order-owner.js";

const draftPayload = {
  orderId: "77000000-0000-4000-8000-000000000004",
  instrumentId: "GOLDEN-ETF",
  researchEvidenceId: "77000000-0000-4000-8000-000000000005",
  side: "Buy",
  quantity: "2.0000000000",
  unitPrice: "10.0000000000",
  tradeDate: "2026-09-17",
};

const order = {
  orderId: draftPayload.orderId,
  instrumentId: draftPayload.instrumentId,
  state: "Draft",
  aggregateVersion: "1",
  researchEvidenceId: draftPayload.researchEvidenceId,
  side: "Buy",
  requestedQuantity: "2.0000000000",
  filledQuantity: "0.0000000000",
  openQuantity: "2.0000000000",
  unitPrice: "10.0000000000",
  tradeDate: "2026-09-17",
  confirmation: null,
  transitionHistory: [],
};

test("WP-6 maps PaperOrderDraftCreate to one canonical PostgreSQL OT-01 command", async () => {
  const observedQueries = [];
  const client = {
    async query(sql, values) {
      observedQueries.push({ sql, values });
      return sql.includes("paper_order_transition")
        ? { rows: [{ result: { state: "Draft" } }] }
        : { rows: [{ result: { order } }] };
    },
  };

  const result = await dispatchPostgresPaperOrder(
    client,
    { operation: "PaperOrderDraftCreate", kind: "command" },
    draftPayload,
    {
      commandId: "77000000-0000-4000-8000-000000000003",
      correlationId: "77000000-0000-4000-8000-000000000002",
      requestedAt: "2026-09-17T12:00:00.000Z",
    },
  );

  assert.equal(observedQueries[0].sql, "SELECT etf.paper_order_transition($1::jsonb) AS result");
  assert.equal(observedQueries[0].values.length, 1);
  assert.deepEqual(observedQueries[0].values[0], {
    canonicalContent: '{"correlationId":"77000000-0000-4000-8000-000000000002","expectedVersion":0,"occurredAt":"2026-09-17T12:00:00.000Z","operation":"DraftCreate","orderId":"77000000-0000-4000-8000-000000000004","transition":"OT-01","transitionCommandId":"77000000-0000-4000-8000-000000000003","transitionPayload":{"instrumentId":"GOLDEN-ETF","quantity":"2.0000000000","researchEvidenceId":"77000000-0000-4000-8000-000000000005","side":"Buy","tradeDate":"2026-09-17","unitPrice":"10.0000000000"}}',
    correlationId: "77000000-0000-4000-8000-000000000002",
    expectedVersion: 0,
    occurredAt: "2026-09-17T12:00:00.000Z",
    operation: "DraftCreate",
    orderId: "77000000-0000-4000-8000-000000000004",
    transition: "OT-01",
    transitionCommandId: "77000000-0000-4000-8000-000000000003",
    transitionPayload: {
      instrumentId: "GOLDEN-ETF",
      quantity: "2.0000000000",
      researchEvidenceId: "77000000-0000-4000-8000-000000000005",
      side: "Buy",
      tradeDate: "2026-09-17",
      unitPrice: "10.0000000000",
    },
  });
  assert.deepEqual(observedQueries[1], {
    sql: "SELECT etf.paper_order_command_get($1::uuid, $2::uuid) AS result",
    values: [draftPayload.orderId, "77000000-0000-4000-8000-000000000003"],
  });
  assert.equal(observedQueries.length, 2);
  assert.deepEqual(result, { order });
});

test("WP-6 maps PaperOrderTransition UInt versions to canonical PostgreSQL integers", async () => {
  const observedQueries = [];
  const submittedOrder = { ...order, state: "Submitted", aggregateVersion: "2" };
  const client = {
    async query(sql, values) {
      observedQueries.push({ sql, values });
      return sql.includes("paper_order_transition")
        ? { rows: [{ result: { state: "Submitted" } }] }
        : { rows: [{ result: { order: submittedOrder } }] };
    },
  };

  await dispatchPostgresPaperOrder(
    client,
    { operation: "PaperOrderTransition", kind: "command" },
    {
      orderId: draftPayload.orderId,
      transitionCommandId: "77000000-0000-4000-8000-000000000006",
      expectedVersion: "1",
      transition: "OT-02",
      transitionPayload: {
        confirmation: {
          actorId: "local-user",
          confirmationText: "Submit paper order",
          confirmedAt: "2026-09-17T12:01:00.000Z",
        },
      },
    },
    {
      commandId: "77000000-0000-4000-8000-000000000007",
      correlationId: "77000000-0000-4000-8000-000000000002",
      requestedAt: "2026-09-17T12:01:00.000Z",
    },
  );

  assert.equal(observedQueries[0].values[0].expectedVersion, 1);
  assert.match(observedQueries[0].values[0].canonicalContent, /"expectedVersion":1/u);
});

test("WP-6 maps nested portfolio UInt versions to canonical PostgreSQL integers", async () => {
  const observedQueries = [];
  const client = {
    async query(sql, values) {
      observedQueries.push({ sql, values });
      return sql.includes("paper_order_transition")
        ? { rows: [{ result: { state: "Accepted" } }] }
        : { rows: [{ result: { order: { ...order, state: "Accepted", aggregateVersion: "3" } } }] };
    },
  };

  await dispatchPostgresPaperOrder(
    client,
    { operation: "PaperOrderTransition", kind: "command" },
    {
      orderId: draftPayload.orderId,
      transitionCommandId: "77000000-0000-4000-8000-000000000008",
      expectedVersion: "2",
      transition: "OT-03",
      transitionPayload: {
        portfolioId: "77000000-0000-4000-8000-000000000009",
        validationSnapshotId: "77000000-0000-4000-8000-000000000010",
        expectedPortfolioVersion: "0",
      },
    },
    {
      commandId: "77000000-0000-4000-8000-000000000011",
      correlationId: "77000000-0000-4000-8000-000000000002",
      requestedAt: "2026-09-17T12:02:00.000Z",
    },
  );

  assert.equal(observedQueries[0].values[0].expectedVersion, 2);
  assert.equal(observedQueries[0].values[0].transitionPayload.expectedPortfolioVersion, 0);
  assert.match(observedQueries[0].values[0].canonicalContent, /"expectedPortfolioVersion":0/u);
});

test("WP-6 enforces the documented safe-integer UInt boundary", async () => {
  const observedQueries = [];
  const client = {
    async query(sql, values) {
      observedQueries.push({ sql, values });
      return sql.includes("paper_order_transition")
        ? { rows: [{ result: { state: "Submitted" } }] }
        : { rows: [{ result: { order: { ...order, state: "Submitted" } } }] };
    },
  };
  const transition = (expectedVersion) => dispatchPostgresPaperOrder(
    client,
    { operation: "PaperOrderTransition", kind: "command" },
    {
      orderId: draftPayload.orderId,
      transitionCommandId: "77000000-0000-4000-8000-000000000012",
      expectedVersion,
      transition: "OT-02",
      transitionPayload: {
        confirmation: {
          actorId: "local-user",
          confirmationText: "Submit paper order",
          confirmedAt: "2026-09-17T12:03:00.000Z",
        },
      },
    },
    {
      commandId: "77000000-0000-4000-8000-000000000013",
      correlationId: "77000000-0000-4000-8000-000000000002",
      requestedAt: "2026-09-17T12:03:00.000Z",
    },
  );

  await transition("9007199254740991");
  assert.equal(observedQueries[0].values[0].expectedVersion, Number.MAX_SAFE_INTEGER);
  for (const invalid of ["9007199254740992", "01", "-1", "1.0"]) {
    await assert.rejects(transition(invalid), (error) => error.code === "APPLICATION_REQUEST_INVALID");
  }
  assert.equal(observedQueries.length, 2);
});

test("WP-6 maps allowlisted PostgreSQL order errors to stable owner codes", async () => {
  const client = {
    async query() {
      throw Object.assign(new Error("ORDER_VERSION_CONFLICT"), { code: "40001" });
    },
  };

  await assert.rejects(
    dispatchPostgresPaperOrder(
      client,
      { operation: "PaperOrderDraftCreate", kind: "command" },
      draftPayload,
      {
        commandId: "77000000-0000-4000-8000-000000000003",
        correlationId: "77000000-0000-4000-8000-000000000002",
        requestedAt: "2026-09-17T12:00:00.000Z",
      },
    ),
    (error) => error.code === "ORDER_VERSION_CONFLICT" && error.message === "ORDER_VERSION_CONFLICT",
  );
});
