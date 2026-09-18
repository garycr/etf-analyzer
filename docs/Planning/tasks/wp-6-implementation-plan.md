# WP-6 Paper Order and Ledger Implementation Plan

**Date:** 2026-09-17
**Status:** Complete under DEC-058 and REV-134 PASS; CT-LED-019 deferred by DEC-057 to nonblocking GitHub issue #82
**Estimate:** XXL risk label / 32 agent-hours

## Ownership

- `src/Domain/Orders/` owns the closed eight-state model, OT-01 through OT-10 command validation, canonical field-set and ordering semantics, transition guards, and pure result/rebuild verification. Infrastructure serialization supplies the exact RFC 8785 UTF-8 text through the Application boundary, retaining DEC-040's accepted layering exception until shared-kernel cleanup.
- `src/Application/paper-order-service.ts` owns trusted identity and authorization orchestration over primitive identifiers and bounded JSON text. It does not own aggregate state, transaction boundaries, FIFO allocation, or projections.
- Existing PostgreSQL `paper_order_transition`, `ledger_append`, `projection_publish`, `audit_append`, and `anchor_append` remain the sole atomic owners of order/fill/ledger mutation, idempotency, versions, FIFO allocation, reversal lineage, audit, commitments, anchors, and projection publication.
- Domain rebuild verification is diagnostic and cross-runtime test logic only. It never gates or performs projection publication and is not a second source of truth.
- The implementation remains synchronous and local. No worker, queue, scheduler, provider, broker, public ingress, or durable event handoff is activated.

## First Discriminating Slice

Hypothesis: a Domain-canonicalized OT command can pass unchanged through Application and the existing PostgreSQL owner, producing the exact authoritative result without a second state machine.

1. Add a failing golden unit test for closed OT-01 command bytes and transition metadata.
2. Implement only bounded OT command canonicalization and exact state/trigger lookup.
3. Add a PostgreSQL-gated OT-01 -> OT-02 -> OT-03 -> OT-06 composition test through the Application service.
4. Reject any mismatch between requested order identity and canonical payload before authorization or persistence.

## Test-First Sequence

1. Order core: all eight states, OT-01..OT-10, 62 invalid source/target complements, terminal states, confirmation, chronology, versions, idempotency content, and bounded primitive admission.
2. Numeric/canonical ledger core: DEC-014 quantity/money/rate classes, golden transaction/effect hash, half-even/residual vectors, stable precedence, and cross-runtime bytes.
3. PostgreSQL composition: draft, confirmation, validation, partial/complete fills, cancellation, expiry, atomic rollback, replay, version races, FIFO, reversal dependencies, and no-short/no-overspend guards.
4. Rebuild/reconciliation: CT-LED-001..018 exact cash/lot/position/allocation/P&L/valuation sets, cache corruption, fetch/batch ordering, commitments, anchors, and blocked publication; CT-LED-019 is deferred by DEC-057.
5. Aggregate zero-skip PostgreSQL suite, lint, audit, diagnostics, immutable evidence, and independent code/security/architecture/plan review.

## Exact Test Traceability

Each row names the test before implementation. A renamed or split test must update this table in the same change.

| Transition | Exact test title | Path |
| --- | --- | --- |
| OT-01 | `OT-01 creates only a Draft from explicit research evidence` | `tests/Unit/paper-order.test.mjs` |
| OT-02 | `OT-02 submits only after same-user confirmation` | `tests/Unit/paper-order.test.mjs` |
| OT-03 | `OT-03 accepts a Submitted order without a fill` | `tests/Unit/paper-order.test.mjs` |
| OT-04 | `OT-04 rejects a Submitted order without ledger mutation` | `tests/Unit/paper-order.test.mjs` |
| OT-05 | `OT-05 atomically partially fills an Accepted order` | `tests/Integration/domain-ledger-migration.test.mjs` |
| OT-06 | `OT-06 atomically fills an Accepted order` | `tests/Integration/domain-ledger-migration.test.mjs` |
| OT-07 | `OT-07 cancels an unfilled Accepted order` | `tests/Integration/domain-ledger-migration.test.mjs` |
| OT-08 | `OT-08 expires an unfilled Accepted order` | `tests/Integration/domain-ledger-migration.test.mjs` |
| OT-09 | `OT-09 atomically fills the remaining Partial quantity` | `tests/Integration/domain-ledger-migration.test.mjs` |
| OT-10 | `OT-10 cancels only the remaining Partial quantity` | `tests/Integration/domain-ledger-migration.test.mjs` |

