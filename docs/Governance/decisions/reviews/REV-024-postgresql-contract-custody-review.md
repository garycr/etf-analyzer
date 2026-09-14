# REV-024 - PostgreSQL Contract Custody Review

**Date:** 2026-09-11
**Review type:** Distinct Team Lead custody review; not independent verification
**Artifacts:** `docs/Planning/contracts/postgresql-contract.md` `1.0.0-candidate.1`; `specs/features/PostgreSQL-Contract-Conformance.feature`
**Reviewer:** Team Lead, distinct from originator
**Verdict:** FAIL
**Critical findings:** 3
**Major findings:** 6
**Minor findings:** 0
**Nits:** 0

## Summary

The six-migration sequence, PostgreSQL 16 boundary, exact numeric type intent, `CT-DB-001A..L` identifiers, CT-DB-002 guard, and explicit absence of event scope are coherent. Candidate.1 is not custody-ready because the final catalog, ledger authority, owner records, physical constraints, evidence retention, value validation, restart/readiness behavior, and direct vectors are not closed enough to implement deterministically. Missing Ring 2 SQL, byte hashes, manifest hashes, and executable results were not treated as findings.

## Critical Findings

### CRITICAL-1 - Catalog and manifest algorithm are not deterministic

Functions, views, triggers, owners, memberships, grants, migration deltas, manifest JSON schema/order, expression normalization, and function-body representation are not closed.

**Required correction:** Enumerate every final object and per-migration delta; define canonical manifest records/order and stable normalization or hashes for expressions and function bodies. Ring 2 hash values may remain deferred.

### CRITICAL-2 - Authority and protected integrity contradict ledger candidate.2

The role model collapses owner authority, omits required ledger/projection runtime separation and deployment-only key injection, and does not manifest protected key, portfolio/audit anchor chains, or latest protected checkpoint.

**Required correction:** Preserve pinned ledger roles and denied relationships; manifest key/anchor/checkpoint records, exact owners, nested grants, key injection, and redacted pre-procedure denial auditing.

### CRITICAL-3 - Ledger/order records cannot preserve atomic and audit boundaries

Required ledger transaction and audit identities/evidence fields are absent, no exact fill record exists, and non-ledger order audit plus success/rejection/integrity/denial/recovery/publication transaction boundaries are incomplete.

**Required correction:** Expand physical records one-for-one with pinned owner fields/nullability and define all controlled success and post-rollback audit/commitment boundaries.

## Major Findings

### MAJOR-1 - Fixture observation tables are not physically closed

**Required correction:** Expand market/economic columns, SQL types, nullability, placement, keys, FKs, checks, identity/conflict rules, timestamp/DQ/currency rules, and selection indexes exactly.

### MAJOR-2 - Constraints and indexes use unenforceable shorthand

**Required correction:** Replace every owner-check/FK shorthand with named exact defaults, PK/FK/UQ/check constraints, FK actions/deferrability, index method/order, and identifier collation.

### MAJOR-3 - Analytics evidence and retention are incomplete

**Required correction:** Preserve every included candidate.2 manifest/lifecycle/deletion field, class-specific retention deadline and immutable epoch, hash linkage, and Complete/hash-verified publication enforcement, or explicitly bound out a surface.

### MAJOR-4 - Numeric, timestamp, and JSON pre-cast behavior is not owner-exact

**Required correction:** Allocate per-column grammar, scale, negative-zero rule, precision/bound, precedence/code; define UTC timestamp pre-cast rejection and retry capture; bind every JSON column to a closed schema and hash domain.

### MAJOR-5 - Job/checkpoint and readiness persistence is incomplete

**Required correction:** Define checkpoint effect/range linkage, exact job constraints, restart locks/replay/crash vectors, and separation of database readiness from the complete ordered application readiness snapshot.

### MAJOR-6 - CT-DB-001 vectors are not direct or failure-specific

