import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalizeJson } from "../../dist/Infrastructure/CanonicalJson/canonical-json.js";
import {
  AnalyticsError,
  canonicalizeAnalyticsDecimal,
  createCanonicalAnalyticsEvidence,
  hashCanonicalAnalyticsRecord,
  quantizeAnalyticsIntermediate,
  selectPointInTimeAnalyticsInput,
} from "../../dist/Domain/Analytics/analytics.js";

const goldenInput = {
  domain: "etf.analytics.input.v1",
  economicVintages: [
    {
      observationDate: "2025-12-01",
      providerId: "FRED",
      releaseTimestamp: "2026-01-15T13:30:00.000Z",
      seriesId: "CPI",
      value: "300.0000000000",
      vintageId: "v1",
    },
  ],
  evaluationAt: "2026-01-31T00:00:00.000Z",
  inputSchemaVersion: "1.0.0",
  marketObservations: [
    {
      adjustmentPolicy: "split-adjusted",
      instrumentId: "ETF-1",
      providerId: "fixture",
      revision: "1",
      sourceAvailableAt: "2026-01-30T22:00:00.000Z",
      tradingDate: "2026-01-30",
      value: "100.0000000000",
    },
  ],
  portfolioContextHash: "74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b",
  transformationLineage: [],
};

const goldenConfiguration = {
  assumptions: {
    costRate: "0.001000000000",
    fillTiming: "next-session-open",
    slippageRate: "0.000500000000",
  },
  baselineVersion: "v1.0.0",
  benchmark: { instrumentId: "BENCH-1", version: "1" },
  codeHash: "1111111111111111111111111111111111111111111111111111111111111111",
  domain: "etf.analytics.configuration.v1",
  environment: {
    dependencyLockHash: "2222222222222222222222222222222222222222222222222222222222222222",
    runtime: "python-3.13",
  },
  evaluationAt: "2026-01-31T00:00:00.000Z",
  inputHash: "cca3db225eaa64d91b3c971b2d366ef7fb8bc0a860b7081349ac622920e5f4fa",
  parameters: { lookbackSessions: "20" },
  providerPolicyReferences: ["fixture-policy-1"],
  ruleId: "p0-rule",
  ruleVersion: "1.0.0",
  seed: "42",
};

const goldenResult = {
  configurationHash: "fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37",
  domain: "etf.analytics.result.v1",
  metrics: [
    { metricId: "totalReturn", numericClass: "Rate", value: "0.010000000000" },
  ],
  resultSchemaVersion: "1.0.0",
  signals: [
    { instrumentId: "ETF-1", label: "Neutral", score: "0.000000000000" },
  ],
  trades: [],
  warnings: [],
};

function hashJson(value) {
  return createHash("sha256").update(canonicalizeJson(value), "utf8").digest("hex");
}

function evidenceChain(input, configuration, result) {
  const linkedConfiguration = { ...configuration, inputHash: hashJson(input) };
  const linkedResult = { ...result, configurationHash: hashJson(linkedConfiguration) };
  const evidence = createCanonicalAnalyticsEvidence({
    configuration: linkedConfiguration,
    input,
    result: linkedResult,
  });
  const lifecycle = {
    domain: "etf.analytics.lifecycle.v1",
    eventAt: input.evaluationAt,
    lifecycleSequence: 0,
    state: "Hot",
  };
  const eventHash = hashCanonicalAnalyticsRecord(lifecycle, "etf.analytics.lifecycle.v1").hash;
  const bundle = {
    ...linkedConfiguration,
    configurationHash: evidence.configurationHash,
    domain: "etf.analytics.bundle.v1",
    evidenceId: "evidence-fixture-1",
    evidenceSchemaVersion: "1.0.0",
    inputSetId: "input-fixture-1",
    reproducibilityReason: null,
    reproducibilityStatus: "Complete",
    result: linkedResult,
    resultHash: evidence.resultHash,
    retentionEpoch: input.evaluationAt,
    retentionPolicyVersion: "RET-A-1.0",
  };
  const bundleHash = hashCanonicalAnalyticsRecord(bundle, "etf.analytics.bundle.v1").hash;
  const manifest = {
    baselineVersion: linkedConfiguration.baselineVersion,
    bundleHash,
    configurationHash: evidence.configurationHash,
    deletionCertificateLinks: [],
    domain: "etf.analytics.manifest.v1",
    evidenceId: "evidence-fixture-1",
    evidenceSchemaVersion: "1.0.0",
    inputHash: evidence.inputHash,
    lifecycleReferences: [{ eventAt: lifecycle.eventAt, eventHash, lifecycleSequence: 0, state: "Hot" }],
    manifestId: "manifest-fixture-1",
    manifestSequence: 0,
    previousManifestHash: null,
    reproducibilityReason: null,
    reproducibilityStatus: "Complete",
    resultHash: evidence.resultHash,
    retentionEpoch: input.evaluationAt,
    retentionPolicyVersion: "RET-A-1.0",
  };
  return {
    ...evidence,
    bundle,
    bundleHash,
    manifestHash: hashCanonicalAnalyticsRecord(manifest, "etf.analytics.manifest.v1").hash,
  };
}

