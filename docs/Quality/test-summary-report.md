# Ring 3 Test Summary Report

**Date:** 2026-09-25  
**Commit:** `2b8a21d4ad55ea489eed9546824a64f161c3a1d6`  
**CI run:** 36168279046, attempt 1  
**Independent review:** REV-202  
**Status:** PASS after clearing the documentation condition

The assembled Ring 3 packet was subsequently published as commit `92b7238e7ddd8cf83e3f5466e7ddb6b3fe00d33e`; CI run 36173930332 repeated every job successfully before DEC-094 closure.

## Execution Results

| Command/job | Tests | Passed | Failed | Skipped | Todo/cancelled | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Full `npm test` | 573 | 572 | 0 | 1 | 0 | PASS; intentional coverage-parent skip |
| WP-8 PostgreSQL parents | 12 | 12 | 0 | 0 | 0 | PASS |
| Coverage source run | 424 | 424 | 0 | 0 | 0 | PASS |
| Coverage gate controls | 2 | 2 | 0 | 0 | 0 | PASS |
| Browser accessibility | 2 | 2 | 0 | 0 | 0 | PASS |

The single full-suite skip is `PT-COVERAGE-001 meets business logic and public endpoint coverage gates`. It is intentionally gated on the generated `ETF_COVERAGE_REPORT`; the immediately subsequent dedicated coverage job executed and passed that parent and its parser controls. It is not lost test coverage.

## Business Coverage

| File | Lines |
| --- | ---: |
| Application analytics evidence service | 91.43% |
| Application boundary | 95.04% |
| Application fixture package | 96.29% |
| Application foundation | 100.00% |
| Domain analytics | 90.09% |
| Domain P0 rule | 91.00% |
| Domain paper order | 88.01% |

Every in-scope file exceeds the 80% gate. Branch/function percentages are diagnostic only under the approved line-coverage strategy.

## Independent Quality Score

REV-202 scored determinism 4, behavioral focus 4, failure specificity 4, refactoring resistance 4, input coverage 5, isolation 5, and maintainability 3. The weighted composite is 4.11, Excellent. No dimension is below 3.

## Findings And Disposition

The review-time Sev 2 artifact gap is closed by this report and `test-strategy.md`. Nonblocking findings are the line-only coverage scope, generic local skip semantics, one timing-sensitive assertion, test-file maintainability (#87), and dependency freshness (#93). These are owned residual debt, not evidence failures.

The published run also passed lint, build, security evidence, and CodeQL. This report does not authorize Ring 4, release, deployment, production, public ingress, providers, brokerage, or SQL Server migration.
