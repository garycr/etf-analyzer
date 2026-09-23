import { spawnSync } from "node:child_process";

import { assertZeroSkipSummary } from "./zero-skip-runner-lib.mjs";

const testArguments = process.argv.slice(2);
if (testArguments.length === 0) {
  throw new Error("zero-skip runner requires Node test arguments");
}

const result = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=tap", ...testArguments],
  { encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 },
);
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error !== undefined) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
else assertZeroSkipSummary(result.stdout ?? "");
