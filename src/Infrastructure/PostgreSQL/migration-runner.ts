import { createHash } from "node:crypto";

import {
  type MigrationArtifact,
  validateMigrationArtifact,
} from "./migration-set.js";

interface QueryResult {
  rows: Record<string, unknown>[];
}

export interface MigrationClient {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
}

export interface MigrationResult {
  applied: boolean;
  contentHash: string;
  schemaManifestHash: string;
}

export interface ManifestMigration {
  sequence: number;
  migrationId: string;
  contentHash: string;
}

type ManifestProjector = (
  client: MigrationClient,
  migration: ManifestMigration,
) => Promise<string>;

const lockQuery =
  "SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('etf:v1.0.0-prototype.1:migrations', 0))";
const canonicalTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export async function applyMigration(
  client: MigrationClient,
  migration: MigrationArtifact,
  appliedAt: string,
  projectManifest: ManifestProjector,
): Promise<MigrationResult> {
  validateMigrationArtifact(migration);
  const parsedAppliedAt = new Date(appliedAt);
  if (
    !canonicalTimestampPattern.test(appliedAt) ||
    Number.isNaN(parsedAppliedAt.getTime()) ||
    parsedAppliedAt.toISOString() !== appliedAt
  ) {
    throw new Error("appliedAt must be a canonical UTC millisecond timestamp");
  }
  const contentHash = createHash("sha256")
    .update(migration.sql, "utf8")
    .digest("hex");

  await client.query("BEGIN");
  try {
    await client.query(lockQuery);
    await client.query("SET LOCAL ROLE migration_executor");
    await client.query("SET LOCAL ROLE migration_owner");

    const tableResult = await client.query(
      `SELECT namespace.nspname || '.' || relation.relname AS migration_table
         FROM pg_catalog.pg_class AS relation
         JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'etf'
          AND relation.relname = 'schema_migrations'
          AND relation.relkind = 'r'`,
    );
    const migrationTable = tableResult.rows[0]?.migration_table;
    if (migrationTable !== null && migrationTable !== undefined) {
      const existing = await client.query(
        "SELECT sequence, migration_id, content_hash, schema_manifest_hash FROM etf.schema_migrations WHERE sequence = $1 OR migration_id = $2",
        [migration.sequence, migration.migrationId],
      );
      if (existing.rows.length > 0) {
        if (existing.rows.length !== 1) {
          throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
        }
        const row = existing.rows[0];
        if (
          Number(row?.sequence) !== migration.sequence ||
          row?.migration_id !== migration.migrationId ||
          row.content_hash !== contentHash
        ) {
          throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
        }
        const schemaManifestHash = String(row.schema_manifest_hash);
        await client.query("COMMIT");
        return { applied: false, contentHash, schemaManifestHash };
      }

      const ledgerState = await client.query(
        "SELECT count(*) AS applied_count, min(sequence) AS min_sequence, max(sequence) AS max_sequence FROM etf.schema_migrations",
      );
      const state = ledgerState.rows[0];
      const expectedPreviousSequence = migration.sequence - 1;
      if (
        Number(state?.applied_count) !== expectedPreviousSequence ||
        (expectedPreviousSequence > 0 &&
          (Number(state?.min_sequence) !== 1 ||
            Number(state?.max_sequence) !== expectedPreviousSequence))
      ) {
        throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
      }
    } else if (migration.sequence !== 1) {
      throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
    } else {
      const prerequisite = await client.query(
        `SELECT owner.rolname AS owner, namespace.nspacl IS NULL AS default_acl,
                (SELECT count(*)::integer FROM pg_catalog.pg_class AS relation
                  WHERE relation.relnamespace = namespace.oid) AS relation_count,
                (SELECT count(*)::integer FROM pg_catalog.pg_proc AS routine
                  WHERE routine.pronamespace = namespace.oid) AS routine_count,
                (SELECT count(*)::integer FROM pg_catalog.pg_default_acl AS defaults
                  WHERE defaults.defaclnamespace = namespace.oid) AS default_acl_count
           FROM pg_catalog.pg_namespace AS namespace
           JOIN pg_catalog.pg_roles AS owner ON owner.oid = namespace.nspowner
          WHERE namespace.nspname = 'etf'`,
      );
      const schema = prerequisite.rows[0];
      if (
        prerequisite.rows.length !== 1 ||
        schema?.owner !== "schema_owner" ||
        schema.default_acl !== true ||
        Number(schema.relation_count) !== 0 ||
        Number(schema.routine_count) !== 0 ||
        Number(schema.default_acl_count) !== 0
      ) {
        throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
      }
    }

    await client.query(migration.sql);
    const manifestJson = await projectManifest(client, {
      sequence: migration.sequence,
      migrationId: migration.migrationId,
      contentHash,
    });
    const schemaManifestHash = createHash("sha256")
      .update(manifestJson, "utf8")
      .digest("hex");
    await client.query(
      "INSERT INTO etf.schema_migrations (sequence, migration_id, content_hash, applied_at, schema_manifest_hash) VALUES ($1, $2, $3, $4, $5)",
      [
        migration.sequence,
        migration.migrationId,
        contentHash,
        appliedAt,
        schemaManifestHash,
      ],
    );
    await client.query("COMMIT");
    return { applied: true, contentHash, schemaManifestHash };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
