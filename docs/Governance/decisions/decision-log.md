# Decision Log

> Canonical record of all traceable decisions. Maintained by the **Architect**.
> Each entry captures the four pillars: **Decision**, **Policy**, **Authority**, **Accountability**.
>
> See `.github/skills/decision-traceability.md` for the full framework.

## Decision Index

| ID | Date | Category | Decision (summary) | Authority | Accountable | Status |
|----|------|----------|--------------------|-----------|-------------|--------|
| DEC-001 | 2026-09-10 | Governance | Workspace initialized at Tier 1 (Small Team) | User | Architect | Active |
| DEC-010 | 2026-09-10 | Planning | Select MAI-ST at DP-4 for conditional Ring 1 elaboration | Workspace Owner | Solo Orchestrator | Active |
| DEC-011 | 2026-09-10 | Planning | Retain MAI-ST and canonical floors after selected-strategy review | Workspace Owner | Solo Orchestrator | Active |
| DEC-012 | 2026-09-10 | Governance | Approve Ring 0 Conditional PASS and open Ring 1 planning | Workspace Owner | Solo Orchestrator | Active |
| DEC-013 | 2026-09-10 | Governance | Appoint distinct Team Lead as schema contract custodian with governed escalation | Workspace Owner | Team Lead | Active |
| DEC-014 | 2026-09-10 | Architecture | Select field-specific balanced financial precision and half-even rounding | Workspace Owner | Team Lead | Active |
| DEC-020 | 2026-09-11 | Scope | Re-scope analytics acceptance to a trustworthy first-prototype subset | Workspace Owner | Solo Orchestrator | Active |

---

## Decision Records

### DEC-001: Workspace Tier Selection

| Field | Value |
|-------|-------|
| **ID** | DEC-001 |
| **Date** | 2026-09-10 |
| **Category** | Governance |
| **Decision** | Initialize workspace at Tier 1 — Small Team |
| **Policy** | Workspace Configuration (`.github/workspace-config.md`) |
| **Authority** | User (workspace creator) |
| **Accountable** | Architect (decision traceability custodian) |
| **Context** | Initial workspace scaffolding — tier determines governance depth, agent roster, and planning artifacts |
| **Alternatives** | Tier 1 (Small Team), Tier 2 (Multi-Project Team), Tier 3 (Enterprise Program Office) |
| **Consequences** | Governance, agents, and planning artifacts are configured for the selected tier |
| **Reasoning** | Template provides pre-configured governance depth matching team size and compliance needs; higher tiers add ceremony justified by coordination overhead |
| **Assumptions** | Team structure and compliance requirements match the selected tier for the project duration |
| **Invalidation** | If team grows beyond tier capacity or compliance requirements change, re-evaluate tier selection |
| **Status** | Active |
| **Linked Artifacts** | `.github/workspace-config.md`, RSN-001 |

---

### DEC-010: DP-4 Brainstorm Strategy Selection

| Field | Value |
|-------|-------|
| **ID** | DEC-010 |
| **Date** | 2026-09-10 |
| **Category** | Planning |
| **Decision** | Select MAI-ST (Shortest Time) from the twelve reviewed brainstorm candidates for conditional Ring 1 elaboration |
| **Policy** | Ring 0 brainstorming protocol; DP-4 human selection; decision traceability |
| **Authority** | Workspace Owner |
| **Accountable** | Solo Orchestrator |
| **Context** | The comparison matrix presented nine original strategies and three hybrids after dual-review remediation; Hybrid A was advisory, not binding |
| **Alternatives** | GPT-LC/ST/MC; CLAUDE-LC/ST/MC; MAI-LC/MC; Hybrid A/B/C; custom hybrid |
| **Consequences** | MAI-ST becomes the planning input, subject to selected-strategy dual review and explicit inheritance of the mandatory Ring 1 checklist before WBS/IMS drafting |
| **Reasoning** | Workspace Owner explicitly selected the rapid parallel path with technical-debt capture, accepting that lifecycle, accounting, provider, and interface contracts require elaboration |
| **Assumptions** | Parallel capacity and early interface discipline can be established; all Proposed architecture and research-only boundaries remain unchanged |
| **Invalidation** | Selected-strategy review finds an unresolved critical defect, required parallel capacity is unavailable, or the Workspace Owner supersedes this decision |
| **Status** | Active |
| **Linked Artifacts** | `docs/Planning/brainstorm/mai-code-1-1-flash-decomposition.md`, `docs/Planning/brainstorm/comparison-matrix.md`, `docs/Sessions/journal.md` |

