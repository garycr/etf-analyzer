import { createHash } from "node:crypto";

import { canonicalizeJson } from "../Infrastructure/CanonicalJson/canonical-json.js";

export type FixtureConformanceCode =
  | "FIXTURE_DATASET_HASH_MISMATCH"
  | "FIXTURE_FILE_INTEGRITY_FAILED"
  | "FIXTURE_IDEMPOTENCY_CONFLICT"
  | "FIXTURE_MANIFEST_INVALID"
  | "FIXTURE_PROVENANCE_INVALID"
  | "FIXTURE_TEMPORAL_INVALID";

const approvedDatasetHashes = new Map<string, string>([
  [
    "etf-prototype-core\u00002026.01.0",
    "5c68a8c394aecb6e27833f4216bfcd5f5c724e3aff6cfad7980192ec8d1e0b68",
  ],
]);

export class FixtureConformanceError extends Error {
  public readonly code: FixtureConformanceCode;

  public constructor(code: FixtureConformanceCode) {
    super(code);
    this.name = "FixtureConformanceError";
    this.code = code;
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

function validateCoverage(manifest: Readonly<Record<string, unknown>>): void {
  if (!Array.isArray(manifest.marketCoverage) || !Array.isArray(manifest.economicCoverage)) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }

  const marketIdentities = manifest.marketCoverage.map((item) => {
    const coverage = requireClosedRecord(item, marketCoverageFields);
    const adjustmentPolicy = requireString(coverage, "adjustmentPolicy");
    const instrumentId = requireString(coverage, "instrumentId");
    const dates = requireStringArray(coverage.requiredTradingDates);
    dates.forEach(requireCanonicalDate);
    requireStrictlySortedUnique(dates, compareUtf8);
    return [instrumentId, adjustmentPolicy] as const;
  });
  requireStrictlySortedUnique(marketIdentities, compareStringTuple);

  const economicIdentities = manifest.economicCoverage.map((item) => {
    const coverage = requireClosedRecord(item, economicCoverageFields);
    const providerId = requireString(coverage, "providerId");
    const seriesId = requireString(coverage, "seriesId");
    const dates = requireStringArray(coverage.observationDates);
    dates.forEach(requireCanonicalDate);
    requireStrictlySortedUnique(dates, compareUtf8);
    return [providerId, seriesId] as const;
  });
  requireStrictlySortedUnique(economicIdentities, compareStringTuple);
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

function validateMarketReplay(
  parsedFiles: readonly ParsedFixtureFile[],
): { readonly logicalCount: number; readonly replayCount: number } {
  const marketFile = parsedFiles.find(
    ({ descriptor }) => descriptor.relativePath === "market-observations.jsonl",
  );
  if (marketFile === undefined) {
    throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
  }

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
  const economicFile = parsedFiles.find(
    ({ descriptor }) => descriptor.relativePath === "economic-vintages.jsonl",
  );
  if (economicFile === undefined) {
    throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
  }

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

export function validateFixturePackage(
  fixturePackage: FixturePackageBytes,
): ValidatedFixturePackage {
  const manifest = parseManifest(fixturePackage.manifest);
  requireClosedRecord(manifest, manifestFields);
  validateManifestIdentity(manifest);
  const descriptors = parseDescriptors(manifest.files);
  validateObservationDescriptors(descriptors);
  const expectedPaths = descriptors.map(({ relativePath }) => relativePath);
  requireStrictlySortedUnique(expectedPaths, compareUtf8);
  validateCoverage(manifest);
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
  validateRecordProvenance(parsedFiles, fileHashes);

  return {
    datasetHash,
    datasetId,
    datasetVersion,
    economicIdempotentReplayCount: economicReplay.replayCount,
    economicVintageCount: economicReplay.logicalCount,
    fileHashes,
    marketIdempotentReplayCount: marketReplay.replayCount,
    marketObservationCount: marketReplay.logicalCount,
  };
}
