# REV-020 - Fixture Contract Custody Review

**Date:** 2026-09-11
**Review type:** Distinct Team Lead custody review; not independent verification
**Artifacts:** `docs/Planning/contracts/fixture-contract.md` `1.0.0-candidate.1`; `specs/features/Fixture-Contract-Conformance.feature`
**Reviewer:** Team Lead, distinct from originator
**Initial verdict:** FAIL
**Final recheck verdict:** PASS
**Critical findings:** 0
**Major findings:** 6
**Minor findings:** 3
**Nits:** 1
**Unresolved Critical/Major after recheck:** 0/0

## Summary

The candidate covers every top-level fixture topic required by issue #21, but several areas are not closed enough to be deterministic or executable. A PASS requires no unresolved Critical or Major finding. Independent alternate-model verification remains separate and pending.

## Major Findings

### MAJOR-1 - Manifest and hash domain are not closed

Unknown manifest fields are not rejected; descriptor fields are not declared exact; `mediaType` values are unconstrained; and coverage entries lack exact schemas, uniqueness rules, and complete ordering. An unknown field could change manifest bytes without changing `datasetHash`.

**Required correction:** Declare manifest, descriptors, and coverage entries closed records; define exact media types and fields; prohibit duplicate descriptors and coverage identities; reject unknown fields before hashing; exclude only `datasetHash` from the closed manifest hash domain.

### MAJOR-2 - Raw-source provenance is not verifiable

Records claim `rawSourceRef` identifies package-local bytes, but the declared three-file package contains no governed location for those bytes, so `rawSourceHash` cannot be verified.

**Required correction:** Add governed `raw-sources/<sha256>` binary objects to ordered file descriptors, byte-length and digest checks, and `datasetHash`; define `rawSourceRef` as that normalized relative path. If rights prohibit retained bytes, fail the Complete-provenance fixture policy rather than claim unverifiable provenance.

### MAJOR-3 - DQ ordering permits ambiguous fallback

The contract does not state whether quality filtering occurs before or after selecting the latest eligible revision or vintage. Filtering first could silently fall back from a latest `Stale` record to an older `Valid` record.

**Required correction:** Order structural validation, temporal cutoff, greatest numeric revision/latest release selection, then quality evaluation. A selected non-Valid record blocks publication without fallback. Define invalid historical-record treatment and add market/economic older-Valid/latest-Stale vectors.

### MAJOR-4 - Economic identity and replay are incomplete

The contract does not fully define duplicate identical lines, conflicting content under one vintage identity, or economic replay under an ingestion job identity.

**Required correction:** Define the economic job idempotency key, byte-identical replay outcome, conflicting-content outcome, and unconditional rejection of different `vintageId` values at one `(providerId, seriesId, observationDate, releaseTimestamp)`; bind each to a stable error.

### MAJOR-5 - Stable errors lack deterministic precedence

No controlling result is specified when integrity, schema, provenance, temporal, coverage, and DQ failures coexist.

**Required correction:** Define ordered validation precedence and deterministic batch ordering; add a multi-defect cross-runtime vector asserting the controlling code.

### MAJOR-6 - PT-FIX-001 does not support a 5.0 quality claim

The feature lacks provenance, coverage-schema, closed-manifest, fixed golden hash, economic duplicate, malformed revision, precedence, and observable no-network/no-failover cases. `PT-FIX-001F` says maximum scale while the contract requires exact scale.

| Dimension | Score |
| --- | ---: |
| Determinism | 3 |
| Behavioral focus | 5 |
| Failure specificity | 3 |
| Refactoring resistance | 5 |
| Input coverage | 2 |
| Isolation | 4 |
| Maintainability | 4 |

Weighted score: 3.74/5.0, Good, but Input Coverage below 3 is Major under the repository rubric.

**Required correction:** Rename `maximumScale` to `exactScale`; add precision-28 boundaries, short scale, exponent, leading zero, negative zero, malformed revision, field/class/currency mismatch, provenance tampering, closed-manifest, coverage, error-precedence, duplicate-identity, stale-latest/no-fallback, and blocked-egress scenarios. Use fixed canonical package bytes and independently computed expected hashes.

## Minor Findings

- MINOR-1: Clarify that fixture ingestion accepts only positive canonical zero; any negative-zero normalization occurs before package creation, never during loading.
- MINOR-2: Constrain `YYYY.MM.PATCH` to a valid month `01` through `12` and complete calendar grammar.
- MINOR-3: Add DEC-013 custody/no-self-approval and REV-019 inventory-boundary traceability. Keep registry and inventory pending while this review is FAIL.

## Nit

- NIT-1: Add the missing space before the closing delimiter in the quarantined `PT-FIX-001G` example row.

## Candidate Classification

The required corrections close or change governed package content, provenance verification, selection order, identity, and error semantics. Under the candidate's invalidation rule they require `1.0.0-candidate.2`, a CT-ANA impact assessment, repeated Team Lead custody, and later independent verification. Candidate.1 remains historical and not acceptance-ready.

## Disposition Required

Workspace Owner disposition is required before remediation or deferral. Recommended disposition: approve MAJOR-1..6, MINOR-1..3, and NIT-1 and authorize publication of `1.0.0-candidate.2` for re-review.

## Workspace Owner Disposition and Recheck

The Workspace Owner approved MAJOR-1..6, MINOR-1..3, and NIT-1 and authorized `1.0.0-candidate.2` on 2026-09-11. Candidate.2 closed the manifest/hash domain, added governed raw-source objects, ordered temporal selection before DQ evaluation, completed economic replay semantics, fixed deterministic error precedence, expanded `PT-FIX-001A..O`, clarified positive zero and dataset-version grammar, added traceability, and corrected NIT-1.

The first recheck closed five Major, all three Minor, and NIT-1 but retained MAJOR-1 because a later coverage-order sentence used nonexistent singular date fields. The approved MAJOR-1 remediation was corrected locally to match the closed coverage schemas. Final Team Lead recheck: PASS with 0 unresolved Critical and 0 unresolved Major. All four golden vectors recomputed exactly and the 15 scenario identifiers remained unique.

The Workspace Owner approved new NIT-2 on 2026-09-11, and the spacing before the closing table delimiter in the precision-overflow `PT-FIX-001F` example is corrected. No REV-020 finding remains unresolved. Independent verification remains pending and separate from this custody PASS.

## Preserved Boundaries

The fixture contract remains planning-only and inactive. `v1.0.0-prototype.1` and aggregate `v1.0.0` remain inactive; #21 remains open; Proposed architecture remains Proposed. This review does not authorize implementation, dependencies, network/provider access, API/store work, migration, baseline activation, parallel execution, deployment, or Ring 2 advancement. Provider, API, store, and stream guards remain BLOCKED.
