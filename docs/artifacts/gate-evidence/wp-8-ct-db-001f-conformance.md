# WP-8 CT-DB-001F Conformance Evidence

**Date:** 2026-09-22
**Decision:** DEC-069; DEC-076
**Status:** Accepted under REV-174 and REV-175
**Scope:** CT-DB-001F only

## Atomic State, Replay, And History

The canonical `CT-DB-001F paper-order state replay and history are atomic` test establishes one owner-valid order through Draft, Submitted, and Accepted. The successful boundary exposes state `Accepted`, aggregate version 3, ordered transition history, one replay per command, and committed order audit evidence.

It then exercises the three required failures directly through the controlled PostgreSQL owner function:

| Failure | Exact result |
|---|---|
| Stale expected aggregate version | SQLSTATE `40001`, `ORDER_VERSION_CONFLICT` |
| Reused transition command identity with changed content | SQLSTATE `P0001`, `ORDER_IDEMPOTENCY_CONFLICT` |
| OT-05 partial-fill quantity equal to open quantity | SQLSTATE `P0001`, `ORDER_GUARD_FAILED` |

After each rejection, a deterministic full-row snapshot remains byte-identical across `paper_orders` including aggregate version, `order_transitions`, `application_replays`, `order_command_replays`, and `order_audit`. The guard failure occurs before the nested ledger append, so no fill or ledger effect can become visible.

## Validation

- Image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Environment: `16.15|UTF8|UTC|on|C`.
- Canonical CT-DB-001F parent: 1/1 PASS, zero failed, zero skipped.
- Focused owning test: 1/1 PASS, zero failed, zero skipped.
- Build, lint, `git diff --check`, and editor diagnostics: PASS.
- Temporary containers: removed and absence verified.
- Migration SQL and cumulative manifest hashes: unchanged.
- Independent Code Review: REV-174 PASS; application replay evidence strengthened to full-row comparison.
- Independent Security Review: REV-175 PASS; child failure output hardened to redact the database URL.

## Boundary

This evidence accepts CT-DB-001F only. CT-DB-001G-J, PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, and production remain open or unauthorized. Earlier accepted CT-DB-001A-E/K/L checkpoints retain their separate decisions and reviews. REV-164 and the original CT-DB-001K evidence remain invalidated history.