test("PT-ANA-001-GOLDEN reproduces canonical P0 input, configuration, and result", () => {
  const first = createCanonicalAnalyticsEvidence({
    configuration: goldenConfiguration,
    input: goldenInput,
    result: goldenResult,
  });
  const second = createCanonicalAnalyticsEvidence({
    configuration: structuredClone(goldenConfiguration),
    input: structuredClone(goldenInput),
    result: structuredClone(goldenResult),
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    configurationBytes: '{"assumptions":{"costRate":"0.001000000000","fillTiming":"next-session-open","slippageRate":"0.000500000000"},"baselineVersion":"v1.0.0","benchmark":{"instrumentId":"BENCH-1","version":"1"},"codeHash":"1111111111111111111111111111111111111111111111111111111111111111","domain":"etf.analytics.configuration.v1","environment":{"dependencyLockHash":"2222222222222222222222222222222222222222222222222222222222222222","runtime":"python-3.13"},"evaluationAt":"2026-01-31T00:00:00.000Z","inputHash":"cca3db225eaa64d91b3c971b2d366ef7fb8bc0a860b7081349ac622920e5f4fa","parameters":{"lookbackSessions":"20"},"providerPolicyReferences":["fixture-policy-1"],"ruleId":"p0-rule","ruleVersion":"1.0.0","seed":"42"}',
    configurationHash: "fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37",
    inputBytes: '{"domain":"etf.analytics.input.v1","economicVintages":[{"observationDate":"2025-12-01","providerId":"FRED","releaseTimestamp":"2026-01-15T13:30:00.000Z","seriesId":"CPI","value":"300.0000000000","vintageId":"v1"}],"evaluationAt":"2026-01-31T00:00:00.000Z","inputSchemaVersion":"1.0.0","marketObservations":[{"adjustmentPolicy":"split-adjusted","instrumentId":"ETF-1","providerId":"fixture","revision":"1","sourceAvailableAt":"2026-01-30T22:00:00.000Z","tradingDate":"2026-01-30","value":"100.0000000000"}],"portfolioContextHash":"74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b","transformationLineage":[]}',
    inputHash: "cca3db225eaa64d91b3c971b2d366ef7fb8bc0a860b7081349ac622920e5f4fa",
    resultBytes: '{"configurationHash":"fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37","domain":"etf.analytics.result.v1","metrics":[{"metricId":"totalReturn","numericClass":"Rate","value":"0.010000000000"}],"resultSchemaVersion":"1.0.0","signals":[{"instrumentId":"ETF-1","label":"Neutral","score":"0.000000000000"}],"trades":[],"warnings":[]}',
    resultHash: "4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18",
  });
  assert.ok(Object.isFrozen(first));
});

