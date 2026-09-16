import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalizeJson } from "../../dist/Infrastructure/CanonicalJson/canonical-json.js";
import {
  FixtureConformanceError,
  selectFixturePackageAt,
  validateFixturePackage,
} from "../../dist/Application/fixture-package.js";
import {
  ProviderEgressDeniedError,
  attemptProductProviderEgress,
  loadLocalConfiguration,
} from "../../dist/Application/foundation.js";

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

test("PT-FIX-001O denies provider DNS and connection attempts without fixture substitution", () => {
  const configuration = loadLocalConfiguration({ ETF_PROVIDER_EGRESS: "disabled" });
  const validatedPackage = validateFixturePackage(goldenPackage());
  const packageBeforeAttempts = structuredClone(validatedPackage);
  let transportCalls = 0;

  for (const operation of ["dns-resolution", "network-connection"]) {
    assert.throws(
      () => attemptProductProviderEgress(
        configuration,
        operation,
        "https://api-key:secret@provider.example.test/observations?api_key=sensitive#fragment",
        () => {
          transportCalls += 1;
        },
      ),
      (error) => {
        assert.ok(error instanceof ProviderEgressDeniedError);
        assert.deepEqual(error.evidence, {
          endpoint: "https://provider.example.test",
          fixtureOnly: true,
          operation,
          outcome: "denied",
          successfulConnections: 0,
        });
        assert.ok(Object.isFrozen(error.evidence));
        return true;
      },
    );
  }

  assert.throws(
    () => attemptProductProviderEgress(
      configuration,
      "network-connection",
      "api_key=sensitive",
      () => {
        transportCalls += 1;
      },
    ),
    (error) => {
      assert.ok(error instanceof ProviderEgressDeniedError);
      assert.equal(error.evidence.endpoint, "[REDACTED]");
      return true;
    },
  );

  assert.equal(transportCalls, 0);
  assert.deepEqual(validatedPackage, packageBeforeAttempts);
});

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

function packageWithRecordMutation(relativePath, mutate) {
  const fixturePackage = goldenPackage();
  const changedManifest = JSON.parse(manifest.toString("utf8"));
  changedManifest.datasetVersion = "2026.01.1";
  const records = fixturePackage.files[relativePath]
    .toString("utf8")
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  mutate(records);
  const changedBytes = Buffer.from(
    `${records.map((record) => canonicalizeJson(record)).join("\n")}\n`,
    "utf8",
  );
  fixturePackage.files[relativePath] = changedBytes;
  const descriptor = changedManifest.files.find((item) => item.relativePath === relativePath);
  descriptor.byteLength = changedBytes.byteLength;
  descriptor.recordCount = records.length;
  descriptor.sha256 = sha256(changedBytes);
  updateManifest(fixturePackage, changedManifest);
  return fixturePackage;
}

function packageWithJsonlBytes(relativePath, changedBytes, recordCount = 1) {
  const fixturePackage = goldenPackage();
  const changedManifest = JSON.parse(manifest.toString("utf8"));
  changedManifest.datasetVersion = "2026.01.1";
  fixturePackage.files[relativePath] = changedBytes;
  const descriptor = changedManifest.files.find((item) => item.relativePath === relativePath);
  descriptor.byteLength = changedBytes.byteLength;
  descriptor.recordCount = recordCount;
  descriptor.sha256 = sha256(changedBytes);
  updateManifest(fixturePackage, changedManifest);
  return fixturePackage;
}

function assertFixtureError(fixturePackage, code) {
  assert.throws(
    () => validateFixturePackage(fixturePackage),
    (error) =>
      error instanceof FixtureConformanceError &&
      error.code === code,
  );
}

function assertSelectionError(fixturePackage, evaluationInstant, code) {
  assert.throws(
    () => selectFixturePackageAt(fixturePackage, evaluationInstant),
    (error) => {
      assert.ok(error instanceof FixtureConformanceError);
      assert.equal(error.code, code);
      return true;
    },
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
    economicIdempotentReplayCount: 0,
    economicVintageCount: 1,
    fileHashes: {
      "economic-vintages.jsonl": economicHash,
      "market-observations.jsonl": marketHash,
      [`raw-sources/${rawSourceHash}`]: rawSourceHash,
    },
    marketIdempotentReplayCount: 0,
    marketObservationCount: 1,
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
  const changedMarket = Buffer.from(
    market.toString("utf8").replace('"value":"100.0000000000"', '"value":"101.0000000000"'),
    "utf8",
  );
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

test("PT-FIX-001B collapses byte-identical market replay to one logical observation", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      records.push(structuredClone(records[0]));
      records.push(structuredClone(records[0]));
    },
  );

  const result = validateFixturePackage(fixturePackage);

  assert.equal(result.marketObservationCount, 1);
  assert.equal(result.marketIdempotentReplayCount, 2);
});

