import { createHash } from "node:crypto";

import {
  canonicalizeJson,
  type CanonicalJsonValue,
} from "../CanonicalJson/canonical-json.js";
import { expectedMigrationIds } from "./migration-set.js";
import type { ManifestMigration } from "./migration-runner.js";

export type ManifestObjectKind =
  | "schema"
  | "role"
  | "table"
  | "function"
  | "view";

export interface ManifestObjectSource {
  kind: ManifestObjectKind;
  schema: string | null;
  name: string;
  owner: string | null;
  definition: CanonicalJsonValue;
}

export interface ManifestRoleMembership {
  role: string;
  member: string;
  adminOption: boolean;
  inheritOption: boolean;
  setOption: boolean;
}

export interface ManifestGrant {
  objectKind: "database" | "schema" | "table" | "view" | "function";
  schema: string | null;
  object: string | null;
  columns: readonly string[] | null;
  grantee: string;
  privilege: string;
  grantOption: boolean;
}

export interface SchemaManifestSource {
  systemExtensions: readonly { name: string; version: string }[];
  migrationSequence: readonly ManifestMigration[];
  objects: readonly ManifestObjectSource[];
  roleMemberships: readonly ManifestRoleMembership[];
  grants: readonly ManifestGrant[];
}

const kindOrder: Record<ManifestObjectKind, number> = {
  schema: 0,
  role: 1,
  table: 2,
  function: 3,
  view: 4,
};

function compareText(left: string | null, right: string | null): number {
  const normalizedLeft = left ?? "";
  const normalizedRight = right ?? "";
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

function sha256(value: CanonicalJsonValue): string {
  return createHash("sha256")
    .update(canonicalizeJson(value), "utf8")
    .digest("hex");
}

function validateMigrationSequence(
  existing: readonly ManifestMigration[],
  prospective: ManifestMigration,
): void {
  if (
    prospective.sequence !== existing.length + 1 ||
    expectedMigrationIds[prospective.sequence - 1] !== prospective.migrationId ||
    !/^[0-9a-f]{64}$/u.test(prospective.contentHash)
  ) {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }

  for (const [index, migration] of existing.entries()) {
    if (
      migration.sequence !== index + 1 ||
      migration.migrationId !== expectedMigrationIds[index] ||
      !/^[0-9a-f]{64}$/u.test(migration.contentHash)
    ) {
      throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
    }
  }
}

function validateCompleteMigrationSequence(
  migrations: readonly ManifestMigration[],
): void {
  if (migrations.length !== expectedMigrationIds.length) {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
  for (const [index, migration] of migrations.entries()) {
    if (
      migration.sequence !== index + 1 ||
      migration.migrationId !== expectedMigrationIds[index] ||
      !/^[0-9a-f]{64}$/u.test(migration.contentHash)
    ) {
      throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
    }
  }
}

function renderSchemaManifest(
  source: SchemaManifestSource,
  migrationSequence: readonly ManifestMigration[],
): string {
  if (
    source.systemExtensions.length !== 2 ||
    source.systemExtensions[0]?.name !== "pgcrypto" ||
    source.systemExtensions[0]?.version !== "1.3" ||
    source.systemExtensions[1]?.name !== "plpgsql" ||
    source.systemExtensions[1]?.version !== "1.0"
  ) {
    throw new Error("APPLICATION_MIGRATIONS_INCOMPLETE");
  }
  const objects = source.objects
    .map(({ definition, ...object }) => ({
      ...object,
      definitionHash: sha256(definition),
    }))
    .sort(
      (left, right) =>
        kindOrder[left.kind] - kindOrder[right.kind] ||
        compareText(left.schema, right.schema) ||
        compareText(left.name, right.name),
    );
  const roleMemberships = [...source.roleMemberships].sort(
    (left, right) =>
      compareText(left.role, right.role) || compareText(left.member, right.member),
  );
  const grants = source.grants.map((grant) => ({
    ...grant,
    columns: grant.columns ?? null,
  })).sort(
    (left, right) =>
      compareText(left.objectKind, right.objectKind) ||
      compareText(left.schema, right.schema) ||
      compareText(left.object, right.object) ||
      compareText(left.columns?.join("\u0000") ?? null, right.columns?.join("\u0000") ?? null) ||
      compareText(left.grantee, right.grantee) ||
      compareText(left.privilege, right.privilege) ||
      Number(left.grantOption) - Number(right.grantOption),
  );

  return canonicalizeJson({
    contractVersion: "1.0.0-candidate.2",
    systemExtensions: source.systemExtensions,
    migrationSequence,
    objects,
    roleMemberships,
    grants,
  });
}

export function buildSchemaManifest(
  source: SchemaManifestSource,
  prospectiveMigration: ManifestMigration,
): string {
  validateMigrationSequence(source.migrationSequence, prospectiveMigration);
  return renderSchemaManifest(
    source,
    [...source.migrationSequence, prospectiveMigration],
  );
}

export function buildCurrentSchemaManifest(source: SchemaManifestSource): string {
  validateCompleteMigrationSequence(source.migrationSequence);
  return renderSchemaManifest(source, source.migrationSequence);
}