---

### DEC-011: Selected-Strategy Review Disposition

| Field | Value |
|-------|-------|
| **ID** | DEC-011 |
| **Date** | 2026-09-10 |
| **Category** | Planning |
| **Decision** | Retain MAI-ST and all canonical objective floors; accept schema custody and cross-cutting NFR restatement; reject formal debt thresholds; accept typo cleanup only from the optional bundle |
| **Policy** | Selected-strategy dual Decision Review; canonical objective precedence; human disposition protocol |
| **Authority** | Workspace Owner |
| **Accountable** | Solo Orchestrator |
| **Context** | REV-006 and REV-007 affirmed MAI-ST with improvements; the first disposition rejected five canonical floors, creating an eligibility conflict, then the Workspace Owner explicitly retained MAI-ST and those floors |
| **Alternatives** | Reopen canonical objective; withdraw MAI-ST selection; stop at a blocked Ring 0 gate |
| **Consequences** | Accepted findings become mandatory Ring 1 acceptance criteria; one schema custodian is required before parallel work; debt thresholds and suggested stream/ADR organization are not mandated |
| **Reasoning** | Preserve the approved objective and selected speed-oriented strategy while making its implicit contracts verifiable during Ring 1 elaboration |
| **Assumptions** | Ring 1 planning can inherit the accepted contracts without changing the Proposed architecture or research-only scope |
| **Invalidation** | Ring 1 cannot satisfy a canonical floor, selected-strategy assumptions fail, or the Workspace Owner changes scope through a governed decision |
| **Status** | Active |
| **Linked Artifacts** | `docs/Governance/decisions/reviews/REV-006-mai-st-plan-review.md`, `docs/Governance/decisions/reviews/REV-007-mai-st-architecture-review.md`, `docs/Planning/brainstorm/comparison-matrix.md` |

---

### DEC-012: Ring 0 Exit and Ring 1 Entry

| Field | Value |
|-------|-------|
| **ID** | DEC-012 |
| **Date** | 2026-09-10 |
| **Category** | Governance |
| **Decision** | Approve the Ring 0 Conditional PASS, close Ring 0, and open Ring 1 planning with MAI-ST and all listed conditions mandatory |
| **Policy** | DP-5 Ring 0 exit gate; Ring lifecycle; human decision points |
| **Authority** | Workspace Owner |
| **Accountable** | Solo Orchestrator |
| **Context** | Objective, BDD, brainstorm selection, selected-strategy reviews, eleven Proposed architecture views, REV-008 approval, findings, lessons, and issue traceability are complete |
| **Alternatives** | Return for remediation; reject gate and retain Ring 0 as blocked |
| **Consequences** | Ring 1 planning may begin; issues #14, #15, #17, #20, #21, and #22 plus existing #3-#5 and #9-#12 are mandatory planning inputs |
| **Reasoning** | Ring 0 exit criteria are satisfied with no unresolved Sev 1/2 item; remaining conditions are properly bounded Ring 1 decisions, tests, and implementation planning |
| **Assumptions** | Architecture remains Proposed and no implementation begins before Ring 1 planning/review gates permit it |
| **Invalidation** | A Ring 0 evidence defect is discovered, mandatory conditions are removed without governed approval, or the Workspace Owner reopens the gate |
| **Status** | Active |
| **Linked Artifacts** | `docs/artifacts/gate-evidence/ring-0-gate-checklist.md`, `docs/artifacts/12-Retrospective/ring-0-lessons-learned.md`, `docs/Architecture/architecture-completeness-report.md`, `docs/Planning/findings.md` |

---

### DEC-013: Schema Contract Custody

