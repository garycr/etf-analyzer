# WP-8 CT-DB-001J Job Restart Conformance Plan

**Date:** 2026-09-22
**Decision owner:** Solo Orchestrator under Fully Agentic mode
**Scope:** CT-DB-001J only
**Estimate:** 2.0 agent-hours
**Status:** Implementation in progress; canonical parent red

## Release Finding

CT-DB-001J requires executable proof that durable restart preserves the committed checkpoint and effect range, increments the attempt once, and suppresses duplicate effects through application replay. Existing migration `0002-application` already owns those release behaviors: `etf.job_restart(jsonb)` locks the job and preserves checkpoint rows, while the PostgreSQL application replay store executes replay lookup, owner dispatch, replay persistence, and commit in one transaction.

The earlier candidate.4 proposal exceeded this release need by introducing a new checkpoint writer and rewiring fixture and analytics owners. That proposal is withdrawn. CT-DB-001J does not create checkpoints or effects and does not require schema, migration, manifest, owner, role, or runtime changes.

The physical-contract observation that direct owner inserts can populate checkpoint range metadata without verifying referenced effects is retained as non-release hardening. It is not evidence of a restart defect and must not become migration work in this release.

## Bounded Implementation

Add one complete integration owner named `0002 preserves complete durable job state across CT-DB-001J restart cases`. It uses the released migration-0002 schema, `executeApplicationRequestAsync`, `createPostgresApplicationReplayStore`, and `etf.job_restart(jsonb)`.

The owner snapshots jobs, checkpoints, and application replay rows and proves the six required vectors:

1. First execution restarts one Failed/Restartable job, retains identity, input, progress, and checkpoint, increments attempt once, and commits one application replay.
2. Equivalent replay returns the original result without owner dispatch or mutation.
3. Conflicting replay returns `APPLICATION_IDEMPOTENCY_CONFLICT` without owner dispatch or mutation.
4. Running and Failed/NotRestartable jobs return `APPLICATION_JOB_NOT_RESTARTABLE` without job or checkpoint mutation.
5. Forced replay-persistence failure rolls back the owner restart and replay together.
6. Retry after committed success returns the original replay without owner dispatch or duplicate mutation.

The canonical parent remains `CT-DB-001J job state and checkpoints resume without duplicate effects` and dispatches only that complete owner.

## Validation And Review

Run the exact owner and canonical parent on pinned PostgreSQL 16 and Node 20, then the host suite, lint, audit, diagnostics, and diff checks. Obtain independent Code and Security review before bounded acceptance. No migration hashes, manifest hashes, catalog counts, or candidate version change.

## Boundary

This plan does not authorize database migration activity, SQL Server conversion, legacy discovery, ETL, coexistence, cutover, rollback, deployment, or production changes. It does not accept PT-E2E-001, WP-8, DP-33, Ring 2, release, deployment, or production. REV-164 and the original CT-DB-001K evidence remain invalidated history.
