import { canonicalizeJson } from "../../Infrastructure/CanonicalJson/canonical-json.js";

export type PaperOrderState =
  | "Draft"
  | "Submitted"
  | "Accepted"
  | "Partial"
  | "Filled"
  | "Rejected"
  | "Canceled"
  | "Expired";

export interface DraftCreatePayload {
  readonly instrumentId: string;
  readonly quantity: string;
  readonly researchEvidenceId: string;
  readonly side: "Buy" | "Sell";
  readonly tradeDate: string;
  readonly unitPrice: string;
}

export interface DraftCreateCommand {
  readonly correlationId: string;
  readonly expectedVersion: 0;
  readonly occurredAt: string;
  readonly operation: "DraftCreate";
  readonly orderId: string;
  readonly transition: "OT-01";
  readonly transitionCommandId: string;
  readonly transitionPayload: DraftCreatePayload;
}

export interface PaperOrderTransitionMetadata {
  readonly sourceState: "Initial" | PaperOrderState;
  readonly targetState: PaperOrderState;
  readonly trigger: string;
}

export interface CanonicalPaperOrderCommand {
  readonly canonicalContent: string;
  readonly databasePayload: Readonly<Record<string, unknown>>;
  readonly transition: Readonly<PaperOrderTransitionMetadata>;
}

export class PaperOrderError extends Error {
  readonly code:
    | "ORDER_INVALID_TRANSITION"
    | "ORDER_REQUEST_INVALID"
    | "ORDER_TERMINAL_STATE"
    | "ORDER_UNKNOWN_STATE";

  constructor(
    code:
      | "ORDER_INVALID_TRANSITION"
      | "ORDER_REQUEST_INVALID"
      | "ORDER_TERMINAL_STATE"
      | "ORDER_UNKNOWN_STATE" = "ORDER_REQUEST_INVALID",
  ) {
    super(code);
    this.name = "PaperOrderError";
    this.code = code;
  }
}

const commandFields = [
  "correlationId",
  "expectedVersion",
  "occurredAt",
  "operation",
  "orderId",
  "transition",
  "transitionCommandId",
  "transitionPayload",
] as const;
const draftPayloadFields = [
  "instrumentId",
  "quantity",
  "researchEvidenceId",
  "side",
  "tradeDate",
  "unitPrice",
] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const utcInstantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const quantityPattern = /^(0|[1-9][0-9]*)\.\d{10}$/;
const moneyPattern = /^(0|[1-9][0-9]*)\.\d{8}$/;
const boundedCodePattern = /^[A-Z][A-Z0-9_]{0,127}$/;
const maximumQuantityCoefficient = 10_000_000_000_000_000_000n;
const maximumUnitPriceCoefficient = 10_000_000_000_000_000n;
const maximumFeeCoefficient = 100_000_000_000_000_000n;

const transitionCatalog = Object.freeze({
  "OT-02": Object.freeze({
    fields: ["confirmation"],
    sourceState: "Draft",
    targetState: "Submitted",
    trigger: "UserConfirmedPaperAction",
  }),
  "OT-03": Object.freeze({
    fields: ["expectedPortfolioVersion", "portfolioId", "validationSnapshotId"],
    sourceState: "Submitted",
    targetState: "Accepted",
    trigger: "PortfolioValidationPassed",
  }),
  "OT-04": Object.freeze({
    fields: ["rejectionCode"],
    sourceState: "Submitted",
    targetState: "Rejected",
    trigger: "PortfolioValidationFailed",
  }),
  "OT-05": Object.freeze({
    fields: ["expectedPortfolioVersion", "fee", "fillId", "portfolioId", "quantity", "transactionId", "unitPrice"],
    sourceState: "Accepted",
    targetState: "Partial",
    trigger: "LocalPartialFillSimulated",
  }),
  "OT-06": Object.freeze({
    fields: ["expectedPortfolioVersion", "fee", "fillId", "portfolioId", "quantity", "transactionId", "unitPrice"],
    sourceState: "Accepted",
    targetState: "Filled",
    trigger: "LocalCompleteFillSimulated",
  }),
  "OT-07": Object.freeze({
    fields: ["reasonCode"],
    sourceState: "Accepted",
    targetState: "Canceled",
    trigger: "UserCanceledOpenQuantity",
  }),
  "OT-08": Object.freeze({
    fields: ["expiresAt"],
    sourceState: "Accepted",
    targetState: "Expired",
    trigger: "DeterministicExpiryReached",
  }),
  "OT-09": Object.freeze({
    fields: ["expectedPortfolioVersion", "fee", "fillId", "portfolioId", "quantity", "transactionId", "unitPrice"],
    sourceState: "Partial",
    targetState: "Filled",
    trigger: "LocalRemainderFillSimulated",
  }),
  "OT-10": Object.freeze({
    fields: ["reasonCode"],
    sourceState: "Partial",
    targetState: "Canceled",
    trigger: "UserCanceledRemainingQuantity",
  }),
} as const);

