import { createHash } from "node:crypto";

import { canonicalizeJson } from "../Infrastructure/CanonicalJson/canonical-json.js";

export type FixtureConformanceCode =
  | "FIXTURE_DECIMAL_INVALID"
  | "FIXTURE_DATASET_HASH_MISMATCH"
  | "FIXTURE_FILE_INTEGRITY_FAILED"
  | "FIXTURE_IDEMPOTENCY_CONFLICT"
  | "FIXTURE_MANIFEST_INVALID"
  | "FIXTURE_PROVENANCE_INVALID"
  | "FIXTURE_REQUIRED_MISSING"
  | "FIXTURE_REQUIRED_PARTIAL"
  | "FIXTURE_REQUIRED_QUARANTINED"
  | "FIXTURE_REQUIRED_STALE"
  | "FIXTURE_TEMPORAL_INVALID"
  | "FIXTURE_UNDECLARED_INPUT";

export type FixtureIdentityComponent =
  | { readonly state: "absent" }
  | { readonly raw: string; readonly state: "invalid" }
  | { readonly state: "valid"; readonly value: string };

export interface FixtureConformanceIssue {
  readonly businessIdentity: readonly FixtureIdentityComponent[];
  readonly code: FixtureConformanceCode;
  readonly datasetIdentity: readonly FixtureIdentityComponent[];
  readonly recordType: "" | "market" | "economic";
  readonly relativePath: FixtureIdentityComponent;
}

const approvedDatasetHashes = new Map<string, string>([
  [
    "etf-prototype-core\u00002026.01.0",
    "5c68a8c394aecb6e27833f4216bfcd5f5c724e3aff6cfad7980192ec8d1e0b68",
  ],
]);

export class FixtureConformanceError extends Error {
  public readonly code: FixtureConformanceCode;
  public readonly issues: readonly FixtureConformanceIssue[];

  public constructor(
    code: FixtureConformanceCode,
    issues: readonly FixtureConformanceIssue[] = [],
  ) {
    super(code);
    this.name = "FixtureConformanceError";
    this.code = code;
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({
      ...issue,
      businessIdentity: Object.freeze(
        issue.businessIdentity.map((component) => Object.freeze({ ...component })),
      ),
      datasetIdentity: Object.freeze(
        issue.datasetIdentity.map((component) => Object.freeze({ ...component })),
      ),
      relativePath: Object.freeze({ ...issue.relativePath }),
    })));
  }
}

export interface FixturePackageBytes {
  readonly manifest: Uint8Array;
  readonly files: Readonly<Record<string, Uint8Array>>;
}

export interface ValidatedFixturePackage {
  readonly datasetHash: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly economicIdempotentReplayCount: number;
  readonly economicVintageCount: number;
  readonly fileHashes: Readonly<Record<string, string>>;
  readonly marketIdempotentReplayCount: number;
  readonly marketObservationCount: number;
}

export interface FixturePackageSelection {
  readonly economicVintages: readonly Readonly<Record<string, unknown>>[];
  readonly marketObservations: readonly Readonly<Record<string, unknown>>[];
}

interface FileDescriptor {
  readonly byteLength: number;
  readonly mediaType: string;
  readonly recordCount: number;
  readonly relativePath: string;
  readonly sha256: string;
}

interface ParsedFixtureFile {
  readonly descriptor: FileDescriptor;
  readonly records: readonly Readonly<Record<string, unknown>>[];
}

interface DeclaredCoverage {
  readonly economicInputs: ReadonlySet<string>;
  readonly marketInputs: ReadonlySet<string>;
}

const manifestFields = [
  "contractVersion",
  "datasetHash",
  "datasetId",
  "datasetVersion",
  "economicCoverage",
  "files",
  "fixturePolicyId",
  "marketCoverage",
  "prototypeCandidate",
  "schemaVersion",
] as const;

const descriptorFields = [
  "byteLength",
  "mediaType",
  "recordCount",
  "relativePath",
  "sha256",
] as const;

const marketCoverageFields = [
  "adjustmentPolicy",
  "instrumentId",
  "requiredTradingDates",
] as const;

const economicCoverageFields = [
  "observationDates",
  "providerId",
  "seriesId",
] as const;

const marketObservationFields = [
  "adjustmentPolicy",
  "currency",
  "ingestionJobId",
  "instrumentId",
  "normalizationId",
  "numericClass",
  "providerId",
  "qualityCodes",
  "qualityState",
  "rawSourceHash",
  "rawSourceRef",
  "revision",
  "sourceAvailableAt",
  "tradingDate",
  "value",
] as const;

const economicVintageFields = [
  "ingestionJobId",
  "normalizationId",
  "numericClass",
  "observationDate",
  "providerId",
  "qualityCodes",
  "qualityState",
  "rawSourceHash",
  "rawSourceRef",
  "releaseTimestamp",
  "seriesId",
  "value",
  "vintageId",
] as const;

const provenanceFields = new Set([
  "ingestionJobId",
  "normalizationId",
  "rawSourceHash",
  "rawSourceRef",
]);

const qualityStates = new Set(["Valid", "Partial", "Stale", "Quarantined"]);

const fixtureCodePrecedence: readonly FixtureConformanceCode[] = [
  "FIXTURE_MANIFEST_INVALID",
  "FIXTURE_FILE_INTEGRITY_FAILED",
  "FIXTURE_DATASET_HASH_MISMATCH",
  "FIXTURE_IDEMPOTENCY_CONFLICT",
  "FIXTURE_TEMPORAL_INVALID",
  "FIXTURE_DECIMAL_INVALID",
  "FIXTURE_PROVENANCE_INVALID",
  "FIXTURE_UNDECLARED_INPUT",
  "FIXTURE_REQUIRED_MISSING",
  "FIXTURE_REQUIRED_PARTIAL",
  "FIXTURE_REQUIRED_STALE",
  "FIXTURE_REQUIRED_QUARANTINED",
];

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseManifest(bytes: Uint8Array): Record<string, unknown> {
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    if (text.startsWith("\uFEFF")) {
      throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
    }
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
    }
    if (canonicalizeJson(parsed) !== text) {
      throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof FixtureConformanceError) {
      throw error;
    }
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
}