test("PT-ANA-001-GOLDEN reproduces transformation, lifecycle, bundle, and manifest hashes", () => {
  const lifecycle = {
    domain: "etf.analytics.lifecycle.v1",
    eventAt: goldenInput.evaluationAt,
    lifecycleSequence: 0,
    state: "Hot",
  };
  const bundle = {
    ...goldenConfiguration,
    configurationHash: "fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37",
    domain: "etf.analytics.bundle.v1",
    evidenceId: "evidence-fixture-1",
    evidenceSchemaVersion: "1.0.0",
    inputSetId: "input-fixture-1",
    reproducibilityReason: null,
    reproducibilityStatus: "Complete",
    result: goldenResult,
    resultHash: "4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18",
    retentionEpoch: goldenInput.evaluationAt,
    retentionPolicyVersion: "RET-A-1.0",
  };
  const manifest = {
    baselineVersion: "v1.0.0",
    bundleHash: "20f33dce407668ea1d60f9367af21e4cd1d968d46475f32dac709da7842fc3e6",
    configurationHash: "fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37",
    deletionCertificateLinks: [],
    domain: "etf.analytics.manifest.v1",
    evidenceId: "evidence-fixture-1",
    evidenceSchemaVersion: "1.0.0",
    inputHash: "cca3db225eaa64d91b3c971b2d366ef7fb8bc0a860b7081349ac622920e5f4fa",
    lifecycleReferences: [{
      eventAt: lifecycle.eventAt,
      eventHash: "68d6a985505e451a7d6adda9fbf40dd3ba4085edfe7867876a72aacd324e9808",
      lifecycleSequence: lifecycle.lifecycleSequence,
      state: lifecycle.state,
    }],
    manifestId: "manifest-fixture-1",
    manifestSequence: 0,
    previousManifestHash: null,
    reproducibilityReason: null,
    reproducibilityStatus: "Complete",
    resultHash: "4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18",
    retentionEpoch: goldenInput.evaluationAt,
    retentionPolicyVersion: "RET-A-1.0",
  };
  const transformation = {
    algorithmId: "forward-fill",
    algorithmVersion: "1.0.0",
    domain: "etf.analytics.transformation.v1",
    numericClass: "Quantity",
    outputValue: "100.0000000000",
    parameters: { maximumGapSessions: "1" },
    parentTransformationIds: [],
    sourceObservationIds: ["market|5:ETF-1|10:2026-01-30|7:fixture|14:split-adjusted|1:1"],
    transformationId: "transform-fixture-1",
  };

  for (const [record, domain, byteLength, hash] of [
    [transformation, "etf.analytics.transformation.v1", 355, "238e3d87efe0349fbab3fb70ea4b800e0488db24b8d902874dd1a4608ceca998"],
    [lifecycle, "etf.analytics.lifecycle.v1", 112, "68d6a985505e451a7d6adda9fbf40dd3ba4085edfe7867876a72aacd324e9808"],
    [bundle, "etf.analytics.bundle.v1", 1456, "20f33dce407668ea1d60f9367af21e4cd1d968d46475f32dac709da7842fc3e6"],
    [manifest, "etf.analytics.manifest.v1", 893, "78469b3c9f981b9ffa5752120718bd7baa81e2156a007dbc5f8fbcf49139f4f8"],
  ]) {
    const canonical = hashCanonicalAnalyticsRecord(record, domain);
    assert.equal(Buffer.byteLength(canonical.bytes, "utf8"), byteLength);
    assert.equal(canonical.hash, hash);
    assert.ok(Object.isFrozen(canonical));
  }
});

test("PT-ANA-002-ECONOMIC-CUTOFF selects the greatest release at or before evaluation", () => {
  const selected = selectPointInTimeAnalyticsInput({
    economicVintages: [
      { ...goldenInput.economicVintages[0], releaseTimestamp: "2026-01-30T23:59:59.999Z", vintageId: "before" },
      { ...goldenInput.economicVintages[0], releaseTimestamp: goldenInput.evaluationAt, vintageId: "at" },
      { ...goldenInput.economicVintages[0], releaseTimestamp: "2026-01-31T00:00:00.001Z", vintageId: "future" },
    ],
    evaluationAt: goldenInput.evaluationAt,
    marketObservations: goldenInput.marketObservations,
    marketRevisionOrder: "fixture-integer",
  });

  assert.equal(selected.economicVintages.length, 1);
  assert.equal(selected.economicVintages[0].vintageId, "at");
  assert.doesNotMatch(JSON.stringify(selected), /future/);
  assert.ok(Object.isFrozen(selected.economicVintages));
});