| Acceptance ID | Exact test title | Path |
| --- | --- | --- |
| CT-ORD-001 | `CT-ORD-001 displayed signals never create orders or ledger effects` | `tests/Unit/paper-order-scope.test.mjs` |
| CT-ORD-002 | `CT-ORD-002 unconfirmed drafts remain Draft without mutation` | `tests/Unit/paper-order.test.mjs` |
| CT-ORD-003 | `CT-ORD-003 confirmed drafts become Submitted with evidence only` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-ORD-004 | `CT-ORD-004 Submitted validation chooses exactly OT-03 or OT-04` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-ORD-005 | `CT-ORD-005 Accepted supports exactly OT-05 through OT-08` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-ORD-006 | `CT-ORD-006 Partial preserves prior fills through OT-09 or OT-10` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-ORD-007 | `CT-ORD-007 rejects all 62 transition complements atomically` | `tests/Unit/paper-order.test.mjs` |
| CT-ORD-008 | `CT-ORD-008 terminal states reject every transition atomically` | `tests/Unit/paper-order.test.mjs` |
| CT-ORD-009 | `CT-ORD-009 equivalent replay is stable and conflicting replay fails` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-ORD-010 | `CT-ORD-010 Partial serializes with the Partially Filled label` | `tests/Unit/paper-order.test.mjs` |
| CT-ORD-011 | `CT-ORD-011 paper-order runtime contains no brokerage path` | `tests/Unit/paper-order-scope.test.mjs` |
| CT-ORD-012 | `CT-ORD-012 stale order versions roll back every mutation surface` | `tests/Integration/domain-ledger-migration.test.mjs` |

| Acceptance ID | Exact test title | Path |
| --- | --- | --- |
| CT-LED-001 | `CT-LED-001 rebuilds buy partial sell and valuation exactly` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-002 | `CT-LED-002 reverses an unconsumed buy immutably` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-003 | `CT-LED-003 consumes a partial lot FIFO` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-004 | `CT-LED-004 spans FIFO lots with exact realized PnL` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-005 | `CT-LED-005 applies half-even and final residual allocation` | `tests/Unit/ledger.test.mjs` |
| CT-LED-006 | `CT-LED-006 produces identical TypeScript and PostgreSQL canonical strings` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-007 | `CT-LED-007 rejects invalid scale grammar and bounds before persistence` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-008 | `CT-LED-008 detects every keyed cache corruption without repair` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-009 | `CT-LED-009 orders equal-timestamp lots by ledger sequence independent of fetch order` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-010 | `CT-LED-010 enforces reversal dependencies and exact stored restoration` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-011 | `CT-LED-011 serializes races replay and rollback atomically` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-012 | `CT-LED-012 enforces bounds permissions precedence and golden hashes` | `tests/Integration/controlled-access-migration.test.mjs` |
| CT-LED-013 | `CT-LED-013 records the complete immutable audit outcome lifecycle` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-014 | `CT-LED-014 commits or rolls back ledger and dual chains together` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-015 | `CT-LED-015 denies controlled-procedure bypass with correlated audit` | `tests/Integration/controlled-access-migration.test.mjs` |
| CT-LED-016 | `CT-LED-016 publishes a verified projection and audit atomically` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-017 | `CT-LED-017 blocks publication on integrity failure without replacing cache` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-018 | `CT-LED-018 appends timeout and recovery outcomes for unresolved intent` | `tests/Integration/domain-ledger-migration.test.mjs` |
| CT-LED-019 | Deferred operational hardening under DEC-057; not a WP-6 acceptance vector | GitHub #82 |

## Boundaries

WP-6 does not authorize WP-7, browser implementation, brokerage, real execution, external accounts, live providers, public ingress, callbacks, webhooks, durable events, queues, schedulers, workers, baseline activation, release, deployment, or production use. PostgreSQL migration bytes change only if executable evidence proves an owning persistence defect that cannot be repaired at the Domain/Application boundary.
