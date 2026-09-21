import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { evaluateReadiness } from "../../dist/Application/application-boundary.js";
import { startLoopbackApiServer } from "../../dist/Infrastructure/Http/api-adapter.js";
import { createWorkbenchModelProvider } from "../../dist/Infrastructure/Web/workbench-runtime.js";
import { renderWorkbenchDocument } from "../../dist/Infrastructure/Web/workbench.js";

function send(port, path = "/") {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      method: "GET",
      path,
      headers: {
        host: `127.0.0.1:${port}`,
        accept: "text/html",
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

function job(jobId, status) {
  return {
    jobId,
    jobType: "FixtureIngestion",
    status,
    restartability: "Restartable",
    attempt: "1",
    operation: "FixtureIngestionStart",
    originalCommandId: "51000000-0000-4000-8000-000000000001",
    inputIdentity: {
      datasetId: "prices",
      datasetVersion: "2026-09-19",
      fixturePackageHash: "a".repeat(64),
    },
    createdAt: "2026-09-19T12:00:00.000Z",
    startedAt: "2026-09-19T12:01:00.000Z",
    completedAt: status === "Failed" ? "2026-09-19T12:02:00.000Z" : null,
    checkpoint: null,
    acceptedCount: "0",
    rejectedCount: status === "Failed" ? "1" : "0",
    controllingError: status === "Failed"
      ? {
        code: "FIXTURE_REQUIRED_INPUT_MISSING",
        message: "Required fixture input is missing.",
        boundedIdentifiers: { jobId },
        recovery: {
          actionId: "retry-job",
          label: "Retry job",
          targetOperation: "JobRestart",
          focusTarget: "job-status",
          requiresConfirmation: false,
        },
      }
      : null,
  };
}

function analyticsResult(signals = [{ instrumentId: "ETF-A", label: "Buy", score: "0.125000000000" }]) {
  return Object.freeze({
    domain: "etf.analytics.result.v1",
    resultSchemaVersion: "1.0.0",
    configurationHash: "b".repeat(64),
    signals: Object.freeze(signals.map((signal) => Object.freeze(signal))),
    trades: Object.freeze([]),
    metrics: Object.freeze([Object.freeze({
      metricId: "totalReturn",
      numericClass: "Rate",
      value: "0.031250000000",
    })]),
    warnings: Object.freeze(["Fixture data only"]),
  });
}

function evidence(result) {
  return Object.freeze({
    domain: "etf.analytics.bundle.v1",
    evidenceSchemaVersion: "1.0.0",
    evidenceId: "evidence-fixture-1",
    baselineVersion: "v1.0.0",
    inputSetId: "input-fixture-1",
    evaluationAt: "2026-01-31T00:00:00.000Z",
    ruleId: "p0-rule",
    ruleVersion: "1.0.0",
    parameters: Object.freeze({ lookbackSessions: "20" }),
    codeHash: "1".repeat(64),
    seed: "42",
    benchmark: Object.freeze({ instrumentId: "BENCH-1", version: "1" }),
    providerPolicyReferences: Object.freeze(["fixture-policy-1"]),
    environment: Object.freeze({ dependencyLockHash: "2".repeat(64), runtime: "node-20" }),
    assumptions: Object.freeze({
      costRate: "0.001000000000",
      fillTiming: "next-session-open",
      slippageRate: "0.000500000000",
    }),
    result,
    inputHash: "3".repeat(64),
    configurationHash: "b".repeat(64),
    resultHash: "4".repeat(64),
    bundleHash: "5".repeat(64),
    reproducibilityStatus: "Complete",
    reproducibilityReason: null,
    retentionPolicyVersion: "RET-A-1.0",
    retentionEpoch: "2026-01-31T00:00:00.000Z",
  });
}

function paperOrder(state) {
  return {
    orderId: "57000000-0000-4000-8000-000000000001",
    instrumentId: "ETF-<A>",
    state,
    aggregateVersion: "2",
    researchEvidenceId: "57000000-0000-4000-8000-000000000002",
    side: "Buy",
    requestedQuantity: "1.0000000000",
    filledQuantity: state === "Filled" ? "1.0000000000" : "0.0000000000",
    openQuantity: state === "Filled" ? "0.0000000000" : "1.0000000000",
    unitPrice: "100.0000000000",
    tradeDate: "2026-01-30",
    confirmation: state === "Draft"
      ? null
      : {
        actorId: "local-user",
        confirmedAt: "2026-01-30T12:00:00.000Z",
        confirmationText: "Submit paper order",
      },
    transitionHistory: [],
  };
}

function readySnapshot(checkedAt = "2026-09-21T13:00:00.000Z") {
  return evaluateReadiness({
    checkedAt,
    liveness: "Live",
    dependencies: Object.fromEntries([
      "PostgreSQL",
      "Migrations",
      "FixturePolicy",
      "LocalDependency",
      "DenialAudit",
      "LedgerIntegrity",
    ].map((dependency) => [dependency, { ready: true, checkedAt }])),
  });
}

function portfolio(reconciliationState = "Reconciled") {
  const blocked = reconciliationState === "IntegrityBlocked";
  return {
    portfolioId: "58000000-0000-4000-8000-000000000001",
    portfolioVersion: "7",
    asOf: "2026-01-31T00:00:00.000Z",
    valuationSnapshotId: "58000000-0000-4000-8000-000000000002",
    precisionPolicyVersion: "DEC-014",
    baselineVersion: "v1.0.0",
    cash: blocked ? "0.00000000" : "1000.00000000",
    lots: blocked ? [] : [
      {
        lotId: "58000000-0000-4000-8000-000000000004",
        instrumentId: "ETF-<B>",
        acquiredAt: "2026-01-30T12:00:00.000Z",
        ledgerSequence: "2",
        openQuantity: "1.0000000000",
        openBasis: "100.00000000",
      },
      {
        lotId: "58000000-0000-4000-8000-000000000003",
        instrumentId: "ETF-A",
        acquiredAt: "2026-01-30T11:00:00.000Z",
        ledgerSequence: "1",
        openQuantity: "2.0000000000",
        openBasis: "200.00000000",
      },
    ],
    positions: blocked ? [] : [
      { instrumentId: "ETF-<B>", quantity: "1.0000000000", basis: "100.00000000", valuation: "90.00000000", unrealizedPnL: "-10.00000000" },
      { instrumentId: "ETF-A", quantity: "2.0000000000", basis: "200.00000000", valuation: "220.00000000", unrealizedPnL: "20.00000000" },
    ],
    realizedPnL: blocked ? "0.00000000" : "-30.00000000",
    totalEquity: blocked ? "0.00000000" : "1310.00000000",
    reconciliationState,
  };
}

test("PT-UI-007 renders unselected and reconciled-empty portfolio states", () => {
  const readiness = readySnapshot();
  const unselected = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const request = JSON.parse(requestJson);
      if (request.operation === "ReadinessGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { readiness } };
      }
      return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
    },
    now: () => "2026-09-21T14:00:00.000Z",
    createId: () => "58000000-0000-4000-8000-000000000098",
    knownJobIds: [],
    onDegraded: assert.fail,
  })();
  assert.match(renderWorkbenchDocument(unselected), /No reconciled portfolio selected\./);

  const emptyPortfolio = { ...portfolio(), lots: [], positions: [] };
  const empty = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const request = JSON.parse(requestJson);
      if (request.operation === "ReadinessGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { readiness } };
      }
      if (request.operation === "WatchlistGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
      }
      return { operation: request.operation, outcome: "Succeeded", data: { portfolio: emptyPortfolio } };
    },
    now: () => "2026-09-21T14:00:00.000Z",
    createId: () => "58000000-0000-4000-8000-000000000097",
    knownJobIds: [],
    selectedPortfolio: {
      portfolioId: emptyPortfolio.portfolioId,
      asOf: emptyPortfolio.asOf,
    },
    onDegraded: assert.fail,
  })();
  const document = renderWorkbenchDocument(empty);
  assert.match(document, /No positions\./);
  assert.match(document, /No open lots\./);
});

