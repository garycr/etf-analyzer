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
| DEC-028 | 2026-09-14 | Governance | Enable Fully Agentic mode while retaining human control of tier selection, production deployment, and hotfix approval | Workspace Owner | Solo Orchestrator | Active |
| DEC-029 | 2026-09-14 | Architecture | Correct analytics retention epochs to UTC instants and add a private PostgreSQL RFC 8785 helper | Solo Orchestrator | Solo Orchestrator | Active |
| DEC-030 | 2026-09-15 | Planning | Clarify CT-DB-001 behavioral acceptance across sequential Ring 2 packages | Solo Orchestrator | Solo Orchestrator | Active |
| DEC-031 | 2026-09-15 | Package closure | Close WP-2 conditionally and authorize WP-3 as the next sequential package | Agent (Fully Agentic) | Solo Orchestrator | Active |
| DEC-032 | 2026-09-16 | Remediation closure | Close #71 after complete fixture identity mediation and stable PostgreSQL check errors | Agent (Fully Agentic) | Solo Orchestrator | Active |
| DEC-033 | 2026-09-16 | Contract admission | Close PT-APP-001M with exact duplicate-aware request and coherent result admission | Agent (Fully Agentic) | Solo Orchestrator | Active |
| DEC-034 | 2026-09-16 | Replay integrity | Close PT-APP-001N with atomic application replay distinct from owning idempotency | Agent (Fully Agentic) | Solo Orchestrator | Active |
| DEC-035 | 2026-09-16 | Error precedence | Close PT-APP-001O with deterministic ranked selection on live command admission | Agent (Fully Agentic) | Solo Orchestrator | Active |
| DEC-036 | 2026-09-16 | Job lifecycle | Close PT-APP-001P with an exact immutable Job state projection and transition policy | Agent (Fully Agentic) | Solo Orchestrator | Active |
| DEC-037 | 2026-09-16 | Package closure | Close WP-3 and make WP-4 eligible as the next sequential package without starting it | Workspace Owner | Solo Orchestrator | Approved |
| DEC-038 | 2026-09-17 | API reliability | Add a fixed transport Problem500 without fabricating an application-owned failure | Agent (Fully Agentic) | Solo Orchestrator | Active |
| DEC-039 | 2026-09-17 | Package closure | Close WP-4 conditionally and make WP-5 eligible as the next sequential package | Workspace Owner | Solo Orchestrator | Approved |
| DEC-040 | 2026-09-17 | Architecture | Assign WP-5 pure analytics to Domain and retain atomic evidence publication in PostgreSQL | Agent (Fully Agentic) | Solo Orchestrator | Reviewed |
| DEC-041 | 2026-09-17 | Package closure | Close WP-5 and make WP-6 eligible as the next sequential package without starting it | Workspace Owner | Solo Orchestrator | Approved |
| DEC-042 | 2026-09-17 | Architecture | Assign WP-6 closed order semantics to Domain, trusted dispatch to Application, and atomic ledger ownership to PostgreSQL | Agent (Fully Agentic) | Solo Orchestrator | Reviewed |
| DEC-043 | 2026-09-17 | Replay integrity | Bind WP-6 application replay and PostgreSQL order effects in one transaction | Agent (Fully Agentic) | Solo Orchestrator | Reviewed |

---

## Decision Records

### DEC-043: Bind Application Replay to Order Effects

| Field | Value |
|-------|-------|
| **ID** | DEC-043 |
| **Date** | 2026-09-17 |
| **Category** | Replay integrity |
| **Decision** | Use a PostgreSQL Application replay store on one exclusive client: acquire a transaction advisory lock and validate canonical content before owner dispatch, execute order effects under a savepoint, and persist the complete Application result envelope before committing the same transaction |
| **Policy** | DEC-034; DEC-042; application contract candidate.2; PostgreSQL contract candidate.2; test-first development; least privilege; independent code and security review |
| **Authority** | Agent under Fully Agentic mode with Workspace Owner approval to continue WP-6; REV-107 and REV-108 PASS |
| **Accountable** | Solo Orchestrator preserves transaction affinity in composition, keeps the synchronous API unchanged, and retains PostgreSQL as the sole durable replay and mutation authority |
| **Context** | An in-memory replay store correctly settles local Promises but cannot prevent two processes from accepting different canonical content for one Application command identity. Persisting only after mutation also leaves a crash window. |
| **Alternatives** | Process-local replay only; persist after owner commit; add a second replay table; bind the existing application replay table and order owner in one PostgreSQL transaction |
| **Consequences** | Equivalent concurrent local calls join one Promise; cross-process conflicting content is rejected before competing effects; failed effects roll back to a savepoint before their stable envelope is stored; durable replay returns the original complete envelope without readiness or owner dispatch |
| **Reasoning** | One transaction closes the TOCTOU and interruption windows while reusing existing storage and controlled functions. An exclusive client is required so replay and owner SQL share transaction state. |
| **Assumptions** | PostgreSQL 16; one exclusive connected client per in-flight command; app_runtime invokes only controlled functions; no pool object is passed as the transaction client |
| **Invalidation** | Replay and owner dispatch use different sessions; a caller bypasses the lookup-first protocol; remote workers require bounded lock waits or cancellation semantics |
| **Status** | Reviewed; REV-107 Code PASS; REV-108 Security PASS; WP-6 active |
| **Linked Artifacts** | `src/Infrastructure/PostgreSQL/application-replay-store.ts`, `tests/Integration/controlled-access-migration.test.mjs`, REV-107, REV-108, GitHub issue #79 |

---

