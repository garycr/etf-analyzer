interface QueryResult {
  rows: Record<string, unknown>[];
}

export interface QueryClient {
  query(sql: string): Promise<QueryResult>;
}

export type PostgresBaselineResult =
  | { ready: true }
  | {
      errorCode:
        | "APPLICATION_DATABASE_UNAVAILABLE"
        | "APPLICATION_MIGRATIONS_INCOMPLETE";
      ready: false;
    };

const baselineQuery = `
SELECT
  (SELECT datcollate FROM pg_catalog.pg_database WHERE datname = current_database()) AS identifier_collation,
  current_setting('server_encoding') AS server_encoding,
  current_setting('server_version_num') AS server_version_num,
  current_setting('standard_conforming_strings') AS standard_conforming_strings,
  current_setting('TimeZone') AS timezone
`;

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

  return { ready: true };
}
