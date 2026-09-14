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
| DEC-021 | 2026-09-11 | Scope closure | Close #11 and #15 as prototype-scoped planning complete | Workspace Owner | Solo Orchestrator | Active |
| DEC-022 | 2026-09-11 | Scope | Re-scope #21 to an implemented-surface prototype contract freeze | Workspace Owner | Solo Orchestrator | Reviewed; execution pending |
| DEC-023 | 2026-09-11 | Ring gate | Approve simplified Tier 1 plan and advance Ring 1 to Ring 2 | Workspace Owner | Solo Orchestrator | Active |
| DEC-024 | 2026-09-14 | Architecture | Provision exact roles, database ACL, and empty `etf` schema externally before migration 0001 | Workspace Owner | Solo Orchestrator | Active |
| DEC-025 | 2026-09-14 | Architecture | Retain schema USAGE without CREATE for controlled-function owner roles | Workspace Owner | Solo Orchestrator | Active |
| DEC-026 | 2026-09-14 | Architecture | Persist watchlist aggregate version in an explicit singleton table | Workspace Owner | Solo Orchestrator | Active |
| DEC-027 | 2026-09-14 | Architecture | Close domain-ledger cryptography, owner calls, and instrument identity | Workspace Owner | Solo Orchestrator | Active |

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
| **Consequences** | One prototype analytics acceptance issue maps retained checks to existing CT-ANA identifiers. #57-#62 remain open as post-prototype work. Any pass is prototype-scoped only and does not freeze baseline `v1.0.0`, close #15/#11, pass the full REV-014 review, authorize implementation, release parallel work, or advance Ring 2. Candidate.2 governance synchronization in #64 was separately approved and completed as the precondition to prototype-scoped acceptance. |
| **Reasoning** | Representative checks preserve the distinct failure behaviors that make prototype outputs trustworthy while postponing permutation breadth that provides little additional end-user learning in a fixture-first, single-user, single-writer first release. |
| **Assumptions** | The first prototype is fixture-only, single-runtime, single-writer, and uses no transformation-bearing series, archive/restore/freeze/capacity lifecycle, real provider, or publication-version concurrency. If a displayed rule uses forward-fill, alignment, lag, interpolation, or resampling, one deterministic non-overwriting CT-ANA-004 vector becomes mandatory. If a real provider is connected, rights-restricted Degraded behavior becomes mandatory. Economic ambiguity is deferrable only while fixtures guarantee unique release identity. |
| **Invalidation** | First real-provider integration; first transformation-bearing rule; first multi-runtime or multi-writer path; implementation of archive, restore, freeze, or capacity states; scope expansion beyond local single-user research; or evidence that a deferred case removes a canonical Objective floor |
| **Status** | Active; supersedes DEC-019 only as to blanket deferral. #64 synchronization is complete; prototype acceptance #65, implementation authorization, and ring advancement remain pending. |
| **Linked Artifacts** | `docs/Governance/decisions/reviews/REV-015-analytics-prototype-rescope-plan-review.md`, `docs/Governance/decisions/reviews/REV-014-analytics-evidence-contract-test-review.md`, GitHub #57-#62, GitHub #64, GitHub #65 |

---

### DEC-021: Close Prototype-Scoped Analytics Planning

