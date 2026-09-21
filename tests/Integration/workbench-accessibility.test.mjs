import assert from "node:assert/strict";
import test from "node:test";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

import { startLoopbackApiServer } from "../../dist/Infrastructure/Http/api-adapter.js";
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

function watchlist(items = [
  { instrumentId: "ETF-A", displayName: "Alpha ETF", validationState: "Valid", position: "0" },
  { instrumentId: "ETF-B", displayName: "Beta ETF", validationState: "Valid", position: "1" },
]) {
  return { orderedItems: items, version: "7" };
}

function blockedState(state, role = "alert") {
  return {
    state,
    statusText: state === "AccessDenied" ? "Access denied" : "Analysis unavailable",
    causeText: "Review local readiness before continuing.",
    programmaticRole: role,
    recovery: null,
  };
}

async function browserWorkbench(context, initialModel) {
  let model = initialModel;
  const requests = [];
  const server = await startLoopbackApiServer(
    {
      allowedOrigins: ["http://127.0.0.1:0"],
      bodyLimitBytes: 1_048_576,
      port: 0,
    },
    (requestJson) => {
      const request = JSON.parse(requestJson);
      requests.push(request);
      if (request.operation === "WatchlistGet") {
        return { operation: request.operation, outcome: "Succeeded", data: model.watchlist };
      }
      if (request.operation === "WatchlistPut") {
        const retained = model.watchlist.orderedItems.filter(({ instrumentId }) => instrumentId !== request.payload.instrumentId);
        model = {
          ...model,
          watchlist: watchlist([...retained, {
            instrumentId: request.payload.instrumentId,
            displayName: request.payload.displayName,
            validationState: "Valid",
            position: String(retained.length),
          }]),
        };
        return { operation: request.operation, outcome: "Succeeded", data: model.watchlist };
      }
      if (request.operation === "WatchlistRemove") {
        model = {
          ...model,
          watchlist: watchlist(model.watchlist.orderedItems
            .filter(({ instrumentId }) => instrumentId !== request.payload.instrumentId)
            .map((item, position) => ({ ...item, position: String(position) }))),
        };
        return { operation: request.operation, outcome: "Succeeded", data: model.watchlist };
      }
      if (request.operation === "WatchlistReorder") {
        const byId = new Map(model.watchlist.orderedItems.map((item) => [item.instrumentId, item]));
        model = {
          ...model,
          watchlist: watchlist(request.payload.orderedInstrumentIds.map((instrumentId, position) => ({
            ...byId.get(instrumentId),
            position: String(position),
          }))),
        };
        return { operation: request.operation, outcome: "Succeeded", data: model.watchlist };
      }
      if (request.operation === "PaperOrderTransition") {
        model = { ...model, paperOrder: { ...model.paperOrder, state: "Submitted", confirmationRequired: null } };
        return { operation: request.operation, outcome: "Succeeded", data: { order: model.paperOrder } };
      }
      return { operation: request.operation, outcome: "Failed", error: { code: "APPLICATION_REQUEST_INVALID" } };
    },
    () => model,
  );
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const contexts = new Set();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    await new Promise((resolve) => server.close(resolve));
    throw error;
  }
  context.after(async () => {
    const contextResults = await Promise.allSettled(
      [...contexts].map((browserContext) => browserContext.close()),
    );
    const results = await Promise.allSettled([
      browser.close(),
      new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    ]);
    const rejected = [...contextResults, ...results].find((result) => result.status === "rejected");
    if (rejected !== undefined) throw rejected.reason;
  });
  return {
    browser,
    newPage: async (options) => {
      const browserContext = await browser.newContext(options);
      contexts.add(browserContext);
      return browserContext.newPage();
    },
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    setModel: (value) => { model = value; },
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

test("PT-ANA-A11Y-001 exposes blocked denied quarantined and no-signal analytics accessibly", async (context) => {
  const base = { readiness: "Ready", watchlist: watchlist() };
  const harness = await browserWorkbench(context, {
    ...base,
    analytics: { state: "NoSignal", signals: [], metrics: [], warnings: [] },
    evidence: blockedState("AccessDenied"),
  });
  const page = await harness.newPage({ viewport: { width: 1280, height: 720 } });
  for (const state of ["NoSignal", "AccessDenied", "InputQuarantined", "NoSafeOperation"]) {
    harness.setModel(state === "NoSignal"
      ? {
        ...base,
        analytics: { state: "NoSignal", signals: [], metrics: [], warnings: [] },
        evidence: blockedState("AccessDenied"),
      }
      : { ...base, analytics: blockedState(state), evidence: blockedState(state) });
    await page.goto(harness.origin);
    const results = await new AxeBuilder({ page }).include("#main-content").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    assert.deepEqual(results.violations, [], `${state}: ${JSON.stringify(results.violations)}`);
    if (state === "NoSignal") {
      const noSignal = page.locator("#analytics [role='status'][data-state='NoSignal']");
      await assert.doesNotReject(() => noSignal.waitFor());
      await assert.doesNotReject(() => noSignal.getByText(/No signal/u).waitFor());
    } else {
      await assert.doesNotReject(() => page.locator(`#analytics [data-state='${state}']`).waitFor());
      assert.equal(await page.locator(`#analytics [data-state='${state}']`).getAttribute("role"), "alert");
    }
  }
});

test("PT-UI-009 completes keyboard workflows without overflow at required viewports", async (context) => {
  const harness = await browserWorkbench(context, {
    readiness: "Ready",
    watchlist: watchlist(),
    paperOrder: draftOrder(),
  });
  const page = await harness.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(harness.origin);

  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Skip to content");
  await page.keyboard.press("Enter");
  assert.equal(new URL(page.url()).hash, "#main-content");

  await page.getByLabel("Instrument ID").fill("ETF-C");
  await page.getByLabel("Display name").fill("Gamma ETF");
  await page.getByRole("button", { name: "Add or update" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("status").filter({ hasText: "Watchlist updated." }).waitFor();
  await assert.doesNotReject(() => page.getByText("Gamma ETF", { exact: true }).waitFor());

  await page.getByRole("button", { name: "Move Beta ETF up" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("status").filter({ hasText: "Watchlist updated." }).waitFor();
  await assert.doesNotReject(() => page.getByRole("button", { name: "Move Beta ETF down" }).waitFor());
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Move Beta ETF down");

  await page.getByRole("button", { name: "Remove Gamma ETF" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("status").filter({ hasText: "Watchlist updated." }).waitFor();
  assert.equal(await page.getByText("Gamma ETF", { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), "Remove Alpha ETF");

  await page.getByRole("button", { name: "Submit paper order" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForLoadState("load");
  await page.getByRole("status").filter({ hasText: "Paper order submitted." }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === "order-status");
  assert.equal(harness.requests.filter(({ operation }) => operation === "PaperOrderTransition").length, 1);

  const desktopAxe = await new AxeBuilder({ page }).include("#main-content").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  assert.deepEqual(desktopAxe.violations, [], JSON.stringify(desktopAxe.violations));

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 768, height: 1024 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, JSON.stringify(viewport));
    const boxes = await page.locator("button, input, a").evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { text: element.textContent, left: box.left, right: box.right };
    }));
    assert.equal(boxes.every(({ left, right }) => left >= -1 && right <= viewport.width + 1), true, JSON.stringify({ viewport, boxes }));
  }
});
