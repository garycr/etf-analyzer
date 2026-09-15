# WP-1 Foundation Migration Evidence

**Date:** 2026-09-14
**Scope:** Transactional runner and `0001-foundation` authority/rollback behavior
**Result:** PASS for the reviewed increment

## Executed Behavior

The runner acquires the transaction-scoped migration advisory lock, follows `deployment_login` to `migration_executor` to `migration_owner`, computes lowercase SHA-256 from exact UTF-8 SQL bytes, enforces closed identity and contiguous sequence, rejects drift, and rolls back every failure. It passes the prospective migration entry to the manifest projector before inserting exactly one ledger row.

Pinned PostgreSQL 16 execution verified the exact external database ACL and empty-schema prerequisite. During `0001`, `schema_migrations` was owned by `migration_owner`; the three protected tables were owned by `anchor_owner`; temporary `anchor_owner` schema `USAGE, CREATE` was absent before projection; and forced projector failures for both a thrown error and an unsupported view rolled the transaction back to the unchanged empty schema. The final canonical RFC 8785 manifest is 5,444 UTF-8 bytes with SHA-256 `3ba3b63c429cf051378ce3eb4adafe0db697dec487d070669a6bc47dba2f8f7c`; its SQL-byte SHA-256 is `a604802a67bed66c6ce79d2f2f856b48e184ae5b4f76803ab8ead3a135c85291`. It includes the exact six database CONNECT grants, explicit grant-option state, and column-aware ACL projection. Focused manifest validation passed 19/19, bootstrap/foundation integration passed 8/8, and the complete live suite passed 56/56 with zero skips.

## WP-1 Closure Reconciliation

The 2026-09-15 WP-1 closure recomputed this cumulative manifest with the final sequence-6 projector. The value above supersedes the earlier incremental manifest hash and length; no sequence-1 SQL bytes changed.

## Review

REV-031 accepted the transactional runner after replay, conflict, sequence, timestamp, and trust-boundary remediation. REV-032 accepted the initial DEC-024 authority path, and REV-033 accepted its exact database-ACL amendment. REV-034 accepted the canonical manifest projector with no Critical or Major finding after the sole Minor fixture-isolation finding was closed.

## Boundary

This increment supplies the canonical PostgreSQL catalog projector, RFC 8785 root, and committed `0001` manifest hash only. Migrations `0002` through `0006`, their hashes, complete CT-DB-001 evidence, and WP-1 exit remain open. WP-2 remains unauthorized.
