# Brainstorm Comparison Matrix — GitHub Issue #13 (Ring 0)

**Purpose:** Consolidate the three independent producer decompositions into a single comparison to support the human **DP-4** brainstorm selection.
**Status:** DP-4 decision recorded: **MAI-ST selected by the Workspace Owner on 2026-09-10.** Selection does **not** make MAI-ST unconditionally eligible, create a WBS or IMS, authorize implementation, or accept any ADR. Architecture remains **Proposed**, and the mandatory Ring 1 elaboration checklist in §2.1 applies before WBS/IMS drafting.
**Date:** 2026-09-10
**Author role:** Read/write comparison synthesizer (Plan Reviewer capacity). Producer artifacts were read but not modified.

## Producer artifacts compared

- [GPT-5.4 decomposition](./gpt-5-4-decomposition.md)
- [Claude Sonnet 5 decomposition](./claude-sonnet-5-decomposition.md)
- [MAI-Code-1.1-Flash decomposition](./mai-code-1-1-flash-decomposition.md)

## Canonical grounding (read-only)

- [Objective summary](../../customer-docs/Objective/objective-summary.md)
- [Objective requirements feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature)
- [Program narrative](../../customer-docs/Objective/program-narrative.md)
- [Proposed component view](../../Architecture/proposed-component-view.md)
- [Proposed deployment view](../../Architecture/proposed-deployment-view.md)
- [Proposed domain model](../../Architecture/proposed-domain-model.md)
- [Proposed ingestion sequence](../../Architecture/proposed-ingestion-sequence.md)
- [Proposed paper-order sequence](../../Architecture/proposed-paper-order-sequence.md)
- [Proposed analytics/backtest activity](../../Architecture/proposed-analytics-backtest-activity.md)
- [Proposed paper-order state](../../Architecture/proposed-paper-order-state.md)

---

## 1. Strategy identifiers

Each producer supplied three named strategies. This matrix labels all nine as follows:

| Identifier | Model | Named strategy |
| --- | --- | --- |
| GPT-LC | GPT-5.4 | Least Cost |
| GPT-ST | GPT-5.4 | Shortest Time |
| GPT-MC | GPT-5.4 | Most Comprehensive |
| CLAUDE-LC | Claude Sonnet 5 | Least Cost |
| CLAUDE-ST | Claude Sonnet 5 | Shortest Time |
| CLAUDE-MC | Claude Sonnet 5 | Most Comprehensive |
| MAI-LC | MAI-Code-1.1-Flash | Least Cost |
| MAI-ST | MAI-Code-1.1-Flash | Shortest Time |
| MAI-MC | MAI-Code-1.1-Flash | Most Comprehensive |

---

## 2. Eligibility screen against non-negotiables

Every option must preserve the fixed constraints below. These are floors, not trade variables. The screen records whether each constraint is **explicitly** addressed in the artifact (E), addressed only **implicitly**/at a higher abstraction (I), or **absent** (—). An implicit treatment is compatible with the Proposed architecture but is **not sufficient for unconditional eligibility**: the selected strategy must explicitly inherit every floor during Ring 1 elaboration before WBS/IMS drafting.

Recent Claude corrections are treated as the current state of the Claude artifact: its Least Cost and Shortest Time strategies now **ship** the reproducible backtest MVP (not deferred) and carry the **complete eight-state** paper-order lifecycle with source transitions.

| Non-negotiable | GPT | Claude | MAI |
| --- | --- | --- | --- |
| P0 backtest present (never deferred) | E (narrow analytics/backtest pathway in all three) | E (backtest MVP shipped even in LC/ST; full engine in MC) | E (backtest snapshot execution in all three) |
| Complete 8-state paper-order lifecycle with source transitions | I (draft-to-confirm flow described; states not enumerated) | E (all eight states enumerated by name in every strategy) | I (draft/confirm and "terminal state transitions"; states not enumerated) |
| Research-only / no-broker boundary | E | E | E |
| WSL + kind/Kubernetes + PostgreSQL runtime | E | E | E |
| Provider rights + controlled (fail-closed) egress | E | E | E |
| Five-part ingestion identity + idempotency token | E | E | E |
| Immutable transactions with reversing corrections | I | I | I |
| FIFO lot accounting | I | I | I |
| Exact reconciliation of cash, lots, positions, realized P&L, valuations, and projections | I | I | I |
| DEC-006 controlled provider egress | E | E | E |
| DEC-006 source-defined ingestion identity/idempotency | E | E | E |
| DEC-006 local secret lifecycle | E | E | E |
| DEC-006 immutable/redacted evidence policy | E | E | E |
| DEC-006 bounded financial precision policy | E | E (values deferred; control required) | E |
| DEC-006 diagnostic redaction | E | E | E |
| Accessibility / WCAG-oriented UI | E | E | E |
| Legacy-as-evidence only (never target requirement) | E | E | E |
| Architecture stays Proposed; no ADR accepted | E | E (explicit Ring 1 ADR queue) | E |

