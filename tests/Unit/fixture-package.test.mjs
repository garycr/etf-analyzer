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

function packageWithManifestMutation(mutate, moveFile) {
  const fixturePackage = goldenPackage();
  const changedManifest = JSON.parse(manifest.toString("utf8"));
  mutate(changedManifest);
  if (moveFile !== undefined) {
    const [from, to] = moveFile;
    fixturePackage.files[to] = fixturePackage.files[from];
    delete fixturePackage.files[from];
  }
  updateManifest(fixturePackage, changedManifest);
  return fixturePackage;
}

function updateManifest(fixturePackage, changedManifest) {
  const { datasetHash: ignoredDatasetHash, ...hashMembers } = changedManifest;
  void ignoredDatasetHash;
  changedManifest.datasetHash = sha256(
    Buffer.from(
      canonicalizeJson({ ...hashMembers, domain: "etf.fixture.dataset.v1" }),
      "utf8",
    ),
  );
  fixturePackage.manifest = Buffer.from(canonicalizeJson(changedManifest), "utf8");
}

function assertFixtureError(fixturePackage, code) {
  assert.throws(
    () => validateFixturePackage(fixturePackage),
    (error) =>
      error instanceof FixtureConformanceError &&
      error.code === code,
  );
}

function assertManifestInvalid(fixturePackage) {
  assertFixtureError(fixturePackage, "FIXTURE_MANIFEST_INVALID");
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

test("PT-FIX-001H rejects duplicate JSON members before hashing", () => {
  const duplicateMemberManifest = manifest
    .toString("utf8")
    .replace(
      '"datasetId":"etf-prototype-core",',
      '"datasetId":"etf-prototype-core","datasetId":"etf-prototype-core",',
    );

  assertManifestInvalid({
    ...goldenPackage(),
    manifest: Buffer.from(duplicateMemberManifest, "utf8"),
  });
});

test("PT-FIX-001H rejects nested duplicate JSON members before hashing", () => {
  const duplicateMemberManifest = manifest
    .toString("utf8")
    .replace('"byteLength":489,', '"byteLength":489,"byteLength":489,');

  assertManifestInvalid({
    ...goldenPackage(),
    manifest: Buffer.from(duplicateMemberManifest, "utf8"),
  });
});

for (const [name, mutate] of [
  ["manifest", (value) => { value.unknown = true; }],
  ["descriptor", (value) => { value.files[0].unknown = true; }],
  ["market coverage", (value) => { value.marketCoverage[0].unknown = true; }],
  ["economic coverage", (value) => { value.economicCoverage[0].unknown = true; }],
]) {
  test(`PT-FIX-001H rejects an unknown ${name} field`, () => {
    assertManifestInvalid(packageWithManifestMutation(mutate));
  });
}

test("PT-FIX-001H rejects duplicate file descriptors", () => {
  assertManifestInvalid(
    packageWithManifestMutation((value) => {
      value.files.splice(1, 0, structuredClone(value.files[0]));
    }),
  );
});

for (const [name, mutate] of [
  ["market", (value) => { value.marketCoverage.push(structuredClone(value.marketCoverage[0])); }],
  ["economic", (value) => { value.economicCoverage.push(structuredClone(value.economicCoverage[0])); }],
]) {
  test(`PT-FIX-001H rejects a duplicate ${name} coverage identity`, () => {
    assertManifestInvalid(packageWithManifestMutation(mutate));
  });
}

for (const relativePath of [
  "/economic-vintages.jsonl",
  "./economic-vintages.jsonl",
  "fixtures/../economic-vintages.jsonl",
  "fixtures//economic-vintages.jsonl",
  "fixtures/",
  "fixtures\\economic-vintages.jsonl",
  "C:/economic-vintages.jsonl",
]) {
  test(`PT-FIX-001H rejects unsafe path ${relativePath}`, () => {
    assertManifestInvalid(
      packageWithManifestMutation(
        (value) => {
          value.files[0].relativePath = relativePath;
        },
        ["economic-vintages.jsonl", relativePath],
      ),
    );
  });
}

for (const [name, mutate] of [
  ["dataset ID", (value) => { value.datasetId = "ETF Prototype"; }],
  ["dataset version", (value) => { value.datasetVersion = "2026.1.0"; }],
  ["schema version", (value) => { value.schemaVersion = "1.0.1"; }],
  ["contract version", (value) => { value.contractVersion = "1.0.0"; }],
  ["prototype candidate", (value) => { value.prototypeCandidate = "v1.0.0"; }],
  ["fixture policy", (value) => { value.fixturePolicyId = "fixture-policy-2"; }],
  ["descriptor digest", (value) => { value.files[0].sha256 = "A".repeat(64); }],
  ["descriptor byte length", (value) => { value.files[0].byteLength = -1; }],
  ["fractional descriptor byte length", (value) => { value.files[0].byteLength = 1.5; }],
  ["descriptor record count", (value) => { value.files[0].recordCount = 0; }],
  ["string descriptor record count", (value) => { value.files[0].recordCount = "1"; }],
  ["JSONL media type", (value) => { value.files[0].mediaType = "application/json"; }],
  ["raw-source media type", (value) => { value.files[2].mediaType = "application/x-ndjson"; }],
  ["raw-source record count", (value) => { value.files[2].recordCount = 2; }],
  ["descriptor order", (value) => { value.files.reverse(); }],
  ["market coverage order", (value) => {
    value.marketCoverage.unshift({
      adjustmentPolicy: "split-adjusted",
      instrumentId: "ZZZ",
      requiredTradingDates: ["2026-01-30"],
    });
  }],
  ["economic coverage order", (value) => {
    value.economicCoverage.unshift({
      observationDates: ["2025-12-01"],
      providerId: "ZZZ",
      seriesId: "CPI",
    });
  }],
  ["duplicate market date", (value) => { value.marketCoverage[0].requiredTradingDates.push("2026-01-30"); }],
  ["duplicate economic date", (value) => { value.economicCoverage[0].observationDates.push("2025-12-01"); }],
  ["descending market dates", (value) => {
    value.marketCoverage[0].requiredTradingDates = ["2026-01-31", "2026-01-30"];
  }],
  ["descending economic dates", (value) => {
    value.economicCoverage[0].observationDates = ["2025-12-02", "2025-12-01"];
  }],
  ["invalid market date", (value) => { value.marketCoverage[0].requiredTradingDates[0] = "2026-02-30"; }],
  ["invalid economic date", (value) => { value.economicCoverage[0].observationDates[0] = "2025-13-01"; }],
  ["missing required manifest field", (value) => { delete value.fixturePolicyId; }],
  ["null required manifest field", (value) => { value.datasetId = null; }],
  ["non-array files", (value) => { value.files = {}; }],
  ["non-array market coverage", (value) => { value.marketCoverage = {}; }],
  ["non-array economic coverage", (value) => { value.economicCoverage = {}; }],
]) {
  test(`PT-FIX-001H rejects invalid ${name}`, () => {
    assertManifestInvalid(packageWithManifestMutation(mutate));
  });
}

test("PT-FIX-001H rejects invalid dataset digest", () => {
  const fixturePackage = goldenPackage();
  const changedManifest = JSON.parse(manifest.toString("utf8"));
  changedManifest.datasetHash = "A".repeat(64);
  fixturePackage.manifest = Buffer.from(canonicalizeJson(changedManifest), "utf8");

  assertManifestInvalid(fixturePackage);
});

test("PT-FIX-001H compares coverage identities as unambiguous tuples", () => {
  const fixturePackage = packageWithManifestMutation((value) => {
    value.marketCoverage = [
      {
        adjustmentPolicy: "B\u0000C",
        instrumentId: "A",
        requiredTradingDates: [],
      },
      {
        adjustmentPolicy: "C",
        instrumentId: "A\u0000B",
        requiredTradingDates: [],
      },
    ];
  });

  assertFixtureError(fixturePackage, "FIXTURE_IDEMPOTENCY_CONFLICT");
});

test("PT-FIX-001H orders coverage identities by UTF-8 bytes", () => {
  const fixturePackage = packageWithManifestMutation((value) => {
    value.marketCoverage = [
      {
        adjustmentPolicy: "split-adjusted",
        instrumentId: "\uE000",
        requiredTradingDates: [],
      },
      {
        adjustmentPolicy: "split-adjusted",
        instrumentId: "\u{10000}",
        requiredTradingDates: [],
      },
    ];
  });

  assertFixtureError(fixturePackage, "FIXTURE_IDEMPOTENCY_CONFLICT");
});

test("PT-FIX-001H accepts empty coverage date arrays structurally", () => {
  const fixturePackage = packageWithManifestMutation((value) => {
    value.marketCoverage[0].requiredTradingDates = [];
    value.economicCoverage[0].observationDates = [];
  });

  assertFixtureError(fixturePackage, "FIXTURE_IDEMPOTENCY_CONFLICT");
});

test("PT-FIX-001H rejects a missing required observation descriptor", () => {
  const fixturePackage = packageWithManifestMutation((value) => {
    value.files.splice(0, 1);
  });
  delete fixturePackage.files["economic-vintages.jsonl"];

  assertManifestInvalid(fixturePackage);
});

test("PT-FIX-001H rejects a renamed required observation descriptor", () => {
  assertManifestInvalid(
    packageWithManifestMutation(
      (value) => {
        value.files[0].relativePath = "economic-data.jsonl";
      },
      ["economic-vintages.jsonl", "economic-data.jsonl"],
    ),
  );
});

test("PT-FIX-001H rejects an extra observation descriptor", () => {
  const fixturePackage = packageWithManifestMutation((value) => {
    value.files.splice(2, 0, {
      ...structuredClone(value.files[1]),
      relativePath: "other-observations.jsonl",
    });
  });
  fixturePackage.files["other-observations.jsonl"] = market;

  assertManifestInvalid(fixturePackage);
});
