export const analyticsEvidenceOperations = Object.freeze([
  "commit",
  "read",
  "verify",
] as const);

export type AnalyticsEvidenceOperation = (typeof analyticsEvidenceOperations)[number];

export const analyticsProviders = Object.freeze(["fixture"] as const);
export const analyticsTransformationCatalog = Object.freeze([] as const);
export const analyticsLifecycleOperations = Object.freeze([] as const);
export const analyticsRuntime = "node-20" as const;
export const analyticsPublicationWriterCount = 1 as const;

export interface AnalyticsIdentityPort {
  actorId(): Promise<string>;
}

export interface AnalyticsAuthorizationPort {
  authorize(request: Readonly<{
    actorId: string;
    evidenceId: string;
    operation: AnalyticsEvidenceOperation;
  }>): Promise<boolean>;
}

export interface AnalyticsDenialRecord {
  readonly errorCode: "ANALYTICS_EVIDENCE_ACCESS_DENIED";
  readonly evidenceId: string;
  readonly operation: AnalyticsEvidenceOperation;
  readonly outcome: "PermissionDenied";
}

export interface AnalyticsEvidencePersistencePort {
  commit(payload: unknown): Promise<unknown>;
  read(evidenceId: string): Promise<unknown>;
  recordDeniedAccess(record: AnalyticsDenialRecord): Promise<void>;
  verify(evidenceId: string): Promise<unknown>;
}

export class AnalyticsEvidenceAccessError extends Error {
  readonly codes: readonly (
    | "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED"
    | "ANALYTICS_EVIDENCE_ACCESS_DENIED"
  )[];
  readonly readinessDegraded: boolean;

  constructor(readinessDegraded: boolean, auditFailed = readinessDegraded) {
    super("Analytics evidence access denied");
    this.name = "AnalyticsEvidenceAccessError";
    this.codes = Object.freeze(auditFailed
      ? ["ANALYTICS_EVIDENCE_ACCESS_DENIED", "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED"]
      : ["ANALYTICS_EVIDENCE_ACCESS_DENIED"]);
    this.readinessDegraded = readinessDegraded;
  }
}

export interface AnalyticsEvidenceService {
  commit(evidenceId: string, payloadJson: string): Promise<unknown>;
  read(evidenceId: string): Promise<unknown>;
  verify(evidenceId: string): Promise<unknown>;
}

const maximumPayloadItems = 10_000;
const maximumPayloadBytes = 1_048_576;
const maximumPayloadStringBytes = 4_096;

function boundedIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)
    ? value
    : undefined;
}

function isBoundedPlainData(value: unknown): boolean {
  const pending: unknown[] = [value];
  const seen = new Set<object>();
  let items = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    items += 1;
    if (items > maximumPayloadItems) return false;
    if (current === null || typeof current === "boolean") continue;
    if (typeof current === "string") {
      if (Buffer.byteLength(current, "utf8") > maximumPayloadStringBytes) return false;
      continue;
    }
    if (typeof current === "number") {
      if (!Number.isSafeInteger(current)) return false;
      continue;
    }
    if (typeof current !== "object" || seen.has(current)) return false;
    seen.add(current);
    if (Array.isArray(current)) {
      if (current.length > maximumPayloadItems) return false;
      pending.push(...current);
      continue;
    }
    if (Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) {
      return false;
    }
    const descriptors = Object.getOwnPropertyDescriptors(current);
    const entries = Object.entries(descriptors).filter(([, descriptor]) => descriptor.enumerable);
    if (entries.length > maximumPayloadItems) return false;
    for (const [key, descriptor] of entries) {
      if (Buffer.byteLength(key, "utf8") > maximumPayloadStringBytes) return false;
      if (!("value" in descriptor)) return false;
      pending.push(descriptor.value);
    }
  }
  return true;
}

async function denyEvidenceAccess(
  port: AnalyticsEvidencePersistencePort,
  operation: AnalyticsEvidenceOperation,
  request: Readonly<{ evidenceId: string }>,
  readinessDegraded = false,
): Promise<never> {
  const evidenceId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(request.evidenceId)
    ? request.evidenceId
    : "[REDACTED]";
  const denial = Object.freeze({
    errorCode: "ANALYTICS_EVIDENCE_ACCESS_DENIED" as const,
    evidenceId,
    operation,
    outcome: "PermissionDenied" as const,
  });
  try {
    await port.recordDeniedAccess(denial);
  } catch {
    throw new AnalyticsEvidenceAccessError(true, true);
  }
  throw new AnalyticsEvidenceAccessError(readinessDegraded, false);
}

