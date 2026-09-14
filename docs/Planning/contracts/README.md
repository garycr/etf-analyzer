# Contract Baseline Registry

**Custodian:** Team Lead (distinct dispatched agent)
**Governance verifier:** Solo Orchestrator
**Breaking-change authority:** Workspace Owner
**Current active baseline:** None
**Candidate baseline:** `v1.0.0` - Building
**Prototype candidate:** `v1.0.0-prototype.1` - Planning, inactive
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
| Prototype surface inventory | `docs/Planning/contracts/prototype-surface-inventory.md` | #21 | `1.0.0-candidate.3`; REV-018/019 preserve initial review, REV-026 synchronizes application/PostgreSQL, and REV-027 synchronizes OpenAPI; all eight minimum categories inventoried |
| Fixture input | `docs/Planning/contracts/fixture-contract.md` | #17, #21 | `1.0.0-candidate.2` REV-020 Team Lead custody PASS and REV-021 independent alternate-role PASS; `PT-FIX-001A..O` design-time plan; Ring 2 execution pending |
| Application boundary | `docs/Planning/contracts/application-contract.md` | #21, #22 | `1.0.0-candidate.2` Team Lead custody PASS and REV-026 independent PASS; REV-022/023 preserve candidate.1 history; `PT-APP-001A..P` design-time plan; Ring 2 execution pending |
| REST/OpenAPI | `docs/Planning/contracts/openapi-contract.yaml` | #14, #17, #21, #22 | `1.0.0-candidate.2` Team Lead custody and REV-027 independent alternate-model PASS; exactly `CT-API-001A..L`; Ring 2 executable conformance pending |
| Durable storage / PostgreSQL | `docs/Planning/contracts/postgresql-contract.md` | #15, #17, #20, #9 | `1.0.0-candidate.2` final Team Lead custody PASS and REV-026 independent PASS; `CT-DB-001A..L` design-time plan; Ring 2 SQL/hashes/execution pending |
| Outbox/events | `docs/Planning/contracts/event-catalog.md` | #14, #15, #17, #20 | Guarded; required only if a durable delayed handoff crosses a process or transaction boundary |
| Analytics snapshot/evidence | `docs/Planning/contracts/analytics-evidence-contract.md` | #15, #11 | Prototype-scoped planning complete under DEC-021; #11/#15/#65 closed; candidate `1.0.0-candidate.2` remains a reviewed intermediate; full REV-014 Test Review FAIL; #57-#62 remain open |
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
| Prototype surface inventory | Candidate; custody and independent verification complete | `1.0.0-candidate.3`; REV-018/019 preserve initial review; REV-026 and REV-027 synchronization applied; `PT-CONTRACT-001` planning-completeness leg PASS only |
| Fixture input contract | Complete for design-time resolution | Candidate `1.0.0-candidate.2`; closed identity/hash, vintage/order, DEC-014 decimal, verifiable provenance, DQ suppression, and `PT-FIX-001A..O`; executable Ring 2 evidence pending |
| Application boundary contract | Complete for design-time resolution | Candidate `1.0.0-candidate.2`; closed 9-command/7-query catalog, owner-preserving evidence identity, operation schemas, replay/jobs/readiness/errors/display/redaction/recovery, and `PT-APP-001A..P`; Team Lead custody and REV-026 independent PASS; executable Ring 2 evidence pending |
| REST/OpenAPI contract | Complete for design-time resolution | Candidate `1.0.0-candidate.2`; closed 16-operation loopback surface, exact status/error/owner/warning semantics, structured conformance profile, and `CT-API-001A..L`; REV-027 custody and independent PASS; executable Ring 2 evidence pending |
| Durable storage / PostgreSQL contract | Complete for design-time resolution | Candidate `1.0.0-candidate.2`; native PostgreSQL 16 bootstrap, closed physical/authority manifest, complete readers, and `CT-DB-001A..L`; Team Lead custody and REV-026 independent PASS; Ring 2 SQL/hashes/execution pending |
| Event catalog | Guarded | Required only when `PT-CONTRACT-SCOPE-EVENTS` detects a durable delayed handoff |
| Analytics snapshot/evidence contract | Complete for prototype planning | DEC-021; #11/#15/#65 closed; candidate `1.0.0-candidate.2`; CC-002 digest `1023a5b416d4fb42c76b47b6b3deab5bb1a74612711a00159b5a4b4ce2b9c831`; full REV-014 FAIL; #57-#62 remain open |
| Planned compatibility test IDs linked to test strategy | Complete for design-time allocation | Unconditional `PT-CONTRACT-001`, fixture conformance, CT-LED-001..019, prototype CT-ANA allocation, `CT-DB-001A..L`, and `CT-API-001A..L`; CT-DB-002/CT-EVT-001 guard-triggered |
| DEC-011 floor conformance | Pending | Required per contract and aggregate baseline |
| Affected stream acknowledgements | Guarded | Required before a second concurrent contract consumer or parallel-work release |
| Workspace Owner block release | Pending | Separate human decision after evidence review |

## Consumption Rule

Every WBS item, pull request, migration, and contract test must state the baseline version it targets. Until `v1.0.0` becomes active, no MAI-ST parallel execution may claim a frozen contract.

## Inventory Versioning Rule

The prototype surface inventory uses semantic candidate versions. Documentation-only corrections that do not change a surface are patch changes; adding an optional guarded surface is additive minor; adding, removing, reclassifying, or changing the meaning, contract binding, guard, or justified absence of a required surface is breaking and requires a new candidate plus custody and independent re-review. Any disputed classification defaults to breaking.

## Architecture Boundary

A frozen baseline coordinates implementation; it does not accept architecture. Accepted ADRs and canonical human decisions take precedence and require the custodian to re-baseline when they conflict.
