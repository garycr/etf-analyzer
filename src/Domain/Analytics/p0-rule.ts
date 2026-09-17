import {
  AnalyticsError,
  canonicalizeAnalyticsDecimal,
} from "./analytics.js";

export interface P0Assumptions {
  readonly costRate: string;
  readonly fillTiming: "next-session-open";
  readonly slippageRate: string;
}

export interface P0Session {
  readonly benchmarkClose: string;
  readonly effectiveAt: string;
  readonly instrumentClose: string;
  readonly instrumentOpen: string;
  readonly qualityState: "Partial" | "Quarantined" | "Stale" | "Valid";
  readonly tradingDate: string;
}

export interface P0BacktestRequest {
  readonly assumptions: P0Assumptions;
  readonly configurationHash: string;
  readonly instrumentId: string;
  readonly lookbackSessions: string;
  readonly sessions: readonly P0Session[];
}

export interface P0Signal {
  readonly instrumentId: string;
  readonly label: "Buy" | "Sell";
  readonly score: string;
}

export interface P0Trade {
  readonly effectiveAt: string;
  readonly fee: string;
  readonly grossValue: string;
  readonly instrumentId: string;
  readonly quantity: "1.0000000000";
  readonly side: "Buy" | "Sell";
  readonly tradeOrdinal: number;
  readonly unitPrice: string;
}

export interface P0Result {
  readonly configurationHash: string;
  readonly domain: "etf.analytics.result.v1";
  readonly metrics: readonly Readonly<{
    metricId: "totalReturn";
    numericClass: "Rate";
    value: string;
  }>[];
  readonly resultSchemaVersion: "1.0.0";
  readonly signals: readonly Readonly<P0Signal>[];
  readonly trades: readonly Readonly<P0Trade>[];
  readonly warnings: readonly never[];
}

const quantityScale = 10;
const moneyScale = 8;
const rateScale = 12;
const quantityOne = 10n ** BigInt(quantityScale);
const maximumCollectionItems = 10_000;
const maximumIdentifierBytes = 4_096;
const maximumLookbackDigits = 28;

function coefficient(value: string, scale: number): bigint {
  const [integer = "0", fraction = ""] = value.split(".");
  const negative = integer.startsWith("-");
  const magnitude = `${negative ? integer.slice(1) : integer}${fraction}`;
  const result = BigInt(magnitude);
  if (fraction.length !== scale) {
    throw new AnalyticsError("ANALYTICS_NUMERIC_CLASS_INVALID");
  }
  return negative ? -result : result;
}

function roundedQuotient(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new AnalyticsError("ANALYTICS_NUMERIC_CLASS_INVALID");
  }
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  let quotient = magnitude / denominator;
  const remainder = magnitude % denominator;
  if (remainder * 2n > denominator || (remainder * 2n === denominator && quotient % 2n !== 0n)) {
    quotient += 1n;
  }
  return negative ? -quotient : quotient;
}

function rescale(value: bigint, sourceScale: number, targetScale: number): bigint {
  if (sourceScale <= targetScale) {
    return value * 10n ** BigInt(targetScale - sourceScale);
  }
  return roundedQuotient(value, 10n ** BigInt(sourceScale - targetScale));
}