test("PT-UI-007 fails closed for portfolio query and projection failures", () => {
  for (const scenario of [
    {
      name: "query failure",
      portfolioResult: { operation: "PortfolioGet", outcome: "Failed", error: { code: "LEDGER_INTEGRITY_FAILED" } },
      reason: "QueryFailed",
    },
    {
      name: "malformed success",
      portfolioResult: {
        operation: "PortfolioGet",
        outcome: "Succeeded",
        data: { portfolio: { ...portfolio(), cash: "1" } },
      },
      reason: "ResultInvalid",
    },
  ]) {
    const degraded = [];
    const provider = createWorkbenchModelProvider({
      execute: (requestJson) => {
        const request = JSON.parse(requestJson);
        if (request.operation === "ReadinessGet") {
          return { operation: request.operation, outcome: "Succeeded", data: { readiness: readySnapshot() } };
        }
        if (request.operation === "WatchlistGet") {
          return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
        }
        return scenario.portfolioResult;
      },
      now: () => "2026-09-21T14:00:00.000Z",
      createId: () => "58000000-0000-4000-8000-000000000096",
      knownJobIds: [],
      selectedPortfolio: {
        portfolioId: "58000000-0000-4000-8000-000000000001",
        asOf: "2026-01-31T00:00:00.000Z",
      },
      onDegraded: (event) => degraded.push(event),
    });
    assert.deepEqual(provider(), { readiness: "NotReady" }, scenario.name);
    assert.deepEqual(degraded, [{
      code: "WORKBENCH_MODEL_DEGRADED",
      stage: "Portfolio",
      reason: scenario.reason,
    }], scenario.name);
  }
});

