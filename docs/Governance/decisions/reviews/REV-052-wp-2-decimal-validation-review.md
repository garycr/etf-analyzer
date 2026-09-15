# REV-052: WP-2 Decimal Validation Review

**Date:** 2026-09-15
**Reviewer:** Code Reviewer dispatch using alternate model Claude Sonnet 5
**Scope:** PT-FIX-001F application-layer exact decimal grammar, scale, and precision
**Result:** PASS for application scope; aggregate PT-FIX-001F OPEN

## Disposition

The application boundary validates decimal values entirely as strings without binary floating-point conversion or implicit rounding. It enforces canonical spelling, class-specific scales of 10 for Quantity and UnitPrice, 8 for Money, and 12 for Rate, and total precision 28. Positive zero is accepted; negative zero for every class, plus signs, exponent notation, leading zeroes, `NaN`, and infinities are rejected with `FIXTURE_DECIMAL_INVALID`.

Boundary vectors prove the exact maximum integer widths of 18 digits for Quantity and UnitPrice, 20 for Money, and 16 for Rate, including signed values and both record families. PT-FIX-001M tests now use class-valid decimal values so currency-pairing failures remain isolated.

The alternate-model review returned application PASS after negative-zero and non-finite test gaps were closed. It also confirmed an existing cross-layer Major finding: `src/Infrastructure/PostgreSQL/migrations/fixtures.ts` limits Money to 18 integer digits, an effective precision of 26 at scale 8, while DEC-014 and this contract require 20 integer digits and precision 28. Aggregate PT-FIX-001F remains open until the immutable database migration path and integration boundaries are reconciled and reviewed.

## Boundary

This review accepts only application-layer PT-FIX-001F validation in `fixture-package.ts`. It does not accept aggregate database conformance, migration changes, derived-result rounding, selected-record quality evaluation, coverage completion, complete multi-defect collection, provider egress, PT-FIX-001G, K, N, or O, complete WP-2, legacy migration, WP-3, release, deployment, or production action.