function parseJsonLines(bytes: Uint8Array): readonly Readonly<Record<string, unknown>>[] {
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    if (!text.endsWith("\n") || text.endsWith("\n\n") || text.startsWith("\uFEFF")) {
      throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
    }
    return text.slice(0, -1).split("\n").map((line) => {
      if (line.length === 0 || line.includes("\r")) {
        throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
      }
      const parsed: unknown = JSON.parse(line);
      if (
        parsed === null ||
        Array.isArray(parsed) ||
        typeof parsed !== "object" ||
        canonicalizeJson(parsed) !== line
      ) {
        throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
      }
      return parsed as Readonly<Record<string, unknown>>;
    });
  } catch (error) {
    if (error instanceof FixtureConformanceError) {
      throw error;
    }
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
}

function requireString(
  record: Readonly<Record<string, unknown>>,
  name: string,
): string {
  const value = record[name];
  if (typeof value !== "string") {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
  return value;
}

function requireClosedRecord(
  value: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
  const record = value as Record<string, unknown>;
  const actualFields = Object.keys(record).sort();
  if (canonicalizeJson(actualFields) !== canonicalizeJson([...fields].sort())) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
  return record;
}

function requireStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
  return value;
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function compareStringTuple(
  left: readonly [string, string],
  right: readonly [string, string],
): number {
  return compareUtf8(left[0], right[0]) || compareUtf8(left[1], right[1]);
}

function compareRecordFields(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): number {
  for (const field of fields) {
    const comparison = compareUtf8(
      requireString(left, field),
      requireString(right, field),
    );
    if (comparison !== 0) {
      return comparison;
    }
  }
  return 0;
}

function requireStrictlySortedUnique<T>(
  values: readonly T[],
  compare: (left: T, right: T) => number,
): void {
  for (let index = 1; index < values.length; index += 1) {
    if (compare(values[index - 1] as T, values[index] as T) >= 0) {
      throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
    }
  }
}

function requireNormalizedRelativePath(relativePath: string): void {
  const segments = relativePath.split("/");
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("/") ||
    /^[A-Za-z]:\//u.test(relativePath) ||
    relativePath.includes("\\") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
}

function requireCanonicalDate(value: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year === 0 || month < 1 || month > 12 || day < 1 || day > (daysInMonth[month - 1] ?? 0)) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
}

function requireCanonicalTimestamp(value: string): void {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/u.exec(value);
  if (match === null) {
    throw new FixtureConformanceError("FIXTURE_TEMPORAL_INVALID");
  }
  try {
    requireCanonicalDate(match[1] as string);
  } catch {
    throw new FixtureConformanceError("FIXTURE_TEMPORAL_INVALID");
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new FixtureConformanceError("FIXTURE_TEMPORAL_INVALID");
  }
}

function validateManifestIdentity(manifest: Readonly<Record<string, unknown>>): void {
  const datasetId = requireString(manifest, "datasetId");
  const datasetVersion = requireString(manifest, "datasetVersion");
  const datasetHash = requireString(manifest, "datasetHash");
  if (
    !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(datasetId) ||
    !/^\d{4}\.(0[1-9]|1[0-2])\.(0|[1-9]\d*)$/u.test(datasetVersion) ||
    !/^[0-9a-f]{64}$/u.test(datasetHash) ||
    manifest.schemaVersion !== "1.0.0" ||
    manifest.contractVersion !== "1.0.0-candidate.2" ||
    manifest.prototypeCandidate !== "v1.0.0-prototype.1" ||
    manifest.fixturePolicyId !== "fixture-policy-1"
  ) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
}

function parseDescriptors(value: unknown): readonly FileDescriptor[] {
  if (!Array.isArray(value)) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }

  return value.map((item) => {
    const descriptor = requireClosedRecord(item, descriptorFields);
    const byteLength = descriptor.byteLength;
    const recordCount = descriptor.recordCount;
    if (
      !Number.isSafeInteger(byteLength) ||
      (byteLength as number) < 0 ||
      !Number.isSafeInteger(recordCount) ||
      (recordCount as number) <= 0
    ) {
      throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
    }
    const relativePath = requireString(descriptor, "relativePath");
    const mediaType = requireString(descriptor, "mediaType");
    const digest = requireString(descriptor, "sha256");
    requireNormalizedRelativePath(relativePath);
    if (
      !/^[0-9a-f]{64}$/u.test(digest) ||
      (relativePath.startsWith("raw-sources/")
        ? mediaType !== "application/octet-stream" || recordCount !== 1
        : mediaType !== "application/x-ndjson")
    ) {
      throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
    }
    return {
      byteLength: byteLength as number,
      mediaType,
      recordCount: recordCount as number,
      relativePath,
      sha256: digest,
    };
  });
}

function validateObservationDescriptors(descriptors: readonly FileDescriptor[]): void {
  const observationPaths = descriptors
    .map(({ relativePath }) => relativePath)
    .filter((relativePath) => !relativePath.startsWith("raw-sources/"));
  const requiredObservationPaths = [
    "economic-vintages.jsonl",
    "market-observations.jsonl",
  ];
  if (canonicalizeJson(observationPaths) !== canonicalizeJson(requiredObservationPaths)) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
}

function validateCoverage(manifest: Readonly<Record<string, unknown>>): DeclaredCoverage {
  if (!Array.isArray(manifest.marketCoverage) || !Array.isArray(manifest.economicCoverage)) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }

  const marketInputs = new Set<string>();
  const marketIdentities = manifest.marketCoverage.map((item) => {
    const coverage = requireClosedRecord(item, marketCoverageFields);
    const adjustmentPolicy = requireString(coverage, "adjustmentPolicy");
    const instrumentId = requireString(coverage, "instrumentId");
    const dates = requireStringArray(coverage.requiredTradingDates);
    dates.forEach(requireCanonicalDate);
    requireStrictlySortedUnique(dates, compareUtf8);
    dates.forEach((tradingDate) => marketInputs.add(canonicalizeJson([
      instrumentId,
      adjustmentPolicy,
      tradingDate,
    ])));
    return [instrumentId, adjustmentPolicy] as const;
  });
  requireStrictlySortedUnique(marketIdentities, compareStringTuple);

  const economicInputs = new Set<string>();
  const economicIdentities = manifest.economicCoverage.map((item) => {
    const coverage = requireClosedRecord(item, economicCoverageFields);
    const providerId = requireString(coverage, "providerId");
    const seriesId = requireString(coverage, "seriesId");
    const dates = requireStringArray(coverage.observationDates);
    dates.forEach(requireCanonicalDate);
    requireStrictlySortedUnique(dates, compareUtf8);
    dates.forEach((observationDate) => economicInputs.add(canonicalizeJson([
      providerId,
      seriesId,
      observationDate,
    ])));
    return [providerId, seriesId] as const;
  });
  requireStrictlySortedUnique(economicIdentities, compareStringTuple);

  return { economicInputs, marketInputs };
}

