# Contract Baseline Registry

**Custodian:** Team Lead (distinct dispatched agent)
**Governance verifier:** Solo Orchestrator
**Breaking-change authority:** Workspace Owner
**Current active baseline:** None
**Candidate baseline:** `v1.0.0` - Building
**Parallel execution:** Blocked until separate Workspace Owner release

## Custody Acknowledgement

**Status:** Acknowledged by distinct dispatched Team Lead on 2026-09-10.
**Acknowledgement:** As the distinct dispatched Tier 1 Team Lead, I acknowledge schema contract custody under DEC-013 and accept no-self-approval, default-to-breaking classification for disputed or unclassifiable changes, a DEC-011 floor assertion for every change, all named specialist reviews and CT-API-001, CT-DB-001, CT-DB-002, CT-EVT-001, CT-LED-001, and CT-ANA-001 checks, escalation first to the Solo Orchestrator and then the Workspace Owner, and the block on parallel work until the complete `v1.0.0` candidate is separately released by the Workspace Owner.

## Purpose

This directory is the fixed, reviewable home for contracts consumed by MAI-ST parallel work. A baseline becomes active only after every required artifact is populated, specialist and compatibility evidence is linked, affected streams acknowledge the same version, and the Workspace Owner releases the block.

## Fixed Artifact Paths

| Contract class | Fixed path | Source issue | Status |
| --- | --- | --- | --- |
| Domain, order, and ledger | `docs/Planning/contracts/domain-contract.md`; `docs/Planning/contracts/ledger-contract.md` | #14, #20, #9 | Order lifecycle `1.0.0-candidate.1` and ledger/precision `1.0.0-candidate.2` passed required reviews; all three source issues completed; aggregate baseline integration pending |
| Immutable FIFO ledger and reconciliation | `docs/Planning/contracts/ledger-contract.md`; detached digest `docs/Planning/contracts/evidence/CC-001-ledger-candidate-delta.md` | #20, #9 | Complete at design-time; ledger-security architecture accepted at DP-33; Ring 2 executable evidence remains mandatory |
| REST/OpenAPI | `docs/Planning/contracts/openapi-contract.yaml` | #14, #17, #22 | Awaiting Ring 1 definition |
| PostgreSQL schema/migrations | `docs/Planning/contracts/postgresql-contract.md` | #15, #17, #20, #9 | Awaiting Ring 1 definition |
| Outbox/events | `docs/Planning/contracts/event-catalog.md` | #14, #15, #17, #20 | Awaiting Ring 1 definition |
| Analytics snapshot/evidence | `docs/Planning/contracts/analytics-evidence-contract.md` | #15, #11 | Candidate `1.0.0-candidate.2`; scoped M1-M6/M12/M14 and R-1..R-5 rechecks PASS; full REV-014 Test Review FAIL; #57-#62 post-prototype work remains open; #65 pending |
| Ownership and baseline registry | `docs/Planning/contracts/README.md` | #21 | Active governance record |
| Contract change log | `docs/Planning/contracts/change-log.md` | #21 | Active governance record |

Paths marked awaiting definition are reserved but intentionally not populated with stubs. Their owning Ring 1 issues must produce working, reviewed content.

## Ownership Map

| Contract class | Custody/correctness accountability | Required reviewers |
| --- | --- | --- |
| Domain/order/ledger | Team Lead | Code Reviewer; Test Reviewer |
| REST/OpenAPI | Team Lead | Code Reviewer; UI/UX Designer or Test Reviewer for accessibility |
| PostgreSQL | Team Lead | Code Reviewer; Test Reviewer |
| Outbox/events | Team Lead | Code Reviewer; Test Reviewer |
| Provider/security-sensitive fields | Team Lead | Security Reviewer |
| Analytics snapshot/evidence | Team Lead | Code Reviewer; Test Reviewer |

## Candidate Baseline `v1.0.0` Readiness

| Requirement | Status | Evidence |
| --- | --- | --- |
| Human custody model selected | Complete | DEC-013 |
| Alternate-model custody review | Complete | REV-009 |
| Distinct Team Lead acknowledgement | Complete | Custody acknowledgement above; DEC-013 handover complete |
| Domain/order/ledger contract | Complete (design-time) | #14/#20/#9 completed; order and ledger candidates passed required reviews; aggregate baseline integration and Ring 2 executable evidence remain pending |
| REST/OpenAPI contract | Pending | #14, #17, #22 |
| PostgreSQL contract | Pending | #15, #17, #20, #9 |
| Event catalog | Pending | #14, #15, #17, #20 |
| Analytics snapshot/evidence contract | Prototype acceptance pending | Candidate `1.0.0-candidate.2`; CC-002 digest `1023a5b416d4fb42c76b47b6b3deab5bb1a74612711a00159b5a4b4ce2b9c831`; scoped rechecks PASS; full REV-014 FAIL; #65 pending |
| Planned compatibility test IDs linked to test strategy | Pending | CT-API-001, CT-DB-001, CT-DB-002, CT-EVT-001, CT-LED-001..019, CT-ANA-001 |
| DEC-011 floor conformance | Pending | Required per contract and aggregate baseline |
| Affected stream acknowledgements | Pending | Required after complete candidate publication |
| Workspace Owner block release | Pending | Separate human decision after evidence review |

## Consumption Rule

Every WBS item, pull request, migration, and contract test must state the baseline version it targets. Until `v1.0.0` becomes active, no MAI-ST parallel execution may claim a frozen contract.

## Architecture Boundary

A frozen baseline coordinates implementation; it does not accept architecture. Accepted ADRs and canonical human decisions take precedence and require the custodian to re-baseline when they conflict.