test("PT-UI-007 presents canonical reconciled portfolio values and integrity blocking", async (context) => {
  const portfolioId = "58000000-0000-4000-8000-000000000001";
  const asOf = "2026-01-31T00:00:00.000Z";
  let reconciliationState = "Reconciled";
  const requests = [];
  const provider = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const request = JSON.parse(requestJson);
      requests.push(request);
      if (request.operation === "ReadinessGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { readiness: readySnapshot() } };
      }
      if (request.operation === "WatchlistGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
      }
      if (request.operation === "PortfolioGet") {
        return {
          operation: request.operation,
          outcome: "Succeeded",
          data: { portfolio: portfolio(reconciliationState) },
        };
      }
      assert.fail(`Unexpected operation ${request.operation}`);
    },
    now: () => "2026-09-21T14:00:00.000Z",
    createId: () => "58000000-0000-4000-8000-000000000099",
    knownJobIds: [],
    selectedPortfolio: { portfolioId, asOf },
    onDegraded: assert.fail,
  });
  const server = await startLoopbackApiServer(
    { allowedOrigins: ["http://127.0.0.1:5173"], bodyLimitBytes: 1_048_576, port: 0 },
    () => assert.fail("HTTP application dispatch is not expected"),
    provider,
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  const reconciled = await send(address.port);
  assert.equal(reconciled.status, 200);
  assert.match(reconciled.body, /data-reconciliation-state="Reconciled"/);
  assert.match(reconciled.body, /Cash[\s\S]+1000\.00000000/);
  assert.match(reconciled.body, /Realized P&amp;L<\/dt><dd>-30\.00000000/);
  assert.match(reconciled.body, /Total equity<\/dt><dd>1310\.00000000/);
  assert.match(reconciled.body, /ETF-A[\s\S]+2\.0000000000[\s\S]+200\.00000000[\s\S]+220\.00000000[\s\S]+20\.00000000/);
  assert.match(reconciled.body, /ETF-&lt;B&gt;[\s\S]+1\.0000000000[\s\S]+100\.00000000[\s\S]+90\.00000000[\s\S]+-10\.00000000/);
  assert.doesNotMatch(reconciled.body, /ETF-<B>/);
  const positionsTable = reconciled.body.match(/<table id="portfolio-positions">[\s\S]+?<\/table>/)?.[0];
  const lotsTable = reconciled.body.match(/<table id="portfolio-lots">[\s\S]+?<\/table>/)?.[0];
  assert.notEqual(positionsTable, undefined);
  assert.notEqual(lotsTable, undefined);
  assert.ok(positionsTable.indexOf("ETF-&lt;B&gt;") < positionsTable.indexOf("ETF-A"));
  assert.ok(lotsTable.indexOf("ETF-A") < lotsTable.indexOf("ETF-&lt;B&gt;"));
  const portfolioSection = reconciled.body.match(/<section id="portfolio"[\s\S]+?<\/section>/)?.[0];
  assert.notEqual(portfolioSection, undefined);
  assert.doesNotMatch(portfolioSection, /Research only/);

  reconciliationState = "IntegrityBlocked";
  const blocked = await send(address.port);
  assert.equal(blocked.status, 200);
  assert.match(blocked.body, /data-state="IntegrityBlocked"/);
  assert.match(blocked.body, /role="alert"[\s\S]+Integrity blocked/);
  assert.match(blocked.body, /data-operation="ReadinessGet"[^>]*>Review integrity status<\/button>/);
  assert.doesNotMatch(blocked.body, /1000\.00000000|1310\.00000000|-30\.00000000|ETF-A|ETF-&lt;B&gt;/);

  assert.deepEqual(
    requests.filter(({ operation }) => operation === "PortfolioGet").map(({ payload }) => payload),
    [{ portfolioId, asOf }, { portfolioId, asOf }],
  );
});

test("PT-UI-006 renders authoritative paper transition history and an empty unselected state", async (context) => {
  const order = paperOrder("Draft");
  order.transitionHistory = [{
    transitionCommandId: "57000000-0000-4000-8000-000000000003",
    transition: "OT-01",
    sourceState: "Initial",
    targetState: "Draft",
    trigger: "UserCreatedFromResearch",
    occurredAt: "2026-01-30T11:00:00.000Z",
    actorId: "local-user",
    correlationId: "57000000-0000-4000-8000-000000000004",
    priorVersion: "0",
    resultingVersion: "1",
    baselineVersion: "v1.0.0",
  }];
  const readiness = readySnapshot();
  const provider = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const request = JSON.parse(requestJson);
      if (request.operation === "ReadinessGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { readiness } };
      }
      if (request.operation === "WatchlistGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
      }
      return { operation: request.operation, outcome: "Succeeded", data: { order } };
    },
    now: () => "2026-09-21T13:00:00.000Z",
    createId: () => "57000000-0000-4000-8000-000000000099",
    knownJobIds: [],
    selectedPaperOrderId: order.orderId,
    onDegraded: assert.fail,
  });
  const server = await startLoopbackApiServer(
    { allowedOrigins: ["http://127.0.0.1:5173"], bodyLimitBytes: 1_048_576, port: 0 },
    () => assert.fail("HTTP application dispatch is not expected"),
    provider,
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  const response = await send(address.port);
  assert.match(response.body, /data-transition="OT-01"/);
  assert.match(response.body, /Initial to Draft/);
  assert.match(response.body, /datetime="2026-01-30T11:00:00\.000Z"/);

  const unselected = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const request = JSON.parse(requestJson);
      if (request.operation === "ReadinessGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { readiness } };
      }
      return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
    },
    now: () => "2026-09-21T13:00:00.000Z",
    createId: () => "57000000-0000-4000-8000-000000000098",
    knownJobIds: [],
    onDegraded: assert.fail,
  })();
  assert.equal(unselected.paperOrder, undefined);
  assert.match(renderWorkbenchDocument(unselected), /No hypothetical orders\./);
});

