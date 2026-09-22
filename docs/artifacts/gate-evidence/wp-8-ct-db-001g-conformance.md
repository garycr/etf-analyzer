# WP-8 CT-DB-001G Conformance Evidence

**Date:** 2026-09-22
**Decision:** DEC-069; DEC-077
**Status:** Accepted under REV-176 and REV-177
**Scope:** CT-DB-001G only

## Immutable Anchored Ledger

The canonical `CT-DB-001G ledger evidence is immutable anchored and projection-safe` parent executes six owning tests. Successful transactions expose ordered effects and allocations, replay identity, audit evidence, ledger commitments, protected anchors, and checkpoints atomically. Corrections append reversal records and retain immutable lineage.

As `app_runtime`, direct INSERT, UPDATE, DELETE, and TRUNCATE attempts against ledger history return SQLSTATE `42501` without changing transaction, audit, commitment, anchor, or checkpoint state. Active anchor-key replacement is rejected. Verified projection publication commits projection and audit evidence together; mismatched or unverified publication preserves the current projection and records only the allowed blocked-publication evidence.

| Failure | Exact result |
|---|---|
| Stale expected portfolio version | `LEDGER_VERSION_CONFLICT` |
| Reused transaction identity with changed content | `LEDGER_IDEMPOTENCY_CONFLICT` |
| Protected checkpoint or anchor integrity failure | `LEDGER_INTEGRITY_FAILED` |
| Sell exceeding the remaining long position | `LEDGER_INSUFFICIENT_POSITION` |

Rollback snapshots include fills, transactions, effects, lots, allocations, reversal links, replay rows, versions, audits, ledger and audit commitments, ledger anchors, audit and portfolio checkpoints, and ordered evidence hashes.

## Validation

- Image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Environment: `16.15|UTF8|UTC|on|C`.
- Canonical CT-DB-001G parent: 1/1 PASS, zero failed, zero skipped.
- Embedded owner set: 6/6 PASS, zero failed, zero skipped.
- Build and editor diagnostics: PASS.
- Temporary containers: removed and absence verified.
- Migration SQL and cumulative manifest hashes: unchanged.
- Independent Code Review: REV-176 PASS after checkpoint-snapshot remediation.
- Independent Security Review: REV-177 PASS with no findings.

## Boundary

This evidence accepts CT-DB-001G only. CT-DB-001H-J, PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, and production remain open or unauthorized. Earlier accepted CT-DB-001A-F/K/L checkpoints retain their separate decisions and reviews. REV-164 and the original CT-DB-001K evidence remain invalidated history.
