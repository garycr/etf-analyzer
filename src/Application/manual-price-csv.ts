import { createHash } from "node:crypto";

const headers = [
  "instrumentId",
  "tradingDate",
  "value",
  "providerId",
  "sourceAvailableAt",
  "revision",
  "adjustmentPolicy",
] as const;

export interface ManualPriceCsvOptions {
  readonly ingestionJobId: string;
  readonly normalizationId: string;
}

export interface ManualPriceCsvResult {
  readonly rawSource: Buffer;
  readonly rawSourceHash: string;
  readonly rawSourceRef: string;
  readonly marketObservations: readonly Readonly<Record<string, unknown>>[];
}

function invalid(): never {
  throw new Error("MANUAL_PRICE_CSV_INVALID");
}

function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (afterQuote) {
      if (character === ",") {
        row.push(field);
        field = "";
        afterQuote = false;
      } else if (character === "\n" || character === "\r") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        afterQuote = false;
        if (character === "\r" && source[index + 1] === "\n") index += 1;
      } else {
        invalid();
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }
  if (quoted) invalid();
  if (afterQuote || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.length > 0));
}

function canonicalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function canonicalTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

export function parseManualPriceCsv(
  source: string,
  options: ManualPriceCsvOptions,
): ManualPriceCsvResult {
  if (source.length === 0 || options.ingestionJobId.length === 0 || options.normalizationId.length === 0) {
    invalid();
  }
  const sourceBytes = Buffer.from(source, "utf8");
  const rawSourceHash = createHash("sha256").update(sourceBytes).digest("hex");
  const rawSourceRef = `raw-sources/${rawSourceHash}`;
  const rows = parseCsv(source.replace(/^\uFEFF/u, ""));
  if (rows.length < 2 || rows[0] === undefined || rows[0].length !== headers.length ||
      rows[0].some((value, index) => value !== headers[index])) {
    invalid();
  }

  const seen = new Set<string>();
  const marketObservations = rows.slice(1).map((row) => {
    if (row.length !== headers.length || row.some((value) => value.length === 0)) invalid();
    const [instrumentId, tradingDate, value, providerId, sourceAvailableAt, revision, adjustmentPolicy] = row;
    if (
      !instrumentId || !tradingDate || !value || !providerId || !sourceAvailableAt || !revision || !adjustmentPolicy ||
      !canonicalDate(tradingDate) || !/^\d+\.\d{10}$/u.test(value) ||
      !canonicalTimestamp(sourceAvailableAt) || !/^(0|[1-9]\d*)$/u.test(revision) ||
      adjustmentPolicy !== "split-adjusted"
    ) invalid();
    const key = `${instrumentId}\u0000${tradingDate}\u0000${revision}`;
    if (seen.has(key)) throw new Error("MANUAL_PRICE_CSV_DUPLICATE");
    seen.add(key);
    return Object.freeze({
      adjustmentPolicy,
      currency: "USD",
      ingestionJobId: options.ingestionJobId,
      instrumentId,
      normalizationId: options.normalizationId,
      numericClass: "UnitPrice",
      providerId,
      qualityCodes: Object.freeze([]),
      qualityState: "Valid",
      rawSourceHash,
      rawSourceRef,
      revision,
      sourceAvailableAt,
      tradingDate,
      value,
    });
  });

  return Object.freeze({
    rawSource: sourceBytes,
    rawSourceHash,
    rawSourceRef,
    marketObservations: Object.freeze(marketObservations),
  });
}
