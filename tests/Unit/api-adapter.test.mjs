import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  adaptApiRequest,
  apiRoutes,
  applicationHttpStatusByCode,
  httpStatusForApplicationResult,
  resolveApiRoute,
} from "../../dist/Infrastructure/Http/api-adapter.js";

const expectedRoutes = [
  ["PUT", "/api/v1/watchlist/items/ETF1", "WatchlistPut"],
  ["DELETE", "/api/v1/watchlist/items/ETF1", "WatchlistRemove"],
  ["PUT", "/api/v1/watchlist/order", "WatchlistReorder"],
  ["POST", "/api/v1/fixture-ingestions", "FixtureIngestionStart"],
  ["POST", "/api/v1/jobs/10000000-0000-4000-8000-000000000001/restart", "JobRestart"],
  ["POST", "/api/v1/analytics/runs", "AnalyticsRun"],
  ["POST", "/api/v1/paper-orders", "PaperOrderDraftCreate"],
  ["POST", "/api/v1/paper-orders/10000000-0000-4000-8000-000000000002/transitions", "PaperOrderTransition"],
  ["POST", "/api/v1/diagnostic-exports", "DiagnosticsExportCreate"],
  ["GET", "/api/v1/watchlist", "WatchlistGet"],
  ["GET", "/api/v1/jobs/10000000-0000-4000-8000-000000000003", "JobGet"],
  ["GET", "/api/v1/readiness", "ReadinessGet"],
  ["GET", "/api/v1/analytics/results/10000000-0000-4000-8000-000000000004", "AnalyticsResultGet"],
  ["GET", "/api/v1/evidence?evidenceId=10000000-0000-4000-8000-000000000005", "EvidenceGet"],
  ["GET", "/api/v1/paper-orders/10000000-0000-4000-8000-000000000006", "PaperOrderGet"],
  ["GET", "/api/v1/portfolios/10000000-0000-4000-8000-000000000007?asOf=2026-09-17", "PortfolioGet"],
];

test("CT-API-001A maps exactly 16 reviewed routes to application operations", () => {
  assert.equal(apiRoutes.length, 16);
  assert.deepEqual(
    expectedRoutes.map(([method, target]) => resolveApiRoute(method, target)?.operation),
    expectedRoutes.map(([, , operation]) => operation),
  );

  assert.equal(resolveApiRoute("PATCH", "/api/v1/watchlist"), undefined);
  assert.equal(resolveApiRoute("GET", "/api/v1/unknown"), undefined);
  assert.equal(resolveApiRoute("GET", "/api/v2/readiness"), undefined);
});

const requestId = "20000000-0000-4000-8000-000000000001";
const correlationId = "20000000-0000-4000-8000-000000000002";
const commandId = "20000000-0000-4000-8000-000000000003";
const requestedAt = "2026-09-17T12:00:00.000Z";
const config = Object.freeze({
  allowedOrigins: Object.freeze(["http://127.0.0.1:5173"]),
  bodyLimitBytes: 1_048_576,
  port: 4173,
});