function validateRecordProvenance(
  parsedFiles: readonly ParsedFixtureFile[],
  fileHashes: Readonly<Record<string, string>>,
): void {
  for (const { records } of parsedFiles) {
    for (const record of records) {
      const rawSourceHash = record.rawSourceHash;
      const rawSourceRef = record.rawSourceRef;
      const normalizationId = record.normalizationId;
      const ingestionJobId = record.ingestionJobId;
      if (
        typeof rawSourceHash !== "string" ||
        !/^[0-9a-f]{64}$/u.test(rawSourceHash) ||
        typeof rawSourceRef !== "string" ||
        rawSourceRef !== `raw-sources/${rawSourceHash}` ||
        fileHashes[rawSourceRef] !== rawSourceHash ||
        typeof normalizationId !== "string" ||
        normalizationId.length === 0 ||
        typeof ingestionJobId !== "string" ||
        ingestionJobId.length === 0
      ) {
        throw new FixtureConformanceError("FIXTURE_PROVENANCE_INVALID");
      }
    }
  }
}

function validateDeclaredCoverage(
  declaredCoverage: DeclaredCoverage,
  parsedFiles: readonly ParsedFixtureFile[],
): void {
  const marketFile = requireParsedFixtureFile(
    parsedFiles,
    "market-observations.jsonl",
  );
  for (const record of marketFile.records) {
    const inputKey = canonicalizeJson([
      requireString(record, "instrumentId"),
      requireString(record, "adjustmentPolicy"),
      requireString(record, "tradingDate"),
    ]);
    if (!declaredCoverage.marketInputs.has(inputKey)) {
      throw new FixtureConformanceError("FIXTURE_UNDECLARED_INPUT");
    }
  }

  const economicFile = requireParsedFixtureFile(
    parsedFiles,
    "economic-vintages.jsonl",
  );
  for (const record of economicFile.records) {
    const inputKey = canonicalizeJson([
      requireString(record, "providerId"),
      requireString(record, "seriesId"),
      requireString(record, "observationDate"),
    ]);
    if (!declaredCoverage.economicInputs.has(inputKey)) {
      throw new FixtureConformanceError("FIXTURE_UNDECLARED_INPUT");
    }
  }
}

function requireParsedFixtureFile(
  parsedFiles: readonly ParsedFixtureFile[],
  relativePath: string,
): ParsedFixtureFile {
  const parsedFile = parsedFiles.find(
    ({ descriptor }) => descriptor.relativePath === relativePath,
  );
  if (parsedFile === undefined) {
    throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
  }
  return parsedFile;
}

function validateObservationRecord(
  record: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): void {
  const expectedFields = new Set(fields);
  const actualFields = new Set(Object.keys(record));
  if (
    [...actualFields].some((field) => !expectedFields.has(field)) ||
    fields.some((field) => !provenanceFields.has(field) && !actualFields.has(field))
  ) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
  const qualityState = requireString(record, "qualityState");
  const qualityCodes = requireStringArray(record.qualityCodes);
  requireStrictlySortedUnique(qualityCodes, compareUtf8);
  if (
    !qualityStates.has(qualityState) ||
    (qualityState === "Valid") !== (qualityCodes.length === 0)
  ) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }
}

function validateClosedObservationRecords(
  parsedFiles: readonly ParsedFixtureFile[],
): void {
  const marketFile = requireParsedFixtureFile(
    parsedFiles,
    "market-observations.jsonl",
  );
  const economicFile = requireParsedFixtureFile(
    parsedFiles,
    "economic-vintages.jsonl",
  );
  marketFile.records.forEach((record) => {
    validateObservationRecord(record, marketObservationFields);
  });
  economicFile.records.forEach((record) => {
    validateObservationRecord(record, economicVintageFields);
  });
}

function validateDecimalValue(record: Readonly<Record<string, unknown>>): void {
  const numericScales = new Map([
    ["Money", 8],
    ["Quantity", 10],
    ["Rate", 12],
    ["UnitPrice", 10],
  ]);
  const numericClass = requireString(record, "numericClass");
  const scale = numericScales.get(numericClass);
  const value = requireString(record, "value");
  const decimal = /^(-?)(0|[1-9][0-9]*)\.([0-9]+)$/u.exec(value);
  if (scale === undefined || decimal === null) {
    throw new FixtureConformanceError("FIXTURE_DECIMAL_INVALID");
  }
  const sign = decimal[1] as string;
  const integer = decimal[2] as string;
  const fraction = decimal[3] as string;
  const integerDigits = integer === "0" ? 0 : integer.length;
  if (
    fraction.length !== scale ||
    integerDigits + fraction.length > 28 ||
    (sign === "-" && integer === "0" && /^0+$/u.test(fraction))
  ) {
    throw new FixtureConformanceError("FIXTURE_DECIMAL_INVALID");
  }
}

function validateObservationValues(parsedFiles: readonly ParsedFixtureFile[]): void {
  const marketFile = requireParsedFixtureFile(
    parsedFiles,
    "market-observations.jsonl",
  );
  const economicFile = requireParsedFixtureFile(
    parsedFiles,
    "economic-vintages.jsonl",
  );

  for (const record of marketFile.records) {
    requireCanonicalDate(requireString(record, "tradingDate"));
    requireCanonicalTimestamp(requireString(record, "sourceAvailableAt"));
    if (!/^(0|[1-9][0-9]*)$/u.test(requireString(record, "revision"))) {
      throw new FixtureConformanceError("FIXTURE_TEMPORAL_INVALID");
    }
  }
  for (const record of economicFile.records) {
    requireCanonicalDate(requireString(record, "observationDate"));
    requireCanonicalTimestamp(requireString(record, "releaseTimestamp"));
  }

  for (const record of [...marketFile.records, ...economicFile.records]) {
    validateDecimalValue(record);
  }
  for (const record of marketFile.records) {
    const numericClass = requireString(record, "numericClass");
    const currency = requireString(record, "currency");
    const requiresUsd = numericClass === "Money" || numericClass === "UnitPrice";
    if ((requiresUsd && currency !== "USD") || (!requiresUsd && currency !== "")) {
      throw new FixtureConformanceError("FIXTURE_DECIMAL_INVALID");
    }
  }
}

