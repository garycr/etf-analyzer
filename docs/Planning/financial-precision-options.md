# Financial Precision and Rounding Options

**Ring:** Ring 1 - Plan/WBS/Estimate
**Issues:** GitHub #9 and #20
**Status:** Option A selected by Workspace Owner in DEC-014; ledger contract elaboration pending
**Date:** 2026-09-10

## Decision to Make

Select one canonical PostgreSQL precision/scale and rounding policy for the hypothetical portfolio ledger. The selection must support immutable transactions, reversing corrections, deterministic FIFO, and exact reconciliation of cash, lots, positions, realized P&L, valuations, and cached projections.

This artifact does not accept an ADR, authorize implementation, freeze baseline `v1.0.0`, or close #9/#20.

## Authority and Source Limits

The Objective PDF requires bounded PostgreSQL numeric semantics and zero unexplained accounting difference within configured decimal precision. DEC-006 rejects fully configurable financial precision and requires canonical per-field precision/scale, one documented rounding mode, and reconciliation vectors. Neither source specifies exact numeric values or a rounding mode; those values below are engineering options, not extracted Objective requirements.

## Fixed Invariants

All options must satisfy these rules:

1. PostgreSQL `NUMERIC(p,s)` is authoritative for persisted financial values; binary floating point is prohibited in ledger, lot, cash, P&L, and reconciliation calculations.
2. TypeScript and Python implementations must use decimal arithmetic and serialize canonical decimal strings across REST/events. Number/float conversion at financial boundaries is prohibited.
3. One rounding mode applies at every declared quantization boundary. Multiplication and summation use exact signed integer coefficients; division uses the deterministic quotient/remainder rule below and is never delegated to a runtime default.
4. Immutable transactions are never updated or deleted. Corrections append a reversing transaction that references the original and negates its canonical financial effects.
5. FIFO consumes the oldest open acquisition lot by `(effectiveAt, ledgerSequence, lotId)`; ties cannot depend on database row order.
6. Reconciliation compares canonical persisted values for exact equality after declared quantization. A non-zero difference is a failure; no epsilon or unexplained tolerance is allowed.
7. Derived values record source transaction/lot identities, policy version, and rounding boundary so rebuilds are reproducible.
8. Overflow, excess-scale input, non-finite values, and implicit coercion fail before persistence; they are never silently truncated.
9. Cash, lot quantity, position quantity, cost basis, proceeds, realized P&L, valuation, and cached projections must all rebuild from the immutable ledger.

## Supported Workload Bounds

These coupled bounds are policy inputs for all three options. They make formula capacity testable without claiming that column capacity alone proves arithmetic safety.

| Bound | Supported maximum |
| --- | --- |
| Absolute order/fill/lot/position quantity | `1,000,000,000` units before fractional scale |
| Absolute unit price or unit cost | `1,000,000` monetary units before fractional scale |
| Absolute gross value of one fill (`quantity × price`) | `1,000,000,000,000,000` monetary units |
| Absolute fee on one transaction | `1,000,000,000` monetary units |
| Absolute persisted cash, cost basis, proceeds, realized P&L, valuation, or cached monetary aggregate | `9,000,000,000,000,000` monetary units |
| Open lots per position | `1,000,000`; aggregate bounds still apply after every operation |

An operation fails before persistence if either an input bound or a coupled result/accumulator bound would be exceeded. With the maximum quantity and price, the exact pre-quantized product is `1,000,000,000,000,000` and requires 16 integer digits plus up to the sum of operand fractional scales. Every option's monetary column supports at least 16 integer digits, so the supported product and aggregate bounds fit after the declared monetary quantization even though arbitrary column maxima multiplied together would not fit a monetary target.

For `NUMERIC(p,s)`, integer capacity is `p-s`, the canonical ULP is $10^{-s}$, and the maximum absolute representable value is $10^{p-s}-10^{-s}$. The supported workload bounds are intentionally lower than or equal to these column limits and are checked independently.

## Canonical Arithmetic Pipeline