type TransitionName = keyof typeof transitionCatalog;

const transitionByStatePair: Readonly<Record<string, "OT-01" | TransitionName>> =
  Object.freeze({
    "Accepted:Canceled": "OT-07",
    "Accepted:Expired": "OT-08",
    "Accepted:Filled": "OT-06",
    "Accepted:Partial": "OT-05",
    "Draft:Submitted": "OT-02",
    "Initial:Draft": "OT-01",
    "Partial:Canceled": "OT-10",
    "Partial:Filled": "OT-09",
    "Submitted:Accepted": "OT-03",
    "Submitted:Rejected": "OT-04",
  });
const terminalStates = new Set<PaperOrderState>([
  "Filled",
  "Rejected",
  "Canceled",
  "Expired",
]);
const paperOrderStates = new Set<PaperOrderState>([
  "Draft",
  "Submitted",
  "Accepted",
  "Partial",
  "Filled",
  "Rejected",
  "Canceled",
  "Expired",
]);

function fail(): never {
  throw new PaperOrderError();
}

export function selectPaperOrderTransition(
  sourceState: string,
  targetState: string,
): "OT-01" | TransitionName {
  if (
    (sourceState !== "Initial" && !paperOrderStates.has(sourceState as PaperOrderState)) ||
    !paperOrderStates.has(targetState as PaperOrderState)
  ) {
    throw new PaperOrderError("ORDER_UNKNOWN_STATE");
  }
  if (terminalStates.has(sourceState as PaperOrderState)) {
    throw new PaperOrderError("ORDER_TERMINAL_STATE");
  }
  const transition = transitionByStatePair[`${sourceState}:${targetState}`];
  if (transition === undefined) {
    throw new PaperOrderError("ORDER_INVALID_TRANSITION");
  }
  return transition;
}

function requireClosedRecord(
  value: unknown,
  fields: readonly string[],
): asserts value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail();
  }

  const keys = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    fail();
  }
}

function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    fail();
  }
  return value;
}

function requireUtcInstant(value: unknown): string {
  if (
    typeof value !== "string" ||
    !utcInstantPattern.test(value) ||
    new Date(value).toISOString() !== value
  ) {
    fail();
  }
  return value;
}

function requireDate(value: unknown): string {
  if (typeof value !== "string" || !datePattern.test(value)) {
    fail();
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    fail();
  }
  return value;
}

function requireInstrumentId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > 256 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    fail();
  }
  return value;
}

function requirePositiveScale10(
  value: unknown,
  maximumCoefficient: bigint,
): string {
  if (typeof value !== "string" || !quantityPattern.test(value)) {
    fail();
  }
  const coefficient = BigInt(value.replace(".", ""));
  if (coefficient <= 0n || coefficient > maximumCoefficient) {
    fail();
  }
  return value;
}

function requireNonnegativeMoney(value: unknown): string {
  if (typeof value !== "string" || !moneyPattern.test(value)) {
    fail();
  }
  const coefficient = BigInt(value.replace(".", ""));
  if (coefficient > maximumFeeCoefficient) {
    fail();
  }
  return value;
}

function requireUnsignedInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail();
  }
  return value;
}

function requireBoundedCode(value: unknown): string {
  if (typeof value !== "string" || !boundedCodePattern.test(value)) {
    fail();
  }
  return value;
}

function requireConfirmationText(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > 256 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    fail();
  }
  return value;
}

function requireTransitionName(value: unknown): TransitionName {
  if (typeof value !== "string" || !(value in transitionCatalog)) {
    fail();
  }
  return value as TransitionName;
}