### DEC-042: Assign WP-6 Order and Ledger Ownership

| Field | Value |
|-------|-------|
| **ID** | DEC-042 |
| **Date** | 2026-09-17 |
| **Category** | Architecture |
| **Decision** | Domain owns the closed eight-state paper-order model, OT-01 through OT-10 command semantics, canonical field/order rules, and diagnostic rebuild verification; Application owns trusted identity, authorization, and bounded dispatch; existing PostgreSQL controlled functions remain the sole atomic mutation and projection-publication owners |
| **Policy** | DEC-014; DEC-023; DEC-027; DEC-028; DEC-040; DEC-041; domain contract candidate.1; ledger and domain-ledger function contracts candidate.2; approved sequential Ring 2 WBS; test-first development; independent architecture review |
| **Authority** | Agent under Fully Agentic mode, tracked through GitHub issues #79/#80, with alternate-model REV-105 PASS |
| **Accountable** | Solo Orchestrator implements the exact test matrix, preserves PostgreSQL atomic ownership and least privilege, records ADR-002 before WP-7, and does not activate any adjacent runtime or release scope |
| **Context** | Migration 0003 already owns lifecycle admission, fills, FIFO allocation, reversals, audit, commitments, anchors, and publication. WP-6 needs a bounded Domain/Application composition surface and complete executable acceptance evidence, not a second authoritative ledger. |
| **Alternatives** | Duplicate aggregate and ledger state in memory; move FIFO/reversal logic into Application; introduce a worker or queue; retain one PostgreSQL mutation owner with pure Domain semantics and thin trusted dispatch |
| **Consequences** | WP-6 starts at unchanged Ring 2 completion of 62.5%. Exact test titles are allocated for all OT and CT identifiers. Domain verification cannot publish projections. ADR-002 is due before WP-7 planning. |
| **Reasoning** | Reusing the existing transactional owner preserves atomic order/ledger mutation, idempotency, optimistic concurrency, append-only evidence, and least privilege while keeping business semantics independently testable. |
| **Assumptions** | Node 20; PostgreSQL 16; local fixture-only execution; one controlled PostgreSQL writer; no active baseline, live provider, brokerage, public ingress, worker, queue, or multi-user authority |
| **Invalidation** | Multiple mutation writers, remote/public execution, durable asynchronous handoff, changed PostgreSQL transaction owner, live brokerage/provider semantics, or active baseline |
| **Status** | Reviewed; REV-105 PASS; WP-6 active |
| **Linked Artifacts** | `docs/Planning/tasks/wp-6-implementation-plan.md`, REV-105, GitHub issues #79/#80 |

---

### DEC-041: Close WP-5 Deterministic Analytics

| Field | Value |
|-------|-------|
| **ID** | DEC-041 |
| **Date** | 2026-09-17 |
| **Category** | Package closure |
| **Decision** | Close WP-5 after REV-101 Code PASS, REV-102 Security PASS, REV-103 Architecture PASS, REV-104 Plan PASS, and a 366/366 zero-skip PostgreSQL-backed repository run; make WP-6 eligible as the next sequential package without starting it |
| **Policy** | DEC-014; DEC-020; DEC-023; DEC-028; DEC-039; DEC-040; approved Ring 2 WBS; analytics evidence contract `1.0.0-candidate.2`; test-first development; independent code, security, architecture, and plan review |
| **Authority** | Workspace Owner approval on 2026-09-17 after Fully Agentic execution, independent review, and publication through GitHub issues #77/#78 |
| **Accountable** | Solo Orchestrator publishes selective WP-5 implementation/evidence, closes #77/#78 only after push, keeps WP-6 unstarted, and preserves baseline/release/deployment/production gates |
| **Context** | Domain analytics, P0 rule/backtest, trusted evidence orchestration, and real PostgreSQL composition pass 366/366 tests with zero skips. Lint, audit, diagnostics, and diff validation pass. No independent Critical or Major finding remains. |
| **Alternatives** | Keep WP-5 open despite satisfied criteria; close without live PostgreSQL evidence; broaden WP-5 into WP-6 paper orders; close the bounded package and preserve sequential eligibility |
| **Consequences** | Ring 2 reaches 62.5%. WP-6 becomes eligible but remains unstarted. The Proposed-diagram retention wording Minor and canonicalization layering exception remain nonblocking documentation debt. |
| **Reasoning** | The approved bounded outcome is implemented and independently reviewed with complete executable persistence evidence. Sequential closure preserves the WBS dependency chain without authorizing adjacent paper-order scope. |
| **Assumptions** | Node 20; PostgreSQL 16; fixture-only local single-runtime execution; no active baseline, live provider, brokerage, public ingress, or multi-user authority |
| **Invalidation** | Changed evidence transaction owner, remote/public execution, new analytics rule/provider catalog, multiple publication writers, active baseline, or evidence that canonical/resource bounds are insufficient |
| **Status** | Approved; WP-5 closed, WP-6 eligible but not started |
| **Linked Artifacts** | `docs/artifacts/gate-evidence/wp-5-exit.md`, REV-101, REV-102, REV-103, REV-104, DEC-040, GitHub issues #77/#78 |

---

### DEC-040: Assign WP-5 Analytics Ownership