1. Accept external financial input only as a base-10 string matching `-?(0|[1-9][0-9]*)(\.[0-9]+)?`; reject exponent notation, a leading plus, whitespace, non-finite tokens, and fractional digits beyond the destination field scale. External inputs are never rounded into compliance.
2. Convert the validated value into a signed arbitrary-precision integer coefficient and declared field scale. TypeScript uses native `BigInt`; Python uses native `int`. Binary floating point and runtime decimal defaults are not involved.
3. Normalize negative zero to positive zero. Canonical output uses `-?(0|[1-9][0-9]*)\.[0-9]{s}` with exactly the field scale, no exponent, no leading plus, and retained trailing zeros.
4. Add/subtract by aligning integer coefficients to the declared working scale. Multiply integer coefficients exactly; the product scale is the sum of operand scales.
5. Quantize higher-scale **derived intermediate results** only at a declared persistence boundary. Divide the absolute coefficient by the scale divisor to obtain quotient and remainder; compare `2 × remainder` with the divisor. On a tie, apply the option's selected rule, then restore the sign. This algorithm is identical in TypeScript and Python. Higher-scale values used in quantizer unit vectors are internal arithmetic inputs, not accepted external field values.
6. FIFO proportional basis allocation computes `originalCanonicalBasis × consumedQuantity / originalQuantity` using integer coefficients. Apply the selected quotient/remainder rule to non-final consumption. Assign the exact unallocated canonical-basis residual to the final consumption so allocated basis always sums exactly to the original stored basis.
7. Sum persisted canonical monetary coefficients using arbitrary-precision integers and check the aggregate bound after each operation. Operation and insertion/batch order cannot change the result.
8. A reversal negates the original transaction's **stored canonical coefficients under its recorded policy version**. It never recomputes historical effects under a later scale, context, or policy.

PostgreSQL is a storage validator, not a second quantizer. Application/event ingress validates and canonicalizes external strings before binding. Internal derived results are quantized by the canonical coefficient algorithm before binding. Migration/direct-load paths stage source values as text, run the same grammar, scale, bound, and canonicalization checks, and only then cast to `NUMERIC(p,s)`. Ledger tables deny uncontrolled direct writes; controlled write paths verify that database fixed-point text exactly matches the supplied canonical string. PostgreSQL can round during a direct cast, so coercion of an unvalidated excess-scale value is explicitly not an allowed write path.

## Assumptions Requiring Invalidation Review

- The Objective does not require multi-currency accounting, FX conversion, tax lots, leverage, margin, or shorting.
- Fractional ETF quantities are not explicitly required or prohibited. Options A and B preserve fractional capacity without claiming it as scope.
- A future multi-currency or external-execution requirement is a breaking scope change and requires a new policy/version.

## Option A - Field-Specific Balanced Precision (Recommended)

**Rounding mode:** IEEE 754 `roundTiesToEven` / decimal `ROUND_HALF_EVEN`.

| Semantic field class | PostgreSQL type | Quantization boundary |
| --- | --- | --- |
| Order/fill/lot/position quantity | `NUMERIC(28,10)` | Validate and quantize when a fill is accepted into the ledger |
| Unit price, unit cost, NAV | `NUMERIC(28,10)` | Validate and quantize at accepted market/fill evidence boundary |
| Cash, fees, cost basis, proceeds, realized P&L, valuation, cached monetary projection | `NUMERIC(28,8)` | Quantize once when the ledger-derived monetary result is persisted |
| Rates, returns, ratios, allocation weights | `NUMERIC(28,12)` | Quantize at persisted analytics/valuation output boundary |

**Advantages**

- Field semantics are visible in schema constraints and contracts.
- Ten quantity/price decimals and eight money decimals preserve ample research precision without an unbounded numeric model.
- Half-even minimizes aggregate directional tie bias in repeated hypothetical accounting.
- Expected lower storage and arithmetic cost than a uniform high-scale policy; benchmark evidence remains a Ring 2 obligation.

**Trade-offs**

- Cross-field formulas require explicit target-field quantization.
- Schema and test matrices contain several numeric classes.
- `NUMERIC(28,8)` money fields support 20 integer digits; the lower common workload bound remains deliberate and independently enforced.

**Invalidation:** The prototype requires more than ten fractional quantity/price digits, more than eight persisted money decimals, exceeds the supported coupled bounds, or requires a non-half-even domain rule.

## Option B - Uniform High Precision

