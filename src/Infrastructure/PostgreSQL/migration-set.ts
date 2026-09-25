import { createHash } from "node:crypto";

export const expectedMigrationIds = [
  "0001-foundation",
  "0002-application",
  "0003-domain-ledger",
  "0004-fixtures",
  "0005-analytics-evidence",
  "0006-controlled-access",
  "0007-denial-backend-verifier",
  "0008-runtime-queries",
] as const;

export interface MigrationArtifact {
  migrationId: string;
  sequence: number;
  sql: string;
}

export interface PreparedMigration extends MigrationArtifact {
  contentHash: string;
}

const productExtensionPattern = /\bCREATE\s+EXTENSION\b/iu;
const durableHandoffNamePattern =
  /(?:outbox|event|queue|schedule|(?<!re)lease|worker_?inbox|notification|delayed_?consumer)/iu;
const createdObjectNamePattern =
  /\bCREATE\s+(?:(?:OR\s+REPLACE)\s+)?(?:UNIQUE\s+)?(?:TABLE|FUNCTION|TRIGGER|INDEX|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[a-z_][a-z0-9_]*\.)?([a-z_][a-z0-9_]*)/giu;

export function isDurableHandoffObjectName(objectName: string): boolean {
  return durableHandoffNamePattern.test(objectName);
}

function containsDurableHandoffObject(sql: string): boolean {
  return [...sql.matchAll(createdObjectNamePattern)]
    .some((match) => isDurableHandoffObjectName(match[1] ?? ""));
}

export function validateMigrationArtifact(artifact: MigrationArtifact): void {
  if (expectedMigrationIds[artifact.sequence - 1] !== artifact.migrationId) {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
  if (productExtensionPattern.test(artifact.sql)) {
    throw new Error(
      `CT-DB-001A prohibits product-created extensions in ${artifact.migrationId}`,
    );
  }
  if (containsDurableHandoffObject(artifact.sql)) {
    throw new Error(
      `CT-DB-001L prohibits durable handoff objects in ${artifact.migrationId}`,
    );
  }
}

export function prepareMigrationSet(
  artifacts: readonly MigrationArtifact[],
): PreparedMigration[] {
  if (artifacts.length !== expectedMigrationIds.length) {
    throw new Error(`migration set must contain exactly ${expectedMigrationIds.length} artifacts`);
  }

  return artifacts.map((artifact, index) => {
    const expectedMigrationId = expectedMigrationIds[index];
    const expectedSequence = index + 1;

    if (artifact.migrationId !== expectedMigrationId || artifact.sequence !== expectedSequence) {
      throw new Error(
        `migration ${expectedSequence} must be ${expectedMigrationId}`,
      );
    }
    validateMigrationArtifact(artifact);

    return {
      ...artifact,
      contentHash: createHash("sha256").update(artifact.sql, "utf8").digest("hex"),
    };
  });
}
