import assert from "node:assert/strict";
import test from "node:test";

import {
  checkPostgresBaseline,
  checkPostgresMigrationState,
} from "../../dist/Infrastructure/PostgreSQL/readiness.js";

function clientReturning(row) {
  return { query: async () => ({ rows: [row] }) };
}

test("PostgreSQL 16 baseline reports ready for exact server settings", async () => {
  const result = await checkPostgresBaseline(
    clientReturning({
      identifier_collation: "C",
      server_encoding: "UTF8",
      server_version_num: "160010",
      standard_conforming_strings: "on",
      timezone: "UTC",
    }),
  );

  assert.deepEqual(result, { ready: true });
});

test("PostgreSQL connection failure returns the stable application error", async () => {
  const result = await checkPostgresBaseline({
    query: async () => {
      throw new Error("connection refused with password=do-not-log");
    },
  });

  assert.deepEqual(result, {
    errorCode: "APPLICATION_DATABASE_UNAVAILABLE",
    ready: false,
  });
});

test("PostgreSQL baseline drift fails without exposing server values", async () => {
  for (const [field, value] of [
    ["identifier_collation", "en_US.utf8"],
    ["server_encoding", "SQL_ASCII"],
    ["server_version_num", "170000"],
    ["standard_conforming_strings", "off"],
    ["timezone", "America/Chicago"],
  ]) {
    const row = {
      identifier_collation: "C",
      server_encoding: "UTF8",
      server_version_num: "160010",
      standard_conforming_strings: "on",
      timezone: "UTC",
      [field]: value,
    };

    assert.deepEqual(
      await checkPostgresBaseline(clientReturning(row)),
      { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false },
      field,
    );
  }
});

test("PostgreSQL baseline rejects empty results and versions outside major 16", async () => {
  assert.deepEqual(
    await checkPostgresBaseline({ query: async () => ({ rows: [] }) }),
    { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false },
  );

  for (const serverVersion of ["159999", "170000", "16-invalid"]) {
    assert.deepEqual(
      await checkPostgresBaseline(
        clientReturning({
          identifier_collation: "C",
          server_encoding: "UTF8",
          server_version_num: serverVersion,
          standard_conforming_strings: "on",
          timezone: "UTC",
        }),
      ),
      { errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE", ready: false },
      serverVersion,
    );
  }
});

test("exact empty schema prerequisite remains NotReady without a migration ledger", async () => {
  const result = await checkPostgresMigrationState(
    clientReturning({ migration_table: null }),
  );

  assert.deepEqual(result, {
    errorCode: "APPLICATION_MIGRATIONS_INCOMPLETE",
    ready: false,
  });
});
