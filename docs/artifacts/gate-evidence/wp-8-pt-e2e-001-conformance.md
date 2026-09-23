# WP-8 PT-E2E-001 Conformance Evidence

**Date:** 2026-09-23
**Decision:** DEC-081
**Status:** Accepted under REV-184 and REV-185
**Scope:** PT-E2E-001 local greenfield PostgreSQL composition only

> **Superseded identity notice (2026-09-23):** The schema-manifest table recorded below is stale. DEC-086 and `wp-8-postgresql-manifest-reconciliation.md` are the current seven-row identity authority. Behavioral history remains preserved.

## Canonical Workflow

The canonical `PT-E2E-001 completes fixture analysis confirmed paper order and reconciliation through reviewed HTTP operations` parent applies the existing seven-migration candidate to pinned PostgreSQL 16.15 and sends five exact Application envelopes through the loopback HTTP adapter: `FixtureIngestionStart`, `AnalyticsRun`, `PaperOrderDraftCreate`, `PaperOrderTransition`, and `PortfolioGet`.

Fixture and analytics dispatch use one checked-out PostgreSQL client shared with the Application replay store. Each starts its durable Job, commits its controlled domain state, and completes the Job through `etf.job_succeed(jsonb)` inside one transaction/savepoint. Portfolio reads use `etf.portfolio_get(uuid,timestamptz)` and return `portfolioVersion` as the canonical application String UInt.

The passing causal assertions prove:

- HTTP fixture identity and hash equal the approved resolver artifact and persisted package.
- The committed fixture package supplies the sole analytics input evidence identity and normalized observations.
- Analytics command identity, configuration hash, and as-of date equal the committed evidence payload.
- The committed analytics evidence UUID equals the paper order research-evidence identity.
- Paper submission changes only the order aggregate; the final portfolio equals the explicitly pre-seeded reconciled projection.

## Rollback And Replay Controls

Three injected failure points pass: after Job start, after domain mutation, and during Job completion. Each owner failure rolls back Job creation, domain mutation, and owner replay state before the complete failed Application envelope is persisted. No orphaned Pending Job or partial owner effect remains.

Equivalent replay returns the original failure without owner redispatch. A changed replay returns `APPLICATION_IDEMPOTENCY_CONFLICT`, performs no owner dispatch, and leaves database state unchanged. Trusted-artifact identity/hash mismatch is rejected before SQL mutation.

## Candidate.3 Reconciliation

| Sequence | SQL SHA-256 | Schema-manifest SHA-256 |
| ---: | --- | --- |
| 1 | `a604802a67bed66c6ce79d2f2f856b48e184ae5b4f76803ab8ead3a135c85291` | `f488702c6e34dac01152ddc3f94f3856bf64156dfba3f1e0a81811db1052e0d6` |
| 2 | `6ad48f730617fadff8ae80d58171c84707d9159af8f0186e71538861d92d730a` | `c043fad160e0b6690971b6cc4e9ffc8d10ca74a879a43360f86872c1f8eaf8c1` |
| 3 | `c5da21109969595e17dfb7b31e5c45296324b6d20caf1f1debdb1a70ea84a496` | `50fb07d7aeb7a51f8b985c6c53f8c1a2ef5707220032355bcd62769856076f13` |
| 4 | `9bf81885aab5fafe8bcac9b372d7bbd0bec601fc29e0cdbc234a65fc3d5489f1` | `b19029387e1aae294efc28e8985573bf0bff9872ff05968228a0a70452915cf7` |
| 5 | `2a848c629d66a7e3e2621ea065f684a94fc82acb9b7e85477a228c30c8ed8001` | `9cec7c53e45b418d389abe4a8f85ad8a1e7930e253e7ac9580a1e15b3bb87e64` |
| 6 | `d8ad459296b049ce681a216573159b09d3f95be9297af727f1335b6da75c738a` | `9ec929080517cdf491139537eb9501d701b6c973c77ff8473c2bd2cee548b3d0` |
| 7 | `0d07358c3056885e15ba190681402a381ed71485beb35e3b9088cc8d107b1340` | `e6791ce150824592fcfb288c05c11342c61dfeb9f7bb3dda72e1a3a85930ee38` |

Candidate version remains `1.0.0-candidate.3`; no eighth migration or candidate.4 exists. Sequences 2 and 6 were re-baselined in place for the inactive empty-database-only prototype, and unchanged downstream SQL inherits the new cumulative roots.

## Validation

- PostgreSQL image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- API adapter tests: 14 passed.
- Focused workflow/migration units: 20 passed.
- Focused PostgreSQL migration checks: 3 passed.
- Canonical PT-E2E-001 success, fault, and replay parent: passed.
- Corrected sequence-3 and CT-DB-001A checks: passed.
- Complete seven-row migration readiness probe: passed.
- Build, lint, editor diagnostics, and diff checks: passed.
- Independent Code Review: REV-184 PASS.
- Independent Security Review: REV-185 PASS with one non-blocking pre-existing hardening advisory.

The host-wide suite was also observed under Node 24 even though the package requires Node `>=20 <21`; its remaining wrapper failures enforce the Node 20 runtime gate and are not treated as Node 20 conformance evidence.

## Boundary

This evidence accepts PT-E2E-001 only. It does not close WP-8, DP-33, Ring 2, release, deployment, or production. REV-164 and the original CT-DB-001K evidence remain invalidated history. Greenfield PostgreSQL remains the only persistence target; no SQL Server migration, conversion, ETL, coexistence, cutover, or rollback effort is authorized.
