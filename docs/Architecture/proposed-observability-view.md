# Proposed Observability View

## Status

Status: Proposed - research-only/no-broker; pending architecture review and human approval; not an accepted ADR

## Purpose

This view defines local observability responsibilities for jobs, APIs, data quality, analytics, evidence, portfolio accounting, and platform readiness. It preserves the canonical objective NFRs without implying production-scale monitoring or cloud services.

## Observability diagram

```mermaid
flowchart LR
    API[Web API]
    Portfolio[Portfolio service]
    Ingest[Ingestion jobs]
    Analytics[Analytics and backtest jobs]
    Migrate[Migration job]
    DB[(PostgreSQL)]

    subgraph TelemetryBoundary[Local redacted telemetry boundary]
        Logs[Structured logs]
        Metrics[Metrics]
        Traces[Traces]
        Health[Health and migration-aware readiness]
        Correlate[Job, outbox, evidence, and diagnostic correlation]
        View[Local operator view and redacted export]
    end

    API --> Logs
    API --> Metrics
    API --> Traces
    Portfolio --> Logs
    Portfolio --> Metrics
    Portfolio --> Traces
    Ingest --> Logs
    Ingest --> Metrics
    Ingest --> Traces
    Analytics --> Logs
    Analytics --> Metrics
    Analytics --> Traces
    Migrate --> Health
    DB --> Health
    API --> Health
    Logs --> Correlate
    Metrics --> Correlate
    Traces --> Correlate
    Health --> Correlate
    Correlate --> View
```

## Accessible prose alternative

Every API request and bounded job emits redacted logs, metrics, and trace context. A correlation chain links request ID, job ID, outbox event ID, data snapshot/configuration hash, evidence ID/result hash, and diagnostic bundle ID without carrying secrets or raw provider payloads. Liveness reports process health only. Readiness remains false until required PostgreSQL connectivity succeeds, migrations complete exactly once, required policy/configuration is valid, and connectivity-policy checks pass. Provider failure affects the job and dependent research, not basic process liveness.

## Telemetry contract

| Signal | Minimum content | Explicit exclusions |
| --- | --- | --- |
| Structured logs | UTC timestamp, severity, service, operation, request/job ID, provider identifier, status, attempt, row counts, DQ outcome, sanitized error class, duration, evidence ID/hash. | Credentials, authorization headers, query secrets, raw provider payloads, prohibited provider data, free-form financial records, brokerage artifacts. |
| Metrics | Request/job counts and duration, failures, retries, suppression/quarantine, queue/outbox depth and age, rows accepted/rejected, readiness state, migration state, DB connectivity, reconciliation difference, evidence-hash mismatch. | High-cardinality secrets, raw symbols where avoidable, payload fragments, or user-entered content. |
| Traces | Local request-to-service-to-job/outbox-to-database spans; provider calls represented by endpoint class and provider identifier; evidence correlation. | Request/response bodies, credentials, raw SQL values, raw provider records. |
| Health | Separate liveness and readiness; migration-aware readiness includes required DB connectivity, completed schema migration, policy/config validity, and local dependency checks. | A successful health response must not imply provider rights, dataset freshness, or analytical validity. |
| Diagnostics | Allowlisted configuration metadata, versions, statuses, timestamps, correlation IDs, counts, hashes, and sanitized failure reasons. | API keys, passwords, prohibited raw provider data, credentials, and any brokerage artifact. |

## Four Golden Signals

Targets are local prototype targets and Proposed until Ring 1 defines measurement windows and alert thresholds.

| Golden signal | Local indicator and target | Proposed owner | Response |
| --- | --- | --- | --- |
| Latency | Non-analytical API p95 under 1 second; dashboard first meaningful content under 2 seconds; job durations tracked by type. | API/UI owner; job owner | Investigate trace spans, DB timing, queue age, and input size; do not weaken determinism or DQ gates. |
| Traffic | Local request rate, job starts/completions, rows processed, and backtest runs; no scale target beyond one local operator. | Application owner | Detect unexpected loops, duplicate submissions, or provider quota pressure. |
| Errors | API 5xx/4xx by class, explicit job failures, retry exhaustion, DQ suppression, hash mismatch, failed migration/readiness, and non-zero reconciliation difference. Provider outage must be a failed job, never zero-row success. | Owning service plus local operator | Block dependent research, preserve redacted evidence, and expose a recoverable reason. |
| Saturation | Queue/outbox depth and oldest age, worker concurrency, CPU/memory, PostgreSQL connections/storage, PVC capacity, and provider quota remaining. | Local platform owner | Throttle or pause bounded jobs; never bypass rights, fixture, provenance, or reconciliation controls. |

## Canonical operational evidence

- Repeated analytics/backtests with identical snapshot, code hash, parameters, environment, and seed produce matching configuration/result hashes.
- Reconciliation difference is zero, or explicitly explained as within configured decimal precision, across cash, lots, positions, realized P&L, valuations, and cached projections.
- Stale, partial, quarantined, or incompatible data produces a visible blocking status and suppression metric rather than a valid signal.
- A clean bootstrap proves migrations apply once, fixture data loads only in explicit bootstrap mode, pods become ready, and the localhost browser slice works.
- Backup/restore evidence must demonstrate restoration of PostgreSQL schemas, immutable evidence, job/outbox state, and ledger integrity; method, RPO/RTO, and cadence remain Ring 1 obligations because HA/DR is out of scope.
- Accessibility status is observable through test evidence for keyboard navigation, visible focus, semantic labels/headings, non-color cues, persistent research disclaimer, 1280x720 usability, and distinct trade/source/retrieval/completion timestamps.

## Correlation and redaction rules

Correlation identifiers are generated locally and propagated through REST/OpenAPI, job metadata, outbox records, traces, evidence, audit, and diagnostics. They must not encode credentials, provider payloads, user-entered values, or brokerage semantics. Redaction occurs before telemetry leaves each process; the local collector performs a second allowlist check before display/export. If either stage cannot classify a field, it is omitted and the diagnostic export fails closed.

## Related views

- [C4 container view](proposed-c4-container.md)
- [Component view](proposed-component-view.md)
- [Deployment view](proposed-deployment-view.md)
- [Ingestion sequence](proposed-ingestion-sequence.md)
- [Analytics/backtest activity](proposed-analytics-backtest-activity.md)
- [Paper-order sequence](proposed-paper-order-sequence.md)
- [Security view](proposed-security-view.md)

## Residual observability decisions

Ring 1 must select the local telemetry implementation, metric names/units, histogram buckets, retention/rotation, dashboard layout, alert thresholds, trace sampling, backup/restore method, and accountable role names. These decisions may not relax the canonical latency, readiness, redaction, outage, reproducibility, accessibility, or reconciliation gates.

---