**The eight required domain order states** (canonical, per the Proposed paper-order state view): Draft, Submitted, Accepted, Partial, Filled, Rejected, Canceled, Expired. The UI display label for the `Partial` domain enum is **Partially Filled**; the frozen schema uses `Partial`.

**Screen verdict:** All nine options are **architecture-compatible but conditionally eligible**. Every option must explicitly inherit immutable transactions with reversing corrections, FIFO lot accounting, and exact reconciliation. GPT and MAI options must additionally inherit the complete eight-state transition contract. No option may advance to WBS/IMS drafting until the selected strategy's Ring 1 elaboration checklist in §2.1 is complete.

### 2.1 Mandatory Ring 1 elaboration checklist

The selected original or hybrid must produce these explicit artifacts before WBS/IMS drafting:

- the eight domain states and every allowed source-to-target transition, with `Partial` as the enum and **Partially Filled** as its display label;
- the six assessed market providers and four official economic adapter families, with each source marked Approved, Pending, or Rejected and with its rights revalidation and fixture-only plan;
- immutable transaction and reversing-correction rules, FIFO lot rules, and exact reconciliation acceptance criteria;
- a minimal integration-test list proving five-part identity/idempotency, fail-closed egress, explicit outage failure, and one reproducible P0 backtest sample with configuration and result hashes; and
- all six DEC-006 controls: controlled egress, ingestion identity/idempotency, local secret lifecycle, evidence policy, financial precision, and diagnostic redaction.

---

## 3. Comparison scoring matrix

### 3.1 Rubric

Each strategy is scored **1–5 on ten dimensions**. Scores are **relative, qualitative judgments** derived by reading the artifacts against the canonical objective — they are **not** measured quantities and imply **no** false numeric precision. Treat them as ordinal bands (1 = weakest / least favorable, 5 = strongest / most favorable *for that dimension as framed*). All scales are oriented so that **5 is always the most favorable outcome**:

- **Objective coverage** — breadth and completeness against the named functional groups. 5 = broadest complete coverage.
- **Time** — elapsed time to a defensible result. 5 = shortest.
- **Cost** — effort + operating + token cost. 5 = lowest cost.
- **Risk reduction** — how much delivery/ambiguity/compliance risk the strategy retires. 5 = most risk retired.
- **Provider/legal rigor** — depth of rights review, revalidation, egress control, acknowledgment records. 5 = most rigorous.
- **Data/accounting integrity** — identity/idempotency, vintage truth, ledger precision/reconciliation explicitness. 5 = strongest.
- **Accessibility/quality** — WCAG coverage and test/evidence rigor. 5 = strongest.
- **Operations** — observability, readiness, diagnostics, backup/restore depth. 5 = strongest.
- **Planning clarity** — explicitness of work packages, dependencies, sequencing, invalidation conditions. 5 = clearest.
- **Implementation complexity** — oriented as *manageability*: 5 = **lowest** complexity / simplest to execute; 1 = most complex.

A per-row **qualitative confidence** (High / Med / Low) reflects how directly the artifact's own text supports the scores (higher when the producer enumerates specifics; lower when it relies on generic language).

### 3.2 Scores

