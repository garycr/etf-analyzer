# WP-8 CT-DB-001H Conformance Evidence

**Date:** 2026-09-22
**Decision:** DEC-069; DEC-078
**Status:** Accepted under REV-178 and REV-179
**Scope:** CT-DB-001H only

## Fixture Identity And Provenance

The canonical `CT-DB-001H fixture identity and provenance constraints reject ambiguity` parent serially executes the positive queryability owner and the complete rollback owner. A reviewed fixture package commits package identity, ordered descriptors, raw-source bytes and hashes, market and economic observations, replay identity, timestamps, revisions, normalization identifiers, quality state, quality codes, and the exact owner ingestion identifier `fixture-build-1`.

The rollback owner establishes one accepted live PostgreSQL baseline and snapshots `fixture_packages`, `fixture_descriptors`, `fixture_raw_sources`, `market_observations`, `economic_observations`, `fixture_ingestion_replays`, `jobs`, and `job_checkpoints` in deterministic key order.

| Failure | Exact result |
|---|---|
| Reused market identity with changed content | `FIXTURE_IDEMPOTENCY_CONFLICT` |
| Two vintage identifiers at one release | `FIXTURE_TEMPORAL_INVALID` |
| Raw-source bytes differ from hash | `FIXTURE_FILE_INTEGRITY_FAILED` |
| Normalization identifier is absent | `FIXTURE_PROVENANCE_INVALID` |
| Selected record is Quarantined | `FIXTURE_REQUIRED_QUARANTINED` |

The four malformed package or selection cases fail at the owning Application boundary before persistence and preserve the complete PostgreSQL baseline. The changed-content replay reaches `etf.fixture_ingest` and preserves the same baseline. A supplementary late PostgreSQL failure occurs after fixture insertion begins and proves transaction rollback across all eight protected relations.

## Validation

- Image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Canonical CT-DB-001H parent: 1/1 PASS, zero failed, zero skipped.
- Embedded owner set: two serialized owner tests PASS, zero failed, zero skipped.
- Host suite: 498 tests, 419 passed, zero failed, 79 PostgreSQL/browser skips in the unconfigured host run.
- Build, lint, editor diagnostics, and diff checks: PASS.
- Temporary PostgreSQL containers: removed.
- Migration SQL and cumulative manifest hashes: unchanged.
- Independent Code Review: REV-178 PASS after evidence-depth remediation.
- Independent Security Review: REV-179 PASS after late SQL rollback evidence was added.

## Boundary

This evidence accepts CT-DB-001H only. CT-DB-001I/J, PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, and production remain open or unauthorized. Earlier accepted CT-DB-001A-G/K/L checkpoints retain their separate decisions and reviews. REV-164 and the original CT-DB-001K evidence remain invalidated history.