test("CT-API-001C reconstructs one closed command request", () => {
  const executed = [];
  const response = adaptApiRequest(
    {
      method: "PUT",
      target: "/api/v1/watchlist/items/SPY",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        host: "127.0.0.1:4173",
        origin: "http://127.0.0.1:5173",
        "x-request-id": requestId,
        "x-correlation-id": correlationId,
        "x-requested-at": requestedAt,
        "idempotency-key": commandId,
      },
      body: new TextEncoder().encode(JSON.stringify({
        displayName: "SPDR S&P 500 ETF Trust",
        expectedVersion: "1",
      })),
    },
    config,
    (requestJson) => {
      executed.push(JSON.parse(requestJson));
      return Object.freeze({ operation: "WatchlistPut", outcome: "Succeeded" });
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/json");
  assert.deepEqual(executed, [{
    operation: "WatchlistPut",
    requestId,
    correlationId,
    actorId: "local-user",
    prototypeCandidate: "v1.0.0-prototype.1",
    contractVersion: "1.0.0-candidate.2",
    requestedAt,
    commandId,
    payload: {
      displayName: "SPDR S&P 500 ETF Trust",
      expectedVersion: "1",
      instrumentId: "SPY",
    },
  }]);
  assert.deepEqual(JSON.parse(response.body), {
    operation: "WatchlistPut",
    outcome: "Succeeded",
  });
});

test("CT-API-001K rejects protocol defects before application dispatch", () => {
  let dispatchCount = 0;
  const execute = () => {
    dispatchCount += 1;
    return {};
  };
  const base = {
    method: "PUT",
    target: "/api/v1/watchlist/order",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      host: "127.0.0.1:4173",
      origin: "http://127.0.0.1:5173",
      "x-request-id": requestId,
      "x-correlation-id": correlationId,
      "x-requested-at": requestedAt,
      "idempotency-key": commandId,
    },
    body: new TextEncoder().encode('{"orderedInstrumentIds":["SPY"],"expectedVersion":"1"}'),
  };
  const defects = [
    [{ ...base, headers: { ...base.headers, host: "localhost:4173" } }, 400, "invalid-host"],
    [{ ...base, headers: { ...base.headers, origin: "https://example.com" } }, 403, "disallowed-origin"],
    [{ ...base, headers: { ...base.headers, accept: "text/html" } }, 406, "unacceptable-response-type"],
    [{ ...base, headers: { ...base.headers, "content-type": "text/plain" } }, 415, "unsupported-media-type"],
    [{ ...base, body: new TextEncoder().encode("x".repeat(1_048_577)) }, 413, "request-too-large"],
    [{ ...base, body: new TextEncoder().encode('{"expectedVersion":"1","expectedVersion":"2"}') }, 400, "malformed-json"],
  ];

  for (const [request, status, type] of defects) {
    const response = adaptApiRequest(request, config, execute);
    assert.equal(response.status, status);
    if (type === "disallowed-origin" || type === "invalid-host") {
      assert.equal(response.headers["access-control-allow-origin"], undefined);
    } else {
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://127.0.0.1:5173",
      );
    }
    assert.deepEqual(JSON.parse(response.body), {
      type,
      title: response.statusText,
      status,
      detail: response.detail,
    });
  }
  assert.equal(dispatchCount, 0);
});

