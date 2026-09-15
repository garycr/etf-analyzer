# WP-2 Decimal Validation Evidence

**Date:** 2026-09-15
**Scope:** PT-FIX-001F application-layer exact decimal grammar, scale, and precision
**Result:** PASS for application scope; aggregate PT-FIX-001F OPEN

## Executed Behavior

The fixture package validator parses no financial value into a JavaScript number. It validates canonical decimal strings by sign, integer coefficient, fractional coefficient, exact class scale, and total precision. Quantity and UnitPrice accept at most 18 integer digits at scale 10, Money accepts 20 at scale 8, and Rate accepts 16 at scale 12.

The executable vectors cover exact contract examples, positive and negative maximum coefficients, one-digit overflow for each distinct scale, excess and insufficient scale, exponent and leading-zero spellings, plus signs, positive zero, all class-specific negative-zero forms, `NaN`, and positive and negative infinity. The same rules apply to market observations and economic vintages.

## Validation

- Focused fixture package tests: 147/147 passed.
- Complete repository suite: 246 discovered, 217 passed, 29 environment-skipped, 0 failed.
- Build, lint, and editor diagnostics passed.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `git diff --check` passed.
- REV-052 records alternate-model Code Reviewer PASS for the application scope after final recheck.

## Open Cross-Layer Finding

The PostgreSQL fixture ingestion guard currently accepts at most 18 Money integer digits rather than the 20 required by `NUMERIC(28,8)`. No integration vector currently proves the 18/19/20-digit Money boundary. This Major cross-layer mismatch blocks aggregate PT-FIX-001F closure; it does not invalidate the bounded application result.

## Boundary

This evidence covers only application-layer exact decimal validation. It does not claim database-layer or aggregate PT-FIX-001F PASS. PT-FIX-001G, K, N, and O remain open, as do PostgreSQL Money-bound reconciliation, quality suppression, coverage, complete deterministic error ordering, persistence coordination, and provider-egress denial. This evidence does not authorize complete WP-2, legacy data migration, WP-3 overlap, release, deployment, or production action.
