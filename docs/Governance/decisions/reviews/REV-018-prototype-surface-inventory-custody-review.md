# REV-018 - Prototype Surface Inventory Custody Review

**Date:** 2026-09-11
**Artifact:** `docs/Planning/contracts/prototype-surface-inventory.md` `1.0.0-candidate.1`
**Reviewer:** Team Lead / contract custodian
**Review model:** Claude Opus 5 (alternate to the producing model)
**Verdict:** IMPROVEMENTS IDENTIFIED
**Critical findings:** 0
**Major findings:** 4
**Minor findings:** 6
**Nits:** 2

## Review Summary

All eight minimum surface categories are non-vacuous, every implemented state is truthfully `No`, every planned surface resolves to an existing candidate or fixed pending path, and all guard statuses are honest. The durable event/handoff absence is accepted as justified for prototype planning, subject to two corrections. The inventory may stand as a candidate #21 execution artifact but is not yet closure-grade or independently verified.

## Major Findings

| ID | Finding | Required correction |
| --- | --- | --- |
| MAJ-1 | API/PostgreSQL absence lacks its deviation-authority path in the durable inventory. | Name Workspace Owner authority and O-REQ-001/O-CST-007/O-REQ-009/O-MET-008 in the surface rows and guard blockers. |
| MAJ-2 | The event absence does not reconcile with the Proposed C4 Job/outbox coordinator and Projection worker. | Name the deferred containers and state that exclusion selects a prototype slice without changing Proposed architecture. |
| MAJ-3 | Storage/application boundaries do not explicitly carry resumability, job failure visibility, and readiness floors. | Bind O-REQ-003, O-REQ-007, O-MET-006, and O-MET-008 behavior to those pending contracts and state event absence does not relieve them. |
| MAJ-4 | Re-evaluation triggers name only `src/` and `tests/`, allowing surfaces from other executable/deployable paths to escape. | Trigger on any executable or deployable artifact introducing or changing a surface, regardless of path. |

## Minor Findings

- MIN-1: use full fixed repository-relative contract paths.
- MIN-2: cite specific domain/order and ledger review dispositions instead of unsourced reviewed-candidate wording.
- MIN-3: define the three `PT-CONTRACT-001` legs where the check is introduced.
- MIN-4: repeat guard failure/promotion consequences for provider, streams, upgrade, and events.
- MIN-5: add the custody/co-signature rule, publication change-log entry, and registry synchronization.
- MIN-6: re-evaluate on accepted/changed architecture or ADR and invalidation of DEC-021/DEC-022.

## Nits

- NIT-1: use one qualification convention for every PASS guard status.
- NIT-2: record the inventory's versioning rule in the registry.

## Event Absence Disposition

**Accepted as justified for prototype planning - conditional.** No outbox, queue, scheduled worker, or delayed cross-process/transaction consumer is planned. Persisted job status remains a storage/application obligation. Any durable delayed handoff promotes `event-catalog.md`, `CT-EVT-001`, storage coverage, inventory update, and re-review. MAJ-2 and MAJ-3 must close before #21 closure.

## Required Disposition

On 2026-09-11, the Workspace Owner approved remediation of MAJ-1 through MAJ-4, MIN-1 through MIN-6, and NIT-1 through NIT-2. The inventory now carries Objective deviation authority, reconciles deferred C4 workers, binds job/resumability/failure/readiness floors, uses path-independent re-evaluation, resolves full fixed paths and review dispositions, defines `PT-CONTRACT-001` legs, repeats guard consequences, records publication governance, and uses consistent qualified statuses.

**Remediation status:** Complete.

## Final Custody Recheck

**Verdict:** PASS
**New Critical findings:** 0
**New Major findings:** 0

MAJ-1 through MAJ-4, MIN-1 through MIN-6, and NIT-1 through NIT-2 are closed. Team Lead custody accepts inventory `1.0.0-candidate.1` as a reviewed candidate #21 execution artifact. The guarded durable event/handoff absence is accepted for the prototype slice. Independent alternate-model inventory verification remains pending, and the blocked API/store/provider/stream guards remain #21 closure work.

## Preserved Boundaries

Baseline `v1.0.0` remains Building and inactive; `v1.0.0-prototype.1` remains an inactive planning candidate. Proposed architecture remains Proposed. Full REV-014 remains FAIL; #57-#62 remain open and unwaived. Parallel execution and Ring 2 remain blocked. No implementation, dependency installation, migration, baseline activation, architecture acceptance, deployment, or gate advancement authority follows.