async function requireEvidenceAuthority(
  port: AnalyticsEvidencePersistencePort,
  authorization: AnalyticsAuthorizationPort,
  actorId: string,
  operation: AnalyticsEvidenceOperation,
  request: Readonly<{ evidenceId: string }>,
): Promise<void> {
  try {
    if (await authorization.authorize(Object.freeze({
      actorId,
      evidenceId: request.evidenceId,
      operation,
    }))) {
      return;
    }
  } catch {
    return denyEvidenceAccess(port, operation, request, true);
  }
  return denyEvidenceAccess(port, operation, request);
}

async function trustedActorId(
  port: AnalyticsEvidencePersistencePort,
  identity: AnalyticsIdentityPort,
  operation: AnalyticsEvidenceOperation,
  request: Readonly<{ evidenceId: string }>,
): Promise<string> {
  try {
    const actorId = await identity.actorId();
    if (boundedIdentifier(actorId) === undefined) {
      throw new Error("invalid actor identity");
    }
    return actorId;
  } catch {
    return denyEvidenceAccess(port, operation, request, true);
  }
}

export function createAnalyticsEvidenceService(
  port: AnalyticsEvidencePersistencePort,
  authorization: AnalyticsAuthorizationPort,
  identity: AnalyticsIdentityPort,
): AnalyticsEvidenceService {
  return Object.freeze({
    async commit(requestedEvidenceId: string, payloadJson: string): Promise<unknown> {
      const evidenceId = boundedIdentifier(requestedEvidenceId);
      if (
        evidenceId === undefined ||
        typeof payloadJson !== "string" ||
        Buffer.byteLength(payloadJson, "utf8") > maximumPayloadBytes
      ) {
        return denyEvidenceAccess(port, "commit", { evidenceId: "[REDACTED]" });
      }
      let payload: unknown;
      try {
        payload = JSON.parse(payloadJson) as unknown;
        if (!isBoundedPlainData(payload)) {
          return denyEvidenceAccess(port, "commit", { evidenceId });
        }
      } catch {
        return denyEvidenceAccess(port, "commit", { evidenceId });
      }
      const snapshot = Object.freeze({ evidenceId, payload });
      const actorId = await trustedActorId(port, identity, "commit", snapshot);
      await requireEvidenceAuthority(port, authorization, actorId, "commit", snapshot);
      if (
        snapshot.payload === null ||
        Array.isArray(snapshot.payload) ||
        typeof snapshot.payload !== "object" ||
        !("evidenceId" in snapshot.payload) ||
        snapshot.payload.evidenceId !== snapshot.evidenceId
      ) {
        return denyEvidenceAccess(port, "commit", snapshot);
      }
      return port.commit(snapshot.payload);
    },
    async read(requestedEvidenceId: string): Promise<unknown> {
      const evidenceId = boundedIdentifier(requestedEvidenceId);
      if (evidenceId === undefined) {
        return denyEvidenceAccess(port, "read", { evidenceId: "[REDACTED]" });
      }
      const snapshot = Object.freeze({ evidenceId });
      const actorId = await trustedActorId(port, identity, "read", snapshot);
      await requireEvidenceAuthority(port, authorization, actorId, "read", snapshot);
      return port.read(snapshot.evidenceId);
    },
    async verify(requestedEvidenceId: string): Promise<unknown> {
      const evidenceId = boundedIdentifier(requestedEvidenceId);
      if (evidenceId === undefined) {
        return denyEvidenceAccess(port, "verify", { evidenceId: "[REDACTED]" });
      }
      const snapshot = Object.freeze({ evidenceId });
      const actorId = await trustedActorId(port, identity, "verify", snapshot);
      await requireEvidenceAuthority(port, authorization, actorId, "verify", snapshot);
      return port.verify(snapshot.evidenceId);
    },
  });
}
