# REV-022 - Application Boundary Contract Custody Review

**Date:** 2026-09-11
**Review type:** Distinct Team Lead custody review; not independent verification
**Artifacts:** `docs/Planning/contracts/application-contract.md` `1.0.0-candidate.1`; `specs/features/Application-Boundary-Conformance.feature`
**Reviewer:** Team Lead, distinct from originator
**Initial verdict:** FAIL
**Final recheck verdict:** PASS
**Critical findings:** 0
**Major findings:** 7
**Minor findings:** 2
**Nits:** 0
**Unresolved Critical/Major after recheck:** 0/0

## Summary

The 9-command/7-query catalog is appropriately bounded and not overbroad. Explicit confirmation, one-transition dispatch, failed-versus-zero-row behavior, readiness separation, exact research warning, transport/storage independence, event absence, and planning-only authority boundaries pass as written. Candidate.1 is not custody-ready because its per-operation schemas, replay semantics, job lifecycle, error ordering, redaction failure, recovery behavior, and timestamp-role presentation are not closed enough for deterministic implementation and testing.

## Major Findings

### MAJOR-1 - Closed operation schemas are absent

The common request refers to operation-specific payloads and results that are not structurally defined. Missing, duplicate, and unknown members; nullability; collection order; owner identity; owning errors; and allowed effects therefore cannot be tested deterministically.

**Required correction:** Define exact payload and success-data schemas for all 16 operations, including required/nullable fields, ordering, owning identities/errors, and side effects. Reject malformed closed records with a controlling code. Add one valid and one malformed payload vector per operation.

### MAJOR-2 - Application and owning idempotency are ambiguous

The application replay key, canonical equivalence, lookup order, and interaction with owning idempotency are not deterministic.

**Required correction:** Define replay key `(operation, commandId)`; canonical content as RFC 8785 JSON of operation, actor, candidate, contract version, and complete payload excluding request/trace/time; lookup after grammar/authorization and before readiness/owner dispatch; equivalent replay returns original, conflict returns `APPLICATION_IDEMPOTENCY_CONFLICT`, and a new application key never bypasses owning idempotency. Add direct vectors.

### MAJOR-3 - Durable job lifecycle is not closed

`Canceled` has no operation or internal cause; attempts/checkpoints/job types/restartability are open; the restart scenario omits normative Failed/Restartable preconditions.

**Required correction:** Remove `Canceled`; define closed job type and restartability enums, attempt number, checkpoint identity, and legal transitions. Make restart require Failed/Restartable, retain job/input identities, increment attempt, and reject non-restartable jobs without adding queue/event scope.

### MAJOR-4 - Error precedence is not deterministic or adequately tested

Grouped validation phases lack numeric ordering and deterministic tie-breaking; key application and owning errors are not directly asserted.

**Required correction:** Define numeric precedence for operation parsing, envelope grammar, authorization, application replay, readiness/admission, owner precedence, persistence, and redaction; add deterministic tie-breaking and collision vectors plus direct application/owner error assertions.

### MAJOR-5 - Fail-closed redaction is untested

Prohibited-field removal is tested, but unclassifiable content and `APPLICATION_REDACTION_FAILED` are not.

**Required correction:** Add a redaction-classification failure scenario asserting no export/bundle, no leak in logs/traces/presentation, and only stable code plus bounded correlation metadata.

### MAJOR-6 - Recovery contradicts restartability and omits focus behavior

Every Failed job currently offers Retry even when not restartable. Processing/failure/success focus, keyboard/pointer equivalence, non-activation by focus/announcement, and unchanged-state announcement suppression are not tested.

**Required correction:** Split restartable and non-restartable failures; add explicit focus lifecycle, equivalent activation, no implicit activation, and repeated-state assertions. Exercise keyboard confirmation and exactly one OT-02 command.

### MAJOR-7 - Timestamp-role presentation is incomplete

The contract does not visibly/programmatically distinguish trade date, source timestamp, retrieval timestamp, completion timestamp, and display timezone under O-ACC-002.

**Required correction:** Add all five semantic display classes to the contract and `PT-APP-001I`, preserving canonical UTC and explicitly identifying display timezone UTC.

## Minor Findings

### MINOR-1 - Warning presentation metadata is underspecified

Bind `researchWarningRequired = true` and exact `warningText` for analytical result, evidence, and paper-action presentations; define exact non-applicable values elsewhere.

### MINOR-2 - Design-time quality score is overstated

Current defensible scores are `5/5/4/5/3/5/4`, weighted 4.53/5.0, Excellent. Record 4.53 until missing vectors are added, then rescore; Ring 2 executable assessment remains separate.

## Candidate Classification

`1.0.0-candidate.1` may remain during remediation because it is inactive, has not passed custody or independent review, has no consumer, and the corrections preserve the existing 9-command/7-query surface. Any added operation, durable handoff, event scope, or materially changed owner semantics requires reclassification.

## Disposition Required

Workspace Owner disposition is required before remediation or deferral. Recommended: approve MAJOR-1..7 and MINOR-1..2 while retaining candidate.1 for recheck.

## Workspace Owner Disposition

**Decision:** Approved MAJOR-1..7 and MINOR-1..2 for remediation; retain `1.0.0-candidate.1` for custody recheck.
**Policy:** Human-in-the-Loop finding disposition, DEC-013 custody separation, and REV-022 candidate classification.
**Authority:** Workspace Owner approval in the governed session.
**Accountability:** Originating agent remediates test-first; Team Lead rechecks every finding; an alternate role independently verifies only after custody PASS.

This approval authorizes only the corrections stated in REV-022. It does not change the preserved boundaries below.

## Team Lead Recheck

The first recheck closed MAJOR-3, MAJOR-5, MAJOR-6, MAJOR-7, and MINOR-1. It retained MAJOR-1, MAJOR-2, MAJOR-4, and MINOR-2 because the first remediation used schematic rather than literal payload/replay/collision vectors and omitted the exact `Readiness` record.

The approved findings were remediated again without changing the 9-command/7-query surface. Candidate.1 now pins owner schema candidates, defines exact `Readiness` and `ReadinessDependency` records, supplies 16 literal valid/malformed payload vectors, supplies concrete RFC 8785 equivalent/application-conflict/owner-conflict vectors, and supplies eight numeric collision vectors including a same-rank winner. The post-vector test-quality score is `5/5/4/5/5/5/5`, 4.86/5.0, Excellent.

Final Team Lead recheck: PASS with 0 unresolved Critical, Major, Minor, or regression findings. All MAJOR-1..7 and MINOR-1..2 are CLOSED. Independent alternate-role verification remains separate and pending.

## Preserved Boundaries

The initial FAIL and final custody PASS do not authorize implementation, dependencies, HTTP or PostgreSQL design, event scope, architecture acceptance, baseline activation, parallel work, deployment, Ring 2 advancement, or #21 closure. API, STORE, PROVIDER, and STREAMS guards remain BLOCKED. Full REV-014 remains FAIL and #57-#62 remain open.