| Field | Value |
|-------|-------|
| **ID** | DEC-013 |
| **Date** | 2026-09-10 |
| **Category** | Governance |
| **Decision** | Appoint a distinct dispatched Team Lead as custodian for the versioned domain, OpenAPI, PostgreSQL, outbox/event, and analytics evidence contracts, with escalation through the Solo Orchestrator to the Workspace Owner |
| **Policy** | Issue #21; DEC-011 canonical floors; consequential decision and alternate-model Decision Review; Tier 1 active-role constraints |
| **Authority** | Workspace Owner |
| **Accountable** | Team Lead; custody acknowledged in the contract registry on 2026-09-10 |
| **Context** | MAI-ST parallel execution requires one accountable contract custodian; REV-009 identified role-separation, ownership, classification, CI, continuity, and invalidation controls that the Workspace Owner dispositioned |
| **Alternatives** | Solo Orchestrator custody; Team Lead-only custody; Workspace Owner custody; blocked appointment |
| **Consequences** | Fixed artifact paths, no-self-approval, default-to-breaking classification, per-change DEC-011 assertions, specialist review lanes, named compatibility checks, continuity rules, and versioned invalidation govern the baseline; parallel work remains blocked until baseline `v1.0.0` is complete and separately released |
| **Reasoning** | A distinct Team Lead supplies integration custody without combining originator, reviewer, and human breaking-change authority, while preserving the selected speed-oriented strategy after contracts are frozen |
| **Assumptions** | The Team Lead remains available as a distinct active Tier 1 agent; all contract-owning issues produce complete reviewed artifacts before freeze |
| **Invalidation** | Role independence cannot be maintained, custody recheck fails at the Ring 1 to Ring 2 gate, the baseline cannot satisfy DEC-011 floors, or the Workspace Owner supersedes the decision |
| **Status** | Active; accountability handover complete; baseline freeze pending |
| **Linked Artifacts** | `docs/Planning/schema-contract-governance-options.md`, `docs/Planning/contracts/README.md`, `docs/Planning/contracts/change-log.md`, `docs/Governance/decisions/reviews/REV-009-schema-contract-custody-review.md`, issue #21 |

---

### DEC-014: Financial Precision and Rounding Policy

| Field | Value |
|-------|-------|
| **ID** | DEC-014 |
| **Date** | 2026-09-10 |
| **Category** | Architecture |
| **Decision** | Select Option A: `NUMERIC(28,10)` for quantity and unit price/cost/NAV, `NUMERIC(28,8)` for monetary values, and `NUMERIC(28,12)` for rates/returns/ratios/weights, using decimal round-half-even at declared derived-result boundaries |
| **Policy** | DEC-006 bounded canonical financial precision; DEC-011 immutable/reversing FIFO and exact reconciliation; O-CST-007; O-MET-004 |
| **Authority** | Workspace Owner |
| **Accountable** | Team Lead as schema contract custodian |
| **Context** | GitHub #9/#20 require fixed values before the immutable FIFO ledger and executable reconciliation vectors can be completed; REV-010 approved three bounded options after arithmetic remediation |
| **Alternatives** | Option B uniform `NUMERIC(38,18)` half-even; Option C compact field-specific half-up; revised policy; blocked decision |
| **Consequences** | External excess-scale values fail closed; derived arithmetic uses exact integer coefficients and deterministic half-even quantization; reversals negate stored canonical effects; reconciliation requires exact canonical equality with no epsilon |
| **Reasoning** | Field-specific semantics and substantial bounded headroom preserve research fidelity and neutral tie handling without Option B's uniform high scale or Option C's lower fidelity and directional half-up bias |
| **Assumptions** | Single-currency local research prototype; no FX, tax, leverage, margin, shorting, or external execution; reviewed workload bounds remain sufficient |
| **Invalidation** | Required values exceed field scales or coupled workload bounds, multi-currency/external execution enters scope, or a domain mandate requires a different rounding rule |
| **Status** | Active for #9/#20 contract elaboration; baseline freeze and implementation pending |
| **Linked Artifacts** | `docs/Planning/financial-precision-options.md`, `docs/Governance/decisions/reviews/REV-010-financial-precision-options-review.md`, GitHub #9, GitHub #20 |

---

### DEC-015: Ledger Security Architecture Remediation Authorization