| Field | Value |
|-------|-------|
| **ID** | DEC-021 |
| **Date** | 2026-09-11 |
| **Category** | Scope closure |
| **Decision** | Close GitHub #11 and #15 as prototype-scoped planning complete after #65 and REV-016 PASS. |
| **Policy** | DEC-020 prototype boundary; REV-016 independent acceptance; Human-in-the-Loop scope disposition |
| **Authority** | Workspace Owner |
| **Accountable** | Solo Orchestrator for synchronized issue closure and boundary preservation; Team Lead retains analytics contract custody |
| **Context** | The accepted local, fixture-only, single-user prototype has design-time coverage for point-in-time truth, reproducibility, retention, integrity, least privilege, and fail-closed evidence behavior. #65 closed after an independent narrow PASS with no open Critical or Major finding in the retained subset. |
| **Alternatives** | Keep #11/#15 open until full REV-014 remediation; close them without preserving deferred debt; close them as prototype-scoped complete while retaining #57-#62 |
| **Consequences** | #11 and #15 close as completed for the first prototype. #57-#62 remain open as non-waived post-prototype debt, full REV-014 remains FAIL, and candidate.2 remains a reviewed intermediate outside the accepted prototype slice. |
| **Reasoning** | Parent planning issues should reflect the accepted delivery scope while exhaustive future-state permutations remain visible and independently tracked. |
| **Assumptions** | DEC-020 prototype assumptions and all seven #65 entry guards remain valid. |
| **Invalidation** | Any DEC-020 invalidation trigger, failure of a #65 entry guard, or expansion beyond the accepted prototype scope reopens the applicable analytics planning obligation. |
| **Status** | Active; supersedes DEC-020 and REV-016 only as to their prior prohibition on #11/#15 closure. No other authority boundary changes. |
| **Linked Artifacts** | `docs/Planning/contracts/evidence/ISSUE-065-prototype-analytics-acceptance.md`, `docs/Governance/decisions/reviews/REV-016-prototype-analytics-acceptance-test-review.md`, GitHub #11, GitHub #15, GitHub #57-#62 |

The hash-governed candidate.2 contract and CC-002 retain their contemporaneous pre-closure status text so their recorded SHA-256 remains valid. DEC-021 and the mutable contract registry are the current status authority.

---

### DEC-022: Re-scope the Prototype Contract Freeze

| Field | Value |
|-------|-------|
| **ID** | DEC-022 |
| **Date** | 2026-09-11 |
| **Category** | Scope |
| **Decision** | Re-scope #21 from a complete future-state aggregate baseline to a guarded freeze of only the contract surfaces implemented by the first local, fixture-only, single-user prototype. |
| **Policy** | DEC-011 canonical floors; DEC-013 custody; DEC-020/DEC-021 prototype boundary; Tier 1 Light governance; decision review |
| **Authority** | Workspace Owner |
| **Accountable** | Solo Orchestrator for scope trace; Team Lead retains contract custody; implementation owners remain unassigned |
| **Context** | Mandatory future-state OpenAPI, populated-database migration, event, provider, and multi-stream evidence would create speculative work for a sequential prototype. The prototype still needs stable contracts for every surface it actually consumes. |
| **Alternatives** | Complete the full aggregate baseline before prototype planning closure; waive contract coordination; freeze only inventoried surfaces with deterministic expansion guards |
| **Consequences** | #21 uses a durable surface inventory and conditional guards. The canonical browser/localhost API and PostgreSQL surfaces are expected; their absence requires an explicit Workspace Owner Objective deviation. Events, provider breadth, upgrade compatibility, and stream acknowledgements are promoted when their corresponding guard fails. Custody, DEC-011 floors, version binding, review, and no-self-approval remain mandatory. |
| **Reasoning** | Contract rigor should follow the prototype's real blast radius while guards prevent optional surfaces from appearing without their required controls. |
| **Assumptions** | Local fixtures, disabled outbound provider egress, one sequential stream, no prior active compatibility claim, expected bounded localhost API and PostgreSQL surfaces, and only inventoried durable event handoffs. |
| **Invalidation** | Any guard failure; real-provider connection; second implementation stream; prior-baseline compatibility claim; or an implemented API, database, outbox, or asynchronous event surface missing its bounded contract. |
| **Status** | Workspace Owner approved all REV-017 corrections; independent Plan Reviewer recheck PASS with no unresolved Critical or Major finding. Acceptance definition is reviewed; #21 execution and closure evidence remain pending. No implementation, baseline activation, parallel release, or Ring 2 authority follows. |
| **Linked Artifacts** | `docs/Planning/contracts/evidence/ISSUE-021-prototype-contract-freeze.md`, GitHub #21, DEC-011, DEC-013, DEC-020, DEC-021 |

---

### DEC-023: Approve Ring 1 Exit and Open Ring 2

