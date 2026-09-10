# MAI-Code-1.1-Flash decomposition

## Model identity and assumptions

- Model identity: MAI-Code-1.1-Flash, independent Ring 0 brainstorm producer.
- Objective interpretation: create a bounded decomposition for a local-first, single-user ETF research prototype that is explicitly research-only and hypothetical; no brokerage connector, no real-order endpoint, no credential transmission path, and no provider-side paper-trading service.
- Architecture status: Proposed only. No ADR is accepted or implied. This is a decomposition exercise, not a selected implementation path.
- Operating assumptions:
  - Browser workbench runs locally in a WSL-based developer environment, using kind/Kubernetes and PostgreSQL as the specified target runtime and persistence stack.
  - All market and economic provider access is rights-approved and egress-controlled; no free or unreviewed provider use without revalidation.
  - Paper-order actions require explicit user confirmation before any portfolio mutation.
  - Ingestion identity and idempotency are grounded in the source-defined five-part identity: instrument, trading date, provider, adjustment policy, and revision, plus an idempotency token or job identity.
  - Legacy HTML scraping, SQL Server assumptions, and machine-bound patterns remain evidence only and are not target-state requirements.
  - UI behavior is WCAG-oriented: keyboard navigation, visible focus, semantic structure, non-color-only status, and workload usability at 1280x720.
  - Evidence/precision/diagnostic controls are accepted under DEC-006: immutable evidence, bounded numeric precision, and redacted diagnostics without secrets or raw provider payloads.
  - No WBS, IMS, or implementation plan is selected here; this file only compares decomposition strategies.

---

## 1. Least Cost

### Objective interpretation
This strategy treats the prototype as a narrow, high-confidence minimum viable research workbench. It optimizes for the smallest credible scope that still satisfies explicit research-only and evidence requirements: watchlist-driven ingestion, guarded provider access, paper ledger with explicit user confirmation, deterministic analytics, and controlled observability. It avoids optional breadth, future capability expansion, and any provider or UI polish beyond the minimum required for validation.

### Scope and explicit deferrals
In scope:
- Local browser workbench with watchlist CRUD and symbol validation
- Resumable ingestion for ETF market data and official economic data adapters only when rights are confirmed
- Local PostgreSQL persistence with bounded schemas, provenance, and idempotent writes
- Deterministic analytics and backtest snapshot execution
- Hypothetical ledger, local paper-order state, and explicit confirmation gates
- Redacted diagnostics, basic job status, and health checks
- Basic accessibility and local readiness validation for WSL/kind/Kubernetes/PostgreSQL

Explicit deferrals:
- Advanced automation, AI-generated recommendations, and broad analytical rule libraries
- Multi-provider benchmarking beyond the minimum rights-approved set
- Rich export formats, extensive simulation tuning, and advanced scenario modeling
- Full enterprise monitoring and broad retention policies beyond minimum evidence controls
- Broad provider expansion and major UX refinement beyond keyboard support and visible state cues
- Any production-scale resilience, public ingress, or organizational rollout assumptions

### Work packages and outcomes
1. Scope gate and control model
   - Outcome: scoped objective, explicit non-goals, provider restriction policy, and local-only runtime boundaries locked down.
2. Catalog and watchlist foundation
   - Outcome: symbol validation, deduplication, watchlist order, and basic persistence for the local catalog.
3. Ingestion core with rights gate
   - Outcome: resumable ingest for market and economic datasets, provider allowlist and rights checks, fixture fallback, and idempotent writes using the five-part identity plus idempotency token.
4. Evidence and data-quality layer
   - Outcome: raw/normalized records, provenance, quarantined data states, suppression of false signals, and redacted diagnostic metadata.
5. Paper portfolio and confirmation flow
   - Outcome: local draft/confirmed paper-order state, append-only ledger, local reconciliation, and explicit user confirmation gate before mutation.
6. Analytics and backtest scaffolding
   - Outcome: immutable snapshot inputs, rule contracts, reproducible backtest execution, and warning/blocked behavior when data is missing or stale.
7. Accessibility and local readiness
   - Outcome: keyboard navigation, visible focus, semantic labels/headings, and readiness checks for kind/Kubernetes/PostgreSQL migration and app startup.
8. Operational smoke validation
   - Outcome: redacted diagnostics, minimal metrics/logs, and user-facing evidence that the local prototype remains research-only.

