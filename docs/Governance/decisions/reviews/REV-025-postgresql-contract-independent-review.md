# REV-025 - PostgreSQL Contract Independent Review

**Date:** 2026-09-11  
**Review type:** Independent alternate-role architecture verification  
**Artifacts:** `docs/Planning/contracts/postgresql-contract.md` `1.0.0-candidate.2`; `specs/features/PostgreSQL-Contract-Conformance.feature`  
**Reviewer:** Architect Reviewer, distinct from originator and Team Lead custodian  
**Verdict:** FAIL  
**Critical findings:** 1  
**Major findings:** 4  
**Minor findings:** 0  
**Nits:** 0

## Findings

### CRITICAL-1 - PostgreSQL 16 migration authority is not realizable

The membership tuple is oriented opposite to its `{role,member,adminOption}` schema, omits PostgreSQL 16 `inheritOption` and `setOption`, and provides no manifested deployment-login connection/elevation path. Migration-owner privileges therefore cannot be acquired as declared.

**Required correction:** Define correctly oriented PostgreSQL 16 membership records and a closed, time-bounded deployment connection and SET ROLE lifecycle without unmanifested drift.

### MAJOR-1 - Owner identifiers are narrowed incompatibly

Fixture and analytics owner-valid identifiers include non-UUID values such as `fixture-build-1`, `evidence-fixture-1`, `input-fixture-1`, and `manifest-fixture-1`, while candidate.2 physically requires UUIDs.

**Required correction:** Preserve owner identifier grammar as text for affected records, or revise the owning contracts and golden vectors through their own governed candidates.

### MAJOR-2 - Least-privilege readers cannot reconstruct application results

The five views omit checkpoint, confirmation/history, and portfolio projection content required by `JobGet`, `PaperOrderGet`, and `PortfolioGet`; no controlled reader functions or direct grants supply those records.

**Required correction:** Add bounded SECURITY DEFINER reader functions or complete redacted projections for the exact application records without broad base-table grants.

### MAJOR-3 - Denial binding lacks direct negative vectors

`CT-DB-001D` does not directly exercise vanished/reused backends, backend-start mismatch, missing/wrong nonce, conflicting deduplication content, or denial-audit append failure.

**Required correction:** Add literal examples under the existing `CT-DB-001D` identifier with exact outcomes and unchanged-state assertions.

### MAJOR-4 - Extension assertion conflicts with PostgreSQL system PL/pgSQL

The target uses PL/pgSQL while `CT-DB-001A` literally rejects every extension outside a manifest that has no extension kind. PostgreSQL normally represents `plpgsql` in `pg_extension`.

**Required correction:** Define a closed system-extension allowlist containing `plpgsql`, prohibit product-created extensions, include the allowlist in catalog projection, and align CT-DB-001A.

## Preserved Results

REV-024 custody PASS remains historically valid for its reviewed scope. Ledger/order atomicity, fixture/evidence semantics apart from identifier storage, reconstructive constraints, numeric/time/JSON closure, restart/readiness, exactly `CT-DB-001A..L`, and the no-event boundary were independently verified without finding. Ring 2 SQL, hash values, and executable evidence remain deferred.

## Disposition Required

Workspace Owner disposition is required before remediation or deferral. Recommended: approve CRITICAL-1 and MAJOR-1..4 for test-first remediation while retaining `1.0.0-candidate.2`; these corrections close implementation contradictions without changing the candidate's intended owner semantics or external transport scope.

## Workspace Owner Disposition

**Decision:** Approve CRITICAL-1 and MAJOR-1..4; retain PostgreSQL `1.0.0-candidate.2` for test-first remediation.  
**Policy:** Human-in-the-Loop finding disposition; PostgreSQL 16 native semantics; fresh-bootstrap boundary.  
**Authority:** Workspace Owner approval in the governed session.  
**Accountability:** Originating agent updates the existing `CT-DB-001A..L` vectors before the contract, obtains Team Lead custody recheck, and returns the corrected candidate to independent verification.

The database starts empty and no data migration or cross-dialect compatibility is required. PostgreSQL 16 native role, DDL, catalog, function, and extension behavior is authoritative. Generic SQL and migration terminology is implementation guidance only where compatible; it cannot override the PostgreSQL 16 bootstrap design.

## Team Lead Custody Recheck 1

**Verdict:** FAIL. MAJOR-1, MAJOR-3, and MAJOR-4 closed; CRITICAL-1 and MAJOR-2 remained open.

Native PostgreSQL ownership assignment still lacked authority because restricted product roles could neither create the initial role graph nor assign objects to all declared owners. `evidence_read(text)` also conflicted with application candidate.1 `EvidenceGet(UUID)` and did not explicitly reconstruct the complete application result.

Approved-scope correction defines an external non-product cluster provisioner that creates the fourteen roles and nine PostgreSQL 16 membership records before product DDL. The graph gives `migration_owner` non-admin, non-inherited `SET TRUE` membership in each other owner role, permitting native ownership assignment without elevated product-role attributes. The owner-preserving evidence correction is classified as application `1.0.0-candidate.2`: `EvidenceGet(String)` and `evidence_read(text)` preserve opaque analytics identity and return complete `{evidence: Evidence}`. Application candidate.1 reviews remain historical; candidate.2 requires custody and independent re-verification.

## Team Lead Custody Recheck 2

**Application verdict:** PASS for `1.0.0-candidate.2`; the EvidenceGet scalar delta, candidate-version bytes, complete owner result, and unchanged `PT-APP-001A..P` are custody-approved for independent verification.

**PostgreSQL verdict:** FAIL. CRITICAL-1 and MAJOR-1/3/4 closed. MAJOR-2's missing direct `evidence_read` vector was added under its existing approval and passed focused validation.

**NEW-MAJOR-1 - CT-DB-001C retains a role boundary inside migration 0001:** The interruption matrix named `0001-foundation | after first role`, but the corrected native bootstrap creates all roles and memberships before every product migration and `0001-foundation` no longer allocates roles. The Workspace Owner approved correction to `after schema creation`, an atomic boundary allocated to migration 0001. Independent PostgreSQL re-verification remains blocked pending custody recheck.

## Team Lead Custody Recheck 3

**Verdict:** PASS. CRITICAL-1, MAJOR-1..4, and NEW-MAJOR-1 are closed with no new Critical or Major finding. The design-time BDD quality score is 4.8/5. Exactly `CT-DB-001A..L` remain, and executable PostgreSQL evidence remains deferred to Ring 2.

This PASS authorizes only independent alternate-role verification of application `1.0.0-candidate.2` and PostgreSQL `1.0.0-candidate.2` before mutable synchronization.

## Independent Re-verification

**Verdict:** PASS for application `1.0.0-candidate.2` and PostgreSQL `1.0.0-candidate.2`. No Critical or Major findings remain. REV-025 CRITICAL-1, MAJOR-1..4, and NEW-MAJOR-1 are independently closed. One pre-synchronization metadata Minor is recorded in REV-026 and awaits Workspace Owner disposition before synchronization.

## Preserved Boundaries

The final PASS authorizes only the Workspace Owner-approved metadata synchronization recorded in REV-026. It does not authorize SQL migrations, implementation, dependencies, HTTP or event design, baseline activation, parallel work, deployment, Ring 2, provider/stream guard unblocking, or #21 closure. PostgreSQL design-time resolution is complete; the OpenAPI stage remains pending.