test("CT-ANA-003 rejects tied latest economic vintages without reviewed ordering", () => {
  assert.throws(
    () => selectPointInTimeAnalyticsInput({
      economicVintages: [
        { ...goldenInput.economicVintages[0], vintageId: "a" },
        { ...goldenInput.economicVintages[0], vintageId: "b" },
      ],
      evaluationAt: goldenInput.evaluationAt,
      marketObservations: goldenInput.marketObservations,
      marketRevisionOrder: "fixture-integer",
    }),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_AMBIGUOUS_VINTAGE",
  );
});

test("PT-ANA-003A-MARKET-ORDER selects integer revision at T and fails without an order", () => {
  const revisions = [
    { ...goldenInput.marketObservations[0], revision: "9", sourceAvailableAt: "2026-01-30T21:00:00.000Z" },
    { ...goldenInput.marketObservations[0], revision: "10", sourceAvailableAt: goldenInput.evaluationAt },
    { ...goldenInput.marketObservations[0], revision: "11", sourceAvailableAt: "2026-01-31T00:00:00.001Z" },
  ];
  const selected = selectPointInTimeAnalyticsInput({
    economicVintages: goldenInput.economicVintages,
    evaluationAt: goldenInput.evaluationAt,
    marketObservations: revisions,
    marketRevisionOrder: "fixture-integer",
  });

  assert.equal(selected.marketObservations.length, 1);
  assert.equal(selected.marketObservations[0].revision, "10");
  assert.throws(
    () => selectPointInTimeAnalyticsInput({
      economicVintages: goldenInput.economicVintages,
      evaluationAt: goldenInput.evaluationAt,
      marketObservations: revisions.slice(0, 2),
      marketRevisionOrder: undefined,
    }),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_AMBIGUOUS_MARKET_REVISION",
  );
});

test("PT-ANA-018-PROTOTYPE-NUMERIC enforces canonical classes and half-even boundaries", () => {
  assert.equal(canonicalizeAnalyticsDecimal("1.25", "Quantity"), "1.2500000000");
  assert.equal(canonicalizeAnalyticsDecimal("1.25", "Money"), "1.25000000");
  assert.equal(canonicalizeAnalyticsDecimal("1.25", "Rate"), "1.250000000000");
  assert.equal(canonicalizeAnalyticsDecimal("-0.000", "Rate"), "0.000000000000");

  assert.equal(quantizeAnalyticsIntermediate("1.00000000005", "Quantity"), "1.0000000000");
  assert.equal(quantizeAnalyticsIntermediate("1.00000000015", "Quantity"), "1.0000000002");
  assert.equal(quantizeAnalyticsIntermediate("1.000000005", "Money"), "1.00000000");
  assert.equal(quantizeAnalyticsIntermediate("1.000000015", "Money"), "1.00000002");
  assert.equal(quantizeAnalyticsIntermediate("0.0000000000005", "Rate"), "0.000000000000");
  assert.equal(quantizeAnalyticsIntermediate("0.0000000000015", "Rate"), "0.000000000002");

  for (const value of ["1e-3", "+1", " 1", "NaN", "1.0000000000001"]) {
    assert.throws(
      () => canonicalizeAnalyticsDecimal(value, "Rate"),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_NUMERIC_CLASS_INVALID",
    );
  }
  assert.throws(
    () => canonicalizeAnalyticsDecimal("10000000000000000.000000000000", "Rate"),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_NUMERIC_CLASS_INVALID",
  );
});

test("point-in-time selection rejects non-canonical instants before comparison", () => {
  for (const request of [
    { evaluationAt: "2026-01-31T00:00:00Z" },
    { economicVintages: [{ ...goldenInput.economicVintages[0], releaseTimestamp: "2026-01-15T13:30:00Z" }] },
    { marketObservations: [{ ...goldenInput.marketObservations[0], sourceAvailableAt: "2026-01-30T22:00:00+00:00" }] },
  ]) {
    assert.throws(
      () => selectPointInTimeAnalyticsInput({
        economicVintages: goldenInput.economicVintages,
        evaluationAt: goldenInput.evaluationAt,
        marketObservations: goldenInput.marketObservations,
        marketRevisionOrder: "fixture-integer",
        ...request,
      }),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INPUT_INCOMPLETE",
    );
  }
});

