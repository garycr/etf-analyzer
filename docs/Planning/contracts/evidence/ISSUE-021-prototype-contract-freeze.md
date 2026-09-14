# Issue 21 - Prototype Contract-Surface Freeze

## Scope and Authority

This artifact re-scopes #21 from a complete future-state aggregate baseline to the contract surfaces planned for and consumed by the first local, fixture-only, single-user prototype. It preserves DEC-013 custody and change governance while avoiding speculative production compatibility, event, provider, and multi-stream contracts.

This is a planning acceptance definition. It does not freeze or activate `v1.0.0`, authorize implementation or dependencies, release parallel work, accept Proposed architecture, or advance Ring 2.

## Prototype Assumptions

- Development remains one sequential implementation stream.
- Data sources remain approved local fixtures with outbound provider egress disabled.
- The canonical prototype is a browser workbench with a localhost HTTP API and PostgreSQL persistence. Their bounded contracts are expected before #21 closes.
- Outbox and asynchronous event producers or consumers are absent unless explicitly inventoried.
- Upgrade compatibility from a previously active database or API baseline is not claimed.

These assumptions are executable entry conditions, not permanent waivers.

## Required Prototype Freeze

| Requirement | Acceptance evidence |
| --- | --- |
| Custody | DEC-013 Team Lead custody, no-self-approval, escalation, change classification, continuity, and invalidation rules remain active. |
| Surface inventory | Team Lead owns `docs/Planning/contracts/prototype-surface-inventory.md`. `PT-CONTRACT-SCOPE-INVENTORY` non-vacuously enumerates planned and implemented domain/order, ledger, analytics-evidence, fixture-input, durable-storage, user-facing application, process-crossing API, and durable-handoff/event surfaces, or records a justified absence for each. An independent alternate-model reviewer verifies it. |
| Domain and ledger | The implemented slice identifies the exact reviewed domain/order and ledger candidate versions it consumes and preserves their lifecycle, arithmetic, reconciliation, no-broker, and baseline-version semantics. |
| Analytics | The implemented slice identifies the accepted prototype analytics allocation under DEC-021/#65 and preserves its seven entry guards, deterministic evidence, point-in-time, security, numeric, retention, and accessibility floors. |
| Fixture input | Publish a versioned fixture contract covering dataset identity/version, five-part market identity and job idempotency, economic release/vintage timestamps, source availability, revision ordering, decimal grammar/scale, provenance, data quality, and a named fixture-conformance check. |
| Durable storage | Publish a bounded contract for every store outside process memory that persists domain, ledger, analytics evidence, retention binding, or audit records. When PostgreSQL is used, cover implemented tables, keys, constraints, exact numeric types, evidence identities, transaction boundaries, migration ordering, and an empty-database migration check. |
| Application boundary | Publish a transport-independent contract for user-facing commands and queries, stable domain and analytics errors, displayed canonical decimal/date/status formats, redaction, research-only/no-broker behavior, and keyboard-accessible recovery. |
| HTTP API | Publish a bounded, versioned OpenAPI contract for the expected localhost process boundary, covering only implemented operations, schemas, stable errors, authorization, idempotency, and application-boundary semantics. Its absence requires an explicit Workspace Owner deviation from O-REQ-001 before #21 closes. |
| Events, conditional | If an outbox or asynchronous producer/consumer is inventoried, publish a bounded event catalog covering only implemented names, versions, ownership, correlation/idempotency fields, redaction, delivery semantics, and consumer compatibility. |
| Canonical floors | Record one DEC-011 conformance statement confirming the inventoried slice preserves no-broker behavior, deterministic evidence, exact arithmetic, fail-closed security, reachable-state accessibility, and Proposed architecture status. |
| Version binding | The prototype candidate identity is `v1.0.0-prototype.1`, a non-active bounded candidate beneath the Building aggregate `v1.0.0`. Every implementation work item and executable contract check names the candidate it consumes. Naming it does not freeze or activate it. |
| Registry synchronization | The Team Lead records the re-scope and each inventoried contract in the mutable contract registry and change log before closure. |
| Review | A distinct Team Lead custodian review and independent alternate-model review, recorded in review artifacts, find no unresolved Critical or Major gap. No-self-approval applies; a Team Lead-originated change requires Solo Orchestrator co-signature. |

## Conditional Entry Guards

