import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import {
  selectFixturePackageAt,
  validateFixturePackage,
  type FixturePackageBytes,
} from "../../Application/fixture-package.js";
import type {
  ApprovedAnalyticsArtifact,
  WorkflowArtifactResolver,
} from "../PostgreSQL/workflow-owner.js";

export interface LocalArtifactConfig {
  readonly artifactRoot: string;
  readonly fixturePackageDirectory: string;
  readonly fixtureEvaluationAt: string;
  readonly analyticsArtifactPath: string;
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
  return value as Record<string, unknown>;
}

function requireRelativePath(value: string): string {
  if (
    value.length === 0 ||
    path.isAbsolute(value) ||
    value.includes("\\") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
  return value;
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function resolveReviewedPath(root: string, relativePath: string): Promise<string> {
  const lexicalPath = path.resolve(root, requireRelativePath(relativePath));
  if (!isWithin(root, lexicalPath)) throw new Error("APPLICATION_CONFIGURATION_INVALID");
  const canonicalPath = await realpath(lexicalPath);
  if (!isWithin(root, canonicalPath)) throw new Error("APPLICATION_CONFIGURATION_INVALID");
  return canonicalPath;
}

function requireAnalyticsArtifact(value: unknown): ApprovedAnalyticsArtifact {
  const artifact = requireRecord(value);
  if (
    Object.keys(artifact).sort().join("\u0000") !==
      ["configurationHash", "databasePayload", "inputEvidenceIds"].sort().join("\u0000") ||
    typeof artifact.configurationHash !== "string" ||
    !Array.isArray(artifact.inputEvidenceIds) ||
    artifact.inputEvidenceIds.some((item) => typeof item !== "string")
  ) {
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
  return Object.freeze({
    configurationHash: artifact.configurationHash,
    inputEvidenceIds: Object.freeze([...artifact.inputEvidenceIds] as string[]),
    databasePayload: Object.freeze({ ...requireRecord(artifact.databasePayload) }),
  });
}

export async function loadLocalArtifactResolver(
  config: LocalArtifactConfig,
): Promise<WorkflowArtifactResolver> {
  const root = await realpath(config.artifactRoot);
  const packageDirectory = await resolveReviewedPath(root, config.fixturePackageDirectory);
  const manifestPath = await resolveReviewedPath(packageDirectory, "manifest.json");
  const manifest = await readFile(manifestPath);
  let manifestValue: Record<string, unknown>;
  try {
    manifestValue = requireRecord(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifest)));
  } catch {
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }
  if (!Array.isArray(manifestValue.files)) throw new Error("APPLICATION_CONFIGURATION_INVALID");
  const packageFiles: Record<string, Uint8Array> = {};
  for (const descriptorValue of manifestValue.files) {
    const descriptor = requireRecord(descriptorValue);
    if (typeof descriptor.relativePath !== "string") throw new Error("APPLICATION_CONFIGURATION_INVALID");
    const relativePath = requireRelativePath(descriptor.relativePath);
    packageFiles[relativePath] = await readFile(await resolveReviewedPath(packageDirectory, relativePath));
  }
  const fixturePackage: FixturePackageBytes = Object.freeze({
    manifest,
    files: Object.freeze(packageFiles),
  });
  const validated = validateFixturePackage(fixturePackage);
  const selected = selectFixturePackageAt(fixturePackage, config.fixtureEvaluationAt);
  const descriptors = manifestValue.files.map((value, ordinal) => {
    const descriptor = requireRecord(value);
    return Object.freeze({
      path: descriptor.relativePath,
      mediaType: descriptor.mediaType,
      byteLength: descriptor.byteLength,
      contentHash: descriptor.sha256,
      ordinal,
    });
  });
  const rawSources = manifestValue.files
    .map(requireRecord)
    .filter((descriptor) =>
      typeof descriptor.relativePath === "string" && descriptor.relativePath.startsWith("raw-sources/"))
    .map((descriptor) => {
      const relativePath = descriptor.relativePath as string;
      const bytes = packageFiles[relativePath]!;
      return Object.freeze({
        rawSourceHash: descriptor.sha256,
        contentBase64: Buffer.from(bytes).toString("base64"),
        byteLength: bytes.byteLength,
      });
    });
  const analyticsPath = await resolveReviewedPath(root, config.analyticsArtifactPath);
  let analytics: ApprovedAnalyticsArtifact;
  try {
    analytics = requireAnalyticsArtifact(JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(await readFile(analyticsPath)),
    ));
  } catch (error) {
    if (error instanceof Error && error.message === "APPLICATION_CONFIGURATION_INVALID") throw error;
    throw new Error("APPLICATION_CONFIGURATION_INVALID");
  }

  return Object.freeze({
    resolveFixture(payload: Readonly<Record<string, unknown>>) {
      if (
        payload.datasetId !== validated.datasetId ||
        payload.datasetVersion !== validated.datasetVersion ||
        payload.fixturePackageHash !== validated.datasetHash ||
        typeof payload.jobId !== "string"
      ) return undefined;
      return Object.freeze({
        fixturePackageHash: validated.datasetHash,
        databasePayload: Object.freeze({
          datasetId: validated.datasetId,
          datasetVersion: validated.datasetVersion,
          datasetHash: validated.datasetHash,
          manifest: manifestValue,
          jobId: payload.jobId,
          descriptors: Object.freeze(descriptors),
          rawSources: Object.freeze(rawSources),
          marketObservations: selected.marketObservations,
          economicObservations: selected.economicVintages,
        }),
      });
    },
    resolveAnalytics(payload: Readonly<Record<string, unknown>>) {
      return payload.configurationHash === analytics.configurationHash
        ? analytics
        : undefined;
    },
  });
}
