import assert from "node:assert/strict";
import test from "node:test";

import { parseManualPriceCsv } from "../../dist/Application/manual-price-csv.js";

const validCsv = [
  "instrumentId,tradingDate,value,providerId,sourceAvailableAt,revision,adjustmentPolicy",
  "ETF-1,2026-09-28,100.0000000000,manual,2026-09-28T16:00:00.000Z,1,split-adjusted",
].join("\n");

test("manual price CSV produces canonical market observations and source identity", () => {
  const result = parseManualPriceCsv(validCsv, {
    ingestionJobId: "manual-upload-1",
    normalizationId: "manual-price-csv@1.0.0",
  });

  assert.equal(result.rawSourceHash.length, 64);
  assert.equal(result.rawSourceRef, `raw-sources/${result.rawSourceHash}`);
  assert.deepEqual(result.marketObservations, [{
    adjustmentPolicy: "split-adjusted",
    currency: "USD",
    ingestionJobId: "manual-upload-1",
    instrumentId: "ETF-1",
    normalizationId: "manual-price-csv@1.0.0",
    numericClass: "UnitPrice",
    providerId: "manual",
    qualityCodes: [],
    qualityState: "Valid",
    rawSourceHash: result.rawSourceHash,
    rawSourceRef: result.rawSourceRef,
    revision: "1",
    sourceAvailableAt: "2026-09-28T16:00:00.000Z",
    tradingDate: "2026-09-28",
    value: "100.0000000000",
  }]);
});

test("manual price CSV rejects an unexpected header", () => {
  assert.throws(
    () => parseManualPriceCsv(validCsv.replace("value", "close"), {
      ingestionJobId: "manual-upload-1",
      normalizationId: "manual-price-csv@1.0.0",
    }),
    /MANUAL_PRICE_CSV_INVALID/u,
  );
});

test("manual price CSV rejects duplicates and invalid canonical values", () => {
  const duplicate = `${validCsv}\nETF-1,2026-09-28,100.0000000000,manual,2026-09-28T16:00:00.000Z,1,split-adjusted`;
  const options = { ingestionJobId: "manual-upload-1", normalizationId: "manual-price-csv@1.0.0" };
  assert.throws(() => parseManualPriceCsv(duplicate, options), /MANUAL_PRICE_CSV_DUPLICATE/u);
  assert.throws(
    () => parseManualPriceCsv(validCsv.replace("100.0000000000", "100"), options),
    /MANUAL_PRICE_CSV_INVALID/u,
  );
  assert.throws(
    () => parseManualPriceCsv(validCsv.replace("2026-09-28", "2026-9-28"), options),
    /MANUAL_PRICE_CSV_INVALID/u,
  );
});

test("manual price CSV accepts BOM, CRLF, quoted fields, and escaped quotes", () => {
  const csv = [
    "instrumentId,tradingDate,value,providerId,sourceAvailableAt,revision,adjustmentPolicy",
    '"ETF-1","2026-09-28","100.0000000000","manual","2026-09-28T16:00:00.000Z","1","split-adjusted"',
    '"ETF-2","2026-09-29","101.0000000000","manual ""daily""","2026-09-29T16:00:00.000Z","0","split-adjusted"',
    "",
  ].join("\r\n");

  const result = parseManualPriceCsv(`\uFEFF${csv}`, {
    ingestionJobId: "manual-upload-2",
    normalizationId: "manual-price-csv@1.0.0",
  });

  assert.equal(result.marketObservations.length, 2);
  assert.equal(result.marketObservations[1].providerId, 'manual "daily"');
});

test("manual price CSV rejects empty options and malformed quoting", () => {
  const options = { ingestionJobId: "manual-upload-1", normalizationId: "manual-price-csv@1.0.0" };
  assert.throws(() => parseManualPriceCsv("", options), /MANUAL_PRICE_CSV_INVALID/u);
  assert.throws(() => parseManualPriceCsv(validCsv, { ...options, ingestionJobId: "" }), /MANUAL_PRICE_CSV_INVALID/u);
  assert.throws(() => parseManualPriceCsv(validCsv.replace("ETF-1", '"ETF-1'), options), /MANUAL_PRICE_CSV_INVALID/u);
  assert.throws(() => parseManualPriceCsv(validCsv.replace("ETF-1", '"ETF-1"x'), options), /MANUAL_PRICE_CSV_INVALID/u);
});

test("manual price CSV rejects invalid calendar, timestamp, policy, and empty fields", () => {
  const options = { ingestionJobId: "manual-upload-1", normalizationId: "manual-price-csv@1.0.0" };
  for (const replacement of [
    ["2026-09-28", "2026-02-30"],
    ["2026-09-28T16:00:00.000Z", "2026-09-28T16:00:00Z"],
    ["split-adjusted", "raw"],
    [",1,split-adjusted", ",01,split-adjusted"],
    ["ETF-1,2026-09-28,100.0000000000", "ETF-1,2026-09-28,"],
  ]) {
    assert.throws(
      () => parseManualPriceCsv(validCsv.replace(replacement[0], replacement[1]), options),
      /MANUAL_PRICE_CSV_INVALID/u,
    );
  }
});
