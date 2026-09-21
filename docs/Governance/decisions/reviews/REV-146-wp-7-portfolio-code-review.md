# REV-146 - WP-7 Portfolio Presentation Code Review

**Date:** 2026-09-21
**Reviewer:** Code Reviewer agent (Claude Sonnet 5)
**Scope:** PT-UI-007 implementation, tests, and Application portfolio contract correction
**Disposition:** PASS

## Findings And Resolution

The initial review found one Critical and one Major contract defect outside the renderer but exposed by PT-UI-007.

1. The Application portfolio validator used a non-negative scale-8 predicate even though the normative OpenAPI `Money` contract is signed. This rejected valid realized and unrealized losses. A dedicated signed scale-8 predicate now validates all portfolio Money fields, while order fees retain their non-negative predicate.
2. Portfolio projections admitted duplicate lot IDs and duplicate position instrument IDs. The authoritative validator now rejects both identity collisions.

Focused tests first reproduced the signed-Money rejection and duplicate admission. The corrections then passed boundary and end-to-end workbench validation. The follow-up review closed both findings and returned PASS with no open Critical or Major findings.

## Correctness

- `PortfolioGet` remains the authoritative projection boundary; no API operation was added.
- Signed scale-8 Money and scale-10 quantities remain exact strings with no numeric conversion.
- Lots retain owner ordering by acquired time, ledger sequence, and lot ID; positions retain code-point instrument ordering.
- Reconciled values, empty collections, and negative P&L render explicitly.
- `IntegrityBlocked` projections expose only the reviewed alert/recovery presentation; zero placeholders and collections are not rendered.
- Query failures and malformed projections fail closed with bounded `Portfolio` degradation telemetry.

## Test Quality

Tests cover signed acceptance for every portfolio Money field, malformed values for every shared predicate use, duplicate lot/position identities, positive and negative browser values, both owner ordering rules, unselected and empty states, integrity blocking, query failure, malformed success data, escaping, and disclaimer exclusion. Follow-up weighted test quality was 4.74/5 (Excellent); all review test-specificity notes were subsequently closed.

## Residual Boundary

PT-UI-009 retains real viewport, overflow, and axe automation. PostgreSQL environment skips remain a WP-7 closure condition.

## FinOps

Estimated review cost was below $0.15. Exact provider token telemetry and pricing are unavailable. Runtime product AI cost is $0.
