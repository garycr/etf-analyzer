import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPaperOrderSubmission,
  classifyPaperOrderTransition,
  executePaperOrderTransition,
} from "../../dist/Infrastructure/Web/workbench-client.js";
import { renderWorkbenchDocument } from "../../dist/Infrastructure/Web/workbench.js";

const orderId = "81000000-0000-4000-8000-000000000001";
const transitionCommandId = "81000000-0000-4000-8000-000000000002";
const confirmedAt = "2026-09-21T16:30:00.000Z";

function draftOrder() {
  return {
    orderId,
    instrumentId: "ETF-A",
    state: "Draft",
    statePresentation: {
      canonicalValue: "Draft",
      visibleText: "Draft",
      accessibleText: "Draft",
    },
    aggregateVersion: "4",
    side: "Buy",
    requestedQuantity: "2.0000000000",
    filledQuantity: "0.0000000000",
    openQuantity: "2.0000000000",
    unitPrice: "100.0000000000",
    tradeDate: "2026-09-21",
    confirmationRequired: {
      state: "DraftAwaitingConfirmation",
      statusText: "Confirmation required",
      causeText: "Review this hypothetical paper order before submitting it.",
      programmaticRole: "status",
      recovery: {
        actionId: "submit-paper-order",
        label: "Submit paper order",
        targetOperation: "PaperOrderTransition",
        focusTarget: "order-status",
        requiresConfirmation: true,
      },
    },
    transitionHistory: [],
  };
}

test("PT-UI-008 announces invalid transitions conflicts and recovery outcomes", async () => {
  const request = buildPaperOrderSubmission(
    orderId,
    "4",
    transitionCommandId,
    confirmedAt,
  );
  assert.deepEqual(request, {
    method: "POST",
    path: `/api/v1/paper-orders/${orderId}/transitions`,
    body: {
      transitionCommandId,
      expectedVersion: "4",
      transition: "OT-02",
      transitionPayload: {
        confirmation: {
          actorId: "local-user",
          confirmedAt,
          confirmationText: "Submit paper order",
        },
      },
    },
  });

  assert.deepEqual(classifyPaperOrderTransition(200, { outcome: "Succeeded" }), {
    action: "Reload",
    message: "Paper order submitted. Reloaded the authoritative order.",
  });
  for (const [status, code, message] of [
    [422, "ORDER_INVALID_TRANSITION", "The paper order transition is not allowed."],
    [409, "ORDER_VERSION_CONFLICT", "The paper order changed. Reload the current order before retrying."],
  ]) {
    assert.deepEqual(classifyPaperOrderTransition(status, {
      outcome: "Failed",
      error: { code, message },
    }), {
      action: "Reload",
      message: `${message} Reloaded the authoritative order.`,
    });
  }
  assert.deepEqual(classifyPaperOrderTransition(400, {
    outcome: "Failed",
    error: { code: "APPLICATION_REQUEST_INVALID", message: "private adapter detail" },
  }), {
    action: "Alert",
    message: "The paper order could not be submitted.",
  });

  const events = [];
  let sendCount = 0;
  assert.equal(await executePaperOrderTransition(request, {
    send: async (actual) => {
      sendCount += 1;
      assert.deepEqual(actual, request);
      return { status: 422, result: {
        outcome: "Failed",
        error: {
          code: "ORDER_INVALID_TRANSITION",
          message: "The paper order transition is not allowed.",
        },
      } };
    },
    reload: async (message) => events.push(["reload", message]),
    alert: (message) => events.push(["alert", message]),
  }), false);
  assert.deepEqual(events, [[
    "reload",
    "The paper order transition is not allowed. Reloaded the authoritative order.",
  ]]);
  assert.equal(sendCount, 1);

  const degraded = [];
  assert.equal(await executePaperOrderTransition(request, {
    send: async () => ({ status: 200, result: { outcome: "Succeeded" } }),
    reload: async (message) => events.push(["reload", message]),
    alert: (message) => events.push(["alert", message]),
    degraded: (event) => degraded.push(event),
  }), true);
  assert.deepEqual(events.at(-1), [
    "reload",
    "Paper order submitted. Reloaded the authoritative order.",
  ]);

  assert.equal(await executePaperOrderTransition(request, {
    send: async () => { throw new Error("private transport detail"); },
    reload: async () => assert.fail("transport failure must not reload"),
    alert: (message) => events.push(["alert", message]),
    degraded: (event) => degraded.push(event),
  }), false);
  assert.deepEqual(events.at(-1), [
    "alert",
    "The paper order could not be submitted. Retry the request or review local diagnostics.",
  ]);
  assert.deepEqual(degraded, [{
    code: "WORKBENCH_CLIENT_DEGRADED",
    stage: "PaperOrder",
    reason: "TransportFailed",
  }]);

  assert.equal(await executePaperOrderTransition(request, {
    send: async () => ({ status: 200, result: { outcome: "Succeeded" } }),
    reload: async () => { throw new Error("private reload detail"); },
    alert: (message) => events.push(["alert", message]),
    degraded: (event) => degraded.push(event),
  }), false);
  assert.deepEqual(events.at(-1), [
    "alert",
    "The paper order could not be reloaded. Retry the request or review local diagnostics.",
  ]);
  assert.deepEqual(degraded.at(-1), {
    code: "WORKBENCH_CLIENT_DEGRADED",
    stage: "PaperOrder",
    reason: "ReloadFailed",
  });

  const html = renderWorkbenchDocument({ readiness: "Ready", paperOrder: draftOrder() });
  assert.match(html, /id="paper-order-status" role="status" aria-live="polite"/u);
  assert.match(html, /data-operation="PaperOrderTransition" data-requires-confirmation="true"/u);
});
