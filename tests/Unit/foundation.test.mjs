import assert from "node:assert/strict";
import test from "node:test";

import {
  createHealthSnapshot,
  loadLocalConfiguration,
  serializeLogEvent,
} from "../../dist/Application/foundation.js";

test("local configuration defaults to fixture-only operation", () => {
  const configuration = loadLocalConfiguration({});

  assert.deepEqual(configuration, {
    environment: "local",
    fixtureOnly: true,
    logLevel: "info",
    postgresUrl: undefined,
  });
});

test("local configuration rejects provider egress", () => {
  assert.throws(
    () => loadLocalConfiguration({ ETF_PROVIDER_EGRESS: "enabled" }),
    /ETF_PROVIDER_EGRESS must be disabled/,
  );
});

test("local configuration accepts explicitly disabled provider egress", () => {
  assert.equal(
    loadLocalConfiguration({ ETF_PROVIDER_EGRESS: "disabled" }).fixtureOnly,
    true,
  );
});

test("local configuration rejects unknown log levels", () => {
  assert.throws(
    () => loadLocalConfiguration({ ETF_LOG_LEVEL: "verbose" }),
    /ETF_LOG_LEVEL must be debug, info, warn, or error/,
  );
});

test("health snapshot keeps liveness separate from readiness", () => {
  assert.deepEqual(createHealthSnapshot({ postgres: false, migrations: false }), {
    live: true,
    ready: false,
    checks: { migrations: false, postgres: false },
  });
});

test("structured logs redact sensitive fields", () => {
  const event = JSON.parse(
    serializeLogEvent("foundation.started", {
      databaseUrl: "postgres://user:secret@localhost/etf",
      fixtureOnly: true,
    }),
  );

  assert.deepEqual(event, {
    event: "foundation.started",
    fields: { databaseUrl: "[REDACTED]", fixtureOnly: true },
    level: "info",
  });
});

test("structured logs redact the configured PostgreSQL URL field", () => {
  const event = JSON.parse(
    serializeLogEvent("foundation.started", {
      postgresUrl: "postgresql://user:secret@localhost/etf",
    }),
  );

  assert.equal(event.fields.postgresUrl, "[REDACTED]");
});

test("structured logs redact every supported sensitive field name", () => {
  for (const fieldName of [
    "connectionString",
    "credential",
    "password",
    "PostgresURL",
    "secret",
    "token",
  ]) {
    const event = JSON.parse(
      serializeLogEvent("foundation.started", { [fieldName]: "sensitive" }),
    );

    assert.equal(event.fields[fieldName], "[REDACTED]", fieldName);
  }
});

test("health becomes ready only when every database check passes", () => {
  assert.equal(
    createHealthSnapshot({ postgres: true, migrations: false }).ready,
    false,
  );
  assert.equal(
    createHealthSnapshot({ postgres: true, migrations: true }).ready,
    true,
  );
  assert.equal(
    createHealthSnapshot({ postgres: false, migrations: true }).ready,
    false,
  );
});
