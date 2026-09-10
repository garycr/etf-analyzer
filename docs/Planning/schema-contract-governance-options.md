# Schema Contract Governance Options

**Ring:** Ring 1 - Plan/WBS/Estimate
**Issue:** GitHub #21
**Status:** Team Lead appointed as schema contract custodian after REV-009 disposition; baseline freeze pending; no ADR accepted
**Date:** 2026-09-10

## Decision to Make

Choose one accountable custodian for the frozen domain, REST/OpenAPI, PostgreSQL, and outbox/event contracts before MAI-ST parallel work begins. The custodian controls the baseline and change process but does not unilaterally accept architecture, alter canonical requirements, or authorize implementation.

## Fixed Constraints

- One role is accountable for contract consistency and versioning.
- Domain owners remain responsible for the correctness of their bounded contracts.
- Architecture remains Proposed until the applicable human gate.
- Breaking changes require impact analysis, compatibility evidence, and Workspace Owner approval.
- Parallel execution remains blocked until the baseline and custodian are evidenced.
- The contract baseline must preserve DEC-011 requirements: eight-state orders, immutable/reversing FIFO accounting, exact reconciliation, five-part ingestion identity, point-in-time truth, provider/fixture controls, reproducibility, accessibility, security, and NFRs.

## Option A - Solo Orchestrator as Custodian

**Accountable role:** Solo Orchestrator

**Advantages**

- Aligns custody with the current ring owner and cross-artifact governance trail.
- Minimizes handoffs in a small Tier 1 workspace.
- Provides one place to arbitrate domain/API/database/outbox conflicts.

**Trade-offs**

- Concentrates planning, governance, and contract custody in one role.
- Creates a throughput bottleneck during MAI-ST parallel work.
- Weakens separation between delivery coordination and architecture integrity.

**Invalidation condition:** The Solo Orchestrator cannot review contract changes independently of schedule pressure.

## Option B - Team Lead as Custodian

**Accountable role:** Team Lead

**Advantages**

- Uses an active Tier 1 role closest to cross-stream integration.
- Keeps the Solo Orchestrator focused on governance and human gates.
- Gives parallel streams a single operational contract authority.

**Trade-offs**

- Requires explicit escalation rules because the Team Lead cannot accept ADRs or change canonical scope.
- May still become a bottleneck if every non-breaking change requires synchronous review.
- Needs domain-owner review lanes to avoid centralizing subject-matter correctness.

**Invalidation condition:** The Team Lead role is unavailable or cannot remain independent across all parallel streams.

## Option C - Workspace Owner as Custodian

**Accountable role:** Workspace Owner

**Advantages**

- Places contract authority directly with the human who owns scope and consequential decisions.
- Eliminates ambiguity about approval of breaking changes.
- Provides strongest independence from delivery pressure.

**Trade-offs**

- Makes routine contract governance dependent on human availability.
- Mixes accountability for baseline integrity with approval authority.
- Reduces the speed benefit of MAI-ST and may create avoidable decision latency.

**Invalidation condition:** Human review cadence cannot support the required contract-change turnaround.

## Hybrid Recommendation - Team Lead Custody with Governed Escalation

**Recommended accountable custodian:** Team Lead

The Team Lead owns baseline integrity, versioning, compatibility checks, and change-log completeness. Domain owners review changes affecting their bounded context. The Solo Orchestrator verifies governance evidence and blocks work when the protocol is not met. The Workspace Owner approves breaking changes, scope changes, and ADR acceptance.

This preserves one accountable custodian while separating four responsibilities:

| Responsibility | Owner |
| --- | --- |
| Contract baseline integrity and versioning | Team Lead |
| Domain correctness and acceptance evidence | Relevant domain owner |
| Governance verification and work blocking | Solo Orchestrator |
| Breaking-change, scope, and ADR authority | Workspace Owner |

### Tier 1 Role Resolution

