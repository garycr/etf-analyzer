# Ring 4 Launch Hardening Evidence

**Date:** 2026-09-26
**Issue:** #89
**Decision:** DEC-097
**Reviews:** REV-207, REV-208, REV-209 PASS
**Boundary:** Single-user, fixture-only, literal IPv4 loopback; no promotion authority

## Implemented Evidence

- A fresh 256-bit launch token is generated in memory and printed only in the URL fragment.
- The browser accepts only the exact fragment form and sends the token as `X-Launch-Token` on API requests.
- Host, Origin, and token checks run before request-body buffering; missing and incorrect tokens share one redacted `401`.
- Authenticated API work uses explicit zero-queue concurrency and fixed-window rate limits; both exhaustion paths share one redacted `429`.
- Static root, workbench script, and valid CORS preflight remain available without consuming API capacity.
- Capacity is released on completion, timeout, error, abort, and incomplete close.

## Validation

- Full repository suite: 551 tests, 458 passed, 0 failed, 93 environment-gated skips.
- Coverage gate: 2/2 PASS; 85.76% statements, 86.16% branches, 81.07% functions.
- TypeScript lint: PASS.
- Dependency audit, SAST, secret scan, and commit-identified security evidence: PASS.
- Focused adapter unit and integration suites: PASS.
- Local Playwright execution was unavailable because Chromium could not load host library `libnspr4.so`; publication CI remains the browser gate.

## Publication Condition

Issue #89 may close only after the exact implementation commit passes publication CI, including the browser accessibility job. No DEV/SMOKE promotion, release, deployment, or production authority follows.