test("PT-FIX-001C rejects a conflicting market replay", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      records.push({
        ...structuredClone(records[0]),
        value: "101.0000000000",
      });
    },
  );

  assertFixtureError(fixturePackage, "FIXTURE_IDEMPOTENCY_CONFLICT");
});

test("PT-FIX-001C rejects a changed job ID under one market business identity", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      records.push({
        ...structuredClone(records[0]),
        ingestionJobId: "fixture-build-2",
      });
    },
  );

  assertFixtureError(fixturePackage, "FIXTURE_IDEMPOTENCY_CONFLICT");
});

test("PT-FIX-001J collapses byte-identical economic replay to one logical vintage", () => {
  const fixturePackage = packageWithRecordMutation(
    "economic-vintages.jsonl",
    (records) => {
      records.push(structuredClone(records[0]));
      records.push(structuredClone(records[0]));
    },
  );

  const result = validateFixturePackage(fixturePackage);

  assert.equal(result.economicVintageCount, 1);
  assert.equal(result.economicIdempotentReplayCount, 2);
});

test("PT-FIX-001J rejects a conflicting economic replay", () => {
  const fixturePackage = packageWithRecordMutation(
    "economic-vintages.jsonl",
    (records) => {
      records.push({
        ...structuredClone(records[0]),
        value: "4.000000000000",
      });
    },
  );

  assertFixtureError(fixturePackage, "FIXTURE_IDEMPOTENCY_CONFLICT");
});

test("PT-FIX-001J rejects a changed job ID under one economic identity", () => {
  const fixturePackage = packageWithRecordMutation(
    "economic-vintages.jsonl",
    (records) => {
      records.push({
        ...structuredClone(records[0]),
        ingestionJobId: "fixture-build-2",
      });
    },
  );

  assertFixtureError(fixturePackage, "FIXTURE_IDEMPOTENCY_CONFLICT");
});

test("PT-FIX-001J rejects competing vintages at one release instant", () => {
  const fixturePackage = packageWithRecordMutation(
    "economic-vintages.jsonl",
    (records) => {
      records.push({
        ...structuredClone(records[0]),
        vintageId: "2026-01-15-corrected",
      });
    },
  );

  assertFixtureError(fixturePackage, "FIXTURE_TEMPORAL_INVALID");
});

test("PT-FIX-001J reports identity conflict before an earlier release collision", () => {
  const fixturePackage = packageWithRecordMutation(
    "economic-vintages.jsonl",
    (records) => {
      records.push({
        ...structuredClone(records[0]),
        vintageId: "2026-01-15-corrected",
      });
      records.push({
        ...structuredClone(records[0]),
        value: "4.000000000000",
      });
    },
  );

  assertFixtureError(fixturePackage, "FIXTURE_IDEMPOTENCY_CONFLICT");
});

test("PT-FIX-001D includes an economic vintage released exactly at T", () => {
  const fixturePackage = packageWithRecordMutation(
    "economic-vintages.jsonl",
    (records) => {
      records[0].releaseTimestamp = "2026-01-30T21:59:59.999Z";
      records[0].vintageId = "before";
      records.push({
        ...structuredClone(records[0]),
        releaseTimestamp: "2026-01-30T22:00:00.000Z",
        vintageId: "at",
      });
      records.push({
        ...structuredClone(records[0]),
        releaseTimestamp: "2026-01-30T22:00:00.001Z",
        vintageId: "after",
      });
    },
  );
  const originalBytes = Buffer.from(fixturePackage.files["economic-vintages.jsonl"]);

  const selection = selectFixturePackageAt(
    fixturePackage,
    "2026-01-30T22:00:00.000Z",
  );

  assert.equal(selection.economicVintages.length, 1);
  assert.equal(selection.economicVintages[0].vintageId, "at");
  assert.equal(selection.economicVintages[0].releaseTimestamp, "2026-01-30T22:00:00.000Z");
  assert.deepEqual(fixturePackage.files["economic-vintages.jsonl"], originalBytes);
});

test("PT-FIX-001E filters future market revisions before numeric ordering", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      records[0].revision = "9";
      records[0].sourceAvailableAt = "2026-01-30T21:59:59.999Z";
      records.push({
        ...structuredClone(records[0]),
        revision: "10",
        sourceAvailableAt: "2026-01-30T22:00:00.000Z",
      });
      records.push({
        ...structuredClone(records[0]),
        revision: "11",
        sourceAvailableAt: "2026-01-30T22:00:00.001Z",
      });
    },
  );
  const originalBytes = Buffer.from(fixturePackage.files["market-observations.jsonl"]);

  const selection = selectFixturePackageAt(
    fixturePackage,
    "2026-01-30T22:00:00.000Z",
  );

  assert.equal(selection.marketObservations.length, 1);
  assert.equal(selection.marketObservations[0].revision, "10");
  assert.equal(selection.marketObservations[0].sourceAvailableAt, "2026-01-30T22:00:00.000Z");
  assert.deepEqual(fixturePackage.files["market-observations.jsonl"], originalBytes);
});

