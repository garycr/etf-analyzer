import { createHash } from "node:crypto";

export const expectedMigrationIds = [
  "0001-foundation",
  "0002-application",
  "0003-domain-ledger",
  "0004-fixtures",
  "0005-analytics-evidence",
  "0006-controlled-access",
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
const durableHandoffObjectPattern =
  /\bCREATE\s+(?:TABLE|FUNCTION|TRIGGER|INDEX|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[a-z_][a-z0-9_]*\.)?[a-z0-9_]*(?:outbox|event|queue|schedule|(?<!re)lease|worker_inbox|notification|delayed_consumer)[a-z0-9_]*/iu;

export function validateMigrationArtifact(artifact: MigrationArtifact): void {
  if (expectedMigrationIds[artifact.sequence - 1] !== artifact.migrationId) {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
  if (productExtensionPattern.test(artifact.sql)) {
    throw new Error(
      `CT-DB-001A prohibits product-created extensions in ${artifact.migrationId}`,
    );
  }
  if (durableHandoffObjectPattern.test(artifact.sql)) {
    throw new Error(
      `CT-DB-001L prohibits durable handoff objects in ${artifact.migrationId}`,
    );
  }
}

export function prepareMigrationSet(
  artifacts: readonly MigrationArtifact[],
): PreparedMigration[] {
  if (artifacts.length !== expectedMigrationIds.length) {
    throw new Error("migration set must contain exactly 6 artifacts");
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
