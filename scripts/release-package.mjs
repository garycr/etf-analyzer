import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, sep } from "node:path";

import { assertSourceCommit, createReleaseManifest } from "./release-package-lib.mjs";

const candidate = process.env.ETF_RELEASE_CANDIDATE ?? "v0.1.0-rc.1";
const sourceCommit = process.env.GITHUB_SHA ?? execFileSync(
  "git",
  ["rev-parse", "HEAD"],
  { encoding: "utf8" },
).trim();
assertSourceCommit(sourceCommit);

const outputDirectory = "release";
const packageName = `etf-analyzer-${candidate}-${sourceCommit.slice(0, 12)}`;
const temporaryDirectory = mkdtempSync(join(tmpdir(), "etf-release-"));
const packageDirectory = join(temporaryDirectory, packageName);

const payloadPaths = [
  ".node-version",
  "README.md",
  "config/local-runtime.example.json",
  "dist",
  `docs/Operations/releases/${candidate}/release-notes.md`,
  `docs/Operations/releases/${candidate}/rollback-plan.md`,
  "package-lock.json",
  "package.json",
];

function discoverFiles(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

try {
  mkdirSync(packageDirectory, { recursive: true });
  for (const path of payloadPaths) {
    cpSync(path, join(packageDirectory, path), { recursive: true });
  }

  const files = discoverFiles(packageDirectory).map((path) => ({
    path: relative(packageDirectory, path).split(sep).join("/"),
    content: readFileSync(path),
  }));
  writeFileSync(
    join(packageDirectory, "release-manifest.json"),
    createReleaseManifest({ candidate, sourceCommit, files }),
    "utf8",
  );

  mkdirSync(outputDirectory, { recursive: true });
  const archivePath = join(outputDirectory, `${packageName}.tar.gz`);
  execFileSync("tar", [
    "--sort=name",
    "--mtime=@0",
    "--owner=0",
    "--group=0",
    "--numeric-owner",
    "--mode=u+rwX,go=rX",
    "--format=ustar",
    "--use-compress-program=gzip -n",
    "-cf",
    archivePath,
    "-C",
    temporaryDirectory,
    packageName,
  ]);
  const digest = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
  writeFileSync(`${archivePath}.sha256`, `${digest}  ${basename(archivePath)}\n`, "utf8");
  process.stdout.write(`${archivePath}\n${digest}\n`);
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