function validateMarketReplay(
  parsedFiles: readonly ParsedFixtureFile[],
): { readonly logicalCount: number; readonly replayCount: number } {
  const marketFile = requireParsedFixtureFile(
    parsedFiles,
    "market-observations.jsonl",
  );

  const businessPayloads = new Map<string, string>();
  let replayCount = 0;

  for (const record of marketFile.records) {
    const instrumentId = requireString(record, "instrumentId");
    const tradingDate = requireString(record, "tradingDate");
    const providerId = requireString(record, "providerId");
    const adjustmentPolicy = requireString(record, "adjustmentPolicy");
    const revision = requireString(record, "revision");
    const payload = canonicalizeJson(record);
    const businessKey = canonicalizeJson([
      instrumentId,
      tradingDate,
      providerId,
      adjustmentPolicy,
      revision,
    ]);
    const businessPayload = businessPayloads.get(businessKey);

    if (businessPayload !== undefined && businessPayload !== payload) {
      throw new FixtureConformanceError("FIXTURE_IDEMPOTENCY_CONFLICT");
    }
    if (businessPayload !== undefined) {
      replayCount += 1;
      continue;
    }

    businessPayloads.set(businessKey, payload);
  }

  return { logicalCount: businessPayloads.size, replayCount };
}

function validateEconomicReplay(
  parsedFiles: readonly ParsedFixtureFile[],
): { readonly logicalCount: number; readonly replayCount: number } {
  const economicFile = requireParsedFixtureFile(
    parsedFiles,
    "economic-vintages.jsonl",
  );

  const identityPayloads = new Map<string, string>();
  let replayCount = 0;

  for (const record of economicFile.records) {
    const providerId = requireString(record, "providerId");
    const seriesId = requireString(record, "seriesId");
    const observationDate = requireString(record, "observationDate");
    const releaseTimestamp = requireString(record, "releaseTimestamp");
    const vintageId = requireString(record, "vintageId");
    const payload = canonicalizeJson(record);
    const identityKey = canonicalizeJson([
      providerId,
      seriesId,
      observationDate,
      releaseTimestamp,
      vintageId,
    ]);
    const identityPayload = identityPayloads.get(identityKey);

    if (identityPayload !== undefined && identityPayload !== payload) {
      throw new FixtureConformanceError("FIXTURE_IDEMPOTENCY_CONFLICT");
    }
    if (identityPayload !== undefined) {
      replayCount += 1;
      continue;
    }

    identityPayloads.set(identityKey, payload);
  }

  const releaseVintageIds = new Map<string, string>();
  for (const record of economicFile.records) {
    const providerId = requireString(record, "providerId");
    const seriesId = requireString(record, "seriesId");
    const observationDate = requireString(record, "observationDate");
    const releaseTimestamp = requireString(record, "releaseTimestamp");
    const vintageId = requireString(record, "vintageId");
    const releaseKey = canonicalizeJson([
      providerId,
      seriesId,
      observationDate,
      releaseTimestamp,
    ]);
    const releaseVintageId = releaseVintageIds.get(releaseKey);
    if (releaseVintageId !== undefined && releaseVintageId !== vintageId) {
      throw new FixtureConformanceError("FIXTURE_TEMPORAL_INVALID");
    }
    releaseVintageIds.set(releaseKey, vintageId);
  }

  return { logicalCount: identityPayloads.size, replayCount };
}

function validateFixturePackageContents(
  fixturePackage: FixturePackageBytes,
): {
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly parsedFiles: readonly ParsedFixtureFile[];
  readonly result: ValidatedFixturePackage;
} {
  const manifest = parseManifest(fixturePackage.manifest);
  requireClosedRecord(manifest, manifestFields);
  validateManifestIdentity(manifest);
  const descriptors = parseDescriptors(manifest.files);
  validateObservationDescriptors(descriptors);
  const expectedPaths = descriptors.map(({ relativePath }) => relativePath);
  requireStrictlySortedUnique(expectedPaths, compareUtf8);
  const declaredCoverage = validateCoverage(manifest);
  const actualPaths = Object.keys(fixturePackage.files).sort(compareUtf8);

  if (
    canonicalizeJson([...expectedPaths].sort(compareUtf8)) !== canonicalizeJson(actualPaths)
  ) {
    throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
  }

  const fileHashes: Record<string, string> = {};
  const parsedFiles: ParsedFixtureFile[] = [];
  for (const descriptor of descriptors) {
    const bytes = fixturePackage.files[descriptor.relativePath];
    if (bytes === undefined) {
      throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
    }
    const contentHash = sha256(bytes);
    if (bytes.byteLength !== descriptor.byteLength || contentHash !== descriptor.sha256) {
      throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
    }
    if (
      descriptor.relativePath.startsWith("raw-sources/") &&
      descriptor.relativePath !== `raw-sources/${contentHash}`
    ) {
      throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
    }
    if (!descriptor.relativePath.startsWith("raw-sources/")) {
      const records = parseJsonLines(bytes);
      if (records.length !== descriptor.recordCount) {
        throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
      }
      parsedFiles.push({ descriptor, records });
    }
    fileHashes[descriptor.relativePath] = contentHash;
  }

  validateClosedObservationRecords(parsedFiles);

  const datasetHash = requireString(manifest, "datasetHash");
  const { datasetHash: ignoredDatasetHash, ...hashMembers } = manifest;
  void ignoredDatasetHash;
  const computedDatasetHash = sha256(
    canonicalizeJson({ ...hashMembers, domain: "etf.fixture.dataset.v1" }),
  );
  if (computedDatasetHash !== datasetHash) {
    throw new FixtureConformanceError("FIXTURE_DATASET_HASH_MISMATCH");
  }

  const datasetId = requireString(manifest, "datasetId");
  const datasetVersion = requireString(manifest, "datasetVersion");
  const approvedDatasetHash = approvedDatasetHashes.get(
    `${datasetId}\u0000${datasetVersion}`,
  );
  if (approvedDatasetHash !== undefined && approvedDatasetHash !== datasetHash) {
    throw new FixtureConformanceError("FIXTURE_IDEMPOTENCY_CONFLICT");
  }

  const marketReplay = validateMarketReplay(parsedFiles);
  const economicReplay = validateEconomicReplay(parsedFiles);
  validateObservationValues(parsedFiles);
  validateRecordProvenance(parsedFiles, fileHashes);
  validateDeclaredCoverage(declaredCoverage, parsedFiles);

  return {
    manifest,
    parsedFiles,
    result: {
      datasetHash,
      datasetId,
      datasetVersion,
      economicIdempotentReplayCount: economicReplay.replayCount,
      economicVintageCount: economicReplay.logicalCount,
      fileHashes,
      marketIdempotentReplayCount: marketReplay.replayCount,
      marketObservationCount: marketReplay.logicalCount,
    },
  };
}

