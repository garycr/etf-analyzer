# Prototype Contract Surface Inventory

**Inventory version:** `1.0.0-candidate.3`
**Prototype candidate:** `v1.0.0-prototype.1` - planning, inactive
**Owner:** Team Lead
**Governance verifier:** Solo Orchestrator
**Independent verification:** Complete - REV-019 and REV-027 PASS
**Architecture status:** Proposed
**Implementation status:** Partial; WP-1 durable-storage foundations, WP-2 fixture input, and the WP-3 application boundary are executable. WP-4 through WP-8 product surfaces remain pending. Governance automation and planning artifacts are not ETF product surfaces unless they consume or expose the prototype candidate contract.

## Purpose

This is the fixed inventory required by DEC-022 and issue #21. It enumerates planned and implemented prototype contract surfaces before implementation begins. A surface appearing in implementation without a matching inventory entry and candidate contract fails `PT-CONTRACT-SCOPE-INVENTORY`, blocks merge, and re-triggers Team Lead custody and independent review.

This inventory governs ETF Analyzer product behavior and its executable/deployable contract consumers. Repository governance automation and planning tools remain out of product scope unless they consume, implement, expose, or connect to a listed prototype surface.

The inventory does not activate a baseline, authorize implementation or dependencies, accept Proposed architecture, release parallel work, or advance Ring 2.

## Minimum Surface Inventory

| Surface category | Planned | Implemented | Candidate contract or justified absence | Prototype boundary | Current disposition |
| --- | --- | --- | --- | --- | --- |
| Domain/order | Yes | No | `docs/Planning/contracts/domain-contract.md` `1.0.0-candidate.1` | Local research-only paper-order lifecycle; no broker, external account, credential transmission, or real execution | Contract Review Record: Code Reviewer APPROVED, Test Reviewer remediation PASS at 5.0/5, accessibility PASS, and Team Lead final floor PASS; aggregate binding pending |
| Ledger | Yes | No | `docs/Planning/contracts/ledger-contract.md` `1.0.0-candidate.2` | Immutable transactions, reversing corrections, FIFO lots, DEC-014 exact arithmetic, exact reconciliation | Contract Review Record and REV-011: candidate.2 Code/Test/Security rechecks PASS; aggregate binding pending |
| Analytics evidence | Yes | No | `docs/Planning/contracts/analytics-evidence-contract.md` `1.0.0-candidate.2`; DEC-021/#65 prototype allocation | Point-in-time fixture inputs, deterministic evidence, fail-closed publication, RET-A-1.0, seven #65 entry guards | Prototype planning accepted; full REV-014 remains FAIL and #57-#62 remain open and unwaived |
| Fixture input | Yes | Yes | `docs/Planning/contracts/fixture-contract.md` `1.0.0-candidate.2`; executable `PT-FIX-001A..O` | Sole prototype data-source boundary; closed versioned market/economic fixtures, verifiable provenance, deterministic cutoff/order/DQ semantics, no live-provider fallback | REV-059 conditional PASS; approved golden path executable; #71 required before non-golden WP-3 ingestion |
| Durable storage | Yes | No | `docs/Planning/contracts/postgresql-contract.md` `1.0.0-candidate.2`; `CT-DB-001A..L` design-time plan | Local PostgreSQL persists domain, ledger, fixtures/provenance, analytics evidence, retention binding, audit records, protected anchor/commitment-chain state, and resumable job lifecycle/restart state; it atomically publishes only verified projections, makes failed jobs visible, and gates readiness on migrations/connectivity under O-REQ-003, O-REQ-007, O-MET-006, and O-MET-008 | REV-025 final Team Lead custody PASS and REV-026 independent Architect Reviewer PASS; Ring 2 SQL, hashes, and executable conformance remain pending |
| User-facing application | Yes | Yes | `docs/Planning/contracts/application-contract.md` `1.0.0-candidate.2`; executable `PT-APP-001A..P` | Transport-independent commands/queries, resumable job lifecycle/restart, explicit failed-job status, readiness, stable failures, canonical display, redaction, warnings, and keyboard recovery contracts | WP-3 aggregate REV-094/095/096/097 PASS and DEC-037; HTTP adapter and renderer remain WP-4/WP-7 |
| Process-crossing API | Yes | No | `docs/Planning/contracts/openapi-contract.yaml` `1.0.0-candidate.2`; `CT-API-001A..L` design-time plan | Versioned localhost browser-to-API request/response boundary only; no public ingress, callbacks, webhooks, providers, brokers, or events | REV-027 Team Lead custody and independent alternate-model PASS; Ring 2 executable conformance remains pending |
| Durable handoff/event | No | No | Justified absence for `v1.0.0-prototype.1`: the Proposed C4 Job/outbox coordinator, Projection worker, and their outbox/queue/scheduled/delayed-consumer relationships are excluded from this prototype slice, not removed from or rejected by the Proposed target architecture | Prototype commands use no durable asynchronous handoff. Persisted job status, resumability, restart, failure visibility, readiness, and atomic publication of verified projections remain mandatory storage/application concerns; their presence does not itself authorize a queue or event surface. | Guarded absence; any durable delayed handoff requires `docs/Planning/contracts/event-catalog.md`, `CT-EVT-001`, storage coverage, inventory update, and re-review |

