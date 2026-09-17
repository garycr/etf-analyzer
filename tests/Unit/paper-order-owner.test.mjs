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