test("PT-FIX-001G suppresses selection when a required input is unavailable", () => {
  assert.throws(
    () => selectFixturePackageAt(
      goldenPackage(),
      "2026-01-15T13:30:00.000Z",
    ),
    (error) =>
      error instanceof FixtureConformanceError &&
      error.code === "FIXTURE_REQUIRED_MISSING",
  );
});

test("PT-FIX-001G suppresses selection when required economic input is unavailable", () => {
  const fixturePackage = packageWithRecordMutation(
    "economic-vintages.jsonl",
    ([record]) => {
      record.releaseTimestamp = "2026-01-30T22:00:00.001Z";
    },
  );

  assert.throws(
    () => selectFixturePackageAt(
      fixturePackage,
      "2026-01-30T22:00:00.000Z",
    ),
    (error) =>
      error instanceof FixtureConformanceError &&
      error.code === "FIXTURE_REQUIRED_MISSING",
  );
});

test("PT-FIX-001G reports missing before a selected non-Valid input", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    ([record]) => {
      record.qualityState = "Partial";
      record.qualityCodes = ["SOURCE_PARTIAL"];
    },
  );
  const changedManifest = JSON.parse(fixturePackage.manifest.toString("utf8"));
  changedManifest.economicCoverage[0].observationDates.push("2025-12-02");
  updateManifest(fixturePackage, changedManifest);

  assert.throws(
    () => selectFixturePackageAt(fixturePackage, "2026-01-30T22:00:00.000Z"),
    (error) =>
      error instanceof FixtureConformanceError &&
      error.code === "FIXTURE_REQUIRED_MISSING",
  );
});

for (const [firstState, secondState, expectedCode] of [
  ["Partial", "Quarantined", "FIXTURE_REQUIRED_PARTIAL"],
  ["Stale", "Quarantined", "FIXTURE_REQUIRED_STALE"],
]) {
  test(`PT-FIX-001G reports ${firstState} before ${secondState}`, () => {
    const fixturePackage = packageWithRecordMutation(
      "market-observations.jsonl",
      (records) => {
        records[0].qualityState = firstState;
        records[0].qualityCodes = [`SOURCE_${firstState.toUpperCase()}`];
        records.push({
          ...structuredClone(records[0]),
          instrumentId: "ZZZ",
          qualityState: secondState,
          qualityCodes: [`SOURCE_${secondState.toUpperCase()}`],
        });
      },
    );
    const changedManifest = JSON.parse(fixturePackage.manifest.toString("utf8"));
    changedManifest.marketCoverage.push({
      adjustmentPolicy: "split-adjusted",
      instrumentId: "ZZZ",
      requiredTradingDates: ["2026-01-30"],
    });
    updateManifest(fixturePackage, changedManifest);

    assert.throws(
      () => selectFixturePackageAt(fixturePackage, "2026-01-30T22:00:00.000Z"),
      (error) =>
        error instanceof FixtureConformanceError &&
        error.code === expectedCode,
    );
  });
}

for (const [name, mutate] of [
  ["an unknown quality state", (record) => {
    record.qualityState = "Unknown";
  }],
  ["quality codes on a Valid record", (record) => {
    record.qualityCodes = ["UNEXPECTED_CODE"];
  }],
  ["empty quality codes on a non-Valid record", (record) => {
    record.qualityState = "Partial";
  }],
  ["unsorted quality codes", (record) => {
    record.qualityState = "Stale";
    record.qualityCodes = ["Z_CODE", "A_CODE"];
  }],
  ["duplicate quality codes", (record) => {
    record.qualityState = "Quarantined";
    record.qualityCodes = ["A_CODE", "A_CODE"];
  }],
  ["a non-array quality code value", (record) => {
    record.qualityCodes = "A_CODE";
  }],
]) {
  for (const relativePath of [
    "market-observations.jsonl",
    "economic-vintages.jsonl",
  ]) {
    test(`PT-FIX-001G rejects ${name} in ${relativePath}`, () => {
      const fixturePackage = packageWithRecordMutation(relativePath, ([record]) => {
        mutate(record);
      });

      assertFixtureError(fixturePackage, "FIXTURE_MANIFEST_INVALID");
    });
  }
}

for (const [qualityState, expectedCode] of [
  ["Partial", "FIXTURE_REQUIRED_PARTIAL"],
  ["Stale", "FIXTURE_REQUIRED_STALE"],
  ["Quarantined", "FIXTURE_REQUIRED_QUARANTINED"],
]) {
  for (const relativePath of [
    "market-observations.jsonl",
    "economic-vintages.jsonl",
  ]) {
    test(`PT-FIX-001G suppresses selected ${relativePath} input in ${qualityState} state`, () => {
      const fixturePackage = packageWithRecordMutation(relativePath, ([record]) => {
        record.qualityState = qualityState;
        record.qualityCodes = [`SOURCE_${qualityState.toUpperCase()}`];
      });

      assert.throws(
        () => selectFixturePackageAt(
          fixturePackage,
          "2026-01-30T22:00:00.000Z",
        ),
        (error) =>
          error instanceof FixtureConformanceError &&
          error.code === expectedCode,
      );
    });
  }
}

