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