test("canonical evidence rejects open, null, unordered, and duplicate records", () => {
  const invalidCases = [
    { input: { ...goldenInput, unknown: true } },
    { input: { ...goldenInput, marketObservations: null } },
    {
      input: {
        ...goldenInput,
        marketObservations: [{ ...goldenInput.marketObservations[0], currency: "USD" }],
      },
    },
    {
      result: {
        ...goldenResult,
        metrics: [
          { metricId: "z", numericClass: "Rate", value: "0.000000000000" },
          { metricId: "a", numericClass: "Rate", value: "0.000000000000" },
        ],
      },
    },
    {
      result: {
        ...goldenResult,
        signals: [goldenResult.signals[0], goldenResult.signals[0]],
      },
    },
  ];

  for (const invalid of invalidCases) {
    assert.throws(
      () => createCanonicalAnalyticsEvidence({
        configuration: goldenConfiguration,
        input: goldenInput,
        result: goldenResult,
        ...invalid,
      }),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
    );
  }
});

test("standalone analytics hash domains reject open records", () => {
  assert.throws(
    () => hashCanonicalAnalyticsRecord({}, "etf.analytics.unknown.v1"),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );
  assert.throws(
    () => hashCanonicalAnalyticsRecord({
      algorithmId: "forward-fill",
      algorithmVersion: "1.0.0",
      domain: "etf.analytics.transformation.v1",
      numericClass: "Quantity",
      outputValue: "100.0000000000",
      parameters: { maximumGapSessions: "1" },
      parentTransformationIds: [],
      sourceObservationIds: [],
      transformationId: "transform-1",
      unknown: true,
    }, "etf.analytics.transformation.v1"),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );
  assert.throws(
    () => hashCanonicalAnalyticsRecord({
      domain: "etf.analytics.lifecycle.v1",
      eventAt: goldenInput.evaluationAt,
      lifecycleSequence: 0,
      state: "Hot",
      subjectId: "not-allowed",
    }, "etf.analytics.lifecycle.v1"),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );
});

test("PT-ANA-005-MUTATION changes only applicable hash domains", () => {
  const baseline = createCanonicalAnalyticsEvidence({
    configuration: goldenConfiguration,
    input: goldenInput,
    result: goldenResult,
  });
  const changedInput = {
    ...goldenInput,
    marketObservations: [{ ...goldenInput.marketObservations[0], value: "101.0000000000" }],
  };
  const inputConfiguration = {
    ...goldenConfiguration,
    inputHash: hashJson(changedInput),
  };
  const inputResult = {
    ...goldenResult,
    configurationHash: hashJson(inputConfiguration),
  };
  const afterInput = createCanonicalAnalyticsEvidence({
    configuration: inputConfiguration,
    input: changedInput,
    result: inputResult,
  });
  assert.notEqual(afterInput.inputHash, baseline.inputHash);
  assert.notEqual(afterInput.configurationHash, baseline.configurationHash);
  assert.notEqual(afterInput.resultHash, baseline.resultHash);

  const changedConfiguration = {
    ...goldenConfiguration,
    parameters: { lookbackSessions: "21" },
  };
  const configurationResult = {
    ...goldenResult,
    configurationHash: hashJson(changedConfiguration),
  };
  const afterConfiguration = createCanonicalAnalyticsEvidence({
    configuration: changedConfiguration,
    input: goldenInput,
    result: configurationResult,
  });
  assert.equal(afterConfiguration.inputHash, baseline.inputHash);
  assert.notEqual(afterConfiguration.configurationHash, baseline.configurationHash);
  assert.notEqual(afterConfiguration.resultHash, baseline.resultHash);

  const afterResult = createCanonicalAnalyticsEvidence({
    configuration: goldenConfiguration,
    input: goldenInput,
    result: {
      ...goldenResult,
      metrics: [{ ...goldenResult.metrics[0], value: "0.020000000000" }],
    },
  });
  assert.equal(afterResult.inputHash, baseline.inputHash);
  assert.equal(afterResult.configurationHash, baseline.configurationHash);
  assert.notEqual(afterResult.resultHash, baseline.resultHash);

  const baselineChain = evidenceChain(goldenInput, goldenConfiguration, goldenResult);
  const inputChain = evidenceChain(changedInput, goldenConfiguration, goldenResult);
  const configurationChain = evidenceChain(goldenInput, changedConfiguration, goldenResult);
  const resultChain = evidenceChain(goldenInput, goldenConfiguration, {
    ...goldenResult,
    metrics: [{ ...goldenResult.metrics[0], value: "0.020000000000" }],
  });
  for (const field of ["inputHash", "configurationHash", "resultHash", "bundleHash", "manifestHash"]) {
    assert.notEqual(inputChain[field], baselineChain[field]);
  }
  assert.equal(configurationChain.inputHash, baselineChain.inputHash);
  for (const field of ["configurationHash", "resultHash", "bundleHash", "manifestHash"]) {
    assert.notEqual(configurationChain[field], baselineChain[field]);
  }
  assert.equal(resultChain.inputHash, baselineChain.inputHash);
  assert.equal(resultChain.configurationHash, baselineChain.configurationHash);
  for (const field of ["resultHash", "bundleHash", "manifestHash"]) {
    assert.notEqual(resultChain[field], baselineChain[field]);
  }
});

