# Paper-Order Domain Contract

**Contract version:** `1.0.0-candidate.1`
**Baseline target:** `v1.0.0`
**Status:** Candidate - Team Lead review and baseline freeze pending
**Custodian:** Team Lead
**Source issue:** GitHub #14
**Architecture status:** Proposed; this coordination contract does not accept architecture or an ADR

## Scope

This contract defines the complete local paper-order lifecycle for the research-only ETF prototype. It governs domain state names, allowed transitions, confirmation and mutation boundaries, terminal behavior, and behavioral acceptance tests. Ledger precision, rounding, FIFO valuation, and reconciliation values remain owned by GitHub #20 and #9 and are not selected here.

No state or transition represents a broker, provider-side paper-trading service, real order, external account, transmission, or execution. All validation, acceptance, fill simulation, cancellation, expiry, audit, and resulting ledger activity are local.

## Canonical State Enum

The serialized domain enum is closed to these case-sensitive values:

| State | Meaning | Terminal | UI label |
| --- | --- | --- | --- |
| `Draft` | User-created local proposal that has not completed explicit confirmation | No | Draft |
| `Submitted` | Explicitly confirmed local proposal awaiting portfolio-rule validation | No | Submitted |
| `Accepted` | Locally validated order eligible for simulated fill, cancellation, or expiry | No | Accepted |
| `Partial` | Some quantity was filled by local simulation and an open remainder exists | No | Partially Filled |
| `Filled` | Entire requested quantity was filled by local simulation | Yes | Filled |
| `Rejected` | Local validation rejected the submitted order | Yes | Rejected |
| `Canceled` | User canceled the unfilled quantity of an accepted or partial order | Yes | Canceled |
| `Expired` | The accepted order reached its local expiry rule before completion | Yes | Expired |

`Partial` is the only domain and wire value for the partially filled state. **Partially Filled** is display text only. `Cancelled`, `PartiallyFilled`, and `Partially Filled` are invalid enum values.

## Allowed Transition Set

The transition relation is closed: a source/target pair not listed here is invalid.

| ID | Source | Target | Required trigger/guard | Required domain effect |
| --- | --- | --- | --- | --- |
| OT-01 | Initial | `Draft` | User explicitly chooses to create a paper order from displayed research evidence | Create a local draft only; do not fill or mutate the ledger/portfolio |
| OT-02 | `Draft` | `Submitted` | The same user explicitly confirms the paper action and the confirmation is recorded | Record confirmation evidence and submit for local validation; do not fill yet |
| OT-03 | `Submitted` | `Accepted` | Portfolio validation passes against the current local state | Record local acceptance and make the order eligible for simulation |
| OT-04 | `Submitted` | `Rejected` | Portfolio validation fails or the current local state blocks the order | Record a redacted rejection reason; do not fill or mutate the ledger/portfolio |
| OT-05 | `Accepted` | `Partial` | Local simulation fills a positive quantity smaller than the open quantity | Append immutable fill/ledger evidence for only the simulated quantity and retain the open remainder |
| OT-06 | `Accepted` | `Filled` | Local simulation fills the complete open quantity | Append immutable fill/ledger evidence and close the order |
| OT-07 | `Accepted` | `Canceled` | User cancels before any fill completes | Record cancellation evidence; append no fill for the canceled quantity |
| OT-08 | `Accepted` | `Expired` | The deterministic local expiry rule becomes true before a fill completes | Record expiry evidence; append no fill for the expired quantity |
| OT-09 | `Partial` | `Filled` | Local simulation fills the complete remaining quantity | Append immutable evidence for the remaining simulated fill and close the order |
| OT-10 | `Partial` | `Canceled` | User cancels the remaining open quantity | Preserve prior fills and ledger entries; record cancellation of only the remainder |

## Transition Command and Atomicity

The domain transition engine applies **exactly one** OT transition per transition command. An API request or application workflow may orchestrate multiple commands, but it may not skip, collapse, or hide intermediate states. Every constituent transition must independently satisfy its guard, atomicity, effect, and evidence requirements.

Each transition command contains:

- `orderId`, identifying the aggregate;
- `transitionCommandId`, the idempotency identity scoped uniquely within that order;
- `correlationId`, used only to connect commands in one application workflow and never for deduplication;
- `expectedVersion`, the non-negative aggregate version observed when the command was formed;
- `sourceState`, `targetState`, and `trigger`;
- normalized transition payload, containing only fields required by that transition; and
- `baselineVersion`.

Equivalent command content means the canonical serialization of `orderId`, `expectedVersion`, `sourceState`, `targetState`, `trigger`, normalized transition payload, and `baselineVersion` is identical. Reusing `(orderId, transitionCommandId)` with equivalent content returns the original result. Reusing it with different content fails with `ORDER_IDEMPOTENCY_CONFLICT`. Correlation identifiers may be shared across constituent commands and do not affect equivalence.

The engine atomically compares `expectedVersion` with the authoritative aggregate version, evaluates the transition guard, applies state/fill/ledger effects, increments the aggregate version, and writes transition/audit evidence. A mismatch fails with `ORDER_VERSION_CONFLICT`; no part of the command is applied.

## Invariants

1. A displayed signal has no order or portfolio mutation effect.
2. Only explicit user creation produces a `Draft`; signals never auto-create orders.
3. Only explicit confirmation permits `Draft -> Submitted`.
4. `Submitted` performs validation only. Fill and ledger mutation cannot occur until local acceptance.
5. Fill effects occur only on OT-05, OT-06, and OT-09 and use local simulation.
6. Every successful transition, including each constituent transition in an orchestrated workflow, records source, target, trigger, UTC timestamp, actor, correlation identifier, transition command identifier, prior/resulting aggregate versions, and baseline version without secrets or prohibited raw provider data.
7. Invalid transitions fail atomically: state, aggregate version, fills, positions, cash, lots, and ledger remain unchanged, and a redacted rejection/audit record is produced.
8. `Filled`, `Rejected`, `Canceled`, and `Expired` are terminal. No transition out of a terminal state is valid.
9. Cancellation after `Partial` affects only the open remainder; immutable prior fills are never deleted or rewritten.
10. Corrections to accepted fill/ledger evidence use reversing transactions under #20; state history and audit evidence are never rewritten.
11. Replaying equivalent content with the same `(orderId, transitionCommandId)` cannot apply a second state or ledger mutation; different content with that identity is an idempotency conflict. `correlationId` is trace-only.
12. State display is conveyed by text and semantics, not color alone; the UI label for `Partial` is **Partially Filled**.

## Invalid Transition Contract

An attempted transition is rejected when the target is absent from the allowed set for the current source, a required trigger/guard is absent, the request uses an unknown or incorrectly cased enum value (including `Cancelled`, `PartiallyFilled`, `Partially Filled`, or `partial`), `expectedVersion` differs from the authoritative aggregate version, or `(orderId, transitionCommandId)` conflicts with different command content.

The rejection result and redacted audit evidence must identify the current state, requested target where parseable, stable error code, and recoverable explanation. It must not expose secrets, raw provider payloads, or brokerage semantics. Stable error families are `ORDER_INVALID_TRANSITION`, `ORDER_GUARD_FAILED`, `ORDER_UNKNOWN_STATE`, `ORDER_TERMINAL_STATE`, `ORDER_IDEMPOTENCY_CONFLICT`, and `ORDER_VERSION_CONFLICT`. Rejection is not represented as a successful transition to `Rejected`; the `Rejected` state is reserved for OT-04 local portfolio validation failure.

## Behavioral Acceptance Tests

