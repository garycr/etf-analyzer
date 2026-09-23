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
  assert.equal(process.versions.node.split(".")[0], "20");
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
  const summary = Object.fromEntries(
    [...stdout.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gmu)]
      .map(([, key, value]) => [key, Number(value)]),
  );
  assert.equal(summary.fail, 0);
  assert.equal(summary.cancelled, 0);
  assert.equal(summary.todo, 0);
}

for (const title of [
  "CT-DB-001A an empty database reaches the exact candidate schema",
  "CT-DB-001B migration replay is deterministic and drift fails closed",
  "CT-DB-001C a failed migration leaves no partial candidate state",
  "CT-DB-001D roles and controlled operations enforce least privilege",
]) {
  test(title, { skip: !connectionString }, async () => {
    await runOwnerTests([title], ["tests/Integration/controlled-access-migration.test.mjs"]);
  });
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

test(
  "CT-DB-001I analytics evidence publishes only complete verified bundles",
  { skip: !connectionString },
  async () => {
    await runOwnerTests(
      [
        "0005 preserves complete analytics state across CT-DB-001I failures",
        "0005 applies analytics validation precedence before publication persistence",
      ],
      ["tests/Integration/analytics-evidence-migration.test.mjs"],
    );
  },
);

test(
  "CT-DB-001J job state and checkpoints resume without duplicate effects",
  { skip: !connectionString },
  async () => {
    await runOwnerTests(
      ["0002 preserves complete durable job state across CT-DB-001J restart cases"],
      ["tests/Integration/application-migration.test.mjs"],
    );
  },
);

test(
  "CT-DB-001K readiness reflects connectivity migration and security state",
  { skip: !connectionString },
  async () => {
    await runOwnerTests(
      [
        "CT-DB-001K migration readiness accepts only the canonical seven-row ledger",
        "CT-DB-001K migration readiness rejects PUBLIC function execution",
        "CT-DB-001K schema readiness rejects manifest drift and projector failure",
        "CT-DB-001K denial-audit probe uses the authenticated audit role and always rolls back",
        "CT-DB-001K ledger probe rejects an unverifiable protected checkpoint",
        "CT-DB-001K composes the four PostgreSQL-owned readiness members",
        "CT-DB-001K composer preserves connectivity versus migration drift classification",
      ],
      ["tests/Unit/postgres-readiness.test.mjs"],
    );
  },
);

test(
  "CT-DB-001L the prototype schema contains no durable handoff",
  { skip: !connectionString },
  async () => {
    await runOwnerTests(
      [
        "migration preflight rejects extensions and durable handoff objects",
        "CT-DB-001L classifies durable handoff object names without contract confounders",
      ],
      ["tests/Unit/migration-set.test.mjs"],
    );
    await runOwnerTests(
      ["CT-DB-001A an empty database reaches the exact candidate schema"],
      ["tests/Integration/controlled-access-migration.test.mjs"],
    );
  },
);
