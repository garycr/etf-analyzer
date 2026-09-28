import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertCleanReleaseWorktree,
  assertSourceCommit,
  createReleaseManifest,
  verifyReleaseManifest,
} from "../../scripts/release-package-lib.mjs";

const sourceCommit = "0123456789abcdef0123456789abcdef01234567";

test("release manifest is canonical and independent of payload discovery order", () => {
  const first = createReleaseManifest({
    candidate: "v0.1.0-rc.1",
    sourceCommit,
    files: [
      { path: "package.json", content: Buffer.from("package") },
      { path: "dist/main.js", content: Buffer.from("runtime") },
    ],
  });
  const second = createReleaseManifest({
    candidate: "v0.1.0-rc.1",
    sourceCommit,
    files: [
      { path: "dist/main.js", content: Buffer.from("runtime") },
      { path: "package.json", content: Buffer.from("package") },
    ],
  });

  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first), {
    schemaVersion: 1,
    candidate: "v0.1.0-rc.1",
    sourceCommit,
    files: [
      {
        path: "dist/main.js",
        bytes: 7,
        sha256: "d92c6a81b2ff50096bcda80885427d1f59a25b5f483f7055523504925d16ab23",
      },
      {
        path: "package.json",
        bytes: 7,
        sha256: "bc4a71180870f7945155fbb02f4b0a2e3faa2a62d6d31b7039013055ed19869a",
      },
    ],
  });
  assert.ok(first.endsWith("\n"));
});

test("release manifest rejects invalid identities and unsafe or duplicate paths", () => {
  assert.doesNotThrow(() => assertCleanReleaseWorktree(""));
  assert.throws(() => assertCleanReleaseWorktree(" M package.json\n"), /clean working tree/u);
  assert.throws(() => assertSourceCommit("main"), /40 lowercase hexadecimal/u);
  assert.throws(
    () => createReleaseManifest({
      candidate: "0.1.0",
      sourceCommit,
      files: [{ path: "package.json", content: Buffer.alloc(0) }],
    }),
    /candidate/u,
  );
  assert.throws(
    () => createReleaseManifest({
      candidate: "v0.1.0-rc.1",
      sourceCommit,
      files: [{ path: "../secret", content: Buffer.alloc(0) }],
    }),
    /safe relative path/u,
  );
  assert.throws(
    () => createReleaseManifest({
      candidate: "v0.1.0-rc.1",
      sourceCommit,
      files: [
        { path: "package.json", content: Buffer.alloc(0) },
        { path: "package.json", content: Buffer.alloc(0) },
      ],
    }),
    /Duplicate release path/u,
  );
});

test("release package is byte-deterministic and its extracted manifest verifies", () => {
  const candidate = "v0.1.0-rc.2";
  const archiveName = `etf-analyzer-${candidate}-${sourceCommit.slice(0, 12)}.tar.gz`;
  const archivePath = join("release", archiveName);
  const operatorArtifactPath = join("release", "operator-owned-artifact.txt");
  const extractionDirectory = mkdtempSync(join(tmpdir(), "etf-release-test-"));
  const environment = {
    ...process.env,
    ETF_RELEASE_CANDIDATE: candidate,
    GITHUB_SHA: sourceCommit,
  };

  try {
    mkdirSync("release", { recursive: true });
    writeFileSync(operatorArtifactPath, "preserve\n", "utf8");
    execFileSync(process.execPath, ["scripts/release-package.mjs"], { env: environment });
    const firstArchive = readFileSync(archivePath);
    execFileSync(process.execPath, ["scripts/release-package.mjs"], { env: environment });
    const secondArchive = readFileSync(archivePath);

    assert.deepEqual(firstArchive, secondArchive);
    assert.equal(firstArchive.subarray(4, 8).readUInt32LE(), 0, "gzip timestamp must be zero");
    execFileSync("tar", ["-xzf", archivePath, "-C", extractionDirectory]);
    const packageDirectory = join(
      extractionDirectory,
      `etf-analyzer-${candidate}-${sourceCommit.slice(0, 12)}`,
    );
    const manifestText = readFileSync(join(packageDirectory, "release-manifest.json"), "utf8");
    const manifest = verifyReleaseManifest(
      manifestText,
      (path) => readFileSync(join(packageDirectory, path)),
    );
    assert.equal(manifest.files.some(({ path }) => path.endsWith("/release-notes.md")), true);
    assert.equal(manifest.files.some(({ path }) => path.endsWith("/rollback-plan.md")), true);
    assert.equal(manifest.files.some(({ path }) => path.endsWith("/deployment-guide.md")), true);
    assert.equal(
      manifest.files.some(({ path }) => path === "dist/Infrastructure/Local/local-evaluation-cli.js"),
      true,
    );
    assert.match(
      JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8"))
        .scripts["release:prepare-evaluation"],
      /local-evaluation-cli\.js/u,
    );

    const sidecar = readFileSync(`${archivePath}.sha256`, "utf8");
    const archiveDigest = createHash("sha256").update(secondArchive).digest("hex");
    assert.equal(sidecar, `${archiveDigest}  ${archiveName}\n`);
    assert.equal(readFileSync(operatorArtifactPath, "utf8"), "preserve\n");
  } finally {
    rmSync(extractionDirectory, { force: true, recursive: true });
    rmSync(archivePath, { force: true });
    rmSync(`${archivePath}.sha256`, { force: true });
    rmSync(operatorArtifactPath, { force: true });
  }
});