| Test ID | Given | When | Then | Trace |
| --- | --- | --- | --- | --- |
| CT-ORD-001 | A displayed signal and no user action | Time passes or analytics refreshes | No order, fill, position, or ledger mutation occurs | Objective: No user action means no paper mutation |
| CT-ORD-002 | A user-created `Draft` without completed confirmation | Submission is requested | The order remains `Draft` and no fill/ledger mutation occurs | Objective: An unconfirmed paper order remains draft; OT-02 |
| CT-ORD-003 | A confirmed `Draft` | OT-02 is applied once | State becomes `Submitted`, confirmation evidence exists, and no fill exists | Proposed sequence; OT-02 |
| CT-ORD-004 | A `Submitted` order | Validation passes or fails | Exactly one of OT-03 or OT-04 occurs with no fill during validation | Proposed state view; OT-03/OT-04 |
| CT-ORD-005 | An `Accepted` order | Each locally valid completion trigger is applied | OT-05, OT-06, OT-07, and OT-08 each produce their specified target/effects | Proposed state view |
| CT-ORD-006 | A `Partial` order with prior immutable fill evidence | Remaining quantity fills or the user cancels it | OT-09 closes as `Filled`, or OT-10 closes as `Canceled` while preserving prior fills | Proposed state view |
| CT-ORD-007 | Any of the exact 62 source/target complements of OT-01 through OT-10, or any absent guard/unknown alias | The transition is attempted | The operation fails atomically with redacted evidence and all mutation surfaces unchanged | Issue #14 invalid-transition criterion |
| CT-ORD-008 | Any terminal order | Any further transition is attempted | The operation fails atomically with a stable terminal-state error | Terminal-state invariant |
| CT-ORD-009 | A previously applied transition command | Equivalent or different content reuses `(orderId, transitionCommandId)` | Equivalent content returns the original result; different content returns `ORDER_IDEMPOTENCY_CONFLICT`; neither remutates | Domain idempotency invariant |
| CT-ORD-010 | A `Partial` order is rendered | The UI exposes its status | Domain/wire value remains `Partial` and visible label is **Partially Filled** without color-only meaning | Issue #14; accessibility floor |
| CT-ORD-011 | Any lifecycle path | External calls and evidence are inspected | No broker/provider paper-trading connector, real-order endpoint, credential, or transmission exists | Objective scope/non-goals |
| CT-ORD-012 | A command carries a stale `expectedVersion` | The authoritative aggregate version has changed | Atomic comparison returns `ORDER_VERSION_CONFLICT`, redacted evidence, and no mutation | Invalid-transition contract |

## Traceability

| Requirement source | Contract coverage |
| --- | --- |
| GitHub #14 | Eight states, complete transitions, invalid-transition rejection, enum/display distinction, local confirmation, and behavioral tests |
| DEC-011 | Complete lifecycle; research-only/no-broker floor; immutable/reversing and exact-reconciliation boundaries retained for #20/#9 |
| Objective feature: Scope and non-goals | Local-only lifecycle with no broker, execution, credentials, or transmission |
| Objective feature: No user action means no paper mutation | Invariants 1-2; CT-ORD-001 |
| Objective feature: An unconfirmed paper order remains draft | Invariant 3; CT-ORD-002/003 |
| Paper-order lifecycle feature | Executable-specification scenarios for CT-ORD-001 through CT-ORD-012 |
| Proposed paper-order state view | OT-01 through OT-10 and terminal set |
| Proposed paper-order sequence view | Explicit confirmation, local validation/simulation, mutation ordering, audit, and no-broker boundary |
| CT-LED-001 planned baseline check | Fill-related transitions defer numeric and reconciliation assertions to #20/#9 without weakening them |

## Candidate Review Checklist

- [x] Team Lead confirms all eight enum values and OT-01 through OT-10; recheck PASS after negative-coverage and sequence-order remediation.
- [x] Code Reviewer APPROVED the closed-world transition, command, concurrency, evidence, and idempotency semantics as an implementable pre-code specification.
- [x] Test Reviewer PASS confirms CT-ORD-001 through CT-ORD-012 cover every allowed source/target and rejection family; design-time test-quality score 5.0/5.
- [x] UI/UX Designer PASS confirms the **Partially Filled** label and non-color-only domain floor; this is not end-to-end WCAG 2.1 AA UI certification.
- [x] Team Lead final PASS records applicable DEC-011 floor conformance; executable test strategy linkage remains a Ring 2 planning obligation.
- [ ] Affected streams acknowledge candidate `1.0.0-candidate.1` before baseline freeze.