function format(value: bigint, scale: number): string {
  const normalized = value === 0n ? 0n : value;
  const negative = normalized < 0n;
  const digits = (negative ? -normalized : normalized).toString().padStart(scale + 1, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function rate(numerator: bigint, denominator: bigint): bigint {
  return roundedQuotient(numerator * 10n ** BigInt(rateScale), denominator);
}

function relativeMomentum(
  currentInstrument: bigint,
  priorInstrument: bigint,
  currentBenchmark: bigint,
  priorBenchmark: bigint,
): bigint {
  return rate(currentInstrument - priorInstrument, priorInstrument) -
    rate(currentBenchmark - priorBenchmark, priorBenchmark);
}

function executionPrice(open: bigint, slippage: bigint, side: "Buy" | "Sell"): bigint {
  const factor = 10n ** BigInt(rateScale) + (side === "Buy" ? slippage : -slippage);
  return rescale(open * factor, quantityScale + rateScale, quantityScale);
}

function moneyProduct(left: bigint, leftScale: number, right: bigint, rightScale: number): bigint {
  return rescale(left * right, leftScale + rightScale, moneyScale);
}

function requireCanonicalInstant(value: string): void {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/u.test(value) ||
    new Date(value).toISOString() !== value
  ) {
    throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
  }
}

function parseRequest(request: P0BacktestRequest): {
  readonly costRate: bigint;
  readonly lookback: number;
  readonly sessions: readonly Readonly<P0Session & {
    benchmark: bigint;
    close: bigint;
    open: bigint;
  }>[];
  readonly slippageRate: bigint;
} {
  if (
    !/^[0-9a-f]{64}$/u.test(request.configurationHash) ||
    request.instrumentId.length === 0 ||
    Buffer.byteLength(request.instrumentId, "utf8") > maximumIdentifierBytes ||
    !Array.isArray(request.sessions) ||
    request.sessions.length > maximumCollectionItems
  ) {
    throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
  }
  if (
    !/^[1-9][0-9]*$/u.test(request.lookbackSessions) ||
    request.lookbackSessions.length > maximumLookbackDigits
  ) {
    throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
  }
  const lookback = Number(request.lookbackSessions);
  if (!Number.isSafeInteger(lookback) || request.sessions.length <= lookback) {
    throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
  }
  if (request.assumptions.fillTiming !== "next-session-open") {
    throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
  }
  const costRate = coefficient(canonicalizeAnalyticsDecimal(request.assumptions.costRate, "Rate"), rateScale);
  const slippageRate = coefficient(canonicalizeAnalyticsDecimal(request.assumptions.slippageRate, "Rate"), rateScale);
  if (costRate < 0n || slippageRate < 0n || costRate >= 10n ** BigInt(rateScale) || slippageRate >= 10n ** BigInt(rateScale)) {
    throw new AnalyticsError("ANALYTICS_NUMERIC_CLASS_INVALID");
  }
  let previousDate: string | undefined;
  let previousEffectiveAt: string | undefined;
  const sessions = request.sessions.map((session) => {
    if (session.qualityState !== "Valid") {
      const code = session.qualityState === "Stale"
        ? "ANALYTICS_INPUT_STALE"
        : session.qualityState === "Quarantined"
        ? "ANALYTICS_INPUT_QUARANTINED"
        : "ANALYTICS_INPUT_INCOMPLETE";
      throw new AnalyticsError(code);
    }
    requireCanonicalInstant(session.effectiveAt);
    if (
      !/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/u.test(session.tradingDate) ||
      new Date(`${session.tradingDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== session.tradingDate ||
      session.effectiveAt.slice(0, 10) !== session.tradingDate
    ) {
      throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
    }
    if (
      (previousDate !== undefined && session.tradingDate <= previousDate) ||
      (previousEffectiveAt !== undefined && session.effectiveAt <= previousEffectiveAt)
    ) {
      throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
    }
    previousDate = session.tradingDate;
    previousEffectiveAt = session.effectiveAt;
    const benchmark = coefficient(canonicalizeAnalyticsDecimal(session.benchmarkClose, "Quantity"), quantityScale);
    const close = coefficient(canonicalizeAnalyticsDecimal(session.instrumentClose, "Quantity"), quantityScale);
    const open = coefficient(canonicalizeAnalyticsDecimal(session.instrumentOpen, "Quantity"), quantityScale);
    if (benchmark <= 0n || close <= 0n || open <= 0n) {
      throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
    }
    return Object.freeze({ ...session, benchmark, close, open });
  });
  return { costRate, lookback, sessions, slippageRate };
}

export function runP0Backtest(request: P0BacktestRequest): P0Result {
  const parsed = parseRequest(request);
  const trades: P0Trade[] = [];
  let cash = 0n;
  let investedCapital = 0n;
  let isLong = false;
  let latestScore = 0n;

  for (let index = parsed.lookback; index < parsed.sessions.length; index += 1) {
    const current = parsed.sessions[index];
    const prior = parsed.sessions[index - parsed.lookback];
    if (current === undefined || prior === undefined) {
      throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
    }
    latestScore = relativeMomentum(current.close, prior.close, current.benchmark, prior.benchmark);
    const fillSession = parsed.sessions[index + 1];
    if (fillSession === undefined) {
      continue;
    }
    const side = latestScore > 0n && !isLong
      ? "Buy"
      : latestScore < 0n && isLong
      ? "Sell"
      : undefined;
    if (side === undefined) {
      continue;
    }
    const unitPrice = executionPrice(fillSession.open, parsed.slippageRate, side);
    const grossValue = moneyProduct(unitPrice, quantityScale, quantityOne, quantityScale);
    const fee = moneyProduct(grossValue, moneyScale, parsed.costRate, rateScale);
    if (side === "Buy") {
      cash -= grossValue + fee;
      investedCapital += grossValue + fee;
      isLong = true;
    } else {
      cash += grossValue - fee;
      isLong = false;
    }
    trades.push(Object.freeze({
      effectiveAt: fillSession.effectiveAt,
      fee: format(fee, moneyScale),
      grossValue: format(grossValue, moneyScale),
      instrumentId: request.instrumentId,
      quantity: "1.0000000000",
      side,
      tradeOrdinal: trades.length,
      unitPrice: format(unitPrice, quantityScale),
    }));
  }

  const finalSession = parsed.sessions.at(-1);
  if (finalSession === undefined) {
    throw new AnalyticsError("ANALYTICS_INPUT_INCOMPLETE");
  }
  const markedValue = isLong
    ? moneyProduct(finalSession.close, quantityScale, quantityOne, quantityScale)
    : 0n;
  const totalReturn = investedCapital === 0n
    ? 0n
    : rate(cash + markedValue, investedCapital);
  const signals = latestScore === 0n
    ? []
    : [Object.freeze({
        instrumentId: request.instrumentId,
        label: latestScore > 0n ? "Buy" as const : "Sell" as const,
        score: format(latestScore, rateScale),
      })];

  return Object.freeze({
    configurationHash: request.configurationHash,
    domain: "etf.analytics.result.v1",
    metrics: Object.freeze([Object.freeze({
      metricId: "totalReturn",
      numericClass: "Rate",
      value: format(totalReturn, rateScale),
    })]),
    resultSchemaVersion: "1.0.0",
    signals: Object.freeze(signals),
    trades: Object.freeze(trades),
    warnings: Object.freeze([]),
  });
}