for (const [qualityState, expectedCode] of [
  ["Partial", "FIXTURE_REQUIRED_PARTIAL"],
  ["Stale", "FIXTURE_REQUIRED_STALE"],
  ["Quarantined", "FIXTURE_REQUIRED_QUARANTINED"],
]) {
  test(`PT-FIX-001K does not fall back from a newer ${qualityState} market revision`, () => {
    const fixturePackage = packageWithRecordMutation(
      "market-observations.jsonl",
      (records) => {
        records[0].revision = "1";
        records[0].sourceAvailableAt = "2026-01-30T21:59:59.999Z";
        records.push({
          ...structuredClone(records[0]),
          qualityCodes: [`SOURCE_${qualityState.toUpperCase()}`],
          qualityState,
          revision: "2",
          sourceAvailableAt: "2026-01-30T22:00:00.000Z",
        });
      },
    );

    assertSelectionError(
      fixturePackage,
      "2026-01-30T22:00:00.000Z",
      expectedCode,
    );
  });

  test(`PT-FIX-001K does not fall back from a newer ${qualityState} economic vintage`, () => {
    const fixturePackage = packageWithRecordMutation(
      "economic-vintages.jsonl",
      (records) => {
        records[0].releaseTimestamp = "2026-01-15T13:29:59.999Z";
        records[0].vintageId = "before";
        records.push({
          ...structuredClone(records[0]),
          qualityCodes: [`SOURCE_${qualityState.toUpperCase()}`],
          qualityState,
          releaseTimestamp: "2026-01-15T13:30:00.000Z",
          vintageId: "at",
        });
      },
    );

    assertSelectionError(
      fixturePackage,
      "2026-01-30T22:00:00.000Z",
      expectedCode,
    );
  });
}

for (const [field, value] of [
  ["instrumentId", "UNDECLARED-ETF"],
  ["adjustmentPolicy", "unadjusted"],
  ["tradingDate", "2026-01-31"],
]) {
  test(`fixture validation rejects a market observation with undeclared ${field}`, () => {
    const fixturePackage = packageWithRecordMutation(
      "market-observations.jsonl",
      (records) => {
        records.push({
          ...structuredClone(records[0]),
          [field]: value,
          ingestionJobId: "fixture-build-2",
        });
      },
    );

    assertFixtureError(fixturePackage, "FIXTURE_UNDECLARED_INPUT");
  });
}

for (const [field, value] of [
  ["providerId", "BLS"],
  ["seriesId", "UNDECLARED-CPI"],
  ["observationDate", "2025-12-02"],
]) {
  test(`fixture validation rejects an economic vintage with undeclared ${field}`, () => {
    const fixturePackage = packageWithRecordMutation(
      "economic-vintages.jsonl",
      (records) => {
        records.push({
          ...structuredClone(records[0]),
          [field]: value,
          ingestionJobId: "fixture-build-2",
        });
      },
    );

    assertFixtureError(fixturePackage, "FIXTURE_UNDECLARED_INPUT");
  });
}

test("fixture validation reports invalid provenance before undeclared input", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      records.push({
        ...structuredClone(records[0]),
        ingestionJobId: "fixture-build-2",
        instrumentId: "UNDECLARED-ETF",
        normalizationId: "",
      });
    },
  );

  assertFixtureError(fixturePackage, "FIXTURE_PROVENANCE_INVALID");
});

test("fixture selection reports undeclared input before required-input failures", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      records[0].qualityCodes = ["SOURCE_PARTIAL"];
      records[0].qualityState = "Partial";
      records.push({
        ...structuredClone(records[0]),
        ingestionJobId: "fixture-build-2",
        instrumentId: "UNDECLARED-ETF",
      });
    },
  );

  assertSelectionError(
    fixturePackage,
    "2026-01-30T22:00:00.000Z",
    "FIXTURE_UNDECLARED_INPUT",
  );
});