export function validateFixturePackage(
  fixturePackage: FixturePackageBytes,
): ValidatedFixturePackage {
  try {
    return validateFixturePackageContents(fixturePackage).result;
  } catch (error) {
    throwWithFixtureDiagnostics(error, fixturePackage);
  }
}

function validateRequiredSelection(
  manifest: Readonly<Record<string, unknown>>,
  marketObservations: readonly Readonly<Record<string, unknown>>[],
  economicVintages: readonly Readonly<Record<string, unknown>>[],
): void {
  if (!Array.isArray(manifest.marketCoverage) || !Array.isArray(manifest.economicCoverage)) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }

  let missing = false;
  const selectedQualityStates = new Set<string>();
  const recordQualityState = (record: Readonly<Record<string, unknown>>): string => {
    const qualityState = requireString(record, "qualityState");
    if (!qualityStates.has(qualityState)) {
      throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
    }
    return qualityState;
  };

  for (const item of manifest.marketCoverage) {
    const coverage = requireClosedRecord(item, marketCoverageFields);
    const instrumentId = requireString(coverage, "instrumentId");
    const adjustmentPolicy = requireString(coverage, "adjustmentPolicy");
    for (const tradingDate of requireStringArray(coverage.requiredTradingDates)) {
      const selected = marketObservations.find((record) =>
        record.instrumentId === instrumentId &&
        record.adjustmentPolicy === adjustmentPolicy &&
        record.tradingDate === tradingDate
      );
      if (selected === undefined) {
        missing = true;
      } else {
        selectedQualityStates.add(recordQualityState(selected));
      }
    }
  }

  for (const item of manifest.economicCoverage) {
    const coverage = requireClosedRecord(item, economicCoverageFields);
    const providerId = requireString(coverage, "providerId");
    const seriesId = requireString(coverage, "seriesId");
    for (const observationDate of requireStringArray(coverage.observationDates)) {
      const selected = economicVintages.find((record) =>
        record.providerId === providerId &&
        record.seriesId === seriesId &&
        record.observationDate === observationDate
      );
      if (selected === undefined) {
        missing = true;
      } else {
        selectedQualityStates.add(recordQualityState(selected));
      }
    }
  }

  if (missing) {
    throw new FixtureConformanceError("FIXTURE_REQUIRED_MISSING");
  }
  for (const [qualityState, code] of [
    ["Partial", "FIXTURE_REQUIRED_PARTIAL"],
    ["Stale", "FIXTURE_REQUIRED_STALE"],
    ["Quarantined", "FIXTURE_REQUIRED_QUARANTINED"],
  ] as const) {
    if (selectedQualityStates.has(qualityState)) {
      throw new FixtureConformanceError(code);
    }
  }
}

function diagnosticRawValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return canonicalizeJson(value);
  } catch {
    return String(value);
  }
}

function diagnosticComponent(
  value: unknown,
  isValid: (candidate: string) => boolean = () => true,
): FixtureIdentityComponent {
  if (value === undefined) {
    return { state: "absent" };
  }
  if (typeof value === "string" && isValid(value)) {
    return { state: "valid", value };
  }
  return { raw: diagnosticRawValue(value), state: "invalid" };
}

function isCanonicalDate(value: string): boolean {
  try {
    requireCanonicalDate(value);
    return true;
  } catch {
    return false;
  }
}

function isCanonicalTimestamp(value: string): boolean {
  try {
    requireCanonicalTimestamp(value);
    return true;
  } catch {
    return false;
  }
}

function diagnosticRecordComponent(
  recordType: FixtureConformanceIssue["recordType"],
  record: Readonly<Record<string, unknown>>,
  field: string,
): FixtureIdentityComponent {
  const validators: Readonly<Record<string, (value: string) => boolean>> = {
    adjustmentPolicy: (value) => [
      "unadjusted",
      "split-adjusted",
      "total-return-adjusted",
    ].includes(value),
    instrumentId: (value) => /^[A-Z0-9][A-Z0-9._-]{0,63}$/u.test(value),
    observationDate: isCanonicalDate,
    providerId: (value) => recordType === "market"
      ? value === "fixture"
      : ["FRED", "ALFRED", "BLS", "BEA", "TREASURY_FISCAL_DATA"].includes(value),
    releaseTimestamp: isCanonicalTimestamp,
    revision: (value) => /^(0|[1-9][0-9]*)$/u.test(value),
    seriesId: (value) => /^[\x20-\x7E]{1,128}$/u.test(value),
    tradingDate: isCanonicalDate,
    vintageId: (value) => /^[\x20-\x7E]{1,128}$/u.test(value),
  };
  return diagnosticComponent(record[field], validators[field]);
}

function recordBusinessIdentity(
  recordType: FixtureConformanceIssue["recordType"],
  record?: Readonly<Record<string, unknown>>,
): readonly FixtureIdentityComponent[] {
  if (record === undefined) {
    return [];
  }
  const fields = recordType === "market"
    ? ["instrumentId", "tradingDate", "providerId", "adjustmentPolicy", "revision"]
    : recordType === "economic"
    ? ["providerId", "seriesId", "observationDate", "releaseTimestamp", "vintageId"]
    : [];
  return fields.map((field) => diagnosticRecordComponent(recordType, record, field));
}

