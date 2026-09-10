## Brainstorm Decomposition — Claude Sonnet 5

**Objective:** GitHub issue #13 — decompose the ETF research prototype program objective (local-first, single-user, research-only ETF trade-recommendation workbench with hypothetical paper-portfolio accounting) into three independent, competing strategies per `.github/skills/brainstorming.md` §4.
**Model:** Claude Sonnet 5 (Anthropic), operating as an independent Ring 0 brainstorm producer.
**Date:** 2026-09-10

---

### Model identity and assumptions

- **Model identity:** This decomposition is produced by Claude Sonnet 5, working independently of any other model's output. No other file under `docs/Planning/brainstorm/` was read before or during this analysis, per the task instruction and the brainstorming protocol's requirement that models not see each other's work.
- **Grounding read:** Only the canonical sources listed in the task were read: `program-narrative.md`, `objective-summary.md`, the Objective feature file, the three Legacy-Code evidence feature files, and the seven proposed architecture views (component, deployment, domain model, ingestion sequence, paper-order sequence, analytics/backtest activity, paper-order state). No other planning, brainstorm, or governance artifact was consulted.
- **Non-negotiable constraints assumed as fixed across all three strategies** (none of the strategies below vary these; they are floors, not trade-offs):
  1. Research-only system; the paper portfolio is hypothetical. No brokerage connector, no credentials for a brokerage, no real-order endpoint, and no order-transmission path in any strategy, at any scope level.
  2. Every paper order requires explicit user confirmation; no automatic mutation from a displayed signal.
  3. Target deployment is local WSL Ubuntu + kind/Kubernetes + PostgreSQL; no public load balancer, no Azure, no HA/DR.
  4. Ingestion identity is the five-part key (instrument, trading date, provider, adjustment policy, revision) plus an idempotency token/job identity — never a legacy (Symbol, Date) key.
  5. Secrets are local-only (Kubernetes Secrets), scoped to the adapter workload, excluded from Git/images/logs/diagnostics/client bundles.
  6. Financial precision, evidence retention duration, and rounding mode remain **Ring 1 ADR decisions** (per DEC-006 framing referenced in the architecture views) — every strategy below defers the exact values but requires the controls (bounded numeric types, canonical precision/scale, one documented rounding mode, reconciliation test vectors, immutable hash-verified evidence, redacted diagnostics) to be designed for.
  7. UI must be WCAG-oriented: keyboard navigation, visible focus, semantic structure, non-color-only status communication, and the persistent "Research only — hypothetical — user makes all investment decisions" disclaimer.
  8. Provider rights are time-bound and must be revalidated before any operational dependency; organizational-use ingestion stays disabled until rights are confirmed.
  9. Legacy `.NET`/SQL Server evidence (Yahoo HTML scraping, regex extraction, `Id`-keyed SQL Server insert, WinForms tester, console lookback) is migration evidence only — never copied forward as a target requirement.
  10. Architecture remains **Proposed** in all three strategies. No strategy proposes accepting an ADR; each strategy explicitly identifies which Ring 1 ADRs it would need and defers acceptance to human review.
- **What varies between strategies:** scope breadth (which functional groups are built first and how deep), team/agent shape, sequencing aggressiveness, and the depth of governance/quality/test investment. The three strategies are independent alternatives, not phases of one plan — a reader should be able to pick exactly one and execute it standalone.
- **Units:** "Work package" below means a coherent bundle of related capability, not a task-level WBS line. Per `.github/skills/brainstorming.md` §4, no WBS/IMS is produced here.

---

## 1. Least Cost

### Objective interpretation

Minimize total effort, agent/model usage, and infrastructure surface while still producing a usable, evidence-bearing research and paper-portfolio prototype that satisfies the Objective PDF's *high-priority* requirements (O-REQ-001 through O-REQ-005, O-REQ-007 through O-REQ-009) once at minimum viable depth. Read the objective as: "prove the local-first, research-only, provenance-preserving vertical slice with the smallest defensible footprint," not "cover every functional group named in the PDF."

### Scope and explicit deferrals

**In scope:**
- One market-data provider path (a single official/rights-confirmed adapter, e.g., a fixture-first adapter validated against one provider such as Stooq or EODHD under personal-use terms) plus the fixtures-first fallback — not the full 6-market-provider assessment.
- One economic adapter (FRED/ALFRED only — it is the most complete official API of the four named) rather than all four (FRED, BLS, BEA, Treasury).
- Watchlist CRUD, reorder, dedupe, symbol validation — full O-REQ-003 coverage since it gates everything downstream and is cheap relative to its leverage.
- A single deterministic analytics rule contract (one signal rule, not a rule library) run against a point-in-time snapshot, satisfying vintage-cutoff and reproducibility requirements narrowly, plus a minimal reproducible backtest for that one rule: point-in-time inputs, one benchmark comparison, cost/slippage assumptions, next-session-open fill timing, a configuration hash, and the required summary metrics. The backtest is narrow in breadth (one rule, one benchmark) but not deferred — it ships in the initial strategy scope per the Objective PDF's P0 backtesting requirement.
- Paper-order draft → confirm → simulate-fill → ledger append, covering the full 8-state machine (Draft, Submitted, Accepted, Partially Filled, Filled, Rejected, Canceled, Expired) and its source transitions, because the state machine itself is not expensive to implement completely and partial coverage would leave an unconfirmed-mutation risk.
- Minimum viable WCAG behaviors: keyboard nav, visible focus, semantic headings, non-color status, persistent disclaimer.
- Minimum viable ops: health/readiness endpoint gated on migrations + DB connectivity, structured logs, redacted diagnostic export.

