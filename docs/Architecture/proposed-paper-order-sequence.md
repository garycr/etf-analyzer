# Proposed Paper Order Sequence

## Status
Status: Proposed - pending architecture review and human approval; not an accepted ADR

## Purpose and scope
This sequence describes the proposed paper-order workflow for the ETF prototype. It captures the requirement that a research signal is display evidence only until a user explicitly creates and confirms a paper action. No outside order transmission or brokerage integration is in scope. The portfolio service validates the order context, simulates a fill locally, records ledger effects, and reconciles projected values without ever creating a real execution path.

## Accessible description
The flow begins with a signal displayed in the UI. That signal remains informational only unless the user chooses to create a paper order. The user is then asked to confirm the action, and only after confirmation does the portfolio service validate the state, simulate a fill, and append a transaction to the ledger. The ledger becomes the source of truth for cash, lots, positions, and valuations. Reconciliation occurs against the local portfolio rules and projection assumptions. Labels and narrative explain each state transition and there is no path to a brokerage service. Financial precision is required at the ledger boundary: bounded PostgreSQL numeric types, canonical per-field precision and scale, and a single documented rounding mode are enforced before reconciliation; the exact values and rounding mode remain a proposed Ring 1 ADR decision. Evidence and diagnostics remain restricted to immutable, hash-verified records and allowlisted metadata rather than raw provider data or secret-bearing support bundles.

```mermaid
sequenceDiagram
    autonumber
    participant User as Research user
    participant UI as Browser UI
    participant API as Web API
    participant Portfolio as Portfolio service
    participant Ledger as Append-only ledger\nbounded numeric fields + canonical precision / scale
    participant Reconcile as Reconciliation and projection\nrounding mode + test vectors
    participant Audit as Audit / event log

    User->>UI: Views research signal and evidence
    UI-->>User: Display signal only; no auto-order mutation
    User->>UI: Chooses Create paper order
    UI->>API: Submit paper-order draft for review
    API->>Portfolio: Validate signal, cash, lot constraints, and state
    alt Not valid or no confirmation
        Portfolio-->>API: Reject or keep Draft state
        API-->>UI: Show blocked validation or remain Draft
        UI-->>User: No fill or ledger mutation
    else User confirms
        User->>UI: Explicit confirm paper action
        UI->>API: Confirm order
        API->>Portfolio: Accept order and prepare local simulation
        Portfolio->>Portfolio: Simulate fill using local rules and assumptions
        Portfolio->>Ledger: Append transaction, cash, lots, and position events with bounded numeric precision
        Portfolio->>Reconcile: Rebuild positions and projected valuations with configured rounding and test vectors
        Reconcile-->>Portfolio: Reconciliation result within tolerance
        Portfolio->>Audit: Record user confirmation and ledger evidence
        Portfolio-->>API: Order accepted with final state
        API-->>UI: Show accepted, filled, partial, or rejected state
    end

    note over Portfolio,Audit: No brokerage connector, no live-buy/sell API, no order transmission path, and no raw-provider diagnostics without redaction are part of this flow.
```

## Proposed architecture requirements
- Financial precision: the portfolio ledger and reconciliation path require bounded PostgreSQL numeric types, canonical per-field precision and scale, one documented rounding mode, and reconciliation test vectors; exact numeric values and rounding mode remain a proposed Ring 1 ADR decision.
- Evidence and diagnostic control: immutable, hash-verified evidence is retained with least-privilege access, configurable retention, and controlled archival/rotation; raw provider payload access remains restricted and diagnostics use only allowlisted metadata and hashes.
- No brokerage path: the research-only paper-order flow remains explicitly non-execution and excludes live broker, order transmission, and real-order semantics.

## Traceability
| Feature file | Rule title | Scenario title | Coverage |
| --- | --- | --- | --- |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Scope and non-goals | The prototype is local-only and excludes execution and streaming features | No brokerage connector and no real-order endpoint |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | No user action means no paper mutation | Signals remain informational until explicit action |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | An unconfirmed paper order remains draft | Draft semantics and explicit confirmation |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | The portfolio ledger rebuilds exactly within configured decimal precision | Reconciliation and ledger rebuild |

## Source references
- [Objective PDF](../customer-docs/Objective/ETF%20Trade%20Recommendation%20Prototype%20Requirements.pdf)
- [Program narrative](../customer-docs/Objective/program-narrative.md)
- [Objective summary](../customer-docs/Objective/objective-summary.md)

## Risks and assumptions
- The design assumes all paper-order actions are local and user-confirmed; no hidden automatic fill behavior is allowed.
- Reconciliation assumes deterministic fill simulation rules and configured decimal tolerances.
- Because this is research-only, no external account, cash, or broker semantics are assumed or modeled.
- The portfolio ledger is treated as the source of truth for hypothetical performance and valuations.

---