| Field | Value |
|-------|-------|
| **ID** | DEC-040 |
| **Date** | 2026-09-17 |
| **Category** | Architecture |
| **Decision** | Keep point-in-time selection, fixed-point arithmetic, the P0 rule/backtest, closed evidence construction, and canonical verification in `Domain/Analytics`; use Application only for orchestration; retain existing PostgreSQL `evidence_commit` and `evidence_read` as the sole atomic persistence owners |
| **Policy** | DEC-014; DEC-023; DEC-028; DEC-039; analytics evidence contract `1.0.0-candidate.2`; ADR-001; approved WP-5 WBS; alternate-model architecture review |
| **Authority** | Agent under Fully Agentic mode, tracked through GitHub issues #77/#78, with alternate-model Architect Reviewer CONDITIONAL PASS |
| **Accountable** | Solo Orchestrator closes the timestamp, closed-schema, named-rule, and test-path conditions before architecture sign-off; preserves PostgreSQL least privilege and all explicit absence boundaries |
| **Context** | WP-5 requires deterministic analytics without activating the Proposed worker architecture. Existing PostgreSQL functions already own transactionality, replay, retention, manifests, and publication concurrency. Pure Domain code can enforce point-in-time and numeric invariants without I/O. |
| **Alternatives** | Put formulas in Application owner dispatch; duplicate publication state in memory; introduce a worker/queue; keep pure analytics in Domain and reuse the existing persistence owner |
| **Consequences** | `analytics.ts` owns shared pure invariants and `p0-rule.ts` owns the single reviewed rule. Application remains transport-independent. No worker, queue, scheduler, event, provider, broker, or public ingress is introduced. The existing pure canonical JSON helper remains an explicitly accepted layering exception pending shared-kernel cleanup. |
| **Reasoning** | The split preserves DDD ownership, keeps formulas independently testable, avoids two atomicity owners, and satisfies the prototype synchronously without treating a Proposed diagram as accepted architecture. |
| **Assumptions** | Local fixture-only single-writer execution; Node 20; PostgreSQL 16; no live provider or non-loopback exposure; candidate contracts remain unactivated |
| **Invalidation** | Multiple writers, remote execution, durable asynchronous handoff, changed evidence transaction owner, new rule catalog, live provider semantics, or an active baseline |
| **Status** | Reviewed; REV-103 PASS closed all architecture conditions |
| **Linked Artifacts** | `docs/Planning/tasks/wp-5-implementation-plan.md`, REV-103, analytics contract candidate.2, ADR-001, GitHub issues #77/#78 |

---

### DEC-039: Close WP-4 Loopback API Adapter

| Field | Value |
|-------|-------|
| **ID** | DEC-039 |
| **Date** | 2026-09-17 |
| **Category** | Package closure |
| **Decision** | Close WP-4 after REV-098 Architecture PASS, REV-099 Code PASS, REV-100 Security CONDITIONAL PASS, and closure Plan CONDITIONAL PASS; make WP-5 eligible as the next sequential package without starting it |
| **Policy** | DEC-023; DEC-028; DEC-037; DEC-038; approved Ring 2 WBS; OpenAPI `1.0.0-candidate.3`; `CT-API-001A..L`; test-first development; code, security, architecture, and plan review |
| **Authority** | Workspace Owner approval on 2026-09-17 after Fully Agentic execution and publication through GitHub issues #75 and #76 |
| **Accountable** | Solo Orchestrator closes #75/#76, retains the two REV-100 Minors for WP-8 hardening, starts no WP-5 work through this decision, and preserves all baseline/release/deployment/production gates |
| **Context** | The exact 16-operation loopback adapter passes 10/10 focused tests and the complete repository passes 328 discovered, 298 passed, 30 PostgreSQL environment-skipped, and zero failed. Audit reports zero vulnerabilities. Review remediation added fixed Problem500 containment and browser-readable safe error responses. |
| **Alternatives** | Keep WP-4 open for nonblocking loopback timeout/auditability Minors; waive the Minors without traceability; close conditionally and bind them to WP-8 integration hardening |
| **Consequences** | Ring 2 reaches 50%. WP-5 deterministic analytics may be initialized separately. Slow-upload timeout hardening and an explicit top-level plain-record parser guard remain visible in REV-100 and WP-8 evidence obligations. |
| **Reasoning** | No Critical or Major finding remains, and the Minors affect only local availability/audit clarity under an inactive loopback prototype. Deferring them to integrated hardening preserves sequential delivery without overstating security or production readiness. |
| **Assumptions** | Runtime remains Node 20; no reverse proxy or non-loopback ingress exists; application candidate.2 remains authoritative; PostgreSQL-skipped tests retain their prior zero-skip evidence. |
| **Invalidation** | Any public/non-loopback ingress, proxy, authentication requirement, changed operation/status/schema, active baseline, sensitive Problem content, or evidence that local upload handling threatens integrated readiness |
| **Status** | Approved; WP-4 conditionally closed and WP-5 eligible but not started |
| **Linked Artifacts** | `docs/artifacts/gate-evidence/wp-4-exit.md`, REV-098, REV-099, REV-100, DEC-038, CC-010, GitHub issues #75 and #76 |

---

### DEC-038: Contain Unexpected API Adapter Failures