test("CT-API-001E/F closes success and public failure HTTP statuses", () => {
  const created = new Set([
    "FixtureIngestionStart",
    "AnalyticsRun",
    "PaperOrderDraftCreate",
    "DiagnosticsExportCreate",
  ]);
  for (const [, , operation] of expectedRoutes) {
    assert.equal(
      httpStatusForApplicationResult(operation, { operation, outcome: "Succeeded" }),
      created.has(operation) ? 201 : 200,
    );
  }

  const expectedFailureCodes = {
    400: "APPLICATION_OPERATION_UNKNOWN,APPLICATION_REQUEST_INVALID,FIXTURE_MANIFEST_INVALID,FIXTURE_FILE_INTEGRITY_FAILED,FIXTURE_DATASET_HASH_MISMATCH,FIXTURE_TEMPORAL_INVALID,FIXTURE_DECIMAL_INVALID,FIXTURE_PROVENANCE_INVALID,FIXTURE_UNDECLARED_INPUT,FIXTURE_REQUIRED_MISSING,ANALYTICS_NUMERIC_CLASS_INVALID,ORDER_UNKNOWN_STATE,LEDGER_INVALID_DECIMAL,LEDGER_EXCESS_SCALE",
    403: "APPLICATION_UNAUTHORIZED,ANALYTICS_EVIDENCE_ACCESS_DENIED,ANALYTICS_RIGHTS_RESTRICTED",
    404: "APPLICATION_JOB_NOT_FOUND",
    409: "APPLICATION_IDEMPOTENCY_CONFLICT,ANALYTICS_IDEMPOTENCY_CONFLICT,ANALYTICS_PUBLICATION_VERSION_CONFLICT,ORDER_IDEMPOTENCY_CONFLICT,ORDER_VERSION_CONFLICT,FIXTURE_IDEMPOTENCY_CONFLICT,LEDGER_IDEMPOTENCY_CONFLICT,LEDGER_VERSION_CONFLICT",
    422: "APPLICATION_JOB_NOT_RESTARTABLE,ANALYTICS_INPUT_INCOMPLETE,ANALYTICS_INPUT_STALE,ANALYTICS_INPUT_QUARANTINED,ANALYTICS_AMBIGUOUS_VINTAGE,ANALYTICS_AMBIGUOUS_MARKET_REVISION,ANALYTICS_INTEGRITY_FAILED,ORDER_INVALID_TRANSITION,ORDER_GUARD_FAILED,ORDER_TERMINAL_STATE,FIXTURE_REQUIRED_PARTIAL,FIXTURE_REQUIRED_STALE,FIXTURE_REQUIRED_QUARANTINED,LEDGER_INSUFFICIENT_CASH,LEDGER_INSUFFICIENT_POSITION,LEDGER_REVERSAL_DEPENDENCY,LEDGER_ALREADY_REVERSED,LEDGER_BOUND_EXCEEDED",
    500: "APPLICATION_PERSISTENCE_FAILED,APPLICATION_REDACTION_FAILED,ANALYTICS_EVIDENCE_COMMIT_FAILED,ANALYTICS_DETERMINISM_FAILED,LEDGER_INTEGRITY_FAILED,LEDGER_FIFO_MISMATCH,LEDGER_RECONCILIATION_FAILED",
    503: "APPLICATION_DATABASE_UNAVAILABLE,APPLICATION_MIGRATIONS_INCOMPLETE,APPLICATION_CONFIGURATION_INVALID,APPLICATION_DEPENDENCY_UNAVAILABLE,ANALYTICS_CAPACITY_BLOCKED,ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
  };
  const expectedEntries = Object.entries(expectedFailureCodes).flatMap(
    ([status, codes]) => codes.split(",").map((code) => [code, Number(status)]),
  );

  assert.deepEqual(
    Object.entries(applicationHttpStatusByCode).sort(),
    expectedEntries.sort(),
  );
  for (const [code, status] of expectedEntries) {
    assert.equal(
      httpStatusForApplicationResult("ReadinessGet", {
        operation: "ReadinessGet",
        outcome: "Failed",
        error: { code },
      }),
      status,
    );
  }
  assert.equal(Object.isFrozen(applicationHttpStatusByCode), true);
  assert.equal(
    httpStatusForApplicationResult("ReadinessGet", {
      operation: "WatchlistGet",
      outcome: "Succeeded",
    }),
    500,
  );
  assert.equal(
    httpStatusForApplicationResult("ReadinessGet", {
      operation: "ReadinessGet",
      outcome: "Unknown",
    }),
    500,
  );
});

test("CT-API-001D commands require idempotency and queries forbid it", () => {
  let dispatchCount = 0;
  const execute = (requestJson) => {
    dispatchCount += 1;
    const request = JSON.parse(requestJson);
    return { operation: request.operation, outcome: "Succeeded" };
  };
  const headers = {
    accept: "application/json",
    host: "127.0.0.1:4173",
    origin: "http://127.0.0.1:5173",
    "x-request-id": requestId,
    "x-correlation-id": correlationId,
    "x-requested-at": requestedAt,
  };
  const missingCommandKey = adaptApiRequest({
    method: "POST",
    target: "/api/v1/jobs/20000000-0000-4000-8000-000000000004/restart",
    headers,
    body: new Uint8Array(),
  }, config, execute);
  const forbiddenQueryKey = adaptApiRequest({
    method: "GET",
    target: "/api/v1/readiness",
    headers: { ...headers, "idempotency-key": commandId },
    body: new Uint8Array(),
  }, config, execute);

  assert.equal(missingCommandKey.status, 400);
  assert.equal(forbiddenQueryKey.status, 400);
  assert.equal(dispatchCount, 0);
});

