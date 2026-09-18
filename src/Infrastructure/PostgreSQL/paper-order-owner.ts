import type {
  ApplicationOperationDefinition,
  ApplicationOwnerCommandContext,
} from "../../Application/application-boundary.js";
import { canonicalizePaperOrderCommand } from "../../Domain/Orders/paper-order.js";

interface QueryResult {
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

export interface PaperOrderQueryClient {
  query(sql: string, values: readonly unknown[]): Promise<QueryResult>;
}

function invalidOwnerRequest(): never {
  throw Object.assign(new Error("APPLICATION_REQUEST_INVALID"), {
    code: "APPLICATION_REQUEST_INVALID",
  });
}

function applicationUIntToNumber(value: unknown): number {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    return invalidOwnerRequest();
  }
  const converted = Number(value);
  if (!Number.isSafeInteger(converted)) return invalidOwnerRequest();
  return converted;
}

function normalizeTransitionPayload(
  transition: unknown,
  payload: unknown,
): unknown {
  if (
    transition !== "OT-03" &&
    transition !== "OT-05" &&
    transition !== "OT-06" &&
    transition !== "OT-09"
  ) {
    return payload;
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return invalidOwnerRequest();
  }
  return {
    ...payload,
    expectedPortfolioVersion: applicationUIntToNumber(
      Object.getOwnPropertyDescriptor(payload, "expectedPortfolioVersion")?.value,
    ),
  };
}

const postgresOrderErrors: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  "40001": new Set(["ORDER_VERSION_CONFLICT", "LEDGER_VERSION_CONFLICT"]),
  "42501": new Set(["permission denied"]),
  "P0001": new Set([
    "LEDGER_ORDER_MISMATCH",
    "ORDER_GUARD_FAILED",
    "ORDER_IDEMPOTENCY_CONFLICT",
    "ORDER_INVALID_TRANSITION",
    "ORDER_TERMINAL_STATE",
  ]),
  "P0002": new Set(["ORDER_NOT_FOUND"]),
});

function mapPostgresOrderError(error: unknown): never {
  if (error !== null && typeof error === "object") {
    const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
    const message = Object.getOwnPropertyDescriptor(error, "message")?.value;
    if (
      typeof code === "string" &&
      typeof message === "string" &&
      postgresOrderErrors[code]?.has(message)
    ) {
      const stableCode = code === "42501" ? "APPLICATION_UNAUTHORIZED" : message;
      throw Object.assign(new Error(stableCode), { code: stableCode });
    }
  }
  throw Object.assign(new Error("APPLICATION_DEPENDENCY_UNAVAILABLE"), {
    code: "APPLICATION_DEPENDENCY_UNAVAILABLE",
  });
}

export async function dispatchPostgresPaperOrder(
  client: PaperOrderQueryClient,
  definition: ApplicationOperationDefinition,
  payload: Readonly<Record<string, unknown>>,
  context: Readonly<ApplicationOwnerCommandContext> | undefined,
): Promise<Readonly<{ order: unknown }>> {
  if (definition.kind !== "command" || context === undefined) {
    return invalidOwnerRequest();
  }

  let command: Readonly<Record<string, unknown>>;
  if (definition.operation === "PaperOrderDraftCreate") {
    command = {
      correlationId: context.correlationId,
      expectedVersion: 0,
      occurredAt: context.requestedAt,
      operation: "DraftCreate",
      orderId: payload.orderId,
      transition: "OT-01",
      transitionCommandId: context.commandId,
      transitionPayload: {
        instrumentId: payload.instrumentId,
        quantity: payload.quantity,
        researchEvidenceId: payload.researchEvidenceId,
        side: payload.side,
        tradeDate: payload.tradeDate,
        unitPrice: payload.unitPrice,
      },
    };
  } else if (definition.operation === "PaperOrderTransition") {
    command = {
      correlationId: context.correlationId,
      expectedVersion: applicationUIntToNumber(payload.expectedVersion),
      occurredAt: context.requestedAt,
      operation: "Transition",
      orderId: payload.orderId,
      transition: payload.transition,
      transitionCommandId: payload.transitionCommandId,
      transitionPayload: normalizeTransitionPayload(
        payload.transition,
        payload.transitionPayload,
      ),
    };
  } else {
    return invalidOwnerRequest();
  }

  const canonical = canonicalizePaperOrderCommand(command);
  let mutation: QueryResult;
  try {
    mutation = await client.query(
      "SELECT etf.paper_order_transition($1::jsonb) AS result",
      [canonical.databasePayload],
    );
  } catch (error) {
    return mapPostgresOrderError(error);
  }
  if (mutation.rows.length !== 1 || !("result" in mutation.rows[0]!)) {
    throw Object.assign(new Error("APPLICATION_RESULT_INVALID"), {
      code: "APPLICATION_RESULT_INVALID",
    });
  }
  let projection: QueryResult;
  try {
    projection = await client.query(
      "SELECT etf.paper_order_command_get($1::uuid, $2::uuid) AS result",
      [command.orderId, command.transitionCommandId],
    );
  } catch (error) {
    return mapPostgresOrderError(error);
  }
  const result = projection.rows[0]?.result;
  if (
    projection.rows.length !== 1 ||
    typeof result !== "object" ||
    result === null ||
    Array.isArray(result) ||
    !("order" in result)
  ) {
    throw Object.assign(new Error("APPLICATION_RESULT_INVALID"), {
      code: "APPLICATION_RESULT_INVALID",
    });
  }
  return Object.freeze({ order: result.order });
}