| ID | Obj cov | Time | Cost | Risk red | Prov/legal | Data/acct | Access/qual | Ops | Plan clarity | Impl (simplicity) | Confidence |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| GPT-LC | 3 | 4 | 5 | 3 | 3 | 4 | 3 | 3 | 4 | 5 | Med-High |
| GPT-ST | 3 | 5 | 4 | 3 | 3 | 4 | 4 | 3 | 4 | 3 | Med |
| GPT-MC | 5 | 2 | 2 | 5 | 5 | 5 | 5 | 5 | 4 | 2 | Med-High |
| CLAUDE-LC | 4 | 4 | 5 | 4 | 3 | 5 | 3 | 3 | 5 | 5 | High |
| CLAUDE-ST | 4 | 5 | 4 | 4 | 3 | 5 | 4 | 3 | 5 | 3 | High |
| CLAUDE-MC | 5 | 2 | 2 | 5 | 5 | 5 | 5 | 5 | 5 | 2 | High |
| MAI-LC | 3 | 4 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 5 | Med |
| MAI-ST | 3 | 5 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | Med |
| MAI-MC | 4 | 2 | 2 | 4 | 4 | 4 | 4 | 4 | 3 | 2 | Med |

**Reading the table:** Higher is better on every column including "Impl (simplicity)". The Most Comprehensive rows intentionally score low on Time, Cost, and simplicity because they trade those for coverage, rigor, and risk reduction. The Least Cost rows invert that trade. Confidence tracks artifact explicitness: Claude scores High because it enumerates states, provider counts, work-package dependency tables, and invalidation conditions; MAI scores Med because it uses more generic language and does not enumerate the order states or provider counts.

---

## 4. Critical review of producer claims

- **Provider counts (correction applied).** The canonical grounding defines **six market-data providers assessed** (yfinance/Yahoo, Alpha Vantage, Tiingo, Alpaca IEX, EODHD, Stooq) plus **four official economic adapter families** (FRED/ALFRED, BLS, BEA, Treasury Fiscal Data). **Full integration is only for rights-approved sources**; assessed-but-rejected providers (e.g., Tiingo for durable free storage) remain documented evidence, not code paths. Only the **Claude** artifact enumerates the 6 + 4 counts explicitly and correctly. **GPT** and **MAI** describe a generic "rights-approved provider set" without stating the counts; this is not wrong, but it is less verifiable and is reflected in their lower provider/legal confidence.
- **Eight order states (correction applied).** The complete domain set is **Draft, Submitted, Accepted, Partial, Filled, Rejected, Canceled, Expired**; **Partially Filled** is the UI label for `Partial`. Only **Claude** enumerates all eight in every strategy. GPT ("draft-to-confirm") and MAI ("terminal state transitions") describe the lifecycle at a higher abstraction, so their options remain conditional until the full transition contract is inherited explicitly.
- **Ledger floor (correction applied).** Every option must explicitly inherit immutable transactions with reversing corrections, FIFO lot accounting, and exact reconciliation. Relative Data/accounting scores compare depth beyond this common floor; they do not permit substitutes such as "FIFO or equivalent."
- **Fixture semantics (correction applied).** Fixtures are explicitly selected bootstrap, test, or offline datasets. A live-provider outage must fail the job visibly and must never switch an in-progress dataset silently to fixtures; there is no within-dataset provider failover.
- **Backtest priority.** All three producers keep the backtest in scope in every strategy; none defers it. Claude is most explicit that even the Least Cost slice ships a reproducible single-rule backtest MVP (benchmark, cost/slippage, next-session-open timing, configuration hash, summary metrics). This matches the P0 requirement.
- **MAI artifact quality.** The MAI decomposition is internally consistent but the least detailed: generic bullet lists rather than dependency-mapped work-package tables, no enumerated states or provider counts, and minor typographical slips ("Accessiblity", "target State"). Scores and confidence reflect reduced planning-clarity depth, not a compliance defect.
- **GPT artifact quality.** GPT provides clear outcome-level work packages and disciplined constraint framing, but stops short of dependency tables and explicit state/provider enumeration that would raise its planning-clarity and provider-rigor confidence to High.

---

## 5. Consensus, divergence, unique insights, contradictions

### 5.1 Consensus across all three models

- The non-negotiable floors are identical and fixed: research-only, no broker, local WSL/kind/Kubernetes/PostgreSQL, five-part identity + idempotency, fail-closed egress, provider revalidation, DEC-006 precision/evidence/diagnostic controls, WCAG-oriented UI, legacy-as-evidence, and Proposed-only architecture.
- All three rank the strategies the same way on the core trade: Least Cost = lowest cost/effort; Shortest Time = fastest via parallelization; Most Comprehensive = broadest but slowest and most expensive.
- All three treat provider rights as a **blocking prerequisite** (a gate before any live provider call), not downstream polish.
- All three fold legacy analysis into a one-time evidence/risk-register reading rather than a coded migration, except Claude-MC which elevates legacy-to-target traceability to a first-class governance artifact.

