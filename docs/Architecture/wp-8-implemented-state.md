# WP-8 Implemented-State Architecture

**Date:** 2026-09-25
**Status:** Ring 3 verified; supported local runtime implemented in Ring 4 under issue #88

## Scope

This view describes the code and executable integration candidate implemented by WP-8. It does not authorize release, deployment, production, public ingress, provider access, a broker, a worker, or SQL Server migration/conversion.

```mermaid
flowchart LR
    User[Research operator]
    Browser[Browser workbench]
    Launcher[Local composition root\nstrict config + shutdown\nstartup attestation]
    Artifacts[Reviewed fixture + analytics artifacts\ncanonical root only]
    HTTP[Loopback HTTP adapter\n127.0.0.1 only\n16 reviewed routes]
    App[Application boundary\nclosed envelopes + replay]
    Owners[Synchronous owners\nfixture, analytics, paper order, reads]
    PG[(Greenfield PostgreSQL 16.15\neight migrations\ncontrolled functions)]

    User --> Launcher
    Launcher --> Browser
    Artifacts --> Launcher
    Launcher --> HTTP
    Browser -->|local HTTP/JSON| HTTP
    HTTP -->|validated envelope| App
    App -->|synchronous dispatch| Owners
    Owners -->|one bounded transaction/savepoint| PG
    PG -->|result/replay state| App
    App --> HTTP
    HTTP --> Browser
```

## Implemented Responsibilities

| Component | Implemented behavior | Current limitation |
| --- | --- | --- |
| Browser workbench | Accessible local watchlist and paper-order workflow | Not an authenticated multi-user client |
| Local composition root | Strict operator configuration, reviewed artifact loading, separate control/runtime database identities, fail-closed startup attestation, and idempotent signal shutdown | Local single-user process only; no service manager packaging |
| Loopback HTTP adapter | Literal loopback binding, closed routes, bounded body/deadline, fixed public errors | Same-user processes can connect; no per-launch token or rate limit |
| Application boundary | Typed operation envelopes, command idempotency, replay, redaction | Commands remain research-only and fixture-only |
| Synchronous owners | Fixture ingestion, analytics publication, paper-order transition, controlled reads | No independent worker process, scheduler, or provider adapter |
| PostgreSQL | Eight exact greenfield migrations, least-privilege roles, seven authoritative query operations, controlled functions, immutable evidence and replay | No backup/restore or production operations implementation |

The launcher uses `ETF_POSTGRES_CONTROL_URL` only for baseline, migration-ledger, and schema-manifest attestation. Request execution uses the separate `ETF_POSTGRES_URL` identity, which must be the least-privilege `app_runtime` login. The HTTP server does not bind until the control checks and persisted readiness snapshot report Ready.

## Structural Handoff Boundary

The candidate has no queue, outbox, broker, event stream, worker, scheduler, or cross-process durable handoff. PostgreSQL `jobs` are synchronous workflow state operated inside the current request transaction; they are not queue entries. Migration preflight rejects durable-handoff object names, and the live canonical catalog contains none.

This structural assertion is separate from saturation observations. CPU, memory, connection, and evidence-capacity measurements do not prove the absence of durable handoff.

## Observability State

Ring 2 tests collect bounded request latency, readiness recovery, redaction, database connections, evidence capacity, unresolved intents, reconciliation differences, and unexpected server errors. `evaluatePrototypeOperations` evaluates supplied observations. WP-8 does not implement a retained production logging, metrics, tracing, dashboard, or alerting pipeline.

## Deferred Future-State Elements

The following appear in proposed architecture views but are not implemented by WP-8:

- Kubernetes, Helm, pods, Jobs, and CronJobs.
- Ingestion, analytics, projection, audit, or job worker processes.
- PostgreSQL outbox or any durable event handoff.
- Provider adapters, network egress, credentials, or live market/economic ingestion.
- Production telemetry, backup/restore, HA/DR, public ingress, TLS, or multi-user identity.
- Brokerage, real orders, or credential transmission.

The proposed views remain design options only and must not be used as implementation evidence.

## Candidate Classification

WP-8 and Ring 4 issue #88 now provide an executable local integration candidate and a supported operator-driven composition root. The launcher remains bounded to a fixture-only, research-only, single-user loopback runtime and does not authorize promotion, staging, deployment, or production.