test("PT-FIX-001N reports every safely detectable defect in precedence order", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      records[0].qualityCodes = ["SOURCE_STALE"];
      records[0].qualityState = "Stale";
      records.push({
        ...structuredClone(records[0]),
        ingestionJobId: "fixture-build-2",
        instrumentId: "UNDECLARED-ETF",
        qualityCodes: [],
        qualityState: "Valid",
        revision: "01",
      });
    },
  );
  const changedManifest = JSON.parse(fixturePackage.manifest.toString("utf8"));
  changedManifest.unknown = true;
  updateManifest(fixturePackage, changedManifest);
  fixturePackage.files[`raw-sources/${rawSourceHash}`] = Buffer.from(
    "tampered local fixture source\n",
    "utf8",
  );

  assert.throws(
    () => selectFixturePackageAt(fixturePackage, "2026-01-30T22:00:00.000Z"),
    (error) => {
      assert.ok(error instanceof FixtureConformanceError);
      assert.equal(error.code, "FIXTURE_MANIFEST_INVALID");
      assert.deepEqual(
        error.issues.map(({ code }) => code),
        [
          "FIXTURE_MANIFEST_INVALID",
          "FIXTURE_FILE_INTEGRITY_FAILED",
          "FIXTURE_TEMPORAL_INVALID",
          "FIXTURE_PROVENANCE_INVALID",
          "FIXTURE_PROVENANCE_INVALID",
          "FIXTURE_PROVENANCE_INVALID",
          "FIXTURE_UNDECLARED_INPUT",
          "FIXTURE_REQUIRED_STALE",
        ],
      );
      return true;
    },
  );
});

test("PT-FIX-001N orders malformed identities by absent, invalid, then valid components", () => {
  const malformedPackage = (reverse) => packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      const validRecord = structuredClone(records[0]);
      delete records[0].instrumentId;
      records[0].revision = "01";
      records.push({
        ...structuredClone(validRecord),
        ingestionJobId: "fixture-build-2",
        instrumentId: 7,
        revision: "02",
      });
      records.push({
        ...structuredClone(validRecord),
        ingestionJobId: "fixture-build-3",
        instrumentId: 10,
        revision: "03",
      });
      records.push({
        ...structuredClone(validRecord),
        ingestionJobId: "fixture-build-4",
        instrumentId: "ZZZ",
        revision: "04",
      });
      if (reverse) {
        records.reverse();
      }
    },
  );
  const temporalIssues = (fixturePackage) => {
    let captured;
    assert.throws(
      () => validateFixturePackage(fixturePackage),
      (error) => {
        assert.ok(error instanceof FixtureConformanceError);
        captured = error;
        return true;
      },
    );
    assert.ok(Object.isFrozen(captured.issues));
    assert.ok(Object.isFrozen(captured.issues[0].businessIdentity[0]));
    assert.ok(Object.isFrozen(captured.issues[0].relativePath));
    return captured.issues.filter(({ code }) => code === "FIXTURE_TEMPORAL_INVALID");
  };

  const forwardIssues = temporalIssues(malformedPackage(false));
  const reverseIssues = temporalIssues(malformedPackage(true));
  assert.deepEqual(reverseIssues, forwardIssues);
  assert.deepEqual(
    forwardIssues.map(({ businessIdentity }) => businessIdentity[0].state),
    ["absent", "invalid", "invalid", "valid"],
  );
  assert.deepEqual(
    forwardIssues
      .map(({ businessIdentity }) => businessIdentity[0])
      .filter(({ state }) => state === "invalid")
      .map(({ raw }) => raw),
    ["7", "10"],
  );
});

test("PT-FIX-001N attributes a record-count mismatch to its fixture file", () => {
  const fixturePackage = packageWithManifestMutation((value) => {
    value.datasetVersion = "2026.01.1";
    value.files.find(({ relativePath }) =>
      relativePath === "market-observations.jsonl"
    ).recordCount = 2;
  });

  assert.throws(
    () => validateFixturePackage(fixturePackage),
    (error) => {
      assert.ok(error instanceof FixtureConformanceError);
      const issue = error.issues.find(({ code }) =>
        code === "FIXTURE_FILE_INTEGRITY_FAILED"
      );
      assert.deepEqual(issue.relativePath, {
        state: "valid",
        value: "market-observations.jsonl",
      });
      return true;
    },
  );
});

test("PT-FIX-001N classifies an economic provider as invalid for a market identity", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    ([record]) => {
      record.providerId = "FRED";
      record.revision = "01";
    },
  );

  assert.throws(
    () => validateFixturePackage(fixturePackage),
    (error) => {
      assert.ok(error instanceof FixtureConformanceError);
      const issue = error.issues.find(({ code }) => code === "FIXTURE_TEMPORAL_INVALID");
      assert.deepEqual(issue.businessIdentity[2], { raw: "FRED", state: "invalid" });
      return true;
    },
  );
});

test("PT-FIX-001N does not derive required-input issues from a malformed evaluation instant", () => {
  const fixturePackage = packageWithManifestMutation((value) => {
    value.datasetVersion = "2026.01.1";
    value.unknown = true;
  });

  assert.throws(
    () => selectFixturePackageAt(fixturePackage, "not-an-instant"),
    (error) => {
      assert.ok(error instanceof FixtureConformanceError);
      assert.equal(error.code, "FIXTURE_MANIFEST_INVALID");
      assert.ok(error.issues.some(({ code }) => code === "FIXTURE_TEMPORAL_INVALID"));
      assert.equal(
        error.issues.some(({ code }) => code.startsWith("FIXTURE_REQUIRED_")),
        false,
      );
      return true;
    },
  );
});

