import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";

import {
  startLoopbackApiServer,
} from "../../dist/Infrastructure/Http/api-adapter.js";

function send({ port, method, path, headers, body = "" }) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      method,
      path,
      headers: {
        host: `127.0.0.1:${port}`,
        ...headers,
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
    request.end(body);
  });
}

function sendIncomplete({ port, requestText, onAccepted }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const chunks = [];
    let interval;
    socket.setTimeout(1_000, () => {
      socket.destroy();
      reject(new Error("The server did not bound the incomplete request"));
    });
    socket.on("connect", () => socket.write(requestText));
    onAccepted?.(() => {
      interval = setInterval(() => socket.write(" "), 20);
    });
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      clearInterval(interval);
    });
    socket.on("end", () => {
      clearInterval(interval);
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    socket.on("close", () => clearInterval(interval));
    socket.on("error", (error) => {
      if (error.code !== "EPIPE") reject(error);
    });
  });
}

function sendPartialHeaders({ port, requestText }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let receivedBytes = 0;
    socket.setTimeout(1_000, () => {
      socket.destroy();
      reject(new Error("The server did not bound the partial headers"));
    });
    socket.on("connect", () => socket.write(requestText));
    socket.on("data", (chunk) => {
      receivedBytes += chunk.length;
    });
    socket.on("close", () => resolve(receivedBytes));
    socket.on("error", reject);
  });
}

function sendDelayedHeaders({ port, initialText, remainingText, headerDelayMs }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const chunks = [];
    let interval;
    socket.setTimeout(1_000, () => {
      socket.destroy();
      reject(new Error("The server did not enforce one request deadline"));
    });
    socket.on("connect", () => {
      socket.write(initialText);
      setTimeout(() => {
        socket.write(remainingText);
        interval = setInterval(() => socket.write(" "), 20);
      }, headerDelayMs);
    });
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      clearInterval(interval);
    });
    socket.on("end", () => {
      clearInterval(interval);
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    socket.on("close", () => clearInterval(interval));
    socket.on("error", (error) => {
      if (error.code !== "EPIPE") reject(error);
    });
  });
}