## Supporting Scope Assertions

| Concern | Planned prototype state | Required evidence before #21 closure |
| --- | --- | --- |
| Provider access | Versioned approved local fixtures only; no external provider connection from ETF product runtime or product-facing contract consumers | WP-2 REV-058 proves application-level configuration and pre-transport denial; deployment-level policy remains a later independent control |
| Compatibility | No active prior API, storage, fixture, evidence, or aggregate contract baseline | Re-evaluate `PT-CONTRACT-SCOPE-UPGRADE` on first baseline activation; no backward-compatibility claim now |
| Work streams | One sequential implementation stream | `docs/Planning/tasks/ring-2-wbs.md` fixes WP-1..WP-8 as one non-overlapping chain |
| Architecture | Proposed C4 target retained; this inventory selects its bounded prototype surfaces | DEC-011 conformance statement and review must confirm no architecture acceptance is implied |
| Baseline identity | `v1.0.0-prototype.1` beneath Building aggregate `v1.0.0` | WBS and schedule bind every planned package; Ring 2 work items and executable checks inherit that identity |
| DEC-011 conformance | PASS (planning) | `docs/Planning/ring-1-exit-assessment.md` confirms all floors and maps their executable proof to WP-1..WP-8 without claiming execution |

## Guard Status

| Guard | Planning status | Evidence or blocker | Failure or promotion consequence |
| --- | --- | --- | --- |
| `PT-CONTRACT-SCOPE-INVENTORY` | PASS (qualified: planning completeness) | All eight minimum categories are present with planned/implemented state, contract binding or justified absence, and boundary. | Any omitted or drifting surface blocks closure or merge and re-triggers inventory update, registry synchronization, Team Lead custody, and independent review. |
| `PT-CONTRACT-SCOPE-API` | PASS (qualified: design-time) | OpenAPI candidate.2 and exactly `CT-API-001A..L` have Team Lead custody and REV-027 independent alternate-model PASS; Ring 2 executable adapter/schema evidence remains pending. | Any API/version drift, missing executable evidence at the applicable gate, or non-loopback ingress reopens the guard and requires impact classification. |
| `PT-CONTRACT-SCOPE-STORE` | PASS (qualified: design-time) | PostgreSQL candidate.2 and exactly `CT-DB-001A..L` have Team Lead custody and REV-026 independent PASS; Ring 2 executable migration/catalog evidence remains pending. | Any store/version drift, missing executable evidence at the applicable gate, or alternate durable store reopens the guard and requires impact classification. |
| `PT-CONTRACT-SCOPE-UPGRADE` | PASS (qualified: no compatibility claim) | Current active baseline is None and no compatibility claim is made. Re-evaluation is mandatory on first activation. | Any prior-baseline claim promotes applicable API, storage, fixture, evidence, and migration checks, including `CT-DB-002` when relevant. |
| `PT-CONTRACT-SCOPE-EVENTS` | PASS (qualified: planned absence) | No durable delayed handoff is planned; Proposed C4 deferred workers are explicitly excluded only from this slice. | Any outbox, queue, scheduled worker, or later consumer promotes `docs/Planning/contracts/event-catalog.md`, `CT-EVT-001`, storage coverage, inventory update, and re-review. |
| `PT-CONTRACT-SCOPE-PROVIDER` | PASS (qualified: application-level execution) | Runtime is fixture-only; REV-058 proves configuration and pre-transport DNS/connection denial with zero successful connections. | A real-provider path promotes #17 rights, identity, outage, secret, deployment-policy, and egress work before connection. |
| `PT-CONTRACT-SCOPE-STREAMS` | PASS (qualified: planning) | The Ring 2 WBS fixes one sequential WP-1..WP-8 chain with no overlapping package or concurrent contract consumer. | A second concurrent consumer requires affected-stream notices, acknowledgements, inventory review, and separate Workspace Owner parallel-work release. |
| `PT-CONTRACT-SCOPE-ANALYTICS` | PASS (qualified: planning scope) | DEC-021/#65 assumptions and seven analytics guards remain the governing prototype allocation; implementation-time guard execution remains mandatory. | Guard failure follows the #65 mapping and reopens the applicable #57-#62 or analytics planning obligation. |