### Sequencing and dependencies
Sequence:
1. Scope gate and provider policy
2. Catalog and watchlist persistence
3. Ingestion rights gate and DQ layer
4. Ledger and paper-order state
5. Analytics snapshot and rule execution
6. Accessibility and readiness validation
7. Operational smoke and evidence packaging

Dependencies: ingestion depends on catalog and provider policy; analytics depends on valid snapshot and provenance; ledger depends on confirmation and rules; readiness depends on migration and DB connectivity.

### Parallelization
- Parallelize catalog + policy work with initial validation rules.
- Run provider adapter contract design and DQ contract design in parallel.
- Build ledger model and order-state flow in parallel with analytics snapshot contracts.
- Accessibility and local deployment validation can proceed in parallel once the first UI shell is available.

### Legacy analysis role
Legacy HTML and SQL Server artifacts are used only as migration evidence and risk-identification inputs. They inform what not to carry forward: brittle scraping assumptions, machine-bound schema assumptions, and manual console behavior. They do not define the target state.

### Provider/legal approach
- Approve only rights-confirmed providers and explicit allowlisted endpoints.
- Keep egress default-deny and fail closed when rights or allowlists are absent.
- Revalidate provider quotas, terms, and use restrictions before operational dependency.
- Avoid organizational free ingestion until rights are explicitly confirmed.
- Store only local scoped secrets in Kubernetes Secrets; no Git, image, or bundle leakage.

### Accessibility/security/observability/test approach
- Accessibility: keyboard-first flows, visible focus, semantic HTML, labels, and non-color warnings.
- Security: least-privilege access, local secrets only, default-deny egress, and redacted diagnostics.
- Observability: basic health checks, job status, structured logs, and metrics on job success/failure/suppression.
- Test approach: contract tests for ingestion identity/idempotency, negative tests for data-quality suppression, ledger reconciliation tests, UI keyboard tests, and local readiness smoke tests.

### Major risks and mitigations
- Risk: under-scoping the provider policy layer and allowing unreviewed access.
  - Mitigation: rights gate before any dependency and fail-closed egress.
- Risk: weak provenance and duplicate ingestion rows.
  - Mitigation: enforce the five-part identity and idempotency token; test rerun behavior.
- Risk: analytics false positives from missing data.
  - Mitigation: block and warn on stale/partial/quarantined data.
- Risk: user confusion over paper-order semantics.
  - Mitigation: explicit confirmation wording, state labels, and audit records.

### Quality/gate evidence
- Evidence items: provider policy state, provenance and idempotency test results, ledger reconciliation test vectors, redacted diagnostic export check, and local readiness smoke output.
- Gate confidence: strong for research-only prototype scope; moderate on deep operational resilience.

### Relative effort, time, cost, AI/token considerations
- Relative effort: LOW
- Relative elapsed time: SHORT
- Relative operating cost: LOW
- AI/token considerations: lean model use; no expensive exploratory loops; keep tasks local, deterministic, and artifact-heavy; prefer narrow evidence generation and rule validation.

### Conditions that invalidate the strategy
- If the user expects a richer product than a prototype or requires a public deployment path.
- If provider rights cannot be confirmed or revalidated for the needed market/economic sources.
- If the core objective expands beyond local research-only work to real brokerage or order transmission.
- If the design requires enterprise-scale observability or multi-user operations before scope is validated.

---

## 2. Shortest Time

### Objective interpretation
This strategy prioritizes delivery speed by minimizing initial uncertainty and using the most direct path to a demonstrable local research flow. It builds a single integrated prototype loop around the minimum features needed to illustrate watchlists, ingestion, evidence, analytics, and explicit paper decisions. It assumes the same research-only constraints but accepts more schedule pressure and more tactical decisions in exchange for time compression.

### Scope and explicit deferrals
In scope:
- Fast local browser shell with dashboard and research view
- One validated market feed path and one validated economic feed path with policy gating
- Shared PostgreSQL schema for market, economics, portfolio, and job metadata
- Deterministic analytics over a clearly defined snapshot
- Paper-order state and ledger with explicit confirmation, using local fill simulation and local reconciliation
- Local readiness and smoke tests covering migration, DB connectivity, and UI flow

