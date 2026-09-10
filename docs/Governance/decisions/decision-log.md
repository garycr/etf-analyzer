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
