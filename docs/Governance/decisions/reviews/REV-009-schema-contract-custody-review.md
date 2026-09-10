# REV-009: Schema Contract Custody Decision Review

**Date:** 2026-09-10
**Decision:** DEC-013 proposed Team Lead custody with governed escalation
**Reviewer:** Architect Reviewer
**Assigned model:** Claude Opus 5
**Original verdict:** IMPROVEMENTS IDENTIFIED
**Remediation recheck:** APPROVED

## Conclusion

The selected custody model is architecturally sound in principle, but the appointment cannot be finalized until role independence is confirmed and the accepted governance controls are remediated. Parallel work remains blocked.

## Findings

### Critical

- **AR-C1 - Role validity and independence.** Team Lead is marked active, but its generic agent definition reports to roles absent from Tier 1, while both Team Lead and Solo Orchestrator may be described as the main thread. The Workspace Owner must confirm that contract custody uses a distinct dispatched Team Lead agent and establish the Tier 1 escalation lane: Team Lead to Solo Orchestrator to Workspace Owner. If distinct operation is unavailable, reconsider Solo Orchestrator or Workspace Owner custody.

### Major

- **AR-M1 - Undefined domain ownership.** Map each contract class and MAI-ST stream to active reviewer roles.
- **AR-M2 - Conflict of interest.** Add no-self-approval, recusal/co-signature, and measurable detection triggers when custody conflicts with schedule/stream ownership.
- **AR-M3 - Change classification.** Define patch/additive/breaking criteria per contract class; disputed or unclassifiable changes default to breaking.
- **AR-M4 - Compatibility evidence.** Name OpenAPI, migration, event, and ledger checks and bind them to planned CI gates and test identifiers before Ring 2.
- **AR-M5 - Canonical floor conformance.** Require a DEC-011 conformance assertion for every change regardless of technical compatibility; suspected floor impact routes to the Workspace Owner.
- **AR-M6 - Continuity and deadlock.** Define acting custody, retro-review, tie-break, turnaround expectations, and revert-only emergency handling.
- **AR-M7 - Detectable invalidation.** Stamp consuming work with baseline version; publish affected-stream notices; require acknowledgement and green checks before re-baselining completes.

### Minor

- **AR-N1 - Canonical record.** Add DEC-013 to the decision log only after review disposition.
- **AR-N2 - Lifecycle block.** Record the parallel-work block and release condition in ring status.
- **AR-N3 - Handover event.** Define when accountability transfers from Solo Orchestrator to Team Lead.
- **AR-N4 - Analytics contract.** Add immutable snapshot, rule/parameter versioning, and evidence-hash format to the freeze set.
- **AR-N5 - OpenAPI versioning.** Define version exposure and deprecation/sunset policy.
- **AR-N6 - Freeze versus acceptance.** State that a frozen coordination baseline is not architecture acceptance and later accepted ADRs prevail.
- **AR-N7 - Security lane.** Require Security Reviewer sign-off for redaction, egress, secrets, and raw-data access changes.

### Suggestions

- **AR-S1:** Store contracts at fixed repository paths with an ownership map.
- **AR-S2:** Use a standard contract change-log template.
- **AR-S3:** Re-evaluate custody at the Ring 1 to Ring 2 gate.
- **AR-S4:** Consider an optional custody/versioning ADR at the applicable human gate.

## Strengths

- The four-way responsibility split separates custody, domain correctness, governance verification, and human authority.
- Breaking-change and ADR authority remains human.
- The baseline preserves DEC-011 canonical floors and blocks parallel work pending evidence.
- The model is appropriately lightweight for Tier 1 once the control gaps are closed.

## Required Disposition

The Workspace Owner completed disposition on 2026-09-10:

- AR-C1: confirmed distinct dispatched Team Lead operation and accepted the Tier 1 escalation lane.
- AR-M1, AR-M4, AR-M6, AR-M7: accepted.
- AR-M2, AR-M3, AR-M5: initially rejected, then accepted at their required minimum after the governance conflict was presented.
- AR-N1 through AR-N5: accepted.
- AR-N6, AR-N7, and AR-S1 through AR-S3: accepted.
- AR-S4: deferred; no custody/versioning ADR is created or accepted by this disposition.

**Post-disposition status:** Appointment governance may be finalized after remediation validation. Parallel work remains blocked until baseline `v1.0.0` is populated, reviewed, acknowledged, and separately released by the Workspace Owner.

## Remediation Recheck

**Result:** APPROVED
**Scope:** Team Lead appointment and custody governance only
**Reviewer:** Architect Reviewer, focused read-only recheck
**Date:** 2026-09-10

| Findings | Result |
| --- | --- |
| AR-C1 | Closed - distinct Team Lead and valid Tier 1 escalation evidenced |
| AR-M1 through AR-M7 | Closed - ownership, conflict, classification, CI evidence, canonical-floor, continuity, and invalidation controls evidenced |
| AR-N1 through AR-N7 | Closed - canonical record, status, handover, analytics/OpenAPI contracts, architecture boundary, and security lane evidenced |
| AR-S1 through AR-S3 | Closed - fixed paths, change-log schema, and custody recheck evidenced |
| AR-S4 | Deferred by Workspace Owner; non-blocking optional ADR |

No critical, major, or minor appointment-governance defect remains. DEC-013 may remain finalized. This approval does not populate or freeze baseline `v1.0.0`, release MAI-ST parallel work, accept architecture or an ADR, authorize implementation, or authorize deployment.
