import { createHash } from "node:crypto";

import { canonicalizeJson } from "../../Infrastructure/CanonicalJson/canonical-json.js";

export interface CanonicalAnalyticsEvidence {
  readonly configurationBytes: string;
  readonly configurationHash: string;
  readonly inputBytes: string;
  readonly inputHash: string;
  readonly resultBytes: string;
  readonly resultHash: string;
}

export interface CanonicalAnalyticsDomains {
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly input: Readonly<Record<string, unknown>>;
  readonly result: Readonly<Record<string, unknown>>;
}

export type HashableAnalyticsDomain =
  | "etf.analytics.bundle.v1"
  | "etf.analytics.lifecycle.v1"
  | "etf.analytics.manifest.v1"
  | "etf.analytics.transformation.v1";

export interface CanonicalAnalyticsRecord {
  readonly bytes: string;
  readonly hash: string;
}

export type AnalyticsErrorCode =
  | "ANALYTICS_AMBIGUOUS_MARKET_REVISION"
  | "ANALYTICS_AMBIGUOUS_VINTAGE"
  | "ANALYTICS_INPUT_INCOMPLETE"
  | "ANALYTICS_INPUT_QUARANTINED"
  | "ANALYTICS_INPUT_STALE"
  | "ANALYTICS_INTEGRITY_FAILED"
  | "ANALYTICS_NUMERIC_CLASS_INVALID";

export type AnalyticsNumericClass = "Money" | "Quantity" | "Rate";

const numericScale: Readonly<Record<AnalyticsNumericClass, number>> = Object.freeze({
  Money: 8,
  Quantity: 10,
  Rate: 12,
});
const maximumCollectionItems = 10_000;
const maximumDecimalBytes = 64;
const maximumRevisionDigits = 28;
const maximumStringBytes = 4_096;
const maximumTransformationCount = 1_000;

export class AnalyticsError extends Error {
  readonly code: AnalyticsErrorCode;

  constructor(code: AnalyticsErrorCode) {
    super(code);
    this.name = "AnalyticsError";
    this.code = code;
  }
}

export interface EconomicVintage {
  readonly observationDate: string;
  readonly providerId: string;
  readonly releaseTimestamp: string;
  readonly seriesId: string;
  readonly value: string;
  readonly vintageId: string;
}

export interface MarketObservation {
  readonly adjustmentPolicy: string;
  readonly instrumentId: string;
  readonly providerId: string;
  readonly revision: string;
  readonly sourceAvailableAt: string;
  readonly tradingDate: string;
  readonly value: string;
}

export interface PointInTimeSelectionRequest {
  readonly economicVintages: readonly EconomicVintage[];
  readonly evaluationAt: string;
  readonly marketObservations: readonly MarketObservation[];
  readonly marketRevisionOrder: "fixture-integer" | undefined;
}

export interface PointInTimeAnalyticsInput {
  readonly economicVintages: readonly Readonly<EconomicVintage>[];
  readonly marketObservations: readonly Readonly<MarketObservation>[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireDomain(
  record: Readonly<Record<string, unknown>>,
  expected: string,
): void {
  if (record.domain !== expected) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
}

function requireRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== "object" ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  return value as Readonly<Record<string, unknown>>;
}

function requireExactFields(
  value: unknown,
  fields: readonly string[],
): Readonly<Record<string, unknown>> {
  const record = requireRecord(value);
  const actual = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (
    actual.length !== expected.length ||
    actual.some((field, index) => field !== expected[index])
  ) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  return record;
}

function requireArray(
  value: unknown,
  maximumItems = maximumCollectionItems,
): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  return value;
}

function requireString(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > maximumStringBytes
  ) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  return value;
}

function requireHash(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  return value;
}

function requireCanonicalDate(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/u.test(value) ||
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  return value;
}

function requireCanonicalDecimal(
  value: unknown,
  numericClass: AnalyticsNumericClass,
): string {
  if (typeof value !== "string" || canonicalizeAnalyticsDecimal(value, numericClass) !== value) {
    throw new AnalyticsError("ANALYTICS_NUMERIC_CLASS_INVALID");
  }
  return value;
}

function requireCanonicalInstant(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/u.test(value) ||
    new Date(value).toISOString() !== value
  ) {
    throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
  }
  return value;
}

