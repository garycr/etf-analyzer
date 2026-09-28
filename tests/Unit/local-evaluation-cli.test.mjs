import assert from "node:assert/strict";
import test from "node:test";

import { runLocalEvaluationCli } from "../../dist/Infrastructure/Local/local-evaluation-cli.js";

test("local evaluation CLI validates arguments before preparation", async () => {
  let prepareCalls = 0;
  await assert.rejects(
    runLocalEvaluationCli(["node", "cli"], {}, {
      async prepare() { prepareCalls += 1; },
      now: () => new Date("2026-09-28T00:00:00.000Z"),
      write() {},
    }),
    /APPLICATION_CONFIGURATION_INVALID/u,
  );
  assert.equal(prepareCalls, 0);
});

test("local evaluation CLI uses the canonical environment timestamp and writes JSON", async () => {
  const writes = [];
  const calls = [];
  await runLocalEvaluationCli(
    ["node", "cli", "/tmp/evaluation"],
    {
      ETF_POSTGRES_ADMIN_URL: "postgresql://postgres@127.0.0.1/etf_analyzer",
      ETF_EVALUATION_APPLIED_AT: "2026-09-28T01:02:03.000Z",
    },
    {
      async prepare(...arguments_) {
        calls.push(arguments_);
        return { configPath: "/tmp/evaluation/local-runtime.json" };
      },
      now: () => new Date("2030-01-01T00:00:00.000Z"),
      write(value) { writes.push(value); },
    },
  );
  assert.deepEqual(calls, [[
    "/tmp/evaluation",
    "postgresql://postgres@127.0.0.1/etf_analyzer",
    "2026-09-28T01:02:03.000Z",
  ]]);
  assert.deepEqual(writes, ['{"configPath":"/tmp/evaluation/local-runtime.json"}\n']);
});

test("local evaluation CLI uses its clock when no timestamp is supplied", async () => {
  let appliedAt;
  await runLocalEvaluationCli(
    ["node", "cli", "/tmp/evaluation"],
    { ETF_POSTGRES_ADMIN_URL: "postgresql://postgres@127.0.0.1/etf_analyzer" },
    {
      async prepare(_root, _url, timestamp) {
        appliedAt = timestamp;
        return {};
      },
      now: () => new Date("2026-09-28T04:05:06.000Z"),
      write() {},
    },
  );
  assert.equal(appliedAt, "2026-09-28T04:05:06.000Z");
});