function createFixtureIssue(
  code: FixtureConformanceCode,
  manifest?: Readonly<Record<string, unknown>>,
  relativePath?: string,
  recordType: FixtureConformanceIssue["recordType"] = "",
  record?: Readonly<Record<string, unknown>>,
): FixtureConformanceIssue {
  return {
    businessIdentity: recordBusinessIdentity(recordType, record),
    code,
    datasetIdentity: [
      diagnosticComponent(
        manifest?.datasetId,
        (value) => /^[a-z0-9][a-z0-9-]{0,63}$/u.test(value),
      ),
      diagnosticComponent(
        manifest?.datasetVersion,
        (value) => /^\d{4}\.(0[1-9]|1[0-2])\.(0|[1-9]\d*)$/u.test(value),
      ),
    ],
    recordType,
    relativePath: diagnosticComponent(relativePath, (value) => {
      try {
        requireNormalizedRelativePath(value);
        return true;
      } catch {
        return false;
      }
    }),
  };
}

function encodedComponent(component: FixtureIdentityComponent): Buffer {
  if (component.state === "absent") {
    return Buffer.from([0]);
  }
  const value = component.state === "valid" ? component.value : component.raw;
  const bytes = Buffer.from(value, "utf8");
  if (component.state === "invalid") {
    return Buffer.concat([
      Buffer.from([1]),
      Buffer.from(`${bytes.byteLength}:`, "utf8"),
      bytes,
    ]);
  }
  return Buffer.concat([Buffer.from([2]), bytes]);
}

function compareComponents(
  left: readonly FixtureIdentityComponent[],
  right: readonly FixtureIdentityComponent[],
): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const comparison = Buffer.compare(
      encodedComponent(left[index] ?? { state: "absent" }),
      encodedComponent(right[index] ?? { state: "absent" }),
    );
    if (comparison !== 0) {
      return comparison;
    }
  }
  return 0;
}

function compareFixtureIssues(
  left: FixtureConformanceIssue,
  right: FixtureConformanceIssue,
): number {
  const codeComparison = fixtureCodePrecedence.indexOf(left.code) -
    fixtureCodePrecedence.indexOf(right.code);
  if (codeComparison !== 0) {
    return codeComparison;
  }
  const datasetComparison = compareComponents(left.datasetIdentity, right.datasetIdentity);
  if (datasetComparison !== 0) {
    return datasetComparison;
  }
  const pathComparison = compareComponents([left.relativePath], [right.relativePath]);
  if (pathComparison !== 0) {
    return pathComparison;
  }
  const recordTypeOrder = { "": -1, market: 0, economic: 1 } as const;
  const recordTypeComparison = recordTypeOrder[left.recordType] - recordTypeOrder[right.recordType];
  return recordTypeComparison || compareComponents(left.businessIdentity, right.businessIdentity);
}

