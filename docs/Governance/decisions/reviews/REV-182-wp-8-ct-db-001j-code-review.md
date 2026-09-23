# REV-182 - WP-8 CT-DB-001J Code Review

**Date:** 2026-09-22
**Reviewer:** Code Reviewer agent using an alternate model
**Disposition:** PASS

No Critical, Major, or blocking Minor findings remain. The final review verified the complete six-vector restart owner, PostgreSQL replay transaction, savepoint rollback, exact replay suppression, conflicting replay rejection, Running and NotRestartable refusal, post-commit retry, and deterministic job/checkpoint/replay snapshots.

The implementation adds no table, function, role, dependency, checkpoint writer, or candidate version. The existing `etf.job_restart(jsonb)` returns application `UInt` fields as canonical decimal strings, and migration 0006 grants only its existing controlled execute surface to `app_runtime`. The narrow JobRestart owner adapter validates the exact command path, maps only allowlisted PostgreSQL SQLSTATE/message pairs, and closes unknown errors as `APPLICATION_DEPENDENCY_UNAVAILABLE`. Application owner-phase admission preserves the existing stable Job errors without exposing database detail.

The initial review condition recommending substring error matching was rejected after Security Review confirmed exact SQLSTATE plus exact custom `RAISE EXCEPTION` text is the safer fail-closed policy. Live pinned PostgreSQL tests exercise the exact refusal tokens, and unit tests prove unknown or malformed errors remain closed. The separate `job_start`/`job_get` UInt normalization debt is tracked by GitHub issue #85 under WP-8 #84 and does not block this restart-only checkpoint.

Migration 0002 and 0006 SQL identities and cumulative sequence 2-7 schema-manifest hashes are reconciled. The complete canonical CT-DB-001A-J run passes on pinned PostgreSQL 16.15 and Node 20.

This PASS is limited to CT-DB-001J. It does not accept PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, or production.
