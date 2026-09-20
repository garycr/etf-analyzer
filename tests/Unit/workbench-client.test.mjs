import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWatchlistPut,
  buildWatchlistRemove,
  buildWatchlistReorder,
  classifyWatchlistMutation,
  executeWatchlistMutation,
  admitWatchlistState,
  moveWatchlistItem,
  targetAfterWatchlistRemoval,
} from "../../dist/Infrastructure/Web/workbench-client.js";

test("PT-UI-004 builds exact version-bound watchlist mutations", () => {
  assert.deepEqual(buildWatchlistPut("ETF/A", "Alpha ETF", "7"), {
    method: "PUT",
    path: "/api/v1/watchlist/items/ETF%2FA",
    body: { displayName: "Alpha ETF", expectedVersion: "7" },
  });
  assert.deepEqual(buildWatchlistRemove("ETF/A", "7"), {
    method: "DELETE",
    path: "/api/v1/watchlist/items/ETF%2FA?expectedVersion=7",
  });
  assert.deepEqual(buildWatchlistReorder(["ETF-B", "ETF-A"], "7"), {
    method: "PUT",
    path: "/api/v1/watchlist/order",
    body: { orderedInstrumentIds: ["ETF-B", "ETF-A"], expectedVersion: "7" },
  });
});

test("PT-UI-004 reloads authoritative state after success or version conflict", () => {
  assert.deepEqual(classifyWatchlistMutation(200, { outcome: "Succeeded" }), {
    action: "Reload",
    message: "Watchlist updated.",
  });
  assert.deepEqual(classifyWatchlistMutation(409, {
    outcome: "Failed",
    error: { message: "The watchlist changed." },
  }), {
    action: "Reload",
    message: "The watchlist changed. Reloaded the current watchlist.",
  });
  assert.deepEqual(classifyWatchlistMutation(400, {
    outcome: "Failed",
    error: { message: "The application request is invalid." },
  }), {
    action: "Alert",
    message: "The application request is invalid.",
  });
  assert.deepEqual(classifyWatchlistMutation(400, {
    outcome: "Failed",
    error: {
      code: "APPLICATION_REQUEST_INVALID",
      message: "The application request is invalid.",
    },
  }), {
    action: "Reload",
    message: "The application request is invalid. Reloaded the current watchlist.",
  });
});

test("PT-UI-004 executes success conflict and validation outcomes", async () => {
  const request = buildWatchlistPut("ETF-A", "Alpha ETF", "7");
  const events = [];
  const run = (status, result) => executeWatchlistMutation(request, {
    send: async (actual) => {
      assert.deepEqual(actual, request);
      return { status, result };
    },
    reload: async (message) => events.push(["reload", message]),
    alert: (message) => events.push(["alert", message]),
  });

  assert.equal(await run(200, { outcome: "Succeeded" }), true);
  assert.equal(await run(409, {
    outcome: "Failed",
    error: { message: "The watchlist changed." },
  }), false);
  assert.equal(await run(400, {
    outcome: "Failed",
    error: { message: "Invalid watchlist input." },
  }), false);

  assert.deepEqual(events, [
    ["reload", "Watchlist updated."],
    ["reload", "The watchlist changed. Reloaded the current watchlist."],
    ["alert", "Invalid watchlist input."],
  ]);

  const degraded = [];
  await executeWatchlistMutation(request, {
    send: async () => { throw new Error("database password"); },
    reload: async () => assert.fail("transport failure must not reload"),
    alert: (message) => events.push(["alert", message]),
    degraded: (event) => degraded.push(event),
  });
  assert.deepEqual(events.at(-1), [
    "alert",
    "The watchlist could not be updated. Retry the request or review local diagnostics.",
  ]);
  assert.deepEqual(degraded, [{
    code: "WORKBENCH_CLIENT_DEGRADED",
    stage: "Watchlist",
    reason: "TransportFailed",
  }]);

  await executeWatchlistMutation(request, {
    send: async () => ({ status: 200, result: { outcome: "Succeeded" } }),
    reload: async () => { throw new Error("private reload detail"); },
    alert: (message) => events.push(["alert", message]),
    degraded: (event) => degraded.push(event),
  });
  assert.deepEqual(events.at(-1), [
    "alert",
    "The watchlist could not be reloaded. Retry the request or review local diagnostics.",
  ]);
  assert.deepEqual(degraded.at(-1), {
    code: "WORKBENCH_CLIENT_DEGRADED",
    stage: "Watchlist",
    reason: "ReloadFailed",
  });
});

test("PT-UI-004 preserves logical keyboard targets across reorder and remove", () => {
  const identities = ["ETF-A", "ETF-B", "ETF-C"];
  assert.deepEqual(moveWatchlistItem(identities, "ETF-B", "up"), ["ETF-B", "ETF-A", "ETF-C"]);
  assert.deepEqual(moveWatchlistItem(identities, "ETF-B", "down"), ["ETF-A", "ETF-C", "ETF-B"]);
  assert.deepEqual(moveWatchlistItem(identities, "ETF-A", "up"), identities);
  assert.equal(targetAfterWatchlistRemoval(identities, "ETF-B"), "ETF-C");
  assert.equal(targetAfterWatchlistRemoval(identities, "ETF-C"), "ETF-B");
  assert.equal(targetAfterWatchlistRemoval(["ETF-A"], "ETF-A"), null);
});

test("PT-UI-004 admits only canonical browser watchlist projections", () => {
  const result = {
    operation: "WatchlistGet",
    outcome: "Succeeded",
    data: {
      orderedItems: [{
        instrumentId: "ETF-A",
        displayName: "Alpha ETF",
        validationState: "Valid",
        position: "0",
      }],
      version: "7",
    },
  };
  assert.deepEqual(admitWatchlistState(result), result.data);
  assert.throws(
    () => admitWatchlistState({ ...result, data: { ...result.data, version: "07" } }),
    /WatchlistGet data is invalid/,
  );
  assert.throws(
    () => admitWatchlistState({
      ...result,
      data: { ...result.data, version: "9007199254740992" },
    }),
    /WatchlistGet data is invalid/,
  );
  assert.throws(
    () => admitWatchlistState({
      ...result,
      data: {
        ...result.data,
        orderedItems: [{
          ...result.data.orderedItems[0],
          position: "9007199254740992",
        }],
      },
    }),
    /WatchlistGet data is invalid/,
  );
  assert.throws(
    () => admitWatchlistState({
      ...result,
      data: { ...result.data, orderedItems: [{ ...result.data.orderedItems[0], position: -1 }] },
    }),
    /WatchlistGet data is invalid/,
  );
});
