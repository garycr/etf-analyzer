import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresApplicationReplayStore } from "../../dist/Infrastructure/PostgreSQL/application-replay-store.js";

const key = {
  operation: "PaperOrderDraftCreate",
  commandId: "79000000-0000-4000-8000-000000000001",
};
const canonicalContent = '{"operation":"PaperOrderDraftCreate"}';
const result = Object.freeze({ outcome: "Succeeded", data: Object.freeze({ version: "1" }) });

test("WP-6 PostgreSQL replay store commits owner effects with the complete result", async () => {
  const statements = [];
  const client = {
    async query(sql, values = []) {
      statements.push([sql, values]);
      if (sql.includes("application_replay_get(")) return { rows: [{ result: null }] };
      if (sql.includes("application_replay_get_or_put(")) return { rows: [{ result }] };
      return { rows: [] };
    },
  };
  const store = createPostgresApplicationReplayStore(client);
  let ownerCalls = 0;

  const actual = await store.executeAsync(key, canonicalContent, async () => {
    ownerCalls += 1;
    statements.push(["OWNER", []]);
    return result;
  });

  assert.equal(actual, result);
  assert.equal(ownerCalls, 1);
  assert.deepEqual(statements.map(([sql]) => sql), [
    "BEGIN",
    "SELECT etf.application_replay_get($1::text, $2::uuid, $3::text) AS result",
    "SAVEPOINT application_owner",
    "OWNER",
    "RELEASE SAVEPOINT application_owner",
    "SELECT etf.application_replay_get_or_put($1::text, $2::uuid, $3::text, $4::text) AS result",
    "COMMIT",
  ]);
});

test("WP-6 PostgreSQL replay store returns durable results without owner dispatch", async () => {
  const statements = [];
  const stored = { outcome: "Succeeded", data: { version: "1" } };
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("application_replay_get(")) return { rows: [{ result: stored }] };
      return { rows: [] };
    },
  };
  const store = createPostgresApplicationReplayStore(client);

  const actual = await store.executeAsync(key, canonicalContent, async () => {
    assert.fail("durable replay must not dispatch the owner");
  });

  assert.deepEqual(actual, stored);
  assert.equal(Object.isFrozen(actual), true);
  assert.equal(Object.isFrozen(actual.data), true);
  assert.deepEqual(statements, [
    "BEGIN",
    "SELECT etf.application_replay_get($1::text, $2::uuid, $3::text) AS result",
    "COMMIT",
  ]);
});

test("PostgreSQL replay store caches a mapped owner refusal after savepoint recovery", async () => {
  const statements = [];
  const refusal = Object.freeze({
    outcome: "Failed",
    error: Object.freeze({ code: "APPLICATION_JOB_NOT_RESTARTABLE" }),
  });
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("application_replay_get(")) return { rows: [{ result: null }] };
      if (sql.includes("application_replay_get_or_put(")) return { rows: [{ result: refusal }] };
      return { rows: [] };
    },
  };
  const store = createPostgresApplicationReplayStore(client);

  const actual = await store.executeAsync(key, canonicalContent, async () => refusal);

  assert.equal(actual, refusal);
  assert.deepEqual(statements, [
    "BEGIN",
    "SELECT etf.application_replay_get($1::text, $2::uuid, $3::text) AS result",
    "SAVEPOINT application_owner",
    "ROLLBACK TO SAVEPOINT application_owner",
    "SELECT etf.application_replay_get_or_put($1::text, $2::uuid, $3::text, $4::text) AS result",
    "COMMIT",
  ]);
});

test("WP-6 PostgreSQL replay store rolls back conflicting content", async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("application_replay_get(")) {
        throw Object.assign(new Error("APPLICATION_IDEMPOTENCY_CONFLICT"), {
          code: "P0001",
        });
      }
      return { rows: [] };
    },
  };
  const store = createPostgresApplicationReplayStore(client);

  await assert.rejects(
    () => store.executeAsync(key, canonicalContent, async () => result),
    (error) => error.code === "APPLICATION_IDEMPOTENCY_CONFLICT",
  );
  assert.deepEqual(statements, [
    "BEGIN",
    "SELECT etf.application_replay_get($1::text, $2::uuid, $3::text) AS result",
    "ROLLBACK",
  ]);
});
