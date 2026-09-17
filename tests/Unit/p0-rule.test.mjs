import assert from "node:assert/strict";
import test from "node:test";

import { AnalyticsError } from "../../dist/Domain/Analytics/analytics.js";
import { runP0Backtest } from "../../dist/Domain/Analytics/p0-rule.js";

const configurationHash = "fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37";
const assumptions = {
  costRate: "0.001000000000",
  fillTiming: "next-session-open",
  slippageRate: "0.000500000000",
};

function session(tradingDate, instrumentOpen, instrumentClose, benchmarkClose) {
  return {
    benchmarkClose,
    effectiveAt: `${tradingDate}T14:30:00.000Z`,
    instrumentClose,
    instrumentOpen,
    qualityState: "Valid",
    tradingDate,
  };
}

test("P0 relative momentum is deterministic and buys only at the next session open", () => {
  const request = {
    assumptions,
    configurationHash,
    instrumentId: "ETF-1",
    lookbackSessions: "1",
    sessions: [
      session("2026-01-28", "99.0000000000", "100.0000000000", "100.0000000000"),
      session("2026-01-29", "101.0000000000", "110.0000000000", "105.0000000000"),
      session("2026-01-30", "112.0000000000", "120.0000000000", "110.0000000000"),
    ],
  };

  const first = runP0Backtest(request);
  const second = runP0Backtest(structuredClone(request));

  assert.deepEqual(first, second);
  assert.deepEqual(first.trades, [{
    effectiveAt: "2026-01-30T14:30:00.000Z",
    fee: "0.11205600",
    grossValue: "112.05600000",
    instrumentId: "ETF-1",
    quantity: "1.0000000000",
    side: "Buy",
    tradeOrdinal: 0,
    unitPrice: "112.0560000000",
  }]);
  assert.equal(first.metrics[0].metricId, "totalReturn");
  assert.equal(first.metrics[0].value, "0.069823301565");
  assert.equal(first.signals[0].instrumentId, "ETF-1");
  assert.equal(first.signals[0].label, "Buy");
  assert.match(first.signals[0].score, /^0\.\d{12}$/u);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.trades));
});

test("P0 negative relative momentum never creates a short position", () => {
  const result = runP0Backtest({
    assumptions,
    configurationHash,
    instrumentId: "ETF-1",
    lookbackSessions: "1",
    sessions: [
      session("2026-01-28", "100.0000000000", "100.0000000000", "100.0000000000"),
      session("2026-01-29", "90.0000000000", "90.0000000000", "105.0000000000"),
      session("2026-01-30", "89.0000000000", "88.0000000000", "110.0000000000"),
    ],
  });

  assert.equal(result.signals[0].label, "Sell");
  assert.deepEqual(result.trades, []);
  assert.equal(result.metrics[0].value, "0.000000000000");
});

test("P0 Sell closes an existing hypothetical long at the next session open", () => {
  const result = runP0Backtest({
    assumptions,
    configurationHash,
    instrumentId: "ETF-1",
    lookbackSessions: "1",
    sessions: [
      session("2026-01-27", "99.0000000000", "100.0000000000", "100.0000000000"),
      session("2026-01-28", "101.0000000000", "110.0000000000", "100.0000000000"),
      session("2026-01-29", "111.0000000000", "100.0000000000", "105.0000000000"),
      session("2026-01-30", "99.0000000000", "98.0000000000", "110.0000000000"),
    ],
  });

  assert.deepEqual(result.trades.map(({ side, effectiveAt }) => ({ side, effectiveAt })), [
    { side: "Buy", effectiveAt: "2026-01-29T14:30:00.000Z" },
    { side: "Sell", effectiveAt: "2026-01-30T14:30:00.000Z" },
  ]);
  assert.equal(result.trades[1].unitPrice, "98.9505000000");
  assert.equal(result.signals[0].label, "Sell");
});

test("PT-ANA-010-NO-SIGNAL commits an empty signal result distinct from blocked input", () => {
  const result = runP0Backtest({
    assumptions,
    configurationHash,
    instrumentId: "ETF-1",
    lookbackSessions: "1",
    sessions: [
      session("2026-01-28", "100.0000000000", "100.0000000000", "100.0000000000"),
      session("2026-01-29", "101.0000000000", "101.0000000000", "101.0000000000"),
    ],
  });
  assert.deepEqual(result.signals, []);
  assert.deepEqual(result.trades, []);
  assert.equal(result.metrics[0].value, "0.000000000000");

  assert.throws(
    () => runP0Backtest({
      assumptions,
      configurationHash,
      instrumentId: "ETF-1",
      lookbackSessions: "1",
      sessions: [session("2026-01-28", "100.0000000000", "100.0000000000", "100.0000000000")],
    }),
    (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INPUT_INCOMPLETE",
  );
});

test("PT-ANA-006-MISSING-INPUT blocks partial, stale, and quarantined sessions", () => {
  for (const [qualityState, code] of [
    ["Partial", "ANALYTICS_INPUT_INCOMPLETE"],
    ["Stale", "ANALYTICS_INPUT_STALE"],
    ["Quarantined", "ANALYTICS_INPUT_QUARANTINED"],
  ]) {
    assert.throws(
      () => runP0Backtest({
        assumptions,
        configurationHash,
        instrumentId: "ETF-1",
        lookbackSessions: "1",
        sessions: [
          session("2026-01-28", "100.0000000000", "100.0000000000", "100.0000000000"),
          { ...session("2026-01-29", "101.0000000000", "101.0000000000", "101.0000000000"), qualityState },
        ],
      }),
      (error) => error instanceof AnalyticsError && error.code === code,
    );
  }
});

test("P0 rejects impossible, mismatched, or non-chronological session times", () => {
  const validSessions = [
    session("2026-01-28", "100.0000000000", "100.0000000000", "100.0000000000"),
    session("2026-01-29", "101.0000000000", "101.0000000000", "101.0000000000"),
  ];
  for (const sessions of [
    [{ ...validSessions[0], tradingDate: "2026-02-30" }, validSessions[1]],
    [validSessions[0], { ...validSessions[1], effectiveAt: "2026-01-30T14:30:00.000Z" }],
    [
      { ...validSessions[0], effectiveAt: "2026-01-28T15:30:00.000Z" },
      { ...validSessions[1], effectiveAt: "2026-01-29T14:30:00.000Z" },
    ].reverse(),
  ]) {
    assert.throws(
      () => runP0Backtest({
        assumptions,
        configurationHash,
        instrumentId: "ETF-1",
        lookbackSessions: "1",
        sessions,
      }),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INPUT_INCOMPLETE",
    );
  }
});

test("P0 bounds session collections, identifiers, and lookback text", () => {
  const validSessions = [
    session("2026-01-28", "100.0000000000", "100.0000000000", "100.0000000000"),
    session("2026-01-29", "101.0000000000", "101.0000000000", "101.0000000000"),
  ];
  for (const request of [
    { instrumentId: "I".repeat(4_097), lookbackSessions: "1", sessions: validSessions },
    { instrumentId: "ETF-1", lookbackSessions: "1".repeat(29), sessions: validSessions },
    { instrumentId: "ETF-1", lookbackSessions: "1", sessions: Array(10_001).fill(validSessions[0]) },
  ]) {
    assert.throws(
      () => runP0Backtest({ assumptions, configurationHash, ...request }),
      (error) => error instanceof AnalyticsError && error.code === "ANALYTICS_INPUT_INCOMPLETE",
    );
  }
});
