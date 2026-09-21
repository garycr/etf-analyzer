# WP-8 Denial Backend Verifier Remediation Plan

**Date:** 2026-09-21
**Status:** Approved under DEC-070; Architecture CONDITIONAL; Plan PASS
**Tracking:** GitHub issue #84
**Estimate:** 6.0 agent-hours

## Problem

The role-correct CT-DB-001K denial probe disproved the current contract. `etf.audit_append(jsonb)` is `SECURITY DEFINER` owned by `audit_writer_owner`; PostgreSQL 16.15 redacts another role's `pg_stat_activity` fields from that owner. The wrapper can observe its own `audit_runtime` row, but the database owner that must independently validate the still-live original backend cannot.

## Decision

Add migration `0007-denial-backend-verifier` and product role `audit_activity_verifier_owner` (`NOLOGIN`, no elevated role attributes). The external provisioner creates the role and exact authority graph transactionally before migration 0007:

- `pg_read_all_stats -> audit_activity_verifier_owner`: `ADMIN FALSE, INHERIT TRUE, SET FALSE`.
- `audit_activity_verifier_owner -> migration_owner`: `ADMIN FALSE, INHERIT FALSE, SET TRUE`.

The verifier owns one boolean-only `SECURITY DEFINER` helper that clears the statistics snapshot and compares exact PID, backend start, session user, and nonce-bound application name. The owner inherently executes it; `audit_writer_owner` is its only non-owner EXECUTE grantee. PUBLIC, runtime roles, and unrelated owners cannot execute it. Neither `audit_writer_owner` nor the verifier can `SET ROLE` to the verifier or `pg_read_all_stats`; only the migration deployment graph permits `migration_owner` to set the verifier owner during DDL. `audit_append` invokes the helper only in its validated Denial branch, after safe parsing of all correlation inputs and immediately before digest derivation. Order and Ledger branches remain byte-identical.

Do not grant `pg_read_all_stats` to `audit_writer_owner`, trust the wrapper preflight, or introduce signed assertions.

## Options Considered

| Option | Feasibility | Security / operations | Schedule | Disposition |
| --- | --- | --- | ---: | --- |
| Grant `pg_read_all_stats` to `audit_writer_owner` | Small migration | Exposes cluster-wide statistics to the complete audit write owner; predefined-role expansion increases upgrade risk | 2-3h | Rejected |
| Dedicated verifier owner and boolean helper | Additive role bootstrap, migration, manifest, and readiness work | Contains statistics authority behind one non-enumerating predicate; explicit PostgreSQL-major upgrade review | 6h | Selected |
| Runtime-signed backend assertion | New key custody, freshness, replay, signing, and verification contracts | Proves a prior observation rather than liveness immediately before digest derivation | 8-12h | Rejected |
| Trust wrapper preflight only | Mechanically simple | Splits trust and fails the normative database-side still-live check | 1h | Rejected |

The dedicated verifier is selected because it is the only option that preserves immediate database-side liveness verification while containing statistics authority and avoiding a new cryptographic protocol.

## Test-First Sequence

1. Add a transactional external-provisioner upgrade operation. It preflights an exact six-migration installation, creates only the missing verifier role and two exact membership edges, rolls back completely on any mismatch/failure, supports clean bootstrap and six-to-seven upgrade, and replays as an exact no-op.
2. Add failing migration-set, role-bootstrap-upgrade, and manifest tests for sequence 7, the fifteenth product role, the predefined-role edge, the deployment SET-only edge, helper ownership, and closed grants.
3. Add a forced manifest-projection failure test proving no helper, altered `audit_append`, sequence-7 row, or changed grant remains; then prove successful retry and exact no-op replay.
4. Update every sequence-7 surface: expected migration IDs/preparation, prospective and current manifest builders/projectors, expected function and role/membership sets, readiness exact migration ledger and terminal manifest lookup, migration hashes, and integration fixtures.
5. Add the exact pinned security matrix: live match; independent PID, backend-start, session-user, and nonce mismatch; vanished backend; direct EXECUTE denial for PUBLIC, all runtime roles, and unrelated owners; denied SET ROLE paths; exactly owner plus `audit_writer_owner` effective EXECUTE; one boolean result column; no raw activity fields or distinguishing errors.
6. Implement migration 0007. The helper call appears only in the validated Denial branch immediately before digest derivation; assert Order/Ledger migration function behavior remains unchanged.
7. Re-run the rollback-only CT-DB-001K probe and byte-identical protected-row snapshot.
8. Obtain independent Code, Security, Architecture, and migration/manifest review.
9. Preserve invalidated REV-164 as history and issue a superseding review only after isolated pinned PostgreSQL evidence passes.

