# WP-3 Canonical Display Evidence

**Date:** 2026-09-16
**Scope:** PT-APP-001I canonical values and timestamp/date roles
**Result:** PASS

## Executed Behavior

`presentCanonicalValue` implements the exact 12-row PT-APP-001I matrix. It preserves the canonical wire string unchanged, returns identical visible and assistive text, maps `Partial` to `Partially Filled` and `NotReady` to `Not Ready`, and emits fixed labels for UTC instant, source time, retrieval time, completion time, display timezone, and trade date.

Date, UnitPrice, Money, and Rate values remain byte-for-byte canonical strings. The presenter does not use `Date`, `Number`, `Intl`, locale grouping, symbols, percentages, rounding, abbreviation, relative time, or timezone conversion. Its closed value-class union is exhaustively handled, and the result is a frozen three-field record.

## Test-First Evidence

- Red: the focused build/test failed because `presentCanonicalValue` was not exported.
- Green: all 12 Gherkin rows produced the exact visible and accessible display values while retaining the original wire value.
- Review remediation replaced an identity default with explicit Date/UnitPrice/Money/Rate cases and a compile-time `never` exhaustiveness guard.
- Focused final build/test: 1/1 passed.
- Complete default suite: 304 discovered, 274 passed, 30 PostgreSQL environment skips, zero failed.
- TypeScript lint and changed-file diagnostics: PASS.
- Dependency audit: zero vulnerabilities.
- `git diff --check`: PASS.

## Review

Alternate-model Code review returned final PASS with no findings and scored the test 5.0/5 across all seven quality dimensions. Alternate-model Security review returned PASS with no findings and confirmed canonical-string preservation, visible/assistive parity, fixed role labels, exhaustive class handling, and the absence of parsing, HTML generation, localization, numeric conversion, hidden mutation, or injection primitives.

Runtime malformed-value grammar remains PT-APP-001M rank-20 admission. Downstream renderer semantics, non-color state, and focus/announcement behavior remain PT-APP-001L. This evidence closes only PT-APP-001I; PT-APP-001J..P remain open.