function collectFixtureDiagnostics(
  fixturePackage: FixturePackageBytes,
  evaluationInstant?: string,
): readonly FixtureConformanceIssue[] {
  const issues: FixtureConformanceIssue[] = [];
  let manifest: Readonly<Record<string, unknown>>;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
      .decode(fixturePackage.manifest);
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("invalid manifest root");
    }
    manifest = parsed as Readonly<Record<string, unknown>>;
  } catch {
    return [createFixtureIssue("FIXTURE_MANIFEST_INVALID")];
  }

  let descriptors: readonly FileDescriptor[] = [];
  let declaredCoverage: DeclaredCoverage | undefined;
  try {
    const canonicalManifest = parseManifest(fixturePackage.manifest);
    requireClosedRecord(canonicalManifest, manifestFields);
    validateManifestIdentity(canonicalManifest);
    descriptors = parseDescriptors(canonicalManifest.files);
    validateObservationDescriptors(descriptors);
    requireStrictlySortedUnique(
      descriptors.map(({ relativePath }) => relativePath),
      compareUtf8,
    );
    declaredCoverage = validateCoverage(canonicalManifest);
  } catch {
    issues.push(createFixtureIssue("FIXTURE_MANIFEST_INVALID", manifest));
    try {
      descriptors = parseDescriptors(manifest.files);
    } catch {
      descriptors = [];
    }
    try {
      declaredCoverage = validateCoverage(manifest);
    } catch {
      declaredCoverage = undefined;
    }
  }

  const actualPaths = Object.keys(fixturePackage.files).sort(compareUtf8);
  const expectedPaths = descriptors.map(({ relativePath }) => relativePath).sort(compareUtf8);
  if (canonicalizeJson(expectedPaths) !== canonicalizeJson(actualPaths)) {
    issues.push(createFixtureIssue("FIXTURE_FILE_INTEGRITY_FAILED", manifest));
  }

  const fileHashes: Record<string, string> = {};
  for (const [relativePath, bytes] of Object.entries(fixturePackage.files)) {
    fileHashes[relativePath] = sha256(bytes);
  }
  for (const descriptor of descriptors) {
    const bytes = fixturePackage.files[descriptor.relativePath];
    const contentHash = bytes === undefined ? undefined : sha256(bytes);
    if (
      bytes === undefined ||
      bytes.byteLength !== descriptor.byteLength ||
      contentHash !== descriptor.sha256 ||
      (descriptor.relativePath.startsWith("raw-sources/") &&
        descriptor.relativePath !== `raw-sources/${contentHash}`)
    ) {
      issues.push(createFixtureIssue(
        "FIXTURE_FILE_INTEGRITY_FAILED",
        manifest,
        descriptor.relativePath,
      ));
    }
  }

  const parsedFiles: ParsedFixtureFile[] = [];
  for (const [relativePath, recordType] of [
    ["market-observations.jsonl", "market"],
    ["economic-vintages.jsonl", "economic"],
  ] as const) {
    const bytes = fixturePackage.files[relativePath];
    const descriptor = descriptors.find((item) => item.relativePath === relativePath);
    if (bytes === undefined || descriptor === undefined) {
      continue;
    }
    try {
      const records = parseJsonLines(bytes);
      if (records.length !== descriptor.recordCount) {
        issues.push(createFixtureIssue(
          "FIXTURE_FILE_INTEGRITY_FAILED",
          manifest,
          relativePath,
        ));
      }
      parsedFiles.push({ descriptor, records });
    } catch {
      issues.push(createFixtureIssue("FIXTURE_MANIFEST_INVALID", manifest, relativePath, recordType));
    }
  }

  if (typeof manifest.datasetHash === "string") {
    const { datasetHash: ignoredDatasetHash, ...hashMembers } = manifest;
    void ignoredDatasetHash;
    if (sha256(canonicalizeJson({ ...hashMembers, domain: "etf.fixture.dataset.v1" })) !== manifest.datasetHash) {
      issues.push(createFixtureIssue("FIXTURE_DATASET_HASH_MISMATCH", manifest));
    }
  }

  if (
    typeof manifest.datasetId === "string" &&
    typeof manifest.datasetVersion === "string" &&
    typeof manifest.datasetHash === "string"
  ) {
    const approvedDatasetHash = approvedDatasetHashes.get(
      `${manifest.datasetId}\u0000${manifest.datasetVersion}`,
    );
    if (approvedDatasetHash !== undefined && approvedDatasetHash !== manifest.datasetHash) {
      issues.push(createFixtureIssue("FIXTURE_IDEMPOTENCY_CONFLICT", manifest));
    }
  }

  if (parsedFiles.length === 2) {
    for (const validateReplay of [validateMarketReplay, validateEconomicReplay]) {
      try {
        validateReplay(parsedFiles);
      } catch (error) {
        if (error instanceof FixtureConformanceError) {
          issues.push(createFixtureIssue(error.code, manifest));
        }
      }
    }
  }

  for (const [recordType, relativePath] of [
    ["market", "market-observations.jsonl"],
    ["economic", "economic-vintages.jsonl"],
  ] as const) {
    const records = parsedFiles.find(({ descriptor }) => descriptor.relativePath === relativePath)?.records ?? [];
    for (const record of records) {
      try {
        validateObservationRecord(
          record,
          recordType === "market" ? marketObservationFields : economicVintageFields,
        );
      } catch {
        issues.push(createFixtureIssue(
          "FIXTURE_MANIFEST_INVALID",
          manifest,
          relativePath,
          recordType,
          record,
        ));
      }

      let temporalInvalid = false;
      try {
        if (recordType === "market") {
          requireCanonicalDate(requireString(record, "tradingDate"));
          requireCanonicalTimestamp(requireString(record, "sourceAvailableAt"));
          temporalInvalid = !/^(0|[1-9][0-9]*)$/u.test(requireString(record, "revision"));
        } else {
          requireCanonicalDate(requireString(record, "observationDate"));
          requireCanonicalTimestamp(requireString(record, "releaseTimestamp"));
        }
      } catch {
        temporalInvalid = true;
      }
      if (temporalInvalid) {
        issues.push(createFixtureIssue(
          "FIXTURE_TEMPORAL_INVALID",
          manifest,
          relativePath,
          recordType,
          record,
        ));
      }

      try {
        validateDecimalValue(record);
        if (recordType === "market") {
          const numericClass = requireString(record, "numericClass");
          const currency = requireString(record, "currency");
          const requiresUsd = numericClass === "Money" || numericClass === "UnitPrice";
          if ((requiresUsd && currency !== "USD") || (!requiresUsd && currency !== "")) {
            throw new FixtureConformanceError("FIXTURE_DECIMAL_INVALID");
          }
        }
      } catch {
        issues.push(createFixtureIssue(
          "FIXTURE_DECIMAL_INVALID",
          manifest,
          relativePath,
          recordType,
          record,
        ));
      }

      const rawSourceHash = record.rawSourceHash;
      const rawSourceRef = record.rawSourceRef;
      if (
        typeof rawSourceHash !== "string" ||
        !/^[0-9a-f]{64}$/u.test(rawSourceHash) ||
        typeof rawSourceRef !== "string" ||
        rawSourceRef !== `raw-sources/${rawSourceHash}` ||
        fileHashes[rawSourceRef] !== rawSourceHash ||
        typeof record.normalizationId !== "string" ||
        record.normalizationId.length === 0 ||
        typeof record.ingestionJobId !== "string" ||
        record.ingestionJobId.length === 0
      ) {
        issues.push(createFixtureIssue(
          "FIXTURE_PROVENANCE_INVALID",
          manifest,
          relativePath,
          recordType,
          record,
        ));
      }

      if (declaredCoverage !== undefined) {
        const values = recordType === "market"
          ? [record.instrumentId, record.adjustmentPolicy, record.tradingDate]
          : [record.providerId, record.seriesId, record.observationDate];
        if (
          values.every((value) => typeof value === "string") &&
          !(recordType === "market" ? declaredCoverage.marketInputs : declaredCoverage.economicInputs)
            .has(canonicalizeJson(values))
        ) {
          issues.push(createFixtureIssue(
            "FIXTURE_UNDECLARED_INPUT",
            manifest,
            relativePath,
            recordType,
            record,
          ));
        }
      }
    }
  }

  let validEvaluationInstant: string | undefined;
  if (evaluationInstant !== undefined) {
    try {
      requireCanonicalTimestamp(evaluationInstant);
      validEvaluationInstant = evaluationInstant;
    } catch {
      issues.push(createFixtureIssue("FIXTURE_TEMPORAL_INVALID", manifest));
    }
  }

  if (validEvaluationInstant !== undefined && declaredCoverage !== undefined) {
    const marketRecords = parsedFiles.find(
      ({ descriptor }) => descriptor.relativePath === "market-observations.jsonl",
    )?.records ?? [];
    const economicRecords = parsedFiles.find(
      ({ descriptor }) => descriptor.relativePath === "economic-vintages.jsonl",
    )?.records ?? [];
    const selectedMarket = new Map<string, Readonly<Record<string, unknown>>>();
    for (const record of marketRecords) {
      if (
        typeof record.instrumentId !== "string" ||
        typeof record.tradingDate !== "string" ||
        typeof record.providerId !== "string" ||
        typeof record.adjustmentPolicy !== "string" ||
        typeof record.revision !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(record.revision) ||
        typeof record.sourceAvailableAt !== "string" ||
        record.sourceAvailableAt > validEvaluationInstant
      ) {
        continue;
      }
      const key = canonicalizeJson([
        record.instrumentId,
        record.adjustmentPolicy,
        record.tradingDate,
      ]);
      const selected = selectedMarket.get(key);
      if (
        selected === undefined ||
        BigInt(record.revision) > BigInt(requireString(selected, "revision"))
      ) {
        selectedMarket.set(key, record);
      }
    }
    const selectedEconomic = new Map<string, Readonly<Record<string, unknown>>>();
    for (const record of economicRecords) {
      if (
        typeof record.providerId !== "string" ||
        typeof record.seriesId !== "string" ||
        typeof record.observationDate !== "string" ||
        typeof record.releaseTimestamp !== "string" ||
        record.releaseTimestamp > validEvaluationInstant
      ) {
        continue;
      }
      const key = canonicalizeJson([record.providerId, record.seriesId, record.observationDate]);
      const selected = selectedEconomic.get(key);
      if (
        selected === undefined ||
        record.releaseTimestamp > requireString(selected, "releaseTimestamp")
      ) {
        selectedEconomic.set(key, record);
      }
    }
    for (const [recordType, relativePath, declaredInputs, selectedRecords] of [
      ["market", "market-observations.jsonl", declaredCoverage.marketInputs, selectedMarket],
      ["economic", "economic-vintages.jsonl", declaredCoverage.economicInputs, selectedEconomic],
    ] as const) {
      for (const declaredInput of declaredInputs) {
        const record = selectedRecords.get(declaredInput);
        if (record === undefined) {
          const identity = JSON.parse(declaredInput) as string[];
          const syntheticRecord = recordType === "market"
            ? {
                adjustmentPolicy: identity[1],
                instrumentId: identity[0],
                tradingDate: identity[2],
              }
            : {
                observationDate: identity[2],
                providerId: identity[0],
                seriesId: identity[1],
              };
          issues.push(createFixtureIssue(
            "FIXTURE_REQUIRED_MISSING",
            manifest,
            relativePath,
            recordType,
            syntheticRecord,
          ));
          continue;
        }
        const qualityState = record.qualityState;
        const code = qualityState === "Partial"
          ? "FIXTURE_REQUIRED_PARTIAL"
          : qualityState === "Stale"
          ? "FIXTURE_REQUIRED_STALE"
          : qualityState === "Quarantined"
          ? "FIXTURE_REQUIRED_QUARANTINED"
          : undefined;
        if (code !== undefined) {
          issues.push(createFixtureIssue(
            code,
            manifest,
            relativePath,
            recordType,
            record,
          ));
        }
      }
    }
  }

  return issues.sort(compareFixtureIssues);
}

