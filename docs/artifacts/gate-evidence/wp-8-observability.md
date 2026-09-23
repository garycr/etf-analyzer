# WP-8 PT-OPS-001 Observability Evidence

**Date:** 2026-09-23
**Scope:** PT-OPS-001 local prototype operations evidence only
**Status:** Accepted under DEC-082, REV-186, and REV-187

## Execution

The canonical parents executed sequentially and non-skipped against PostgreSQL 16.15 pinned to:

`postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`

`ETF_TEST_POSTGRES_URL` was present only for the two test processes. PostgreSQL readiness was established through an external repository-local `pg.Client` connection before execution. Both parents passed:

- `PT-E2E-001 completes fixture analysis confirmed paper order and reconciliation through reviewed HTTP operations`: PASS, zero skips.
- `PT-OPS-001 exposes readiness recovery redaction and Golden Signals evidence`: PASS, zero skips.

The disposable container was removed explicitly. Follow-up `docker inspect` failed with no such object, and no session container name remained.

## Measured Evidence

| Control | Observation source | Gate |
| --- | --- | --- |
| API latency | 25 live loopback `ReadinessGet` HTTP durations; nearest-rank p95 | `< 1,000 ms` PASS |
| Dashboard latency | 25 live loopback document durations; nearest-rank p95 | `< 2,000 ms` PASS |
| Traffic and duplicate effects | Live counts from `application_replays`, `analytics_publications`, `fixture_packages`, `jobs`, `order_transitions`, and `paper_orders` after PT-E2E-001 | Exact `4/1/1/2/2/1` PASS |
| Unexpected server errors | Count of observed dashboard and API responses with status `>= 500` | `0` PASS |
| Evidence integrity | Live publication-to-bundle hash comparison | `0` mismatches PASS |
| Reconciliation | Live non-Reconciled projection count | `0` differences PASS |
| Unresolved intent | Live `IntentRecorded` counts in order and ledger audit | `0` PASS |
| Durable handoff absence | Live `pg_class`/`pg_namespace` inspection for ETF queue or outbox relations | `0` objects PASS |
| Evidence saturation | Live `analytics_capacity_admission.managed_bytes / capacity_bytes` | `< 80%` PASS |
| Database saturation | Live ETF database connections against `max_connections` | Below configured maximum PASS |
| CPU and memory | Process CPU over the measured wall interval and process RSS | Recorded only; no invented threshold |

## Readiness, Recovery, And Redaction

The loopback dashboard first rendered a validated `NotReady` snapshot with the bounded `Review readiness details` recovery action. The same running server then rendered `Ready`, proving the local recovery presentation transition. Ready, NotReady, API, and dashboard responses were checked for credential terms and PostgreSQL connection-string leakage.

The evaluator fails closed in deterministic order for latency, exact-count, server-error, hash, reconciliation, unresolved-intent, durable-handoff, evidence-capacity, and database-connection violations. Focused unit controls pass for the complete success and failure sets.

## Validation

- TypeScript build: PASS.
- PT-OPS policy units: 2 passed, zero failed.
- PT-E2E-001 and PT-OPS-001 pinned PostgreSQL parents: 2 passed, zero failed, zero skipped.
- Editor diagnostics for the evaluator and both tests: zero errors.
- Initial independent Code Review: FAIL on fabricated observations.
- Remediation replaced literals with live PostgreSQL queries, HTTP counters, elapsed-interval CPU measurement, and NotReady-to-Ready recovery evidence.
- Independent follow-up Code Review: REV-186 PASS after durable execution evidence publication.
- Independent Security Review: REV-187 PASS with no Critical or Major findings; exact configured-secret redaction was strengthened before acceptance.

## Boundary

This evidence supports PT-OPS-001 only. It does not close WP-8, DP-33, Ring 2, release, deployment, or production. It adds no endpoint, service, dependency, migration, public ingress, provider, broker, queue, or durable handoff. Greenfield PostgreSQL remains the only persistence target; no SQL Server migration or conversion is authorized. REV-164 and the original CT-DB-001K evidence remain invalidated history.