| Field | Value |
|-------|-------|
| **ID** | DEC-015 |
| **Date** | 2026-09-10 |
| **Category** | Governance |
| **Decision** | Approve AR-LED-01 through AR-LED-06 and GitHub #23-#28 for Ring 1 remediation of the Proposed ledger security architecture |
| **Policy** | REV-011; mandatory architecture review; alternate-model Decision Review; Ring 1 finding management |
| **Authority** | Workspace Owner |
| **Accountable** | Team Lead for custody; architecture and security reviewers for independent closure verification |
| **Context** | REV-011 found six Major gaps between the final-custody ledger contract and Proposed architecture covering HMAC control, PostgreSQL authority, atomic append/audit, fail-closed rebuild, recovery continuity, and DEC-014 alignment |
| **Alternatives** | Approve all findings; approve a subset; defer remediation; reject the HMAC-anchor direction and redesign |
| **Consequences** | Proposed architecture updates may proceed; every finding remains open until independent verification; implementation and architecture approval remain blocked |
| **Reasoning** | The findings close implementability, integrity, least-privilege, recovery, and policy-consistency gaps without changing the approved ledger accounting semantics |
| **Assumptions** | The remediation preserves local-only deployment, no-broker scope, DEC-014 precision, and the existing final ledger specification custody boundary |
| **Invalidation** | A reviewed design cannot provide independent key/anchor authority, atomic append plus durable failed-attempt evidence, recoverable chain continuity, or exact no-epsilon reconciliation |
| **Status** | Completed; AR-LED-01..06 closed and resulting ledger-security architecture accepted by DEC-016 |
| **Linked Artifacts** | `docs/Governance/decisions/reviews/REV-011-ledger-security-architecture-review.md`, GitHub #23, #24, #25, #26, #27, #28 |

---

### DEC-016: Ledger Security Architecture Acceptance

| Field | Value |
|-------|-------|
| **ID** | DEC-016 |
| **Date** | 2026-09-10 |
| **Category** | Architecture |
| **Decision** | Accept the reviewed ledger signer, key, anchor, PostgreSQL authority, immutable audit, projection-publication, and recovery architecture at DP-33 |
| **Policy** | DP-33 architecture acceptance; REV-011 final recheck; DEC-014; DEC-015; architecture review; decision review |
| **Authority** | Workspace Owner |
| **Accountable** | Solo Orchestrator for decision trace; Team Lead for contract custody; implementation owners remain unassigned |
| **Context** | Candidate.2 SHA-256 `0e223c5d4e4af1a1cd42cd9dbd8e2275f90b1904efd6eaa68555e7ad7dd376e2` passed Team Lead, Code, Test, Security, accessibility, and Architect Reviewer rechecks; REV-011 closed AR-LED-01..06 with no Critical or Major findings |
| **Alternatives** | Approve architecture; return for remediation; reject architecture |
| **Consequences** | Ledger-security portions of the Proposed views become accepted design input; #23-#32 are completed; CT-LED-001..019 executable evidence remains mandatory |
| **Reasoning** | The design now allocates isolated key custody, non-login function-owner authority, atomic dual-chain evidence, fail-closed publication, and anti-rollback recovery while preserving DEC-014 exact accounting semantics |
| **Assumptions** | Local-only single-user research prototype; no brokerage path; attested model dispatch is accepted as process evidence rather than cryptographic model-identity proof |
| **Invalidation** | Implementation cannot enforce the reviewed authority/atomicity/recovery boundaries, a Critical or Major finding emerges, or scope adds external execution or incompatible trust boundaries |
| **Status** | Accepted architecture; no ADR, implementation, ring advancement, baseline freeze, #9/#20 closure, or parallel execution authorized |
| **Linked Artifacts** | `docs/Governance/decisions/reviews/REV-011-ledger-security-architecture-review.md`, `docs/Planning/contracts/evidence/CC-001-ledger-candidate-delta.md`, GitHub #30, #31, #32 |

---

### DEC-017: Select Balanced Analytics Evidence Retention