**Required correction:** Add concrete accepted/malformed tables with exact codes, precedence, and unchanged-row assertions for migration/catalog/grant drift, role attacks, values, atomic rollbacks, denial audit, restart replay, and readiness selection.

## Candidate Classification

The corrections change physical tables, fields, roles, grants, constraints, functions, security boundaries, and conformance behavior. Under DEC-013 default-to-breaking governance, remediation requires `1.0.0-candidate.2`, a new Team Lead custody recheck, and later independent alternate-role verification.

## Disposition Required

Workspace Owner disposition is required before remediation or deferral. Recommended: approve CRITICAL-1..3 and MAJOR-1..6 and authorize `1.0.0-candidate.2` for test-first remediation.

## Workspace Owner Disposition

**Decision:** Approved CRITICAL-1..3 and MAJOR-1..6; authorize `1.0.0-candidate.2` for test-first remediation.
**Policy:** Human-in-the-Loop finding disposition, DEC-013 default-to-breaking classification, and pinned owner authority.
**Authority:** Workspace Owner approval in the governed session.
**Accountability:** Originating agent expands `CT-DB-001` before contract changes; Team Lead rechecks all findings; independent alternate-role verification follows custody PASS.

This approval does not authorize SQL migration implementation or alter the preserved boundaries below.

## Preserved Boundaries

This FAIL does not authorize SQL migrations, implementation, dependencies, HTTP or event design, architecture acceptance, baseline activation, inventory synchronization, parallel work, deployment, Ring 2 advancement, guard unblocking, or #21 closure. STORE and aggregate contract resolution remain BLOCKED. CT-DB-002 remains guard-triggered; alternate-model provenance is not claimed.

## Candidate.2 Custody Recheck 1

**Verdict:** FAIL  
**Critical findings:** 3  
**Major findings:** 6  
**Minor findings:** 0  
**Nits:** 0

Team Lead found CRITICAL-1..3 and MAJOR-1..6 still OPEN. The candidate.2 closure addendum conflicted with the later exact manifest: protected anchor/key/checkpoint records, fill/order-audit/dual-commitment records, augmented ledger fields, and analytics lifecycle/deletion records were missing from the manifest. Role/grant and constraint definitions remained incomplete.

The recheck also found owner contradictions in the vectors and contract: stale runtime roles, rejected ledger negative zero instead of positive-zero normalization, invented fixture/analytics codes, positive-only fixture revision instead of non-negative revision including `0`, and 365-day deletion-certificate retention instead of 1,825 days. Direct lock-order, replay-before-state, checkpoint-range, denial-audit, manifest/grant drift, and atomic rollback assertions remained insufficient.

The originating agent subsequently consolidated candidate.2 into one physical manifest and corrected the approved owner facts and direct vectors. Those changes are remediation evidence only and require a fresh Team Lead custody recheck; no finding is marked CLOSED by the originator.

## Candidate.2 Custody Recheck 2

**Verdict:** FAIL  
**Critical findings:** 2  
**Major findings:** 4  
**Minor findings:** 0  
**Nits:** 0

Team Lead closed CRITICAL-3, MAJOR-3, and MAJOR-5. CRITICAL-1 and CRITICAL-2 remained OPEN because reader views, per-object ownership, trigger targets, signature-level grants, and the authenticated denial-collector/deduplication boundary were not fully reproducible. MAJOR-1 and MAJOR-4 remained OPEN because fixture records omitted owner provenance/quality fields and used one scale for all numeric classes. MAJOR-2 remained OPEN for constraint/nullability shorthand, and MAJOR-6 remained OPEN because CT-DB-001F..I lacked failure-specific vectors.

Approved remediation then added exact migration deltas, object ownership, reader-view definitions, signature-level grants, trigger targets, a synchronous authenticated denial-audit boundary and manifest row, one-for-one fixture fields with class-specific physical value columns, concrete value/nullability matrices, and direct F-I failure/code/unchanged-row examples. A focused semantic check found no remaining contradiction in the six open findings; Team Lead alone determines closure in the next custody recheck.