test("CT-API-001G/H/I/J preserves the complete application envelope unchanged", () => {
  const applicationResult = Object.freeze({
    operation: "EvidenceGet",
    requestId,
    correlationId,
    outcome: "Failed",
    completedAt: "2026-09-17T12:00:01.000Z",
    error: Object.freeze({
      code: "ANALYTICS_EVIDENCE_ACCESS_DENIED",
      message: "Access to analytical evidence is denied.",
      boundedIdentifiers: Object.freeze({ evidenceId: "evidence-fixture-1" }),
      recovery: null,
    }),
    warnings: Object.freeze(["Research only"]),
    presentation: Object.freeze({
      statusText: "Failed",
      announcement: "AssertiveAlert",
      warningText: "Research only — hypothetical — user makes all investment decisions.",
      researchWarningRequired: true,
    }),
  });
  const response = adaptApiRequest({
    method: "GET",
    target: "/api/v1/evidence?evidenceId=evidence-fixture-1",
    headers: {
      accept: "application/json",
      host: "127.0.0.1:4173",
      origin: "http://127.0.0.1:5173",
      "x-request-id": requestId,
      "x-correlation-id": correlationId,
      "x-requested-at": requestedAt,
    },
    body: new Uint8Array(),
  }, config, () => applicationResult);

  assert.equal(response.status, 403);
  assert.deepEqual(JSON.parse(response.body), applicationResult);
  assert.equal(response.body.includes("evidence-fixture-1"), true);
});

test("CT-API-001L rejects public/wildcard configuration and exposes no forbidden operation", async () => {
  const { startLoopbackApiServer } = await import("../../dist/Infrastructure/Http/api-adapter.js");
  for (const allowedOrigins of [
    ["*"],
    ["https://example.com"],
    ["http://0.0.0.0:5173"],
  ]) {
    assert.throws(
      () => startLoopbackApiServer({ ...config, allowedOrigins }, () => ({})),
      /127\.0\.0\.1 HTTP origins/,
    );
  }
  assert.equal(
    apiRoutes.some(({ operation }) => /batch|refresh|repair|cancel|provider|broker|event|stream|admin/i.test(operation)),
    false,
  );
  for (const operation of expectedRoutes.map(([, , name]) => name)) {
    assert.notEqual(
      httpStatusForApplicationResult(operation, { operation, outcome: "Succeeded" }),
      202,
    );
  }
});

test("CT-API-001E/K contracts the fixed internal server error for every operation", async () => {
  const contract = await readFile(
    new URL("../../docs/Planning/contracts/openapi-contract.yaml", import.meta.url),
    "utf8",
  );
  assert.match(contract, /version: 1\.0\.0-candidate\.3/);
  assert.match(contract, /Problem500:/);
  assert.match(
    contract,
    /type: \{ const: internal-server-error \}, title: \{ const: 'Internal Server Error' \}, status: \{ const: 500 \}, detail: \{ const: 'The request could not be completed\.' \}/,
  );
  assert.equal(
    contract.match(/\$ref: '#\/components\/schemas\/Problem500'/g)?.length,
    16,
  );

  const response = adaptApiRequest({
    method: "GET",
    target: "/api/v1/readiness",
    headers: {
      accept: "application/json",
      host: "127.0.0.1:4173",
      origin: "http://127.0.0.1:5173",
      "x-request-id": requestId,
      "x-correlation-id": correlationId,
      "x-requested-at": requestedAt,
    },
    body: new Uint8Array(),
  }, config, () => ({
    operation: "WatchlistGet",
    outcome: "Succeeded",
    sensitive: "database password",
  }));
  assert.equal(response.status, 500);
  assert.equal(response.body.includes("password"), false);
  assert.deepEqual(JSON.parse(response.body), {
    type: "internal-server-error",
    title: "Internal Server Error",
    status: 500,
    detail: "The request could not be completed.",
  });

  const unmapped = adaptApiRequest({
    method: "GET",
    target: "/api/v1/readiness",
    headers: {
      accept: "application/json",
      host: "127.0.0.1:4173",
      origin: "http://127.0.0.1:5173",
      "x-request-id": requestId,
      "x-correlation-id": correlationId,
      "x-requested-at": requestedAt,
    },
    body: new Uint8Array(),
  }, config, () => ({
    operation: "ReadinessGet",
    outcome: "Failed",
    error: { code: "UNKNOWN_SENSITIVE_FAILURE", secret: "password" },
  }));
  assert.equal(unmapped.status, 500);
  assert.equal(unmapped.body.includes("password"), false);
  assert.equal(
    unmapped.headers["access-control-allow-origin"],
    "http://127.0.0.1:5173",
  );
});
