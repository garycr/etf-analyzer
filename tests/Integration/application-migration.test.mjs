import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { executeApplicationRequestAsync } from "../../dist/Application/application-boundary.js";
import { createPostgresApplicationReplayStore } from "../../dist/Infrastructure/PostgreSQL/application-replay-store.js";
import { applyMigration } from "../../dist/Infrastructure/PostgreSQL/migration-runner.js";
import {
  applicationFunctionNames,
  applicationMigration,
  applicationTableNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/application.js";
import { analyticsEvidenceMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/analytics-evidence.js";
import { controlledAccessMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/controlled-access.js";
import { denialBackendVerifierMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/denial-backend-verifier.js";
import { domainLedgerMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/domain-ledger.js";
import { fixtureMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";
import { foundationMigration } from "../../dist/Infrastructure/PostgreSQL/migrations/foundation.js";
import { dispatchPostgresJobRestart } from "../../dist/Infrastructure/PostgreSQL/job-restart-owner.js";
import { projectPostgresSchemaManifest } from "../../dist/Infrastructure/PostgreSQL/postgres-schema-manifest.js";
import {
  createRoleBootstrapSql,
  productRoles,
} from "../../dist/Infrastructure/PostgreSQL/role-bootstrap.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;
const fixtureLockSql =
  "SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";
const fixtureUnlockSql =
  "SELECT pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('etf:test:role-bootstrap', 0))";

async function cleanBootstrap(client) {
  await client.query("ROLLBACK").catch(() => undefined);
  await client.query("RESET ROLE").catch(() => undefined);
  await client.query("DROP SCHEMA IF EXISTS etf CASCADE");
  const existing = await client.query(
    `SELECT rolname FROM pg_catalog.pg_roles WHERE rolname = ANY($1::text[])`,
    [productRoles.map(({ name }) => name)],
  );
  const roleNames = existing.rows.map(({ rolname }) => rolname);
  if (roleNames.length > 0) {
    await client.query(`DROP OWNED BY ${roleNames.join(", ")}`);
    await client.query(`DROP ROLE ${roleNames.join(", ")}`);
  }
  await client.query(
    "DO $cleanup$ BEGIN EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO PUBLIC', current_database()); END $cleanup$;",
  );
}

test(
  "0002 preserves complete durable job state across CT-DB-001J restart cases",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    const jobIds = {
      restartable: "21000000-0000-4000-8000-000000000001",
      running: "21000000-0000-4000-8000-000000000002",
      notRestartable: "21000000-0000-4000-8000-000000000003",
      rollback: "21000000-0000-4000-8000-000000000004",
    };
    const commandIds = {
      success: "31000000-0000-4000-8000-000000000001",
      running: "31000000-0000-4000-8000-000000000002",
      notRestartable: "31000000-0000-4000-8000-000000000003",
      rollback: "31000000-0000-4000-8000-000000000004",
    };
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await client.query(createRoleBootstrapSql());
      const migrations = [
        foundationMigration,
        applicationMigration,
        domainLedgerMigration,
        fixtureMigration,
        analyticsEvidenceMigration,
        controlledAccessMigration,
        denialBackendVerifierMigration,
      ];
      for (const [index, migration] of migrations.entries()) {
        await applyMigration(
          client,
          migration,
          `2026-09-14T00:0${index}:00.000Z`,
          projectPostgresSchemaManifest,
        );
      }

      for (const [index, jobId] of Object.values(jobIds).entries()) {
        const running = jobId === jobIds.running;
        const notRestartable = jobId === jobIds.notRestartable;
        await client.query(
          `INSERT INTO etf.jobs (
             job_id, job_type, status, restartability, attempt, operation,
             original_command_id, input_identity, created_at, started_at,
             completed_at, accepted_count, rejected_count, controlling_error
           ) VALUES (
             $1, 'FixtureIngestion', $2, $3, 1, 'FixtureIngestionStart', $4,
             jsonb_build_object(
               'datasetId', 'release-fixture', 'datasetVersion', '1',
               'fixturePackageHash', repeat('a', 64)
             ),
             '2026-09-14T00:02:00.000Z', $5, $6, 3, 1, $7
           )`,
          [
            jobId,
            running ? "Running" : "Failed",
            notRestartable ? "NotRestartable" : "Restartable",
            `41000000-0000-4000-8000-00000000000${index + 1}`,
            running ? "2026-09-14T00:02:10.000Z" : null,
            running ? null : "2026-09-14T00:03:00.000Z",
            running ? null : { code: "APPLICATION_DEPENDENCY_UNAVAILABLE" },
          ],
        );
        await client.query(
          `INSERT INTO etf.job_checkpoints (
             job_id, checkpoint_id, attempt, sequence, committed_at, content_hash,
             effect_domain, first_effect_identity, last_effect_identity, effect_count
           ) VALUES ($1, $2, 1, 7, '2026-09-14T00:02:30.000Z', $3,
                     'FixtureObservation', 'prices:1', 'prices:3', 3)`,
          [
            jobId,
            `51000000-0000-4000-8000-00000000000${index + 1}`,
            `${index + 1}`.repeat(64),
          ],
        );
      }

      const snapshotState = async () => (await client.query(
        `SELECT jsonb_build_object(
           'jobs', (SELECT jsonb_agg(to_jsonb(job) ORDER BY job.job_id) FROM etf.jobs AS job),
           'checkpoints', (SELECT jsonb_agg(to_jsonb(checkpoint) ORDER BY checkpoint.job_id, checkpoint.attempt, checkpoint.sequence) FROM etf.job_checkpoints AS checkpoint),
           'replays', (SELECT jsonb_agg(to_jsonb(replay) ORDER BY replay.operation, replay.command_id) FROM etf.application_replays AS replay)
         ) AS state`,
      )).rows[0].state;
      const requestFor = (jobId, commandId, overrides = {}) => JSON.stringify({
        operation: "JobRestart",
        requestId: "61000000-0000-4000-8000-000000000001",
        correlationId: "61000000-0000-4000-8000-000000000002",
        actorId: "local-user",
        prototypeCandidate: "v1.0.0-prototype.1",
        contractVersion: "1.0.0-candidate.2",
        requestedAt: "2026-09-14T00:04:00.000Z",
        commandId,
        payload: { jobId },
        ...overrides,
      });
      const executeRestart = async (request, replayClient = client, ownerCalls) => {
        await client.query("SET SESSION AUTHORIZATION app_runtime");
        try {
          const result = await executeApplicationRequestAsync(request, {
            replayStore: createPostgresApplicationReplayStore(replayClient),
            completedAt: () => "2026-09-14T00:04:01.000Z",
            checkReadiness: () => undefined,
            ownerDispatch: (definition, payload, context) => {
              ownerCalls.count += 1;
              return dispatchPostgresJobRestart(client, definition, payload, context);
            },
          });
          return result;
        } finally {
          await client.query("RESET SESSION AUTHORIZATION");
        }
      };

      const successRequest = requestFor(jobIds.restartable, commandIds.success);
      const successCalls = { count: 0 };
      const success = await executeRestart(successRequest, client, successCalls);
      assert.equal(success.outcome, "Succeeded", JSON.stringify(success));
      assert.equal(success.data.job.attempt, "2");
      assert.equal(success.data.job.status, "Pending");
      assert.equal(success.data.job.checkpoint.sequence, "7");
      assert.equal(successCalls.count, 1);

      const committedState = await snapshotState();
      const replayCalls = { count: 0 };
      const equivalentReplay = await executeRestart(
        requestFor(jobIds.restartable, commandIds.success, {
          requestId: "61000000-0000-4000-8000-000000000003",
          correlationId: "61000000-0000-4000-8000-000000000004",
          requestedAt: "2026-09-14T00:05:00.000Z",
        }),
        client,
        replayCalls,
      );
      assert.deepEqual(equivalentReplay, success);
      assert.equal(replayCalls.count, 0);
      assert.deepEqual(await snapshotState(), committedState);

      const conflictCalls = { count: 0 };
      const conflict = await executeRestart(
        requestFor(jobIds.running, commandIds.success),
        client,
        conflictCalls,
      );
      assert.equal(conflict.error.code, "APPLICATION_IDEMPOTENCY_CONFLICT");
      assert.equal(conflictCalls.count, 0);
      assert.deepEqual(await snapshotState(), committedState);

      for (const vector of [
        [jobIds.running, commandIds.running],
        [jobIds.notRestartable, commandIds.notRestartable],
      ]) {
        const before = await snapshotState();
        const calls = { count: 0 };
        const refusal = await executeRestart(requestFor(...vector), client, calls);
        assert.equal(refusal.error.code, "APPLICATION_JOB_NOT_RESTARTABLE");
        assert.equal(calls.count, 1);
        const after = await snapshotState();
        assert.deepEqual(after.jobs, before.jobs);
        assert.deepEqual(after.checkpoints, before.checkpoints);
      }

      const beforeRollback = await snapshotState();
      const rollbackCalls = { count: 0 };
      const failingReplayClient = {
        query: async (sql, values) => {
          if (sql.includes("application_replay_get_or_put")) {
            throw new Error("forced replay persistence failure");
          }
          return client.query(sql, values);
        },
      };
      const rollback = await executeRestart(
        requestFor(jobIds.rollback, commandIds.rollback),
        failingReplayClient,
        rollbackCalls,
      );
      assert.equal(rollback.error.code, "APPLICATION_DEPENDENCY_UNAVAILABLE");
      assert.equal(rollbackCalls.count, 1);
      assert.deepEqual(await snapshotState(), beforeRollback);

      const retryCalls = { count: 0 };
      const committedRetry = await executeRestart(successRequest, client, retryCalls);
      assert.deepEqual(committedRetry, success);
      assert.equal(retryCalls.count, 0);
      assert.deepEqual(await snapshotState(), beforeRollback);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0002 rolls back its complete catalog on manifest failure",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await client.query(createRoleBootstrapSql());
      await applyMigration(
        client,
        foundationMigration,
        "2026-09-14T00:00:00.000Z",
        projectPostgresSchemaManifest,
      );
      const foundationLedger = (await client.query(
        "SELECT sequence, migration_id, content_hash, applied_at, schema_manifest_hash FROM etf.schema_migrations ORDER BY sequence",
      )).rows;

      await assert.rejects(
        applyMigration(
          client,
          applicationMigration,
          "2026-09-14T00:01:00.000Z",
          async () => {
            throw new Error("forced 0002 manifest stop");
          },
        ),
        /forced 0002 manifest stop/u,
      );

      const remaining = await client.query(
        `SELECT
           (SELECT count(*)::integer
              FROM pg_catalog.pg_class AS relation
              JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
             WHERE namespace.nspname = 'etf' AND relation.relname = ANY($1::text[])) AS table_count,
           (SELECT count(*)::integer
              FROM pg_catalog.pg_proc AS routine
              JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = routine.pronamespace
             WHERE namespace.nspname = 'etf' AND routine.proname = ANY($2::text[])) AS function_count,
           pg_catalog.has_schema_privilege('application_writer_owner', 'etf', 'CREATE') AS schema_create,
           COALESCE(
             pg_catalog.has_function_privilege(
               'app_runtime',
               pg_catalog.to_regprocedure('etf.application_replay_get_or_put(jsonb)'),
               'EXECUTE'
             ),
             false
           ) AS runtime_execute`,
        [applicationTableNames, applicationFunctionNames],
      );
      assert.deepEqual(remaining.rows, [{
        table_count: 0,
        function_count: 0,
        schema_create: false,
        runtime_execute: false,
      }]);
      assert.deepEqual((await client.query(
        "SELECT sequence, migration_id, content_hash, applied_at, schema_manifest_hash FROM etf.schema_migrations ORDER BY sequence",
      )).rows, foundationLedger);
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);

test(
  "0002 commits exact application objects and controlled behavior",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    await client.query(fixtureLockSql);
    try {
      await cleanBootstrap(client);
      await client.query(createRoleBootstrapSql());
      await applyMigration(
        client,
        foundationMigration,
        "2026-09-14T00:00:00.000Z",
        projectPostgresSchemaManifest,
      );
      let applicationManifest;
      const applicationApplied = await applyMigration(
        client,
        applicationMigration,
        "2026-09-14T00:01:00.000Z",
        async (transaction, migration) => {
          applicationManifest = await projectPostgresSchemaManifest(transaction, migration);
          return applicationManifest;
        },
      );
      assert.equal(
        applicationApplied.contentHash,
        "6ad48f730617fadff8ae80d58171c84707d9159af8f0186e71538861d92d730a",
      );
      assert.equal(
        applicationApplied.schemaManifestHash,
        "c043fad160e0b6690971b6cc4e9ffc8d10ca74a879a43360f86872c1f8eaf8c1",
      );
      assert.equal(Buffer.byteLength(applicationManifest, "utf8"), 8264);
      const manifest = JSON.parse(applicationManifest);
      assert.equal(manifest.migrationSequence.length, 2);
      assert.equal(manifest.objects.filter(({ kind }) => kind === "table").length, 10);
      assert.equal(manifest.objects.filter(({ kind }) => kind === "function").length, 6);
      assert.ok(
        manifest.grants.some(
          (grant) =>
            grant.objectKind === "schema" &&
            grant.schema === "etf" &&
            grant.grantee === "application_writer_owner" &&
            grant.privilege === "USAGE" &&
            grant.grantOption === false,
        ),
      );

      const tables = await client.query(
        `SELECT relation.relname AS name, owner.rolname AS owner
           FROM pg_catalog.pg_class AS relation
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = relation.relowner
          WHERE namespace.nspname = 'etf' AND relation.relkind = 'r'
            AND relation.relname = ANY($1::text[])
          ORDER BY relation.relname`,
        [applicationTableNames],
      );
      assert.deepEqual(
        tables.rows,
        [...applicationTableNames]
          .sort()
          .map((name) => ({ name, owner: "application_writer_owner" })),
      );

      const functions = await client.query(
        `SELECT function_record.proname AS name, owner.rolname AS owner,
                function_record.prosecdef AS security_definer,
                function_record.provolatile AS volatility,
                function_record.proparallel AS parallel_safety,
                function_record.proconfig AS configuration,
                pg_catalog.has_function_privilege('public', function_record.oid, 'EXECUTE') AS public_execute
           FROM pg_catalog.pg_proc AS function_record
           JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = function_record.proowner
          WHERE namespace.nspname = 'etf'
            AND function_record.proname = ANY($1::text[])
          ORDER BY function_record.proname`,
        [applicationFunctionNames],
      );
      assert.deepEqual(
        functions.rows,
        [...applicationFunctionNames].sort().map((name) => ({
          name,
          owner: "application_writer_owner",
          security_definer: true,
          volatility: "v",
          parallel_safety: "u",
          configuration: ["search_path=pg_catalog, etf"],
          public_execute: false,
        })),
      );

      const ownerSchemaPrivileges = await client.query(
        `SELECT pg_catalog.has_schema_privilege('application_writer_owner', 'etf', 'USAGE') AS usage,
                pg_catalog.has_schema_privilege('application_writer_owner', 'etf', 'CREATE') AS create`,
      );
      assert.deepEqual(ownerSchemaPrivileges.rows, [{ usage: true, create: false }]);

      const replay = await client.query(
        "SELECT etf.application_replay_get_or_put($1, $2, $3, $4) AS result",
        [
          "WatchlistPut",
          "10000000-0000-4000-8000-000000000001",
          '{"instrumentId":"SPY"}',
          '{"outcome":"Succeeded"}',
        ],
      );
      assert.deepEqual(replay.rows[0].result, { outcome: "Succeeded" });
      await assert.rejects(
        () =>
          client.query(
            "SELECT etf.application_replay_get_or_put($1, $2, $3, $4)",
            [
              "WatchlistPut",
              "10000000-0000-4000-8000-000000000002",
              "{invalid-json",
              '{"outcome":"Succeeded"}',
            ],
          ),
        /APPLICATION_REQUEST_INVALID/,
      );
      await assert.rejects(
        () =>
          client.query(
            "SELECT etf.application_replay_get_or_put($1, $2, $3, $4)",
            [
              "WatchlistPut",
              "10000000-0000-4000-8000-000000000001",
              '{"instrumentId":"QQQ"}',
              '{"outcome":"Succeeded"}',
            ],
          ),
        /APPLICATION_IDEMPOTENCY_CONFLICT/,
      );

      const firstWrite = await client.query(
        "SELECT etf.watchlist_write('WatchlistPut', $1::jsonb) AS result",
        [
          JSON.stringify({
            instrumentId: "SPY",
            displayName: "SPDR S&P 500 ETF Trust",
            validationState: "Valid",
            expectedVersion: 0,
          }),
        ],
      );
      assert.equal(firstWrite.rows[0].result.version, 1);
      for (const expectedVersion of [undefined, null]) {
        await assert.rejects(
          () =>
            client.query(
              "SELECT etf.watchlist_write('WatchlistPut', $1::jsonb)",
              [
                JSON.stringify({
                  instrumentId: "QQQ",
                  displayName: "Invesco QQQ Trust",
                  validationState: "Valid",
                  expectedVersion,
                }),
              ],
            ),
          /APPLICATION_REQUEST_INVALID/,
        );
      }

      const removed = await client.query(
        "SELECT etf.watchlist_write('WatchlistRemove', $1::jsonb) AS result",
        [JSON.stringify({ instrumentId: "SPY", expectedVersion: 1 })],
      );
      assert.equal(removed.rows[0].result.version, 2);
      assert.deepEqual(removed.rows[0].result.orderedItems, []);
      const writeAfterEmpty = await client.query(
        "SELECT etf.watchlist_write('WatchlistPut', $1::jsonb) AS result",
        [
          JSON.stringify({
            instrumentId: "QQQ",
            displayName: "Invesco QQQ Trust",
            validationState: "Valid",
            expectedVersion: 2,
          }),
        ],
      );
      assert.equal(writeAfterEmpty.rows[0].result.version, 3);

      const concurrentClient = new pg.Client({ connectionString });
      await concurrentClient.connect();
      try {
        const writes = await Promise.allSettled([
          client.query("SELECT etf.watchlist_write('WatchlistPut', $1::jsonb)", [
            JSON.stringify({
              instrumentId: "QQQ",
              displayName: "Invesco QQQ Trust",
              validationState: "Valid",
              expectedVersion: 3,
            }),
          ]),
          concurrentClient.query(
            "SELECT etf.watchlist_write('WatchlistPut', $1::jsonb)",
            [
              JSON.stringify({
                instrumentId: "DIA",
                displayName: "SPDR Dow Jones Industrial Average ETF Trust",
                validationState: "Valid",
                expectedVersion: 3,
              }),
            ],
          ),
        ]);
        assert.equal(writes.filter(({ status }) => status === "fulfilled").length, 1);
        assert.equal(writes.filter(({ status }) => status === "rejected").length, 1);
      } finally {
        await concurrentClient.end();
      }

      const started = await client.query(
        "SELECT etf.job_start($1::jsonb) AS result",
        [
          JSON.stringify({
            jobId: "20000000-0000-4000-8000-000000000001",
            jobType: "FixtureIngestion",
            restartability: "Restartable",
            operation: "FixtureIngestionStart",
            originalCommandId: "30000000-0000-4000-8000-000000000001",
            inputIdentity: { datasetId: "p0", datasetVersion: "1" },
            createdAt: "2026-09-14T00:02:00.000Z",
          }),
        ],
      );
      assert.equal(started.rows[0].result.status, "Pending");
      await assert.rejects(
        () =>
          client.query("SELECT etf.job_start($1::jsonb)", [
            JSON.stringify({
              jobId: "not-a-uuid",
              jobType: "FixtureIngestion",
              restartability: "Restartable",
              operation: "FixtureIngestionStart",
              originalCommandId: "30000000-0000-4000-8000-000000000002",
              inputIdentity: {},
              createdAt: "not-a-timestamp",
            }),
          ]),
        /APPLICATION_REQUEST_INVALID/,
      );
      await assert.rejects(
        () =>
          client.query("SELECT etf.job_restart($1::jsonb)", [
            JSON.stringify({ jobId: "not-a-uuid" }),
          ]),
        /APPLICATION_REQUEST_INVALID/,
      );
      await client.query(
        `INSERT INTO etf.job_checkpoints (
           job_id, checkpoint_id, attempt, sequence, committed_at, content_hash,
           effect_domain, first_effect_identity, last_effect_identity, effect_count
         ) VALUES (
           '20000000-0000-4000-8000-000000000001',
           '20000000-0000-4000-8000-000000000002', 1, 7,
           '2026-09-14T00:02:30.000Z', $1, 'FixtureObservation',
           'prices:1', 'prices:3', 3
         )`,
        ["a".repeat(64)],
      );
      await client.query(
        `UPDATE etf.jobs
            SET status = 'Failed', completed_at = '2026-09-14T00:03:00.000Z',
                accepted_count = 3, rejected_count = 1,
                controlling_error = '{"code":"APPLICATION_DEPENDENCY_UNAVAILABLE"}'::jsonb
          WHERE job_id = '20000000-0000-4000-8000-000000000001'`,
      );
      const restarted = await client.query(
        "SELECT etf.job_restart($1::jsonb) AS result",
        [JSON.stringify({ jobId: "20000000-0000-4000-8000-000000000001" })],
      );
      assert.deepEqual(restarted.rows[0].result, {
        jobId: "20000000-0000-4000-8000-000000000001",
        jobType: "FixtureIngestion",
        status: "Pending",
        restartability: "Restartable",
        attempt: "2",
        operation: "FixtureIngestionStart",
        originalCommandId: "30000000-0000-4000-8000-000000000001",
        inputIdentity: { datasetId: "p0", datasetVersion: "1" },
        createdAt: "2026-09-14T00:02:00.000Z",
        startedAt: null,
        completedAt: null,
        checkpoint: {
          checkpointId: "20000000-0000-4000-8000-000000000002",
          attempt: "1",
          sequence: "7",
          committedAt: "2026-09-14T00:02:30.000Z",
          contentHash: "a".repeat(64),
        },
        acceptedCount: "3",
        rejectedCount: "1",
        controllingError: null,
      });
      const committedEffects = await client.query(
        `SELECT count(*)::integer AS checkpoint_count,
                sum(effect_count)::integer AS effect_count
           FROM etf.job_checkpoints
          WHERE job_id = '20000000-0000-4000-8000-000000000001'`,
      );
      assert.deepEqual(committedEffects.rows[0], {
        checkpoint_count: 1,
        effect_count: 3,
      });

      for (const invalidState of [
        {
          status: "Running",
          restartability: "Restartable",
          startedAt: "2026-09-14T00:04:00.000Z",
          completedAt: null,
          controllingError: null,
        },
        {
          status: "Failed",
          restartability: "NotRestartable",
          startedAt: null,
          completedAt: "2026-09-14T00:05:00.000Z",
          controllingError: { code: "APPLICATION_DEPENDENCY_UNAVAILABLE" },
        },
      ]) {
        await client.query(
          `UPDATE etf.jobs
              SET status = $1, restartability = $2,
                  started_at = $3::timestamp with time zone,
                  completed_at = $4::timestamp with time zone,
                  controlling_error = $5::jsonb
            WHERE job_id = '20000000-0000-4000-8000-000000000001'`,
          [
            invalidState.status,
            invalidState.restartability,
            invalidState.startedAt,
            invalidState.completedAt,
            invalidState.controllingError,
          ],
        );
        const beforeRefusal = await client.query(
          `SELECT job.status, job.restartability, job.attempt,
                  job.accepted_count, job.rejected_count,
                  count(checkpoint.*)::integer AS checkpoint_count,
                  coalesce(sum(checkpoint.effect_count), 0)::integer AS effect_count
             FROM etf.jobs AS job
             LEFT JOIN etf.job_checkpoints AS checkpoint ON checkpoint.job_id = job.job_id
            WHERE job.job_id = '20000000-0000-4000-8000-000000000001'
            GROUP BY job.job_id`,
        );
        await assert.rejects(
          () =>
            client.query("SELECT etf.job_restart($1::jsonb)", [
              JSON.stringify({ jobId: "20000000-0000-4000-8000-000000000001" }),
            ]),
          /APPLICATION_JOB_NOT_RESTARTABLE/,
        );
        const afterRefusal = await client.query(
          `SELECT job.status, job.restartability, job.attempt,
                  job.accepted_count, job.rejected_count,
                  count(checkpoint.*)::integer AS checkpoint_count,
                  coalesce(sum(checkpoint.effect_count), 0)::integer AS effect_count
             FROM etf.jobs AS job
             LEFT JOIN etf.job_checkpoints AS checkpoint ON checkpoint.job_id = job.job_id
            WHERE job.job_id = '20000000-0000-4000-8000-000000000001'
            GROUP BY job.job_id`,
        );
        assert.deepEqual(afterRefusal.rows, beforeRefusal.rows);
      }

      await client.query(
        `UPDATE etf.jobs
            SET status = 'Failed', restartability = 'Restartable',
                started_at = NULL, completed_at = '2026-09-14T00:06:00.000Z',
                controlling_error = '{"code":"APPLICATION_DEPENDENCY_UNAVAILABLE"}'::jsonb
          WHERE job_id = '20000000-0000-4000-8000-000000000001'`,
      );
      const beforeRace = await client.query(
        `SELECT job.attempt::integer AS attempt,
          count(checkpoint.*)::integer AS checkpoint_count,
                coalesce(sum(checkpoint.effect_count), 0)::integer AS effect_count
           FROM etf.jobs AS job
           LEFT JOIN etf.job_checkpoints AS checkpoint ON checkpoint.job_id = job.job_id
          WHERE job.job_id = '20000000-0000-4000-8000-000000000001'
          GROUP BY job.job_id`,
      );
      const concurrentRestartClient = new pg.Client({ connectionString });
      await concurrentRestartClient.connect();
      try {
        const restartRequest = JSON.stringify({
          jobId: "20000000-0000-4000-8000-000000000001",
        });
        const restartRace = await Promise.allSettled([
          client.query("SELECT etf.job_restart($1::jsonb) AS result", [restartRequest]),
          concurrentRestartClient.query(
            "SELECT etf.job_restart($1::jsonb) AS result",
            [restartRequest],
          ),
        ]);
        assert.equal(
          restartRace.filter(({ status }) => status === "fulfilled").length,
          1,
        );
        assert.equal(
          restartRace.filter(({ status }) => status === "rejected").length,
          1,
        );
        assert.match(
          restartRace.find(({ status }) => status === "rejected").reason.message,
          /APPLICATION_JOB_NOT_RESTARTABLE/,
        );
      } finally {
        await concurrentRestartClient.end();
      }
      const afterRace = await client.query(
        `SELECT job.status, job.attempt::integer AS attempt,
                count(checkpoint.*)::integer AS checkpoint_count,
                coalesce(sum(checkpoint.effect_count), 0)::integer AS effect_count
           FROM etf.jobs AS job
           LEFT JOIN etf.job_checkpoints AS checkpoint ON checkpoint.job_id = job.job_id
          WHERE job.job_id = '20000000-0000-4000-8000-000000000001'
          GROUP BY job.job_id`,
      );
      assert.deepEqual(afterRace.rows[0], {
        status: "Pending",
        attempt: beforeRace.rows[0].attempt + 1,
        checkpoint_count: beforeRace.rows[0].checkpoint_count,
        effect_count: beforeRace.rows[0].effect_count,
      });

      const readinessId = "40000000-0000-4000-8000-000000000001";
      const readiness = await client.query(
        "SELECT etf.readiness_append($1::jsonb) AS readiness_id",
        [
          JSON.stringify({
            readinessId,
            state: "Ready",
            checkedAt: "2026-09-14T00:04:00.000Z",
            displayTimezone: "UTC",
            liveness: "Live",
            dependencies: [
              { dependency: "PostgreSQL", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
              { dependency: "Migrations", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
              { dependency: "FixturePolicy", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
              { dependency: "LocalDependency", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
              { dependency: "DenialAudit", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
              { dependency: "LedgerIntegrity", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
            ],
            controllingError: null,
          }),
        ],
      );
      assert.equal(readiness.rows[0].readiness_id, readinessId);
      await assert.rejects(
        () =>
          client.query("SELECT etf.readiness_append($1::jsonb)", [
            JSON.stringify({
              readinessId: "40000000-0000-4000-8000-000000000004",
              state: "Unknown",
              checkedAt: "2026-09-14T00:04:00.000Z",
              displayTimezone: "UTC",
              liveness: "Unknown",
              dependencies: [
                { dependency: "PostgreSQL", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
                { dependency: "Migrations", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
                { dependency: "FixturePolicy", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
                { dependency: "LocalDependency", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
                { dependency: "DenialAudit", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
                { dependency: "LedgerIntegrity", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
              ],
              controllingError: null,
            }),
          ]),
        /APPLICATION_REQUEST_INVALID/,
      );
      await assert.rejects(
        () =>
          client.query("SELECT etf.readiness_append($1::jsonb)", [
            JSON.stringify({
              readinessId: "40000000-0000-4000-8000-000000000002",
              state: "Ready",
              checkedAt: "2026-09-14T00:04:00.000Z",
              displayTimezone: "UTC",
              liveness: "Live",
              dependencies: [],
              controllingError: null,
            }),
          ]),
        /APPLICATION_REQUEST_INVALID/,
      );
      await assert.rejects(
        () =>
          client.query("SELECT etf.readiness_append($1::jsonb)", [
            JSON.stringify({
              readinessId: "40000000-0000-4000-8000-000000000003",
              state: "Ready",
              checkedAt: "not-a-timestamp",
              displayTimezone: "UTC",
              liveness: "Live",
              dependencies: [
                { dependency: "PostgreSQL", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
                { dependency: "Migrations", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
                { dependency: "FixturePolicy", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
                { dependency: "LocalDependency", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
                { dependency: "DenialAudit", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
                { dependency: "LedgerIntegrity", state: "Ready", checkedAt: "2026-09-14T00:04:00.000Z", code: null },
              ],
              controllingError: null,
            }),
          ]),
        /APPLICATION_REQUEST_INVALID/,
      );
    } finally {
      try {
        await cleanBootstrap(client);
      } finally {
        await client.query(fixtureUnlockSql);
        await client.end();
      }
    }
  },
);