**Rounding mode:** IEEE 754 `roundTiesToEven` / decimal `ROUND_HALF_EVEN`.

| Semantic field class | PostgreSQL type | Quantization boundary |
| --- | --- | --- |
| All financial quantities, prices, money, rates, ratios, and derived values | `NUMERIC(38,18)` | Quantize at accepted input and persisted derived-result boundaries |

**Advantages**

- One database type simplifies cross-language schema generation.
- Very high fractional capacity minimizes early loss in compound calculations.
- Half-even retains neutral tie handling.

**Trade-offs**

- A single scale obscures semantic differences between quantity, money, and ratios.
- Expected larger indexes, rows, payloads, and decimal arithmetic than Option A; this relative cost is unmeasured until Ring 2 benchmarking.
- Twenty integer digits remain, equal to Option A money fields; fractional capacity increases while declared maximum monetary magnitude does not.
- Display and export layers still need field-specific formatting rules.

**Invalidation:** Storage/arithmetic cost is material, semantic typing is required in schema, or downstream tools cannot preserve 18 decimal places reliably.

## Option C - Currency-Centric Compact Precision

**Rounding mode:** Decimal `ROUND_HALF_UP`.

| Semantic field class | PostgreSQL type | Quantization boundary |
| --- | --- | --- |
| Order/fill/lot/position quantity | `NUMERIC(20,8)` | Accepted fill boundary |
| Unit price, unit cost, NAV | `NUMERIC(20,8)` | Accepted evidence boundary |
| Cash, fees, cost basis, proceeds, realized P&L, valuation, cached monetary projection | `NUMERIC(20,4)` | Persisted monetary-result boundary |
| Rates, returns, ratios, allocation weights | `NUMERIC(20,10)` | Persisted analytics/valuation output boundary |

**Advantages**

- Compact schema and familiar financial half-up tie behavior.
- Four money decimals exceed ordinary currency minor-unit display needs.
- Simpler exports for conventional portfolio statements.

**Trade-offs**

- Greater cumulative directional tie bias than half-even.
- Four money decimals can discard research precision in repeated fractional allocation and valuation.
- Sixteen money integer digits provide less column headroom than Options A/B while still covering the common aggregate bound.
- The Objective does not require currency-minor-unit accounting, so compactness is an engineering preference rather than a source mandate.

**Invalidation:** Rebuild vectors show rounding drift, fractional research values need more than four money decimals, or neutral aggregate tie handling is preferred.

## Comparison

| Criterion | Option A | Option B | Option C |
| --- | --- | --- | --- |
| Deterministic exact rebuild | Strong | Strong | Strong |
| Retained numerical fidelity | Strong | Strongest | Moderate |
| Semantic schema clarity | Strong | Weak | Strong |
| Aggregate tie-bias control | Strong | Strong | Moderate |
| Estimated storage/arithmetic efficiency | Strong | Moderate | Strongest |
| Fractional research headroom | Strong | Strongest | Moderate |
| Cross-language implementation complexity | Moderate | Lowest | Moderate |
| Recommended | **Yes** | No | No |

## Required Reconciliation and Reversal Evidence

Whichever option is selected must produce at least these pre-implementation vectors:

| Test ID | Required proof |
| --- | --- |
| CT-LED-001 | Rebuild cash, lots, positions, realized P&L, valuations, and cached projections from immutable transactions with exact canonical equality |
| CT-LED-002 | Full reversal negates the original canonical effects without changing or deleting the original transaction |
| CT-LED-003 | Partial-lot FIFO consumes oldest lots deterministically and preserves the remaining lot quantity/cost basis |
| CT-LED-004 | A sell spanning multiple lots computes deterministic realized P&L from consumed FIFO basis |
| CT-LED-005 | Half-tie inputs prove the selected rounding mode at every field-class boundary |
| CT-LED-006 | Repeated rebuilds and cross-language TypeScript/Python vectors produce identical canonical decimal strings |
| CT-LED-007 | Excess scale, overflow, non-finite, binary-float, and silent-truncation attempts fail closed |
| CT-LED-008 | Cached projection corruption is detected because the ledger rebuild remains authoritative |
| CT-LED-009 | Equal-timestamp lots use `(effectiveAt, ledgerSequence, lotId)` deterministically |
| CT-LED-010 | Reversal of a previously consumed lot preserves audit lineage and yields the expected rebuilt open-lot state |

