# WP-1 Controlled Access Migration Evidence

**Date:** 2026-09-15
**Scope:** `0006-controlled-access` and sequence-6 canonical projection on an empty database
**Result:** PASS for the reviewed increment

## Canonical Artifacts

- Migration identity: `0006-controlled-access`, sequence 6
- Exact SQL-byte SHA-256: `62d4c23bcb89cbf26d58af8a994c765d74cf64e2267c0ae52e240f2632be0235`
- Resulting manifest SHA-256: `cac533a25d652e9bd3da840632f8b131ba98b82ed6898d0115acc56228412d02`
- PostgreSQL baseline: `16.15|UTF8|UTC|on|C`
- Autonomous work-item trace: GitHub issue #69

The 2026-09-15 PT-FIX-001F re-baseline changed only the cumulative manifest inherited from the corrected sequence-4 DEC-014 Money bounds. No sequence-6 SQL bytes changed.

## 2026-09-15 PT-FIX-001F Re-baseline Verification

PostgreSQL `16.15|C|UTF8|UTC|on` projected the updated cumulative sequence-6 manifest while preserving the exact sequence-6 SQL hash and final authority surface. The controlled-access migration suite passed 2/2; the affected sequence-4-through-6 chain passed 12/12; and the complete serial PostgreSQL-backed repository suite passed 248/248 with zero skips or failures.

## Executed Behavior

Pinned PostgreSQL 16.15 applied migrations 0001 through 0006 to a clean database. Migration 0006 created 102 statement triggers over 34 immutable relations, four hardened functions, and five security-barrier views. Function search paths are fixed to `pg_catalog,etf`, PUBLIC execution is revoked, runtime roles have no base-table authority, and temporary schema and function construction privileges are absent from the final catalog.

Controlled reads returned only the bounded job, paper-order, and anchored portfolio projections. Portfolio reads required both a matching ledger commitment and ledger anchor. Effective privilege checks denied base-table SELECT, INSERT, UPDATE, DELETE, and TRUNCATE to `app_runtime` and denied unauthorized reader-function execution to the other runtime roles. UPDATE, DELETE, and TRUNCATE attempts by five representative table owners failed with SQLSTATE `55000`.

The canonical projector captured exact table, function, view, role, membership, object ACL, and column ACL state. Forced projection failure rolled back all sequence-6 views, functions, triggers, grants, and the migration ledger row while preserving migrations 0001 through 0005.

The complete repository suite passed 99/99 against the exact password-bearing test URL; TypeScript build and lint passed; editor diagnostics found no changed-file errors; `git diff --check` passed; and the dependency audit found zero vulnerabilities.

## Review

REV-042 records independent Code Reviewer PASS and Security Reviewer PASS dispositions with no remaining findings.

## Empty-Database Boundary

This first pass is additive. The target contains no legacy data, so no row copy, transformation, backfill, historical reconciliation, or cutover logic is required or evidenced. Synthetic rows exist only for executable conformance.

WP-2 fixture loading, WP-3 authorization/redaction, WP-5 analytics computation, baseline activation, release, deployment, and production action remain open or unauthorized.
