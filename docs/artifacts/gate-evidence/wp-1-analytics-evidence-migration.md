# WP-1 Analytics Evidence Migration Evidence

**Date:** 2026-09-14
**Scope:** `0005-analytics-evidence` and sequence-5 canonical projection on an empty database
**Result:** PASS for the reviewed increment

## Canonical Artifacts

- Migration identity: `0005-analytics-evidence`, sequence 5
- Exact SQL-byte SHA-256: `638fdcb40695be04a30c56807e529f753fd37c80ccfdcd6ad58f04e603287cc4`
- Resulting manifest SHA-256: `92f3a9dcf71e61ae42977d2a2c009130ec4b622f1370239e65a6d5fdc8e54d46`
- PostgreSQL baseline: `16.15|UTF8|UTC|on|C`
- Autonomous work-item trace: GitHub issue #68

The 2026-09-15 WP-1 closure recomputed this cumulative manifest with the final sequence-6 projector and corrected sequence-3 authority. This hash supersedes the earlier incremental projection; no sequence-5 SQL bytes changed.

## Executed Behavior

Pinned PostgreSQL 16.15 applied migrations 0001 through 0005 to a clean database. Migration 0005 created nine analytics-evidence tables, three functions, and three indexes with exact owners, hardened search paths, denied PUBLIC execution, and no extension, view, trigger, queue, scheduler, provider, or runtime integration scope.

Synthetic records proved exact closed canonical admission, semantic timestamps and dates, deterministic collection order, unique identities, bounded fixed-point classes, all-surface negative-zero normalization, canonical transformation sources and output hashes, shared immutable input reuse, collision-resistant manifest identities, and database-owned retention metadata. Complete evidence atomically updates publication state; degraded evidence persists without publication. Concurrent equivalent replay returns the original result, conflicting replay fails deterministically, and competing publication replacement admits one writer. A forced late audit failure returned the stable commit error and rolled back every earlier write.

The controlled read reconstructs the complete Full Evidence Bundle and verifies input, configuration, result, bundle, lifecycle, retention, and global manifest hashes and links. Tamper tests covered canonical input, denormalized metadata, retention deadlines, wrong collection types, and a self-consistent duplicate lifecycle epoch. The duplicate epoch was rejected by one-to-one OperationalMetadata retention cardinality rather than an incidental hash mismatch.

Forced projection failure rolled back all sequence-5 tables, functions, indexes, grants, and the migration ledger row while preserving migrations 0001 through 0004. The complete repository suite passed 94/94; TypeScript lint passed; `git diff --check` passed; and the dependency audit found zero vulnerabilities.

## Review

REV-041 accepted the bounded implementation with no remaining finding after canonical closure, replay concurrency, publication serialization, degraded persistence, lifecycle-retention cardinality, complete read reconstruction, exact catalog, rollback, and hash-pinning findings were closed.

## Empty-Database Boundary

This first pass is additive. The target contains no legacy data, so no row copy, transformation, backfill, historical reconciliation, or cutover logic is required or evidenced. Synthetic rows exist only for executable conformance.

Migration `0006-controlled-access`, final immutable triggers and privilege closure, complete WP-1 exit, WP-2 fixture loading, WP-3 authorization/redaction, WP-5 analytics computation, baseline activation, release, deployment, and production action remain open or unauthorized.
