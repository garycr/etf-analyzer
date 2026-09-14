# REV-023 - Application Contract Independent Verification

**Date:** 2026-09-11
**Review type:** Independent alternate-role contract verification
**Artifacts:** `docs/Planning/contracts/application-contract.md` `1.0.0-candidate.1`; `specs/features/Application-Boundary-Conformance.feature`; REV-022 final custody PASS
**Reviewer:** Architect Reviewer, distinct from originator and Team Lead custodian
**Initial verdict:** FAIL
**Final recheck verdict:** PASS
**Critical findings:** 0
**Major findings:** 5
**Minor findings:** 1
**Suggestions:** 0
**Model provenance:** Runtime model provenance was not exposed; this review does not claim alternate-model status

## Verification Summary

The 9-command/7-query catalog, four-state job lifecycle, owner stable-code preservation, canonical decimal/status/timestamp presentation, exact research warning, fail-closed redaction, and unique `PT-APP-001A..P` identifiers pass. Candidate.1 is not independently verified because imported owner records and transition mapping, RFC 8785 replay bytes, defect-derived error precedence, readiness coverage, and recovery records are not deterministic enough for independent implementation.

## Major Findings

### MAJOR-1 - Delegated schemas are not closed

`OrderSide`, `OrderTransition`, `Quantity`, `UnitPrice`, `PaperOrder`, `Portfolio`, `AnalyticsResult`, and `Evidence` are named but not normatively imported as closed types. The mapping from the application transition payload to the fuller domain transition command is unspecified.

**Required correction:** Normatively import every referenced closed owner type by reviewed candidate and define the authority-preserving transition-command mapping without changing owner fields, meanings, ordering, versions, or errors.

### MAJOR-2 - RFC 8785 replay vectors are descriptive

`PT-APP-001N` names included/excluded fields but lacks complete literal original, equivalent, application-conflict, and owner-conflict requests plus exact expected RFC 8785 serialization.

**Required correction:** Add complete JSON vectors, exact canonical text/bytes, lookup-order assertions, and the unchanged owning conflict.

### MAJOR-3 - Error-precedence vectors assume ranks

`PT-APP-001O` supplies ranks rather than deriving them from concrete simultaneous defects. It places `APPLICATION_DEPENDENCY_UNAVAILABLE` at persistence rank 70 despite its readiness use, and does not directly test owner tie delegation or invalid/absent operation/request-ID fallbacks.

**Required correction:** Use concrete defects that derive phases, clarify code-to-phase use, and cover owner tie delegation and the complete `(operation, requestId, code)` fallback.

### MAJOR-4 - Readiness coverage is incomplete

The closed readiness schema has six dependencies, but `PT-APP-001F` omits `LocalDependency` and `LedgerIntegrity`. Liveness orthogonality, dependency order, and the explicit provider-rights, fixture-freshness, analytical-validity, evidence-completeness, ledger-reconciliation, and release-readiness non-claims are not directly tested.

**Required correction:** Add all dependency/control vectors, both liveness values independent of readiness, deterministic ordering, and every non-claim.

### MAJOR-5 - Recovery records are not deterministic

The five-field recovery schema lacks exact per-state values. `InputQuarantined` and `IntegrityBlocked` do not determine a catalog target operation, and tests omit `actionId`, `focusTarget`, and `requiresConfirmation`.

**Required correction:** Define and test the exact recovery record or explicit null/escalation for every listed blocked state, including confirmation requirements.

## Minor Finding

### MINOR-1 - Mutable records are stale

Candidate status/checklist and inventory do not show REV-022 custody PASS, while the original preserved-boundary text still says “This FAIL.”

**Required correction:** Synchronize custody status and wording after substantive findings are resolved and rechecked. Keep independent verification pending until REV-023 passes.

## Verified Results

- Exactly 9 commands and 7 queries; operation names are closed and case-sensitive.
- Every operation has one literal valid and malformed payload row.
- Job types, statuses, restartability, attempts, checkpoints, transitions, and no-event boundary are closed.
- Owner versions and stable error families align with the reviewed candidates.
- Decimal scales, statuses, and all five semantic timestamp/date roles are present.
- Warning metadata and fail-closed redaction are exact.
- `PT-APP-001A..P` identifiers are complete and unique.
- Score arithmetic is numerically correct at 4.86/5.0, but coverage is not independently accepted while Major findings remain.

## Disposition Required

Workspace Owner disposition is required before remediation or deferral. Recommended: approve MAJOR-1..5 and MINOR-1 while retaining `1.0.0-candidate.1`; the findings close existing semantics and do not add an operation, owner, durable handoff, or event surface.

## Workspace Owner Disposition

**Decision:** Approved MAJOR-1..5 and MINOR-1 for remediation; retain `1.0.0-candidate.1`.
**Policy:** Human-in-the-Loop finding disposition, DEC-013 review separation, and REV-023 candidate classification.
**Authority:** Workspace Owner approval in the governed session.
**Accountability:** Originating agent remediates test-first; Team Lead rechecks substantive changes; Architect Reviewer repeats independent verification afterward.

This approval authorizes only the stated corrections and later mutable-record synchronization after substantive review PASS. It does not alter the preserved boundaries below.

## Recheck and Finding Closure

The first Team Lead recheck closed MAJOR-1..4 and retained MAJOR-5 for missing literal target-payload and null-recovery vectors. Approved MAJOR-5 remediation added seven exact bounded target payloads, deterministic OT-02 transition identity/version sources, and concrete missing-identity, access-denied, and no-safe-operation null cases. Final Team Lead substantive recheck passed with 0 unresolved Critical or Major findings.

The repeated independent Architect Reviewer verification passed with 0 Critical, 0 Major, 1 expected non-blocking Minor, and 0 Suggestions. MAJOR-1..5 are CLOSED. MINOR-1 is CLOSED by synchronizing candidate status/checklist, inventory, registry, CC-006, review records, and the journal. Candidate.1 is independently verified at the alternate-role level; runtime model provenance remains unexposed, so no alternate-model claim is made.

## Preserved Boundaries

The initial FAIL and final alternate-role PASS do not authorize implementation, dependencies, HTTP or PostgreSQL design, event scope, architecture acceptance, baseline activation, parallel work, deployment, Ring 2 advancement, guard unblocking, or #21 closure. API, STORE, PROVIDER, and STREAMS guards remain BLOCKED. Alternate-model provenance remains unproven.