**Explicit deferrals:**
- Multi-rule backtest comparisons, parameter-sweep/optimization tooling, and walk-forward analysis — the single-rule backtest MVP ships, but comparing it against alternative rules does not.
- Multi-provider fallback/failover logic beyond the single adapter + fixture.
- BLS/BEA/Treasury adapters.
- Cron-scheduled/automatic ingestion — manual/on-demand ingestion trigger only (still resumable, still idempotent).
- Full observability stack (traces, dashboards) — logs and a health endpoint only, no metrics dashboard.
- Any second UI theme/responsive breakpoint beyond the required 1280x720 usability floor.

### Work packages

| # | Work Package | Outcome | Dependencies |
|---|---|---|---|
| 1 | Local platform bootstrap | WSL + kind cluster, PostgreSQL via PVC, migration Job, ConfigMap/Secret skeleton, localhost-only ingress | None |
| 2 | Catalog & watchlist slice | Symbol validation, watchlist CRUD/reorder/dedupe, persisted to PostgreSQL | WP-1 |
| 3 | Single-provider ingestion path | One market adapter + fixture fallback, five-part identity + idempotency token, unique/check constraints, DQ quarantine states | WP-1, WP-2 |
| 4 | Single economic adapter (FRED) | Vintage-aware observation storage, release-timestamp cutoff logic, versioned transformation (no overwrite) | WP-1 |
| 5 | Deterministic analytics & backtest MVP slice | One rule contract, point-in-time snapshot assembly, evidence hash, blocked-run-on-bad-data behavior, plus minimal backtest (benchmark, cost/slippage, next-session-open timing, configuration hash, required summary metrics) | WP-3, WP-4 |
| 6 | Paper-order + ledger slice | Full 8-state order lifecycle (Draft, Submitted, Accepted, Partially Filled, Filled, Rejected, Canceled, Expired) with confirm-gated transitions and ledger append, reconciliation within configured precision | WP-5 |
| 7 | Provider policy & rights gate | Settings acknowledgment record, rights/terms capture, organizational-use disable switch, default-deny egress allowlist | WP-3, WP-4 |
| 8 | Accessibility & disclaimer baseline | Keyboard/focus/semantic/non-color UI pass, persistent research-only banner | WP-2, WP-6 |
| 9 | Ops & diagnostics baseline | Readiness gate on migration+DB, structured logs, redacted diagnostic export, secret-exclusion checks | WP-1, WP-7 |

### Sequencing / dependencies