| Field | Value |
|-------|-------|
| **ID** | DEC-017 |
| **Date** | 2026-09-10 |
| **Category** | Data governance |
| **Decision** | Select Option A, `RET-A-1.0`, for the analytics evidence retention policy, subject to separate ADR-001 acceptance at DP-12 |
| **Policy** | O-MET-007 reproducibility; GitHub #15/#11; REV-012; decision review; security review |
| **Authority** | Workspace Owner |
| **Accountable** | Team Lead for analytics contract custody; Solo Orchestrator for decision trace |
| **Context** | REV-012 approved three bounded options after closure of #34-#42; Option A retains Complete evidence/inputs for two years, manifests for five years, operational metadata for one year, and uses a 25 GiB envelope |
| **Alternatives** | `RET-B-1.0` minimum footprint; `RET-C-1.0` extended history; custom policy; defer |
| **Consequences** | ADR-001 may be proposed with Option A values; expired evidence cannot be recovered by a later extension; CT-RET-001..012 and CT-ANA-001 remain Ring 2 obligations |
| **Reasoning** | Option A balances a meaningful research reproduction window against local storage, privacy, backup, and operational burden without inventing a seven-year requirement |
| **Assumptions** | Local single-user non-regulated research prototype; no brokerage; provider rights remain separately governed |
| **Invalidation** | 25 GiB sustained capacity breach, incomplete P0 reproduction due to rights, new retention obligation, recovery-target failure, or expanded trust/scope boundary |
| **Status** | Selected; ADR-001 accepted at DP-12 in DEC-018 |
| **Linked Artifacts** | `docs/Planning/analytics-evidence-retention-options.md`, `docs/Governance/decisions/reviews/REV-012-analytics-evidence-retention-options-review.md`, `docs/Architecture/ADRs/ADR-001-analytics-evidence-retention.md` |

---

### DEC-018: Accept ADR-001 Analytics Evidence Retention

| Field | Value |
|-------|-------|
| **ID** | DEC-018 |
| **Date** | 2026-09-10 |
| **Category** | ADR acceptance |
| **Decision** | Accept ADR-001 and make `RET-A-1.0` the governing analytics evidence retention policy |
| **Policy** | DP-12; DEC-017; REV-012; REV-013; ADR governance |
| **Authority** | Workspace Owner |
| **Accountable** | Team Lead for analytics contract custody; Solo Orchestrator for decision trace |
| **Context** | REV-013 confirmed exact equivalence to selected RET-A-1.0 after closure of #43-#47, with no Critical or Major findings |
| **Alternatives** | Approve ADR-001; return for remediation; reject ADR-001 |
| **Consequences** | Analytics contract work must implement the accepted policy semantics and planned CT-RET-001..012; future changes follow ADR supersession and contract change governance |
| **Reasoning** | The accepted balanced policy preserves two years of Complete reproducibility and five years of compact verification history within a bounded local footprint |
| **Assumptions** | Local single-user non-regulated research prototype; provider rights remain separately governed; planning capacity estimates require Ring 2 measurement |
| **Invalidation** | ADR-001 invalidation conditions or a superseding Workspace Owner-approved ADR |
| **Status** | Accepted; no implementation, provider ingestion, dependency installation, deployment, baseline freeze, Ring 2 advancement, or parallel execution authorized |
| **Linked Artifacts** | `docs/Architecture/ADRs/ADR-001-analytics-evidence-retention.md`, `docs/Governance/decisions/reviews/REV-013-analytics-evidence-retention-adr-review.md` |

---

### DEC-019: Defer Analytics Evidence Contract Test Remediation

| Field | Value |
|-------|-------|
| **ID** | DEC-019 |
| **Date** | 2026-09-11 |
| **Category** | Review remediation disposition |
| **Decision** | Defer remediation of REV-014 findings #57-#62 and leave analytics evidence contract candidate.1 blocked |
| **Policy** | Test quality; decision review; FinOps high-cost approval; contract baseline governance |
| **Authority** | Workspace Owner |
| **Accountable** | Team Lead for analytics contract custody; Solo Orchestrator for decision trace |
| **Context** | Test Review returned FAIL at 3.89/5 because hash-domain, exact-vector, authorization/accessibility, BDD, and traceability evidence remained incomplete; full remediation was estimated at 70k-110k tokens and $0.55-$0.95 |
| **Alternatives** | Approve full remediation; remediate gate blockers first; defer remediation |
| **Consequences** | #57-#62 remain open; candidate.1 cannot complete #15/#11, enter the aggregate baseline, or support WBS/IMS eligibility |
| **Reasoning** | Workspace Owner chose to stop the additional high-cost review/remediation cycle at this time |
| **Invalidation** | Explicit Workspace Owner approval to resume selected or full #57-#62 remediation |
| **Status** | Deferred and blocked; no implementation, baseline freeze, Ring 2 advancement, or parallel execution authorized |
| **Linked Artifacts** | `docs/Governance/decisions/reviews/REV-014-analytics-evidence-contract-test-review.md`, `docs/Planning/contracts/analytics-evidence-contract.md` |