function normalizeTransitionPayload(
  transition: TransitionName,
  value: unknown,
  occurredAt: string,
): Readonly<Record<string, unknown>> {
  const definition = transitionCatalog[transition];
  requireClosedRecord(value, definition.fields);

  if (transition === "OT-02") {
    requireClosedRecord(value.confirmation, ["actorId", "confirmedAt", "confirmationText"]);
    const confirmedAt = requireUtcInstant(value.confirmation.confirmedAt);
    if (value.confirmation.actorId !== "local-user" || confirmedAt !== occurredAt) {
      fail();
    }
    const confirmationText = requireConfirmationText(value.confirmation.confirmationText);
    return Object.freeze({
      confirmation: Object.freeze({
        actorId: "local-user",
        confirmedAt,
        confirmationText,
      }),
    });
  }

  if (transition === "OT-03") {
    return Object.freeze({
      expectedPortfolioVersion: requireUnsignedInteger(value.expectedPortfolioVersion),
      portfolioId: requireUuid(value.portfolioId),
      validationSnapshotId: requireUuid(value.validationSnapshotId),
    });
  }

  if (transition === "OT-04") {
    return Object.freeze({ rejectionCode: requireBoundedCode(value.rejectionCode) });
  }

  if (transition === "OT-05" || transition === "OT-06" || transition === "OT-09") {
    return Object.freeze({
      expectedPortfolioVersion: requireUnsignedInteger(value.expectedPortfolioVersion),
      fee: requireNonnegativeMoney(value.fee),
      fillId: requireUuid(value.fillId),
      portfolioId: requireUuid(value.portfolioId),
      quantity: requirePositiveScale10(value.quantity, maximumQuantityCoefficient),
      transactionId: requireUuid(value.transactionId),
      unitPrice: requirePositiveScale10(value.unitPrice, maximumUnitPriceCoefficient),
    });
  }

  if (transition === "OT-07" || transition === "OT-10") {
    return Object.freeze({ reasonCode: requireBoundedCode(value.reasonCode) });
  }

  const expiresAt = requireUtcInstant(value.expiresAt);
  if (expiresAt > occurredAt) {
    fail();
  }
  return Object.freeze({ expiresAt });
}

export function canonicalizePaperOrderCommand(
  value: unknown,
): CanonicalPaperOrderCommand {
  requireClosedRecord(value, commandFields);
  const occurredAt = requireUtcInstant(value.occurredAt);
  let command: Readonly<Record<string, unknown>>;
  let metadata: Readonly<PaperOrderTransitionMetadata>;

  if (value.operation === "DraftCreate" && value.transition === "OT-01") {
    if (value.expectedVersion !== 0) {
      fail();
    }
    requireClosedRecord(value.transitionPayload, draftPayloadFields);
    command = Object.freeze({
      correlationId: requireUuid(value.correlationId),
      expectedVersion: 0,
      occurredAt,
      operation: "DraftCreate",
      orderId: requireUuid(value.orderId),
      transition: "OT-01",
      transitionCommandId: requireUuid(value.transitionCommandId),
      transitionPayload: Object.freeze({
        instrumentId: requireInstrumentId(value.transitionPayload.instrumentId),
        quantity: requirePositiveScale10(value.transitionPayload.quantity, maximumQuantityCoefficient),
        researchEvidenceId: requireUuid(value.transitionPayload.researchEvidenceId),
        side:
          value.transitionPayload.side === "Buy" || value.transitionPayload.side === "Sell"
            ? value.transitionPayload.side
            : fail(),
        tradeDate: requireDate(value.transitionPayload.tradeDate),
        unitPrice: requirePositiveScale10(value.transitionPayload.unitPrice, maximumUnitPriceCoefficient),
      }),
    });
    metadata = Object.freeze({
      sourceState: "Initial",
      targetState: "Draft",
      trigger: "UserCreatedFromResearch",
    });
  } else {
    if (value.operation !== "Transition") {
      fail();
    }
    const transition = requireTransitionName(value.transition);
    const definition = transitionCatalog[transition];
    command = Object.freeze({
      correlationId: requireUuid(value.correlationId),
      expectedVersion: requireUnsignedInteger(value.expectedVersion),
      occurredAt,
      operation: "Transition",
      orderId: requireUuid(value.orderId),
      transition,
      transitionCommandId: requireUuid(value.transitionCommandId),
      transitionPayload: normalizeTransitionPayload(transition, value.transitionPayload, occurredAt),
    });
    metadata = Object.freeze({
      sourceState: definition.sourceState,
      targetState: definition.targetState,
      trigger: definition.trigger,
    });
  }
  const canonicalContent = canonicalizeJson(command);

  return Object.freeze({
    canonicalContent,
    databasePayload: Object.freeze({ canonicalContent, ...command }),
    transition: metadata,
  });
}