The Workspace Owner confirmed that the Team Lead operates as a **distinct dispatched agent instance** from the Solo Orchestrator for every custody action. The Tier 1 escalation path for this workspace is:

1. Team Lead (custodian)
2. Solo Orchestrator (governance verifier and first escalation)
3. Workspace Owner (breaking-change, scope, and ADR authority)

This workspace-specific path supersedes generic Team Lead references to inactive Ops Chief or Program Manager roles. It does not activate those roles or change the Tier 1 structure.

### Contract and Reviewer Ownership

| Contract class | Correctness owner | Required specialist review |
| --- | --- | --- |
| Domain and paper-order/ledger | Team Lead as custodian | Code Reviewer and Test Reviewer |
| REST/OpenAPI and UI-facing schemas | Team Lead as custodian | Code Reviewer and accessibility review by UI/UX Designer or Test Reviewer |
| PostgreSQL schemas and migrations | Team Lead as custodian | Code Reviewer and Test Reviewer |
| Outbox/events and correlation | Team Lead as custodian | Code Reviewer and Test Reviewer |
| Provider rights, egress, secrets, redaction, raw-data access | Team Lead as custodian | Security Reviewer |
| Analytics snapshot, rules, and evidence hashes | Team Lead as custodian | Code Reviewer and Test Reviewer |

At Tier 1 the Team Lead holds contract correctness accountability and obtains the named specialist evidence. No undefined `domain-owner` role is introduced.

## Common Freeze Baseline

Regardless of the selected custodian, the first baseline must include:

| Contract | Minimum frozen content | Evidence |
| --- | --- | --- |
| Domain | Aggregate boundaries, canonical identifiers, eight order states/transitions, ledger invariants, vintage and evidence concepts | Versioned domain contract and state table |
| REST/OpenAPI | Resource names, request/response schemas, error model, idempotency headers/tokens, research-only and confirmation boundaries | Versioned OpenAPI document with compatibility check |
| PostgreSQL | Bounded schemas, keys/constraints, five-part ingestion identity, transaction/reversal model, outbox tables, migration ordering | Versioned schema/migration contract and empty/populated migration checks |
| Outbox/events | Event names, versions, producer/consumer ownership, correlation/idempotency fields, payload redaction and no-broker constraints | Versioned event catalog and consumer compatibility matrix |
| Analytics snapshot/evidence | Immutable snapshot identity, rule and parameter versions, seed/environment fields, configuration/result hash formats, and verification behavior | Versioned analytics contract and reproducibility vectors |

OpenAPI versioning uses an explicit version in the specification metadata and a stable `/api/v1` path for the first baseline. Additive changes remain within `v1`; breaking changes require a new major path/version. A superseded major remains available until every recorded consumer migrates or the Workspace Owner approves its sunset with migration evidence.

## Change Protocol

1. Propose a change with affected contracts, rationale, requirement source, and compatibility classification.
2. Obtain domain-owner review and executable compatibility evidence where applicable.
3. Custodian classifies the change using the rubric below. Disputed or unclassifiable changes default to breaking.
4. The custodian records a DEC-011 canonical-floor conformance assertion for every change. Any possible floor impact routes to the Workspace Owner as a scope decision regardless of compatibility class.
5. The originator cannot approve their own contract change. When the Team Lead originates a change or re-baselining affects a committed date, the Solo Orchestrator must co-sign classification and evidence.
6. Patch/additive changes may enter the next baseline when required specialist and compatibility checks pass and the change log is complete.
7. Breaking changes require Workspace Owner approval and any applicable ADR/decision review before merge into the baseline.
8. Every WBS item, pull request, migration, and contract test records its target baseline version. The custodian publishes invalidation notices naming affected streams.
9. Parallel work consuming an invalidated baseline pauses until a new version is published, required checks pass, and every affected stream acknowledges the new baseline.

### Change Classification Rubric