| Field | Value |
|-------|-------|
| **ID** | DEC-038 |
| **Date** | 2026-09-17 |
| **Category** | API reliability |
| **Decision** | Advance only the OpenAPI contract to `1.0.0-candidate.3` and define one fixed non-sensitive `Problem500` for unexpected adapter execution or serialization failures across all sixteen operations |
| **Policy** | DEC-013; DEC-023; DEC-028; approved WP-4 boundary; `CT-API-001E/K`; fail-closed security; status/code closure; alternate-model decision review |
| **Authority** | Agent under Fully Agentic mode, tracked through GitHub issue #76, with alternate-model Architect Reviewer final PASS |
| **Accountable** | Solo Orchestrator preserves application contract `1.0.0-candidate.2`, obtains final contract and code review, publishes exact hashes and executable evidence, and does not close WP-4 while review remains conditional |
| **Context** | Independent WP-4 code review found that unexpected dispatcher and JSON serialization exceptions could terminate the listener. Initial containment preserved availability and non-disclosure but emitted a body outside OpenAPI candidate.2. Architect review then required fixed title/detail literals, conversion of malformed result fallbacks, preflight containment, and CC-010 traceability. |
| **Alternatives** | Terminate the HTTP connection without a response; fabricate an application-owned failure code; return an unconstrained generic 500 body; define a disjoint fixed transport Problem500 |
| **Consequences** | The adapter remains available and exposes no exception text while application failures retain their exact envelopes and ownership. All sixteen 500 responses accept either their operation-specific Failed500 envelope or the fixed Problem500. OpenAPI and inventory candidate versions advance; no application operation, payload, public application code, success status, ingress, provider, broker, or event surface changes. |
| **Reasoning** | Connection termination weakens operability, and fabricating an application failure violates ownership. A literal closed transport problem is disjoint from application envelopes, preserves non-disclosure structurally, and is the smallest additive change while no active API baseline exists. |
| **Assumptions** | The prototype remains loopback-only and inactive; application candidate.2 continues to return closed envelopes; no backward-compatibility claim exists before baseline activation. |
| **Invalidation** | An active baseline; remote/public ingress; a changed application failure owner; a requirement to expose diagnostics in 500 responses; schema overlap between Failed500 and Problem500; or evidence that listener containment leaks sensitive content or loses availability |
| **Status** | Active; alternate-model Architect Reviewer final PASS with no Critical or Major findings |
| **Linked Artifacts** | `docs/Planning/contracts/openapi-contract.yaml`, `specs/features/OpenAPI-Contract-Conformance.feature`, `docs/Planning/contracts/change-log.md` CC-010, GitHub issues #75 and #76 |

---

### DEC-037: Close WP-3 Application Boundary

| Field | Value |
|-------|-------|
| **ID** | DEC-037 |
| **Date** | 2026-09-16 |
| **Category** | Package closure |
| **Decision** | Close WP-3 after aggregate Code, Security, Plan, and package-boundary Architecture PASS dispositions; make WP-4 eligible as the next sequential package without starting it |
| **Policy** | DEC-023; DEC-028; DEC-030..036; approved Ring 2 WBS; application contract; `PT-APP-001A..P`; test-first development; code, security, plan, and architecture review |
| **Authority** | Workspace Owner approval on 2026-09-16, recorded through dedicated decision-transparency issue #74 after Fully Agentic execution |
| **Accountable** | Solo Orchestrator closes #73 after publication, starts no WP-4 work through this decision, preserves WP-8 DP-33 and Ring 3 accessibility gates, and keeps release/deployment/production authority closed |
| **Context** | All sixteen application scenarios passed focused reviews. Aggregate composition added one test, moving the suite from 317/287 to 318 discovered/288 passed with 30 expected PostgreSQL environment skips and zero failures. Aggregate review then closed capability-execution, sparse-array, redaction, and incomplete analytics stable-code mediation defects. |
| **Alternatives** | Start WP-4 before aggregate closure; rely only on focused A-P evidence; require composed-facade tests, adversarial remediation, complete owner-code fidelity, and independent closure reviews before sequencing onward |
| **Consequences** | The reviewed transport-independent application boundary is executable and WP-4 may be initialized separately. No API, distributed replay, live provider, broker, event, queue, scheduler, worker, baseline, release, deployment, or production authority follows. |
| **Reasoning** | Focused scenario correctness did not prove aggregate composition. Closing only after the composed facade, security boundary, owner-error family, and synchronized governance records pass preserves the approved one-package sequence without hiding integration risk. |
| **Assumptions** | Node 20 remains the runtime; PostgreSQL migration bytes remain unchanged; renderer-level accessibility is deferred to Ring 3; WP-4 remains a separate package and issue. |
| **Invalidation** | A changed operation, envelope, replay identity, Job/Readiness model, stable owner-code family, opaque import schema, redaction policy, or evidence that aggregate facade behavior differs from the reviewed tests |
| **Status** | Approved; WP-3 closed and WP-4 eligible but not started |
| **Linked Artifacts** | `docs/Governance/decisions/reviews/REV-094-wp-3-aggregate-code-review.md`, `REV-095-wp-3-aggregate-security-review.md`, `REV-096-dec-037-wp-3-closure-plan-review.md`, `REV-097-wp-3-boundary-architecture-review.md`, `docs/artifacts/gate-evidence/wp-3-exit.md`, GitHub issues #22, #73, and #74 |

---

### DEC-036: Close The Application Job State Machine

