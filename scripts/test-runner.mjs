import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const readinessTest = "tests/Integration/postgres-readiness.test.mjs";
const excludedIntegrationTests = new Set([
  "postgres-readiness.test.mjs",
  "workbench-accessibility.test.mjs",
]);

async function testFiles(directory, excluded = new Set()) {
  return (await readdir(directory))
    .filter((fileName) => fileName.endsWith(".test.mjs") && !excluded.has(fileName))
    .sort()
    .map((fileName) => `${directory}/${fileName}`);
}

function runTests(files) {
  const result = spawnSync(process.execPath, ["--test", ...files], {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runTests([readinessTest]);
runTests([
  ...await testFiles("tests/Unit"),
  ...await testFiles("tests/Integration", excludedIntegrationTests),
]);