Explicit deferrals:
- Broad multi-provider redundancy and exhaustive provider revalidation before launch
- Full data-retention and archival automation
- Deep UX polish beyond accessible core paths
- Broad signal library and optimization algorithms beyond a small deterministic rule set
- Highly generalized integration architecture and future extensibility beyond the local prototype

### Work packages and outcomes
1. Rapid prototype shell
   - Outcome: local browser workbench with dashboard, watchlist, and paper-order state surface.
2. Core data contracts and rights gate
   - Outcome: provider policy, allowlist, and ingestion contract in place before external calls are allowed.
3. One-pass market and economic ingest path
   - Outcome: symbol validation, normalized rows, provenance, and idempotent save path using the five-part identity and job identity.
4. Data-quality suppression and evidence capture
   - Outcome: quarantined/stale data blocks, warning states, and audit evidence for blocked runs.
5. Portfolio ledger and confirmation logic
   - Outcome: explicit draft/confirm behavior and local ledger with bounded precision and reconciliation.
6. Analytics and signal generation
   - Outcome: deterministic snapshot analytics and reproducible backtest outputs with evidence hashes.
7. Accessibility and readiness integration
   - Outcome: keyboard support, visible focus, labels, and local K8s readiness plus migration smoke checks.
8. Release gate and technical debt capture
   - Outcome: minimal evidence pack and explicit list of deferrals and boundary risks.

### Sequencing and dependencies
Sequence:
1. Prototype shell and scope guardrails
2. Policy and provider rights gate
3. Ingest path and DQ layer
4. Ledger and order-state logic
5. Analytics and evidence
6. Accessibility and local readiness
7. Gate review and teardown of technical debt

Dependencies: shell supports ledger and ingest flows; policy must precede adapter use; analytics depends on valid snapshot; readiness depends on DB migrations and app startup.

### Parallelization
- UI shell and data contracts can be built in parallel.
- Ingestion and ledger models can advance concurrently after the shared schema is defined.
- Analytics and accessibility validation can run in parallel once the shell and snapshot contract stabilize.
- Local deployment smoke tests can run concurrently with final evidence packaging.

### Legacy analysis role
Legacy behavior is treated as a high-value migration caution list rather than a design anchor. It helps triage likely failure modes in scraping, parsing, ID assumptions, and operational gaps, but the implementation moves directly to the source-defined target contracts.

### Provider/legal approach
- Use the minimum rights-approved provider set required for demonstration.
- Avoid broad free ingestion and keep provider egress explicitly controlled.
- Require revalidation before each provider is approved for use beyond the initial prototype validation.
- Use fixture-based fallback and preserve provider metadata for legal and audit transparency.
- Keep secrets local and scoped to the adapter workload; no raw provider payloads in diagnostics.

### Accessibility/security/observability/test approach
- Accessibility: design for keyboard-first interaction and visible state labeling from the first UI pass.
- Security: local-only deployment, minimal secrets, and strict egress controls.
- Observability: concise job status, error reasons, and redacted diagnostics as a gate requirement.
- Test approach: smoke tests for local deployment, ingestion rerun idempotency, behavior tests for paper-order draft/confirm logic, and a few key accessibility checks.

### Major risks and mitigations
- Risk: compressed timeline creates architectural shortcuts.
  - Mitigation: preserve explicit contracts and evidence boundaries even when speed is prioritized.
- Risk: too few provider or policy checks before launch.
  - Mitigation: require rights gate and allowlist before any provider path becomes operational.
- Risk: signal quality is weak because analytics and DQ are rushed.
  - Mitigation: keep a blocking-data rule and a verified snapshot contract as a hard gate.
- Risk: a quick UI becomes inaccessible or ambiguous.
  - Mitigation: keyboard and semantic checks are included in the sprint-critical path.

### Quality/gate evidence
- Evidence: local readiness log, ingestion rerun audit, ledger reconciliation result, redacted diagnostic export, and explicit block-on-bad-data evidence.
- Gate confidence: high for a prototype demo, medium for long-lived operational robustness.

### Relative effort, time, cost, AI/token considerations
- Relative effort: MEDIUM
- Relative elapsed time: SHORT
- Relative operating cost: MEDIUM
- AI/token considerations: moderate use of focused reasoning and code review; keep token use bounded by a single integration loop and concise evidence generation.

