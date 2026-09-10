# Proposed Paper Order Sequence

## Status
Status: Ledger-security design accepted at DP-33; remaining content Proposed; not an accepted ADR

## Purpose and scope
This sequence describes the proposed paper-order workflow for the ETF prototype. It captures the requirement that a research signal is display evidence only until a user explicitly creates and confirms a paper action. No outside order transmission or brokerage integration is in scope. The portfolio service validates the order context, simulates a fill locally, records ledger effects, and reconciles projected values without ever creating a real execution path.

## Accessible description
The flow begins with a signal displayed in the UI. That signal remains informational only unless the user chooses to create and explicitly confirm a paper order. A successful fill uses one PostgreSQL transaction for order/fill state, ledger records, FIFO allocations, successful audit evidence, HMAC commitment/checkpoint, deduplication, and versions. The in-database anchor procedure authenticates the canonical commitment without exposing key material to application writers. Failed business transactions roll back before a separate bounded audit outcome; PostgreSQL permission denials are captured by the database audit collector. The API returns after atomic commit, while projection verification and publication continue out of band. There is no brokerage path. DEC-014 canonical types and decimal round-half-even are enforced before exact no-epsilon reconciliation.

```mermaid
sequenceDiagram
    autonumber
    participant User as Research user
    participant UI as Browser UI
    participant API as Web API
    participant Portfolio as Portfolio service
    participant Audit as Audit collector\nimmutable intent + outcomes
    participant DB as PostgreSQL controlled writer\nledger + success audit + versions
    participant Anchor as In-database anchor procedure\nprotected key + checkpoint
    participant Projection as Projection worker\nverify + publish

    User->>UI: Views research signal and evidence
    UI-->>User: Display signal only; no auto-order mutation
    User->>UI: Chooses Create paper order
    UI->>API: Create local paper-order draft
    API->>Portfolio: Record Draft with no fill or ledger mutation
    Portfolio-->>API: Draft created
    API-->>UI: Show Draft and request explicit confirmation
    alt Confirmation absent
        UI-->>User: Remain Draft; no fill or ledger mutation
    else User explicitly confirms
        User->>UI: Confirm paper action
        UI->>API: Confirm Draft
        API->>Audit: Commit immutable attempt intent with command ID
        Audit-->>API: Intent ID committed
        API->>Portfolio: Transition Draft to Submitted and validate local state
        alt Validation fails or state blocks order
            Portfolio->>DB: Begin; lock order then portfolio; validate versions and invariants
            DB-->>Portfolio: Reject; rollback all business mutation
            API->>Audit: Append Rejected outcome referencing intent ID
            Portfolio-->>API: Submitted to Rejected; no fill or ledger mutation
            API-->>UI: Show Rejected with recoverable reason
        else Validation passes
            Portfolio->>DB: Begin; lock order then portfolio; compare expected versions
            Portfolio->>Portfolio: Simulate fill using local deterministic rules
            Portfolio->>DB: Append order/fill, effects, allocations, Committed outcome, dedup, and versions
            DB->>Anchor: Invoke with canonical commitment in same transaction
            Anchor->>Anchor: Read protected key; verify predecessor; append HMAC commitment + checkpoint
            Anchor-->>DB: Accepted anchor sequence or LEDGER_INTEGRITY_FAILED
            alt Anchor or invariant verification fails
                DB-->>Portfolio: Roll back complete transaction
                API->>Audit: Append IntegrityFailed outcome referencing intent ID
                Portfolio-->>API: Return recoverable failure; no projection publication
                API-->>UI: Show integrity failure with a plain reason and available recovery step
            else Atomic commit succeeds
                DB-->>Portfolio: Commit business state, Committed outcome, commitment, and checkpoint
                Portfolio-->>API: Return Accepted, Partial, or Filled local state
                API-->>UI: Show committed local state; projection may still be pending
                Portfolio-->>Projection: Enqueue committed portfolio sequence
                Projection->>DB: Verify chain/checkpoint and rebuild bounded pages
                DB-->>Projection: Exact DEC-014 result or LEDGER_INTEGRITY_FAILED
                alt Projection verification fails
                    Projection->>DB: Controlled projection procedure appends BlockedPublication; no projection change
                    DB-->>Projection: Atomic audit-only commit; projection remains unpublished
                    Projection-->>UI: Announce integrity-blocked status and keyboard-operable recovery action
                else Projection verification succeeds
                    Projection->>DB: Controlled projection procedure publishes and appends PublicationCompleted
                    DB-->>Projection: Projection + HMAC-chained outcome commit atomically
                    Projection-->>UI: Politely announce publication completion and clear pending status
                end
            end
        end
    end

    note over Audit,DB: A crash leaves a committed unresolved intent; a bounded collector appends TimeoutRecovery and later RecoveryCompleted. Pre-procedure denials append PermissionDenied from PostgreSQL audit logs.
    note over Portfolio,Anchor: No brokerage path, writer key/anchor access, orphan commitment, or unverified projection publication exists.
```

## Proposed architecture requirements
- Financial precision: DEC-014 fixes `NUMERIC(28,10)` quantity/unit value, `NUMERIC(28,8)` money, and `NUMERIC(28,12)` rates/ratios with round-half-even; reconciliation uses exact canonical equality with no epsilon.
- Atomicity and publication: lock order is order then portfolio. One PostgreSQL transaction contains successful business state, the `Committed` outcome, HMAC commitment, and latest protected checkpoint; the controlled writer invokes the anchor procedure but cannot read its key or tables. Derived projections publish later through `projection_runtime` only after committed-chain verification.
- Failed-attempt audit: `audit_runtime` commits `IntentRecorded` before business processing and appends `Rejected` or `IntegrityFailed` after rollback. Unresolved intents expose crash windows and receive `TimeoutRecovery` followed by `RecoveryCompleted`. Pre-procedure denials append `PermissionDenied` from PostgreSQL audit logs correlated by command/intent ID.
- Evidence and diagnostic control: immutable, hash-verified evidence is retained with least-privilege access, configurable retention, and controlled archival/rotation; raw provider payload access remains restricted and diagnostics use only allowlisted metadata and hashes.
- No brokerage path: the research-only paper-order flow remains explicitly non-execution and excludes live broker, order transmission, and real-order semantics.

## Traceability
| Feature file | Rule title | Scenario title | Coverage |
| --- | --- | --- | --- |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Scope and non-goals | The prototype is local-only and excludes execution and streaming features | No brokerage connector and no real-order endpoint |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | No user action means no paper mutation | Signals remain informational until explicit action |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | An unconfirmed paper order remains draft | Draft semantics and explicit confirmation |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | The portfolio ledger rebuilds with exact canonical equality after DEC-014 quantization; no epsilon | Reconciliation and ledger rebuild |

## Source references
- [Objective PDF](../customer-docs/Objective/ETF%20Trade%20Recommendation%20Prototype%20Requirements.pdf)
- [Program narrative](../customer-docs/Objective/program-narrative.md)
- [Objective summary](../customer-docs/Objective/objective-summary.md)

## Risks and assumptions
- The design assumes all paper-order actions are local and user-confirmed; no hidden automatic fill behavior is allowed.
- Reconciliation assumes deterministic fill simulation rules and requires exact canonical equality after DEC-014 quantization; no tolerance or epsilon is permitted.
- Because this is research-only, no external account, cash, or broker semantics are assumed or modeled.
- The portfolio ledger is treated as the source of truth for hypothetical performance and valuations.

---