## Provisioning Paths

- **Clean initial-state predicate:** none of the fifteen product roles exists; schema `etf`, `etf.schema_migrations`, and product-created extensions are absent. The external provisioner has database-owner and CREATEROLE authority. Any partial product role/schema/migration state fails before mutation. Base bootstrap then creates exactly fifteen roles with declared LOGIN/NOLOGIN and denied elevated attributes, creates exactly the eleven membership edges including the two verifier edges with declared options, revokes PUBLIC database CONNECT/TEMPORARY, grants the closed runtime CONNECT set, and creates only empty schema `etf` owned by `schema_owner` with null ACL, zero relations/routines/default ACLs. Migrations 0001..0007 then apply.
- **Canonical sequence-6 upgrade predicate:** the original fourteen roles have exact attributes and nine memberships; `audit_activity_verifier_owner` and both verifier edges are absent; schema `etf` is owned by `schema_owner`; sequence 6 has exactly six ordered canonical migration IDs/content hashes and the accepted terminal manifest hash; no sequence 7 row exists; the current catalog projects to that sequence-6 manifest; PUBLIC database/schema/function authority remains revoked. Any unexpected verifier role/edge, role attribute, membership, schema owner/ACL, migration row/hash, or terminal manifest fails before mutation. The external provisioner transaction creates only the verifier role and two exact edges, then commits before migration 0007.
- **Replay:** provisioner upgrade and migration 0007 both return exact no-op outcomes only when identities, attributes, memberships, hashes, and manifest match.

## Migration 0007 Authority Lifecycle

1. Migration execution enters `migration_owner` through the existing deployment SET-only graph.
2. `migration_owner` sets `schema_owner`; `schema_owner` grants `USAGE, CREATE` on schema `etf` to `audit_activity_verifier_owner`; execution resets to `migration_owner`.
3. `migration_owner` sets `audit_activity_verifier_owner`, creates the boolean helper with fixed trusted `search_path`, revokes PUBLIC execution, and grants helper EXECUTE to `audit_writer_owner`; execution resets to `migration_owner`.
4. `migration_owner` sets `audit_writer_owner`, replaces only the Denial correlation expression in `audit_append`, and revokes PUBLIC execution; execution resets to `migration_owner`.
5. `migration_owner` sets `schema_owner`; `schema_owner` revokes `CREATE` from `audit_activity_verifier_owner` while retaining only the schema authority required by the final manifest; execution resets to `migration_owner` before projection.
6. Any failure rolls back helper creation, `audit_append` replacement, grants, and schema authority. Final catalog assertions prove the verifier has no schema `CREATE` and no product table/key/audit-write authority.

## Deployment Authority Evidence

- Catalog options prove `migration_owner` has `SET TRUE`, `INHERIT FALSE`, `ADMIN FALSE` membership in `audit_activity_verifier_owner` and can successfully `SET LOCAL ROLE audit_activity_verifier_owner` only inside migration execution.
- Catalog options prove `audit_activity_verifier_owner` has `INHERIT TRUE`, `SET FALSE`, `ADMIN FALSE` membership in `pg_read_all_stats`; while authenticated through the deployment graph it can read the required activity fields but `SET ROLE pg_read_all_stats` is denied.
- `audit_writer_owner`, all runtime roles, and unrelated owners cannot set either verifier role or `pg_read_all_stats`.
- The external provisioner remains the only actor that creates or repairs these role edges; migration SQL cannot create roles or grant predefined-role membership.

## Effort Breakdown

| Task | Hours |
| --- | ---: |
| Provisioner upgrade and authority tests | 1.5 |
| Migration/helper and rollback/replay tests | 1.5 |
| Manifest/readiness sequence-7 reconciliation | 1.0 |
| Live security matrix and CT-DB-001K rerun | 1.0 |
| Reviews, remediation, evidence, publication | 0.75 |
| Contingency | 0.25 |
| **Total** | **6.0** |

## Boundaries

- No Domain/Application contract, route, service, dependency, credential configuration, durable handoff, or production authority.
- PostgreSQL remains pinned to major 16; predefined-role authority requires upgrade review.
- The external provisioner remains outside product roles and is the only authority allowed to create the verifier role and predefined-role membership.
- CT-DB-001K, integrated A-J, PT-E2E-001, WP-8, DP-33, and Ring 2 remain open until separately accepted.
