import assert from "node:assert/strict";
import test from "node:test";

import { assertZeroSkipSummary, parseTestSummary } from "../../scripts/zero-skip-runner-lib.mjs";

const passingSummary = `TAP version 13
# tests 12
# suites 0
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 100
`;

test("zero-skip runner accepts one complete passing Node test summary", () => {
  assert.deepEqual(parseTestSummary(passingSummary), {
    tests: 12,
    pass: 12,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
  });
  assert.doesNotThrow(() => assertZeroSkipSummary(passingSummary));
});

test("zero-skip runner rejects skipped incomplete duplicate and inconsistent summaries", () => {
  for (const [name, report] of [
    ["skipped", passingSummary.replace("# pass 12", "# pass 11").replace("# skipped 0", "# skipped 1")],
    ["cancelled", passingSummary.replace("# pass 12", "# pass 11").replace("# cancelled 0", "# cancelled 1")],
    ["todo", passingSummary.replace("# pass 12", "# pass 11").replace("# todo 0", "# todo 1")],
    ["failed", passingSummary.replace("# pass 12", "# pass 11").replace("# fail 0", "# fail 1")],
    ["missing", passingSummary.replace("# skipped 0\n", "")],
    ["duplicate", `${passingSummary}# pass 12\n`],
    ["inconsistent", passingSummary.replace("# tests 12", "# tests 13")],
    ["zero tests", passingSummary.replaceAll("12", "0")],
  ]) {
    assert.throws(() => assertZeroSkipSummary(report), Error, name);
  }
});