## Candidate.2 Custody Recheck 3

**Verdict:** FAIL  
**Critical findings:** 2  
**Major findings:** 2  
**Minor findings:** 0  
**Nits:** 0

Team Lead closed MAJOR-1 and MAJOR-6 without regressing CRITICAL-3, MAJOR-3, or MAJOR-5. CRITICAL-1 remained OPEN for missing canonical constraint/index/trigger/schema/role record shapes, ambiguous view query hashing, and omission of the immutable guard function/triggers from migration `0006`. CRITICAL-2 remained OPEN because `audit_append` required `session_user='audit_runtime'` while valid nested projection calls retain `projection_runtime`, and because original denied-session binding was not exact. MAJOR-2 remained OPEN for incomplete per-object FK/check reconstruction. MAJOR-4 remained OPEN for bare timestamp precision, generic JSON binding, and wildcard error allocation.

The next remediation is restricted to those four findings and requires another Team Lead custody recheck.

## Candidate.2 Custody Recheck 4

**Verdict:** FAIL  
**Critical findings:** 2  
**Major findings:** 2  
**Minor findings:** 0  
**Nits:** 0

CRITICAL-1 remained OPEN for a manifest self-hash cycle, stale `0001` guard allocation, incomplete grant rendering, and missing function-body extraction. CRITICAL-2 remained OPEN for incomplete original-current-user verification, denial content hashing/conflict code, and audit outcome routing. MAJOR-2 remained OPEN for colliding FK names, absent supporting UQs, incorrect nullable-composite semantics, and residual check shorthand. MAJOR-4 remained OPEN only for exact supplied timestamp and domain JSON code allocation; timestamp precision and JSON column coverage were accepted.

Approved remediation removed `schemaManifestHash` from its own input, aligned `0001`/`0006`, completed grant and SQL-source rendering, routed audit payloads by domain/outcome/table, bound and hashed denial records, made FK names column-specific with MATCH SIMPLE semantics, materialized supporting UQs, and enumerated timestamp/domain JSON stable codes. Focused validation found no remaining recheck-4 defect; Team Lead retains closure authority.

## Candidate.2 Custody Recheck 5

**Verdict:** FAIL  
**Critical findings:** 2  
**Major findings:** 0  
**Minor findings:** 0  
**Nits:** 0

All Major findings were CLOSED. CRITICAL-1 remained OPEN because CT-DB-001C allocated an append trigger to `0003` and SQL hash extraction used unavailable original DDL rather than PostgreSQL reconstruction APIs. CRITICAL-2 remained OPEN because SECURITY DEFINER identity was modeled incorrectly and `pg_stat_activity` cannot expose another backend's effective role.

Remediation moved the `0003` rollback probe to a ledger table, defined live hashes through PostgreSQL 16 `pg_get_functiondef` and `pg_get_viewdef(...,false)`, routed nested audit by session identity plus grant isolation, and bound denial evidence only to live `pg_stat_activity` PID/backend-start/login/application-name plus a fresh nonce. Focused PostgreSQL 16 validation passed; Team Lead retains closure authority.

## Candidate.2 Custody Recheck 6

**Verdict:** PASS  
**Critical findings:** 0  
**Major findings:** 0  
**Minor findings:** 0  
**Nits:** 0

Team Lead CLOSED CRITICAL-1..3 and MAJOR-1..6. PostgreSQL 16 catalog reconstruction, migration allocation, manifest hashing, direct/nested audit authority, nonce-bound denial evidence, physical records, constraints, owner fidelity, retention, restart/readiness, and direct `CT-DB-001A..L` vectors are custody-complete at design time. Ring 2 SQL, concrete hashes, and executable evidence remain deferred.

This PASS authorizes only the required independent alternate-role verification. It does not authorize mutable synchronization, SQL migrations, implementation, dependencies, HTTP/events, baseline activation, parallel work, deployment, Ring 2, #21 closure, or any blocked guard transition.