| Guard | Passing condition | Failure consequence |
| --- | --- | --- |
| `PT-CONTRACT-SCOPE-INVENTORY` | The fixed inventory exists, covers every minimum surface category, agrees with planned and implemented surfaces, and assigns each present surface a contract/version | Any omission blocks closure or merge, updates the inventory and registry, and re-triggers Team Lead custody and independent review. |
| `PT-CONTRACT-SCOPE-API` | Every process-crossing request/response interface has a bounded versioned contract and `CT-API-001` plan | Missing or unversioned interfaces block freeze acceptance. Absence of the expected localhost API additionally requires a recorded Workspace Owner deviation from O-REQ-001. |
| `PT-CONTRACT-SCOPE-STORE` | Every durable store has a bounded contract; expected PostgreSQL persistence includes the `CT-DB-001` empty-migration plan | Missing storage coverage blocks freeze acceptance. Absence of PostgreSQL additionally requires a recorded Workspace Owner deviation from O-CST-007, O-REQ-009, and O-MET-008. |
| `PT-CONTRACT-SCOPE-UPGRADE` | No compatibility with a prior active API, storage, fixture, evidence, or contract baseline is claimed | The applicable populated-data, API, fixture, evidence, and migration compatibility checks, including `CT-DB-002` when relevant, become mandatory before the claim. Re-evaluate on first baseline activation. |
| `PT-CONTRACT-SCOPE-EVENTS` | No durable handoff crosses a process or transaction boundary for later consumption | A bounded event catalog and `CT-EVT-001` become mandatory. Job or queue tables always enter the durable-storage contract even when no separate event catalog is required. |
| `PT-CONTRACT-SCOPE-PROVIDER` | Every source is a versioned approved local fixture, and configuration plus local network/egress-policy evidence proves outbound provider access disabled | #17 provider rights, identity, outage, secret, and egress work becomes mandatory before connecting the provider. |
| `PT-CONTRACT-SCOPE-STREAMS` | The work-item registry names one sequential implementation stream and no concurrent contract consumer | Publish affected-stream notices, obtain acknowledgements, and secure a separate Workspace Owner parallel-work release before concurrency. |
| `PT-CONTRACT-SCOPE-ANALYTICS` | DEC-021/#65 assumptions and all seven analytics entry guards remain valid | Follow the #65 guard-to-issue mapping and reopen the applicable #57-#62 or analytics planning obligation before freeze acceptance. |

All guards run at freeze review, on every contract or inventory change, and at the Ring 1 to Ring 2 gate. `PT-CONTRACT-001` asserts that the fixed inventory matches all planned and implemented surfaces and that every present surface resolves to the recorded candidate contract version. Guard or inventory drift blocks merge until custody review is repeated.

## Deferred Full-Baseline Work

Truly speculative work consists of production API deprecation/sunset policy, generalized populated-database migration compatibility, event schemas without a durable handoff, real-provider integration, and multi-stream acknowledgement. HTTP API, PostgreSQL, and initial migrations are conditional-but-expected canonical prototype surfaces; omitting them requires the explicit Objective deviation stated above. Full REV-014 remains FAIL, and #57-#62 remain open and unwaived. The applicable guard promotes each deferred item before the prototype crosses its assumption boundary.

The Proposed C4 container view remains the target architecture. This freeze neither accepts nor changes it; the inventory and guards determine which target surfaces require bounded prototype contracts now.

## Closure Criteria

#21 may close as prototype-scoped planning complete when the fixed surface inventory is durable and independently verified, every planned surface has its bounded candidate contract and named Ring 2 conformance allocation, every justified absence has the required authority, planning guard dispositions pass, DEC-011 planning conformance is recorded, registry/change-log synchronization is complete, `v1.0.0-prototype.1` binding is planned, and the named design reviews pass. Executable agreement and runtime guard proof are Ring 2 completion evidence. Closing #21 does not activate a baseline or release implementation or parallel execution; those remain separate human decisions at their applicable gates.

## Closure Evidence Status

OpenAPI `1.0.0-candidate.2` now has Team Lead custody and REV-027 independent alternate-model PASS, exactly `CT-API-001A..L`, and synchronized inventory/registry/change-log records. `PT-CONTRACT-SCOPE-API` therefore passes qualified at design time.

#21 closed by Workspace Owner decision on 2026-09-11 as prototype contract-planning complete. The sequential WBS supplies the stream and version binding; the Ring 1 exit assessment records DEC-011 conformance; all planning guards pass or are qualified with a Ring 2 proof owner. Executable provider-egress, migration, adapter, implementation-agreement, and other runtime evidence remain mandatory in their assigned Ring 2 packages and are not claimed here. Closure authorizes Ring 2 to begin at WP-1 only; it does not activate a baseline, permit parallel work or live providers, deploy, or authorize production.
