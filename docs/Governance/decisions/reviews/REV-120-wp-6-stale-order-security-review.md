# REV-120 - WP-6 Stale-Order Security Review

**Date:** 2026-09-18
**Reviewer:** Security Reviewer agent using Gemini 3.8 Flash, independent read-only review
**Scope:** CT-LED-012 security-definer boundary, least privilege, identity-before-version precedence, advisory locking, fail-closed rollback, and owner error mapping
**Disposition:** PASS

## Findings

No Critical, Major, or Minor security finding was identified. `ledger_append` retains its fixed `pg_catalog, etf` search path, runtime session check, revoked public execution, and column-level order read authority. The transaction-scoped order advisory lock is acquired before identity and version inspection, preventing a check/use race.

Identity validation precedes version validation, so a mismatched request cannot use the stale-version response as an order-version oracle. Both errors are constant allowlisted values, all queries remain parameterized, unknown owner errors remain fail-closed, and exact PostgreSQL snapshots prove neither rejection leaves partial ledger state.

## Evidence

- Focused post-remediation build, owner unit suite, and CT-LED-012 PostgreSQL test: passed.
- PostgreSQL 16.15 UTF8/C/UTC complete suite: 417 passed, 0 failed, 0 skipped.
- Dependency audit: 0 vulnerabilities.
- REV-119 final code-review recheck: PASS after both conditional evidence gaps were closed.

## Residual Risk

Direct fill appends and paper-order transitions depend on the existing controlled call convention and advisory-lock hierarchy. Future exposure or lock-order changes require renewed concurrency and privilege review. Production connections must retain the constrained runtime identity.