test("point-in-time identity ties reject conflicting content independent of input order", () => {
  const economicConflict = [
    goldenInput.economicVintages[0],
    { ...goldenInput.economicVintages[0], value: "301.0000000000" },
  ];
  const marketConflict = [
    goldenInput.marketObservations[0],
    { ...goldenInput.marketObservations[0], value: "101.0000000000" },
  ];

  for (const records of [economicConflict, [...economicConflict].reverse()]) {
    assert.throws(
      () => selectPointInTimeAnalyticsInput({
        economicVintages: records,
        evaluationAt: goldenInput.evaluationAt,
        marketObservations: goldenInput.marketObservations,
        marketRevisionOrder: "fixture-integer",
      }),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_AMBIGUOUS_VINTAGE",
    );
  }
  for (const records of [marketConflict, [...marketConflict].reverse()]) {
    assert.throws(
      () => selectPointInTimeAnalyticsInput({
        economicVintages: goldenInput.economicVintages,
        evaluationAt: goldenInput.evaluationAt,
        marketObservations: records,
        marketRevisionOrder: "fixture-integer",
      }),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_AMBIGUOUS_MARKET_REVISION",
    );
  }

  const newerEconomic = {
    ...goldenInput.economicVintages[0],
    releaseTimestamp: "2026-01-20T13:30:00.000Z",
    vintageId: "v2",
  };
  for (const records of [
    [newerEconomic, ...economicConflict],
    [...economicConflict, newerEconomic],
  ]) {
    assert.throws(
      () => selectPointInTimeAnalyticsInput({
        economicVintages: records,
        evaluationAt: goldenInput.evaluationAt,
        marketObservations: goldenInput.marketObservations,
        marketRevisionOrder: "fixture-integer",
      }),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_AMBIGUOUS_VINTAGE",
    );
  }

  const newerMarket = {
    ...goldenInput.marketObservations[0],
    revision: "2",
    value: "102.0000000000",
  };
  for (const records of [
    [newerMarket, ...marketConflict],
    [...marketConflict, newerMarket],
  ]) {
    assert.throws(
      () => selectPointInTimeAnalyticsInput({
        economicVintages: goldenInput.economicVintages,
        evaluationAt: goldenInput.evaluationAt,
        marketObservations: records,
        marketRevisionOrder: "fixture-integer",
      }),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_AMBIGUOUS_MARKET_REVISION",
    );
  }

  const exactDuplicates = selectPointInTimeAnalyticsInput({
    economicVintages: [goldenInput.economicVintages[0], structuredClone(goldenInput.economicVintages[0])],
    evaluationAt: goldenInput.evaluationAt,
    marketObservations: [goldenInput.marketObservations[0], structuredClone(goldenInput.marketObservations[0])],
    marketRevisionOrder: "fixture-integer",
  });
  assert.equal(exactDuplicates.economicVintages.length, 1);
  assert.equal(exactDuplicates.marketObservations.length, 1);
});

