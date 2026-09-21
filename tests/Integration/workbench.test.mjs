import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { evaluateReadiness } from "../../dist/Application/application-boundary.js";
import { startLoopbackApiServer } from "../../dist/Infrastructure/Http/api-adapter.js";
import { createWorkbenchModelProvider } from "../../dist/Infrastructure/Web/workbench-runtime.js";

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
