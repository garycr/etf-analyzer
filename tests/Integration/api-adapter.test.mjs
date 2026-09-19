import assert from "node:assert/strict";
import http from "node:http";
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

  const preflight = await send({
    port,
    method: "OPTIONS",
    path: "/api/v1/readiness",
    headers: {
      origin,
      "access-control-request-method": "GET",
      "access-control-request-headers": "Accept,X-Request-ID",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers["access-control-allow-origin"], origin);
  assert.match(preflight.headers["access-control-allow-methods"], /GET/);
  assert.equal(executed.length, 1);

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
  assert.equal(executed.length, 1);

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
  assert.equal(executed.length, 1);
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