test("PT-FIX-001D/E selection preserves package validation precedence", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    ([record]) => {
      record.unknown = true;
    },
  );

  assert.throws(
    () => selectFixturePackageAt(fixturePackage, "not-an-instant"),
    (error) =>
      error instanceof FixtureConformanceError &&
      error.code === "FIXTURE_MANIFEST_INVALID",
  );
});

test("PT-FIX-001D/E selection propagates market replay conflicts", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      records.push({ ...structuredClone(records[0]), value: "101.0000000000" });
    },
  );

  assert.throws(
    () => selectFixturePackageAt(fixturePackage, "2026-01-30T22:00:00.000Z"),
    (error) =>
      error instanceof FixtureConformanceError &&
      error.code === "FIXTURE_IDEMPOTENCY_CONFLICT",
  );
});

test("PT-FIX-001D/E selection propagates economic provenance failures", () => {
  const fixturePackage = packageWithRecordMutation(
    "economic-vintages.jsonl",
    ([record]) => {
      delete record.rawSourceRef;
    },
  );

  assert.throws(
    () => selectFixturePackageAt(fixturePackage, "2026-01-30T22:00:00.000Z"),
    (error) =>
      error instanceof FixtureConformanceError &&
      error.code === "FIXTURE_PROVENANCE_INVALID",
  );
});

test("PT-FIX-001E compares revisions beyond the safe integer range exactly", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      records[0].revision = "9007199254740992";
      records.push({
        ...structuredClone(records[0]),
        revision: "9007199254740993",
      });
    },
  );

  const selection = selectFixturePackageAt(
    fixturePackage,
    "2026-01-30T22:00:00.000Z",
  );

  assert.equal(selection.marketObservations[0].revision, "9007199254740993");
});

test("PT-FIX-001D/E returns market groups in canonical tuple order", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    (records) => {
      records.unshift({
        ...structuredClone(records[0]),
        instrumentId: "ZZZ",
      });
    },
  );
  const changedManifest = JSON.parse(fixturePackage.manifest.toString("utf8"));
  changedManifest.marketCoverage.push({
    adjustmentPolicy: "split-adjusted",
    instrumentId: "ZZZ",
    requiredTradingDates: ["2026-01-30"],
  });
  updateManifest(fixturePackage, changedManifest);

  const selection = selectFixturePackageAt(
    fixturePackage,
    "2026-01-30T22:00:00.000Z",
  );

  assert.deepEqual(
    selection.marketObservations.map(({ instrumentId }) => instrumentId),
    ["ETF-1", "ZZZ"],
  );
});

test("PT-FIX-001D/E returns economic groups in canonical tuple order", () => {
  const fixturePackage = packageWithRecordMutation(
    "economic-vintages.jsonl",
    (records) => {
      records.unshift({
        ...structuredClone(records[0]),
        providerId: "TREASURY_FISCAL_DATA",
        seriesId: "ZZZ",
      });
    },
  );
  const changedManifest = JSON.parse(fixturePackage.manifest.toString("utf8"));
  changedManifest.economicCoverage.push({
    observationDates: ["2025-12-01"],
    providerId: "TREASURY_FISCAL_DATA",
    seriesId: "ZZZ",
  });
  updateManifest(fixturePackage, changedManifest);

  const selection = selectFixturePackageAt(
    fixturePackage,
    "2026-01-30T22:00:00.000Z",
  );

  assert.deepEqual(
    selection.economicVintages.map(({ providerId, seriesId }) => [providerId, seriesId]),
    [["FRED", "CPI"], ["TREASURY_FISCAL_DATA", "ZZZ"]],
  );
});

for (const evaluationInstant of [
  "2026-01-30T22:00:00Z",
  "2026-01-30T22:00:00.000+00:00",
  "2026-02-30T22:00:00.000Z",
]) {
  test(`PT-FIX-001D/E rejects malformed evaluation instant ${evaluationInstant}`, () => {
    assert.throws(
      () => selectFixturePackageAt(goldenPackage(), evaluationInstant),
      (error) =>
        error instanceof FixtureConformanceError &&
        error.code === "FIXTURE_TEMPORAL_INVALID",
    );
  });
}

for (const relativePath of [
  "market-observations.jsonl",
  "economic-vintages.jsonl",
]) {
  test(`PT-FIX-001H rejects an unknown field in ${relativePath}`, () => {
    const fixturePackage = packageWithRecordMutation(relativePath, ([record]) => {
      record.unknown = true;
    });

    assertManifestInvalid(fixturePackage);
  });

  test(`PT-FIX-001H rejects a missing field in ${relativePath}`, () => {
    const fixturePackage = packageWithRecordMutation(relativePath, ([record]) => {
      delete record.qualityCodes;
    });

    assertManifestInvalid(fixturePackage);
  });
}

