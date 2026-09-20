# WP-7 Watchlist Workflow Evidence

**Date:** 2026-09-20
**Scope:** PT-UI-004
**Result:** PASS; WP-7 remains active

## Executable Evidence

| Check | Result |
| --- | --- |
| Final focused API, client, runtime, and renderer tests | 21/21 PASS, zero skipped |
| Aggregate repository suite | 439 discovered; 384 passed; 0 failed; 55 PostgreSQL-environment skips |
| TypeScript build and lint | PASS |
| Editor diagnostics | Zero errors in changed source files |
| Dependency audit | Zero vulnerabilities; no dependency added |
| Architecture review | REV-140 PASS; no open findings |
| Security review | REV-141 PASS; no open findings |
| Code review | REV-142 PASS; no open findings |

## Behavior

- The server renders authoritative watchlist order, version, empty state, validation state, and native mutation controls.
- The external same-origin module builds only the existing WatchlistPut, WatchlistRemove, and WatchlistReorder transports.
- Every mutation uses the displayed canonical version. Success and conflict reload authoritative WatchlistGet state.
- Controls lock during mutation, errors are announced assertively, failed input is preserved, and focus returns to a logical action or the submit control.
- Server and browser projection admission reject malformed, noncanonical, and out-of-range UInt values.
- Browser failures emit only bounded `WORKBENCH_CLIENT_DEGRADED` stage/reason events and plain recovery guidance.

## Manual Browser Evidence

Add, reorder, remove, conflict reconciliation, focus restoration, and desktop/mobile overflow were exercised successfully in a real browser. This is manual evidence only.

## Residual Boundary

PT-UI-009 retains automated real-DOM event wiring, keyboard traversal, focus restoration, live-region, axe, and viewport checks after dependency review. The 55 PostgreSQL environment skips must reach zero before WP-7 closure. PT-UI-004 adds no API operation, package dependency, public ingress, deployment, or production capability.