| Field | Value |
|-------|-------|
| **ID** | DEC-036 |
| **Date** | 2026-09-16 |
| **Category** | Job lifecycle |
| **Decision** | Close PT-APP-001P with exact closed Job enums, descriptor-captured four-field state projections, four owner transitions, restartable Failed-to-Pending only through JobRestart, exact attempt increment, and immutable fail-closed results |
| **Policy** | DEC-023; DEC-028; DEC-030; DEC-032; DEC-033; DEC-034; DEC-035; approved WP-3 application contract; test-first development; code review; security review |
| **Authority** | Agent (Fully Agentic), with alternate-model Code Reviewer and Security Reviewer final PASS dispositions |
| **Accountable** | Solo Orchestrator assembles aggregate WP-3 evidence next, preserves full Job/checkpoint/effect persistence under owning PostgreSQL paths, and keeps WP-4, release, deployment, and production authority closed |
| **Context** | Job result coherence and restart dispatch existed, but PT-APP-001P lacked one executable closed state-transition projection. Initial review found an unsound generic return type; security review then found inherited/accessor/proxy ambiguity and nested/capability propagation through generic spread. |
| **Alternatives** | Leave transition policy documentary; mutate full Job records in the application boundary; retain arbitrary generic fields; expose cancellation or asynchronous work delivery; implement an exact primitive state projection while owners retain durable Job mutation |
| **Consequences** | The application can enumerate and enforce all 128 type/policy/state/target/trigger combinations without reading accessors or carrying nested/capability fields. Illegal transitions, terminal mutation, invalid restart policy, malformed values, reflection failures, and overflow return stable errors without source mutation. |
| **Reasoning** | PT-APP-001P owns transition policy, not persistence. A narrow exact projection makes the state machine executable and type-sound while preventing the application layer from cloning or weakening owner-held checkpoint, identity, and committed-effect invariants. |
| **Assumptions** | Full Job records continue through exact result admission and PostgreSQL owners; attempts begin at one; transitions are synchronous; owner persistence applies timestamps, controlling errors, checkpoints, and committed-effect guarantees atomically. |
| **Invalidation** | A new Job type/status/restartability value; cancellation; a new legal transition or trigger; asynchronous execution; a requirement for this projection to mutate full Job records; or changed attempt semantics |
| **Status** | Active; PT-APP-001P complete and aggregate WP-3 closure is next |
| **Linked Artifacts** | `docs/artifacts/gate-evidence/wp-3-job-state-machine.md`, `docs/Governance/decisions/reviews/REV-092-wp-3-job-state-machine-code-review.md`, `docs/Governance/decisions/reviews/REV-093-wp-3-job-state-machine-security-review.md`, GitHub issue #73 |

---

### DEC-035: Close Deterministic Error Precedence

| Field | Value |
|-------|-------|
| **ID** | DEC-035 |
| **Date** | 2026-09-16 |
| **Category** | Error precedence |
| **Decision** | Close PT-APP-001O after enforcing closed numeric phase ranks, phase/code membership, owner internal ranks, Unicode code-point tuple ties, verified selected request identity, and ranked operation/request/authorization detection on live command admission |
| **Policy** | DEC-023; DEC-028; DEC-030; DEC-032; DEC-033; DEC-034; approved WP-3 application contract; test-first development; code review; security review |
| **Authority** | Agent (Fully Agentic), with alternate-model Code Reviewer and Security Reviewer final PASS dispositions |
| **Accountable** | Solo Orchestrator publishes only PT-APP-001O artifacts, continues next to PT-APP-001P, and keeps distributed replay persistence, WP-4, release, deployment, and production authority closed |
| **Context** | The application contract defined deterministic precedence, but no executable selector or live command-admission integration enforced it. Initial review confirmed the pure selector yet found the production path did not consume it. |
| **Alternatives** | Preserve first-thrown validation order; expose only a pure selector; allow callers to supply numeric phase ranks; integrate ranked detection at a future transport layer; collect and select operation, request, and authorization defects at the transport-independent command boundary |
| **Consequences** | Every valid candidate set has one order-independent controlling error; invalid phase/code or owner-rank combinations fail closed. Unknown operation controls malformed request, malformed request controls unauthorized actor, and valid unauthorized requests fail before replay, readiness, payload admission, or owner effects. |
| **Reasoning** | A normative precedence matrix is meaningful only when the live boundary detects independently and selects once. Closed owner-assigned ranks and code-point ties prevent insertion order, locale, or caller-supplied labels from changing the public result. |
| **Assumptions** | The catalog and local-user authorization remain closed; current live collection is bounded to operation, request, and authorization candidates; lower replay-through-result phases continue to enforce their existing ordering until PT-APP-001P composes the final result surface. |
| **Invalidation** | A catalog/authentication model change; a new phase or stable code; externally assigned owner ranks; locale-based ordering requirements; transport-specific precedence replacing this boundary; or asynchronous/multi-stage candidate collection |
| **Status** | Active; PT-APP-001O complete and PT-APP-001P is next sequentially |
| **Linked Artifacts** | `docs/artifacts/gate-evidence/wp-3-error-precedence.md`, `docs/Governance/decisions/reviews/REV-090-wp-3-error-precedence-code-review.md`, `docs/Governance/decisions/reviews/REV-091-wp-3-error-precedence-security-review.md`, GitHub issue #73 |

---

### DEC-034: Close Deterministic Application Replay