test("PT-FIX-001H structural failure controls over a dataset hash mismatch", () => {
  const fixturePackage = packageWithRecordMutation(
    "market-observations.jsonl",
    ([record]) => {
      record.unknown = true;
    },
  );
  const changedManifest = JSON.parse(fixturePackage.manifest.toString("utf8"));
  changedManifest.datasetHash = "0".repeat(64);
  fixturePackage.manifest = Buffer.from(canonicalizeJson(changedManifest), "utf8");

  assertManifestInvalid(fixturePackage);
});

for (const revision of ["01", "-1", "+1", "1.0", ""]) {
  test(`PT-FIX-001L rejects malformed market revision ${JSON.stringify(revision)}`, () => {
    const fixturePackage = packageWithRecordMutation(
      "market-observations.jsonl",
      ([record]) => {
        record.revision = revision;
      },
    );

    assertFixtureError(fixturePackage, "FIXTURE_TEMPORAL_INVALID");
  });
}

for (const [numericClass, currency, expectedCode] of [
  ["UnitPrice", "USD", undefined],
  ["Money", "USD", undefined],
  ["Quantity", "", undefined],
  ["Rate", "", undefined],
  ["UnitPrice", "", "FIXTURE_DECIMAL_INVALID"],
  ["Quantity", "USD", "FIXTURE_DECIMAL_INVALID"],
  ["Unknown", "", "FIXTURE_DECIMAL_INVALID"],
]) {
  test(`PT-FIX-001M validates ${numericClass} with currency ${JSON.stringify(currency)}`, () => {
    const fixturePackage = packageWithRecordMutation(
      "market-observations.jsonl",
      ([record]) => {
        record.numericClass = numericClass;
        record.currency = currency;
        record.value = numericClass === "Money"
          ? "100.00000000"
          : numericClass === "Rate"
            ? "100.000000000000"
            : "100.0000000000";
      },
    );

    if (expectedCode === undefined) {
      validateFixturePackage(fixturePackage);
    } else {
      assertFixtureError(fixturePackage, expectedCode);
    }
  });
}

for (const [numericClass, value, accepted] of [
  ["Quantity", "1.2300000000", true],
  ["UnitPrice", "100.0000000000", true],
  ["Money", "1000.00000000", true],
  ["Rate", "0.012500000000", true],
  ["UnitPrice", "999999999999999999.0000000000", true],
  ["UnitPrice", "-999999999999999999.0000000000", true],
  ["Money", "99999999999999999999.00000000", true],
  ["Rate", "9999999999999999.000000000000", true],
  ["UnitPrice", "0.0000000000", true],
  ["UnitPrice", "1000000000000000000.0000000000", false],
  ["Money", "100000000000000000000.00000000", false],
  ["Rate", "10000000000000000.000000000000", false],
  ["UnitPrice", "100.00000000001", false],
  ["UnitPrice", "100.0", false],
  ["UnitPrice", "1e2", false],
  ["UnitPrice", "0100.0000000000", false],
  ["UnitPrice", "+100.0000000000", false],
  ["UnitPrice", "-0.0000000000", false],
  ["Quantity", "-0.0000000000", false],
  ["Money", "-0.00000000", false],
  ["Rate", "-0.000000000000", false],
  ["Rate", "NaN", false],
  ["Rate", "Infinity", false],
  ["Rate", "-Infinity", false],
]) {
  test(`PT-FIX-001F validates ${numericClass} decimal ${value}`, () => {
    const fixturePackage = packageWithRecordMutation(
      "market-observations.jsonl",
      ([record]) => {
        record.numericClass = numericClass;
        record.value = value;
        record.currency = numericClass === "Money" || numericClass === "UnitPrice" ? "USD" : "";
      },
    );

    if (accepted) {
      validateFixturePackage(fixturePackage);
    } else {
      assertFixtureError(fixturePackage, "FIXTURE_DECIMAL_INVALID");
    }
  });
}

