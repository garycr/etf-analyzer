import assert from "node:assert/strict";
import test from "node:test";

import {
  runtimeQueryFunctionNames,
  runtimeQueriesMigration,
} from "../../dist/Infrastructure/PostgreSQL/migrations/runtime-queries.js";

test("runtime query migration adds the three missing controlled read functions", () => {
  assert.equal(runtimeQueriesMigration.sequence, 8);
  assert.equal(runtimeQueriesMigration.migrationId, "0008-runtime-queries");
  assert.deepEqual(runtimeQueryFunctionNames, [
    "analytics_result_get",
    "readiness_get",
    "watchlist_get",
  ]);

  for (const [functionName, signature] of [
    ["analytics_result_get", "uuid"],
    ["readiness_get", ""],
    ["watchlist_get", ""],
  ]) {
    assert.match(
      runtimeQueriesMigration.sql,
      new RegExp(`CREATE FUNCTION etf\\.${functionName}\\([^)]*\\) RETURNS jsonb[\\s\\S]*?SECURITY DEFINER`),
    );
    assert.match(runtimeQueriesMigration.sql, /IF session_user <> 'app_runtime'/u);
    assert.match(
      runtimeQueriesMigration.sql,
      new RegExp(`REVOKE ALL ON FUNCTION etf\\.${functionName}\\(${signature}\\) FROM PUBLIC;`),
    );
    assert.match(
      runtimeQueriesMigration.sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION etf\\.${functionName}\\(${signature}\\) TO app_runtime;`),
    );
  }
});
