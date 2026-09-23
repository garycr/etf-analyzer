# WP-8 PT-E2E-001 Prototype Workflow Remediation Plan

**Status:** Accepted under REV-184 and REV-185 for PT-E2E-001 only  
**Decision:** DEC-081  
**Scope:** PT-E2E-001 local greenfield PostgreSQL composition only

## Boundary

PT-E2E-001 must execute `FixtureIngestionStart`, `AnalyticsRun`, `PaperOrderDraftCreate`, `PaperOrderTransition`, and `PortfolioGet` through the existing loopback HTTP adapter and reviewed Application envelopes. Direct SQL is limited to greenfield bootstrap, deterministic local setup that has no public operation, fault injection, and postcondition inspection.

This plan adds no route, service, runtime role, dependency, durable handoff, migration sequence, candidate version, provider, brokerage path, SQL Server conversion, ETL, coexistence, cutover, deployment, or production authority. PostgreSQL remains `1.0.0-candidate.3` with the existing seven greenfield migrations.

## Discovered Gap

The existing fixture and analytics functions atomically commit their owned domain state, but no controlled PostgreSQL function can complete their durable Application Job. `etf.job_start(jsonb)` creates only `Pending`; the Application success contract requires a valid Job result; and direct table mutation is correctly denied to `app_runtime`. Returning a fabricated or still-Pending success would violate the durable Job contract.

## Corrected Design

1. Extend existing migration `0002-application` with `etf.job_succeed(jsonb)`.
   - `SECURITY DEFINER`, fixed `search_path = pg_catalog, etf`, and `session_user = 'app_runtime'`.
   - Accept exactly `jobId`, `originalCommandId`, `operation`, `acceptedCount`, `rejectedCount`, `startedAt`, and `completedAt`.
   - Require canonical UUIDs, operation, UTC instants, decimal-string UInt counts in `0..9007199254740991`, `startedAt <= completedAt`, and `acceptedCount > 0`.
   - Lock the exact Job and require matching original command, operation, type, and current `Pending` state.
   - Perform the legal `Pending -> Running -> Succeeded` transitions inside the function and one transaction; terminal or mismatched state fails without mutation.
   - Return the complete canonical Job with every UInt serialized as a decimal string.
2. Extend existing migration `0006-controlled-access` to grant `app_runtime` EXECUTE on both `etf.job_start(jsonb)` and `etf.job_succeed(jsonb)`. PUBLIC and all other runtime roles remain denied; no direct Job-table write authority is added.
3. Add thin PostgreSQL owner adapters for fixture ingestion, analytics publication, and portfolio reads.
   - Every adapter receives one checked-out PostgreSQL client shared with `createPostgresApplicationReplayStore`; pool-level query facades are not accepted by the composition root.
   - Fixture and analytics receive an injected immutable resolver of approved local artifacts. Resolution and exact identity/hash validation occur before the first SQL mutation.
   - Fixture validates `jobId`, dataset identity, and fixture package hash; analytics validates `jobId`, evidence command, as-of date, configuration hash, and sorted input evidence identities.
   - Each command executes `job_start`, its existing domain commit function, and `job_succeed` inside the Application replay transaction/savepoint. Fixture accepted count comes from the verified ingestion result. Analytics accepted count is exactly `1`; rejected count is `0`.
   - Portfolio calls only existing `etf.portfolio_get(uuid, timestamptz)` and returns its projection.
4. Error mapping is exact and fail closed.
   - The only exposed pairs are listed below. Every unlisted SQLSTATE/message pair maps to `APPLICATION_DEPENDENCY_UNAVAILABLE`, including fixture manifest/hash/decimal/temporal failures that should have been rejected by artifact admission.
   - Domain or lifecycle failure rolls back Job creation, domain mutation, and owner replay state together. The Application replay store then persists the complete failed Application envelope after savepoint recovery; equivalent replay returns that failure and conflicting replay returns `APPLICATION_IDEMPOTENCY_CONFLICT`. No orphaned Pending Job is externally visible. Durable Failed Job writing is outside PT-E2E-001 and requires a separately reviewed owner contract.
5. Add the canonical `prototype-workflow.test.mjs` owner.
   - Use the existing seven-migration greenfield bootstrap and one checked-out client.
   - Seed only the anchor and pre-existing reconciled portfolio state through existing reviewed setup helpers; do not attribute that state to the single submitted paper order.
   - Send all five operations through loopback HTTP with exact envelopes.
   - Prove fixture output identity feeds analytics input, analytics evidence identity feeds the paper order, and the final PortfolioGet returns the pre-existing reconciled projection under the causal assertions below.
   - Add focused failure tests after Job start, after domain mutation, and during Job completion; prove no partial owner effects and one durable failed Application replay.
   - Add identity/hash pre-mutation rejection and equivalent/conflicting replay controls.

## Exact Error Mapping