test("analytics records enforce dates, hashes, numeric classes, enums, and nested hashes", () => {
  const invalidEvidence = [
    { input: { ...goldenInput, marketObservations: [{ ...goldenInput.marketObservations[0], tradingDate: "2026-02-30" }] } },
    { input: { ...goldenInput, economicVintages: [{ ...goldenInput.economicVintages[0], value: "3e2" }] } },
    { configuration: { ...goldenConfiguration, codeHash: "not-a-hash" } },
    { configuration: { ...goldenConfiguration, assumptions: { ...goldenConfiguration.assumptions, fillTiming: "same-close" } } },
    { result: { ...goldenResult, signals: [{ ...goldenResult.signals[0], label: "Hold" }] } },
    { result: { ...goldenResult, metrics: [{ ...goldenResult.metrics[0], numericClass: "Money" }] } },
    { input: { ...goldenInput, transformationLineage: [{}] } },
  ];
  for (const invalid of invalidEvidence) {
    assert.throws(
      () => createCanonicalAnalyticsEvidence({
        configuration: goldenConfiguration,
        input: goldenInput,
        result: goldenResult,
        ...invalid,
      }),
      (error) => error instanceof AnalyticsError,
    );
  }

  assert.throws(
    () => hashCanonicalAnalyticsRecord({
      domain: "etf.analytics.lifecycle.v1",
      eventAt: goldenInput.evaluationAt,
      lifecycleSequence: 0,
      state: "Unknown",
    }, "etf.analytics.lifecycle.v1"),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );

  const invalidBundle = {
    ...goldenConfiguration,
    configurationHash: "0".repeat(64),
    domain: "etf.analytics.bundle.v1",
    evidenceId: "evidence-fixture-1",
    evidenceSchemaVersion: "1.0.0",
    inputSetId: "input-fixture-1",
    reproducibilityReason: null,
    reproducibilityStatus: "Complete",
    result: goldenResult,
    resultHash: "4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18",
    retentionEpoch: goldenInput.evaluationAt,
    retentionPolicyVersion: "RET-A-1.0",
  };
  assert.throws(
    () => hashCanonicalAnalyticsRecord(invalidBundle, "etf.analytics.bundle.v1"),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );

  assert.throws(
    () => hashCanonicalAnalyticsRecord({
      baselineVersion: "v1.0.0",
      bundleHash: "20f33dce407668ea1d60f9367af21e4cd1d968d46475f32dac709da7842fc3e6",
      configurationHash: goldenResult.configurationHash,
      deletionCertificateLinks: [],
      domain: "etf.analytics.manifest.v1",
      evidenceId: "evidence-fixture-1",
      evidenceSchemaVersion: "1.0.0",
      inputHash: goldenConfiguration.inputHash,
      lifecycleReferences: [{ eventAt: goldenInput.evaluationAt, eventHash: "0".repeat(64), lifecycleSequence: 0, state: "Hot" }],
      manifestId: "manifest-fixture-1",
      manifestSequence: 0,
      previousManifestHash: null,
      reproducibilityReason: null,
      reproducibilityStatus: "Complete",
      resultHash: "4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18",
      retentionEpoch: goldenInput.evaluationAt,
      retentionPolicyVersion: "RET-A-1.0",
    }, "etf.analytics.manifest.v1"),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );

  const lifecycle = {
    domain: "etf.analytics.lifecycle.v1",
    eventAt: goldenInput.evaluationAt,
    lifecycleSequence: 0,
    state: "Hot",
  };
  const validManifest = {
    baselineVersion: "v1.0.0",
    bundleHash: "20f33dce407668ea1d60f9367af21e4cd1d968d46475f32dac709da7842fc3e6",
    configurationHash: goldenResult.configurationHash,
    deletionCertificateLinks: [],
    domain: "etf.analytics.manifest.v1",
    evidenceId: "evidence-fixture-1",
    evidenceSchemaVersion: "1.0.0",
    inputHash: goldenConfiguration.inputHash,
    lifecycleReferences: [{
      eventAt: lifecycle.eventAt,
      eventHash: hashCanonicalAnalyticsRecord(lifecycle, "etf.analytics.lifecycle.v1").hash,
      lifecycleSequence: 0,
      state: "Hot",
    }],
    manifestId: "manifest-fixture-1",
    manifestSequence: 1,
    previousManifestHash: "1".repeat(64),
    reproducibilityReason: null,
    reproducibilityStatus: "Complete",
    resultHash: "4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18",
    retentionEpoch: goldenInput.evaluationAt,
    retentionPolicyVersion: "RET-A-1.0",
  };
  for (const manifest of [
    { ...validManifest, reproducibilityReason: "missing-source", reproducibilityStatus: "Complete" },
    { ...validManifest, previousManifestHash: "not-a-hash" },
  ]) {
    assert.throws(
      () => hashCanonicalAnalyticsRecord(manifest, "etf.analytics.manifest.v1"),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
    );
  }

  assert.throws(
    () => hashCanonicalAnalyticsRecord({
      ...evidenceChain(goldenInput, goldenConfiguration, goldenResult).bundle,
      reproducibilityReason: "",
      reproducibilityStatus: "Degraded",
    }, "etf.analytics.bundle.v1"),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );
});