All eight guards run at freeze review, on every inventory or contract change, when any executable or deployable ETF product artifact in any repository path introduces or changes a surface, when an architecture view or ADR is accepted or changed, when DEC-021 or DEC-022 is invalidated, and at the Ring 1 to Ring 2 gate. The Re-evaluation Triggers section defines the same cadence and immediate-failure conditions.

## PT-CONTRACT-001 Planning Result

`PT-CONTRACT-001` has three ordered legs:

1. **Planning-inventory completeness:** every minimum category is represented with planned/implemented state and a candidate binding or justified absence.
2. **Contract resolution:** every planned or implemented surface resolves to a reviewed candidate contract and required compatibility-check plan.
3. **Implementation agreement:** during Ring 2, the inventory and candidate versions must match every executable/deployable surface and work item.

The planning-inventory completeness and contract-resolution legs pass. The WBS and schedule bind all planned work to `v1.0.0-prototype.1`. Implementation agreement is intentionally deferred to Ring 2 because no executable/deployable product surface exists. #21 is eligible for Workspace Owner closure as prototype contract-planning complete; closure does not satisfy or waive the deferred implementation-agreement leg.

## Publication Governance

DEC-013 no-self-approval applies. The Solo Orchestrator originated this inventory; distinct Team Lead custody review and independent alternate-model verification are required before publication acceptance. If the Team Lead originates a later change, the Solo Orchestrator must co-sign. The inventory publication is recorded in CC-004, and the mutable registry must remain synchronized with this version and review state.

Changes follow the registry's [Inventory Versioning Rule](README.md#inventory-versioning-rule). REV-019 corrections are documentation-only corrections reviewed as part of candidate.1. Candidate.3 synchronizes the reviewed application, PostgreSQL, and OpenAPI bindings without adding an implemented surface or activating a baseline.

## Re-evaluation Triggers

The Team Lead must re-evaluate this inventory at freeze review, on every inventory or contract change, when any executable or deployable ETF product artifact in any repository path introduces or changes a surface, when governance/tooling begins consuming or exposing the prototype candidate contract, when an architecture view or ADR is accepted or changed, when DEC-021 or DEC-022 is invalidated, and at the Ring 1 to Ring 2 gate. The following immediately fail the inventory guard: an unlisted product command/query or API operation, an unlisted durable product table/store, a product job/queue/outbox or delayed consumer, a real-provider endpoint reachable by the product or a product-data supplier, a second concurrent stream, a prior-baseline compatibility claim, or failure of a DEC-021/#65 analytics guard.

## Boundary

Full REV-014 remains FAIL; #57-#62 remain open and unwaived. Baseline `v1.0.0` remains Building and inactive, and `v1.0.0-prototype.1` remains an inactive planning candidate. No implementation, dependency installation, migration, baseline activation, architecture acceptance, deployment, parallel release, or Ring 2 advancement is authorized.