function throwWithFixtureDiagnostics(
  error: unknown,
  fixturePackage: FixturePackageBytes,
  evaluationInstant?: string,
): never {
  if (!(error instanceof FixtureConformanceError)) {
    throw error;
  }
  let issues: FixtureConformanceIssue[];
  try {
    issues = [...collectFixtureDiagnostics(fixturePackage, evaluationInstant)];
  } catch {
    issues = [];
  }
  if (!issues.some(({ code }) => code === error.code)) {
    issues.push(createFixtureIssue(error.code));
    issues.sort(compareFixtureIssues);
  }
  throw new FixtureConformanceError(error.code, issues);
}

function selectFixturePackageAtContents(
  fixturePackage: FixturePackageBytes,
  evaluationInstant: string,
): FixturePackageSelection {
  const { manifest, parsedFiles } = validateFixturePackageContents(fixturePackage);
  requireCanonicalTimestamp(evaluationInstant);
  const marketFile = requireParsedFixtureFile(
    parsedFiles,
    "market-observations.jsonl",
  );
  const economicFile = requireParsedFixtureFile(
    parsedFiles,
    "economic-vintages.jsonl",
  );

  const selectedMarket = new Map<string, Readonly<Record<string, unknown>>>();
  for (const record of marketFile.records) {
    const sourceAvailableAt = requireString(record, "sourceAvailableAt");
    if (sourceAvailableAt > evaluationInstant) {
      continue;
    }
    const selectionKey = canonicalizeJson([
      requireString(record, "instrumentId"),
      requireString(record, "tradingDate"),
      requireString(record, "providerId"),
      requireString(record, "adjustmentPolicy"),
    ]);
    const selected = selectedMarket.get(selectionKey);
    if (
      selected === undefined ||
      BigInt(requireString(record, "revision")) > BigInt(requireString(selected, "revision"))
    ) {
      selectedMarket.set(selectionKey, record);
    }
  }

  const selectedEconomic = new Map<string, Readonly<Record<string, unknown>>>();
  for (const record of economicFile.records) {
    const releaseTimestamp = requireString(record, "releaseTimestamp");
    if (releaseTimestamp > evaluationInstant) {
      continue;
    }
    const selectionKey = canonicalizeJson([
      requireString(record, "providerId"),
      requireString(record, "seriesId"),
      requireString(record, "observationDate"),
    ]);
    const selected = selectedEconomic.get(selectionKey);
    if (
      selected === undefined ||
      releaseTimestamp > requireString(selected, "releaseTimestamp")
    ) {
      selectedEconomic.set(selectionKey, record);
    }
  }

  const economicVintages = [...selectedEconomic.values()].sort((left, right) =>
    compareRecordFields(left, right, ["providerId", "seriesId", "observationDate"]),
  );
  const marketObservations = [...selectedMarket.values()].sort((left, right) =>
    compareRecordFields(left, right, [
      "instrumentId",
      "tradingDate",
      "providerId",
      "adjustmentPolicy",
    ]),
  );
  validateRequiredSelection(manifest, marketObservations, economicVintages);
  return {
    economicVintages,
    marketObservations,
  };
}

export function selectFixturePackageAt(
  fixturePackage: FixturePackageBytes,
  evaluationInstant: string,
): FixturePackageSelection {
  try {
    return selectFixturePackageAtContents(fixturePackage, evaluationInstant);
  } catch (error) {
    throwWithFixtureDiagnostics(error, fixturePackage, evaluationInstant);
  }
}
