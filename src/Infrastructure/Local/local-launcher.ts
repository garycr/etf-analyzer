import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  startLocalRuntime,
  type LocalRuntime,
  type LocalRuntimeConfig,
} from "./local-runtime.js";

interface LocalLauncherDependencies {
  readonly readConfig: (configPath: string) => Promise<string>;
  readonly startRuntime: (config: LocalRuntimeConfig) => Promise<LocalRuntime>;
  readonly once: (signal: "SIGINT" | "SIGTERM", handler: () => Promise<void>) => void;
  readonly writeLine: (line: string) => void;
}

export interface LocalRuntimeProcess {
  shutdown(): Promise<void>;
}

const requiredFields = [
  "allowedOrigins",
  "analyticsArtifactPath",
  "artifactRoot",
  "bodyLimitBytes",
  "fixtureEvaluationAt",
  "fixturePackageDirectory",
  "port",
] as const;

function invalidConfiguration(): never {
  throw new Error("APPLICATION_CONFIGURATION_INVALID");
}

function parseConfig(
  configJson: string,
  connectionString: string | undefined,
  controlConnectionString: string | undefined,
): LocalRuntimeConfig {
  if (
    connectionString === undefined ||
    connectionString.length === 0 ||
    controlConnectionString === undefined ||
    controlConnectionString.length === 0
  ) invalidConfiguration();
  let value: unknown;
  try {
    value = JSON.parse(configJson);
  } catch {
    return invalidConfiguration();
  }
  if (value === null || Array.isArray(value) || typeof value !== "object") invalidConfiguration();
  const config = value as Record<string, unknown>;
  const fields = Object.keys(config).sort();
  const expectedFields = [
    ...requiredFields,
    ...(Object.hasOwn(config, "requestTimeoutMs") ? ["requestTimeoutMs"] : []),
  ].sort();
  if (fields.length !== expectedFields.length || fields.some((field, index) => field !== expectedFields[index])) {
    invalidConfiguration();
  }
  if (
    !Number.isSafeInteger(config.port) ||
    !Number.isSafeInteger(config.bodyLimitBytes) ||
    (config.requestTimeoutMs !== undefined && !Number.isSafeInteger(config.requestTimeoutMs)) ||
    !Array.isArray(config.allowedOrigins) ||
    config.allowedOrigins.some((origin) => typeof origin !== "string") ||
    typeof config.artifactRoot !== "string" ||
    typeof config.fixturePackageDirectory !== "string" ||
    typeof config.fixtureEvaluationAt !== "string" ||
    typeof config.analyticsArtifactPath !== "string"
  ) invalidConfiguration();
  return Object.freeze({
    controlConnectionString,
    connectionString,
    port: config.port as number,
    allowedOrigins: Object.freeze([...(config.allowedOrigins as string[])]),
    bodyLimitBytes: config.bodyLimitBytes as number,
    ...(config.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: config.requestTimeoutMs as number }),
    artifactRoot: config.artifactRoot,
    fixturePackageDirectory: config.fixturePackageDirectory,
    fixtureEvaluationAt: config.fixtureEvaluationAt,
    analyticsArtifactPath: config.analyticsArtifactPath,
  });
}

const defaultDependencies: LocalLauncherDependencies = {
  readConfig: (configPath) => readFile(configPath, "utf8"),
  startRuntime: startLocalRuntime,
  once: (signal, handler) => process.once(signal, () => void handler()),
  writeLine: (line) => process.stdout.write(`${line}\n`),
};

export async function launchLocalRuntimeProcess(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
  dependencies: LocalLauncherDependencies = defaultDependencies,
): Promise<LocalRuntimeProcess> {
  if (argv.length !== 3 || argv[2] === undefined || argv[2].length === 0) invalidConfiguration();
  const config = parseConfig(
    await dependencies.readConfig(argv[2]),
    environment.ETF_POSTGRES_URL,
    environment.ETF_POSTGRES_CONTROL_URL,
  );
  const runtime = await dependencies.startRuntime(config);
  dependencies.writeLine(`ETF Analyzer listening at http://${runtime.address.host}:${runtime.address.port}/`);
  let shutdownPromise: Promise<void> | undefined;
  const shutdown = () => {
    shutdownPromise ??= runtime.close();
    return shutdownPromise;
  };
  dependencies.once("SIGINT", shutdown);
  dependencies.once("SIGTERM", shutdown);
  return Object.freeze({ shutdown });
}

const entryPath = process.argv[1];
if (entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href) {
  launchLocalRuntimeProcess(process.argv, process.env).catch((error: unknown) => {
    const code = error instanceof Error ? error.message : "APPLICATION_CONFIGURATION_INVALID";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
