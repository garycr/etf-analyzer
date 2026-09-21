import { createHash, randomUUID } from "node:crypto";

import { prepareMigrationSet } from "./migration-set.js";
import { projectCurrentPostgresSchemaManifest } from "./postgres-schema-manifest.js";
import { analyticsEvidenceMigration } from "./migrations/analytics-evidence.js";
import { applicationMigration } from "./migrations/application.js";
import { controlledAccessMigration } from "./migrations/controlled-access.js";
import { domainLedgerMigration } from "./migrations/domain-ledger.js";
import { fixtureMigration } from "./migrations/fixtures.js";
import { foundationMigration } from "./migrations/foundation.js";

interface QueryResult {
  rows: Record<string, unknown>[];
}

export interface QueryClient {
  query(sql: string, parameters?: readonly unknown[]): Promise<QueryResult>;
}

export interface RuntimeQueryClient extends QueryClient {
  close(): Promise<void>;
}

export type RuntimeClientFactory = () => Promise<RuntimeQueryClient>;

export type PostgresBaselineResult =
  | { ready: true }
  | {
      errorCode:
        | "APPLICATION_DATABASE_UNAVAILABLE"
        | "APPLICATION_MIGRATIONS_INCOMPLETE";
      ready: false;
    };

export type DenialAuditResult =
  | { ready: true }
  | { errorCode: "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED"; ready: false };

export type LedgerIntegrityResult =
  | { ready: true }
  | { errorCode: "LEDGER_INTEGRITY_FAILED"; ready: false };

export interface DenialAuditProbeIdentifiers {
  readonly auditId: string;
  readonly attemptIntentId: string;
  readonly correlationId: string;
  readonly denialNonce: string;
}

type TimedReadiness<ErrorCode extends string> =
  | { readonly ready: true; readonly checkedAt: string }
  | { readonly ready: false; readonly checkedAt: string; readonly errorCode: ErrorCode };

export interface PostgresReadinessChecks {
  readonly PostgreSQL: TimedReadiness<"APPLICATION_DATABASE_UNAVAILABLE">;
  readonly Migrations: TimedReadiness<"APPLICATION_MIGRATIONS_INCOMPLETE">;
  readonly DenialAudit: TimedReadiness<"ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED">;
  readonly LedgerIntegrity: TimedReadiness<"LEDGER_INTEGRITY_FAILED">;
}

interface PostgresReadinessOperations {
  readonly baseline: (client: QueryClient) => Promise<PostgresBaselineResult>;
  readonly migrationState: (client: QueryClient) => Promise<PostgresBaselineResult>;
  readonly schemaManifest: (client: QueryClient) => Promise<PostgresBaselineResult>;
  readonly denialAudit: (factory: RuntimeClientFactory) => Promise<DenialAuditResult>;
  readonly ledgerIntegrity: (
    client: QueryClient,
    factory: RuntimeClientFactory,
  ) => Promise<LedgerIntegrityResult>;
}

export interface PostgresReadinessOptions {
  readonly checkedAt: string;
  readonly controlClient: QueryClient;
  readonly createAuditClient: RuntimeClientFactory;
  readonly createProjectionClient: RuntimeClientFactory;
  readonly checks?: PostgresReadinessOperations;
}

const baselineQuery = `
SELECT
  (SELECT datcollate FROM pg_catalog.pg_database WHERE datname = current_database()) AS identifier_collation,
  current_setting('server_encoding') AS server_encoding,
  current_setting('server_version_num') AS server_version_num,
  current_setting('standard_conforming_strings') AS standard_conforming_strings,
  current_setting('TimeZone') AS timezone
`;
const expectedMigrations = prepareMigrationSet([
  foundationMigration,
  applicationMigration,
  domainLedgerMigration,
  fixtureMigration,
  analyticsEvidenceMigration,
  controlledAccessMigration,
]);
function createDenialAuditProbeIdentifiers(): DenialAuditProbeIdentifiers {
  return {
    auditId: randomUUID(),
    attemptIntentId: randomUUID(),
    correlationId: randomUUID(),
    denialNonce: randomUUID().replaceAll("-", ""),
  };
}