function requireSortedUnique(
  values: readonly unknown[],
  identity: (value: unknown, index: number) => string,
): void {
  let previous: string | undefined;
  values.forEach((value, index) => {
    const current = identity(value, index);
    if (previous !== undefined && current <= previous) {
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
    }
    previous = current;
  });
}

function validateMarketObservation(value: unknown): Readonly<Record<string, unknown>> {
  const record = requireExactFields(value, [
    "adjustmentPolicy",
    "instrumentId",
    "providerId",
    "revision",
    "sourceAvailableAt",
    "tradingDate",
    "value",
  ]);
  for (const field of ["adjustmentPolicy", "instrumentId", "providerId", "revision", "tradingDate", "value"]) {
    requireString(record[field]);
  }
  if (
    !/^(0|[1-9][0-9]*)$/u.test(String(record.revision)) ||
    String(record.revision).length > maximumRevisionDigits
  ) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  requireCanonicalDate(record.tradingDate);
  requireCanonicalDecimal(record.value, "Quantity");
  requireCanonicalInstant(record.sourceAvailableAt);
  return record;
}

function validateEconomicVintage(value: unknown): Readonly<Record<string, unknown>> {
  const record = requireExactFields(value, [
    "observationDate",
    "providerId",
    "releaseTimestamp",
    "seriesId",
    "value",
    "vintageId",
  ]);
  for (const field of ["observationDate", "providerId", "seriesId", "value", "vintageId"]) {
    requireString(record[field]);
  }
  requireCanonicalDate(record.observationDate);
  requireCanonicalDecimal(record.value, "Quantity");
  requireCanonicalInstant(record.releaseTimestamp);
  return record;
}

