# Ring 4 Test Gate Hardening Evidence

**Date:** 2026-09-27
**Issue:** #94
**Decision:** DEC-100
**Reviews:** REV-215 and REV-216 PASS
**Boundary:** Test-gate hardening only; no promotion authority

## Evidence

- The owner-approved aggregate branch threshold is 80%; observed aggregate branch coverage is 86.18%.
- Existing 80% per-file line coverage remains enforced for compiled Domain and Application files; observed aggregate line coverage is 85.63%.
- The coverage source run passed 443 tests, and both dedicated coverage-gate tests passed with zero failures.
- Every generic test batch delegates to the shared zero-skip executable. Without `ETF_TEST_POSTGRES_URL`, `npm test` fails closed with `Node test run reported 1 skipped` at PostgreSQL readiness.
- The generated-report coverage parent is excluded from generic execution and remains mandatory through dedicated `test:coverage:wp8` execution.
- Request deadline delay is a pure nonnegative calculation with future, exact, and expired boundary tests. The integration assertion verifies the 408 response and audit contract without measuring elapsed wall-clock time.
- Lint and 23 focused executable tests pass; the direct focused invocation has one expected coverage-parent skip because no generated report is supplied.
- Local live PostgreSQL execution correctly rejected host Node 24.20.0 against the governed Node 20 contract. Exact Node 20.20.2 and PostgreSQL 16.15 execution is reserved for publication CI because Node 20.20.2 is not installed locally.
- Exact implementation commit `44764613e5ea7718c6e431ac32bfc3a8745fbdbc` passed CI run `36355866056`: generic tests, zero-skip PostgreSQL parents, the coverage gate, browser accessibility, security audit/evidence, and CodeQL all succeeded.

## Disposition

Issue #94 is authorized to close after exact-commit publication CI passed. No release, promotion, deployment, or production authority follows.