async function rollbackAndClose(client: RuntimeQueryClient): Promise<boolean> {
  let cleanedUp = true;
  try {
    await client.query("ROLLBACK");
  } catch {
    cleanedUp = false;
  }
  try {
    await client.close();
  } catch {
    cleanedUp = false;
  }
  return cleanedUp;
}

async function setProbeTimeouts(client: QueryClient): Promise<void> {
  await client.query(
    `SELECT pg_catalog.set_config('lock_timeout', '2s', true) AS lock_timeout,
            pg_catalog.set_config('statement_timeout', '5s', true) AS statement_timeout,
            pg_catalog.set_config('idle_in_transaction_session_timeout', '5s', true) AS idle_timeout`,
  );
}

async function hasSessionUser(
  client: QueryClient,
  expectedSessionUser: string,
): Promise<boolean> {
  const result = await client.query("SELECT session_user::text AS session_user");
  return result.rows[0]?.session_user === expectedSessionUser;
}

export async function checkPostgresBaseline(
  client: QueryClient,
): Promise<PostgresBaselineResult> {
  let row: Record<string, unknown> | undefined;
  try {
    const result = await client.query(baselineQuery);
    row = result.rows[0];
  } catch {
    return { errorCode: "APPLICATION_DATABASE_UNAVAILABLE", ready: false };
  }

  const serverVersion = Number(row?.server_version_num);
  if (
    row?.identifier_collation !== "C" ||
    row?.server_encoding !== "UTF8" ||
    !Number.isInteger(serverVersion) ||
    serverVersion < 160000 ||
    serverVersion >= 170000 ||
    row?.standard_conforming_strings !== "on" ||
    row?.timezone !== "UTC"
  ) {
    return { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false };
  }

  return { ready: true };
}

export async function checkPostgresMigrationState(
  client: QueryClient,
): Promise<PostgresBaselineResult> {
  let migrationTable: unknown;
  try {
    const result = await client.query(
      "SELECT pg_catalog.to_regclass('etf.schema_migrations')::text AS migration_table",
    );
    migrationTable = result.rows[0]?.migration_table;
  } catch {
    return { errorCode: "APPLICATION_DATABASE_UNAVAILABLE", ready: false };
  }

  if (migrationTable !== "etf.schema_migrations") {
    return { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false };
  }

  let rows: Record<string, unknown>[];
  try {
    const result = await client.query(
      "SELECT sequence, migration_id, content_hash FROM etf.schema_migrations ORDER BY sequence",
    );
    rows = result.rows;
  } catch {
    return { errorCode: "APPLICATION_DATABASE_UNAVAILABLE", ready: false };
  }
  if (
    rows.length !== expectedMigrations.length ||
    rows.some((row, index) => {
      const expected = expectedMigrations[index];
      return expected === undefined ||
        Number(row.sequence) !== expected.sequence ||
        row.migration_id !== expected.migrationId ||
        row.content_hash !== expected.contentHash;
    })
  ) {
    return { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false };
  }

  let publicExecuteCount: unknown;
  try {
    const result = await client.query(
      `SELECT count(*)::integer AS public_execute_count
         FROM pg_catalog.pg_proc AS function_record
         JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = function_record.pronamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(
          COALESCE(function_record.proacl, pg_catalog.acldefault('f', function_record.proowner))
        ) AS privilege
        WHERE namespace.nspname = 'etf'
          AND privilege.grantee = 0
          AND privilege.privilege_type = 'EXECUTE'`,
    );
    publicExecuteCount = result.rows[0]?.public_execute_count;
  } catch {
    return { errorCode: "APPLICATION_DATABASE_UNAVAILABLE", ready: false };
  }
  if (publicExecuteCount !== 0) {
    return { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false };
  }

  return { ready: true };
}

type SchemaManifestProjector = (client: QueryClient) => Promise<string>;

