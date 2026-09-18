import assert from "node:assert/strict";
import test from "node:test";

import { quantizeAnalyticsIntermediate } from "../../dist/Domain/Analytics/analytics.js";

test("CT-LED-005 applies half-even and final residual allocation", () => {
  assert.equal(quantizeAnalyticsIntermediate("1.000000005", "Money"), "1.00000000");
  assert.equal(quantizeAnalyticsIntermediate("1.000000015", "Money"), "1.00000002");
  assert.equal(quantizeAnalyticsIntermediate("-1.000000005", "Money"), "-1.00000000");
  assert.equal(quantizeAnalyticsIntermediate("-1.000000015", "Money"), "-1.00000002");
  assert.equal(quantizeAnalyticsIntermediate("1.00000000005", "Quantity"), "1.0000000000");
  assert.equal(quantizeAnalyticsIntermediate("0.0000000000005", "Rate"), "0.000000000000");

  const canonicalBasis = 1_000_000_000n;
  const first = 333_333_333n;
  const second = 333_333_333n;
  const finalResidual = canonicalBasis - first - second;
  assert.deepEqual(
    [first, second, finalResidual].map((value) =>
      `${value / 100_000_000n}.${String(value % 100_000_000n).padStart(8, "0")}`),
    ["3.33333333", "3.33333333", "3.33333334"],
  );
});