| Field | Value |
|-------|-------|
| **ID** | DEC-034 |
| **Date** | 2026-09-16 |
| **Category** | Replay integrity |
| **Decision** | Close PT-APP-001N after enforcing exact command envelopes, RFC 8785 canonical replay content, `(operation, commandId)` key isolation, atomic new/replay/conflict decisions, cached returned and thrown outcomes, and fail-closed synchronous reentrancy |
| **Policy** | DEC-023; DEC-028; DEC-030; DEC-032; DEC-033; approved WP-3 application contract; test-first development; code review; security review |
| **Authority** | Agent (Fully Agentic), with alternate-model Code Reviewer and Security Reviewer final PASS dispositions |
| **Accountable** | Solo Orchestrator continues next to PT-APP-001O, preserves owning replay authority, and does not claim persistent distributed atomicity, result-envelope completion, WP-4, release, deployment, or production authority |
| **Context** | Exact schema admission did not yet protect application command identities from duplicate effects. Review exposed false Analytics ordering conflicts, uncached owner failures, and a synchronous reentrancy window in the reference store. |
| **Alternatives** | Delegate all replay to owners; key only by command ID; validate readiness before replay lookup; cache successful values only; reserve application keys atomically before execution |
| **Consequences** | Equivalent commands replay the original returned or thrown outcome without downstream callbacks; changed content fails before payload admission; owner-specific conflicts remain unchanged for new application keys. The in-memory store is a synchronous reference implementation, while future persistent adapters must provide atomic cross-process reservation. |
| **Reasoning** | Application replay and owner idempotency protect different identities. Resolving the application key before readiness and ownership prevents duplicate orchestration while retaining narrower owner conflict semantics for genuinely new application requests. |
| **Assumptions** | Execution is synchronous and single-process in this prototype; the command catalog and local-user authorization remain closed; injected stores honor the atomic `execute` contract. |
| **Invalidation** | Async command callbacks; multi-process or distributed execution; replay retention requirements; catalog/version changes; different payload semantic-order rules; or a persistent adapter that cannot atomically reserve keys |
| **Status** | Active; PT-APP-001N complete and PT-APP-001O is next sequentially |
| **Linked Artifacts** | `docs/artifacts/gate-evidence/wp-3-application-replay.md`, `docs/Governance/decisions/reviews/REV-088-wp-3-application-replay-code-review.md`, `docs/Governance/decisions/reviews/REV-089-wp-3-application-replay-security-review.md`, GitHub issue #73 |

---

### DEC-033: Close Exact Application Schema Admission

| Field | Value |
|-------|-------|
| **ID** | DEC-033 |
| **Date** | 2026-09-16 |
| **Category** | Contract admission |
| **Decision** | Close PT-APP-001M after enforcing duplicate-aware raw JSON admission, exact request and result schemas, owner-dispatch suppression, pre-dispatch Analytics identity ordering, complete transition and Job coherence, and cycle-safe opaque owner imports |
| **Policy** | DEC-023; DEC-028; DEC-030; DEC-032; approved WP-3 application contract; test-first development; code review; security review |
| **Authority** | Agent (Fully Agentic), with alternate-model Code Reviewer and Security Reviewer final PASS dispositions |
| **Accountable** | Solo Orchestrator publishes only PT-APP-001M artifacts, continues next to PT-APP-001N, and keeps precedence, composition, WP-4, release, deployment, and production gates closed |
| **Context** | The application catalog existed but runtime callers could not yet submit raw records through one exact admission boundary, and owner results lacked complete state-machine coherence checks. Initial review exposed unsorted replay-affecting Analytics identities, incomplete OT coverage, under-constrained Jobs, and permissive opaque record handling. |
| **Alternatives** | Rely on transport parsing; validate only top-level fields; admit owner data without coherence checks; close exact transport-independent admission before replay composition |
| **Consequences** | All 16 operations now reject malformed or duplicate-bearing records before owner dispatch and admit only exact coherent success projections. Analytics replay identities are canonical before ownership transfer. Opaque owner records retain identity but must be ordinary, recursively frozen, and acyclic. Replay conflict semantics remain PT-APP-001N. |
| **Reasoning** | Exact application admission must be transport-independent and precede replay handling so malformed, ambiguous, or noncanonical identities cannot reach owning contracts or acquire cached outcomes. Result coherence is part of the same trust boundary because independently valid fields can still encode impossible state. |
| **Assumptions** | The catalog remains closed at 9 commands and 7 queries; AnalyticsResult and Evidence remain opaque owner imports; no API, broker, provider, event, queue, scheduler, or WP-4 surface is introduced. |
| **Invalidation** | A catalog operation or schema change; a different replay identity policy; transport-specific admission replacing this boundary; mutable/cyclic owner imports becoming contractual; or a new transition/Job state |
| **Status** | Active; PT-APP-001M complete and PT-APP-001N is next sequentially |
| **Linked Artifacts** | `docs/artifacts/gate-evidence/wp-3-exact-schema-admission.md`, `docs/Governance/decisions/reviews/REV-086-wp-3-exact-schema-admission-code-review.md`, `docs/Governance/decisions/reviews/REV-087-wp-3-exact-schema-admission-security-review.md`, GitHub issue #73 |

---

### DEC-032: Close Fixture Identity And Stable-Error Remediation

