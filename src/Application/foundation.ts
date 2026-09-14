export interface LocalConfiguration {
  environment: "local";
  fixtureOnly: true;
  logLevel: "debug" | "info" | "warn" | "error";
  postgresUrl: string | undefined;
}

export interface FoundationChecks {
  migrations: boolean;
  postgres: boolean;
}

export interface HealthSnapshot {
  live: true;
  ready: boolean;
  checks: FoundationChecks;
}

const logLevels = new Set<LocalConfiguration["logLevel"]>([
  "debug",
  "info",
  "warn",
  "error",
]);

const sensitiveFieldPattern =
  /(connectionstring|credential|databaseurl|password|postgresurl|secret|token)/i;

export function loadLocalConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): LocalConfiguration {
  if ((environment.ETF_PROVIDER_EGRESS ?? "disabled") !== "disabled") {
    throw new Error("ETF_PROVIDER_EGRESS must be disabled");
  }

  const logLevel = environment.ETF_LOG_LEVEL ?? "info";
  if (!logLevels.has(logLevel as LocalConfiguration["logLevel"])) {
    throw new Error("ETF_LOG_LEVEL must be debug, info, warn, or error");
  }

  return {
    environment: "local",
    fixtureOnly: true,
    logLevel: logLevel as LocalConfiguration["logLevel"],
    postgresUrl: environment.ETF_POSTGRES_URL,
  };
}

export function createHealthSnapshot(checks: FoundationChecks): HealthSnapshot {
  return {
    live: true,
    ready: checks.postgres && checks.migrations,
    checks: { migrations: checks.migrations, postgres: checks.postgres },
  };
}

export function serializeLogEvent(
  event: string,
  fields: Readonly<Record<string, unknown>>,
): string {
  const redactedFields = Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [
      name,
      sensitiveFieldPattern.test(name) ? "[REDACTED]" : value,
    ]),
  );

  return JSON.stringify({ event, fields: redactedFields, level: "info" });
}
