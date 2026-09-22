import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const connectionString = process.env.ETF_TEST_POSTGRES_URL;

const ownerTestTitles = [
  "CT-LED-006 produces identical TypeScript and PostgreSQL canonical strings",
  "CT-LED-007 rejects invalid scale grammar and bounds before persistence",
  "0004 commits exact fixture authority and atomic replay behavior",
  "0004 rejects noncanonical physical values before PostgreSQL casts or sorting",
  "0005 atomically generates retention evidence and stable replay hashes",
  "PT-APP-001M rejects malformed operation records before owner dispatch",
];
const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function runOwnerTests(testTitles, testFiles) {
  const testNamePattern = `^(${testTitles.map(escapeRegExp).join("|")})$`;
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;

  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      process.execPath,
      ["--test", "--test-reporter=tap", `--test-name-pattern=${testNamePattern}`, ...testFiles],
      { cwd: workspaceRoot, env: childEnvironment, maxBuffer: 4 * 1024 * 1024 },
    ));
  } catch (error) {
    const failureOutput = [error.message, error.stdout, error.stderr].filter(Boolean).join("\n");
    assert.fail(failureOutput.replaceAll(connectionString, "[REDACTED_POSTGRES_URL]"));
  }

  for (const title of testTitles) {
    const escapedTitle = escapeRegExp(title);
    assert.match(stdout, new RegExp(`# Subtest: ${escapedTitle}\\n(?:.*\\n)*?ok \\d+ - ${escapedTitle}\\n`));
  }
  assert.match(stdout, new RegExp(`# tests ${testTitles.length}\\n`));
  assert.match(stdout, new RegExp(`# pass ${testTitles.length}\\n`));
  assert.match(stdout, /# fail 0\n/);
  assert.match(stdout, /# skipped 0\n/);
}

test(
  "CT-DB-001E exact values reject noncanonical input before PostgreSQL cast",
  { skip: !connectionString },
  async () => {
    await runOwnerTests(ownerTestTitles, [
      "tests/Integration/domain-ledger-migration.test.mjs",
      "tests/Integration/fixture-migration.test.mjs",
      "tests/Integration/analytics-evidence-migration.test.mjs",
      "tests/Unit/application-boundary.test.mjs",
    ]);
  },
);

test(
  "CT-DB-001F paper-order state replay and history are atomic",
  { skip: !connectionString },
  async () => {
    await runOwnerTests(
      ["CT-ORD-016 paper-order failures preserve the complete transition boundary"],
      ["tests/Integration/domain-ledger-migration.test.mjs"],
    );
  },
);

test(
  "CT-DB-001G ledger evidence is immutable anchored and projection-safe",
  { skip: !connectionString },
  async () => {
    await runOwnerTests(
      [
        "0003 commits its exact manifest and atomic anchored cash behavior",
        "CT-LED-010 rejects active dependencies and preserves immutable reversal lineage",
        "CT-LED-011 serializes races replay and rollback atomically",
        "CT-LED-014 commits or rolls back ledger and dual chains together",
        "CT-LED-016 publishes a verified projection and audit atomically",
        "CT-LED-017 blocks publication on integrity failure without replacing cache",
      ],
      ["tests/Integration/domain-ledger-migration.test.mjs"],
    );
  },
);

test(
  "CT-DB-001H fixture identity and provenance constraints reject ambiguity",
  { skip: !connectionString },
  async () => {
    await runOwnerTests(
      ["0004 commits exact fixture authority and atomic replay behavior"],
      ["tests/Integration/fixture-migration.test.mjs"],
    );
    await runOwnerTests(
      ["0004 preserves complete fixture state across H persistence failures"],
      ["tests/Integration/fixture-migration.test.mjs"],
    );
  },
);
