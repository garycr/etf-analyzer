# REV-011 - Ledger Security Architecture Review

**Date:** 2026-09-10
**Decision scope:** GitHub #9/#20 ledger integrity anchor, PostgreSQL authority, atomic append, rebuild gating, and recovery continuity
**Reviewer:** Architect Reviewer
**Verdict:** FAIL initially; PASS on final recheck
**Architecture status:** Accepted by Workspace Owner at DP-33; no ADR accepted and no implementation authorized
**Alternate-model evidence:** Final recheck dispatched as `Claude Opus 5 (copilot)`; this is process attestation, not cryptographic producer-to-reviewer model proof

## Authority

- DEC-011 immutable/reversing FIFO and exact reconciliation floor
- DEC-014 Option A precision, round-half-even, and no-epsilon policy
- `docs/Planning/contracts/ledger-contract.md` final specification custody candidate
- `.github/skills/architecture-review.md`

## Assessment

The ledger contract is sufficiently complete for specification custody, but the Proposed architecture views do not yet allocate the execution, identity, storage, transaction, and recovery boundaries required to implement its HMAC anchor and deny-by-default PostgreSQL controls. The architecture review therefore fails until the six Major findings below are approved for remediation and independently rechecked.

### Well-Architected Framework

| Pillar | Score | Key gap |
| --- | ---: | --- |
| Security | 2/5 | Key custody, signer identity, protected-anchor ownership, and database roles are not modeled |
| Reliability | 2/5 | Anchor-aware restore, rotation continuity, fail-closed rebuild, and recovery sequencing are unresolved |
| Performance Efficiency | 3/5 | HMAC, locking, rebuild paging, and restore capacity need architecture treatment |
| Operational Excellence | 2/5 | Rotation, role provisioning, anchor recovery, and restore procedures are absent |
| Cost Optimization | 4/5 | Local deployment is bounded; protected storage and recovery costs remain unspecified |
| **Overall** | **2.6/5** | Major findings override the numeric score |

### ISO 25010

| Attribute | Score |
| --- | ---: |
| Functional Suitability | 3/5 |
| Performance Efficiency | 3/5 |
| Compatibility | 3/5 |
| Usability | 3/5 |
| Reliability | 2/5 |
| Security | 2/5 |
| Maintainability | 2/5 |
| Portability | 3/5 |
| Safety | 3/5 |

**Weighted Architect score:** 2.56/5 - Adequate. The gate remains FAIL because Reliability, Security, and Maintainability score 2 and Major findings remain open.

## Major Findings

| Finding | Required outcome | GitHub issue |
| --- | --- | --- |
| AR-LED-01 - Integrity-anchor control plane absent | Model HMAC execution, key custody/rotation, protected anchors, caller authority, and denied writer relationships | #24 |
| AR-LED-02 - PostgreSQL authority and deployment identity unallocated | Model service-account/role mappings, non-login ownership, grant matrix, migration elevation, and controlled-writer posture | #26 |
| AR-LED-03 - Atomic append and failed-attempt audit unresolved | Model the complete commit unit, rollback paths, and durable rejection/permission-denial evidence | #25 |
| AR-LED-04 - Fail-closed rebuild/publication gating absent | Model commitment verification, verified paging, publication denial, and integrity signals | #27 |
| AR-LED-05 - Backup/restore cryptographic continuity absent | Define protected backup sets, anti-rollback recovery, RPO/RTO, restore order, and readiness gating | #23 |
| AR-LED-06 - Proposed views conflict with DEC-014 | Remove unresolved precision/tolerance language and apply exact canonical no-epsilon policy | #28 |

Issues are assigned to the Workspace Owner and carry the available `ring:1`, `source:decision-review`, `type:improvement`, and `status:approved` labels. The Workspace Owner approved all six remediation items on 2026-09-10. The required `sev-2/major` and `design-review` labels do not exist in the repository and could not be created with the available toolset; severity and source remain explicit in every issue body.

## Human Disposition

The Workspace Owner approved AR-LED-01 through AR-LED-06 for Ring 1 remediation on 2026-09-10. Approval authorizes updates to the Proposed architecture and subsequent independent review. It does not accept an ADR, approve the resulting architecture, authorize implementation, close #9/#20, freeze the baseline, advance the ring, or release parallel execution.

## ADR Determination

An ADR remains optional under Tier 1 configuration. A Proposed ADR is recommended for the combined signer, key, anchor, role, and recovery design because it is consequential and cross-cutting. No ADR may be described as accepted without separate authority.

## Governance Boundary

This review does not invalidate ledger specification custody. Approved remediation of #23-#28 may proceed, but architecture approval, implementation of the integrity-anchor design, Ring 1 closure, issue #9/#20 closure, baseline freeze, and parallel execution remain blocked. A verifiably alternate-model Architect Reviewer recheck is required before the decision-review gate can close.

## Final Recheck

**Candidate:** `1.0.0-candidate.2`, SHA-256 `0e223c5d4e4af1a1cd42cd9dbd8e2275f90b1904efd6eaa68555e7ad7dd376e2`
**Reviewer:** Architect Reviewer, dispatched as `Claude Opus 5 (copilot)`
**Result:** PASS; no Critical or Major findings remain
**WAF:** 3.8/5 overall; no pillar below 3
**ISO 25010:** 3.5/5 weighted; Reliability 4, Security 4, Maintainability 3

AR-LED-01 through AR-LED-06 are closed. The recheck verified deployment-only key injection, protected HMAC anchors, deny-by-default PostgreSQL function-owner authority, atomic portfolio/audit/projection boundaries, fail-closed publication, anti-rollback recovery with RPO 24 hours and RTO 4 hours, and DEC-014 exact no-epsilon consistency. Code, Test, Security, accessibility, and final Team Lead custody rechecks are PASS at their stated design-time boundaries.

Residual Minor items are completed: AR-LED-R01 owner-list normalization (#32), AR-LED-R02 accessibility announcement allocation (#31), AR-LED-R03 completeness-report currency (#33), AR-LED-R04 journal/trace currency (#29), and AR-LED-R05 detached final-hash presentation (#30). Original remediation issues #23-#28 are also closed as completed. The Workspace Owner accepted the ledger-security architecture at DP-33 through DEC-016. No ADR, implementation, #9/#20 closure, baseline freeze, ring advancement, or parallel execution is authorized.