### 5.2 Divergence

- **Explicitness of the order lifecycle and provider set:** Claude enumerates; GPT and MAI abstract.
- **Parallelization model:** GPT-ST and MAI-ST rely on broad parallel lanes; Claude-ST formalizes three named concurrent streams with a *frozen schema contract* as the integration control.
- **Governance depth:** Claude-MC produces an explicit **queued Ring 1 ADR slate** (precision/rounding, evidence retention, provider allowlist) for human approval; GPT-MC and MAI-MC describe keeping decisions open but do not itemize the ADR queue.
- **Cost framing of Most Comprehensive:** GPT-MC rates operating cost HIGH; Claude-MC and MAI-MC land at MEDIUM-to-HIGH, reflecting slightly different assumptions about ongoing quota/observability burden.

### 5.3 Unique insights by model

- **GPT-5.4:** Strongest articulation that cost pressure must never trim compliance controls — it explicitly reclassifies rights, secrets, precision, diagnostics, accessibility, and observability as *fixed* scope even under Least Cost.
- **Claude Sonnet 5:** Only model to (a) enumerate all eight states and the 6 + 4 provider set, (b) gate the adapter call path behind the rights flag **at code level, not just process level**, and (c) treat legacy-to-target mapping as a reviewable governance artifact.
- **MAI-Code-1.1-Flash:** Cleanest compact framing of the rights-based provider registry with revalidation schedules, and a pragmatic "technical-debt capture" gate step in its Shortest-Time path.

### 5.4 Contradictions and risks

- **No direct contradictions** on the non-negotiables — the models agree on the floors.
- **Apparent tension, not contradiction:** GPT/MAI's generic provider language vs. Claude's explicit 6 + 4 count. Resolved in favor of the canonical 6 + 4 grounding; the generic descriptions are compatible supersets.
- **Risk — verifiability of implicit constraints:** Selecting GPT or MAI as written would carry the 8-state lifecycle and provider counts implicitly; Ring 1 elaboration must make them explicit before any gate evidence is credible.
- **Risk — parallel-stream drift** (all ST strategies): mitigated only if a frozen schema/interface contract is held stable (Claude-ST states this explicitly; GPT-ST and MAI-ST imply it).

---

## 6. Cross-model pattern comparison by strategy family

### 6.1 Least Cost family (GPT-LC vs CLAUDE-LC vs MAI-LC)

All three converge on a single narrow but complete vertical slice with the full control set retained. **CLAUDE-LC** is the strongest of the family because it explicitly ships the full 8-state machine and a reproducible backtest MVP while still rating LOW effort/cost, and it maps work-package dependencies. **GPT-LC** matches on discipline (controls are fixed scope) but abstracts the lifecycle. **MAI-LC** is the leanest description but the least verifiable. Common risk: single-provider fragility. Explicit fixture mode supports bootstrap, test, and offline work, but a live-provider outage fails the job and never triggers silent fixture failover.

### 6.2 Shortest Time family (GPT-ST vs CLAUDE-ST vs MAI-ST)

All three optimize elapsed time through parallelization and front-loaded accessibility/security. **CLAUDE-ST** is the strongest because it names three concurrent streams, freezes a schema contract to prevent divergence, and code-gates the rights flag. **GPT-ST** relies on broad parallel lanes with review checkpoints. **MAI-ST** adds an explicit debt-capture gate but is the least detailed on interface control. Common risk: coordination/integration drift if the shared contract is not held stable.

### 6.3 Most Comprehensive family (GPT-MC vs CLAUDE-MC vs MAI-MC)

All three target the full named functional scope with the richest evidence model and highest cost/time. **CLAUDE-MC** leads: it assesses all six market providers (integrating only approved ones), integrates the four official economic adapters, ships a rule-contract library plus full backtest engine, and queues an explicit Ring 1 ADR slate. **GPT-MC** is comparably broad and disciplined but does not itemize the ADR queue or provider counts. **MAI-MC** is directionally complete but less granular. Common risk: schedule/token overrun and ADR-review multiplication; all three mitigate by fixing scope to named functional groups only.