test("PT-UI-006 fails closed for paper-order query and projection failures", () => {
  for (const scenario of [
    {
      name: "query failure",
      paperResult: { operation: "PaperOrderGet", outcome: "Failed", error: { code: "ORDER_NOT_FOUND" } },
      reason: "QueryFailed",
    },
    {
      name: "malformed success",
      paperResult: { operation: "PaperOrderGet", outcome: "Succeeded", data: { order: { state: "Unknown" } } },
      reason: "ResultInvalid",
    },
  ]) {
    const degraded = [];
    const provider = createWorkbenchModelProvider({
      execute: (requestJson) => {
        const request = JSON.parse(requestJson);
        if (request.operation === "ReadinessGet") {
          return { operation: request.operation, outcome: "Succeeded", data: { readiness: readySnapshot() } };
        }
        if (request.operation === "WatchlistGet") {
          return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
        }
        return scenario.paperResult;
      },
      now: () => "2026-09-21T13:00:00.000Z",
      createId: () => "57000000-0000-4000-8000-000000000097",
      knownJobIds: [],
      selectedPaperOrderId: "57000000-0000-4000-8000-000000000001",
      onDegraded: (event) => degraded.push(event),
    });

    assert.deepEqual(provider(), { readiness: "NotReady" }, scenario.name);
    assert.deepEqual(degraded, [{
      code: "WORKBENCH_MODEL_DEGRADED",
      stage: "PaperOrder",
      reason: scenario.reason,
    }], scenario.name);
  }
});

test("PT-UI-006 requires explicit paper confirmation and presents all eight order states", async (context) => {
  const checkedAt = "2026-09-21T13:00:00.000Z";
  const readiness = evaluateReadiness({
    checkedAt,
    liveness: "Live",
    dependencies: Object.fromEntries([
      "PostgreSQL",
      "Migrations",
      "FixturePolicy",
      "LocalDependency",
      "DenialAudit",
      "LedgerIntegrity",
    ].map((dependency) => [dependency, { ready: true, checkedAt }])),
  });
  const orderId = "57000000-0000-4000-8000-000000000001";
  let currentState = "Draft";
  const requests = [];
  const provideWorkbenchModel = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const request = JSON.parse(requestJson);
      requests.push(request);
      if (request.operation === "ReadinessGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { readiness } };
      }
      if (request.operation === "WatchlistGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
      }
      if (request.operation === "PaperOrderGet") {
        return {
          operation: request.operation,
          outcome: "Succeeded",
          data: { order: paperOrder(currentState) },
        };
      }
      assert.fail(`Unexpected operation ${request.operation}`);
    },
    now: () => checkedAt,
    createId: () => "57000000-0000-4000-8000-000000000099",
    knownJobIds: [],
    selectedPaperOrderId: orderId,
    onDegraded: assert.fail,
  });
  const server = await startLoopbackApiServer(
    { allowedOrigins: ["http://127.0.0.1:5173"], bodyLimitBytes: 1_048_576, port: 0 },
    () => assert.fail("HTTP application dispatch is not expected"),
    provideWorkbenchModel,
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  for (const [state, label] of [
    ["Draft", "Draft"],
    ["Submitted", "Submitted"],
    ["Accepted", "Accepted"],
    ["Partial", "Partially Filled"],
    ["Filled", "Filled"],
    ["Rejected", "Rejected"],
    ["Canceled", "Canceled"],
    ["Expired", "Expired"],
  ]) {
    currentState = state;
    const response = await send(address.port);
    assert.equal(response.status, 200, state);
    assert.match(response.body, new RegExp(`<span id="order-status"[^>]*>${label}<\\/span>`), state);
    assert.match(response.body, /ETF-&lt;A&gt;[\s\S]+1\.0000000000[\s\S]+100\.0000000000/, state);
    assert.doesNotMatch(response.body, /ETF-<A>/, state);
    assert.match(response.body, /No recorded transitions\./, state);
    assert.match(response.body, /<section id="paper"[\s\S]+Research only — hypothetical — user makes all investment decisions\.[\s\S]+<\/section>/, state);
    if (state === "Draft") {
      assert.match(response.body, /data-state="DraftAwaitingConfirmation"/);
      assert.match(response.body, /Confirmation required/);
      assert.match(response.body, /data-operation="PaperOrderTransition"[^>]*data-requires-confirmation="true"[^>]*>Submit paper order<\/button>/);
    } else {
      assert.doesNotMatch(response.body, /DraftAwaitingConfirmation|Submit paper order/);
    }
  }

  assert.deepEqual(
    requests.filter(({ operation }) => operation === "PaperOrderGet").map(({ payload }) => payload),
    Array.from({ length: 8 }, () => ({ orderId })),
  );
  assert.equal(requests.some(({ operation }) => operation === "PaperOrderTransition"), false);
});

