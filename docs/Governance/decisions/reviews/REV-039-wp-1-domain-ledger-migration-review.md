# REV-039: WP-1 Domain-Ledger Migration Code Review

**Date:** 2026-09-14
**Reviewer:** Code Reviewer dispatch
**Scope:** `0003-domain-ledger` additive empty-database installation, controlled functions, owner authority, integrity evidence, and sequence-3 canonical projection
**Result:** PASS

## Disposition

The initial review found contract-invalid transaction and allocation evidence, missing reversal dependencies, semantic-only canonical-content checks, incomplete FIFO residual handling, and insufficient behavioral tests. The repaired migration constructs fixed canonical transaction, allocation, audit, portfolio-commitment, and audit-commitment bytes; preserves immediate foreign keys; allocates the exact final lot-basis residual; derives reversal behavior from immutable effects; rejects active reversal dependencies; and validates exact canonical ledger content before mutation.

The bounded re-review found and closed two clean-installation authority defects. `ledger_writer_owner` now coordinates with `paper_order_transition` through a shared transaction advisory lock and reads only the four granted `paper_orders` columns without `FOR UPDATE`. A live 48-cell privilege matrix proves that only `SELECT` on `order_id`, `instrument_id`, `side`, and `aggregate_version` is effective and that no column-level `INSERT`, `UPDATE`, or `REFERENCES` authority exists. Ledger audit evidence now hashes a documented fixed RFC 8785 record, and the integration fixture independently reconstructs and verifies the digest.

The final Code Reviewer recheck found no in-scope blocker. PostgreSQL 16.15 clean installation, rollback, exact catalog projection, nested owner execution, canonical hashes, FIFO allocation, reversal lineage, and authority checks passed. The complete repository suite passed 76/76 with zero skips; TypeScript compiled cleanly; `git diff --check` passed; and `npm audit --audit-level=high` reported zero vulnerabilities.

## Boundary

This PASS covers an additive first-pass migration into an empty database. There are no legacy rows to copy, transform, backfill, or reconcile. Production application transaction coordination, separate-connection intent/rejection audit choreography, access-denial collection, retry/recovery operations, migrations `0004` through `0006`, WP-1 exit, WP-2, release, deployment, and production remain open or unauthorized.