test("PT-FIX-001F validates economic decimal values with the same exact rules", () => {
  const fixturePackage = packageWithRecordMutation(
    "economic-vintages.jsonl",
    ([record]) => {
      record.value = "0.01250000000";
    },
  );

  assertFixtureError(fixturePackage, "FIXTURE_DECIMAL_INVALID");
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

test("PT-FIX-001H rejects a UTF-8 byte-order mark in the manifest", () => {
  assertManifestInvalid({
    ...goldenPackage(),
    manifest: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), manifest]),
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

test("fixture validation rejects records when all coverage date arrays are empty", () => {
  const fixturePackage = packageWithManifestMutation((value) => {
    value.datasetVersion = "2026.01.1";
    value.marketCoverage[0].requiredTradingDates = [];
    value.economicCoverage[0].observationDates = [];
  });

  assertFixtureError(fixturePackage, "FIXTURE_UNDECLARED_INPUT");
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

test("PT-FIX-001I rejects a raw-source path whose suffix differs from its bytes", () => {
  const wrongHash = "0".repeat(64);
  const wrongPath = `raw-sources/${wrongHash}`;
  const fixturePackage = packageWithManifestMutation(
    (value) => {
      value.datasetVersion = "2026.01.1";
      value.files[2].relativePath = wrongPath;
    },
    [`raw-sources/${rawSourceHash}`, wrongPath],
  );

  assertFixtureError(fixturePackage, "FIXTURE_FILE_INTEGRITY_FAILED");
});

for (const relativePath of [
  "economic-vintages.jsonl",
  "market-observations.jsonl",
]) {
  test(`PT-FIX-001I rejects a record-count mismatch for ${relativePath}`, () => {
    const fixturePackage = packageWithManifestMutation((value) => {
      value.datasetVersion = "2026.01.1";
      const descriptor = value.files.find((item) => item.relativePath === relativePath);
      descriptor.recordCount = 2;
    });

    assertFixtureError(fixturePackage, "FIXTURE_FILE_INTEGRITY_FAILED");
  });
}

for (const [name, changedBytes, recordCount] of [
  ["a missing trailing LF", market.subarray(0, market.length - 1), 1],
  ["more than one trailing LF", Buffer.concat([market, Buffer.from("\n")]), 1],
  ["CRLF line endings", Buffer.from(market.toString("utf8").replace("\n", "\r\n")), 1],
  ["a UTF-8 byte-order mark", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), market]), 1],
  ["invalid UTF-8", Buffer.from([0xff, 0x0a]), 1],
  ["a blank line", Buffer.concat([market, Buffer.from("\n"), market]), 2],
  ["a noncanonical record", Buffer.from(` ${market.toString("utf8")}`), 1],
  [
    "a duplicate record member",
    Buffer.from(
      market.toString("utf8").replace(
        '"instrumentId":"ETF-1",',
        '"instrumentId":"ETF-1","instrumentId":"ETF-1",',
      ),
      "utf8",
    ),
    1,
  ],
]) {
  test(`PT-FIX-001I rejects JSONL with ${name}`, () => {
    assertManifestInvalid(
      packageWithJsonlBytes("market-observations.jsonl", changedBytes, recordCount),
    );
  });
}

test("PT-FIX-001I rejects changed raw bytes under the original source path", () => {
  const changedRawSource = Buffer.from("changed local fixture source\n", "utf8");
  const fixturePackage = goldenPackage();
  const changedManifest = JSON.parse(manifest.toString("utf8"));
  changedManifest.datasetVersion = "2026.01.1";
  fixturePackage.files[`raw-sources/${rawSourceHash}`] = changedRawSource;
  changedManifest.files[2].byteLength = changedRawSource.byteLength;
  changedManifest.files[2].sha256 = sha256(changedRawSource);
  updateManifest(fixturePackage, changedManifest);

  assertFixtureError(fixturePackage, "FIXTURE_FILE_INTEGRITY_FAILED");
});

test("PT-FIX-001I rejects a missing governed raw-source object", () => {
  const fixturePackage = goldenPackage();
  const changedManifest = JSON.parse(manifest.toString("utf8"));
  changedManifest.datasetVersion = "2026.01.1";
  changedManifest.files.splice(2, 1);
  delete fixturePackage.files[`raw-sources/${rawSourceHash}`];
  updateManifest(fixturePackage, changedManifest);

  assertFixtureError(fixturePackage, "FIXTURE_PROVENANCE_INVALID");
});

for (const [name, mutate] of [
  ["unresolved source", (record) => {
    record.rawSourceHash = "1".repeat(64);
    record.rawSourceRef = `raw-sources/${record.rawSourceHash}`;
  }],
  ["external source reference", (record) => {
    record.rawSourceRef = "https://example.test/source?token=secret";
  }],
  ["mismatched source reference", (record) => {
    record.rawSourceRef = `raw-sources/${"1".repeat(64)}`;
  }],
  ["missing source hash", (record) => {
    delete record.rawSourceHash;
  }],
  ["missing source reference", (record) => {
    delete record.rawSourceRef;
  }],
  ["missing normalization identifier", (record) => {
    delete record.normalizationId;
  }],
  ["empty normalization identifier", (record) => {
    record.normalizationId = "";
  }],
  ["missing ingestion job identifier", (record) => {
    delete record.ingestionJobId;
  }],
  ["empty ingestion job identifier", (record) => {
    record.ingestionJobId = "";
  }],
]) {
  for (const relativePath of [
    "market-observations.jsonl",
    "economic-vintages.jsonl",
  ]) {
    test(`PT-FIX-001I rejects ${name} in ${relativePath}`, () => {
      const fixturePackage = packageWithRecordMutation(relativePath, ([record]) => {
        mutate(record);
      });

      assertFixtureError(fixturePackage, "FIXTURE_PROVENANCE_INVALID");
    });
  }
}
