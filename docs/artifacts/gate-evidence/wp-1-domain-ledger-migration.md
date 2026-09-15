# WP-1 Domain-Ledger Migration Evidence

**Date:** 2026-09-14
**Scope:** `0003-domain-ledger`, DEC-027 prerequisites, and sequence-3 canonical projection on an empty database
**Result:** PASS for the reviewed increment

## Canonical Artifacts

- Migration identity: `0003-domain-ledger`, sequence 3
- Exact SQL-byte SHA-256: `d514c7f3b75c6ed83dfdbd9b54b406b14814b2bf8f40bd1e04a9d70a303346a3`
- Resulting manifest SHA-256: `61008ff4dd4898afb0f0b168c4d063dae4894fb8257f9ee77db3af95fdde54d4`
- Canonical manifest length: 14,194 UTF-8 bytes
- Cumulative catalog: 28 tables and 11 functions

The 2026-09-15 WP-1 closure recomputed sequence 3 after the reviewed ownership and least-privilege correction delivered with sequence 6. These values supersede the earlier incremental SQL and manifest hashes.

## Executed Behavior

Pinned PostgreSQL `16.15|UTF8|UTC|on|C` applied migrations 0001, 0002, and 0003 to a clean database. Migration failure rolled back the complete 0003 catalog and retained sequence 2. The resulting catalog matched the exact table, function, constraint, index, owner, membership, extension, and grant projection.

Live behavior proved key injection and replacement denial, canonical cash evidence and empty allocation digest, independent committed-ledger audit digest, portfolio and audit commitment chains, exact canonical-content and duplicate-key rejection, nested paper-order fill dispatch, FIFO final-basis residual, insufficient-position rollback, reversal dependency and parity, restored-lot consumption, immutable lineage, immediate foreign keys, and exact four-column cross-owner read authority. The complete repository suite passed 76/76 with zero skips, TypeScript compiled cleanly, `git diff --check` passed, and the dependency audit found zero vulnerabilities.

## Review

REV-038 approved DEC-027 prerequisites with no Critical or Major finding. REV-039 accepted the bounded 0003 implementation after the clean-catalog authority and canonical audit-evidence findings were closed.

## Empty-Database Boundary

This first pass is additive. The target contains no legacy data, so no row copy, transformation, backfill, historical reconciliation, or cutover logic is required or evidenced. Runtime application coordination for separately committed intent/rejection audits and denial collection is not migration SQL and remains assigned to later application work.

This evidence covers only 0003. Migrations `0004` through `0006`, complete WP-1 exit, WP-2, baseline activation, release, deployment, and production action remain open or unauthorized.
