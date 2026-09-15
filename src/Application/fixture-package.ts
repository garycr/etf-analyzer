import { createHash } from "node:crypto";

import { canonicalizeJson } from "../Infrastructure/CanonicalJson/canonical-json.js";

export type FixtureConformanceCode =
  | "FIXTURE_DATASET_HASH_MISMATCH"
  | "FIXTURE_FILE_INTEGRITY_FAILED"
  | "FIXTURE_IDEMPOTENCY_CONFLICT"
  | "FIXTURE_MANIFEST_INVALID";

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
  readonly fileHashes: Readonly<Record<string, string>>;
}

interface FileDescriptor {
  readonly byteLength: number;
  readonly relativePath: string;
  readonly sha256: string;
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseManifest(bytes: Uint8Array): Record<string, unknown> {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
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

function parseDescriptors(value: unknown): readonly FileDescriptor[] {
  if (!Array.isArray(value)) {
    throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
  }

  return value.map((item) => {
    if (item === null || Array.isArray(item) || typeof item !== "object") {
      throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
    }
    const descriptor = item as Record<string, unknown>;
    const byteLength = descriptor.byteLength;
    if (!Number.isSafeInteger(byteLength) || (byteLength as number) < 0) {
      throw new FixtureConformanceError("FIXTURE_MANIFEST_INVALID");
    }
    return {
      byteLength: byteLength as number,
      relativePath: requireString(descriptor, "relativePath"),
      sha256: requireString(descriptor, "sha256"),
    };
  });
}

export function validateFixturePackage(
  fixturePackage: FixturePackageBytes,
): ValidatedFixturePackage {
  const manifest = parseManifest(fixturePackage.manifest);
  const descriptors = parseDescriptors(manifest.files);
  const expectedPaths = descriptors.map(({ relativePath }) => relativePath);
  const actualPaths = Object.keys(fixturePackage.files).sort();

  if (
    new Set(expectedPaths).size !== expectedPaths.length ||
    canonicalizeJson([...expectedPaths].sort()) !== canonicalizeJson(actualPaths)
  ) {
    throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
  }

  const fileHashes: Record<string, string> = {};
  for (const descriptor of descriptors) {
    const bytes = fixturePackage.files[descriptor.relativePath];
    if (bytes === undefined) {
      throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
    }
    const contentHash = sha256(bytes);
    if (bytes.byteLength !== descriptor.byteLength || contentHash !== descriptor.sha256) {
      throw new FixtureConformanceError("FIXTURE_FILE_INTEGRITY_FAILED");
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

  return {
    datasetHash,
    datasetId,
    datasetVersion,
    fileHashes,
  };
}