function validateInput(record: Readonly<Record<string, unknown>>): void {
  requireExactFields(record, [
    "domain",
    "economicVintages",
    "evaluationAt",
    "inputSchemaVersion",
    "marketObservations",
    "portfolioContextHash",
    "transformationLineage",
  ]);
  requireDomain(record, "etf.analytics.input.v1");
  requireCanonicalInstant(record.evaluationAt);
  if (record.inputSchemaVersion !== "1.0.0") {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  requireHash(record.portfolioContextHash);
  const market = requireArray(record.marketObservations);
  const marketRecords = market.map((value) => {
    const item = requireRecord(value);
    validateMarketObservation(item);
    return item;
  });
  requireSortedUnique(marketRecords, (value) => {
    const item = requireRecord(value);
    return tupleKey([String(item.instrumentId), String(item.tradingDate), String(item.providerId), String(item.adjustmentPolicy), String(item.revision)]);
  });
  const economic = requireArray(record.economicVintages);
  const economicRecords = economic.map((value) => {
    const item = requireRecord(value);
    validateEconomicVintage(item);
    return item;
  });
  requireSortedUnique(economicRecords, (value) => {
    const item = requireRecord(value);
    return tupleKey([String(item.providerId), String(item.seriesId), String(item.observationDate), String(item.releaseTimestamp), String(item.vintageId)]);
  });
  validateTransformationLineage(record.transformationLineage, marketRecords, economicRecords);
}

function validateConfiguration(record: Readonly<Record<string, unknown>>): void {
  requireExactFields(record, [
    "assumptions",
    "baselineVersion",
    "benchmark",
    "codeHash",
    "domain",
    "environment",
    "evaluationAt",
    "inputHash",
    "parameters",
    "providerPolicyReferences",
    "ruleId",
    "ruleVersion",
    "seed",
  ]);
  requireDomain(record, "etf.analytics.configuration.v1");
  requireCanonicalInstant(record.evaluationAt);
  for (const field of ["baselineVersion", "ruleId", "ruleVersion", "seed"]) {
    requireString(record[field]);
  }
  requireHash(record.codeHash);
  requireHash(record.inputHash);
  const assumptions = requireExactFields(record.assumptions, ["costRate", "fillTiming", "slippageRate"]);
  requireCanonicalDecimal(assumptions.costRate, "Rate");
  requireCanonicalDecimal(assumptions.slippageRate, "Rate");
  if (assumptions.fillTiming !== "next-session-open") {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  const benchmark = requireExactFields(record.benchmark, ["instrumentId", "version"]);
  requireString(benchmark.instrumentId);
  requireString(benchmark.version);
  const environment = requireExactFields(record.environment, ["dependencyLockHash", "runtime"]);
  requireString(environment.dependencyLockHash);
  requireString(environment.runtime);
  const parameters = requireExactFields(record.parameters, ["lookbackSessions"]);
  if (typeof parameters.lookbackSessions !== "string" || !/^[1-9][0-9]*$/u.test(parameters.lookbackSessions)) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  requireSortedUnique(requireArray(record.providerPolicyReferences), requireString);
}

function validateResult(record: Readonly<Record<string, unknown>>): void {
  requireExactFields(record, [
    "configurationHash",
    "domain",
    "metrics",
    "resultSchemaVersion",
    "signals",
    "trades",
    "warnings",
  ]);
  requireDomain(record, "etf.analytics.result.v1");
  requireHash(record.configurationHash);
  if (record.resultSchemaVersion !== "1.0.0") {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  requireSortedUnique(requireArray(record.signals), (value) => {
    const item = requireExactFields(value, ["instrumentId", "label", "score"]);
    if (item.label !== "Buy" && item.label !== "Sell" && item.label !== "Neutral") {
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
    }
    requireCanonicalDecimal(item.score, "Rate");
    return requireString(item.instrumentId);
  });
  requireSortedUnique(requireArray(record.metrics), (value) => {
    const item = requireExactFields(value, ["metricId", "numericClass", "value"]);
    if (item.metricId !== "totalReturn") {
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
    }
    if (item.numericClass !== "Rate") {
      throw new AnalyticsError("ANALYTICS_NUMERIC_CLASS_INVALID");
    }
    requireCanonicalDecimal(item.value, "Rate");
    return item.metricId;
  });
  requireArray(record.trades).forEach((value, index) => {
    const item = requireExactFields(value, ["tradeOrdinal", "instrumentId", "side", "quantity", "unitPrice", "grossValue", "fee", "effectiveAt"]);
    if (item.tradeOrdinal !== index || (item.side !== "Buy" && item.side !== "Sell")) {
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
    }
    requireString(item.instrumentId);
    requireCanonicalDecimal(item.quantity, "Quantity");
    requireCanonicalDecimal(item.unitPrice, "Quantity");
    requireCanonicalDecimal(item.grossValue, "Money");
    requireCanonicalDecimal(item.fee, "Money");
    requireCanonicalInstant(item.effectiveAt);
  });
  requireSortedUnique(requireArray(record.warnings), (value) => {
    const item = requireExactFields(value, ["warningCode", "subjectId"]);
    const subject = item.subjectId === null ? "" : requireString(item.subjectId);
    return tupleKey([requireString(item.warningCode), subject]);
  });
}

function validateTransformation(record: Readonly<Record<string, unknown>>): void {
  requireExactFields(record, [
    "algorithmId",
    "algorithmVersion",
    "domain",
    "numericClass",
    "outputValue",
    "parameters",
    "parentTransformationIds",
    "sourceObservationIds",
    "transformationId",
  ]);
  requireDomain(record, "etf.analytics.transformation.v1");
  for (const field of ["algorithmId", "algorithmVersion", "numericClass", "outputValue", "transformationId"]) {
    requireString(record[field]);
  }
  if (record.numericClass !== "Quantity" && record.numericClass !== "Money" && record.numericClass !== "Rate") {
    throw new AnalyticsError("ANALYTICS_NUMERIC_CLASS_INVALID");
  }
  requireCanonicalDecimal(record.outputValue, record.numericClass);
  const parameters = requireExactFields(record.parameters, ["maximumGapSessions"]);
  requireString(parameters.maximumGapSessions);
  requireSortedUnique(requireArray(record.parentTransformationIds), requireString);
  requireSortedUnique(requireArray(record.sourceObservationIds), requireString);
}

function sourceIdentity(prefix: "economic" | "market", values: readonly string[]): string {
  return `${prefix}|${values.map((value) => `${Buffer.byteLength(value, "utf8")}:${value}`).join("|")}`;
}

function validateTransformationLineage(
  value: unknown,
  market: readonly Readonly<Record<string, unknown>>[],
  economic: readonly Readonly<Record<string, unknown>>[],
): void {
  const sourceIdentities = new Set<string>([
    ...market.map((item) => sourceIdentity("market", [
      String(item.instrumentId), String(item.tradingDate), String(item.providerId),
      String(item.adjustmentPolicy), String(item.revision),
    ])),
    ...economic.map((item) => sourceIdentity("economic", [
      String(item.providerId), String(item.seriesId), String(item.observationDate),
      String(item.releaseTimestamp), String(item.vintageId),
    ])),
  ]);
  const records = requireArray(value, maximumTransformationCount).map((item) => {
    const embedded = requireExactFields(item, [
      "algorithmId",
      "algorithmVersion",
      "domain",
      "numericClass",
      "outputHash",
      "outputValue",
      "parameters",
      "parentTransformationIds",
      "sourceObservationIds",
      "transformationId",
    ]);
    const canonical = {
      algorithmId: embedded.algorithmId,
      algorithmVersion: embedded.algorithmVersion,
      domain: embedded.domain,
      numericClass: embedded.numericClass,
      outputValue: embedded.outputValue,
      parameters: embedded.parameters,
      parentTransformationIds: embedded.parentTransformationIds,
      sourceObservationIds: embedded.sourceObservationIds,
      transformationId: embedded.transformationId,
    };
    validateTransformation(canonical);
    if (requireHash(embedded.outputHash) !== sha256(canonicalizeJson(canonical))) {
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
    }
    for (const source of requireArray(embedded.sourceObservationIds).map(requireString)) {
      if (!sourceIdentities.has(source)) {
        throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
      }
    }
    return embedded;
  });
  const identities = records.map((record) => requireString(record.transformationId));
  if (new Set(identities).size !== identities.length) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  const remaining = new Map(records.map((record) => [String(record.transformationId), record]));
  const emitted = new Set<string>();
  for (const actual of records) {
    const ready = [...remaining.values()]
      .filter((candidate) => requireArray(candidate.parentTransformationIds)
        .map(requireString)
        .every((parent) => emitted.has(parent)))
      .sort((left, right) => compareText(String(left.transformationId), String(right.transformationId)));
    if (ready[0] !== actual) {
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
    }
    const identity = String(actual.transformationId);
    emitted.add(identity);
    remaining.delete(identity);
  }
}

function validateLifecycle(record: Readonly<Record<string, unknown>>): void {
  requireExactFields(record, ["domain", "eventAt", "lifecycleSequence", "state"]);
  requireDomain(record, "etf.analytics.lifecycle.v1");
  requireCanonicalInstant(record.eventAt);
  if (!Number.isSafeInteger(record.lifecycleSequence) || Number(record.lifecycleSequence) < 0) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  if (!["Hot", "Archived", "Quarantined", "DeletionFrozen", "ExpiredFrozen", "PendingBackupExpiry"].includes(String(record.state))) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
}

function validateBundle(record: Readonly<Record<string, unknown>>): void {
  requireExactFields(record, [
    "assumptions",
    "baselineVersion",
    "benchmark",
    "codeHash",
    "configurationHash",
    "domain",
    "environment",
    "evaluationAt",
    "evidenceId",
    "evidenceSchemaVersion",
    "inputHash",
    "inputSetId",
    "parameters",
    "providerPolicyReferences",
    "reproducibilityReason",
    "reproducibilityStatus",
    "result",
    "resultHash",
    "retentionEpoch",
    "retentionPolicyVersion",
    "ruleId",
    "ruleVersion",
    "seed",
  ]);
  requireDomain(record, "etf.analytics.bundle.v1");
  validateConfiguration({
    assumptions: record.assumptions,
    baselineVersion: record.baselineVersion,
    benchmark: record.benchmark,
    codeHash: record.codeHash,
    domain: "etf.analytics.configuration.v1",
    environment: record.environment,
    evaluationAt: record.evaluationAt,
    inputHash: record.inputHash,
    parameters: record.parameters,
    providerPolicyReferences: record.providerPolicyReferences,
    ruleId: record.ruleId,
    ruleVersion: record.ruleVersion,
    seed: record.seed,
  });
  validateResult(requireRecord(record.result));
  for (const field of ["evidenceId", "evidenceSchemaVersion", "inputSetId", "retentionPolicyVersion"]) {
    requireString(record[field]);
  }
  requireHash(record.configurationHash);
  requireHash(record.resultHash);
  const configuration = {
    assumptions: record.assumptions,
    baselineVersion: record.baselineVersion,
    benchmark: record.benchmark,
    codeHash: record.codeHash,
    domain: "etf.analytics.configuration.v1",
    environment: record.environment,
    evaluationAt: record.evaluationAt,
    inputHash: record.inputHash,
    parameters: record.parameters,
    providerPolicyReferences: record.providerPolicyReferences,
    ruleId: record.ruleId,
    ruleVersion: record.ruleVersion,
    seed: record.seed,
  };
  if (
    sha256(canonicalizeJson(configuration)) !== record.configurationHash ||
    sha256(canonicalizeJson(record.result)) !== record.resultHash ||
    requireRecord(record.result).configurationHash !== record.configurationHash
  ) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  requireCanonicalInstant(record.retentionEpoch);
  if (
    (record.reproducibilityStatus === "Complete" && record.reproducibilityReason !== null) ||
    (record.reproducibilityStatus === "Degraded" && (
      typeof record.reproducibilityReason !== "string" ||
      record.reproducibilityReason.length === 0 ||
      Buffer.byteLength(record.reproducibilityReason, "utf8") > maximumStringBytes
    )) ||
    (record.reproducibilityStatus !== "Complete" && record.reproducibilityStatus !== "Degraded")
  ) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
}

function validateManifest(record: Readonly<Record<string, unknown>>): void {
  requireExactFields(record, [
    "baselineVersion",
    "bundleHash",
    "configurationHash",
    "deletionCertificateLinks",
    "domain",
    "evidenceId",
    "evidenceSchemaVersion",
    "inputHash",
    "lifecycleReferences",
    "manifestId",
    "manifestSequence",
    "previousManifestHash",
    "reproducibilityReason",
    "reproducibilityStatus",
    "resultHash",
    "retentionEpoch",
    "retentionPolicyVersion",
  ]);
  requireDomain(record, "etf.analytics.manifest.v1");
  for (const field of ["baselineVersion", "bundleHash", "configurationHash", "evidenceId", "evidenceSchemaVersion", "inputHash", "manifestId", "resultHash", "retentionPolicyVersion"]) {
    requireString(record[field]);
  }
  for (const field of ["bundleHash", "configurationHash", "inputHash", "resultHash"]) {
    requireHash(record[field]);
  }
  requireCanonicalInstant(record.retentionEpoch);
  if (!Number.isSafeInteger(record.manifestSequence) || Number(record.manifestSequence) < 0) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  if (record.manifestSequence === 0) {
    if (record.previousManifestHash !== null) {
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
    }
  } else {
    requireHash(record.previousManifestHash);
  }
  if (
    (record.reproducibilityStatus === "Complete" && record.reproducibilityReason !== null) ||
    (record.reproducibilityStatus === "Degraded" && (
      typeof record.reproducibilityReason !== "string" ||
      record.reproducibilityReason.length === 0 ||
      Buffer.byteLength(record.reproducibilityReason, "utf8") > maximumStringBytes
    )) ||
    (record.reproducibilityStatus !== "Complete" && record.reproducibilityStatus !== "Degraded")
  ) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  requireArray(record.lifecycleReferences).forEach((value, index) => {
    const item = requireExactFields(value, ["eventAt", "eventHash", "lifecycleSequence", "state"]);
    requireCanonicalInstant(item.eventAt);
    requireHash(item.eventHash);
    if (!["Hot", "Archived", "Quarantined", "DeletionFrozen", "ExpiredFrozen", "PendingBackupExpiry"].includes(String(item.state))) {
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
    }
    if (item.lifecycleSequence !== index) {
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
    }
    const event = {
      domain: "etf.analytics.lifecycle.v1",
      eventAt: item.eventAt,
      lifecycleSequence: item.lifecycleSequence,
      state: item.state,
    };
    if (sha256(canonicalizeJson(event)) !== item.eventHash) {
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
    }
  });
  requireSortedUnique(requireArray(record.deletionCertificateLinks), (value) => {
    const item = requireExactFields(value, ["certificateHash", "deletionCertificateId", "targetClass"]);
    requireHash(item.certificateHash);
    requireString(item.targetClass);
    return requireString(item.deletionCertificateId);
  });
}

export function hashCanonicalAnalyticsRecord(
  record: Readonly<Record<string, unknown>>,
  domain: HashableAnalyticsDomain,
): CanonicalAnalyticsRecord {
  switch (domain) {
    case "etf.analytics.bundle.v1":
      validateBundle(record);
      break;
    case "etf.analytics.lifecycle.v1":
      validateLifecycle(record);
      break;
    case "etf.analytics.manifest.v1":
      validateManifest(record);
      break;
    case "etf.analytics.transformation.v1":
      validateTransformation(record);
      break;
    default:
      throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  const bytes = canonicalizeJson(record);
  return Object.freeze({ bytes, hash: sha256(bytes) });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareFields<T>(
  left: T,
  right: T,
  fields: readonly (keyof T)[],
): number {
  for (const field of fields) {
    const comparison = compareText(String(left[field]), String(right[field]));
    if (comparison !== 0) {
      return comparison;
    }
  }
  return 0;
}

function tupleKey(values: readonly string[]): string {
  return canonicalizeJson(values);
}

interface DecimalCoefficient {
  readonly coefficient: bigint;
  readonly scale: number;
}

function parseDecimal(value: string): DecimalCoefficient {
  if (Buffer.byteLength(value, "utf8") > maximumDecimalBytes) {
    throw new AnalyticsError("ANALYTICS_NUMERIC_CLASS_INVALID");
  }
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/u.exec(value);
  if (match === null) {
    throw new AnalyticsError("ANALYTICS_NUMERIC_CLASS_INVALID");
  }
  const integer = match[2] ?? "0";
  const fraction = match[3] ?? "";
  const magnitude = BigInt(`${integer}${fraction}`);
  return {
    coefficient: match[1] === "-" ? -magnitude : magnitude,
    scale: fraction.length,
  };
}

function formatDecimal(coefficient: bigint, scale: number): string {
  const normalized = coefficient === 0n ? 0n : coefficient;
  const sign = normalized < 0n ? "-" : "";
  const digits = (normalized < 0n ? -normalized : normalized)
    .toString()
    .padStart(scale + 1, "0");
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function requireNumericCapacity(coefficient: bigint): void {
  const magnitude = coefficient < 0n ? -coefficient : coefficient;
  if (magnitude >= 10n ** 28n) {
    throw new AnalyticsError("ANALYTICS_NUMERIC_CLASS_INVALID");
  }
}

export function quantizeAnalyticsIntermediate(
  value: string,
  numericClass: AnalyticsNumericClass,
): string {
  const targetScale = numericScale[numericClass];
  const parsed = parseDecimal(value);
  let coefficient: bigint;
  if (parsed.scale <= targetScale) {
    coefficient = parsed.coefficient * 10n ** BigInt(targetScale - parsed.scale);
  } else {
    const divisor = 10n ** BigInt(parsed.scale - targetScale);
    const magnitude = parsed.coefficient < 0n ? -parsed.coefficient : parsed.coefficient;
    let quotient = magnitude / divisor;
    const remainder = magnitude % divisor;
    const doubled = remainder * 2n;
    if (doubled > divisor || (doubled === divisor && quotient % 2n !== 0n)) {
      quotient += 1n;
    }
    coefficient = parsed.coefficient < 0n ? -quotient : quotient;
  }
  requireNumericCapacity(coefficient);
  return formatDecimal(coefficient, targetScale);
}

export function canonicalizeAnalyticsDecimal(
  value: string,
  numericClass: AnalyticsNumericClass,
): string {
  const parsed = parseDecimal(value);
  if (parsed.scale > numericScale[numericClass]) {
    throw new AnalyticsError("ANALYTICS_NUMERIC_CLASS_INVALID");
  }
  return quantizeAnalyticsIntermediate(value, numericClass);
}

export function selectPointInTimeAnalyticsInput(
  request: PointInTimeSelectionRequest,
): PointInTimeAnalyticsInput {
  if (
    !Array.isArray(request.economicVintages) ||
    request.economicVintages.length > maximumCollectionItems ||
    !Array.isArray(request.marketObservations) ||
    request.marketObservations.length > maximumCollectionItems
  ) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }
  requireCanonicalInstant(request.evaluationAt);
  const economicByIdentity = new Map<string, EconomicVintage>();
  const economicReleasesByIdentity = new Map<string, Map<string, string>>();
  for (const vintage of request.economicVintages) {
    validateEconomicVintage(vintage);
    requireCanonicalInstant(vintage.releaseTimestamp);
    if (vintage.releaseTimestamp > request.evaluationAt) {
      continue;
    }
    const key = tupleKey([
      vintage.providerId,
      vintage.seriesId,
      vintage.observationDate,
    ]);
    const canonicalVintage = canonicalizeJson(vintage);
    const releases = economicReleasesByIdentity.get(key) ?? new Map<string, string>();
    const release = releases.get(vintage.releaseTimestamp);
    if (release !== undefined && release !== canonicalVintage) {
      throw new AnalyticsError("ANALYTICS_AMBIGUOUS_VINTAGE");
    }
    releases.set(vintage.releaseTimestamp, canonicalVintage);
    economicReleasesByIdentity.set(key, releases);
    const selected = economicByIdentity.get(key);
    if (selected === undefined || vintage.releaseTimestamp > selected.releaseTimestamp) {
      economicByIdentity.set(key, vintage);
    }
  }

  const marketByIdentity = new Map<string, MarketObservation>();
  const marketRevisionsByIdentity = new Map<string, Map<string, string>>();
  for (const observation of request.marketObservations) {
    validateMarketObservation(observation);
    requireCanonicalInstant(observation.sourceAvailableAt);
    if (observation.sourceAvailableAt > request.evaluationAt) {
      continue;
    }
    const key = tupleKey([
      observation.instrumentId,
      observation.tradingDate,
      observation.providerId,
      observation.adjustmentPolicy,
    ]);
    const selected = marketByIdentity.get(key);
    if (selected === undefined) {
      marketByIdentity.set(key, observation);
    }
    if (request.marketRevisionOrder === undefined) {
      if (selected !== undefined) {
        throw new AnalyticsError("ANALYTICS_AMBIGUOUS_MARKET_REVISION");
      }
      continue;
    }
    if (!/^(0|[1-9][0-9]*)$/u.test(observation.revision)) {
      throw new AnalyticsError("ANALYTICS_AMBIGUOUS_MARKET_REVISION");
    }
    const canonicalObservation = canonicalizeJson(observation);
    const revisions = marketRevisionsByIdentity.get(key) ?? new Map<string, string>();
    const revision = revisions.get(observation.revision);
    if (revision !== undefined && revision !== canonicalObservation) {
      throw new AnalyticsError("ANALYTICS_AMBIGUOUS_MARKET_REVISION");
    }
    revisions.set(observation.revision, canonicalObservation);
    marketRevisionsByIdentity.set(key, revisions);
    if (selected !== undefined && BigInt(observation.revision) > BigInt(selected.revision)) {
      marketByIdentity.set(key, observation);
    }
  }

  const economicVintages = [...economicByIdentity.values()]
    .sort((left, right) => compareFields(left, right, [
      "providerId",
      "seriesId",
      "observationDate",
      "releaseTimestamp",
      "vintageId",
    ]))
    .map((value) => Object.freeze({ ...value }));
  const marketObservations = [...marketByIdentity.values()]
    .sort((left, right) => compareFields(left, right, [
      "instrumentId",
      "tradingDate",
      "providerId",
      "adjustmentPolicy",
      "revision",
    ]))
    .map((value) => Object.freeze({ ...value }));

  return Object.freeze({
    economicVintages: Object.freeze(economicVintages),
    marketObservations: Object.freeze(marketObservations),
  });
}

export function createCanonicalAnalyticsEvidence(
  domains: CanonicalAnalyticsDomains,
): CanonicalAnalyticsEvidence {
  validateInput(domains.input);
  validateConfiguration(domains.configuration);
  validateResult(domains.result);

  const inputBytes = canonicalizeJson(domains.input);
  const inputHash = sha256(inputBytes);
  if (domains.configuration.inputHash !== inputHash) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }

  const configurationBytes = canonicalizeJson(domains.configuration);
  const configurationHash = sha256(configurationBytes);
  if (domains.result.configurationHash !== configurationHash) {
    throw new AnalyticsError("ANALYTICS_INTEGRITY_FAILED");
  }

  const resultBytes = canonicalizeJson(domains.result);

  return Object.freeze({
    configurationBytes,
    configurationHash,
    inputBytes,
    inputHash,
    resultBytes,
    resultHash: sha256(resultBytes),
  });
}