| Field | Value |
|-------|-------|
| **ID** | DEC-023 |
| **Date** | 2026-09-11T19:36:59Z |
| **Category** | Ring gate |
| **Decision** | Approve the Tier 1 Light applicability reconciliation, sequential WP-1..WP-8 WBS, 16-week schedule, cost/token baseline, and #21 planning closure; close Ring 1 and open Ring 2 at WP-1 only. |
| **Policy** | Active Tier 1 Small Team / Light configuration; Ring 1 gate; Human-in-the-Loop; DEC-010/011/012/013/020/021/022 |
| **Authority** | Workspace Owner |
| **Accountable** | Solo Orchestrator executes one package at a time, beginning with WP-1; Team Lead retains contract custody |
| **Context** | Design-time contracts were complete, but Ring 1 remained at 10% because executable evidence and generic Five-Team ceremony had been treated as planning prerequisites. The reconciled package separates planning allocation from Ring 2 proof. |
| **Alternatives** | Continue generic Five-Team artifact generation; approve planning but hold Ring 2; accept the simplified Tier 1 package and advance |
| **Consequences** | Ring 1 closes at 100%; #21 closes as planning complete; Ring 2 opens at WP-1. Executable checks remain mandatory in WP-1..WP-8 and DP-33 remains required in WP-8 before IV&V. |
| **Assumptions** | One sequential stream; fixture-only runtime; no live provider, broker, event handoff, public ingress, baseline activation, deployment, or runtime AI dependency |
| **Invalidation** | A second stream, live-provider path, contract drift, scope change above threshold, failed WP gate, or forecast variance above policy threshold requires owner disposition or rebaseline. |
| **Status** | Active; authorizes Ring 2 WP-1 only and no production action |
| **Linked Artifacts** | `docs/Planning/ring-1-exit-assessment.md`, `docs/Planning/tasks/ring-2-wbs.md`, `docs/Planning/schedule/ring-2-delivery-schedule.md`, `docs/Planning/cost-baseline.md`, `docs/Planning/token-review-baseline.md`, GitHub #21 |

### DEC-024: Provision the Initial Schema Externally

| Field | Value |
|-------|-------|
| **ID** | DEC-024 |
| **Date** | 2026-09-14T14:36:40Z |
| **Category** | Architecture |
| **Decision** | The external PostgreSQL database-owner provisioner atomically creates the closed roles and memberships, revokes database `CONNECT,TEMPORARY` from `PUBLIC`, grants database `CONNECT` only to the six closed login roles, and creates the exact empty `etf` schema owned by `schema_owner`; `0001-foundation` verifies that prerequisite and creates only its four tables and migration row. Catalog evidence expands PostgreSQL NULL database and function ACLs through `pg_catalog.acldefault`. |
| **Policy** | DEC-023; WP-1; CT-DB-001A/B/C/D/K; deny-by-default authority; no implicit repair; architecture and alternate-model decision review required |
| **Authority** | Workspace Owner selected external empty-schema provisioning after live PostgreSQL 16 returned SQLSTATE 42501, then explicitly selected exact external database ACL provisioning after catalog execution proved NULL database ACLs preserve implicit `PUBLIC CONNECT,TEMPORARY` |
| **Accountable** | Solo Orchestrator maintains exact database/schema preflight, manifest, rollback, and cleanup evidence and does not open WP-2 |
| **Context** | Neither `migration_owner` nor `schema_owner` has database `CREATE`. PostgreSQL's default NULL database ACL grants `PUBLIC CONNECT,TEMPORARY`, which conflicts with the closed database grant matrix and cannot be hidden from canonical evidence. Widening permanent product-role authority or deferring connection denial until migration 0006 would weaken bootstrap isolation. |
| **Alternatives** | Widen migration privileges; pause for authority redesign; provision exactly the empty schema externally |
| **Consequences** | Roles, memberships, the exact six database `CONNECT` grants, no `PUBLIC` database privilege, and the empty schema form an allowed but `NotReady` prerequisite. `0001` uses temporary transaction-local schema grants for direct final-owner object creation and revokes them before manifest projection. Any implicit PUBLIC function grant remains visible as drift. |
| **Assumptions** | The provisioner has database-owner authority, performs only the enumerated role, membership, database-ACL, and empty-schema operations, and removes credentials after bootstrap. |
| **Invalidation** | Any extra or missing database grant, `PUBLIC` database privilege, extra schema ACL/default privilege/object, owner mismatch, unenumerated provisioner DDL, or permanent owner grant fails closed and requires explicit operator remediation. |
| **Status** | Active; database-ACL amendment owner-approved; REV-033 architecture recheck PASS with no Critical or Major finding; implementation limited to WP-1 evidence |
| **Linked Artifacts** | `docs/Planning/contracts/postgresql-contract.md`, `specs/features/PostgreSQL-Contract-Conformance.feature`, `docs/Operations/postgresql-bootstrap-recovery.md`, `docs/artifacts/gate-evidence/wp-1-postgresql-role-bootstrap.md`, `docs/Governance/decisions/reviews/REV-033-dec-024-database-acl-amendment-review.md` |