---

### DEC-020: Re-scope Analytics Acceptance for the First Prototype

| Field | Value |
|-------|-------|
| **ID** | DEC-020 |
| **Date** | 2026-09-11 |
| **Category** | Scope |
| **Decision** | Replace DEC-019's blanket deferral with a prototype-scoped acceptance set that retains representative controls for deterministic hashes, point-in-time selection, mutation propagation, missing-data suppression, no-signal distinction, integrity quarantine, atomic commit, idempotency conflict, least privilege, denial-audit failure, bounded half-even arithmetic, and accessible failure recovery. Defer exhaustive permutations and administrative normalization in #57-#62 to later feature releases. |
| **Policy** | Canonical Objective O-REQ-004, O-REQ-006, and O-REQ-007; O-CST-003 and O-CST-007; O-MET-007; DEC-011 canonical floors; Tier 1 Light governance; decision review |
| **Authority** | Workspace Owner |
| **Accountable** | Solo Orchestrator for scope trace; Team Lead for analytics contract custody; implementation owners remain unassigned |
| **Context** | The first iteration must place a workable local research prototype with end users. Full #57-#62 remediation emphasizes exhaustive future-state combinations and was estimated at 70k-110k tokens and $0.55-$0.95. The reduced planning and reviewer cycle is estimated at 20k-35k tokens and $0.20-$0.40. An alternate-model Plan Reviewer found the direction sound after clarifying security precedence, both idempotency branches, and conditional transformation/provider triggers. |
| **Alternatives** | Complete every REV-014 finding before implementation; keep all remediation deferred and remain blocked; waive deterministic, security, or accessibility floors |
| **Consequences** | One prototype analytics acceptance issue will map retained checks to existing CT-ANA identifiers. #57-#62 remain open as post-prototype work. Any pass is prototype-scoped only and does not freeze baseline `v1.0.0`, close #15/#11, pass the full REV-014 review, authorize implementation, release parallel work, or advance Ring 2. Candidate.2 governance synchronization in #64 remains deferred and is a precondition to prototype-scoped acceptance. |
| **Reasoning** | Representative checks preserve the distinct failure behaviors that make prototype outputs trustworthy while postponing permutation breadth that provides little additional end-user learning in a fixture-first, single-user, single-writer first release. |
| **Assumptions** | The first prototype is fixture-only, single-runtime, single-writer, and uses no transformation-bearing series, archive/restore/freeze/capacity lifecycle, real provider, or publication-version concurrency. If a displayed rule uses forward-fill, alignment, lag, interpolation, or resampling, one deterministic non-overwriting CT-ANA-004 vector becomes mandatory. If a real provider is connected, rights-restricted Degraded behavior becomes mandatory. Economic ambiguity is deferrable only while fixtures guarantee unique release identity. |
| **Invalidation** | First real-provider integration; first transformation-bearing rule; first multi-runtime or multi-writer path; implementation of archive, restore, freeze, or capacity states; scope expansion beyond local single-user research; or evidence that a deferred case removes a canonical Objective floor |
| **Status** | Active; supersedes DEC-019 only as to blanket deferral. Prototype acceptance, #64 synchronization, implementation authorization, and ring advancement remain pending. |
| **Linked Artifacts** | `docs/Governance/decisions/reviews/REV-015-analytics-prototype-rescope-plan-review.md`, `docs/Governance/decisions/reviews/REV-014-analytics-evidence-contract-test-review.md`, GitHub #57-#62, GitHub #64, GitHub #65 |