| Field | Value |
|-------|-------|
| **ID** | DEC-032 |
| **Date** | 2026-09-16 |
| **Category** | Remediation closure |
| **Decision** | Close GitHub #71 after enforcing governed fixture identity grammars in application validation, mirroring dataset identity at the PostgreSQL trust boundary, mapping `check_violation` to `FIXTURE_MANIFEST_INVALID`, and re-baselining exact sequence-4-through-6 identities |
| **Policy** | DEC-028; DEC-031 mandatory WP-3 entry repair; test-first development; stable conformance errors; prototype-only empty-database migration policy; code and security review |
| **Authority** | Agent (Fully Agentic), with alternate-model Code and Security final PASS reviews |
| **Accountable** | Solo Orchestrator publishes only the bounded #71 artifacts, preserves one-package WP-3 WIP, and keeps live-provider, ring-exit, release, deployment, and production gates closed |
| **Context** | Aggregate WP-2 review found observation identity grammars were diagnostic-only and PostgreSQL check violations escaped the stable fixture contract. Initial #71 review additionally found the separately callable database function could persist malformed dataset identities. Red tests reproduced both defects. |
| **Alternatives** | Leave non-golden fixture acceptance denied; map errors without database identity mediation; close the complete application and database trust boundary with executable evidence |
| **Consequences** | WP-3 may proceed to its next sequential fixture-only application increment. Application and PostgreSQL reject malformed governed identities consistently, direct database check failures expose one stable code, and exact migration/catalog identities are current. Carried payload-cardinality, non-check SQLSTATE, and combined-defect precedence Minors remain outside #71. |
| **Reasoning** | A command boundary cannot safely accept non-golden packages while equivalent malformed identities receive different outcomes depending on whether they pass through TypeScript or call the granted database function directly. Complete mediation and stable errors remove that ambiguity before WP-3 handlers are introduced. |
| **Assumptions** | The prototype baseline remains inactive and empty-database-only; no released, deployed, production, or legacy migration ledger contains sequence 4; WP-3 remains local and fixture-only. |
| **Invalidation** | Activation or external application of the migration baseline; a new fixture identity grammar; exposure of fixture ingestion to a less-trusted caller; or evidence that an unmapped SQLSTATE is reachable through governed input |
| **Status** | Active; #71 remediation complete and WP-3 may continue sequentially |
| **Linked Artifacts** | `docs/artifacts/gate-evidence/wp-3-fixture-identity-error-mediation.md`, `docs/Governance/decisions/reviews/REV-062-wp-3-fixture-identity-code-review.md`, `docs/Governance/decisions/reviews/REV-063-wp-3-fixture-identity-security-review.md`, GitHub issues #71 and #73 |

---

### DEC-031: Close WP-2 And Open WP-3

| Field | Value |
|-------|-------|
| **ID** | DEC-031 |
| **Date** | 2026-09-15 |
| **Category** | Package closure |
| **Decision** | Close WP-2 after REV-059 aggregate PASS and authorize WP-3 as the only next sequential package, with GitHub #71 mandatory before any WP-3 command path accepts a non-golden dataset version |
| **Policy** | DEC-023; DEC-028; DEC-030; approved Ring 2 WBS; issue #70; REV-045..059; test-first development; stable conformance errors |
| **Authority** | Agent (Fully Agentic), subject to asynchronous Workspace Owner review through dedicated decision-transparency issue #72 |
| **Accountable** | Solo Orchestrator closes #71 before non-golden ingestion, maintains one-package WIP, and keeps complete Ring 2 and production gates closed |
| **Context** | All PT-FIX-001A..O scenarios and undeclared-input behavior are implemented, reviewed, and published. The final suite is 292 discovered, 262 passed, 30 environment-skipped, and 0 failed; REV-053 retains zero-skip PostgreSQL 16.15 evidence. REV-059 Code and REV-060 Security reviews found missing application identity-grammar gates and unmapped PostgreSQL check violations, but the hash-pinned golden package remains conformant and database constraints prevent invalid persistence. |
| **Alternatives** | Reopen WP-2 and repair before closure; close without tracking the gaps; close conditionally and make repair an explicit WP-3 entry prerequisite |
| **Consequences** | WP-2 closes and WP-3 may start. #71 must complete before a non-golden fixture reaches a command handler. No deployment-level network isolation, live-provider path, baseline activation, architecture acceptance, Ring 2 exit, release, deployment, or production authority follows. |
| **Reasoning** | The delivered golden fixture path satisfies the approved WP-2 outcome, while the newly identified stable-error gap becomes consequential only when WP-3 introduces a submission boundary. Binding remediation to that entry point preserves sequential delivery without hiding the defect. |
| **Assumptions** | WP-3 remains local, fixture-only, and single-stream; fixture migration bytes do not change without renewed PostgreSQL execution; no non-golden dataset is accepted before #71 closes. |
| **Invalidation** | Failure to close #71 before non-golden ingestion, fixture migration drift without database revalidation, a live-provider path, a second implementation stream, or a change to the approved package sequence |
| **Status** | Active; WP-2 closed conditionally and WP-3 authorized next |
| **Linked Artifacts** | `docs/Governance/decisions/reviews/REV-059-wp-2-aggregate-closure-review.md`, `docs/Governance/decisions/reviews/REV-060-wp-2-aggregate-security-review.md`, `docs/Governance/decisions/reviews/REV-061-dec-031-wp-2-closure-plan-review.md`, `docs/artifacts/gate-evidence/wp-2-exit.md`, GitHub issues #22, #70, #71, and #72 |

---

### DEC-030: CT-DB-001 Work-Package Allocation Clarification

| Field | Value |
|-------|-------|
| **ID** | DEC-030 |
| **Date** | 2026-09-15 |
| **Category** | Planning |
| **Decision** | Correct CT-DB-001 acceptance allocation at executable leaf level: WP-1 closes complete A/B/C/L and D/K foundation leaves; WP-2 through WP-6 close their domain leaves when dependencies exist; WP-8 closes complete integrated A-L |
| **Policy** | DEC-023; DEC-028; approved sequential WBS; issue #66; cost-estimation variance controls; capture at origin |
| **Authority** | Solo Orchestrator under the Fully Agentic override in DEC-028, subject to independent Plan Reviewer validation |
| **Accountable** | Solo Orchestrator |
| **Context** | The WP-1 WBS row assigned the full physical schema and used A-L shorthand, while issue #66 required only A-D/K/L foundation execution and retained E-J for later packages. D, E, J, and K contain leaves spanning several domains, so assigning each whole scenario to one early package would be infeasible. Aggregate Code and Plan reviews identified both contradictions. |
| **Alternatives** | Keep A-L in WP-1 and overclaim unavailable behavior; assign each whole scenario to one package despite cross-domain leaves; allocate executable leaves incrementally and retain final integrated closure in WP-8 |
| **Consequences** | WP-1 may close on reviewed foundation evidence without claiming later domain acceptance. Package reviews preserve leaf evidence, later complete-scenario checks verify composition, and WP-8 remains accountable for integrated A-L closure. This is an acceptance-allocation correction, not a scope removal. No estimate, dependency, product scope, contract content, or package order changes. |
| **Reasoning** | D and K depend on later denial, reader, fixture-policy, and ledger-integrity behavior; J depends on both application restart and later analytics effects; E spans fixture, application, analytics, and ledger numeric classes. Leaf ownership makes each package exit executable while final integrated closure prevents fragmented acceptance. |
| **Assumptions** | The approved package outcome matrix remains authoritative and Ring 2 continues as one sequential stream. |
| **Invalidation** | A later package removes its assigned domain behavior, the PostgreSQL contract changes scenario ownership, or the Workspace Owner changes Ring 2 scope or sequencing |
| **Status** | Active |
| **Linked Artifacts** | `docs/Planning/tasks/ring-2-wbs.md`, `docs/artifacts/gate-evidence/wp-1-exit.md`, GitHub issue #66 |