---

## 7. Hybrid candidates

Hybrids are constructed only from **compatible** elements of the nine originals and preserve every non-negotiable. None defers P0 backtesting or any required order state. Hybrids are **advisory constructions for the reviewer**, not selected plans.

### 7.1 Hybrid A — "Guarded Thin Slice" (RECOMMENDED, advisory only)

**Composition:** CLAUDE-ST spine (three parallel streams, frozen schema contract, full 8-state lifecycle + reproducible backtest MVP in the first slice, accessibility built in from the first UI commit) + **Claude's code-level rights-flag gate** + **GPT's fail-closed rights/egress and compliance-as-fixed-scope discipline** (rights, secrets, precision, diagnostics, accessibility, observability never trimmed) + a **queued Ring 1 ADR slate** (Claude-MC) for precision/rounding, evidence retention, and provider allowlist.

**Best fit:** A fast, defensible, end-to-end local slice that proves the whole operating model (ingest → snapshot analytics → reproducible backtest → confirm-gated 8-state paper order → immutable/reversing FIFO ledger with exact reconciliation) while keeping every control explicit and every architecture decision Proposed and queued for human ADR approval.

**Why preferred:** It captures the fastest defensible path (ST) without sacrificing the explicitness and integrity that only the Claude artifacts make verifiable, and it inherits the MC governance discipline (queued ADRs, enumerated states/providers) at first-slice scope rather than full-scope cost. It scores well on Time, Data/accounting integrity, Planning clarity, and Accessibility without incurring MC cost/time.

**Downsides / trade-offs:** Parallel streams add coordination overhead; the frozen schema contract must be held stable or the time savings evaporate. Single-provider first slice remains fragile. Explicit fixture mode permits bootstrap, test, and offline execution, but provider outage fails the live job rather than switching datasets. Provider rights must be confirmed before live adapter work or that stream remains explicitly fixture-only, delaying the "real ingested instrument" demo.

**Invalidation conditions:** Capacity below three accountable stream owners; no designated frozen-schema custodian; inability to hold the schema contract stable; no rights-approved provider before live-adapter work starts; or a stakeholder requirement for multi-provider resilience or a multi-rule comparative backtest *before* first release (push toward a Comprehensive path).

#### Hybrid A pre-DP-4 dependency and capacity map

| Dependency / control | Accountable owner | Trigger or acceptance criterion | Invalidation response |
| --- | --- | --- | --- |
| Frozen domain/API/schema contract | One designated schema custodian | Canonical states/transitions, five-part identity, ledger rules, and OpenAPI/event contracts are versioned before parallel work | Do not parallelize; use CLAUDE-LC/Hybrid B sequencing |
| Provider rights and egress gate | Provider/compliance stream owner | At least one provider is Approved and code-level allowlist/rights checks fail closed before any live call | Keep the stream fixture-only; do not claim a live-ingestion slice |
| Data, analytics, and backtest stream | Data/analytics stream owner | Reproducible P0 sample emits configuration and result hashes from point-in-time data | Stop integration until determinism passes |
| Paper order, ledger, and UI stream | Domain/UI stream owner | Eight-state contract, confirmation gate, reversing corrections, FIFO, exact reconciliation, and accessibility checks pass | Stop integration until the contract passes |
| Cross-stream integration | Schema custodian plus all stream owners | Three streams integrate against the same frozen contract without compatibility exceptions | Abandon time-saving claim and sequence remaining work |

Hybrid A requires one accountable owner for each of the three concurrent streams; the schema custodian may also own one stream but remains the sole contract authority. The rights gate is event-based rather than calendar-based: no live adapter implementation starts before approval evidence exists.

### 7.2 Hybrid B — "Lean Compliant Core"

**Composition:** CLAUDE-LC / GPT-LC sequential lean build (single market adapter + FRED, full 8-state lifecycle, single-rule backtest MVP) + **MAI/Claude provider-registry documentation rigor** grafted as documentation-only (assess the 6 + 4 set on paper, integrate only the approved subset).

**Best fit:** Lowest cost and token footprint while still producing the full-set due-diligence evidence trail.

**Downsides / trade-offs:** Slowest to reach provider breadth; the documentation overhead can exceed a strict Least Cost budget; no built-in second adapter if the chosen provider's rights are revoked.

