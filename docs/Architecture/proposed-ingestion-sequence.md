# Proposed Ingestion Sequence

## Status
Status: Proposed - pending architecture review and human approval; not an accepted ADR

## Purpose and scope
This sequence describes the proposed ingestion path for watchlist-based market and economic data in the research prototype. It covers the required steps from watchlist symbol validation to provider-policy gating, adapter selection, raw capture, normalization, data quality checks, idempotent persistence, and job observability. It intentionally avoids any real-order or brokerage semantics and blocks downstream signal publication when data quality or provider rights fail.

## Accessible description
The flow begins with a watchlist and a date window. The web API validates the symbol and checks the provider policy and rights state before any live adapter call is made. Fixtures are selected explicitly for bootstrap, test, or offline datasets and retain dataset/version/hash metadata; they are never selected because a live provider is unavailable. A provider outage or retry exhaustion fails the live job visibly and blocks dependent research without substituting another dataset. Returned raw data is captured, normalized, and placed into a quarantine state when quality checks fail. The ingestion job persists raw and normalized rows idempotently, records provenance, and suppresses signal creation if the job fails or the dataset is incomplete. Job status is observable through metrics, logs, and health states. The sequence relies on explicit labels and narrative, not color-coded states. The canonical identity is (instrument, trading date, provider, adjustment policy, revision), and each ingest also carries an idempotency token or job identity; database unique and check constraints plus migration checks on empty and populated datasets enforce safe reprocessing. Default-deny egress is enforced by policy, and diagnostics separate raw provider payload access from allowlisted operational hashes and metadata so secrets and prohibited raw payloads never appear in logs or support bundles.

```mermaid
sequenceDiagram
    autonumber
    participant User as User or browser action
    participant API as Web API
    participant Svc as Ingestion service
    participant Policy as Provider policy / rights / egress gate
    participant Adapter as Approved provider or explicit fixture adapter
    participant Store as PostgreSQL bounded schemas\nunique/check constraints + idempotency key
    participant DQ as DQ checks and quarantine
    participant Jobs as Job status / outbox
    participant Sig as Signal publication gate

    User->>API: Request resumable ingest for watchlist and date window
    API->>Svc: Validate symbols and date coverage
    Svc->>Policy: Check provider acknowledgement, rights state, and allowlist/egress policy
    alt Rights not confirmed, broker route, or unapproved endpoint
        Policy-->>Svc: Deny ingest; record rejection; fail closed if rights or allowlist config is absent
        Svc-->>Jobs: Mark job blocked, no downstream publication
        Svc-->>User: Show policy warning and blocked state
    else Rights confirmed
        Policy-->>Svc: Permit gated provider access
        Svc->>Adapter: Select approved live adapter or explicit bootstrap/test/offline fixture mode
        Adapter-->>Svc: Return payload or explicit live-provider error
        alt Live provider unavailable or retries exhausted
            Svc-->>Jobs: Mark job failed; do not substitute a fixture or another dataset
            Svc-->>Sig: Suppress signal generation
            Svc-->>User: Show provider failure and blocked dependent research
        else Payload returned from selected mode
            Svc->>DQ: Normalize, validate, and classify rows
            DQ-->>Svc: Accept / quarantine / partial / stale result
            alt Data quality failure or incomplete batch
                Svc-->>Jobs: Record failed, suppressed, or quarantined status
                Svc-->>Sig: Suppress signal generation
                Svc-->>User: Show blocked warning with evidence
            else Data quality passes
                Svc->>Store: Store raw and normalized rows with identity (instrument, trading date, provider, adjustment policy, revision) + idempotency token/job identity
                Store-->>Svc: Commit result and job metadata; DB unique/check constraints and migration checks validate empty or populated datasets
                Svc-->>Jobs: Publish observable job state and outbox event
                Svc-->>Sig: Allow signal evaluation only if complete
            end
        end
    end

    note over Svc,Store: Diagnostic redaction: raw provider payload access is restricted; operational diagnostics only record allowlisted metadata and hashes, and secrets are excluded from logs, bundles, and support artifacts.
    note over Policy,Adapter: No brokerage connector, no real-order endpoint, no credential transmission path, and no unapproved egress are part of this flow.
```

## Proposed architecture requirements
- Ingestion identity and idempotency: the authoritative record identity is (instrument, trading date, provider, adjustment policy, revision), plus an idempotency token/job identity; DB unique and check constraints and migration checks are required for both empty and populated datasets instead of assuming a legacy (Symbol, Date) key is sufficient.
- Controlled egress: provider access is gated by rights approval and default-deny pod egress with an allowlist for approved market and economic endpoints, required DNS, PostgreSQL, local telemetry, and required local services; broker or unapproved routes are denied and the policy fails closed when rights or allowlist configuration is absent.
- Diagnostic redaction and access: raw provider payload access remains restricted, while diagnostics use explicit allowlisted metadata and hashes and automated tests prove secrets and prohibited raw provider data are absent.
- Secret lifecycle: credentials remain only in local Kubernetes Secrets, are mounted only into the scoped adapter workload, and are excluded from Git, images, logs, diagnostics, and client bundles.

## Traceability
| Feature file | Rule title | Scenario title | Coverage |
| --- | --- | --- | --- |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Watchlists, market data, and backfill | A user maintains a watchlist and resumable backfill without creating execution semantics | Watchlist validation, resumable backfill, provenance, DQ |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Economic data and provider policy | Official economic adapters and provider controls are required and revalidated | Provider safety gate and economic vintages |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | An ingestion rerun remains idempotent and auditable | Idempotent persistence and provenance |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | Missing-session data suppresses a signal instead of producing a false positive | Signal suppression on DQ failure |
| [Objective feature](../../specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature) | Rule: Representative acceptance criteria | Provider outages fail rather than succeed with zero rows | Explicit failure handling |
| [Legacy ingestion feature](../../specs/features/Legacy-Code-market-data-ingestion.feature) | Historical retrieval flow | The legacy requestor builds a Yahoo historical URL for each symbol and range | Historical fetch flow only; not target-state behavior |

## Source references
- [Objective PDF](../customer-docs/Objective/ETF%20Trade%20Recommendation%20Prototype%20Requirements.pdf)
- [Program narrative](../customer-docs/Objective/program-narrative.md)
- [Objective summary](../customer-docs/Objective/objective-summary.md)
- [Legacy requestor](../customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.HtmlParser/Requestor.cs)
- [Legacy extractor](../customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.HtmlParser/Extractor.cs)
- [Legacy database insert](../customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.Database/ETFDb.cs)

## Risks and assumptions
- Provider rights and quotas are assumed to be explicit controls, not silent defaults.
- Missing or partial data is expected to block analytics rather than produce a false signal.
- Job state is assumed to be observable and auditable through local operational controls.
- The historical Yahoo HTTP and regex logic remains a migration constraint, not a target architecture requirement.

---