export async function checkPostgresSchemaManifest(
  client: QueryClient,
  projectCurrentManifest: SchemaManifestProjector = async (manifestClient) =>
    projectCurrentPostgresSchemaManifest(manifestClient),
): Promise<PostgresBaselineResult> {
  let storedHash: unknown;
  let currentHash: string;
  try {
    const result = await client.query(
      "SELECT schema_manifest_hash FROM etf.schema_migrations WHERE sequence = 6 AND migration_id = '0006-controlled-access'",
    );
    storedHash = result.rows[0]?.schema_manifest_hash;
    currentHash = createHash("sha256")
      .update(await projectCurrentManifest(client), "utf8")
      .digest("hex");
  } catch (error) {
    if (error instanceof Error && error.message === "APPLICATION_MIGRATIONS_INCOMPLETE") {
      return { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false };
    }
    return { errorCode: "APPLICATION_DATABASE_UNAVAILABLE", ready: false };
  }
  if (
    typeof storedHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(storedHash) ||
    currentHash !== storedHash
  ) {
    return { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false };
  }
  return { ready: true };
}

export async function checkDenialAuditCapability(
  createAuditClient: RuntimeClientFactory,
  identifiers: DenialAuditProbeIdentifiers = createDenialAuditProbeIdentifiers(),
): Promise<DenialAuditResult> {
  let client: RuntimeQueryClient | undefined;
  let outcome: DenialAuditResult = {
    errorCode: "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
    ready: false,
  };
  try {
    client = await createAuditClient();
    await client.query("BEGIN");
    await setProbeTimeouts(client);
    if (!await hasSessionUser(client, "audit_runtime")) return outcome;
    await client.query(
      "SELECT pg_catalog.set_config('application_name', $1, true) AS application_name",
      [`etf-denial:${identifiers.denialNonce}`],
    );
    const result = await client.query(
      `SELECT etf.audit_append(
         pg_catalog.jsonb_build_object(
           'action', 'ReadinessCapabilityProbe',
           'attemptIntentId', $1::uuid,
           'correlationId', $2::uuid,
           'domain', 'Denial',
           'keyIdentifier', 'primary',
           'outcome', 'PermissionDenied',
           'subject', pg_catalog.jsonb_build_object(
             'auditId', $3::uuid,
             'originalBackendPid', pg_catalog.pg_backend_pid(),
             'backendStart', activity.backend_start,
             'originalSessionUser', session_user,
             'denialNonce', $4::text,
             'objectClass', 'function',
             'objectName', 'etf.readiness_capability_probe',
             'denialCode', 'PermissionDenied',
             'deniedAt', pg_catalog.clock_timestamp()
           )
         )
       ) IS NOT NULL AS appended
       FROM pg_catalog.pg_stat_activity AS activity
       WHERE activity.pid = pg_catalog.pg_backend_pid()`,
      [
        identifiers.attemptIntentId,
        identifiers.correlationId,
        identifiers.auditId,
        identifiers.denialNonce,
      ],
    );
    if (result.rows[0]?.appended === true) outcome = { ready: true };
  } catch {
    outcome = { errorCode: "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED", ready: false };
  } finally {
    if (client !== undefined && !await rollbackAndClose(client)) {
      outcome = { errorCode: "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED", ready: false };
    }
  }
  return outcome;
}