**Invalidation conditions:** Need for demonstrated multi-provider resilience or multi-rule comparison before release; budget that cannot absorb the added documentation pass.

### 7.3 Hybrid C — "Comprehensive with Fast First Slice"

**Composition:** CLAUDE-MC scope target (6-provider assessment, 4 economic adapters, rule-contract library, full backtest engine, IV&V traceability, queued ADR slate) sequenced through an **ST first-slice smoke/demo gate** before the comprehensive widening begins.

**Best fit:** Programs that ultimately need full coverage but want an early demonstrable checkpoint to de-risk the broad build.

**Downsides / trade-offs:** Longest total time and highest cost/token footprint; greatest scope-creep exposure; heaviest review/ADR cycle load.

**Invalidation conditions:** Hard deadline or capped budget incompatible with full scope; inability to staff subsystem-owned parallel streams.

---

## 8. Human choice table (nine originals + three hybrids)

| Option | Best fit (concise) | Primary trade-off |
| --- | --- | --- |
| GPT-LC | Lean compliant slice with controls fixed as scope | Conditional: lifecycle and ledger floor require explicit inheritance |
| GPT-ST | Fast parallel slice, compliance front-loaded | Conditional: lifecycle/ledger inheritance plus coordination burden |
| GPT-MC | Broad coverage, strong ambiguity reduction | Conditional: lifecycle/ledger inheritance; high time/cost |
| CLAUDE-LC | Most explicit lean slice (full 8 states + backtest MVP) | Conditional: ledger floor inheritance; single-provider fragility |
| CLAUDE-ST | Fastest *verifiable* slice (named streams, frozen schema) | Conditional: ledger floor inheritance; parallel drift risk |
| CLAUDE-MC | Broadest, most rigorous, queued Ring 1 ADR slate | Conditional: ledger floor inheritance; highest time/cost |
| MAI-LC | Compact minimal prototype path | Conditional: lifecycle and ledger floor require explicit inheritance |
| MAI-ST | Rapid demo with explicit debt-capture gate | Conditional: lifecycle/ledger inheritance; generic interfaces |
| MAI-MC | Durable local platform with broad controls | Conditional: lifecycle/ledger inheritance; high cost |
| Hybrid A (recommended) | Fast defensible full-loop slice with explicit controls + queued ADRs | Conditional on §7.1 dependency map and complete floor inheritance |
| Hybrid B | Lowest-cost core with full-set due-diligence evidence | Conditional on complete floor inheritance; slower provider breadth |
| Hybrid C | Full coverage de-risked by an early first-slice gate | Conditional on complete floor inheritance; highest cost/scope risk |

All twelve options are architecture-compatible and conditionally eligible. None defers P0 backtesting, but explicit inheritance of the floors identified in §2 is required before WBS/IMS drafting.

---

## 9. DP-4 decision

**Selected option:** **MAI-ST — Shortest Time**, selected by the Workspace Owner on 2026-09-10.

**Disposition:** The human selected an original decomposition rather than the advisory Hybrid A recommendation. MAI-ST optimizes elapsed time through parallel work and carries an explicit technical-debt capture gate, while accepting its lower interface-contract detail as a Ring 1 elaboration obligation.

**Conditions retained:** MAI-ST remains architecture-compatible and conditionally eligible. Before WBS/IMS drafting, its Ring 1 elaboration must satisfy §2.1, including the complete eight-state transition contract, six market and four economic provider assessment, complete immutable/reversing FIFO reconciliation floor, reproducibility tests, and all six DEC-006 controls. DP-4 selection does not authorize Ring 1 entry or implementation; the Ring 0 exit gate remains separate.

---

## 10. Notes and caveats

- Scores in §3 are ordinal, qualitative judgments, not measurements; do not aggregate them into a single ranked total as if they were precise quantities.
- Where GPT and MAI describe the order lifecycle or provider set abstractly, Ring 1 elaboration must make the eight states and the 6 + 4 provider assessment explicit before any gate evidence is treated as credible.
- Fixtures are explicit bootstrap, test, or offline datasets only. A live-provider outage fails the job and never silently changes the dataset to fixtures.
- This artifact records the DP-4 selection but does not modify any producer decomposition or authorize implementation.
