# WP-7 Portfolio Presentation Evidence

**Date:** 2026-09-21
**Scope:** PT-UI-007
**Result:** PASS; WP-7 remains active

## Executable Evidence

| Check | Result |
| --- | --- |
| PT-UI-007 focused tests | 3/3 PASS, zero skipped |
| Portfolio contract plus PT-UI-007 focused set | 4/4 PASS, zero skipped |
| Application/workbench regression set | 46/46 PASS, zero skipped |
| Aggregate repository suite | 446 discovered; 391 passed; 0 failed; 55 PostgreSQL-environment skips |
| TypeScript build and lint | PASS |
| Editor diagnostics | Zero changed-file errors |
| Dependency audit | Zero vulnerabilities; no dependency added |
| Diff integrity | PASS |
| Independent code review | REV-146 PASS; prior Critical/Major findings closed |
| Independent security review | REV-147 PASS; no findings |

## Behavior

- Optional selected portfolio identity composes the existing `PortfolioGet` query without adding an API operation.
- Reconciled cash, realized P&L, total equity, positions, and lots render as exact canonical strings, including negative losses.
- Owner-defined position and lot ordering is preserved through rendering.
- Unselected and reconciled-empty portfolio states are explicit.
- A validated `IntegrityBlocked` projection renders only the reviewed alert and readiness recovery; financial values and holdings are suppressed.
- Owner query failure and malformed success projection fail closed with exact `Portfolio` degradation telemetry.
- The portfolio section is operational state and does not display the research-only analytical disclaimer.

## Contract Correction

PT-UI-007 review exposed and corrected a pre-existing Application mismatch: portfolio Money now accepts the signed OpenAPI grammar, and duplicate lot IDs or position instrument IDs fail closed. Order fees remain non-negative. Unit tests cover all signed portfolio Money fields, malformed shared-predicate values, and both duplicate identities.

## Residual Boundary

PT-UI-009 retains automated semantic, viewport, overflow, keyboard, and axe verification. The 55 PostgreSQL environment skips must reach zero before WP-7 closure.