test("PT-UI-002 serves the workbench at the loopback root without application dispatch", async (context) => {
  const executed = [];
  const server = await startLoopbackApiServer(
    { allowedOrigins: ["http://127.0.0.1:5173"], bodyLimitBytes: 1_048_576, port: 0 },
    (requestJson) => {
      executed.push(requestJson);
      return Object.freeze({});
    },
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const response = await send({
    port: address.port,
    method: "GET",
    path: "/?view=dashboard",
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
  assert.match(response.headers["content-security-policy"], /default-src 'none'/);
  assert.equal(response.headers["referrer-policy"], "no-referrer");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-frame-options"], "DENY");
  assert.match(response.body, /<h1>ETF Analyzer<\/h1>/);
  assert.deepEqual(executed, []);

  const unacceptable = await send({
    port: address.port,
    method: "GET",
    path: "/",
    headers: { accept: "application/json" },
  });
  assert.equal(unacceptable.status, 406);

  const invalidHost = await send({
    port: address.port,
    method: "GET",
    path: "/",
    headers: { accept: "text/html", host: `localhost:${address.port}` },
  });
  assert.equal(invalidHost.status, 400);
  assert.deepEqual(executed, []);
});

test("loopback HTTP awaits asynchronous Application execution", async (context) => {
  const origin = "http://127.0.0.1:5173";
  const server = await startLoopbackApiServer(
    { allowedOrigins: [origin], bodyLimitBytes: 1_048_576, port: 0 },
    async (requestJson) => {
      const request = JSON.parse(requestJson);
      await Promise.resolve();
      return Object.freeze({ operation: request.operation, outcome: "Succeeded" });
    },
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.equal(typeof address, "object");
  const response = await send({
    port: address.port,
    method: "GET",
    path: "/api/v1/readiness",
    headers: {
      accept: "application/json",
      origin,
      "x-request-id": "29000000-0000-4000-8000-000000000001",
      "x-correlation-id": "29000000-0000-4000-8000-000000000002",
      "x-requested-at": "2026-09-22T10:00:00.000Z",
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    operation: "ReadinessGet",
    outcome: "Succeeded",
  });
});

test("CT-API-001A/K serves only loopback HTTP and keeps preflight side-effect free", async (context) => {
  const origin = "http://127.0.0.1:5173";
  const executed = [];
  const server = await startLoopbackApiServer(
    { allowedOrigins: [origin], bodyLimitBytes: 1_048_576, port: 0 },
    (requestJson) => {
      const request = JSON.parse(requestJson);
      executed.push(request);
      return Object.freeze({ operation: request.operation, outcome: "Succeeded" });
    },
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  assert.equal(address.address, "127.0.0.1");
  const port = address.port;

  const response = await send({
    port,
    method: "GET",
    path: "/api/v1/readiness",
    headers: {
      accept: "application/json",
      origin,
      "x-request-id": "30000000-0000-4000-8000-000000000001",
      "x-correlation-id": "30000000-0000-4000-8000-000000000002",
      "x-requested-at": "2026-09-17T12:00:00.000Z",
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/json");
  assert.equal(response.headers["access-control-allow-origin"], origin);
  assert.equal(executed.length, 1);
  assert.equal(executed[0].operation, "ReadinessGet");

  const sameOrigin = `http://127.0.0.1:${port}`;
  const sameOriginResponse = await send({
    port,
    method: "GET",
    path: "/api/v1/watchlist",
    headers: {
      accept: "application/json",
      origin: sameOrigin,
      "x-request-id": "30000000-0000-4000-8000-000000000013",
      "x-correlation-id": "30000000-0000-4000-8000-000000000014",
      "x-requested-at": "2026-09-17T12:00:00.000Z",
    },
  });
  assert.equal(sameOriginResponse.status, 200);
  assert.equal(sameOriginResponse.headers["access-control-allow-origin"], sameOrigin);

  const preflight = await send({
    port,
    method: "OPTIONS",
    path: "/api/v1/readiness",
    headers: {
      origin,
      "access-control-request-method": "GET",
      "access-control-request-headers": "Accept,X-Request-ID,X-Launch-Token",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers["access-control-allow-origin"], origin);
  assert.match(preflight.headers["access-control-allow-methods"], /GET/);
  assert.match(preflight.headers["access-control-allow-headers"], /X-Launch-Token/);
  assert.equal(executed.length, 2);

  const invalidPreflight = await send({
    port,
    method: "OPTIONS",
    path: "/api/v1/readiness",
    headers: {
      origin,
      "access-control-request-method": "PATCH",
      "access-control-request-headers": "Accept,X-Request-ID",
    },
  });
  assert.equal(invalidPreflight.status, 400);
  assert.equal(invalidPreflight.headers["access-control-allow-origin"], origin);
  assert.equal(executed.length, 2);

  for (const vector of [
    {
      method: "GET",
      path: "/api/v1/readiness",
      headers: {
        accept: "application/json",
        host: `localhost:${port}`,
        origin,
        "x-request-id": "30000000-0000-4000-8000-000000000003",
        "x-correlation-id": "30000000-0000-4000-8000-000000000004",
        "x-requested-at": "2026-09-17T12:00:00.000Z",
      },
      expectedStatus: 400,
    },
    {
      method: "GET",
      path: "/api/v1/readiness",
      headers: {
        accept: "application/json",
        origin: "http://127.0.0.1:5174",
        "x-request-id": "30000000-0000-4000-8000-000000000005",
        "x-correlation-id": "30000000-0000-4000-8000-000000000006",
        "x-requested-at": "2026-09-17T12:00:00.000Z",
      },
      expectedStatus: 403,
    },
    {
      method: "PUT",
      path: "/api/v1/watchlist/order",
      headers: {
        accept: "application/json",
        "content-type": "text/plain",
        origin,
        "x-request-id": "30000000-0000-4000-8000-000000000007",
        "x-correlation-id": "30000000-0000-4000-8000-000000000008",
        "x-requested-at": "2026-09-17T12:00:00.000Z",
        "idempotency-key": "30000000-0000-4000-8000-000000000009",
      },
      body: "{}",
      expectedStatus: 415,
    },
    {
      method: "PUT",
      path: "/api/v1/watchlist/order",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin,
        "x-request-id": "30000000-0000-4000-8000-000000000010",
        "x-correlation-id": "30000000-0000-4000-8000-000000000011",
        "x-requested-at": "2026-09-17T12:00:00.000Z",
        "idempotency-key": "30000000-0000-4000-8000-000000000012",
      },
      body: '{"expectedVersion":"1","expectedVersion":"2"}',
      expectedStatus: 400,
    },
  ]) {
    const rejected = await send({ port, ...vector });
    assert.equal(rejected.status, vector.expectedStatus);
  }
  assert.equal(executed.length, 2);
});

test("CT-API-001M bounds incomplete local uploads without dispatch", async (context) => {
  const origin = "http://127.0.0.1:5173";
  const auditEvents = [];
  let dispatchCount = 0;
  const server = await startLoopbackApiServer(
    {
      allowedOrigins: [origin],
      bodyLimitBytes: 1_048_576,
      port: 0,
      requestTimeoutMs: 100,
      audit: (event) => {
        auditEvents.push(event);
        throw new Error("audit sink unavailable");
      },
    },
    () => {
      dispatchCount += 1;
      return Object.freeze({ operation: "WatchlistReorder", outcome: "Succeeded" });
    },
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  assert.equal(server.requestTimeout, 100);
  assert.equal(server.headersTimeout, 100);
  assert.equal(server.timeout, 100);
  const address = server.address();
  assert.equal(typeof address, "object");
  let startDrip;
  const accepted = new Promise((resolve) => server.once("request", resolve));
  const responsePromise = sendIncomplete({
    port: address.port,
    onAccepted: (start) => {
      startDrip = start;
    },
    requestText: [
      "PUT /api/v1/watchlist/order HTTP/1.1",
      `Host: 127.0.0.1:${address.port}`,
      "Accept: application/json",
      "Content-Type: application/json",
      "Content-Length: 100",
      `Origin: ${origin}`,
      "X-Request-ID: 30000000-0000-4000-8000-000000000020",
      "X-Correlation-ID: 30000000-0000-4000-8000-000000000021",
      "X-Requested-At: 2026-09-17T12:00:00.000Z",
      "Idempotency-Key: 30000000-0000-4000-8000-000000000022",
      "Connection: close",
      "",
      "{",
    ].join("\r\n"),
  });
  await accepted;
  startDrip?.();
  const rawResponse = await responsePromise;

  assert.match(rawResponse, /^HTTP\/1\.1 408 Request Timeout\r\n/);
  assert.equal(rawResponse.match(/HTTP\/1\.1 408 Request Timeout/g)?.length, 1);
  assert.match(rawResponse, /cache-control: no-store/i);
  assert.match(rawResponse, /x-content-type-options: nosniff/i);
  assert.match(rawResponse, new RegExp(`access-control-allow-origin: ${origin}`, "i"));
  assert.deepEqual(JSON.parse(rawResponse.split("\r\n\r\n")[1]), {
    type: "request-timeout",
    title: "Request Timeout",
    status: 408,
    detail: "The request body was not completed within the configured timeout.",
  });
  assert.equal(dispatchCount, 0);
  assert.deepEqual(auditEvents, [{
    code: "API_REQUEST_TIMEOUT",
    stage: "RequestBody",
    reason: "DeadlineExceeded",
  }]);

  const delayedResponse = await sendDelayedHeaders({
    port: address.port,
    headerDelayMs: 60,
    initialText: [
      "PUT /api/v1/watchlist/order HTTP/1.1",
      `Host: 127.0.0.1:${address.port}`,
      "Accept: application/json",
    ].join("\r\n"),
    remainingText: [
      "",
      "Content-Type: application/json",
      "Content-Length: 100",
      `Origin: ${origin}`,
      "X-Request-ID: 30000000-0000-4000-8000-000000000023",
      "X-Correlation-ID: 30000000-0000-4000-8000-000000000024",
      "X-Requested-At: 2026-09-17T12:00:00.000Z",
      "Idempotency-Key: 30000000-0000-4000-8000-000000000025",
      "Connection: close",
      "",
      "{",
    ].join("\r\n"),
  });
  assert.match(delayedResponse, /^HTTP\/1\.1 408 Request Timeout\r\n/);
  assert.equal(dispatchCount, 0);
  assert.equal(auditEvents.length, 2);

  const partialHeaderBytes = await sendPartialHeaders({
    port: address.port,
    requestText: "PUT /api/v1/watchlist/order HTTP/1.1\r\nHost: 127.0.0.1",
  });
  assert.equal(partialHeaderBytes, 0);
  assert.equal(dispatchCount, 0);
  assert.equal(auditEvents.length, 2);
});

test("CT-API-001E/K contains unexpected application and serialization failures", async (context) => {
  const origin = "http://127.0.0.1:5173";
  let invocation = 0;
  const server = await startLoopbackApiServer(
    { allowedOrigins: [origin], bodyLimitBytes: 1_048_576, port: 0 },
    () => {
      invocation += 1;
      if (invocation === 1) throw new Error("database password must not escape");
      return { operation: "ReadinessGet", outcome: "Succeeded", invalid: 1n };
    },
  );
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.equal(typeof address, "object");
  const port = address.port;
  const headers = {
    accept: "application/json",
    origin,
    "x-request-id": "40000000-0000-4000-8000-000000000001",
    "x-correlation-id": "40000000-0000-4000-8000-000000000002",
    "x-requested-at": "2026-09-17T12:00:00.000Z",
  };

  for (let index = 0; index < 2; index += 1) {
    const response = await send({ port, method: "GET", path: "/api/v1/readiness", headers });
    assert.equal(response.status, 500);
    assert.equal(response.body.includes("password"), false);
    assert.deepEqual(JSON.parse(response.body), {
      type: "internal-server-error",
      title: "Internal Server Error",
      status: 500,
      detail: "The request could not be completed.",
    });
  }
});

test("CT-API-001LIMIT rejects excess concurrency and rate without dispatch or queued work", async (context) => {
  const origin = "http://127.0.0.1:5173";
  const baseHeaders = {
    accept: "application/json",
    origin,
    "x-request-id": "40000000-0000-4000-8000-000000000011",
    "x-correlation-id": "40000000-0000-4000-8000-000000000012",
    "x-requested-at": "2026-09-17T12:00:00.000Z",
  };
  let bodyDispatches = 0;
  const bodyServer = await startLoopbackApiServer({
    allowedOrigins: [origin],
    bodyLimitBytes: 1_048_576,
    maxConcurrentRequests: 1,
    port: 0,
    requestRateLimit: 10,
    requestRateWindowMs: 60_000,
  }, (requestJson) => {
    bodyDispatches += 1;
    const request = JSON.parse(requestJson);
    return { operation: request.operation, outcome: "Succeeded" };
  });
  context.after(() => new Promise((resolve, reject) => {
    bodyServer.close((error) => error ? reject(error) : resolve());
  }));
  const bodyAddress = bodyServer.address();
  assert.equal(typeof bodyAddress, "object");
  const stalledBody = net.createConnection({ host: "127.0.0.1", port: bodyAddress.port });
  await new Promise((resolve, reject) => {
    stalledBody.once("connect", resolve);
    stalledBody.once("error", reject);
  });
  stalledBody.write([
    "PUT /api/v1/watchlist/order HTTP/1.1",
    `Host: 127.0.0.1:${bodyAddress.port}`,
    `Origin: ${origin}`,
    "Accept: application/json",
    "Content-Type: application/json",
    "Content-Length: 100",
    "X-Request-ID: 40000000-0000-4000-8000-000000000001",
    "X-Correlation-ID: 40000000-0000-4000-8000-000000000002",
    "X-Requested-At: 2026-09-17T12:00:00.000Z",
    "Idempotency-Key: 40000000-0000-4000-8000-000000000003",
    "",
    "{",
  ].join("\r\n"));
  const bodyRejection = await send({
    port: bodyAddress.port,
    method: "GET",
    path: "/api/v1/readiness",
    headers: baseHeaders,
  });
  assert.equal(bodyRejection.status, 429);
  assert.equal(bodyDispatches, 0);
  const stalledBodyClosed = new Promise((resolve) => stalledBody.once("close", resolve));
  stalledBody.destroy();
  await stalledBodyClosed;
  await new Promise((resolve) => setImmediate(resolve));
  const afterAbort = await send({
    port: bodyAddress.port,
    method: "GET",
    path: "/api/v1/readiness",
    headers: { ...baseHeaders, "x-request-id": "40000000-0000-4000-8000-000000000014" },
  });
  assert.equal(afterAbort.status, 200);
  assert.equal(bodyDispatches, 1);

  let releaseFirst;
  let firstDispatched;
  const firstStarted = new Promise((resolve) => { firstDispatched = resolve; });
  let concurrentDispatches = 0;
  const concurrencyServer = await startLoopbackApiServer({
    allowedOrigins: [origin],
    bodyLimitBytes: 1_048_576,
    maxConcurrentRequests: 1,
    port: 0,
    requestRateLimit: 10,
    requestRateWindowMs: 60_000,
  }, async () => {
    concurrentDispatches += 1;
    firstDispatched();
    await new Promise((resolve) => { releaseFirst = resolve; });
    return { operation: "ReadinessGet", outcome: "Succeeded" };
  });
  context.after(() => new Promise((resolve, reject) => {
    concurrencyServer.close((error) => error ? reject(error) : resolve());
  }));
  const concurrencyAddress = concurrencyServer.address();
  assert.equal(typeof concurrencyAddress, "object");
  const first = send({
    port: concurrencyAddress.port,
    method: "GET",
    path: "/api/v1/readiness",
    headers: baseHeaders,
  });
  await firstStarted;
  const concurrentRejection = await send({
    port: concurrencyAddress.port,
    method: "GET",
    path: "/api/v1/readiness",
    headers: { ...baseHeaders, "x-request-id": "40000000-0000-4000-8000-000000000013" },
  });
  releaseFirst();
  assert.equal((await first).status, 200);
  assert.equal(concurrentRejection.status, 429);
  assert.equal(concurrentDispatches, 1);

  let rateDispatches = 0;
  const rateServer = await startLoopbackApiServer({
    allowedOrigins: [origin],
    bodyLimitBytes: 1_048_576,
    maxConcurrentRequests: 2,
    port: 0,
    requestRateLimit: 2,
    requestRateWindowMs: 60_000,
  }, () => {
    rateDispatches += 1;
    return { operation: "ReadinessGet", outcome: "Succeeded" };
  });
  context.after(() => new Promise((resolve, reject) => {
    rateServer.close((error) => error ? reject(error) : resolve());
  }));
  const rateAddress = rateServer.address();
  assert.equal(typeof rateAddress, "object");
  const statuses = [];
  let rateRejection;
  for (let index = 0; index < 3; index += 1) {
    const response = await send({
      port: rateAddress.port,
      method: "GET",
      path: "/api/v1/readiness",
      headers: { ...baseHeaders, "x-request-id": `40000000-0000-4000-8000-00000000002${index}` },
    });
    statuses.push(response.status);
    if (response.status === 429) rateRejection = response;
  }
  assert.deepEqual(statuses, [200, 200, 429]);
  assert.equal(rateDispatches, 2);
  assert.equal(rateRejection.body, concurrentRejection.body);
  assert.deepEqual(JSON.parse(rateRejection.body), {
    type: "request-capacity-exhausted",
    title: "Too Many Requests",
    status: 429,
    detail: "The local request capacity is temporarily exhausted. Retry later.",
  });
});

test("CT-API-001AUTH keeps launch assets accessible and budgets only authenticated API work", async (context) => {
  const origin = "http://127.0.0.1:5173";
  const launchToken = "a".repeat(64);
  let dispatches = 0;
  const server = await startLoopbackApiServer({
    allowedOrigins: [origin],
    bodyLimitBytes: 1_048_576,
    launchToken,
    maxConcurrentRequests: 1,
    port: 0,
    requestRateLimit: 1,
    requestRateWindowMs: 60_000,
  }, () => {
    dispatches += 1;
    return { operation: "ReadinessGet", outcome: "Succeeded" };
  });
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.equal(typeof address, "object");
  const port = address.port;
  const unauthenticatedUpload = await sendIncomplete({
    port,
    requestText: [
      "PUT /api/v1/watchlist/order HTTP/1.1",
      `Host: 127.0.0.1:${port}`,
      `Origin: ${origin}`,
      "Content-Length: 100",
      `X-Launch-Token: ${"b".repeat(64)}`,
      "Connection: close",
      "",
      "{",
    ].join("\r\n"),
  });
  assert.match(unauthenticatedUpload, /^HTTP\/1\.1 401 Unauthorized\r\n/);
  assert.equal((await send({ port, method: "GET", path: "/", headers: { accept: "text/html" } })).status, 200);
  assert.equal((await send({ port, method: "GET", path: "/workbench.js", headers: {} })).status, 200);
  assert.equal((await send({
    port,
    method: "OPTIONS",
    path: "/api/v1/readiness",
    headers: {
      origin,
      "access-control-request-method": "GET",
      "access-control-request-headers": "X-Launch-Token",
    },
  })).status, 204);

  const headers = {
    accept: "application/json",
    origin,
    "x-request-id": "40000000-0000-4000-8000-000000000031",
    "x-correlation-id": "40000000-0000-4000-8000-000000000032",
    "x-requested-at": "2026-09-17T12:00:00.000Z",
  };
  assert.equal((await send({
    port,
    method: "GET",
    path: "/api/v1/readiness",
    headers,
  })).status, 401);
  assert.equal((await send({
    port,
    method: "GET",
    path: "/api/v1/readiness",
    headers: { ...headers, "x-launch-token": launchToken },
  })).status, 200);
  assert.equal((await send({
    port,
    method: "GET",
    path: "/api/v1/readiness",
    headers: {
      ...headers,
      "x-launch-token": launchToken,
      "x-request-id": "40000000-0000-4000-8000-000000000033",
    },
  })).status, 429);
  assert.equal(dispatches, 1);
});
