import type {
  ApplicationOperationDefinition,
  ApplicationOwnerCommandContext,
} from "../../Application/application-boundary.js";

interface QueryResult {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

export interface JobRestartQueryClient {
  query(sql: string, values: readonly unknown[]): Promise<QueryResult>;
}

function invalidOwnerRequest(): never {
  throw Object.assign(new Error("APPLICATION_REQUEST_INVALID"), {
    code: "APPLICATION_REQUEST_INVALID",
  });
}

function mapPostgresJobRestartError(error: unknown): never {
  if (error !== null && typeof error === "object") {
    const sqlState = Object.getOwnPropertyDescriptor(error, "code")?.value;
    const message = Object.getOwnPropertyDescriptor(error, "message")?.value;
    if (
      sqlState === "P0001" &&
      message === "APPLICATION_JOB_NOT_RESTARTABLE"
    ) {
      throw Object.assign(new Error(message), { code: message });
    }
    if (sqlState === "P0002" && message === "APPLICATION_JOB_NOT_FOUND") {
      throw Object.assign(new Error(message), { code: message });
    }
    if (sqlState === "42501" && message === "permission denied") {
      throw Object.assign(new Error("APPLICATION_UNAUTHORIZED"), {
        code: "APPLICATION_UNAUTHORIZED",
      });
    }
  }
  throw Object.assign(new Error("APPLICATION_DEPENDENCY_UNAVAILABLE"), {
    code: "APPLICATION_DEPENDENCY_UNAVAILABLE",
  });
}

export async function dispatchPostgresJobRestart(
  client: JobRestartQueryClient,
  definition: ApplicationOperationDefinition,
  payload: Readonly<Record<string, unknown>>,
  context: Readonly<ApplicationOwnerCommandContext> | undefined,
): Promise<Readonly<{ job: unknown }>> {
  if (
    definition.kind !== "command" ||
    definition.operation !== "JobRestart" ||
    context === undefined
  ) {
    return invalidOwnerRequest();
  }

  try {
    const result = await client.query(
      "SELECT etf.job_restart($1::jsonb) AS job",
      [JSON.stringify(payload)],
    );
    if (result.rows.length !== 1 || !("job" in result.rows[0]!)) {
      throw Object.assign(new Error("APPLICATION_RESULT_INVALID"), {
        code: "APPLICATION_RESULT_INVALID",
      });
    }
    return Object.freeze({ job: result.rows[0]!.job });
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      Object.getOwnPropertyDescriptor(error, "code")?.value ===
        "APPLICATION_RESULT_INVALID"
    ) {
      throw error;
    }
    return mapPostgresJobRestartError(error);
  }
}
