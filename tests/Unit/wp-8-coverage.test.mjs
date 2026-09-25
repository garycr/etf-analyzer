import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { apiRoutes, resolveApiRoute } from "../../dist/Infrastructure/Http/api-adapter.js";
import {
  assertBusinessCoverage,
  discoverBusinessFiles,
  parseLineCoverage,
  parseTestCount,
} from "../../scripts/wp-8-coverage-lib.mjs";

const coveragePath = process.env.ETF_COVERAGE_REPORT;
const expectedRoutes = [
  ["PUT", "/api/v1/watchlist/items/ETF1", "WatchlistPut"],
  ["DELETE", "/api/v1/watchlist/items/ETF1", "WatchlistRemove"],
  ["PUT", "/api/v1/watchlist/order", "WatchlistReorder"],
  ["POST", "/api/v1/fixture-ingestions", "FixtureIngestionStart"],
  ["POST", "/api/v1/jobs/10000000-0000-4000-8000-000000000001/restart", "JobRestart"],
  ["POST", "/api/v1/analytics/runs", "AnalyticsRun"],
  ["POST", "/api/v1/paper-orders", "PaperOrderDraftCreate"],
  ["POST", "/api/v1/paper-orders/10000000-0000-4000-8000-000000000002/transitions", "PaperOrderTransition"],
  ["POST", "/api/v1/diagnostic-exports", "DiagnosticsExportCreate"],
  ["GET", "/api/v1/watchlist", "WatchlistGet"],
  ["GET", "/api/v1/jobs/10000000-0000-4000-8000-000000000003", "JobGet"],
  ["GET", "/api/v1/readiness", "ReadinessGet"],
  ["GET", "/api/v1/analytics/results/10000000-0000-4000-8000-000000000004", "AnalyticsResultGet"],
  ["GET", "/api/v1/evidence?evidenceId=10000000-0000-4000-8000-000000000005", "EvidenceGet"],
  ["GET", "/api/v1/paper-orders/10000000-0000-4000-8000-000000000006", "PaperOrderGet"],
  ["GET", "/api/v1/portfolios/10000000-0000-4000-8000-000000000007?asOf=2026-09-17", "PortfolioGet"],
];

test(
  "PT-COVERAGE-001 meets business logic and public endpoint coverage gates",
  { skip: coveragePath === undefined },
  async () => {
    const report = await readFile(coveragePath, "utf8");
    assertBusinessCoverage(report, discoverBusinessFiles());

    const passCount = parseTestCount(report, "pass");
    assert.notEqual(passCount, undefined);
    assert.ok(passCount > 0);
    assert.equal(parseTestCount(report, "fail"), 0);
    assert.equal(parseTestCount(report, "skipped"), 0);

    assert.equal(apiRoutes.length, 16);
    assert.deepEqual(
      expectedRoutes.map(([method, target]) => resolveApiRoute(method, target)?.operation),
      expectedRoutes.map(([, , operation]) => operation),
    );
    assert.equal(new Set(expectedRoutes.map(([, , operation]) => operation)).size, 16);
    assert.equal(resolveApiRoute("PATCH", "/api/v1/watchlist"), undefined);
    assert.equal(resolveApiRoute("GET", "/api/v1/unknown"), undefined);
    assert.equal(resolveApiRoute("GET", "/api/v2/readiness"), undefined);
  },
);

test("PT-COVERAGE-001 parses complete paths and rejects missing or sub-threshold files", () => {
  const report = [
    "ℹ dist | | | |",
    "ℹ  Application | | | |",
    "ℹ   foundation.js | 80.00 | 80.00 | 80.00 |",
    "ℹ  Domain | | | |",
    "ℹ   Nested | | | |",
    "ℹ    foundation.js | 79.99 | 80.00 | 80.00 |",
  ].join("\n");

  assert.deepEqual([...parseLineCoverage(report)], [
    ["dist/Application/foundation.js", 80],
    ["dist/Domain/Nested/foundation.js", 79.99],
  ]);
  assert.doesNotThrow(() => assertBusinessCoverage(report, ["dist/Application/foundation.js"]));
  assert.throws(
    () => assertBusinessCoverage(report, ["dist/Domain/Nested/foundation.js"]),
    /79\.99% must be at least 80%/u,
  );
  assert.throws(
    () => assertBusinessCoverage(report, ["dist/Domain/missing.js"]),
    /must appear in the Node coverage report/u,
  );
  assert.throws(
    () => assertBusinessCoverage("malformed", ["dist/Application/foundation.js"]),
    /must appear in the Node coverage report/u,
  );
  assert.throws(
    () => assertBusinessCoverage(report, []),
    /No compiled Domain or Application/u,
  );
  assert.throws(
    () => assertBusinessCoverage(report, ["dist/Application/foundation.js"], Number.NaN),
    /Coverage threshold must be between 0 and 100/u,
  );

  const flatReport = [
    "\u001B[36mℹ\u001B[39m dist/Application/analytics-evidence-service.js | 91.43 | 81.16 | 100.00 |",
    "\u001B[36mℹ\u001B[39m dist/Domain/Analytics/analytics.js | 90.09 | 87.02 | 88.33 |",
  ].join("\n");
  assert.deepEqual([...parseLineCoverage(flatReport)], [
    ["dist/Application/analytics-evidence-service.js", 91.43],
    ["dist/Domain/Analytics/analytics.js", 90.09],
  ]);

  const tapCommentReport = [
    "# dist/Application/analytics-evidence-service.js | 91.43 | 81.16 | 100.00 |",
    "# dist/Domain/Analytics/analytics.js | 90.09 | 87.02 | 88.33 |",
  ].join("\n");
  assert.deepEqual([...parseLineCoverage(tapCommentReport)], [
    ["dist/Application/analytics-evidence-service.js", 91.43],
    ["dist/Domain/Analytics/analytics.js", 90.09],
  ]);

  assert.equal(parseTestCount("ℹ pass 426", "pass"), 426);
  assert.equal(parseTestCount("# pass 426", "pass"), 426);
  assert.equal(parseTestCount("# fail 0", "fail"), 0);
  assert.equal(parseTestCount("# skipped 0", "skipped"), 0);
  assert.equal(parseTestCount("pass 426", "pass"), 426);
  assert.equal(parseTestCount("\u001B[36m#\u001B[39m pass 426", "pass"), 426);
  assert.equal(parseTestCount("# pass 426 extra", "pass"), undefined);
  assert.equal(parseTestCount("# tests 426", "pass"), undefined);
  assert.throws(() => parseTestCount("# pass 426", "tests"), /Unsupported test count/u);
  assert.throws(
    () => parseTestCount("# pass 426\n# pass 425", "pass"),
    /Duplicate pass test count/u,
  );
  assert.throws(
    () => parseLineCoverage(`${flatReport}\n${flatReport.split("\n")[0]}`),
    /Duplicate coverage row: dist\/Application\/analytics-evidence-service\.js/u,
  );
});
