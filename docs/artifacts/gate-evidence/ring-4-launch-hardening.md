# Ring 4 Launch Hardening Evidence

**Date:** 2026-09-26
**Issue:** #89
**Decision:** DEC-097
**Reviews:** REV-207, REV-208, REV-209 PASS
**Boundary:** Single-user, fixture-only, literal IPv4 loopback; no promotion authority

## Implemented Evidence

- A fresh 256-bit launch token is generated in memory and printed only in the URL fragment.
- The browser accepts only the exact fragment form, retains the validated token in tab-scoped storage across anchor navigation and reload, and sends it as `X-Launch-Token` on API requests.
- Host, Origin, and token checks run before request-body buffering; missing and incorrect tokens share one redacted `401`.
- Authenticated API work uses explicit zero-queue concurrency and fixed-window rate limits; both exhaustion paths share one redacted `429`.
- Static root, workbench script, and valid CORS preflight remain available without consuming API capacity.
- Capacity is released on completion, timeout, error, abort, and incomplete close.

## Validation

- Full repository suite after browser remediation: 552 tests, 459 passed, 0 failed, 93 environment-gated skips.
- Coverage gate: 2/2 PASS; 85.76% statements, 86.16% branches, 81.07% functions.
- TypeScript lint: PASS.
- Dependency audit, SAST, secret scan, and commit-identified security evidence: PASS.
- Focused adapter unit and integration suites: PASS.
- Exact digest-pinned Playwright container with networking disabled: 2/2 PASS, zero failures and zero skips.

Initial publication run `36292178660` failed both browser tests because native skip-link navigation replaced the launch-token fragment and later requests lost authentication. The tab-scoped retention fix is covered by deterministic unit tests and focused code/security re-review; replacement publication CI remains required.

Replacement run `36292834208` remained red and prompted exact local container reproduction. The final browser test uses a fresh context for every initial analytics state and reserves the workflow test for fragment replacement and reload retention. Independent test re-review and the offline pinned-container run both PASS; a new exact-commit publication run remains required.

Final implementation commit `6b1b0303fead2c57979aec1a246d6f08593ec551` passed CI run `36293666091`: build-and-test, browser-accessibility, security-audit, and CodeQL all succeeded.

## Publication Condition

Issue #89 is authorized to close after exact implementation CI succeeded. No DEV/SMOKE promotion, release, deployment, or production authority follows.
