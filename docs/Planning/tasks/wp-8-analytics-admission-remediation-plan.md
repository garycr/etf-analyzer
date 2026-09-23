# WP-8 Analytics Admission Remediation Plan

**Date:** 2026-09-22
**Status:** Plan PASS; revised after Architecture CONDITIONAL; architecture resubmission pending
**Tracking:** GitHub issue #84
**Estimate:** 10.0 agent-hours

## Problem

The failing canonical CT-DB-001I parent exposed two contract outcomes with no runtime owner. Migration 0005 emits integrity, completeness, publication-version, idempotency, and persistence failures, but neither `ANALYTICS_RIGHTS_RESTRICTED` nor `ANALYTICS_CAPACITY_BLOCKED`. API error catalogs alone cannot enforce atomic publication admission.

## Decision

Amend migration 0005 rather than introduce an integration-only adapter. Add two evidence-writer-owned control relations: immutable `analytics_provider_policy_admission` keyed by the canonical provider policy reference, and singleton `analytics_capacity_admission` constrained to RET-A-1.0 and the accepted 25 GiB limit. Revoke PUBLIC and runtime direct table authority. Seed only the accepted fixture policy and zero managed usage during migration.

`etf.evidence_commit(jsonb)` retains syntax and authorization validation first, then exact idempotency lookup. A non-replay command checks managed capacity before mutable input state, and checks every referenced provider policy before publication version and integrity publication. Capacity at 25 GiB raises `ANALYTICS_CAPACITY_BLOCKED`. A `Complete`-intended commit with a missing or retention-forbidden policy raises `ANALYTICS_RIGHTS_RESTRICTED`. A `Degraded` command commits only when its bounded reason equals one referenced, known, retention-forbidden policy; it persists evidence and retention state but does not publish. Neither hard-block outcome is replaced by `ANALYTICS_PUBLICATION_BLOCKED`, and neither mutates the nine evidence relations.

Migrations 0005 and 0006 change. Sequence 5 creates the two admission projections and amends `evidence_commit`; sequence 6 adds UPDATE/DELETE/TRUNCATE guards for the immutable provider-policy projection and explicitly excludes the mutable capacity singleton. Exact SQL hashes for 5 and 6 and cumulative manifest hashes for 5-7 are regenerated and reconciled across migration, readiness, contract, and evidence fixtures. CT-DB-001A object counts and hashes, CT-DB-001C rollback/replay, CT-DB-001D's closed column-grant matrix, and immutable-target snapshots are explicit reconciliation surfaces. The admission tables have no column grants; CT-DB-001D proves that absence. Existing role and membership matrices do not change because no role is added. CT-DB-001K computes migration state dynamically and has no sequence-specific hash fixture, but remains covered by the host suite. Previously accepted evidence remains historical evidence for the old bytes.

Manifest identity remains a deterministic server-generated output and is not added to the command payload. The exact byte rule is:

- At global sequence zero, an evidence ID matching `^evidence-(?!id-|sequence-)([A-Za-z0-9][A-Za-z0-9._:-]{0,118})$` maps to `manifest-` plus the captured UTF-8 suffix. Thus `evidence-fixture-1` maps to `manifest-fixture-1`.
- Every other sequence-zero ID maps to `manifest-id-` plus the lowercase, untruncated hexadecimal encoding of all UTF-8 evidence-ID bytes. Thus `x` maps to `manifest-id-78`, while `evidence-x` maps to `manifest-x`.
- Every nonzero sequence maps to `manifest-sequence-<base-10-sequence>-id-<lowercase-untruncated-UTF-8-hex-evidence-id>`.

For example, global sequence `1` and evidence ID `evidence-x` produce `manifest-sequence-1-id-65766964656e63652d78`. The reserved `id-` and `sequence-` suffixes make the textual and encoded namespaces disjoint. Full, untruncated UTF-8 hex is injective; the global decimal sequence makes successor identities disjoint. The existing bounded 128-character evidence-ID grammar keeps generated identities bounded. `bundleHash` is unaffected because manifest identity is not in its hash domain.

The admission relations are fixture projections of provider-rights and managed-capacity state, not new source-of-truth ownership. GitHub #17 remains authoritative for provider rights, approval, fixture policy, and future ingestion projection; a future #17 implementation must replace the seeded fixture projection without changing analytics error semantics. The capacity row is a fixture-operable RET-A-1.0 projection for the existing local boundary; no production metering or deployment authority is implied.

