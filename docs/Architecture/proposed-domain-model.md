# Proposed Domain Model

## Status
Status: Proposed - pending architecture review and human approval; not an accepted ADR

## Purpose and scope
This domain model captures the proposed bounded subgraphs for the ETF prototype. It organizes core entities around catalog, market and provenance data, economic vintages, analytics and evidence, backtest execution, portfolio append-only ledger behavior, operational controls, and audit trails. The model matches the objective requirement for a local single-user research system and excludes brokerage, execution, and credential semantics.

## Accessible description
The model is a set of related business entities rather than a single monolith. The catalog contains symbols, watchlists, and validation metadata. Market and provenance data capture raw and normalized observations and their job lineage. Economic vintages preserve observation time, release timestamp, transformation lineage, and validity. Analytics and evidence track deterministic rule executions, hashes, and warning states. Backtest data keeps snapshot-level inputs and assumptions. The portfolio ledger is append-only, with transactions and positions rebuilt deterministically from journaled events. Operational and audit records capture provider acknowledgement, job status, DQ bans, and user actions. All meaning is carried by element labels and surrounding text, not by color. The authoritative identity for market observations is not inferred from legacy (Symbol, Date) semantics: it is (instrument, trading date, provider, adjustment policy, revision), with an idempotency token or job identity used for safe reprocessing and migration checks against empty and populated datasets. Evidence records are immutable and versioned, with hash verification, least-privilege access, configurable retention, and controlled archival/rotation; the exact retention period remains a Ring 1 design decision. Raw provider payload access is restricted separately from operational hashes and metadata, and diagnostics use allowlisted fields instead of secret-bearing or prohibited raw payloads.

```mermaid
flowchart LR
    subgraph Catalog[Catalog and watchlist]
        Symbol[Symbol and ETF identity]
        Watchlist[Watchlist order, validation, and dedupe]
        ProviderPolicy[Provider policy\nacknowledgment and rights]
    end

    subgraph Market[Market and provenance]
        Raw[Raw market record\nprovider payload and timestamps]
        Identity[Canonical identity\n(instrument, trading date, provider, adjustment policy, revision)\n+ idempotency token / job identity]
        Normalized[Normalized market observation\nOHLCV and metadata]
        DQ[Data quality state\nquarantined, stale, invalid]
        Provenance[Provenance\njob, source, timestamps, hash]
        Constraints[DB unique and check constraints\nmigration checks on empty and populated datasets]
    end

    subgraph Economics[Economic vintages]
        EconObs[Economic observation\nrelease timestamp and value]
        Vintage[Vintage\nversioned transformation]
        Cutoff[Vintage cutoff\nT at or before evaluation time]
    end

    subgraph Analytics[Analytics and evidence]
        Rule[Rule contract\ndeterministic logic and parameters]
        Signal[Signal evidence\nstate, score, reason, hash]
        Warning[Bias / warning\nblocked bad data]
        Snapshot[Immutable snapshot\npoint-in-time inputs]
        Evidence[Immutable evidence record\nversioned, hash-verified, least-privilege access\nconfigurable retention and archival rotation]
    end

    subgraph Backtest[Backtest and portfolio]
        BacktestRun[Backtest run\nseed, benchmark, assumptions]
        Ledger[Append-only ledger\ntransactions, cash, lots]
        Position[Position / valuation\nrebuild from ledger]
        Reconcile[Reconciliation\nbounded numeric types, per-field precision/scale, rounding mode]
    end

    subgraph Ops[Operations and audit]
        JobStatus[Job status\nqueued, running, failed, suppressed]
        Audit[Audit log\nuser action, confirmation, evidence]
        Diagnostic[Redacted diagnostic export\nallowlisted metadata and hashes only\nraw provider payload access restricted]
    end

    Excluded[Excluded boundary\nNo brokerage connector\nNo real-order endpoint\nNo credential transmission path]

    Watchlist --> Symbol
    ProviderPolicy --> Raw
    Raw --> Identity
    Identity --> Constraints
    Identity --> Normalized
    Normalized --> Provenance
    Normalized --> DQ
    EconObs --> Vintage
    Vintage --> Cutoff
    Snapshot --> Rule
    Rule --> Signal
    Signal --> Warning
    Signal --> Evidence
    Evidence --> Audit
    Snapshot --> BacktestRun
    BacktestRun --> Ledger
    Ledger --> Position
    Position --> Reconcile
    JobStatus --> Audit
    Diagnostic --> Audit
    DQ --> JobStatus
    Audit --> Signal
    Excluded -.-> ProviderPolicy
```

## Proposed architecture requirements
- Ingestion identity and idempotency: the authoritative business identity is (instrument, trading date, provider, adjustment policy, revision), with an idempotency token/job identity for safe reprocessing; the design requires DB unique and check constraints plus migration checks on empty and populated datasets rather than treating legacy (Symbol, Date) semantics as proof of uniqueness.
- Evidence policy: analytics and domain evidence must be immutable and versioned, with hash verification, least-privilege access, configurable retention, and controlled archival/rotation; exact retention duration remains a Ring 1 design decision.
- Diagnostic redaction and access: raw provider payload access remains restricted from operators, while diagnostics can show only allowlisted metadata and hashes, with tests proving secrets and prohibited raw provider data are absent.
- Financial precision: the portfolio and paper-order model require bounded PostgreSQL numeric types, canonical per-field precision and scale, one documented rounding mode, and reconciliation test vectors; exact values and rounding mode remain a proposed Ring 1 ADR decision.

## Traceability
| Feature file | Rule title | Scenario title | Coverage |
| --- | --- | --- | --- |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Watchlists, market data, and backfill | A user maintains a watchlist and resumable backfill without creating execution semantics | Watchlist, provenance, DQ, and no-order semantics |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Economic data and provider policy | Official economic adapters and provider controls are required and revalidated | Economic vintages and validity rules |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | Vintage cutoff preserves point-in-time truth | Immutable snapshot and vintage cutoff |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | The portfolio ledger rebuilds exactly within configured decimal precision | Portfolio ledger and reconciliation |
| [Legacy persistence feature](../../specs/features/Legacy-Code-price-persistence.feature) | Symbol and date identity | The legacy schema shows a primary key on Id but does not prove a unique business key by symbol and date | Identity and model assumptions to validate in new design |

## Source references
- [Objective PDF](../customer-docs/Objective/ETF%20Trade%20Recommendation%20Prototype%20Requirements.pdf)
- [Program narrative](../customer-docs/Objective/program-narrative.md)
- [Objective summary](../customer-docs/Objective/objective-summary.md)
- [Legacy database insert](../customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.Database/ETFDb.cs)
- [Legacy database schema metadata](../customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.Database/ETF.dbml)
- [Legacy schema designer](../customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.Database/ETF.designer.cs)

## Risks and assumptions
- The model assumes a single-user local deployment and a bounded schema structure rather than a shared enterprise data model.
- Economic vintages are assumed to require explicit release-time and transformation metadata to meet point-in-time truth requirements.
- Portfolio reconciliation is assumed to be deterministic and precise within configured decimal tolerance; mismatches are treated as operational issues, not silent corrections.
- Legacy database field names and table semantics are not treated as authoritative target-state identity requirements without validation.

---
