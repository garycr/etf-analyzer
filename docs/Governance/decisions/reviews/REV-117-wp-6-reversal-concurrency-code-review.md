# REV-117 - WP-6 Reversal and Concurrency Code Review

**Date:** 2026-09-18
**Reviewer:** Code Reviewer agent using Claude Sonnet 5, independent final recheck
**Scope:** CT-LED-010 reversal lineage coverage and CT-LED-011 live concurrency, replay, and rollback evidence
**Disposition:** PASS

## Findings and Remediation

No Critical or Major finding remains. The initial review identified two Minor test-evidence gaps: the race outcome did not prove both backends actually contended, and the atomic snapshot omitted ledger lot rows. The final test holds the exact production portfolio advisory lock, observes both contender backend PIDs waiting on that lock before release, and includes lot counts in all state snapshots.

The test proves one winner and one `LEDGER_VERSION_CONFLICT` for jointly overspending buys and same-lot sells, exact winner-only row and hash deltas, equivalent concurrent replay without mutation, and changed-content `LEDGER_IDEMPOTENCY_CONFLICT` without mutation. Existing CT-LED-010 tests prove active-dependency and duplicate-reversal rejection with unchanged hashes and immutable row counts.

## Evidence

- Focused CT-LED-011 PostgreSQL test: 1 passed, 0 failed, 0 skipped.
- PostgreSQL 16.15 UTF8/C/UTC complete suite: 416 passed, 0 failed, 0 skipped.
- Dependency audit: 0 vulnerabilities.
- Diagnostics and `git diff --check`: clean.

## Residual Risk

The CT-LED-010 contract clauses are split across three executable titles rather than the single planned summary title. Coverage is complete, but the traceability table should be normalized when the remaining ledger matrix is consolidated.
