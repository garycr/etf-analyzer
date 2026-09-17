# WP-5 Deterministic Analytics Implementation Plan

**Date:** 2026-09-17
**Status:** Closed and approved by DEC-041; publication tracked through GitHub issues #77/#78
**Estimate:** XXL risk label / 32 agent-hours

## Ownership

- `src/Domain/Analytics/analytics.ts` owns canonical fixed-point values, point-in-time selection, closed evidence records, and canonical hashes.
- `src/Domain/Analytics/p0-rule.ts` owns the pure deterministic P0 relative-momentum rule and hypothetical long-only backtest. A signal compares instrument and configured benchmark lookback returns. A positive relative return produces `Buy`, a negative relative return closes an existing hypothetical long position, and equality produces the explicit empty `signals: []` no-signal outcome required by PT-ANA-010. Any hypothetical fill occurs only at the next session open and applies the configured cost and slippage assumptions. No short position is permitted.
- Application orchestration may invoke the Domain and the existing persistence port but does not own analytics formulas, HTTP behavior, or SQL transactions.
- PostgreSQL `etf.evidence_commit(jsonb)` and `etf.evidence_read(text)` remain the sole owners of atomic bundle/manifest/retention/publication persistence, replay, publication versioning, and ordered readback.

The pure synchronous in-process design does not accept the Proposed analytics-worker diagram as an active architecture. No worker, queue, scheduler, event, provider, broker, or public ingress is introduced.

## Test-First Sequence

1. Golden and integrity core: CT-ANA-001, 002, 003, 003A, 005, 018 in `tests/Unit/analytics.test.mjs`.
2. P0 rule/backtest: deterministic two-run output, benchmark comparison, cost/slippage, next-session-open timing, no-signal, and bad-input blocking in `tests/Unit/p0-rule.test.mjs`.
3. Evidence service: operations inventory, deny-first/audit failure, rights degradation, integrity quarantine, idempotency, publication version, and atomic commit in `tests/Unit/analytics-evidence-service.test.mjs`.
4. PostgreSQL composition: existing `tests/Integration/analytics-evidence-migration.test.mjs` plus a WP-5 golden cross-runtime scenario.
5. Aggregate build, lint, complete test suite, audit, code/security/architecture review, and immutable WP-5 exit evidence.

## Prototype Allocation

| Allocation | Concrete path |
| --- | --- |
| PT-ANA-001-GOLDEN, 002, 003A, 005, 018 | `tests/Unit/analytics.test.mjs` |
| PT-ANA-006-MISSING-INPUT, 010-NO-SIGNAL | `tests/Unit/p0-rule.test.mjs` |
| PT-ANA-008-QUARANTINE, 009-ATOMIC-COMMIT, 013-DENY-FIRST, 014-REPLAY, 019-DENIAL-AUDIT | `tests/Unit/analytics-evidence-service.test.mjs` |
| PT-ANA-SCOPE-OPERATIONS, 004, PROVIDER, LIFECYCLE, RUNTIME, WRITER, ECONOMIC | `tests/Unit/analytics-scope.test.mjs` |
| TypeScript/PostgreSQL golden composition | `tests/Integration/analytics-evidence-migration.test.mjs` |
| PT-ANA-A11Y-001 | Deferred to WP-7 browser implementation and Ring 3 accessibility evidence |

## Boundaries

WP-5 does not authorize WP-6, paper orders, live providers, brokerage, public ingress, durable events, queues, schedulers, workers, baseline activation, release, deployment, or production use. The full post-prototype CT-ANA and CT-RET debt remains open unless a prototype entry guard activates it.
