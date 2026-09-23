# WP-8 CT-DB-001I Conformance Evidence

**Date:** 2026-09-22
**Decision:** DEC-069; DEC-079
**Status:** Accepted under REV-180 and REV-181
**Scope:** CT-DB-001I only

## Analytics Admission And Publication

The canonical `CT-DB-001I analytics evidence publishes only complete verified bundles` parent runs under Node 20 and serially dispatches two exact owner tests: complete state preservation and ranked validation precedence. The positive baseline persists exact input, evidence, and manifest identities, including `input-fixture-1`, `evidence-fixture-1`, and `manifest-fixture-1`.

Two closed PostgreSQL admission projections govern publication. Capacity must contain the `RET-A-1.0` singleton with available fixture capacity. Complete evidence requires every referenced provider policy to be known and retention-permitted. Degraded evidence persists without replacing publication only when its reason exactly names a referenced, known, retention-forbidden policy. Runtime roles have no direct admission-table privileges; provider-policy state is immutable after migration 0006, while capacity remains owner-controlled and mutable.

The complete owner snapshots every row in deterministic order across input sets, evidence bundles, manifests, lifecycle references, deletion links, retention bindings, replay, audit, and current publication. The following failures preserve the complete baseline:

| Failure | Exact result |
|---|---|
| Canonical hash mismatch | `ANALYTICS_INTEGRITY_FAILED` |
| Missing or malformed required input | `ANALYTICS_INPUT_INCOMPLETE` |
| Complete evidence references forbidden rights | `ANALYTICS_RIGHTS_RESTRICTED` |
| Capacity projection is missing or exhausted | `ANALYTICS_CAPACITY_BLOCKED` |
| Expected publication version is stale | `ANALYTICS_PUBLICATION_VERSION_CONFLICT` |
| Forced late persistence failure | `ANALYTICS_EVIDENCE_COMMIT_FAILED` |

The precedence owner proves rank-10 grammar before rank-20 replay, equivalent replay before rank-30 capacity, rank-60 rights before rank-80 integrity, and rank-70 publication version before rank-80 integrity. A late audit-trigger failure proves transaction rollback after partial writes. Stable rights and capacity codes are not replaced by publication or generic persistence errors.

## Candidate.3 Projection

- Migration 0005 SQL SHA-256: `2a848c629d66a7e3e2621ea065f684a94fc82acb9b7e85477a228c30c8ed8001`.
- Sequence 5 schema-manifest SHA-256: `a13b6f14f6630c5caf6eb643b6c05d822752b67e1e6941bbe46aeb551fe6e66b`.
- Migration 0006 SQL SHA-256: `0e40e849d05545f4ac7b77bc07043a4c6ae92476843ae20b6b1036219582afbc`.
- Sequence 6 schema-manifest SHA-256: `d004f0e1f735090c2d7232426b5181364886161c9f4b66a18414db597abcae3b`.
- Sequence 7 schema-manifest SHA-256: `1a02236d7d501d45ec3f42571397219ce164374d39e8c64bd3f100a4b526e689`.
- Exact catalog: 45 tables, 22 functions, 105 triggers, and 71 indexes.

## Validation

- PostgreSQL image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Node image: `node@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293` (Node 20).
- Canonical CT-DB-001I parent: 1/1 PASS; two exact embedded owners PASS.
- Settled migration-0005 owners plus CT-DB-001A: 9/9 PASS, zero failed.
- CT-DB-001A-D broad controlled-access slice: PASS, including eight replay/drift and seven rollback subtests.
- Focused migration units: 15/15 PASS.
- Host suite: 502 tests, 419 passed, zero failed, 83 PostgreSQL/browser skips in the unconfigured host run.
- Build, lint, editor diagnostics, dependency audit, and diff checks: PASS; zero audit vulnerabilities.
- Independent Code Review: REV-180 PASS after parent evidence remediation.
- Independent Security Review: REV-181 PASS with no blocking findings.

## Boundary

This evidence accepts CT-DB-001I only. Capacity remains a fixture projection rather than production metering, and the global manifest lock carries no throughput claim. CT-DB-001J, PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, and production remain open or unauthorized. Earlier accepted CT-DB-001A-H/K/L checkpoints retain their separate decisions and reviews. REV-164 and the original CT-DB-001K evidence remain invalidated history.
