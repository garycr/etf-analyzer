import { createHash } from "node:crypto";
import { posix } from "node:path";

const candidatePattern = /^v\d+\.\d+\.\d+-rc\.\d+$/u;
const sourceCommitPattern = /^[0-9a-f]{40}$/u;

export function assertSourceCommit(sourceCommit) {
  if (!sourceCommitPattern.test(sourceCommit)) {
    throw new Error("Release source commit must be 40 lowercase hexadecimal characters");
  }
}

export function assertCleanReleaseWorktree(status) {
  if (status.length > 0) throw new Error("Release packaging requires a clean working tree");
}

function assertReleasePath(path) {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    posix.normalize(path) !== path ||
    path.split("/").includes("..")
  ) {
    throw new Error(`Release file must use a safe relative path: ${path}`);
  }
}

export function createReleaseManifest({ candidate, sourceCommit, files }) {
  if (!candidatePattern.test(candidate)) {
    throw new Error("Release candidate must match vMAJOR.MINOR.PATCH-rc.NUMBER");
  }
  assertSourceCommit(sourceCommit);

  const paths = new Set();
  const entries = files.map(({ path, content }) => {
    assertReleasePath(path);
    if (paths.has(path)) throw new Error(`Duplicate release path: ${path}`);
    paths.add(path);
    return {
      path,
      bytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);

  return `${JSON.stringify({ schemaVersion: 1, candidate, sourceCommit, files: entries }, null, 2)}\n`;
}

export function verifyReleaseManifest(manifestText, readContent) {
  const manifest = JSON.parse(manifestText);
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported release manifest schema");
  if (!candidatePattern.test(manifest.candidate)) throw new Error("Invalid release candidate");
  assertSourceCommit(manifest.sourceCommit);
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("Release manifest must contain files");
  }

  const paths = new Set();
  for (const entry of manifest.files) {
    assertReleasePath(entry.path);
    if (paths.has(entry.path)) throw new Error(`Duplicate release path: ${entry.path}`);
    paths.add(entry.path);
    const content = readContent(entry.path);
    const digest = createHash("sha256").update(content).digest("hex");
    if (content.byteLength !== entry.bytes || digest !== entry.sha256) {
      throw new Error(`Release manifest mismatch: ${entry.path}`);
    }
  }
  return manifest;
}
