import assert from "node:assert/strict";
import test from "node:test";

import {
  fixtureFunctionNames,
  fixtureMigration,
  fixtureTableNames,
} from "../../dist/Infrastructure/PostgreSQL/migrations/fixtures.js";

test("0004 fixtures has the exact identity and closed object set", () => {
  assert.equal(fixtureMigration.sequence, 4);
  assert.equal(fixtureMigration.migrationId, "0004-fixtures");
  assert.deepEqual(fixtureTableNames, [
    "fixture_packages",
    "fixture_descriptors",
    "fixture_raw_sources",
    "market_observations",
    "economic_observations",
    "fixture_ingestion_replays",
  ]);
  assert.deepEqual(fixtureFunctionNames, ["fixture_ingest"]);
});

test("0004 fixtures stays inside the empty-database bootstrap boundary", () => {
  const { sql } = fixtureMigration;

  assert.equal((sql.match(/CREATE TABLE etf\./gu) ?? []).length, 6);
  assert.equal((sql.match(/CREATE FUNCTION etf\./gu) ?? []).length, 1);
  assert.equal((sql.match(/CREATE INDEX ix_(?:market|economic)_observations/gu) ?? []).length, 2);
  assert.doesNotMatch(sql, /CREATE\s+(?:EXTENSION|VIEW|TRIGGER)/iu);
  assert.doesNotMatch(sql, /\b(?:outbox|queue|scheduler|event)\b/iu);
  assert.doesNotMatch(sql, /\bCOPY\s+etf\./iu);
  assert.doesNotMatch(
    sql.slice(0, sql.indexOf("CREATE FUNCTION etf.fixture_ingest")),
    /\bINSERT\s+INTO\s+etf\./iu,
  );
});

test("0004 fixtures assigns and hardens its closed authority", () => {
  const { sql } = fixtureMigration;

  assert.match(sql, /SET LOCAL ROLE application_writer_owner;/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /VOLATILE/);
  assert.match(sql, /PARALLEL UNSAFE/);
  assert.match(sql, /SET search_path = pg_catalog, etf/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION etf\.fixture_ingest\(jsonb\) FROM PUBLIC;/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION etf\.fixture_ingest\(jsonb\) TO app_runtime;/,
  );
  assert.match(
    sql,
    /REVOKE CREATE ON SCHEMA etf FROM application_writer_owner;/,
  );
});

test("0004 fixtures keeps package provenance foreign keys immediate", () => {
  const foreignKeys = fixtureMigration.sql
    .split("\n")
    .filter((line) => line.includes("FOREIGN KEY"));

  assert.equal(foreignKeys.length, 7);
  assert.ok(
    foreignKeys.every((foreignKey) =>
      /NOT DEFERRABLE[,;]?$/.test(foreignKey),
    ),
  );
  assert.doesNotMatch(fixtureMigration.sql, /DEFERRABLE INITIALLY DEFERRED/);
});

test("0004 fixtures uses exact PostgreSQL-compatible catalog names", () => {
  const { sql } = fixtureMigration;

  const declaredNames = [...sql.matchAll(/(?:CONSTRAINT|CREATE INDEX) ([a-z0-9_]+)/gu)]
    .map((match) => match[1]);
  for (const name of declaredNames) {
    assert.ok(Buffer.byteLength(name, "utf8") <= 63, `${name} exceeds 63 bytes`);
  }
  assert.match(sql, /CONSTRAINT uq_market_observations__ds_ver_job_inst_date_prov_adj_rev UNIQUE/);
  assert.match(sql, /CONSTRAINT uq_economic_observations__ds_ver_prov_series_date_release UNIQUE/);
  assert.match(sql, /CONSTRAINT uq_economic_observations__ds_ver_job_prov_series_date_rel_vtg UNIQUE/);
  assert.match(sql, /CREATE INDEX ix_market_observations__inst_date_prov_adj_available_rev ON/);
  assert.match(sql, /CREATE INDEX ix_economic_observations__prov_series_date_release_vintage ON/);
});

test("0004 fixtures preserves DEC-014 class-specific PostgreSQL precision", () => {
  const { sql } = fixtureMigration;

  assert.ok(
    sql.includes(
      "WHEN 'Money' THEN observation ->> 'value' !~ '^-?(0|[1-9][0-9]{0,19})\\.[0-9]{8}$'",
    ),
  );
  assert.doesNotMatch(
    sql,
    /COALESCE\(abs\(value_quantity\), abs\(value_money\), abs\(value_rate\)\)/u,
  );
  assert.equal(
    (sql.match(/value_money IS NULL OR abs\(value_money\) < 100000000000000000000/gu) ?? []).length,
    2,
  );
});