test("PT-UI-005 preserves analytical and evidence warnings values and blocked states", async (context) => {
  const checkedAt = "2026-09-21T12:10:00.000Z";
  const readiness = evaluateReadiness({
    checkedAt,
    liveness: "Live",
    dependencies: Object.fromEntries([
      "PostgreSQL",
      "Migrations",
      "FixturePolicy",
      "LocalDependency",
      "DenialAudit",
      "LedgerIntegrity",
    ].map((dependency) => [dependency, { ready: true, checkedAt }])),
  });
  const publicationTargetId = "56000000-0000-4000-8000-000000000001";
  const successfulResult = analyticsResult();
  const requests = [];
  const provideWorkbenchModel = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const request = JSON.parse(requestJson);
      requests.push(request);
      if (request.operation === "ReadinessGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { readiness } };
      }
      if (request.operation === "WatchlistGet") {
        return {
          operation: request.operation,
          outcome: "Succeeded",
          data: { orderedItems: [], version: "0" },
        };
      }
      if (request.operation === "AnalyticsResultGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { result: successfulResult } };
      }
      if (request.operation === "EvidenceGet") {
        return {
          operation: request.operation,
          outcome: "Succeeded",
          data: { evidence: evidence(successfulResult) },
        };
      }
      assert.fail(`Unexpected operation ${request.operation}`);
    },
    now: () => checkedAt,
    createId: () => "56000000-0000-4000-8000-000000000099",
    knownJobIds: [],
    selectedAnalytics: { publicationTargetId, evidenceId: "evidence-fixture-1" },
    onDegraded: assert.fail,
  });
  const server = await startLoopbackApiServer(
    { allowedOrigins: ["http://127.0.0.1:5173"], bodyLimitBytes: 1_048_576, port: 0 },
    () => assert.fail("HTTP application dispatch is not expected"),
    provideWorkbenchModel,
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const response = await send(address.port);

  assert.equal(response.status, 200);
  assert.match(response.body, /ETF-A[\s\S]+Buy[\s\S]+0\.125000000000/);
  assert.match(response.body, /totalReturn[\s\S]+0\.031250000000/);
  assert.match(response.body, /Fixture data only/);
  assert.match(response.body, /evidence-fixture-1[\s\S]+Complete[\s\S]+2026-01-31T00:00:00\.000Z/);
  assert.match(response.body, /<section id="analytics"[\s\S]+Research only — hypothetical — user makes all investment decisions\.[\s\S]+<\/section>/);
  assert.match(response.body, /<section id="evidence"[\s\S]+Research only — hypothetical — user makes all investment decisions\.[\s\S]+<\/section>/);
  assert.deepEqual(requests.map(({ operation, payload }) => ({ operation, payload })), [
    { operation: "ReadinessGet", payload: {} },
    { operation: "WatchlistGet", payload: {} },
    { operation: "AnalyticsResultGet", payload: { publicationTargetId } },
    { operation: "EvidenceGet", payload: { evidenceId: "evidence-fixture-1" } },
  ]);

  const noSignalModel = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const request = JSON.parse(requestJson);
      if (request.operation === "ReadinessGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { readiness } };
      }
      if (request.operation === "WatchlistGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
      }
      if (request.operation === "AnalyticsResultGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { result: analyticsResult([]) } };
      }
      return {
        operation: request.operation,
        outcome: "Failed",
        error: { code: "ANALYTICS_EVIDENCE_ACCESS_DENIED", message: "secret owner detail" },
      };
    },
    now: () => checkedAt,
    createId: () => "56000000-0000-4000-8000-000000000098",
    knownJobIds: [],
    selectedAnalytics: { publicationTargetId, evidenceId: "evidence-denied" },
    onDegraded: assert.fail,
  });
  const noSignalDocument = noSignalModel();
  assert.equal(noSignalDocument.analytics?.state, "NoSignal");
  assert.equal(noSignalDocument.evidence?.state, "AccessDenied");
  assert.doesNotMatch(JSON.stringify(noSignalDocument), /secret owner detail/);

  const quarantinedModel = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const request = JSON.parse(requestJson);
      if (request.operation === "ReadinessGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { readiness } };
      }
      if (request.operation === "WatchlistGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
      }
      return {
        operation: request.operation,
        outcome: "Failed",
        error: { code: "ANALYTICS_INPUT_QUARANTINED", message: "secret quarantine detail" },
      };
    },
    now: () => checkedAt,
    createId: () => "56000000-0000-4000-8000-000000000097",
    knownJobIds: [],
    selectedAnalytics: { publicationTargetId, evidenceId: "evidence-quarantined" },
    onDegraded: assert.fail,
  });
  const quarantinedDocument = quarantinedModel();
  assert.equal(quarantinedDocument.analytics?.state, "InputQuarantined");
  assert.equal(quarantinedDocument.evidence?.state, "InputQuarantined");
  assert.doesNotMatch(JSON.stringify(quarantinedDocument), /secret quarantine detail/);

  const publicationBlockedModel = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const request = JSON.parse(requestJson);
      if (request.operation === "ReadinessGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { readiness } };
      }
      if (request.operation === "WatchlistGet") {
        return { operation: request.operation, outcome: "Succeeded", data: { orderedItems: [], version: "0" } };
      }
      return {
        operation: request.operation,
        outcome: "Failed",
        error: { code: "ANALYTICS_PUBLICATION_BLOCKED", message: "secret publication detail" },
      };
    },
    now: () => checkedAt,
    createId: () => "56000000-0000-4000-8000-000000000096",
    knownJobIds: [],
    selectedAnalytics: { publicationTargetId, evidenceId: "evidence-blocked" },
    onDegraded: assert.fail,
  });
  const publicationBlockedDocument = publicationBlockedModel();
  assert.equal(publicationBlockedDocument.analytics?.state, "NoSafeOperation");
  assert.equal(publicationBlockedDocument.evidence?.state, "NoSafeOperation");
  assert.doesNotMatch(JSON.stringify(publicationBlockedDocument), /secret publication detail/);
});