The remediation also audits every `evidence_commit` error branch against the stable-error table and corrects validation order and labels, not only the previously observed pairs. Existing closed-schema and numeric validation currently below idempotency is relocated above it; current pre-replay canonical hash comparisons are relocated to rank 80 below replay, capacity, input, rights, and publication-version admission. Closed schema, container/type, nullability, identifier, decimal, and numeric-class grammar are rank 10 and execute before idempotency rank 20; grammar defects use `ANALYTICS_INPUT_INCOMPLETE` or `ANALYTICS_NUMERIC_CLASS_INVALID`, not integrity. Equivalent replay still bypasses mutable admission. Capacity is rank 30, required-input completeness rank 40, rights rank 60, publication version rank 70, canonical hash verification rank 80, and persistence rank 90. Adjacent and non-adjacent combined-failure tests prove the lowest applicable rank wins. The exception-handler stable-code allowlist adds `ANALYTICS_RIGHTS_RESTRICTED` and `ANALYTICS_CAPACITY_BLOCKED` so neither is masked as persistence failure.

Migration and conformance setup mutate capacity only through the existing `migration_owner -> SET LOCAL ROLE evidence_writer_owner` deployment edge. The provider-policy seed is immutable after migration 0006. `app_runtime`, `projection_runtime`, and `audit_runtime` have no direct privilege on either table; `evidence_commit` reads both under its existing SECURITY DEFINER owner and never increments capacity or mutates policy.

## Test-First Sequence

1. Keep the failing canonical CT-DB-001I parent bound to one complete owner test.
2. Add exact candidate.3 catalog, owner, ACL, constraints, seed, and manifest-failure rollback assertions for both control relations; prove the provider policy has all three immutable guards and capacity has none.
3. Add a deterministic snapshot of all nine evidence relations and a complete CT-DB-001I owner covering positive publication plus all six required failures.
4. Implement and prove the server-generated manifest identity rule: `evidence-fixture-1` at sequence zero returns `manifest-fixture-1`; non-namespace IDs use a digest namespace; successor identities include sequence; `x` and `evidence-x` remain distinct.
5. Inventory every `RAISE EXCEPTION 'ANALYTICS_*'` branch in `evidence_commit`, assign its canonical rank/code, correct mislabelled grammar branches, and add combined-failure vectors proving ranks 10/20, 20/30, 30/40, 40/60, 60/70, 70/80, 80/90, and non-adjacent 60/80.
6. Prove a Complete-intended forbidden-rights command hard-blocks unchanged, while a Degraded command whose reason exactly names the forbidden referenced policy commits evidence without replacing publication.
7. Preserve the existing late SQL trigger failure to prove rollback after partial writes.
8. Regenerate exact SQL and cumulative manifest hashes and update candidate.3, migration/readiness fixtures, CT-DB-001A hardcoded object counts, CT-DB-001C rollback/replay, CT-DB-001D closed ACL expectations, immutable-target snapshots, and successor projections.
9. Rerun canonical CT-DB-001A-E and CT-DB-001I on the pinned PostgreSQL image; accepted evidence remains historical rather than silently rewritten.
10. Run the host suite, lint, diagnostics, dependency audit, and independent Code and Security reviews before bounded acceptance.

## Effort

| Task | Hours |
| --- | ---: |
| Contract-owner, error audit, precedence, and catalog tests | 2.00 |
| Existing rank-10 validation relocation and regression repair | 1.50 |
| Migration admission and manifest identity implementation | 1.75 |
| Complete I owner and rollback evidence | 1.75 |
| Hash, object-count, ACL, and manifest reconciliation | 1.25 |
| Validation, reviews, and evidence | 1.75 |
| **Total** | **10.0** |

If implementation exceeds 10.0 agent-hours, validation reordering requires redesign rather than relocation, a third control relation or any role is required, or more than two hours of additional unplanned repair emerges, stop and reforecast through governance before reducing scope or quality.

## Boundaries

- PostgreSQL remains greenfield, pinned to 16.15, and limited to the fixture provider.
- No dependency, route, service, credential, deployment, or production authority is added.
- The two control relations are admission inputs, not additional evidence-bundle state.
- PostgreSQL contract `1.0.0-candidate.3` is the physical-catalog amendment under Team Lead custody; independent Plan and Architecture verification precedes implementation, and exact hashes follow executable projection.
- Rejected commits leave both admission projections and all nine evidence relations byte-for-byte unchanged.
- GitHub #17 remains the provider-rights source-of-truth owner; this change supplies only its closed fixture projection to analytics admission.
- CT-DB-001J, PT-E2E-001, WP-8, DP-33, Ring 2, release, deployment, and production remain open.
