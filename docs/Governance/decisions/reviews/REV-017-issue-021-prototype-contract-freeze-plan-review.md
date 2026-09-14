# REV-017 - Issue 21 Prototype Contract Freeze Plan Review

**Date:** 2026-09-11
**Decision:** DEC-022 prototype contract-surface freeze
**Reviewer:** Plan Reviewer
**Review model:** Claude Opus 5 (alternate to the producing model)
**Verdict:** IMPROVEMENTS IDENTIFIED
**Overall score:** 3 / 5

## Review Summary

The inventory-plus-guard mechanism correctly limits contract work to the prototype's actual blast radius while preserving custody, DEC-011 floors, version binding, review, and no-self-approval. The current draft is not ready to become the live #21 acceptance definition because four Critical gaps could permit vacuous closure or silently conditionalize canonical Objective floors.

## Critical Findings

| ID | Finding | Required correction |
| --- | --- | --- |
| C-1 | Treating HTTP API and PostgreSQL as optional conflicts with O-REQ-001, O-CST-007, O-REQ-009, O-MET-008, and DEC-011 without a recorded deviation path. | State that API and database are expected; absence requires explicit Workspace Owner scope disposition before #21 closure. |
| C-2 | The local fixture input format is an unconditional external contract but has no freeze requirement. | Require a versioned fixture contract covering identities, timestamps/vintages, revision order, decimal grammar, provenance/DQ, and a conformance check. |
| C-3 | The database guard is PostgreSQL-specific and could leave another durable store contract-free. | Make the predicate behavior-based for any durable store; apply PostgreSQL/migration requirements when PostgreSQL is selected. |
| C-4 | The surface inventory lacks a fixed path, owner, minimum bound, failure consequence, and implementation-time recheck. | Publish a Team Lead-owned inventory at a fixed path; enumerate or justify absence of domain/order, ledger, analytics, fixtures, durable storage, application, API, and event surfaces; block merge and re-review on drift. |

## Major Findings

| ID | Finding | Required correction |
| --- | --- | --- |
| M-1 | No unconditional in-process application/UI boundary contract. | Cover commands/queries, stable errors, displayed formats, redaction, and accessible recovery regardless of transport. |
| M-2 | Prototype baseline identity is undefined. | Name a non-active prototype candidate identity and its relationship to aggregate `v1.0.0`. |
| M-3 | The contract registry contradicts DEC-022. | Make registry synchronization and a custodian change-log entry closure criteria. |
| M-4 | Guard evaluation cadence is undefined. | Evaluate at freeze review, on every contract/inventory change, and at the Ring 1 to Ring 2 gate. |
| M-5 | The API guard permits an unversioned HTTP endpoint. | Trigger on any process-crossing request/response interface; absent versioning is a defect, not a pass. |
| M-6 | The event predicate is ambiguous for jobs and durable handoffs. | Trigger the event contract on durable delayed cross-process/transaction handoff; ensure job/queue tables trigger storage coverage. |

## Minor Findings

- Mi-1: broaden upgrade compatibility to API, fixture, evidence, and storage formats and recheck on first baseline activation.
- Mi-2: name deterministic evidence that outbound provider egress is disabled.
- Mi-3: define how and when the one-sequential-stream condition is verified.
- Mi-4: align analytics authority to DEC-021 and point to the #65 guard-to-issue mapping.
- Mi-5: name review roles, evidence location, no-self-approval, and custodian-originator co-signature.
- Mi-6: state explicitly that full REV-014 remains FAIL and #57-#62 remain open and unwaived.
- Mi-7: assign an executable check identifier asserting inventory-to-implemented-surface agreement.

## Suggestions

- S-1: explain that the Proposed C4 view remains the target while guards determine prototype contract obligations.
- S-2: distinguish speculative deferrals from conditional-but-likely HTTP API, PostgreSQL, and migration work.

## Disposition Required

On 2026-09-11, the Workspace Owner approved remediation of C-1 through C-4, M-1 through M-6, Mi-1 through Mi-7, and S-1 through S-2. The corrected acceptance artifact makes API and PostgreSQL expected canonical surfaces with an explicit deviation path; adds unconditional fixture, durable-storage, and application-boundary contracts; fixes and minimum-bounds the surface inventory; defines `v1.0.0-prototype.1`; synchronizes registry/change governance; and gives every guard deterministic evidence, cadence, and promotion behavior.

**Remediation status:** Complete.

## Final Recheck

**Verdict:** PASS
**Reviewer:** Independent Plan Reviewer using Claude Opus 5
**New Critical findings:** 0
**New Major findings:** 0

C-1 through C-4, M-1 through M-6, Mi-1 through Mi-7, and S-1 through S-2 are closed. The reviewer confirmed the canonical browser/API/PostgreSQL expectations and deviation paths; unconditional fixture, durable-store, and application contracts; fixed minimum-bounded inventory and `PT-CONTRACT-001`; inactive `v1.0.0-prototype.1` identity; registry and CC-003 synchronization; guard predicates and cadence; named reviews and no-self-approval; unwaived debt; and the C4/deferred-work clarifications.

One non-blocking wording remnant in DEC-022 Consequences and Assumptions was aligned after the recheck to state that API and PostgreSQL are expected canonical surfaces whose absence requires explicit Workspace Owner deviation. The live #21 criteria may now be updated to the corrected acceptance definition. #21 execution and closure evidence remain pending.

## Preserved Boundaries

Baseline `v1.0.0` remains Building and inactive. Proposed architecture remains Proposed. Parallel execution remains blocked. Ring 2 remains unauthorized. DEC-013 custody and change controls remain active. Full REV-014 remains FAIL; #57-#62 remain open and unwaived; analytics candidate.2 remains a reviewed intermediate. No implementation, dependency installation, architecture acceptance, baseline activation, release, or deployment authority follows.