| Class | Allowed examples | Breaking examples |
| --- | --- | --- |
| Domain | Documentation correction with no semantic change; optional metadata addition | State/transition change; ledger invariant change; identifier or meaning change |
| REST/OpenAPI | Description correction; backward-compatible optional response field | Required field; removed/narrowed field or enum; changed error/idempotency semantics; major path change |
| PostgreSQL | Comment/index with unchanged semantics; nullable additive column | `NOT NULL`/constraint tightening on populated data; key/type/meaning change; destructive migration |
| Outbox/events | Documentation correction; optional field ignored by old consumers | Removed/renamed field; changed meaning/order/delivery guarantee; event-name or version change |
| Analytics/evidence | Documentation correction; optional non-hash metadata | Snapshot identity, rule/parameter, seed/environment, or hash format/verification change |

### Named Compatibility and Migration Evidence

The baseline records planned test IDs before Ring 2. Tool selection may remain open, but the checks and fail-closed behavior are fixed:

| Planned test ID | Check | Gate behavior |
| --- | --- | --- |
| CT-API-001 | OpenAPI backward-compatibility diff against the active baseline | CI fails on an unapproved breaking change |
| CT-DB-001 | Apply migrations to an empty PostgreSQL database | CI fails on migration/schema mismatch |
| CT-DB-002 | Apply migrations to a representative populated database and verify data/constraints | CI fails on destructive or incompatible migration |
| CT-EVT-001 | Validate event producers and consumers against versioned schemas | CI fails on incompatible payload or semantic change |
| CT-LED-001 | Run immutable/reversing FIFO reconciliation vectors | CI fails on any unexplained difference |
| CT-ANA-001 | Reproduce configuration/result hashes from the frozen snapshot contract | CI fails on deterministic mismatch |

These test identifiers must be linked into the Ring 1 test strategy before Ring 2. Selecting specific tools or adding dependencies requires the normal OSS review.

### Continuity, Deadlock, and Emergency Rules

- If the Team Lead is unavailable, the Solo Orchestrator acts as custodian for time-critical patch review only; the Team Lead performs retro-review on return.
- Custodian/reviewer deadlock escalates to the Solo Orchestrator, then to the Workspace Owner if unresolved.
- Proposed patch/additive changes receive an initial custody response within two working days; missing the target triggers escalation but never automatic approval.
- Emergency action is **revert-only** to the last approved baseline. Forward-breaking emergency changes are prohibited without Workspace Owner approval.
- Custody effectiveness is re-evaluated at the Ring 1 to Ring 2 gate.

### Freeze and Architecture Status

A frozen contract is an implementation-coordination baseline, not architecture acceptance. If a later accepted ADR conflicts with the baseline, the ADR prevails and the custodian must re-baseline. No ADR is required solely to operate this Tier 1 custody protocol; an ADR may be proposed later through its own human gate.

## Freeze Acceptance Criteria

- The human-selected accountable custodian is recorded in the decision log.
- All four contract classes have an explicit version and owner.
- Compatibility and migration checks are named, with test implementation planned before development.
- The baseline contains no unresolved conflict with the canonical objective, DEC-011, or Proposed architecture views.
- A change log and invalidation procedure exist.
- Ring 1 planning marks parallel execution blocked until the freeze evidence is reviewed.
- Fixed artifact paths and the ownership registry exist under `docs/Planning/contracts/`.

## Human Selection

**Selected:** Team Lead custody with governed escalation.
**Authority:** Workspace Owner.
**Disposition date:** 2026-09-10.
**Review:** REV-009 remediation recheck APPROVED; all appointment-governance findings closed.
**Appointment:** Team Lead custody is effective for governance preparation.
**Handover completion:** Accountability transfers when DEC-013 is recorded in the canonical decision log and the Team Lead acknowledges custody in the contract registry.
**Freeze pending:** Parallel work remains blocked until baseline `v1.0.0` is populated, compatibility evidence is planned, every affected stream acknowledges it, and the Workspace Owner approves release of the block.