### Conditions that invalidate the strategy
- If a stakeholder requires a broader platform or demonstrates a high probability of provider rights change before approval.
- If the local prototype must support multiple datasets, major automation, or long-term operational rigor before user validation.
- If the gating and policy work cannot be completed in time to preserve the research-only boundary.

---

## 3. Most Comprehensive

### Objective interpretation
This strategy treats the objective as a durable local research platform with explicit controls and a broad evidence model. It aims for high assurance, stronger operational discipline, and a robust architecture boundary while remaining within the research-only and proposed architecture constraints. It accepts additional work, complexity, and cost to reduce false positives, improve traceability, and support wider future adaptation without drifting into live brokerage semantics.

### Scope and explicit deferrals
In scope:
- Full browser workbench with strong UX, analytics, evidence, and policy surfaces
- Multi-provider rights model, revalidation flow, explicit provider acknowledge records, and fail-closed egress
- Full provenance model for market and economic data, including the five-part identity and idempotency semantics
- Comprehensive data-quality suppression, quarantines, and evidence capture for all blocked states
- Portfolio ledger, reconciliation, and explicit confirm paper-order lifecycle with rich auditability
- Backtest reproducibility, deterministic rule versioning, and immutable evidence bundles
- Strong local observability, diagnostics, and readiness controls for WSL/kind/Kubernetes/PostgreSQL
- WCAG-oriented accessibility and usability across the desktop research flow

Explicit deferrals:
- Public deployment, HA/DR, multiple tenants, or production support model
- Advanced AI advisory features or autonomous recommendation engine beyond bounded assistance
- Broad productization beyond the required local prototype
- Large-scale data products, extensible marketplace integrations, or non-research operational use cases

### Work packages and outcomes
1. Governance, rights, and policy foundation
   - Outcome: the research-only boundary, provider approvals, and local deployment constraints are written and enforced before external access is allowed.
2. Catalog, watchlist, and source validation
   - Outcome: robust symbol management, dedupe rules, watchlist operations, and identity validation across market and economic records.
3. Ingestion fabric with idempotency
   - Outcome: compliant provider adapter flow, fixture fallback, raw and normalized capture, versioned transformations, DQ quarantine, and safe rerun behavior.
4. Economic vintage and point-in-time controls
   - Outcome: observation cutoff logic, vintage lineage, policy-aware retrieval, and deterministic handling of release timestamps and transformations.
5. Evidence and diagnostics fabric
   - Outcome: redacted diagnostics, immutable evidence hashes, least-privilege access, and removable raw payload restrictions.
6. Portfolio and paper-order platform
   - Outcome: explicit user-confirmed paper actions, append-only ledger, precision-safe reconciliation, and clear terminal state transitions.
7. Analytics and backtest layer
   - Outcome: snapshot-based deterministic execution, benchmark assumptions, reproducibility, block-on-bad-data semantics, and evidence-backed output.
8. Accessibility and operations excellence
   - Outcome: full keyboard support, semantic structure, visible status cues, local health checks, migration readiness, and job observability.
9. Quality gate validation and risk closure
   - Outcome: all major conditions verified against the objective acceptance criteria, local readiness, and provider rights policy.

### Sequencing and dependencies
Sequence:
1. Governance and scope controls
2. Catalog and validation contracts
3. Provider rights and ingestion layer
4. Economic vintages and DQ rules
5. Ledger and paper-order semantics
6. Analytics and snapshot contract
7. Accessibility, observability, and readiness
8. End-to-end validation and gate evidence

Dependencies: policy must precede provider access; ingestion identity and DQ are prerequisites for downstream analytics; ledger and order state are prerequisites for paper actions; readiness depends on migration and DB connectivity; quality gate depends on evidence completeness.

### Parallelization
- Governance and provider-policy work run in parallel with catalog and watchlist design.
- Ingestion and economic vintage logic can proceed in parallel once the identity contract is defined.
- Ledger and analytics contracts proceed together with explicit snapshot and precision definitions.
- Accessibility, observability, and readiness validation can proceed once the first UI and API skeleton is available.

### Legacy analysis role
Legacy artifacts are used as a structured migration risk register: extraction patterns, database assumptions, and historical manual workflows are captured as evidence to avoid repeating failures. The target design uses them only to inform guardrails, migration tests, and risk checks; they do not define the objective’s future state.

