# REV-036: WP-1 Application Migration Code Review

**Date:** 2026-09-14
**Reviewer:** Code Reviewer, GPT-5.3-Codex dispatch
**Scope:** 0002 application tables, controlled functions, concurrency, validation, owner authority, and sequence-2 canonical projection
**Result:** PASS

## Disposition

The initial review found an expected-version null bypass, an unlocked watchlist compare-and-write race, incomplete readiness dependency validation, and raw PostgreSQL cast errors. The implementation now requires an unsigned expected version, locks one explicit aggregate-version row, preserves version across an empty watchlist, permits only one concurrent same-version writer, validates the exact six readiness dependencies and top-level readiness matrix, and maps malformed JSON, UUID, and UTC timestamp inputs to `APPLICATION_REQUEST_INVALID`.

Every controlled function is owned by `application_writer_owner`, is volatile and parallel unsafe, uses SECURITY DEFINER with fixed `search_path=pg_catalog, etf`, qualifies product objects, and revokes PUBLIC execution. DEC-025 leaves schema USAGE true and CREATE false after migration.

The final recheck found no Critical or Major blocker. Exact PostgreSQL 16.15 with UTF8, UTC, standard strings on, and C collation passed the complete 61-test suite with zero skips. The dependency audit found zero vulnerabilities.

## Boundary

This PASS covers only 0002 and sequence-2 projection. Migrations 0003 through 0006, complete CT-DB-001, WP-1 exit, WP-2, release, deployment, and production remain open or unauthorized.