---

### DEC-029: Analytics Retention Epoch and Canonicalization

| Field | Value |
|-------|-------|
| **ID** | DEC-029 |
| **Date** | 2026-09-14 |
| **Category** | Architecture |
| **Decision** | Represent analytics retention epochs as `timestamp(3) with time zone`, generate the epoch once inside `evidence_commit`, derive deadlines from elapsed 24-hour intervals, and add private helper `_evidence_rfc8785(jsonb)` so generated retention-bearing records are hashed as RFC 8785 bytes in the atomic transaction |
| **Policy** | DEC-017; DEC-018; ADR-001; analytics evidence contract; PostgreSQL exact-catalog closure; Fully Agentic governance |
| **Authority** | Solo Orchestrator under DEC-028 after independent Architect Reviewer approval of Option A |
| **Accountable** | Solo Orchestrator |
| **Context** | The PostgreSQL table registry alone declared `retention_epoch bigint`; the governing retention decision, ADR, OpenAPI UTCInstant, and canonical golden bytes all require a database-generated UTC instant. PostgreSQL 16 has no built-in RFC 8785 serializer, so the generated epoch could not enter verified bundle and manifest hashes with only the two public controlled functions. |
| **Alternatives** | Retain bigint; trust `jsonb::text`; accept caller-generated epoch/hashes; two-step adapter protocol; private RFC 8785 helper |
| **Consequences** | Migration 0005 contains three functions, but only `evidence_commit` and `evidence_read` are runtime APIs. The helper is invoker-security, immutable, strict, parallel safe, owner-only, and included in exact manifest hashes. No populated migration compatibility is required. |
| **Reasoning** | The selected design preserves database time authority, atomic evidence integrity, replay stability, and the governing canonical hash contract without adding an extension or trusting caller-generated final evidence. |
| **Assumptions** | The accepted evidence JSON profile prohibits arbitrary JSON numbers and permits only canonical safe integers on closed fields. |
| **Invalidation** | PostgreSQL adds a reviewed native RFC 8785 facility, the evidence hash contract changes, or a populated 0005 baseline exists before this correction is published |
| **Status** | Active |
| **Linked Artifacts** | `docs/Architecture/ADRs/ADR-001-analytics-evidence-retention.md`, `docs/Planning/contracts/analytics-evidence-contract.md`, `docs/Planning/contracts/postgresql-contract.md`, GitHub issue #68 |

---

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

### DEC-028: Enable Fully Agentic Delivery

| Field | Value |
|-------|-------|
| **ID** | DEC-028 |
| **Date** | 2026-09-14 |
| **Category** | Governance |
| **Decision** | Change workspace autonomy from Human-in-the-Loop to Fully Agentic. The Solo Orchestrator may evaluate, decide, record, and proceed through routine work, review remediation, work-package progression, and ring gates without waiting for synchronous Workspace Owner approval. |
| **Policy** | `.github/skills/human-decision-points.md` section 5; Tier 1 Small Team; Light governance; prototype scope and sequential Ring 2 WBS |
| **Authority** | Workspace Owner selected the recommended Fully Agentic mode after reviewing the retained approval boundaries. |
| **Accountable** | Solo Orchestrator preserves required tests, reviews, evidence, decision logging, and GitHub issue traceability; stops for DP-1, DP-25, and DP-26; and does not expand the approved prototype or begin a dependent work package before its prerequisites pass. |
| **Context** | The Workspace Owner is satisfied with observed detail and accuracy and requested fewer synchronous approvals so implementation can proceed more efficiently. |
| **Alternatives** | Retain Human-in-the-Loop; require approval only at ring gates; define custom decision boundaries. |
| **Consequences** | Routine approvals become asynchronous and are represented by decision records and GitHub issues. Production deployment, emergency hotfix approval, and team-tier selection remain human decisions. The Workspace Owner may restore Human-in-the-Loop mode at any time. |
| **Assumptions** | Existing quality controls remain active and the agent escalates ambiguity, unavailable authority, budget hard stops, secrets, and irreversible production actions. |
| **Invalidation** | Workspace Owner revocation, repeated material quality failures, a required governance degradation trigger, or inability to maintain the mandated audit trail restores or requires a lower-autonomy mode. |
| **Status** | Active |
| **Linked Artifacts** | `.github/workspace-config.md`, `.github/skills/human-decision-points.md`, `docs/Planning/tasks/ring-2-wbs.md` |
