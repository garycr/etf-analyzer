# WP-8 CT-DB-001J Conformance Evidence

**Date:** 2026-09-22
**Decision:** DEC-069; DEC-080
**Status:** Accepted under REV-182 and REV-183
**Scope:** CT-DB-001J only

## Durable Restart And Replay

The canonical `CT-DB-001J job state and checkpoints resume without duplicate effects` parent runs under Node 20 and dispatches the exact complete owner `0002 preserves complete durable job state across CT-DB-001J restart cases`.

The owner applies the existing seven-migration greenfield PostgreSQL candidate and composes `executeApplicationRequestAsync`, `createPostgresApplicationReplayStore`, `dispatchPostgresJobRestart`, and `etf.job_restart(jsonb)`. It snapshots jobs, checkpoints, and application replay rows in deterministic order.

| Vector | Exact result |
|---|---|
| First Failed/Restartable execution | Pending attempt `2`; identity, input, counts, and attempt-1 checkpoint retained; one replay committed |
| Equivalent replay | Original complete result; zero owner dispatch; byte-identical state |
| Conflicting replay | `APPLICATION_IDEMPOTENCY_CONFLICT`; zero owner dispatch; byte-identical state |
| Running job | `APPLICATION_JOB_NOT_RESTARTABLE`; job and checkpoint unchanged |
| Failed/NotRestartable job | `APPLICATION_JOB_NOT_RESTARTABLE`; job and checkpoint unchanged |
| Forced replay-persistence failure | `APPLICATION_DEPENDENCY_UNAVAILABLE`; restart and replay roll back together |
| Retry after committed success | Original replay; zero owner dispatch; no duplicate mutation |

The controlled restart function locks the authoritative job row with `FOR UPDATE`, verifies Failed plus Restartable, increments attempt once, clears the controlling error, retains committed progress and checkpoint identity, and emits application `UInt` fields as canonical decimal strings. Migration 0006 grants its existing execute surface to `app_runtime`; PUBLIC and unrelated runtime roles remain denied, and runtime retains no direct base-table mutation authority.

## Candidate.3 Reconciliation

- Migration 0002 SQL SHA-256: `b35b95782c4a95d3a099c18c6d9ca56fef218a1520141a00dff35cd31e4d9517`.
- Sequence 2 schema-manifest SHA-256: `ba4819034068cad674d3162e0a452705cffe5501a1d7aa683e925e560b7aa923`.
- Sequence 3 schema-manifest SHA-256: `3fe63f5584de3f9dc89854dfc382fb3fb4000a3e5699f4a70f6098d6d30be405`.
- Sequence 4 schema-manifest SHA-256: `015b7675f28779624b7c1f78ac86f3aac32e2fde55cb0eb19f299cad9fa65bd7`.
- Sequence 5 schema-manifest SHA-256: `7991cbb3cc00a28ad5b5649d512fb7706866a83fc2f97fe0d9301c3e61cae893`.
- Migration 0006 SQL SHA-256: `59321556e86f58e9bd0c62cb17c7be9fe68b2ca8b81be12311295d8692343e09`.
- Sequence 6 schema-manifest SHA-256: `dba51d30f1939ee988a09d35df12ee1ecb5f9d20836a5f5145e23c01d936995f`.
- Sequence 7 schema-manifest SHA-256: `f8234244722883c8b87c80559d3b86a2952d1364364fb9f4a7940f4d375891c8`.
- Candidate version remains `1.0.0-candidate.3`; no candidate.4 migration exists.

## Validation

- PostgreSQL image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Node image: `node@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293` (Node 20).
- Canonical CT-DB-001J parent: PASS with its exact embedded owner.
- Canonical CT-DB-001A-J run: 31 passed, zero failed, four intentional nonmatching tests skipped.
- Reconciled A/D/J slice: 10 passed, zero failed, 13 intentional nonmatches skipped.
- Focused JobRestart/replay/migration units: PASS.
- Full isolated host suite: PASS with `ETF_TEST_POSTGRES_URL` unset; database parents were run separately against the clean pinned database.
- Build, lint, editor diagnostics, dependency audit, and diff checks: PASS; zero audit vulnerabilities.
- Independent Plan Review: PASS.
- Independent Code Review: REV-182 PASS.
- Independent Security Review: REV-183 PASS.

## Deferred Debt

GitHub issue #85 tracks canonical `UInt` normalization for `job_start`/`job_get` and explicit PostgreSQL error-token drift guards. It is a separate greenfield contract-hardening task under WP-8 #84 and does not reopen CT-DB-001J or authorize candidate.4, a checkpoint writer, SQL Server conversion, ETL, coexistence, cutover, or rollback work.

## Boundary

This evidence accepts CT-DB-001J only. CT-DB-001I remains accepted under DEC-079/REV-180/181. PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, and production remain open or unauthorized. REV-164 and the original CT-DB-001K evidence remain invalidated history.
