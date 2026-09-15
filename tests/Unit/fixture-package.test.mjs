import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalizeJson } from "../../dist/Infrastructure/CanonicalJson/canonical-json.js";
import {
  FixtureConformanceError,
  validateFixturePackage,
} from "../../dist/Application/fixture-package.js";

const rawSourceHash = "70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df";
const marketHash = "bf5e14badd7df4312cc69f818ba8e9123dfe33d0e934223eef5308520aa45cab";
const economicHash = "6d274e625f2f3efbe6e2b6f3160531b8f3b96ab86e846f7167e17ecf3e5ceb13";
const datasetHash = "5c68a8c394aecb6e27833f4216bfcd5f5c724e3aff6cfad7980192ec8d1e0b68";

const rawSource = Buffer.from("approved local fixture source\n", "utf8");
const market = Buffer.from(
  '{"adjustmentPolicy":"split-adjusted","currency":"USD","ingestionJobId":"fixture-build-1","instrumentId":"ETF-1","normalizationId":"fixture-normalization@1.0.0","numericClass":"UnitPrice","providerId":"fixture","qualityCodes":[],"qualityState":"Valid","rawSourceHash":"70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","rawSourceRef":"raw-sources/70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","revision":"1","sourceAvailableAt":"2026-01-30T22:00:00.000Z","tradingDate":"2026-01-30","value":"100.0000000000"}\n',
  "utf8",
);
const economic = Buffer.from(
  '{"ingestionJobId":"fixture-build-1","normalizationId":"fixture-normalization@1.0.0","numericClass":"Rate","observationDate":"2025-12-01","providerId":"FRED","qualityCodes":[],"qualityState":"Valid","rawSourceHash":"70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","rawSourceRef":"raw-sources/70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","releaseTimestamp":"2026-01-15T13:30:00.000Z","seriesId":"CPI","value":"3.000000000000","vintageId":"2026-01-15"}\n',
  "utf8",
);
const manifest = Buffer.from(
  '{"contractVersion":"1.0.0-candidate.2","datasetHash":"5c68a8c394aecb6e27833f4216bfcd5f5c724e3aff6cfad7980192ec8d1e0b68","datasetId":"etf-prototype-core","datasetVersion":"2026.01.0","economicCoverage":[{"observationDates":["2025-12-01"],"providerId":"FRED","seriesId":"CPI"}],"files":[{"byteLength":489,"mediaType":"application/x-ndjson","recordCount":1,"relativePath":"economic-vintages.jsonl","sha256":"6d274e625f2f3efbe6e2b6f3160531b8f3b96ab86e846f7167e17ecf3e5ceb13"},{"byteLength":543,"mediaType":"application/x-ndjson","recordCount":1,"relativePath":"market-observations.jsonl","sha256":"bf5e14badd7df4312cc69f818ba8e9123dfe33d0e934223eef5308520aa45cab"},{"byteLength":30,"mediaType":"application/octet-stream","recordCount":1,"relativePath":"raw-sources/70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","sha256":"70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df"}],"fixturePolicyId":"fixture-policy-1","marketCoverage":[{"adjustmentPolicy":"split-adjusted","instrumentId":"ETF-1","requiredTradingDates":["2026-01-30"]}],"prototypeCandidate":"v1.0.0-prototype.1","schemaVersion":"1.0.0"}',
  "utf8",
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function goldenPackage() {
  return {
    files: {
      "economic-vintages.jsonl": economic,
      "market-observations.jsonl": market,
      [`raw-sources/${rawSourceHash}`]: rawSource,
    },
    manifest,
  };
}

test("PT-FIX-001A validates the exact golden package identity", () => {
  const result = validateFixturePackage(goldenPackage());

  assert.deepEqual(result, {
    datasetHash,
    datasetId: "etf-prototype-core",
    datasetVersion: "2026.01.0",
    fileHashes: {
      "economic-vintages.jsonl": economicHash,
      "market-observations.jsonl": marketHash,
      [`raw-sources/${rawSourceHash}`]: rawSourceHash,
    },
  });
});

test("PT-FIX-001A rejects an altered governed file byte", () => {
  const fixturePackage = goldenPackage();
  fixturePackage.files["market-observations.jsonl"] = Buffer.concat([
    market.subarray(0, market.length - 2),
    Buffer.from(" \n", "utf8"),
  ]);

  assert.throws(
    () => validateFixturePackage(fixturePackage),
    (error) =>
      error instanceof FixtureConformanceError &&
      error.code === "FIXTURE_FILE_INTEGRITY_FAILED",
  );
});

test("PT-FIX-001A rejects self-consistent replacement of the golden version", () => {
  const fixturePackage = goldenPackage();
  const changedMarket = Buffer.concat([
    market.subarray(0, market.length - 2),
    Buffer.from(" \n", "utf8"),
  ]);
  fixturePackage.files["market-observations.jsonl"] = changedMarket;

  const changedManifest = JSON.parse(manifest.toString("utf8"));
  const marketDescriptor = changedManifest.files.find(
    ({ relativePath }) => relativePath === "market-observations.jsonl",
  );
  marketDescriptor.sha256 = sha256(changedMarket);
  const { datasetHash: ignoredDatasetHash, ...hashMembers } = changedManifest;
  void ignoredDatasetHash;
  changedManifest.datasetHash = sha256(
    Buffer.from(
      canonicalizeJson({ ...hashMembers, domain: "etf.fixture.dataset.v1" }),
      "utf8",
    ),
  );
  fixturePackage.manifest = Buffer.from(canonicalizeJson(changedManifest), "utf8");

  assert.throws(
    () => validateFixturePackage(fixturePackage),
    (error) =>
      error instanceof FixtureConformanceError &&
      error.code === "FIXTURE_IDEMPOTENCY_CONFLICT",
  );
});