test("PT-UI-003B and PT-UI-004 compose authoritative readiness jobs and watchlist", async (context) => {
  const checkedAt = "2026-09-19T12:10:00.000Z";
  const readiness = evaluateReadiness({
    checkedAt,
    liveness: "Live",
    dependencies: {
      PostgreSQL: { ready: true, checkedAt },
      Migrations: { ready: true, checkedAt },
      FixturePolicy: { ready: false, checkedAt, errorCode: "APPLICATION_CONFIGURATION_INVALID" },
      LocalDependency: { ready: true, checkedAt },
      DenialAudit: { ready: true, checkedAt },
      LedgerIntegrity: { ready: true, checkedAt },
    },
  });
  const failedJobId = "50000000-0000-4000-8000-000000000001";
  const runningJobId = "50000000-0000-4000-8000-000000000002";
  const missingJobId = "50000000-0000-4000-8000-000000000003";
  const requests = [];
  const degraded = [];
  let id = 10;
  const execute = (requestJson) => {
    const request = JSON.parse(requestJson);
    requests.push(request);
    if (request.operation === "ReadinessGet") {
      return { operation: "ReadinessGet", outcome: "Succeeded", data: { readiness } };
    }
    if (request.operation === "WatchlistGet") {
      return {
        operation: "WatchlistGet",
        outcome: "Succeeded",
        data: {
          orderedItems: [
            {
              instrumentId: "ETF-A",
              displayName: "Alpha <Income>",
              validationState: "Valid",
              position: "0",
            },
            {
              instrumentId: "ETF-B",
              displayName: "Beta & Growth",
              validationState: "Invalid",
              position: "1",
            },
          ],
          version: "7",
        },
      };
    }
    if (request.payload.jobId === missingJobId) {
      return {
        operation: "JobGet",
        outcome: "Failed",
        error: { code: "APPLICATION_JOB_NOT_FOUND" },
      };
    }
    return {
      operation: "JobGet",
      outcome: "Succeeded",
      data: { job: job(request.payload.jobId, request.payload.jobId === failedJobId ? "Failed" : "Running") },
    };
  };
  const provideWorkbenchModel = createWorkbenchModelProvider({
    execute,
    now: () => checkedAt,
    createId: () => `52000000-0000-4000-8000-${String(id++).padStart(12, "0")}`,
    knownJobIds: [failedJobId, runningJobId, missingJobId],
    onDegraded: (event) => degraded.push(event),
  });
  const server = await startLoopbackApiServer(
    { allowedOrigins: ["http://127.0.0.1:5173"], bodyLimitBytes: 1_048_576, port: 0 },
    execute,
    provideWorkbenchModel,
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const response = await send(address.port);

  assert.equal(response.status, 200);
  assert.deepEqual(degraded, []);
  assert.match(response.body, /<span>Status: <\/span>NotReady/);
  assert.match(response.body, /APPLICATION_CONFIGURATION_INVALID/);
  assert.match(response.body, /Watchlist version 7/);
  assert.match(response.body, /Alpha &lt;Income&gt;[\s\S]+ETF-A[\s\S]+Valid/);
  assert.match(response.body, /Beta &amp; Growth[\s\S]+ETF-B[\s\S]+Invalid/);
  assert.doesNotMatch(response.body, /Alpha <Income>|Beta & Growth/);
  assert.match(response.body, /<form id="watchlist-form"/);
  assert.match(response.body, /<label for="watchlist-instrument-id">Instrument ID<\/label>/);
  assert.match(response.body, /<label for="watchlist-display-name">Display name<\/label>/);
  assert.match(response.body, /<button type="submit">Add or update<\/button>/);
  assert.match(response.body, /data-action="move-up"[\s\S]+data-action="move-down"[\s\S]+data-action="remove"/);
  assert.match(response.body, /<p id="watchlist-status" role="status" aria-live="polite"/);
  assert.match(response.body, /<script type="module" src="\/workbench\.js"><\/script>/);
  assert.doesNotMatch(response.body, /onclick=|tabindex="[1-9]/i);
  assert.match(response.headers["content-security-policy"], /script-src 'self'/);
  assert.match(response.body, new RegExp(`data-job-id="${failedJobId}"`));
  assert.doesNotMatch(response.body, new RegExp(runningJobId));
  assert.doesNotMatch(response.body, new RegExp(missingJobId));
  assert.deepEqual(requests[0], {
    operation: "ReadinessGet",
    requestId: "52000000-0000-4000-8000-000000000010",
    correlationId: "52000000-0000-4000-8000-000000000011",
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt: checkedAt,
    payload: {},
  });
  assert.deepEqual(requests.map(({ operation, payload }) => ({ operation, payload })), [
    { operation: "ReadinessGet", payload: {} },
    { operation: "WatchlistGet", payload: {} },
    { operation: "JobGet", payload: { jobId: failedJobId } },
    { operation: "JobGet", payload: { jobId: runningJobId } },
    { operation: "JobGet", payload: { jobId: missingJobId } },
  ]);

  const script = await send(address.port, "/workbench.js");
  assert.equal(script.status, 200);
  assert.equal(script.headers["content-type"], "application/javascript; charset=utf-8");
  assert.match(script.body, /WatchlistGet/);
  assert.match(script.body, /WatchlistPut/);
  assert.match(script.body, /WatchlistRemove/);
  assert.match(script.body, /WatchlistReorder/);
});

test("PT-UI-003B fails closed without an HTTP 500 for provider boundary failures", async (context) => {
  const cases = [
    {
      name: "executor throws",
      execute: () => { throw new Error("secret"); },
      createId: () => "53000000-0000-4000-8000-000000000001",
      reason: "ExecutionFailed",
    },
    {
      name: "result is malformed",
      execute: () => ({}),
      createId: () => "53000000-0000-4000-8000-000000000002",
      reason: "ResultInvalid",
    },
    {
      name: "readiness query fails",
      execute: () => ({ operation: "ReadinessGet", outcome: "Failed" }),
      createId: () => "53000000-0000-4000-8000-000000000003",
      reason: "QueryFailed",
    },
    {
      name: "success data is invalid",
      execute: () => ({ operation: "ReadinessGet", outcome: "Succeeded", data: { readiness: {} } }),
      createId: () => "53000000-0000-4000-8000-000000000004",
      reason: "ResultInvalid",
    },
    {
      name: "envelope construction fails",
      execute: () => assert.fail("executor must not be called"),
      createId: () => { throw new Error("id source unavailable"); },
      reason: "EnvelopeConstructionFailed",
    },
  ];

  for (const scenario of cases) {
    const degraded = [];
    const provider = createWorkbenchModelProvider({
      execute: scenario.execute,
      now: () => "2026-09-19T12:10:00.000Z",
      createId: scenario.createId,
      knownJobIds: [],
      onDegraded: (event) => {
        degraded.push(event);
        if (scenario.name === "executor throws") throw new Error("observer unavailable");
      },
    });
    const server = await startLoopbackApiServer(
      { allowedOrigins: ["http://127.0.0.1:5173"], bodyLimitBytes: 1_048_576, port: 0 },
      scenario.execute,
      provider,
    );
    context.after(() => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }));
    const address = server.address();
    assert.notEqual(address, null, scenario.name);
    assert.equal(typeof address, "object", scenario.name);

    const response = await send(address.port);

    assert.equal(response.status, 200, scenario.name);
    assert.match(response.body, /<span>Status: <\/span>NotReady/, scenario.name);
    assert.match(response.body, /Retry the request or review local diagnostics\./, scenario.name);
    assert.doesNotMatch(
      response.body,
      /secret|id source unavailable|observer unavailable/,
      scenario.name,
    );
    assert.deepEqual(degraded, [{
      code: "WORKBENCH_MODEL_DEGRADED",
      stage: "Readiness",
      reason: scenario.reason,
    }], scenario.name);
  }
});

