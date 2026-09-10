# REV-006: MAI-ST Plan Decision Review

**Date:** 2026-09-10  
**Selected strategy:** MAI-ST (Shortest Time)  
**Reviewer:** Plan Reviewer  
**Assigned model:** Gemini 3.7 Flash  
**Review mode:** Read-only alternate-model review  
**Verdict:** IMPROVEMENTS IDENTIFIED  

## Conclusion

MAI-ST is viable for Ring 1 elaboration and does not require re-selection. Its speed-oriented parallel plan remains conditionally eligible because several canonical contracts are implicit. Those contracts must become explicit acceptance criteria before WBS/IMS drafting.

## Scores

| Dimension | Score (1-5) |
| --- | ---: |
| Completeness | 3 |
| Feasibility | 4 |
| Risk coverage | 3 |
| Governance alignment | 4 |
| Clarity | 3 |
| Overall | 3.4 |

## Findings

### Major

1. **Eight-state lifecycle and transitions are implicit.** Ring 1 must enumerate Draft, Submitted, Accepted, Partial, Filled, Rejected, Canceled, and Expired with every allowed transition. `Partial` is the domain enum and **Partially Filled** is the UI label.
2. **Provider due diligence is not enumerated.** Ring 1 must assess all six market providers and four economic adapter families, recording Approved, Pending, or Rejected rights status and explicit fixture-only behavior.
3. **Accounting rules are underspecified.** Ring 1 must define immutable transactions, reversing corrections, FIFO lot matching, and exact reconciliation across cash, lots, positions, realized P&L, valuations, and cached projections.
4. **Parallel interface control is missing.** Ring 1 must establish a frozen domain/API/schema milestone and one accountable schema custodian before concurrent streams begin.

### Minor

1. **Fixture wording is ambiguous.** Negative integration tests must prove a live-provider outage fails the job visibly and never silently switches an active dataset to fixtures.
2. **Technical-debt gate criteria are unspecified.** A Ring 1 exit checklist should identify non-deferrable debt in rights, provenance, ledger, and determinism, and explicitly permitted low-risk deferrals.

### Suggestions

1. Organize MAI-ST into three named concurrent streams: shared shell/schema; ingestion/provider/provenance; ledger/backtest/WCAG UI.
2. Pre-queue Ring 1 decisions for financial precision, evidence retention, and provider rights/egress policy.

## Cross-Model Observation

MAI-ST supplies the most direct speed-optimized flow and a useful debt-capture gate. GPT contributes the principle that schedule compression cannot trim fixed controls; Claude contributes the state/provider enumeration and frozen-schema discipline needed to make MAI-ST verifiable.

## Required Human Disposition

Disposition completed by the Workspace Owner on 2026-09-10:

| Finding | Disposition | Result |
| --- | --- | --- |
| Major 1: eight-state lifecycle | Accept | Mandatory Ring 1 acceptance criteria |
| Major 2: provider assessment | Accept | Mandatory Ring 1 acceptance criteria |
| Major 3: accounting rules | Accept | Mandatory Ring 1 acceptance criteria |
| Major 4: schema custody | Accept | Mandatory before parallel streams start |
| Minor 1: fixture/outage tests | Accept | Ring 1 negative-test criteria |
| Minor 2: debt thresholds | Reject | Keep MAI-ST debt gate qualitative |
| Suggestion 1: named streams | Reject | Let Ring 1 planning choose work-package organization |
| Suggestion 2: pre-queued ADRs | Reject | Let Ring 1 planning determine the decision queue |

The initial rejection of canonical floors was superseded after the eligibility conflict was presented; the Workspace Owner chose to retain MAI-ST and all canonical floors.
