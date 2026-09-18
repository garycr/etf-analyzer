# REV-113 - WP-6 Projection Reconciliation Code Review

**Date:** 2026-09-18
**Reviewer:** Code Reviewer agent, independent final recheck
**Scope:** CT-LED-008 exact keyed cache reconciliation and no-repair behavior
**Disposition:** PASS

## Findings and Remediation

The initial review found two Major issues: malformed projection values could expose raw PostgreSQL errors, and projection reconciliation could observe mixed READ COMMITTED snapshots while ledger mutation proceeded concurrently. Input parsing and casts now map residual failures to stable `APPLICATION_REQUEST_INVALID`, and `ledger_append` plus `projection_publish` take the same transaction-scoped portfolio advisory lock before portfolio reads or mutation.

The final recheck found no Critical or Major issue. A static unit invariant verifies both controlled functions use the shared lock. The live two-client serialization proof remains assigned to CT-LED-011 concurrency coverage.

## Evidence

- CT-LED-001/008 focused PostgreSQL matrix: 2 passed, 0 failed, 0 skipped.
- PostgreSQL 16.15 C/UTF8/UTC complete suite: 414 passed, 0 failed, 0 skipped.
- Migration 0003 SQL SHA-256: `745f2ba8bbfcdb00a4f0f3d235ae29cf4ed19ab8d1056799fdea2356f0ddbf80`.
- Migration 0003 cumulative manifest SHA-256: `70fa686b79e5e8f0dfb923d2f9497c778e2560c7526e0dccb892c98abcfca5f6`.
- Dependency audit: 0 vulnerabilities.
- Diagnostics and diff checks: clean.