### DEC-025: Retain Schema Usage for Controlled-Function Owners

| Field | Value |
|-------|-------|
| **ID** | DEC-025 |
| **Date** | 2026-09-14 |
| **Category** | Architecture |
| **Decision** | After each owner creates its objects, revoke schema `CREATE` but retain schema `USAGE` for exactly `application_writer_owner`, `ledger_writer_owner`, `projection_owner`, `audit_writer_owner`, `anchor_owner`, and `evidence_writer_owner`. |
| **Policy** | DEC-023; WP-1; CT-DB-001A/C/D/K; deny-by-default authority; exact ownership; fixed qualified `SECURITY DEFINER` bodies; architecture and alternate-model decision review |
| **Authority** | Workspace Owner explicitly approved Option A after live PostgreSQL 16 returned SQLSTATE 42501 inside an `application_writer_owner` SECURITY DEFINER function whose temporary schema USAGE had been revoked |
| **Accountable** | Solo Orchestrator proves `USAGE=true`, `CREATE=false`, updates canonical manifest and contract evidence, obtains architecture recheck, and keeps WP-2 closed |
| **Context** | PostgreSQL executes SECURITY DEFINER statements as the function owner, and object ownership does not confer namespace lookup. The current closed matrix therefore makes every qualified controlled-function body fail after temporary schema privileges are revoked. |
| **Alternatives** | Retain minimum per-owner schema USAGE; transfer functions to schema_owner and collapse separation of duties; grant PUBLIC USAGE or elevated authority; pause for redesign |
| **Consequences** | Controlled-function owners can resolve qualified `etf` objects but cannot create schema objects. Exact object ownership, fixed search paths, runtime separation, PUBLIC denial, and no-dynamic-SQL rules remain unchanged. Six additional schema grant records become canonical manifest content. |
| **Assumptions** | Every controlled function references only its contract-authorized objects and all direct object privileges continue to derive from exact ownership or separately enumerated grants. |
| **Invalidation** | Schema CREATE for any function-owner role, schema USAGE for another owner or PUBLIC, changed function ownership, unqualified object access, or broader role authority fails closed. |
| **Status** | Active; REV-035 architecture recheck PASS with no Critical or Major finding; application_writer_owner implementation canonically evidenced in 0002 |
| **Linked Artifacts** | `docs/Planning/contracts/postgresql-contract.md`, `specs/features/PostgreSQL-Contract-Conformance.feature`, `docs/Governance/decisions/reviews/REV-035-dec-025-controlled-function-owner-usage-review.md` |

### DEC-026: Persist the Watchlist Aggregate Version Explicitly

