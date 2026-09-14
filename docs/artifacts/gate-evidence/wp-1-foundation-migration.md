# WP-1 Foundation Migration Evidence

**Date:** 2026-09-14
**Scope:** Transactional runner and `0001-foundation` authority/rollback behavior
**Result:** PASS for the reviewed increment

## Executed Behavior

The runner acquires the transaction-scoped migration advisory lock, follows `deployment_login` to `migration_executor` to `migration_owner`, computes lowercase SHA-256 from exact UTF-8 SQL bytes, enforces closed identity and contiguous sequence, rejects drift, and rolls back every failure. It passes the prospective migration entry to the manifest projector before inserting exactly one ledger row.

Pinned PostgreSQL 16 execution verified the exact external empty-schema prerequisite. During `0001`, `schema_migrations` was owned by `migration_owner`; the three protected tables were owned by `anchor_owner`; temporary `anchor_owner` schema `USAGE, CREATE` was absent before projection; and a forced projector failure rolled the transaction back to the unchanged empty schema. The complete suite passed 43/43 with zero skips against the CI-configured pinned PostgreSQL image.

## Review

REV-031 accepted the transactional runner after replay, conflict, sequence, timestamp, and trust-boundary remediation. REV-032 accepted DEC-024 after all six architecture conditions received executable evidence.

## Boundary

This increment does not supply the canonical PostgreSQL catalog projector, RFC 8785 root, committed `0001` manifest hash, or complete CT-DB-001 evidence. WP-1 remains open and WP-2 remains unauthorized.
