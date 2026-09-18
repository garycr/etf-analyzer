# REV-119 - WP-6 Stale-Order Precedence Code Review

**Date:** 2026-09-18
**Reviewer:** Code Reviewer agent using Claude Sonnet 5, independent final recheck
**Scope:** CT-LED-012 stale fill-order classification, no-mutation evidence, owner error mapping, and sequence 3 through 6 migration identities
**Disposition:** PASS

## Findings and Remediation

The initial review found no SQL defect but issued a conditional disposition for two evidence gaps: the PostgreSQL contract did not explain the sequence-3 rebaseline, and the retained `LEDGER_ORDER_MISMATCH` branch and its precedence over stale versions lacked direct integration coverage. The final slice adds a dated contract amendment and proves both branches against PostgreSQL: stale identity-correct commands return `ORDER_VERSION_CONFLICT`, while wrong-instrument commands that are also stale return `LEDGER_ORDER_MISMATCH`. Exact snapshots remain unchanged after both failures.

A Minor observability risk was also closed by allowlisting `LEDGER_ORDER_MISMATCH` in the PostgreSQL order owner and testing its stable mapping. Sequence 3 SQL and manifest identities, plus cumulative sequence 4 through 6 manifests, are aligned across the normative contract and live migration tests.

## Evidence

- Focused post-remediation build, owner unit suite, and CT-LED-012 PostgreSQL test: passed.
- PostgreSQL 16.15 UTF8/C/UTC complete suite: 417 passed, 0 failed, 0 skipped.
- Dependency audit: 0 vulnerabilities.
- Diagnostics and `git diff --check`: clean.

## Residual Risk

The integration test uses instrument mismatch to prove the shared mismatch branch. Side and fill-kind mismatch variants share the same SQL exception path but are not separately exercised in this test. The direct-fill and paper-order-transition paths retain a pre-existing lock hierarchy constraint that must be preserved when future controlled functions change.