test("PT-UI-003B degrades for non-not-found JobGet failures", () => {
  const checkedAt = "2026-09-19T12:10:00.000Z";
  const readiness = evaluateReadiness({
    checkedAt,
    liveness: "Live",
    dependencies: Object.fromEntries([
      "PostgreSQL",
      "Migrations",
      "FixturePolicy",
      "LocalDependency",
      "DenialAudit",
      "LedgerIntegrity",
    ].map((dependency) => [dependency, { ready: true, checkedAt }])),
  });
  const degraded = [];
  const provider = createWorkbenchModelProvider({
    execute: (requestJson) => {
      const operation = JSON.parse(requestJson).operation;
      if (operation === "ReadinessGet") {
        return { operation: "ReadinessGet", outcome: "Succeeded", data: { readiness } };
      }
      if (operation === "WatchlistGet") {
        return {
          operation: "WatchlistGet",
          outcome: "Succeeded",
          data: { orderedItems: [], version: "0" },
        };
      }
      return {
        operation: "JobGet",
        outcome: "Failed",
        error: { code: "APPLICATION_DATABASE_UNAVAILABLE" },
      };
    },
    now: () => checkedAt,
    createId: () => "55000000-0000-4000-8000-000000000001",
    knownJobIds: ["55000000-0000-4000-8000-000000000002"],
    onDegraded: (event) => degraded.push(event),
  });

  assert.deepEqual(provider(), { readiness: "NotReady" });
  assert.deepEqual(degraded, [{
    code: "WORKBENCH_MODEL_DEGRADED",
    stage: "Jobs",
    reason: "QueryFailed",
  }]);
});

