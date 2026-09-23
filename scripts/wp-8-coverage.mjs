import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "etf-wp-8-coverage-"));
const reportPath = join(temporaryDirectory, "unit-coverage.txt");

try {
  const testFiles = readdirSync("tests/Unit")
    .filter((file) => file.endsWith(".test.mjs") && file !== "wp-8-coverage.test.mjs")
    .map((file) => join("tests/Unit", file));
  const coverage = spawnSync(
    process.execPath,
    ["--test", "--experimental-test-coverage", ...testFiles],
    { encoding: "utf8" },
  );

  process.stdout.write(coverage.stdout);
  process.stderr.write(coverage.stderr);
  if (coverage.status !== 0) {
    process.exitCode = coverage.status ?? 1;
  } else {
    writeFileSync(reportPath, coverage.stdout, "utf8");
    const gate = spawnSync(process.execPath, ["--test", "tests/Unit/wp-8-coverage.test.mjs"], {
      encoding: "utf8",
      env: { ...process.env, ETF_COVERAGE_REPORT: reportPath },
    });
    process.stdout.write(gate.stdout);
    process.stderr.write(gate.stderr);
    process.exitCode = gate.status ?? 1;
  }
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
