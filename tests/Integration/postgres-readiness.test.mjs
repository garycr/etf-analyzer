import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { checkPostgresBaseline } from "../../dist/Infrastructure/PostgreSQL/readiness.js";

const connectionString = process.env.ETF_TEST_POSTGRES_URL;

test(
  "PostgreSQL 16 container satisfies the baseline readiness probe",
  { skip: !connectionString },
  async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      assert.deepEqual(await checkPostgresBaseline(client), { ready: true });
    } finally {
      await client.end();
    }
  },
);