export async function checkLedgerIntegrity(
  controlClient: QueryClient,
  createProjectionClient: RuntimeClientFactory,
): Promise<LedgerIntegrityResult> {
  let checkpoints: Record<string, unknown>[];
  try {
    const result = await controlClient.query(
      `SELECT portfolio_id::text AS portfolio_id,
              portfolio_commitment::text AS portfolio_commitment
         FROM etf.portfolio_anchor_checkpoints
        ORDER BY portfolio_id`,
    );
    checkpoints = result.rows;
  } catch {
    return { errorCode: "LEDGER_INTEGRITY_FAILED", ready: false };
  }

  let client: RuntimeQueryClient | undefined;
  let outcome: LedgerIntegrityResult = {
    errorCode: "LEDGER_INTEGRITY_FAILED",
    ready: false,
  };
  try {
    client = await createProjectionClient();
    await client.query("BEGIN READ ONLY");
    await setProbeTimeouts(client);
    if (!await hasSessionUser(client, "projection_runtime")) return outcome;
    for (const checkpoint of checkpoints) {
      if (
        typeof checkpoint.portfolio_id !== "string" ||
        typeof checkpoint.portfolio_commitment !== "string"
      ) {
        return outcome;
      }
      const result = await client.query(
        `SELECT (etf.anchor_append(
           pg_catalog.jsonb_build_object(
             'domain', 'Verify',
             'portfolioId', $1::uuid,
             'sourceCommitmentHash', $2::text
           )
         ) ->> 'verified')::boolean AS verified`,
        [checkpoint.portfolio_id, checkpoint.portfolio_commitment],
      );
      if (result.rows[0]?.verified !== true) return outcome;
    }
    outcome = { ready: true };
  } catch {
    outcome = { errorCode: "LEDGER_INTEGRITY_FAILED", ready: false };
  } finally {
    if (client !== undefined && !await rollbackAndClose(client)) {
      outcome = { errorCode: "LEDGER_INTEGRITY_FAILED", ready: false };
    }
  }
  return outcome;
}

export async function composePostgresReadinessChecks(
  options: PostgresReadinessOptions,
): Promise<PostgresReadinessChecks> {
  const operations = options.checks ?? {
    baseline: checkPostgresBaseline,
    denialAudit: checkDenialAuditCapability,
    ledgerIntegrity: checkLedgerIntegrity,
    migrationState: checkPostgresMigrationState,
    schemaManifest: checkPostgresSchemaManifest,
  };
  const unavailable = {
    PostgreSQL: {
      ready: false as const,
      checkedAt: options.checkedAt,
      errorCode: "APPLICATION_DATABASE_UNAVAILABLE" as const,
    },
    Migrations: {
      ready: false as const,
      checkedAt: options.checkedAt,
      errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE" as const,
    },
    DenialAudit: {
      ready: false as const,
      checkedAt: options.checkedAt,
      errorCode: "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED" as const,
    },
    LedgerIntegrity: {
      ready: false as const,
      checkedAt: options.checkedAt,
      errorCode: "LEDGER_INTEGRITY_FAILED" as const,
    },
  };

  const baseline = await operations.baseline(options.controlClient);
  if (!baseline.ready) {
    return baseline.errorCode === "APPLICATION_DATABASE_UNAVAILABLE"
      ? unavailable
      : {
          ...unavailable,
          PostgreSQL: { ready: true, checkedAt: options.checkedAt },
        };
  }

  const postgresql = { ready: true as const, checkedAt: options.checkedAt };
  const migrationState = await operations.migrationState(options.controlClient);
  if (!migrationState.ready) {
    return migrationState.errorCode === "APPLICATION_DATABASE_UNAVAILABLE"
      ? unavailable
      : { ...unavailable, PostgreSQL: postgresql };
  }
  const schemaManifest = await operations.schemaManifest(options.controlClient);
  if (!schemaManifest.ready) {
    return schemaManifest.errorCode === "APPLICATION_DATABASE_UNAVAILABLE"
      ? unavailable
      : { ...unavailable, PostgreSQL: postgresql };
  }

  const [denialAudit, ledgerIntegrity] = await Promise.all([
    operations.denialAudit(options.createAuditClient),
    operations.ledgerIntegrity(options.controlClient, options.createProjectionClient),
  ]);
  return {
    PostgreSQL: postgresql,
    Migrations: { ready: true, checkedAt: options.checkedAt },
    DenialAudit: denialAudit.ready
      ? { ready: true, checkedAt: options.checkedAt }
      : { ...denialAudit, checkedAt: options.checkedAt },
    LedgerIntegrity: ledgerIntegrity.ready
      ? { ready: true, checkedAt: options.checkedAt }
      : { ...ledgerIntegrity, checkedAt: options.checkedAt },
  };
}
