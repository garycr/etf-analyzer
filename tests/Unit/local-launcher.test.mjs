import assert from "node:assert/strict";
import test from "node:test";

import { launchLocalRuntimeProcess } from "../../dist/Infrastructure/Local/local-launcher.js";

test("operator launcher reads one config and closes once on termination signals", async () => {
  const handlers = new Map();
  const output = [];
  let closeCount = 0;
  const runtimeConfig = {
    port: 0,
    allowedOrigins: ["http://127.0.0.1:5173"],
    bodyLimitBytes: 1_048_576,
    requestTimeoutMs: 5_000,
    artifactRoot: "/srv/etf/reviewed",
    fixturePackageDirectory: "fixture",
    fixtureEvaluationAt: "2026-01-31T00:00:00.000Z",
    analyticsArtifactPath: "analytics.json",
  };

  const processRuntime = await launchLocalRuntimeProcess(
    ["node", "local-launcher.js", "/etc/etf/local-runtime.json"],
    {
      ETF_POSTGRES_CONTROL_URL: "postgresql://control-configured",
      ETF_POSTGRES_URL: "postgresql://operator-configured",
    },
    {
      async readConfig(configPath) {
        assert.equal(configPath, "/etc/etf/local-runtime.json");
        return JSON.stringify(runtimeConfig);
      },
      async startRuntime(config) {
        assert.deepEqual(config, {
          ...runtimeConfig,
          controlConnectionString: "postgresql://control-configured",
          connectionString: "postgresql://operator-configured",
        });
        return {
          address: { host: "127.0.0.1", port: 43123 },
          async close() { closeCount += 1; },
        };
      },
      once(signal, handler) { handlers.set(signal, handler); },
      writeLine(line) { output.push(line); },
    },
  );

  assert.deepEqual(output, ["ETF Analyzer listening at http://127.0.0.1:43123/"]);
  assert.deepEqual([...handlers.keys()], ["SIGINT", "SIGTERM"]);
  await handlers.get("SIGTERM")();
  await handlers.get("SIGINT")();
  await processRuntime.shutdown();
  assert.equal(closeCount, 1);
});

test("operator launcher rejects incomplete malformed and open configuration", async () => {
  const validConfig = {
    port: 43123,
    allowedOrigins: ["http://127.0.0.1:5173"],
    bodyLimitBytes: 1_048_576,
    artifactRoot: "/srv/etf/reviewed",
    fixturePackageDirectory: "fixture",
    fixtureEvaluationAt: "2026-01-31T00:00:00.000Z",
    analyticsArtifactPath: "analytics.json",
  };
  const cases = [
    { name: "missing argv", argv: ["node", "launcher"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: validConfig },
    { name: "missing database URL", argv: ["node", "launcher", "config.json"], environment: {}, value: validConfig },
    { name: "missing control URL", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: validConfig },
    { name: "invalid JSON", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, text: "{" },
    { name: "array body", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: [] },
    { name: "missing field", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: { ...validConfig, port: undefined } },
    { name: "extra field", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: { ...validConfig, extra: true } },
    { name: "invalid port", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: { ...validConfig, port: "43123" } },
    { name: "invalid body limit", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: { ...validConfig, bodyLimitBytes: "1048576" } },
    { name: "invalid timeout", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: { ...validConfig, requestTimeoutMs: "5000" } },
    { name: "invalid origins", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: { ...validConfig, allowedOrigins: [7] } },
    { name: "invalid artifact root", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: { ...validConfig, artifactRoot: 7 } },
    { name: "invalid fixture directory", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: { ...validConfig, fixturePackageDirectory: 7 } },
    { name: "invalid evaluation instant", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: { ...validConfig, fixtureEvaluationAt: 7 } },
    { name: "invalid analytics path", argv: ["node", "launcher", "config.json"], environment: { ETF_POSTGRES_URL: "postgresql://configured" }, value: { ...validConfig, analyticsArtifactPath: 7 } },
  ];
  for (const testCase of cases) {
    let startCalls = 0;
    await assert.rejects(
      launchLocalRuntimeProcess(testCase.argv, testCase.environment, {
        readConfig: async () => testCase.text ?? JSON.stringify(testCase.value),
        startRuntime: async () => { startCalls += 1; throw new Error("must not start"); },
        once: () => assert.fail("must not register signals"),
        writeLine: () => assert.fail("must not write output"),
      }),
      (error) => error.message === "APPLICATION_CONFIGURATION_INVALID",
      testCase.name,
    );
    assert.equal(startCalls, 0, testCase.name);
  }
});
