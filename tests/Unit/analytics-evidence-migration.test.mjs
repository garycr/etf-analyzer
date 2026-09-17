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

test("0005 evidence commit resolves replay before creating evidence", () => {
  const { sql } = analyticsEvidenceMigration;
  const replayLock = sql.indexOf("'etf:analytics-replay:'");
  const replayLookup = sql.indexOf("FROM etf.analytics_evidence_replays");
  const firstEvidenceWrite = sql.indexOf("INSERT INTO etf.analytics_input_sets");

  assert.ok(replayLock >= 0 && replayLock < replayLookup);
  assert.ok(replayLookup < firstEvidenceWrite);
  assert.match(sql, /IF replay_record\.canonical_content = canonical_content THEN\s+RETURN replay_record\.result;/u);
  assert.match(sql, /RAISE EXCEPTION 'ANALYTICS_IDEMPOTENCY_CONFLICT'/u);
});

test("0005 evidence commit serializes and version-checks complete publication", () => {
  const { sql } = analyticsEvidenceMigration;
  const completeBranch = sql.indexOf("IF payload ->> 'reproducibilityStatus' = 'Complete' THEN");
  const publicationLock = sql.indexOf("'etf:analytics-publication:'", completeBranch);
  const publicationWrite = sql.indexOf("INSERT INTO etf.analytics_publications", publicationLock);

  assert.ok(completeBranch >= 0 && completeBranch < publicationLock);
  assert.ok(publicationLock < publicationWrite);
  assert.match(sql, /FROM etf\.analytics_publications[\s\S]+FOR UPDATE;/u);
  assert.match(sql, /RAISE EXCEPTION 'ANALYTICS_PUBLICATION_VERSION_CONFLICT'/u);
  assert.match(sql, /IF payload ->> 'reproducibilityStatus' = 'Complete' THEN\s+INSERT INTO etf\.analytics_publications/u);
});

test("0005 evidence commit writes audit and replay last under stable failure handling", () => {
  const { sql } = analyticsEvidenceMigration;
  const bundleWrite = sql.indexOf("INSERT INTO etf.analytics_evidence_bundles");
  const auditWrite = sql.indexOf("INSERT INTO etf.analytics_audit");
  const replayWrite = sql.indexOf("INSERT INTO etf.analytics_evidence_replays");
  const exceptionHandler = sql.indexOf("EXCEPTION", replayWrite);

  assert.ok(bundleWrite >= 0 && bundleWrite < auditWrite);
  assert.ok(auditWrite < replayWrite && replayWrite < exceptionHandler);
  assert.match(sql, /RAISE EXCEPTION 'ANALYTICS_EVIDENCE_COMMIT_FAILED' USING ERRCODE = 'P0001'/u);
});
