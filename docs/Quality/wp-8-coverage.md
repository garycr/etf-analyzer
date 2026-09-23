# WP-8 PT-COVERAGE-001 Evidence

**Date:** 2026-09-23
**Scope:** Domain/Application line coverage and exact public API route coverage only
**Status:** Accepted under DEC-083, REV-188, and REV-189

## Canonical Execution

`npm run test:coverage:wp8` builds the repository, runs every ordinary unit test with Node built-in line coverage, recursively discovers every compiled JavaScript file under `dist/Application` and `dist/Domain`, and executes the PT-COVERAGE-001 gate against the captured report. Temporary evidence is created under an OS-randomized directory and removed unconditionally.

The canonical command passed with zero unit failures and zero skips. The gate itself passed non-skipped, and its adversarial parser controls passed.

## Business Logic Coverage

| Compiled file | Line coverage | Gate |
| --- | ---: | --- |
| `dist/Application/analytics-evidence-service.js` | 91.43% | PASS |
| `dist/Application/application-boundary.js` | 95.04% | PASS |
| `dist/Application/fixture-package.js` | 96.29% | PASS |
| `dist/Application/foundation.js` | 100.00% | PASS |
| `dist/Domain/Analytics/analytics.js` | 90.09% | PASS |
| `dist/Domain/Analytics/p0-rule.js` | 91.00% | PASS |
| `dist/Domain/Orders/paper-order.js` | 88.01% | PASS |

Every in-scope file independently exceeds the 80% line threshold. Recursive discovery and complete relative-path matching make new or duplicate-basename Domain/Application files fail closed if absent or below threshold. Synthetic controls prove exact 80.00% acceptance and rejection of 79.99%, missing files, malformed reports, duplicate basenames, blank directory rows, and empty discovery.

## Public API Routes

The gate imports the compiled HTTP adapter and behaviorally resolves the exact 16 reviewed method/target pairs to 16 unique Application operations. It also proves unsupported method, path, and API version remain unresolved. This duplicates the established CT-API-001A behavioral assertion rather than inspecting its source text.

## Validation And Review

- TypeScript build: PASS.
- Canonical `npm run test:coverage:wp8`: PASS.
- Unit coverage source run: 412 passed, zero failed, zero skipped at the recorded baseline.
- PT-COVERAGE live and adversarial gate tests: 2 passed, zero failed, zero skipped.
- CI now executes the canonical gate on Node 20; the declared minimum is Node 20.1 because built-in test coverage begins there.
- Initial independent Code Review: FAIL on fixed basenames, route source-text inspection, runtime-floor mismatch, and missing adversarial controls.
- Follow-up review: FAIL because malformed-report testing stopped at the empty-discovery guard.
- Final Code Review REV-188: PASS after exhaustive discovery, direct route execution, CI enforcement, and corrected parser controls.
- Security Review REV-189: PASS with no Critical, Major, or Minor findings.

## Boundary

This evidence supports PT-COVERAGE-001 only. It does not close WP-8, DP-33, Ring 2, release, deployment, or production. It adds no production endpoint, service, dependency, migration, public ingress, provider, broker, queue, or durable handoff. Greenfield PostgreSQL remains the only persistence target; no SQL Server migration or conversion is authorized. REV-164 and the original CT-DB-001K evidence remain invalidated history.