### Provider/legal approach
- Maintain a rights-based provider registry with explicit terms, quotas, and revalidation schedules.
- Require provider-specific allowlist policy, fail-closed egress control, and no broad free ingestion without legal and operational confirmation.
- Treat settings acknowledgment as a product control and preserve per-provider usage metadata.
- Keep all secrets in scoped local Kubernetes Secrets and exclude them from logs, images, bundles, and diagnostics.
- Retain only allowlisted metadata and hashes in diagnostics; prohibit raw provider payload access.

### Accessibility/security/observability/test approach
- Accessibility: user flows meet keyboard, semantic, and non-color-only cue requirements from the start; accessibility is a design criterion, not an afterthought.
- Security: default-deny egress, least-privilege access, local secret handling, and no raw provider payload exposure.
- Observability: structured logs, metrics, health checks, status/outbox visibility, and evidence bundles tied to jobs.
- Test approach: end-to-end validation of local readiness, idempotent ingest reruns, data-quality suppression, snapshot reproducibility, ledger reconciliation, and UI accessibility across primary flows.

### Major risks and mitigations
- Risk: complexity outpaces the prototype’s design intent.
  - Mitigation: keep the architecture proposed and restrict the scope to research-only, local deployment.
- Risk: policy work becomes legal-heavy and slows delivery.
  - Mitigation: define a clear rights gate and limit operations to the approved direct adapters and fixtures.
- Risk: evidence model becomes too heavy and slows iteration.
  - Mitigation: limit retention and retention controls to needed evidence while keeping the model immutable and hash-based.
- Risk: broad analytics rigor masks the prototype’s need for clarity.
  - Mitigation: keep deterministic rule contracts and snapshot tests explicit, not speculative.

### Quality/gate evidence
- Evidence: rights revalidation records, idempotency proof, DQ suppression logs, ledger reconciliation, reproducibility hashes, accessibility checks, and local readiness validations.
- Gate confidence: high for operational credibility and future adaptability; higher cost and time than the other strategies.

### Relative effort, time, cost, AI/token considerations
- Relative effort: HIGH
- Relative elapsed time: LONG
- Relative operating cost: HIGH
- AI/token considerations: use the broadest but still bounded reasoning; this strategy benefits from more structured evidence generation and review cycles but should avoid overexploration or unverifiable claims.

### Conditions that invalidate the strategy
- If the prototype objective is reduced to a one-off demo rather than a durable local research platform.
- If provider policy cannot be validated and controlled within the local deployment boundary.
- If the objective changes from research-only to an execution-driven workflow or networked service model.
- If additional enterprise-grade controls are required before the prototype is considered credible for local use.

---

## Compact self-comparison

| Strategy | Relative effort | Relative elapsed time | Relative operating cost | Core advantage | Core risk |
| --- | --- | --- | --- | --- | --- |
| Least Cost | LOW | SHORT | LOW | Fastest path to a credible minimum local prototype | Narrow scope could underinvest in evidence, policy, or resilience |
| Shortest Time | MEDIUM | SHORT | MEDIUM | Best for rapid demonstration with focused execution | Schedule pressure may force a few architectural shortcuts |
| Most Comprehensive | HIGH | LONG | HIGH | Strongest evidence, policy, and operational integrity | More complexity and slower validation than the other strategies |

## Source links
- [Program narrative](../../customer-docs/Objective/program-narrative.md)
- [Objective summary](../../customer-docs/Objective/objective-summary.md)
- [Objective feature](../../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature)
- [Legacy ingestion feature](../../../specs/features/Legacy-Code-market-data-ingestion.feature)
- [Legacy price persistence feature](../../../specs/features/Legacy-Code-price-persistence.feature)
- [Legacy operations feature](../../../specs/features/Legacy-Code-operations.feature)
- [Proposed component view](../../Architecture/proposed-component-view.md)
- [Proposed deployment view](../../Architecture/proposed-deployment-view.md)
- [Proposed domain model](../../Architecture/proposed-domain-model.md)
- [Proposed ingestion sequence](../../Architecture/proposed-ingestion-sequence.md)
- [Proposed paper-order sequence](../../Architecture/proposed-paper-order-sequence.md)
- [Proposed analytics backtest activity](../../Architecture/proposed-analytics-backtest-activity.md)
- [Proposed paper-order state](../../Architecture/proposed-paper-order-state.md)