| Owner | SQLSTATE | Exact PostgreSQL message | Application code |
| --- | --- | --- | --- |
| Job lifecycle | `22023` | `APPLICATION_REQUEST_INVALID` | `APPLICATION_REQUEST_INVALID` |
| Job lifecycle | `23505` | `APPLICATION_IDEMPOTENCY_CONFLICT` | `APPLICATION_IDEMPOTENCY_CONFLICT` |
| Job lifecycle | `42501` | `permission denied` | `APPLICATION_UNAUTHORIZED` |
| Job lifecycle | `P0002` | `APPLICATION_JOB_NOT_FOUND` | `APPLICATION_JOB_NOT_FOUND` |
| Job lifecycle | `P0001` | `APPLICATION_JOB_MISMATCH` | `APPLICATION_REQUEST_INVALID` |
| Job lifecycle | `P0001` | `APPLICATION_JOB_NOT_COMPLETABLE` | `APPLICATION_REQUEST_INVALID` |
| Fixture | `23505` | `FIXTURE_IDEMPOTENCY_CONFLICT` | `FIXTURE_IDEMPOTENCY_CONFLICT` |
| Analytics | `22023` | `ANALYTICS_INPUT_INCOMPLETE` | `ANALYTICS_INPUT_INCOMPLETE` |
| Analytics | `22023` | `ANALYTICS_INTEGRITY_FAILED` | `ANALYTICS_INTEGRITY_FAILED` |
| Analytics | `22023` | `ANALYTICS_NUMERIC_CLASS_INVALID` | `ANALYTICS_NUMERIC_CLASS_INVALID` |
| Analytics | `23505` | `ANALYTICS_IDEMPOTENCY_CONFLICT` | `ANALYTICS_IDEMPOTENCY_CONFLICT` |
| Analytics | `53100` | `ANALYTICS_CAPACITY_BLOCKED` | `ANALYTICS_CAPACITY_BLOCKED` |
| Analytics | `42501` | `ANALYTICS_RIGHTS_RESTRICTED` | `ANALYTICS_RIGHTS_RESTRICTED` |
| Analytics | `40001` | `ANALYTICS_PUBLICATION_VERSION_CONFLICT` | `ANALYTICS_PUBLICATION_VERSION_CONFLICT` |
| Analytics | `P0001` | `ANALYTICS_EVIDENCE_COMMIT_FAILED` | `ANALYTICS_EVIDENCE_COMMIT_FAILED` |
| Portfolio | `P0002` | `LEDGER_PORTFOLIO_NOT_FOUND` | `APPLICATION_DEPENDENCY_UNAVAILABLE` |
| Portfolio | `42501` | `permission denied` | `APPLICATION_UNAUTHORIZED` |

`job_succeed` uses `APPLICATION_JOB_MISMATCH` for a found Job whose command identity, operation, or derived type differs, and `APPLICATION_JOB_NOT_COMPLETABLE` for any non-Pending or terminal state. Both are intentionally presented as `APPLICATION_REQUEST_INVALID`; neither becomes a new public Application code.

## Causal Assertions

| Link | Exact assertion |
| --- | --- |
| Fixture command to package | HTTP `datasetId`, `datasetVersion`, and `fixturePackageHash` equal the resolver entry and the committed `fixture_packages` identity/hash; `jobId` equals the ingestion replay identity. |
| Fixture package to analytics input | The sole sorted `inputEvidenceIds` UUID resolves to that exact fixture package identity/hash, and analytics `canonicalInput.marketObservations` plus `economicVintages` equal the normalized persisted observations selected for that dataset/version and as-of date. |
| Analytics command to evidence | HTTP `evidenceCommandId`, `configurationHash`, and `asOfDate` equal the resolved evidence payload's commit command, canonical configuration hash, and evaluation date; `jobId` remains the durable Job identity. |
| Analytics evidence to order | The committed analytics `evidenceId` is a UUID and equals HTTP `PaperOrderDraftCreate.researchEvidenceId` and the persisted paper order's `research_evidence_id`. |
| Order submission to portfolio | OT-02 changes only the paper-order aggregate from Draft to Submitted. Ledger and portfolio snapshots are unchanged, and final `PortfolioGet` equals the explicitly pre-seeded reconciled projection. |

Fixture `acceptedCount` must equal the exact verified `marketObservations.length + economicObservations.length`, must be greater than zero, and must equal the domain function result. Fixture `rejectedCount`, analytics `rejectedCount`, and analytics accepted count are respectively `"0"`, `"0"`, and `"1"`.

## Test-First Sequence

1. Add failing unit tests for `job_succeed` SQL shape, grants/denials, adapter identity validation, exact error mappings, canonical Job conversion, and same-client composition typing.
2. Add the canonical failing PT-E2E-001 integration parent and confirm it fails on the missing controlled completion path.
3. Implement only the reviewed migration-function, grant, and adapter changes.
4. Reconcile SQL hashes, cumulative schema-manifest hashes, exact catalogs, rollback tests, and CT-DB-001A/D/K expectations.
5. Run focused units, canonical PT-E2E-001, full CT-DB-001A..L plus PT-E2E-001, isolated host suite, lint, diagnostics, audit, and diff checks.
6. Obtain independent Code and Security review. Publish bounded evidence only after both PASS.

## Acceptance Boundary

Passing this plan may accept PT-E2E-001 only. It does not close WP-8, DP-33, Ring 2, release, deployment, or production. REV-164 and the original CT-DB-001K evidence remain invalidated history. GitHub issue #85 remains deferred and does not expand this plan.
