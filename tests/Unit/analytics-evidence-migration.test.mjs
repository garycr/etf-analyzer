import assert from "node:assert/strict";
import test from "node:test";

import {
  analyticsEvidenceFunctionNames,
  analyticsEvidenceMigration,
  analyticsEvidenceTableNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/analytics-evidence.js";

test("0005 analytics evidence has the exact identity and closed object set", () => {
  assert.equal(analyticsEvidenceMigration.sequence, 5);
  assert.equal(analyticsEvidenceMigration.migrationId, "0005-analytics-evidence");
  assert.deepEqual(analyticsEvidenceTableNames, [
    "analytics_input_sets",
    "analytics_evidence_bundles",
    "analytics_manifests",
    "analytics_lifecycle_references",
    "analytics_deletion_links",
    "analytics_retention_bindings",
    "analytics_evidence_replays",
    "analytics_publications",
    "analytics_audit",
  ]);
  assert.deepEqual(analyticsEvidenceFunctionNames, [
    "_evidence_rfc8785",
    "evidence_commit",
    "evidence_read",
  ]);
});

test("0005 analytics evidence stays inside the physical persistence boundary", () => {
  const { sql } = analyticsEvidenceMigration;
  const declaredNames = [...sql.matchAll(/(?:CONSTRAINT|CREATE INDEX) ([a-z0-9_]+)/gu)]
    .map((match) => match[1]);

  assert.equal((sql.match(/CREATE TABLE etf\./gu) ?? []).length, 9);
  assert.equal((sql.match(/CREATE FUNCTION etf\./gu) ?? []).length, 3);
  assert.equal((sql.match(/CREATE INDEX ix_analytics_/gu) ?? []).length, 3);
  assert.doesNotMatch(sql, /CREATE\s+(?:EXTENSION|VIEW|TRIGGER)/iu);
  assert.doesNotMatch(sql, /\b(?:outbox|queue|scheduler|worker|broker|provider)\b/iu);
  assert.doesNotMatch(sql, /\bCOPY\s+etf\./iu);
  assert.match(sql, /retention_epoch timestamp\(3\) with time zone NOT NULL/);
  assert.doesNotMatch(sql, /retention_epoch bigint/);
  for (const name of declaredNames) {
    assert.ok(Buffer.byteLength(name, "utf8") <= 63, `${name} exceeds 63 bytes`);
  }
});

test("0005 evidence commit owns generated retention fields and canonical hashes", () => {
  const { sql } = analyticsEvidenceMigration;
  const replayLookup = sql.indexOf("FROM etf.analytics_evidence_replays");
  const epochCapture = sql.indexOf("retention_epoch := date_trunc('milliseconds', clock_timestamp())");

  assert.match(sql, /payload \?\| ARRAY\['retentionEpoch', 'retainThrough', 'bundleHash', 'manifestHash'/);
  assert.ok(replayLookup >= 0 && epochCapture > replayLookup);
  assert.match(sql, /interval '2160 hours'/);
  assert.match(sql, /interval '8760 hours'/);
  assert.match(sql, /interval '17520 hours'/);
  assert.match(sql, /interval '43800 hours'/);
  assert.match(sql, /hashtextextended\(\s*'etf:analytics-publication:' \|\| \(payload ->> 'publicationTargetId'\)/);
  assert.match(sql, /manifest_id := 'manifest-' \|\| substring\(encode\(public\.digest/);
  assert.match(sql, /public\.digest\(convert_to\(etf\._evidence_rfc8785\(/);
  assert.doesNotMatch(sql, /payload ->> 'retentionEpoch'/);
  assert.doesNotMatch(sql, /payload ->> 'bundleHash'/);
  assert.doesNotMatch(sql, /payload ->> 'manifestHash'/);
  assert.doesNotMatch(sql, /item ->> 'retainThrough'/);
});
