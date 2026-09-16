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

export type ProviderEgressOperation = "dns-resolution" | "network-connection";

export interface ProviderEgressDenialEvidence {
  readonly endpoint: string;
  readonly fixtureOnly: true;
  readonly operation: ProviderEgressOperation;
  readonly outcome: "denied";
  readonly successfulConnections: 0;
}

export class ProviderEgressDeniedError extends Error {
  readonly code = "PROVIDER_EGRESS_DENIED";
  readonly evidence: ProviderEgressDenialEvidence;

  constructor(
    operation: ProviderEgressOperation,
    endpoint: string,
    fixtureOnly: true,
  ) {
    super("Product provider egress is denied in fixture mode");
    this.name = "ProviderEgressDeniedError";
    this.evidence = Object.freeze({
      endpoint: sanitizedEndpointOrigin(endpoint),
      fixtureOnly,
      operation,
      outcome: "denied",
      successfulConnections: 0,
    });
  }
}

function sanitizedEndpointOrigin(endpoint: string): string {
  try {
    return new URL(endpoint).origin;
  } catch {
    return "[REDACTED]";
  }
}

const logLevels = new Set<LocalConfiguration["logLevel"]>([
  "debug",
  "info",
  "warn",
  "error",
]);

const sensitiveFieldPattern =
  /(apikey|brokerageartifact|commandpayload|connectionstring|credential|databaseurl|environmentsecret|kubernetessecret|password|postgresurl|protectedanchorkey|rawfixturesource|rawprovider|requestpayload|secret|sourceurl|sql|stack|symbol|token|userenteredtext)/i;

function redactSensitiveField(name: string, value: unknown): unknown {
  const normalizedName = name.replaceAll(/[^a-z0-9]/gi, "");
  return sensitiveFieldPattern.test(normalizedName) ? "[REDACTED]" : value;
}

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

export function attemptProductProviderEgress(
  configuration: LocalConfiguration,
  operation: ProviderEgressOperation,
  endpoint: string,
  connectionAttempt: () => unknown,
): never {
  void connectionAttempt;
  throw new ProviderEgressDeniedError(
    operation,
    endpoint,
    configuration.fixtureOnly,
  );
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
  return JSON.stringify(
    { event, fields, level: "info" },
    redactSensitiveField,
  );
}
