import assert from "node:assert/strict";
import test from "node:test";

import {
  applicationCommandOperations,
  applicationQueryOperations,
  displayVerifiedResearch,
} from "../../dist/Application/application-boundary.js";

test("CT-ORD-001 displayed signals never create orders or ledger effects", () => {
  const research = Object.freeze({
    completeness: "Complete",
    integrity: "Verified",
    result: Object.freeze({
      signals: Object.freeze([
        Object.freeze({ instrumentId: "ETF-1", label: "Buy", score: "1.000000000000" }),
      ]),
    }),
  });

  const displayed = displayVerifiedResearch(research);

  assert.equal(displayed, research.result);
  assert.deepEqual(displayed.signals, research.result.signals);
  assert.equal("order" in displayed, false);
  assert.equal("fill" in displayed, false);
  assert.equal("ledger" in displayed, false);
});

test("CT-ORD-011 paper-order runtime contains no brokerage path", () => {
  const paperOrderOperations = [
    ...applicationCommandOperations,
    ...applicationQueryOperations,
  ].filter((operation) => operation.includes("PaperOrder"));

  assert.deepEqual(paperOrderOperations, [
    "PaperOrderDraftCreate",
    "PaperOrderTransition",
    "PaperOrderGet",
  ]);
  assert.equal(
    [...applicationCommandOperations, ...applicationQueryOperations]
      .some((operation) => /broker|provider|transmit|execution/iu.test(operation)),
    false,
  );
});