test("CT-ANA-004 validates embedded transformation hashes, sources, and topology", () => {
  const sourceId = "market|5:ETF-1|10:2026-01-30|7:fixture|14:split-adjusted|1:1";
  const transformation = {
    algorithmId: "forward-fill",
    algorithmVersion: "1.0.0",
    domain: "etf.analytics.transformation.v1",
    numericClass: "Quantity",
    outputValue: "100.0000000000",
    parameters: { maximumGapSessions: "1" },
    parentTransformationIds: [],
    sourceObservationIds: [sourceId],
    transformationId: "transform-a",
  };
  const embedded = { ...transformation, outputHash: hashJson(transformation) };
  assert.doesNotThrow(() => evidenceChain({
    ...goldenInput,
    transformationLineage: [embedded],
  }, goldenConfiguration, goldenResult));

  for (const transformationLineage of [
    [{ ...embedded, outputHash: "0".repeat(64) }],
    [{ ...embedded, sourceObservationIds: ["market|7:missing"] }],
    [{ ...embedded, parentTransformationIds: ["transform-a"] }],
  ]) {
    assert.throws(
      () => evidenceChain({ ...goldenInput, transformationLineage }, goldenConfiguration, goldenResult),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
    );
  }

  const siblingB = { ...transformation, transformationId: "transform-b" };
  const embeddedB = { ...siblingB, outputHash: hashJson(siblingB) };
  assert.throws(
    () => evidenceChain({
      ...goldenInput,
      transformationLineage: [embeddedB, embedded],
    }, goldenConfiguration, goldenResult),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );
});

test("analytics admission bounds decimals, revisions, and transformation graphs", () => {
  assert.throws(
    () => quantizeAnalyticsIntermediate("1".repeat(65), "Money"),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_NUMERIC_CLASS_INVALID",
  );
  assert.throws(
    () => selectPointInTimeAnalyticsInput({
      economicVintages: goldenInput.economicVintages,
      evaluationAt: goldenInput.evaluationAt,
      marketObservations: [{ ...goldenInput.marketObservations[0], revision: "1".repeat(29) }],
      marketRevisionOrder: "fixture-integer",
    }),
    (error) => error instanceof AnalyticsError,
  );

  const sourceObservationIds = ["market|5:ETF-1|10:2026-01-30|7:fixture|14:split-adjusted|1:1"];
  const transformationLineage = Array.from({ length: 1_001 }, (_, index) => {
    const transformation = {
      algorithmId: "forward-fill",
      algorithmVersion: "1.0.0",
      domain: "etf.analytics.transformation.v1",
      numericClass: "Quantity",
      outputValue: "100.0000000000",
      parameters: { maximumGapSessions: "1" },
      parentTransformationIds: [],
      sourceObservationIds,
      transformationId: `transform-${String(index).padStart(4, "0")}`,
    };
    return { ...transformation, outputHash: hashJson(transformation) };
  });
  assert.throws(
    () => evidenceChain({ ...goldenInput, transformationLineage }, goldenConfiguration, goldenResult),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );
  assert.throws(
    () => selectPointInTimeAnalyticsInput({
      economicVintages: [],
      evaluationAt: goldenInput.evaluationAt,
      marketObservations: Array(10_001).fill(goldenInput.marketObservations[0]),
      marketRevisionOrder: "fixture-integer",
    }),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );

  const validBundle = evidenceChain(goldenInput, goldenConfiguration, goldenResult).bundle;
  assert.throws(
    () => hashCanonicalAnalyticsRecord({
      ...validBundle,
      reproducibilityReason: "R".repeat(4_097),
      reproducibilityStatus: "Degraded",
    }, "etf.analytics.bundle.v1"),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INTEGRITY_FAILED",
  );
});
