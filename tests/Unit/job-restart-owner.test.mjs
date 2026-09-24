import assert from "node:assert/strict";
import test from "node:test";

import { dispatchPostgresJobRestart } from "../../dist/Infrastructure/PostgreSQL/job-restart-owner.js";

const definition = { operation: "JobRestart", kind: "command" };
const payload = { jobId: "21000000-0000-4000-8000-000000000001" };
const context = {
  commandId: "31000000-0000-4000-8000-000000000001",
  correlationId: "61000000-0000-4000-8000-000000000002",
  requestedAt: "2026-09-14T00:04:00.000Z",
};

test("JobRestart owner dispatches one closed PostgreSQL restart request", async () => {
  const job = { jobId: payload.jobId, status: "Pending", attempt: "2" };
  const observed = [];
  const client = {
    async query(sql, values) {
      observed.push({ sql, values });
      return { rows: [{ job }] };
    },
  };

  assert.deepEqual(
    await dispatchPostgresJobRestart(client, definition, payload, context),
    { job },
  );
  assert.deepEqual(observed, [{
    sql: "SELECT etf.job_restart($1::jsonb) AS job",
    values: [JSON.stringify(payload)],
  }]);
});

test("JobRestart owner rejects unrelated or incomplete dispatch", async () => {
  const client = { query: async () => assert.fail("invalid dispatch must not query") };
  for (const [invalidDefinition, invalidContext] of [
    [{ operation: "JobGet", kind: "query" }, context],
    [definition, undefined],
  ]) {
    await assert.rejects(
      dispatchPostgresJobRestart(client, invalidDefinition, payload, invalidContext),
      (error) => error.code === "APPLICATION_REQUEST_INVALID",
    );
  }
});

test("JobRestart owner maps allowlisted PostgreSQL errors", async () => {
  for (const vector of [
    ["P0001", "APPLICATION_JOB_NOT_RESTARTABLE", "APPLICATION_JOB_NOT_RESTARTABLE"],
    ["P0002", "APPLICATION_JOB_NOT_FOUND", "APPLICATION_JOB_NOT_FOUND"],
    ["42501", "permission denied", "APPLICATION_UNAUTHORIZED"],
  ]) {
    const client = {
      async query() {
        throw Object.assign(new Error(vector[1]), { code: vector[0] });
      },
    };
    await assert.rejects(
      dispatchPostgresJobRestart(client, definition, payload, context),
      (error) => error.code === vector[2],
    );
  }
});

test("JobRestart owner rejects partial PostgreSQL error-token matches", async () => {
  for (const [code, message] of [
    ["P0001", "APPLICATION_JOB_NOT_RESTARTABLE"],
    ["P0002", "APPLICATION_JOB_NOT_FOUND"],
    ["42501", "permission denied"],
  ]) {
    for (const [driftedCode, driftedMessage] of [
      [code, `${message}_DRIFTED`],
      ["XX000", message],
    ]) {
      const client = {
        async query() {
          throw Object.assign(new Error(driftedMessage), { code: driftedCode });
        },
      };
      await assert.rejects(
        dispatchPostgresJobRestart(client, definition, payload, context),
        (error) => error.code === "APPLICATION_DEPENDENCY_UNAVAILABLE",
      );
    }
  }
});

test("JobRestart owner closes unknown errors and malformed results", async () => {
  await assert.rejects(
    dispatchPostgresJobRestart(
      { query: async () => { throw new Error("database details"); } },
      definition,
      payload,
      context,
    ),
    (error) => error.code === "APPLICATION_DEPENDENCY_UNAVAILABLE",
  );
  await assert.rejects(
    dispatchPostgresJobRestart(
      { query: async () => ({ rows: [] }) },
      definition,
      payload,
      context,
    ),
    (error) => error.code === "APPLICATION_RESULT_INVALID",
  );
});