test("PT-UI-003B fails closed when known-job validation fails", async (context) => {
  const checkedAt = "2026-09-19T12:10:00.000Z";
  const readiness = evaluateReadiness({
    checkedAt,
    liveness: "Live",
    dependencies: Object.fromEntries([
      "PostgreSQL",
      "Migrations",
      "FixturePolicy",
      "LocalDependency",
      "DenialAudit",
      "LedgerIntegrity",
    ].map((dependency) => [dependency, { ready: true, checkedAt }])),
  });
  const degraded = [];
  const execute = (requestJson) => {
    const request = JSON.parse(requestJson);
    if (request.operation === "ReadinessGet") {
      return { operation: "ReadinessGet", outcome: "Succeeded", data: { readiness } };
    }
    if (request.operation === "WatchlistGet") {
      return {
        operation: "WatchlistGet",
        outcome: "Succeeded",
        data: { orderedItems: [], version: "0" },
      };
    }
    return { operation: "JobGet", outcome: "Succeeded", data: { job: {} } };
  };
  const provider = createWorkbenchModelProvider({
    execute,
    now: () => checkedAt,
    createId: () => "54000000-0000-4000-8000-000000000001",
    knownJobIds: ["54000000-0000-4000-8000-000000000002"],
    onDegraded: (event) => degraded.push(event),
  });
  const server = await startLoopbackApiServer(
    { allowedOrigins: ["http://127.0.0.1:5173"], bodyLimitBytes: 1_048_576, port: 0 },
    execute,
    provider,
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  const response = await send(address.port);

  assert.equal(response.status, 200);
  assert.match(response.body, /<span>Status: <\/span>NotReady/);
  assert.deepEqual(degraded, [{
    code: "WORKBENCH_MODEL_DEGRADED",
    stage: "Jobs",
    reason: "ResultInvalid",
  }]);
});

test("PT-UI-004 fails closed when watchlist canonical values are invalid", () => {
  const checkedAt = "2026-09-20T20:00:00.000Z";
  const readiness = evaluateReadiness({
    checkedAt,
    liveness: "Live",
    dependencies: Object.fromEntries([
      "PostgreSQL",
      "Migrations",
      "FixturePolicy",
      "LocalDependency",
      "DenialAudit",
      "LedgerIntegrity",
    ].map((dependency) => [dependency, { ready: true, checkedAt }])),
  });
  const degraded = [];
  const provider = createWorkbenchModelProvider({
    execute: (requestJson) => JSON.parse(requestJson).operation === "ReadinessGet"
      ? { operation: "ReadinessGet", outcome: "Succeeded", data: { readiness } }
      : {
        operation: "WatchlistGet",
        outcome: "Succeeded",
        data: { orderedItems: [], version: "9007199254740992" },
      },
    now: () => checkedAt,
    createId: () => "56000000-0000-4000-8000-000000000001",
    knownJobIds: [],
    onDegraded: (event) => degraded.push(event),
  });

  assert.deepEqual(provider(), { readiness: "NotReady" });
  assert.deepEqual(degraded, [{
    code: "WORKBENCH_MODEL_DEGRADED",
    stage: "Watchlist",
    reason: "ResultInvalid",
  }]);
});