The Gherkin feature is a reviewed behavioral specification, not passing executable evidence: no BDD runner or step bindings exist yet. Ring 2 planning must assign implementation of the tagged CT-ORD scenarios before code can satisfy this contract.

Ring 2 bindings must use an injected clock for OT-08 expiry and fixed concrete quantities for OT-05, OT-06, and OT-09 fill/remainder assertions. They must meet the repository coverage gates and cannot claim CT-LED-001 until #20/#9 precision and reconciliation vectors are approved.

Ring 2 UI evidence must verify keyboard operation and visible focus for create/confirm/cancel controls; programmatic name, role, value, and announced status changes; non-color communication for all eight states; and text-associated, announced recovery messages for invalid transitions and version conflicts. These obligations satisfy the Objective accessibility scenario but do not change the domain transition relation.

## Open Dependencies

- GitHub #20 and #9 must define immutable transaction/reversal details, FIFO lot rules, bounded PostgreSQL numeric precision/scale, rounding mode, and exact reconciliation vectors.
- The REST/OpenAPI contract under GitHub #17 must map the eight enum values and invalid-transition error model without changing this transition relation, and must prove an orchestrated request cannot skip, collapse, or hide constituent OT transitions.
- The PostgreSQL and event contracts must preserve transition history, idempotency/correlation identity, and immutable audit/ledger evidence.

Until those dependencies and all baseline contracts are reviewed, this candidate does not freeze `v1.0.0` or release parallel work.

## Review Record

| Review | Result | Scope |
| --- | --- | --- |
| Team Lead initial custody review | FAIL | Missing exhaustive negative cases and conflicting sequence-diagram order |
| Team Lead remediation recheck | PASS | Prior defects closed; accepted into the Building baseline for specialist review |
| Code Reviewer initial review | IMPROVEMENTS REQUIRED | Command/idempotency ambiguity and incomplete effect, complement, failure-evidence, and concurrency assertions |
| Code Reviewer final recheck | APPROVED | All findings closed; pre-implementation specification signoff recorded |
| Test Reviewer initial audit | PASS with Minor findings | Design-time score 4.68/5; literal error, trace-only correlation, and OT-01 guard mapping required |
| Test Reviewer remediation recheck | PASS | All Minor findings closed; unconditional specification signoff; design-time score 5.0/5 |
| UI/UX Designer accessibility review | PASS | Domain label/non-color floor approved; end-to-end WCAG UI evidence remains a Ring 2 obligation |
| Team Lead final floor review | PASS | Issue #14 criteria complete; applicable DEC-011 floors preserved; combined domain/ledger baseline remains Building on #20/#9 |

The Test Reviewer score evaluates specification design only. No scenario has executed, and no runner, bindings, implementation coverage, or passing test evidence exists yet.

## DEC-011 Floor Assertion

| Floor | Disposition |
| --- | --- |
| Eight-state lifecycle | Satisfied for issue #14 by the closed enum and OT-01 through OT-10 |
| Immutable/reversing FIFO and exact reconciliation | Preserved and pending detailed definition under #20/#9; no numeric or accounting choice accepted here |
| Five-part ingestion identity | Unaffected; no ingestion identity is redefined or claimed complete |
| Point-in-time truth and provider/fixture controls | Unaffected; no vintage, provider approval, or fixture behavior is changed or claimed complete |
| Reproducibility | Unaffected; analytics reproducibility remains owned by #15/#11 |
| Accessibility | Lifecycle label/non-color floor satisfied; full keyboard, focus, assistive-technology, all-state, and error-presentation evidence remains required in Ring 2 |
| Security and no-broker boundary | Satisfied for lifecycle scope through local-only transitions, redacted evidence, and explicit exclusion of connectors, credentials, and transmission |
| Cross-cutting NFRs | Not claimed complete; executable latency, readiness, recovery, and observability evidence remains under #22 and Ring 2 planning |

**Issue #14 disposition:** Acceptance criteria complete. Closing #14 does not freeze or activate baseline `v1.0.0`, complete #20/#9, authorize implementation, or release parallel execution.

Team Lead PASS does not activate or freeze `v1.0.0`, select precision or rounding, or release parallel execution.
