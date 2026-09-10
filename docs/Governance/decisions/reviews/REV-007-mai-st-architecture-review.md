# REV-007: MAI-ST Architecture Decision Review

**Date:** 2026-09-10  
**Selected strategy:** MAI-ST (Shortest Time)  
**Reviewer:** Architect Reviewer  
**Assigned model:** Claude Opus 4.8  
**Review mode:** Read-only alternate-model review  
**Verdict:** IMPROVEMENTS IDENTIFIED  

## Conclusion

MAI-ST is compatible with all seven Proposed architecture views and preserves the research-only/no-broker boundary, five-part ingestion identity, and deterministic backtest intent. No architecture rework or strategy re-selection is required. Ring 1 must make its implicit lifecycle, ledger, provider, vintage, fixture, and NFR contracts explicit before WBS/IMS drafting.

## WAF Assessment

| Pillar | Score (1-5) | Summary |
| --- | ---: | --- |
| Security | 4 | Rights, secrets, and diagnostics controls are present; fail-closed wording needs restatement. |
| Reliability | 3 | Fixture/outage semantics and exact ledger contracts are implicit. |
| Performance | 3 | Canonical latency gates are not restated. |
| Operational Excellence | 3 | Readiness is present; backup/restore is unstated. |
| Cost Optimization | 4 | Medium cost and bounded first-slice posture fit the selected strategy. |
| Overall | 3.4 | Compatible architecture requiring explicit Ring 1 inheritance. |

## Findings

### Major

1. **Paper-order lifecycle is incomplete.** Ring 1 must enumerate all eight domain states and every allowed transition, using `Partial` as the enum and **Partially Filled** as the display label.
2. **Ledger integrity is incomplete.** Ring 1 must define immutable transactions, reversing corrections, FIFO lot rules, and reconciliation test vectors.
3. **Exact reconciliation scope is generic.** Tests must prove reconciliation across cash, lots, positions, realized P&L, valuations, and cached projections at configured decimal precision.
4. **Economic vintage truth is absent.** Ring 1 must define release-timestamp cutoff, point-in-time observation selection, and versioned non-overwriting forward-fill/resampling transformations.
5. **Provider assessment is not enumerated.** Ring 1 must record Approved, Pending, or Rejected status for all six market providers and four economic adapter families and integrate only Approved sources.
6. **Provider outage and fixture semantics are ambiguous.** Fixtures must be explicit bootstrap, test, or offline datasets; live-provider outages must fail jobs visibly without silently switching datasets.

### Minor

1. Restate the full reproducibility key: inputs, code hash, parameters, seed, and environment.
2. Restate default-deny egress and fail-closed behavior when rights/configuration are absent.
3. Enumerate WCAG details: keyboard access, visible focus, non-color cues, 1280x720 usability, persistent disclaimer, and distinct trade/source/retrieval/completion timestamps.
4. Restate canonical NFRs: p95 API latency, dashboard latency, migration-aware readiness, and backup/restore evidence.

### Suggestions

1. Correct `Accessiblity` and `target State` typographical slips in the producer artifact.
2. Adopt a frozen schema/interface custodian to control parallel-stream drift.

## Cross-Model Observation

The comparison matrix correctly classified MAI-ST's lifecycle and provider handling as implicit rather than incompatible. Reversing-correction semantics are also thin in the Proposed domain model and should be closed as a shared architecture obligation, not treated only as MAI-ST debt.

## Required Human Disposition

Disposition completed by the Workspace Owner on 2026-09-10:

| Finding | Disposition | Result |
| --- | --- | --- |
| Major 1: lifecycle | Accept | Mandatory Ring 1 acceptance criteria |
| Major 2: ledger integrity | Accept | Mandatory Ring 1 acceptance criteria |
| Major 3: exact reconciliation | Accept | Mandatory Ring 1 acceptance criteria |
| Major 4: economic vintage truth | Accept | Mandatory Ring 1 acceptance criteria |
| Major 5: provider assessment | Accept | Mandatory Ring 1 acceptance criteria |
| Major 6: fixture semantics | Accept | Mandatory Ring 1 acceptance criteria |
| Minor 1: reproducibility key | Accept | Restate in Ring 1 acceptance criteria |
| Minor 2: fail-closed egress | Accept | Restate in Ring 1 acceptance criteria |
| Minor 3: accessibility specifics | Accept | Restate in Ring 1 acceptance criteria |
| Minor 4: NFR/operability gates | Accept | Restate in Ring 1 acceptance criteria |
| Suggestion 1: typo cleanup | Accept | Corrected in the producer artifact |
| Suggestion 2: schema custodian | Accept | Mandatory before parallel streams start |

The initial rejection of canonical floors was superseded after the eligibility conflict was presented; the Workspace Owner chose to retain MAI-ST and all canonical floors.