WP-1 → WP-2 → {WP-3, WP-4 in parallel} → WP-7 (rights gate must land before WP-3/4 go live, so in practice WP-7's policy contract is authored alongside WP-3/4 and enforced before their first real provider call) → WP-5 → WP-6 → WP-8/WP-9 (can run in parallel with WP-6 once WP-5 evidence hashing exists).

### Parallelization

Limited — this strategy assumes a single small team/agent pair, so most work is sequential. The only genuine parallel opportunity is WP-3 (market adapter) and WP-4 (FRED adapter), which share no code path, and WP-8/WP-9 once WP-6 is functionally complete.

### Legacy analysis role

Legacy evidence is consulted only to avoid repeating known-bad assumptions cheaply: the (Symbol, Date) identity gap (O-LEG-004) directly justifies the five-part identity design in WP-3 at no extra cost since it's designed in from the start rather than retrofitted; the regex/HTML scraping evidence (O-LEG-001/002) justifies choosing an official adapter contract over scraping; the missing-scheduler evidence (O-LEG-006) justifies keeping ingestion manual-trigger rather than building a scheduler neither the legacy system nor this strategy's budget can prove out. No dedicated legacy-migration work package is budgeted — the mapping is a one-time reading exercise reflected in design notes, not a coded migration.

### Provider/legal approach

Single-provider minimalism: confirm rights for exactly one market adapter and FRED before any ingestion runs; organizational-use ingestion stays disabled by default; the settings-acknowledgment record is implemented once and reused. This minimizes legal surface area (one terms review instead of ten) at the cost of adapter diversity and resilience.

### Accessibility / security / observability / test approach

- **Accessibility:** WCAG-oriented baseline only — keyboard, focus, semantics, non-color, disclaimer. No dedicated accessibility audit tooling budgeted; manual keyboard-only pass before gate.
- **Security:** Default-deny egress allowlist and local-only Secrets are non-negotiable and cost little to build correctly from the start; no dedicated penetration test or threat-model workshop budgeted beyond the existing `docs/Security/threat-model.md` baseline.
- **Observability:** Logs + health/readiness endpoint only; no metrics/tracing stack.
- **Test approach:** Unit tests on the five-part identity/idempotency logic, the paper-order state machine, and reconciliation math (highest-risk logic); a small number of integration tests proving migration + readiness + one ingest + one paper-order round trip. No full BDD-to-code traceability sweep across all Gherkin scenarios — only the representative acceptance scenarios directly tied to shipped scope.

### Major risks and mitigations

| Risk | Mitigation |
|---|---|
| Single-provider dependency means a provider outage blocks all research | Fixture-first fallback is mandatory (already in scope); document explicitly-fail-not-succeed-with-zero-rows behavior |
| Narrow test coverage misses edge cases in reconciliation | Concentrate the limited test budget on ledger/reconciliation math specifically, since it's the highest-consequence logic per O-MET-004 |
| Single-rule backtest MVP may not generalize once additional rules are added | Document explicitly that the backtest MVP validates only the one shipped rule; expanding to a rule-contract library with comparative backtesting is a deliberate future addition, not assumed to already exist |
| Minimal accessibility tooling may miss subtle WCAG gaps | Manual keyboard-only walkthrough is a mandatory pre-gate check, documented in gate evidence |

### Quality / gate evidence

- Ring 0/1 gate evidence: rights-acknowledgment record for the one market adapter + FRED; five-part identity migration test against empty and populated datasets; readiness gate proof (pods ready only after migration + DB connectivity); redacted-diagnostic export sample with automated secret-absence test; reconciliation test vectors at configured precision; backtest configuration-hash reproducibility proof (same config/seed reproduces identical summary metrics) for the single shipped rule.
- No IV&V-level (Ring 3) comprehensive audit budgeted in this strategy; gate evidence is scoped to Ring 0–2 minimum-viable proof.

### Relative effort / time / cost

- **Relative effort:** LOW
- **Relative elapsed time:** SHORT-to-MEDIUM (single provider + single rule contract shortens build time, but the full paper-order state machine, identity/idempotency correctness, and the minimal backtest MVP are not trivial)
- **Relative operating cost:** LOW — one provider quota to manage, one adapter to monitor, smallest cluster footprint (the analytics worker runs only a single-rule backtest MVP rather than a full rule-contract library, keeping its profile light)

### AI/token considerations

Smallest of the three strategies to execute with AI agent assistance: one rule contract, one provider adapter, and one economic adapter mean less context to hold per work package and fewer cross-cutting design conversations. Suitable for a single agent or small agent pair working mostly sequentially; low risk of context fragmentation. Fewer decision-review cycles needed (fewer ADRs proposed) reduces alternate-model review token spend.

### Conditions that invalidate this strategy

- If the objective requires demonstrating multi-provider resilience or comparative signal validation across multiple rules before any release — this strategy ships only a single-rule backtest MVP and would need a rule-contract library to satisfy comparative backtesting.
- If a stakeholder requires BLS/BEA/Treasury economic context (e.g., inflation- or GDP-adjusted analytics) — this strategy only covers FRED.
- If the single chosen market-data provider's rights are denied or revoked during revalidation — the strategy has no built-in second adapter and would need immediate scope renegotiation.
- If organizational (multi-analyst) use is required rather than strictly personal/single-user research — this strategy's minimal provider-policy work package assumes personal use is the default operating mode.

---

## 2. Shortest Time

### Objective interpretation

Minimize elapsed time to the earliest usable, demonstrable vertical slice — a working local deployment where a user can see one real ingested instrument, one signal, and complete one paper-order round trip — even if scope is narrower than Least Cost in some dimensions and broader in others (accepting higher parallel-team cost to compress the calendar). Read the objective as: "get a thin, safe, end-to-end slice running locally as fast as possible, then widen."

### Scope and explicit deferrals

**In scope (first-slice, aggressively parallelized):**
- Local platform bootstrap (WSL/kind/PostgreSQL/migration Job) built in parallel with application code rather than gating it.
- One market adapter + fixture fallback with the five-part identity from day one (not retrofitted — retrofitting the identity model later would be slower than building it right the first time).
- One analytics rule, applied to a snapshot, with evidence hashing, plus a minimal reproducible backtest for that one rule (benchmark comparison, cost/slippage assumption, next-session-open fill timing, configuration hash, required summary metrics) built into the first slice rather than deferred.
- Full 8-state paper-order lifecycle (Draft, Submitted, Accepted, Partially Filled, Filled, Rejected, Canceled, Expired) and its source transitions built into the first slice — every required state is present and confirm-gated from day one; only uncommon edge-case richness (e.g., complex multi-fill sequencing) is thinner at first pass and deepened in fast-follow.
- WCAG baseline and disclaimer built alongside UI from the start (retrofitting accessibility later is slower, not faster).
- Provider-policy gate built in parallel with the adapter (same rationale as Least Cost's WP-7, but staffed as a concurrent stream here instead of a sequential step).

**Explicit deferrals (pushed past the first usable slice, not eliminated):**
- Second/third market provider and any economic adapter beyond FRED — added in a fast-follow package after the first slice is demonstrable.
- Multi-rule backtest comparisons and parameter-sweep/optimization tooling — the single-rule backtest MVP ships in the first slice, but comparing it against alternative rules is fast-follow.
- Deep edge-case richness within the 8-state paper-order lifecycle (e.g., complex multi-fill sequencing, rare cancel/expire race conditions) — every state and its source transitions ship in the first slice; only uncommon-path depth is deferred.
- Deep observability (dashboards) — minimum logs/health only for first slice.

### Work packages

| # | Work Package | Outcome | Dependencies |
|---|---|---|---|
| 1 | Platform bootstrap (fast track) | kind cluster, PostgreSQL PVC, migration Job, readiness gate — built to "just enough to unblock app work" | None |
| 2 | Provider policy gate (parallel stream) | Rights-acknowledgment record + egress allowlist skeleton, built concurrently with WP-3 | None (parallel with WP-1) |
| 3 | Single-provider ingestion (parallel stream) | One adapter + fixture, five-part identity, idempotency token | WP-1 (DB), WP-2 (policy) |
| 4 | Watchlist slice (parallel stream) | CRUD/reorder/dedupe/validation | WP-1 |
| 5 | Analytics & backtest MVP slice | One deterministic rule, snapshot assembly, evidence hash, plus minimal backtest (benchmark, cost/slippage, next-session-open timing, configuration hash, required summary metrics) | WP-3 |
| 6 | Paper-order full lifecycle slice | Full 8-state machine (Draft, Submitted, Accepted, Partially Filled, Filled, Rejected, Canceled, Expired) with confirm-gated transitions built in the first slice; uncommon edge-case richness deepened in fast-follow | WP-5 |
| 7 | Accessibility-by-default UI pass | Keyboard/focus/semantics/non-color built into WP-4/WP-6 UI, not bolted on after | WP-4, WP-6 |
| 8 | First-slice smoke/demo gate | End-to-end local demo: bootstrap → ingest → signal → confirm paper order → ledger check | WP-1..7 |
| 9 | Fast-follow widening package | Second provider, one more economic adapter, multi-rule backtest comparisons, deepened edge-case richness for uncommon paper-order transitions | WP-8 |

### Sequencing / dependencies

Critical path: WP-1 and WP-2 start simultaneously (day 0) → WP-3 and WP-4 start as soon as WP-1's DB is reachable (do not wait for full platform polish) → WP-5 depends only on WP-3 → WP-6 depends only on WP-5 → WP-7 runs alongside WP-4/WP-6 as those UI surfaces are built, not after → WP-8 is the gate checkpoint → WP-9 is explicitly out of the "shortest time" critical path and is the first deferred item picked up next.

### Parallelization

This is the defining feature of the strategy. Three concurrent streams from day one:
- **Stream A (Platform):** WP-1
- **Stream B (Policy/Rights):** WP-2, feeding WP-3
- **Stream C (App):** WP-4 (watchlist) can start against a local/dev DB stub before WP-1 is fully hardened, then reconnect to the real cluster

WP-3 and WP-4 can run in parallel once WP-1's DB is minimally reachable. WP-7 (accessibility) is parallelized *into* WP-4 and WP-6 rather than sequenced after them — this is the single biggest time-saver versus Least Cost, since UI accessibility retrofits are typically slower than building it in.

### Legacy analysis role

Same one-time reading exercise as Least Cost, but time-boxed even tighter: the legacy evidence review is scoped to answering exactly the questions that would otherwise slow WP-3 down (is there a proven unique key? no — so build the five-part identity now; is there a proven scheduler? no — so don't build one now). No separate legacy-migration work package; the finding is folded directly into WP-3's design notes to avoid a second review pass later.

### Provider/legal approach

Identical single-adapter-plus-FRED minimalism to Least Cost for the first slice, but the rights-acknowledgment work (WP-2) is pulled forward and run in parallel with infrastructure instead of gating it sequentially — this is what makes "shortest time" different from "least cost" despite similar first-slice scope: the same work is done, but the org invests in doing it concurrently rather than serially, at higher coordination cost.

### Accessibility / security / observability / test approach

- **Accessibility:** Built in from the first UI commit (WP-7), not deferred — front-loading here is the fast path, since retrofitting keyboard/focus semantics after a UI exists is slower than the alternative.
- **Security:** Default-deny egress and local Secrets are built in WP-2/WP-3 concurrently; no shortcuts taken on secret exclusion since a leak would cause a costly rework/incident response that defeats the "shortest time" goal.
- **Observability:** Minimum logs/health for the first-slice gate (WP-8); deeper observability explicitly deferred to WP-9.
- **Test approach:** A thin but real test slice runs alongside every work package (test-with-code, not test-after) specifically to avoid late-discovered defects that would blow the schedule; the reconciliation and identity/idempotency tests are still mandatory (same high-risk-first-focus as Least Cost) because deferring them risks a late, schedule-destroying rework.

### Major risks and mitigations

| Risk | Mitigation |
|---|---|
| Parallel streams increase integration risk (WP-3/WP-4 diverge on shared DB schema assumptions) | WP-1 publishes a frozen schema contract before WP-3/WP-4 start their DB-touching work |
| Compressing the full 8-state lifecycle and backtest MVP into the first slice under schedule pressure risks shallow edge-case coverage | WP-6 ships all 8 states and source transitions functionally correct and confirm-gated from day one; only uncommon-path depth (e.g., multi-fill sequencing) is explicitly deferred to WP-9, tracked as a committed fast-follow, not an optional nice-to-have |
| Front-loaded accessibility work may slow the very first UI commit | Accepted trade — a slower first commit is preferred over a UI rebuild later; documented as a deliberate strategy choice |
| Concurrent provider-policy and ingestion work could ship before rights are confirmed | WP-3's adapter call path is gated behind WP-2's rights flag at code level, not just process level, so parallel work cannot accidentally bypass the gate |

### Quality / gate evidence

- WP-8's end-to-end smoke/demo gate is the primary evidence artifact: a reproducible local run from clean bootstrap to a confirmed paper order, captured as gate evidence per the constitution's structured-evidence requirement.
- Same reconciliation/identity test vectors as Least Cost are mandatory, not optional, despite the time pressure — they are treated as schedule risk insurance, not schedule cost.
- Backtest configuration-hash reproducibility proof and full 8-state transition coverage tests are captured at WP-8 alongside the smoke/demo gate — both are first-slice gate criteria, not fast-follow items.
- Accessibility gate evidence (keyboard-only walkthrough) is captured at WP-7/WP-8, not deferred.

### Relative effort / time / cost

- **Relative effort:** MEDIUM (more coordination overhead than Least Cost for the same first-slice scope, because of parallel streams; the first slice also carries the full 8-state lifecycle and a single-rule backtest MVP, offset by keeping breadth narrow — one provider, one rule)
- **Relative elapsed time:** SHORT
- **Relative operating cost:** LOW-to-MEDIUM for the first slice (same footprint as Least Cost), rising toward MEDIUM once WP-9's fast-follow lands

### AI/token considerations

Requires more concurrent context management than Least Cost — three parallel work streams mean an orchestrating agent must track cross-stream contracts (e.g., the frozen schema contract) to avoid divergence, which increases coordination token spend even though total code scope for the first slice is similar to Least Cost. Well suited to a small agent team with a shared task list (per the workspace's Agent Teams capability) rather than a single sequential agent, since the parallel streams are the entire point of the strategy.

### Conditions that invalidate this strategy

- If the team/agent capacity cannot actually support three concurrent streams (e.g., a single solo agent with no parallel dispatch capability) — the strategy collapses back into Least Cost's sequencing but keeps its higher coordination overhead, which is strictly worse.
- If the frozen schema contract between WP-1/WP-3/WP-4 is not actually held stable — integration rework would erase the time savings this strategy depends on.
- If the team cannot compress the full 8-state paper-order lifecycle and the single-rule backtest MVP into the first-slice timebox without sacrificing the narrow one-provider/one-rule scope — the schedule assumption underlying this strategy breaks and Least Cost's more sequential approach should be used instead.
- If rights for the single chosen provider are not confirmed by the time WP-3 needs to make its first live call — the parallel schedule assumption breaks and WP-3 reverts to fixture-only, delaying the "real ingested instrument" demo goal.

---

## 3. Most Comprehensive

### Objective interpretation

Maximize coverage, quality, and completeness against the full Objective PDF scope (pages 1–14): all named functional groups (watchlists, market data, economics, analytics, criteria, backtesting, portfolios, UX, operations, AI constraints, export controls), a full 6-market-provider assessment (yfinance/Yahoo, Alpha Vantage, Tiingo, Alpaca, EODHD, Stooq) plus the 4-official-economic-adapter suite (FRED/ALFRED, BLS, BEA, Treasury Fiscal Data), full IV&V-grade testing, and full governance/gate-evidence rigor. Read the objective as: "build the complete proposed target architecture's vertical, with nothing knowingly deferred except items the PDF itself defers (e.g., AI is a 'future, clearly bounded role')."

### Scope and explicit deferrals

**In scope:**
- All four deployables from the proposed component/deployment views: web API, portfolio service, ingestion worker, analytics worker, each independently deployed with its own scaling/readiness posture.
- A full 6-market-provider assessment (yfinance/Yahoo, Alpha Vantage, Tiingo, Alpaca, EODHD, Stooq) plus the 4-official-economic-adapter suite (FRED/ALFRED, BLS, BEA, Treasury Fiscal Data), each with per-provider/adapter rights revalidation and a settings-acknowledgment record, even where a provider is ultimately rejected for durable free storage (e.g., Tiingo per O-COMP-003) — the rejection itself is documented evidence. This strategy assesses all six market providers but integrates only rights-approved ones as code paths; rejected market providers remain evidence, not integrated adapters.
- Full watchlist, ingestion, DQ-quarantine, and resumable-backfill coverage per O-REQ-003/004.
- A rule-contract library (multiple deterministic signal rules) rather than one rule, plus the full backtest engine: cost/slippage/next-open assumptions, benchmark comparison, seed/parameter/code-hash reproducibility per O-MET-007.
- The complete paper-order state machine (all eight states — Draft, Submitted, Accepted, Partially Filled, Filled, Rejected, Canceled, Expired — and all source transitions) with full reconciliation test-vector coverage.
- Full WCAG-oriented UX pass including tablet-size usability (O-ACC-003), non-color warning system for stale/partial/quarantined/incompatible data (O-ACC-006), and persistent disclaimers on every analytical page.
- Full operations: job/outbox observability, stale-symbol tracking, health checks, redacted diagnostics with automated leak tests, backup/restore.
- Full evidence/governance rigor: immutable hash-verified evidence records with configurable retention/archival, IV&V-style test-to-scenario traceability across every Gherkin scenario in all four feature files, and a documented Ring 1 ADR slate (financial precision/rounding mode, evidence retention duration, exact provider allowlist) explicitly queued for human approval — never self-accepted.
- Export controls: user-owned exports subject to provider policy, with automated tests proving redaction.

**Explicit deferrals (only what the PDF itself puts out of scope):**
- Everything the Objective PDF lists as an explicit non-goal on pages 1–2: streaming/intraday feeds, advice/guarantees, real-money operations, paid-data dependencies, options/futures/leverage/margin/shorting/tax support, multi-tenancy, HA/DR, mobile, Azure, backward-compatibility layers. These remain out of scope in every strategy, but this strategy is the most rigorous about documenting each as a deliberate exclusion with a traceability note rather than a silent omission.
- Any capability requiring brokerage credentials, real-order transmission, or provider-side paper-trading APIs — permanently excluded per the non-negotiable constraints, not merely deferred.

### Work packages

| # | Work Package | Outcome | Dependencies |
|---|---|---|---|
| 1 | Full platform bootstrap | All four deployables, migration Job, network policy, default-deny egress with full allowlist, PVC-backed PostgreSQL | None |
| 2 | Watchlist & catalog | Full CRUD/reorder/dedupe/validation with edge-case coverage | WP-1 |
| 3 | Market-provider assessment & multi-provider ingestion | Per-market-provider rights review and settings-acknowledgment records for all 6 named market providers (yfinance/Yahoo, Alpha Vantage, Tiingo, Alpaca, EODHD, Stooq); approved adapters + fixture-first fallback, five-part identity, DQ quarantine, resumable backfill; rejected providers documented as evidence | WP-1, WP-2 |
| 4 | Full economic adapter suite | Rights review and settings-acknowledgment records for all 4 official economic adapter families (FRED/ALFRED, BLS, BEA, Treasury Fiscal Data); vintage cutoff, versioned transformations | WP-1 |
| 5 | Rule-contract library & analytics | Multiple deterministic rule contracts, snapshot assembly, evidence hashing, blocked-run-on-bad-data | WP-3, WP-4 |
| 6 | Full backtest engine | Cost/slippage/next-open assumptions, benchmark comparison, seed/parameter/code-hash reproducibility | WP-5 |
| 7 | Full paper-order & ledger | All eight states, full transition set, reconciliation test vectors at configured precision | WP-5 |
| 8 | Full accessibility & UX pass | Keyboard/focus/semantics/non-color across desktop and tablet, persistent disclaimers, blocking (non-color) DQ warnings | WP-2, WP-7 |
| 9 | Full operations & observability | Job/outbox status, stale-symbol tracking, health checks, redacted diagnostics + automated leak tests, backup/restore | WP-3, WP-4, WP-7 |
| 10 | Governance, IV&V & Ring 1 ADR slate | Full Gherkin-to-test traceability, evidence retention/archival design, queued Ring 1 ADRs (precision/rounding, retention duration, provider allowlist) for human approval | WP-1..9 |

### Sequencing / dependencies

WP-1 (platform) starts at day 0; the rights-review/policy portions of WP-3 and WP-4 (market and economic provider assessment) can begin in parallel with WP-1 since they are paperwork independent of infrastructure, though the ingestion-code portions wait on WP-1. WP-2 (watchlist) depends on WP-1. WP-3 depends on WP-1 and WP-2; WP-4 depends only on WP-1. WP-3 and WP-4 can run in parallel with each other once each has its infrastructure dependency satisfied, since they touch disjoint provider families and code paths. WP-5 depends on both WP-3 and WP-4 (analytics needs both market and economic data). WP-6 and WP-7 both depend on WP-5 and can run in parallel with each other. WP-8 depends on WP-2 and WP-7 (UI needs both watchlist and paper-order surfaces to exist). WP-9 depends on WP-3/WP-4/WP-7 (it observes ingestion and ledger operations). WP-10 is the closing package, depending on everything, and produces the human-facing Ring 1 ADR queue rather than accepting any ADR itself.

### Parallelization

Higher parallelization surface than either other strategy because of scope breadth: the rights-review portions of WP-3/WP-4 run alongside WP-1; WP-3/WP-4 in parallel once infrastructure lands (different provider families, disjoint code paths); WP-6/WP-7 in parallel (backtest engine and paper-order ledger touch different subsystems once WP-5 lands). This strategy benefits most from a multi-agent team structure with clear ownership boundaries per subsystem, since the work packages are large enough to justify dedicated ownership.

### Legacy analysis role

The most thorough of the three: legacy evidence is treated as a first-class input to WP-10's governance package. Every O-LEG finding (regex/HTML scraping evidence, (Symbol, Date) identity gap, machine-bound SQL Server semantics, unverified scheduler, WinForms manual-tester pattern) is traced explicitly to the corresponding target design decision it informs, and that traceability is captured as part of the IV&V evidence bundle — not just a design note. This strategy is the only one that treats the legacy-to-target mapping as its own reviewable governance artifact (O-REQ-010) rather than an incidental design input.

### Provider/legal approach

Full 6-market-provider review plus the 4-official-economic-adapter suite, including documenting rejections (e.g., Tiingo's rejection for durable free storage per O-COMP-003 is recorded as evidence, not silently dropped). Every provider/adapter gets a settings-acknowledgment record regardless of whether it is ultimately used, so the decision trail itself becomes an audit artifact. This is the most legally conservative approach because it proves due diligence was performed across the full named market-provider and economic-adapter set (6 + 4), while only rights-approved market providers are integrated as code paths — rejected market providers remain documented evidence. The four official economic adapters are official government APIs and are assessed and integrated in full.

### Accessibility / security / observability / test approach

- **Accessibility:** Full WCAG-oriented pass across desktop and tablet breakpoints, including the non-color-only blocking-warning system for DQ states — the most complete accessibility investment of the three strategies.
- **Security:** Full default-deny egress allowlist across all approved providers, full secret-exclusion CI checks, and a dedicated review against `docs/Security/threat-model.md` as part of WP-10.
- **Observability:** Full job/outbox status, stale-symbol tracking, health checks, and redacted diagnostics with automated leak-proof tests — the only strategy that budgets dedicated observability work beyond logs+health.
- **Test approach:** Full Gherkin-to-test traceability across all four feature files (Objective + three Legacy-Code evidence files), IV&V-style review, and reconciliation/identity test vectors expanded to cover the full provider and economic-adapter matrix, not just one adapter each.

### Major risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope breadth invites schedule/cost overrun and scope creep | WP boundaries are fixed to exactly the PDF's named functional groups; anything not named in the PDF (e.g., streaming) stays excluded regardless of team enthusiasm |
| Six-market-provider assessment (plus 4 economic adapters) is legally time-consuming and may stall on slow terms reviews | Each provider/adapter review is an independent work item within WP-3/WP-4; a slow provider does not block others, and rejection of a market provider is an acceptable, documented outcome |
| Full backtest engine complexity risks non-determinism bugs | Seed/parameter/code-hash reproducibility (O-MET-007) is a hard acceptance test before WP-6 is considered done |
| Governance/IV&V package (WP-10) becomes a bottleneck at the end | Traceability work is incremental — each WP produces its own Gherkin-to-test mapping as it completes, so WP-10 aggregates rather than starts from zero |

### Quality / gate evidence

- Full structured gate evidence across Ring 0–3: per-provider rights records, five-part identity migration tests (empty + populated), reconciliation test vectors across the full economic/market matrix, reproducibility hash matches (O-MET-007), redacted-diagnostic automated tests, and a complete Gherkin-scenario-to-test traceability matrix.
- WP-10 produces the queued Ring 1 ADR slate (financial precision/rounding mode, evidence retention duration, exact provider allowlist) as a human-approval artifact — this strategy explicitly does not accept any ADR itself, consistent with the "Architecture remains Proposed" constraint.

### Relative effort / time / cost

- **Relative effort:** HIGH
- **Relative elapsed time:** LONG
- **Relative operating cost:** MEDIUM-to-HIGH — 6 market-provider quotas/terms plus 4 economic adapters to track, four independently scaled deployables, and the broadest ongoing observability/ops surface

### AI/token considerations

The largest context and coordination footprint of the three strategies: ten work packages spanning multiple subsystems benefit from a multi-agent team with per-subsystem ownership (per the workspace's Agent Teams capability) rather than a single agent, since holding the full scope in one context window is inefficient and increases the risk of cross-package inconsistency. This strategy also generates the most Ring 1 ADR candidates, which multiplies alternate-model decision-review cycles (each ADR requires cross-model validation per the constitution) — a real token/cost driver that should be weighed against the completeness benefit. Governance/traceability work (WP-10) is itself a token-intensive activity (full Gherkin-to-test mapping) and should be planned incrementally rather than as a single large pass.

### Conditions that invalidate this strategy

- If the program has a hard delivery deadline shorter than the full 6-market-provider/4-economic-adapter build allows — this strategy is not schedule-compatible with an aggressive timeline and Shortest Time should be used instead.
- If budget/token spend is capped below what ten work packages and multiple ADR review cycles require — Least Cost is the correct fallback.
- If several of the six named market providers deny or fail to confirm rights during revalidation — WP-3's scope shrinks to the actually-approved subset, which may cascade into WP-5/WP-6 rule-contract assumptions.
- If the human reviewer at Ring 1 rejects the queued ADR slate outright (e.g., a different rounding mode or retention policy is mandated) — WP-7's reconciliation test vectors and WP-10's evidence-retention design would need rework before gate evidence is valid.

---

## Self-Comparison Table

| Dimension | Least Cost | Shortest Time | Most Comprehensive |
|---|---|---|---|
| Work packages | 9 | 9 | 10 |
| Market data providers | 1 + fixture | 1 + fixture (first slice), 2nd added fast-follow | All 6 named market providers assessed; approved subset integrated |
| Economic adapters | 1 (FRED only) | 1 (FRED only), more added fast-follow | 4 (FRED/ALFRED, BLS, BEA, Treasury) |
| Analytics | 1 rule, snapshot + single-rule backtest MVP (benchmark, cost/slippage, next-open, config hash) | 1 rule, snapshot + single-rule backtest MVP built into first slice | Rule-contract library + full backtest engine |
| Paper-order coverage | Full 8-state machine | Full 8-state machine built into first slice (edge-case richness deferred) | Full 8-state machine with expanded reconciliation coverage |
| Accessibility | Baseline (keyboard/focus/semantic/non-color) | Baseline, built-in from first UI commit | Full pass incl. tablet + non-color blocking-warning system |
| Observability | Logs + health endpoint | Logs + health endpoint (first slice) | Full job/outbox status, stale-symbol tracking, diagnostics leak tests |
| Test rigor | Targeted (identity, state machine, reconciliation) | Targeted, test-with-code | Full Gherkin-to-test traceability, IV&V-style |
| Governance/ADR queue | Minimal (Ring 0–2 evidence only) | Minimal, same as Least Cost | Full Ring 1 ADR slate + legacy traceability artifact |
| Parallelization | Low (mostly sequential) | High (3 concurrent streams by design) | High (subsystem-owned parallel streams) |
| Relative effort | LOW | MEDIUM | HIGH |
| Relative elapsed time | SHORT–MEDIUM | SHORT | LONG |
| Relative operating cost | LOW | LOW–MEDIUM | MEDIUM–HIGH |
| AI/token footprint | Small, single-agent friendly | Medium, needs cross-stream coordination | Large, benefits from multi-agent team + more ADR review cycles |
| Primary invalidating condition | Need for multi-provider resilience or multi-rule comparative backtesting | Inability to compress the full lifecycle + backtest MVP into the first-slice timebox, or to run 3 parallel streams | Hard deadline or budget incompatible with full scope |

### Source links

- [Program narrative](../../customer-docs/Objective/program-narrative.md)
- [Objective summary](../../customer-docs/Objective/objective-summary.md)
- [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature)
- [Legacy market-data ingestion feature](../../../specs/features/Legacy-Code-market-data-ingestion.feature)
- [Legacy price persistence feature](../../../specs/features/Legacy-Code-price-persistence.feature)
- [Legacy operations feature](../../../specs/features/Legacy-Code-operations.feature)
- [Proposed component view](../../Architecture/proposed-component-view.md)
- [Proposed deployment view](../../Architecture/proposed-deployment-view.md)
- [Proposed domain model](../../Architecture/proposed-domain-model.md)
- [Proposed ingestion sequence](../../Architecture/proposed-ingestion-sequence.md)
- [Proposed paper-order sequence](../../Architecture/proposed-paper-order-sequence.md)
- [Proposed analytics/backtest activity](../../Architecture/proposed-analytics-backtest-activity.md)
- [Proposed paper-order state](../../Architecture/proposed-paper-order-state.md)
