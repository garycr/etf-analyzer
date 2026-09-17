import type {
  ApplicationReplayKey,
  ApplicationReplayStore,
} from "../../Application/application-boundary.js";

interface QueryResult {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

export interface ApplicationReplayQueryClient {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>;
}

function freezeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeJson));
  }
  if (value !== null && typeof value === "object") {
    const frozen: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) frozen[key] = freezeJson(entry);
    return Object.freeze(frozen);
  }
  return value;
}

function isFailedResult(result: unknown): boolean {
  if (result === null || typeof result !== "object") return false;
  return Object.getOwnPropertyDescriptor(result, "outcome")?.value === "Failed";
}

function mapReplayError(error: unknown): Error & { readonly code: string } {
  if (error !== null && typeof error === "object") {
    const sqlState = Object.getOwnPropertyDescriptor(error, "code")?.value;
    const message = Object.getOwnPropertyDescriptor(error, "message")?.value;
    if (sqlState === "P0001" && message === "APPLICATION_IDEMPOTENCY_CONFLICT") {
      return Object.assign(new Error(message), { code: message });
    }
  }
  return Object.assign(new Error("APPLICATION_DEPENDENCY_UNAVAILABLE"), {
    code: "APPLICATION_DEPENDENCY_UNAVAILABLE",
  });
}

class PostgresApplicationReplayStore implements ApplicationReplayStore {
  constructor(private readonly client: ApplicationReplayQueryClient) {}

  execute<Result>(
    _key: ApplicationReplayKey,
    _canonicalContent: string,
    _executeNew: () => Result,
  ): Result {
    throw Object.assign(new Error("PostgreSQL application replay requires async execution"), {
      code: "APPLICATION_CONFIGURATION_INVALID",
    });
  }

  async executeAsync<Result>(
    key: ApplicationReplayKey,
    canonicalContent: string,
    executeNew: () => Promise<Result>,
  ): Promise<Result> {
    await this.client.query("BEGIN");
    try {
      const replay = await this.client.query(
        "SELECT etf.application_replay_get($1::text, $2::uuid, $3::text) AS result",
        [key.operation, key.commandId, canonicalContent],
      );
      if (replay.rows.length !== 1 || !("result" in replay.rows[0]!)) {
        throw new Error("Invalid application replay result");
      }
      if (replay.rows[0]!.result !== null) {
        await this.client.query("COMMIT");
        return freezeJson(replay.rows[0]!.result) as Result;
      }

      await this.client.query("SAVEPOINT application_owner");
      const result = await executeNew();
      if (isFailedResult(result)) {
        await this.client.query("ROLLBACK TO SAVEPOINT application_owner");
      } else {
        await this.client.query("RELEASE SAVEPOINT application_owner");
      }
      const stored = await this.client.query(
        "SELECT etf.application_replay_get_or_put($1::text, $2::uuid, $3::text, $4::text) AS result",
        [key.operation, key.commandId, canonicalContent, JSON.stringify(result)],
      );
      if (stored.rows.length !== 1 || !("result" in stored.rows[0]!)) {
        throw new Error("Invalid application replay write result");
      }
      await this.client.query("COMMIT");
      return result;
    } catch (error) {
      await this.client.query("ROLLBACK").catch(() => undefined);
      if (
        error !== null &&
        typeof error === "object" &&
        Object.getOwnPropertyDescriptor(error, "code")?.value === "APPLICATION_RESULT_INVALID"
      ) {
        throw error;
      }
      throw mapReplayError(error);
    }
  }
}

export function createPostgresApplicationReplayStore(
  client: ApplicationReplayQueryClient,
): ApplicationReplayStore {
  return new PostgresApplicationReplayStore(client);
}
