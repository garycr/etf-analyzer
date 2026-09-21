# WP-8 CT-DB-001K Readiness Evidence

**Date:** 2026-09-21
**Decision:** DEC-069
**Review:** REV-164 PASS
**Scope:** CT-DB-001K only

## Accepted Conditions

1. PostgreSQL 16 baseline settings match the candidate contract.
2. The exact six migration identities and content hashes are present in order.
3. The current catalog manifest hash matches the stored sequence-6 manifest hash.
4. No `etf` function grants PUBLIC execution.
5. A real `audit_runtime` login can append a correlated denial record inside a bounded transaction that is unconditionally rolled back.
6. A real `projection_runtime` login verifies every protected ledger checkpoint inside a read-only bounded transaction; an empty set is Ready and a mismatched commitment fails with `LEDGER_INTEGRITY_FAILED`.
7. Connectivity, migration drift, denial-audit failure, and ledger-integrity failure retain their stable public classifications without SQL, payload, credential, or exception disclosure.

## Validation

- Unit readiness suite: 19/19 PASS, zero skipped.
- Exact pinned PostgreSQL 16.15 CT-DB role/capability path: 1/1 PASS, zero skipped.
- Host aggregate: 466 tests, 410 passed, 56 expected database-environment skips, zero failed.
- Lint, build, diagnostics, diff check, and dependency audit PASS; zero vulnerabilities.
- Code Reviewer PASS after error-classification remediation.
- Security Reviewer PASS after cleanup, timeout, identifier, and test-credential remediation.
- No temporary PostgreSQL container remains.

## Boundary

This evidence accepts CT-DB-001K only. It does not accept integrated CT-DB-001A..J, PT-E2E-001, WP-8, DP-33, Ring 2 closure, release, deployment, or production use.