| Field | Value |
|-------|-------|
| **ID** | DEC-026 |
| **Date** | 2026-09-14 |
| **Category** | Architecture |
| **Decision** | Add `watchlist_state(singleton boolean,version bigint)` to `0002-application`, seed exactly `(true,0)`, and lock that row for every watchlist compare-and-write operation. |
| **Policy** | DEC-023; WP-1; application candidate.2 watchlist expected-version semantics; CT-DB-001A/B/C; exact catalog closure; architecture review |
| **Authority** | Workspace Owner explicitly approved the singleton state-table option after implementation analysis proved the five-table physical model loses the aggregate version when the final item is removed |
| **Accountable** | Solo Orchestrator keeps the singleton exact, proves monotonic empty-state and concurrent-writer behavior, updates canonical hashes, and does not open WP-2 |
| **Context** | `watchlist_items.version` cannot preserve one application aggregate version when no item exists. Resetting to zero would allow stale writes; tombstones or hidden replay rows would misrepresent domain state. |
| **Alternatives** | Add explicit singleton state; reset version when empty; retain hidden tombstones; pause for contract redesign |
| **Consequences** | The closed 0002 table set increases from five to six. Removing the final item retains the aggregate version, and a row lock provides atomic compare-and-set semantics without a queue or event surface. |
| **Assumptions** | Exactly one singleton row exists and only `watchlist_write` mutates it after migration. |
| **Invalidation** | Missing or duplicate state rows, direct runtime mutation, version reset, unlocked compare-and-write, or another hidden version authority fails closed. |
| **Status** | Active; REV-037 architecture review APPROVED with no Critical or Major finding; REV-036 code review PASS and exact PostgreSQL behavior proven |
| **Linked Artifacts** | `docs/Planning/contracts/postgresql-contract.md`, `tests/Integration/application-migration.test.mjs`, `docs/artifacts/gate-evidence/wp-1-application-migration.md`, `docs/Governance/decisions/reviews/REV-037-dec-026-watchlist-state-review.md` |

### DEC-027: Close Domain-Ledger Execution Prerequisites

| Field | Value |
|-------|-------|
| **ID** | DEC-027 |
| **Date** | 2026-09-14 |
| **Category** | Architecture |
| **Decision** | Provision PostgreSQL `pgcrypto` externally before migration 0001; use nested owner-controlled functions for the paper-order to ledger to audit to anchor call graph; and persist required `instrumentId` on every paper order from explicit draft creation. |
| **Policy** | DEC-023; WP-1; CT-DB-001A/D/F/G; CT-LED-001..019; deny-by-default authority; exact canonical evidence; no implicit data derivation |
| **Authority** | Workspace Owner explicitly approved the recommended payload-first design, `pgcrypto` authority, nested owner-function choreography, and paper-order instrument identity options |
| **Accountable** | Solo Orchestrator updates all affected contracts and golden manifests, obtains alternate-model architecture review, implements exact 0003 behavior, and does not open WP-2 |
| **Context** | PostgreSQL core lacks the required SHA-256/HMAC functions; the migration role intentionally cannot install trusted extensions; the prior grant matrix omitted required nested owner calls; and fill/FIFO records require an instrument identity absent from the order aggregate. |
| **Alternatives** | Trust adapter-supplied proofs; pure PL/pgSQL cryptography; runtime transaction choreography; one consolidated writer; derive instrument from opaque evidence; supply instrument only on fills; defer 0003 |
| **Consequences** | `pgcrypto` 1.3 becomes an externally provisioned system extension in its default `public` schema and rebaselines the 0001/0002 manifest hashes without changing their SQL bytes. Owner-to-owner EXECUTE grants permit only the nested atomic call graph. Draft creation, PaperOrder, OpenAPI, and `paper_orders` gain required `instrumentId`. |
| **Assumptions** | PostgreSQL 16.15 supplies trusted `pgcrypto` under the PostgreSQL License; the external provisioner installs it before role lockdown; application canonical JSON supplies exact UTF-8 bytes while PostgreSQL hashes those exact bytes; each nested function validates its closed payload and caller authority. |
| **Invalidation** | Missing/extra extension, runtime extension authority, adapter-only unverified digest, direct runtime audit/anchor access, partial multi-call commits, mutable/derived/fill-only instrument identity, or an unlisted owner grant fails closed. |
| **Status** | Active; REV-038 architecture review APPROVED with no Critical or Major finding; 0001/0002 extension rebaseline proven live |
| **Linked Artifacts** | `docs/Planning/contracts/postgresql-contract.md`, `docs/Planning/contracts/application-contract.md`, `docs/Planning/contracts/openapi-contract.yaml`, `docs/Planning/contracts/domain-ledger-function-contract.md`, `docs/Governance/decisions/reviews/REV-038-dec-027-domain-ledger-prerequisites-review.md` |
