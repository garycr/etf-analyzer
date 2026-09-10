# Ring 0 Lessons Learned

**Project:** ETF Analyzer  
**Ring:** Ring 0 - Intake  
**Date:** 2026-09-10  
**Owner:** Solo Orchestrator  
**Status:** Complete for gate review

## Outcome

Ring 0 produced a canonical objective from the authorized requirements PDF and legacy evidence, four BDD feature groups, a human-selected MAI-ST decomposition, eleven Proposed architecture views, and approved architecture gate evidence. No application implementation or ADR acceptance occurred.

## Severity Summary

| Severity | Count | Gate effect |
| --- | ---: | --- |
| Sev 1 | 0 | None |
| Sev 2 | 2 | Remediated; follow-up issues approved |
| Sev 3 | 3 | Remediated or tracked |
| Sev 4 | 2 | Practice guidance captured |

No unresolved Sev 1 or Sev 2 item remains in Ring 0.

## Lessons

| ID | Severity | Lesson | Evidence | Remediation and tracking | Status |
| --- | --- | --- | --- | --- | --- |
| LL-001 | Sev 2 | Compatibility cannot be treated as unconditional eligibility when producer artifacts leave canonical contracts implicit. | REV-004/REV-005 found lifecycle and ledger overclaims in the comparison matrix. | Matrix now uses conditional eligibility; explicit contracts tracked by #14, #17, and #20. | Remediated |
| LL-002 | Sev 2 | A speed-oriented strategy needs explicit interface custody before parallel work begins. | REV-006/REV-007 affirmed MAI-ST but found schema drift risk. | DEC-011 accepted a frozen contract and one custodian; issue #21 blocks parallel execution until evidenced. | Tracked for Ring 1 |
| LL-003 | Sev 3 | Authorized source recovery must preserve provenance and avoid treating protected or legacy material as target authority. | Original PDF was protected; an authorized unprotected copy supplied the canonical source. | Objective provenance recorded; issue #2 completed; legacy remains evidence-only in requirements and architecture. | Remediated |
| LL-004 | Sev 3 | Diagram text, accessible prose, and completeness claims must express identical boundaries and failure semantics. | REV-008 found fixture/outage drift, C4 abstraction leakage, and trust-boundary mismatch. | Four views remediated; REV-008 recheck approved all conditions; renderer/version work tracked by #12. | Remediated |
| LL-005 | Sev 3 | Reviewing the comparison set does not replace reviewing the human-selected strategy. | REV-004/REV-005 assessed the matrix; REV-006/REV-007 separately assessed MAI-ST. | Preserve both review checkpoints in future brainstorm workflows; accepted work tracked by #14, #15, #17, #20, #21, and #22. | Remediated |
| LL-006 | Sev 4 | Generic text validators can misread negation, encoded Markdown paths, and source-specific state models. | Early checks produced false positives despite source-correct content. | Prefer focused behavioral assertions, direct diagnostics, and alternate-model review over broad keyword-only gates. | Adopted |
| LL-007 | Sev 4 | Cost approval should bound deliverables as well as select a model. | Senior Cloud Architect GPT-5.6 Sol path exceeded the $0.50 upper threshold. | Human explicitly approved $0.372-$0.578 and the task was limited to four missing views plus one report. | Adopted |

## What Worked

- Canonical grounding stayed read-only while generated objective, Gherkin, and architecture artifacts were iteratively corrected.
- Independent producer models exposed different strengths: control discipline, explicit contract enumeration, and concise speed-oriented decomposition.
- Human dispositions were recorded without silently accepting skipped optional improvements.
- Alternate-model reviews caught both planning gaps and accessible architecture inconsistencies before the gate.

## What Changes in Ring 1

- Start with issues #14, #15, #17, #20, #21, and #22 as mandatory accepted review work.
- Do not begin MAI-ST parallel execution until #21 appoints the schema custodian and freezes versioned contracts.
- Coordinate precision, evidence, secrets, egress, identity, diagnostics, and Mermaid work through existing issues #3-#5 and #9-#12.
- Keep all architecture Proposed until the applicable human decision and review gates.

## Gate Statement

Lessons are classified, all Sev 2/3 items are either remediated or linked to GitHub issues, and no unresolved Sev 1/2 retrospective finding blocks the Ring 0 exit decision.