## Pre-Selection Comparison Vectors

These vectors let the Workspace Owner compare candidate behavior before selection. Tie, ULP-neighbor, and negative-zero rows are **internal quantizer unit inputs** produced by higher-scale arithmetic, not external field ingress. Values are canonicalized with each option's policy; they are specification examples, not executed evidence.

| Case | Option A expected | Option B expected | Option C expected |
| --- | --- | --- | --- |
| Positive money half tie | `1.000000005 → 1.00000000`; `1.000000015 → 1.00000002` | `1.0000000000000000005 → 1.000000000000000000`; `1.0000000000000000015 → 1.000000000000000002` | `1.00005 → 1.0001`; `1.00015 → 1.0002` |
| Negative money half tie | `-1.000000005 → -1.00000000`; `-1.000000015 → -1.00000002` | `-1.0000000000000000005 → -1.000000000000000000`; `-1.0000000000000000015 → -1.000000000000000002` | `-1.00005 → -1.0001`; `-1.00015 → -1.0002` |
| Money ULP around tie | `1.0000000049 → 1.00000000`; `1.0000000051 → 1.00000001` | `1.00000000000000000049 → 1.000000000000000000`; `1.00000000000000000051 → 1.000000000000000001` | `1.000049 → 1.0000`; `1.000051 → 1.0001` |
| Quantity half tie | `1.00000000005 → 1.0000000000` | `1.0000000000000000005 → 1.000000000000000000` | `1.000000005 → 1.00000001` |
| Rate half tie | `0.0000000000005 → 0.000000000000` | `0.0000000000000000005 → 0.000000000000000000` | `0.00000000005 → 0.0000000001` |
| Negative zero | `-0.000000004 → 0.00000000` | `-0.0000000000000000004 → 0.000000000000000000` | `-0.00004 → 0.0000` |
| Common maximum aggregate | `9000000000000000.00000000` | `9000000000000000.000000000000000000` | `9000000000000000.0000` |
| Common policy-bound exceedance by one money ULP | Reject `9000000000000000.00000001` | Reject `9000000000000000.000000000000000001` | Reject `9000000000000000.0001` |
| Excess money scale at ingress | Reject 9th fractional digit | Reject 19th fractional digit | Reject 5th fractional digit |
| Column maximum valid money | `99999999999999999999.99999999` | `99999999999999999999.999999999999999999` | `9999999999999999.9999` |
| Column overflow by one money ULP | Reject `100000000000000000000.00000000` | Reject `100000000000000000000.000000000000000000` | Reject `10000000000000000.0000` |

The post-selection ledger contract must add concrete multi-lot FIFO, partial-basis residual, full/partial reversal, equal-timestamp ordering, batch-order independence, and cross-language/database vectors using the selected canonical scale. For selection, one common proportional-allocation example demonstrates the algorithm independent of scale: basis `10.00` allocated over quantity `3`, with three unit consumptions, yields first `3.33`, second `3.33`, and final residual `3.34`; reversing any stored allocation negates that stored canonical amount rather than recomputing `10/3`.

## Recommendation

Select **Option A**. It makes domain semantics explicit, provides substantial fractional and magnitude headroom for a local research prototype, uses neutral half-even tie handling, and keeps exact reconciliation understandable. Option B is defensible when uniform cross-language schemas outweigh storage and semantic clarity. Option C is not preferred because compact money scale and half-up rounding create avoidable cumulative bias without an Objective requirement for currency-style rounding.

## Human Decision

**Review:** REV-010 APPROVED with no remaining findings.
**Selected:** Option A - Field-Specific Balanced Precision.
**Authority:** Workspace Owner.
**Disposition date:** 2026-09-10.
**Decision:** DEC-014.
**Boundary:** Policy values and rounding semantics are accepted for #9/#20 elaboration. No ADR is accepted, baseline `v1.0.0` is not frozen, and implementation or parallel execution is not authorized.

Available dispositions:

- Select Option A - Field-Specific Balanced Precision.
- Select Option B - Uniform High Precision.
- Select Option C - Currency-Centric Compact Precision.
- Request revised values or assumptions.
- Stop with #9/#20 blocked.
