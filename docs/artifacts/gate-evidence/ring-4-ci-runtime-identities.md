# Ring 4 CI Runtime Identity Evidence

**Date:** 2026-09-26
**Issue:** #90
**Decision:** DEC-098
**Reviews:** REV-210, REV-211, REV-212 PASS
**Boundary:** Candidate CI reproducibility only; no promotion authority

## Implemented Evidence

- Every CI job selects the explicit `ubuntu-24.04` hosted-runner generation and verifies `VERSION_ID=24.04` before governed work.
- `.node-version` and all three npm-executing jobs select Node `20.20.2` exactly and verify `v20.20.2` before dependency installation.
- The browser job overrides the Playwright image's bundled Node 24.20.0 with the governed project runtime.
- GitHub Actions remain SHA-pinned; PostgreSQL and Playwright images remain digest-pinned.
- PT-CI-001 rejects `ubuntu-latest`, Node major-only selectors, missing runtime checks, and count drift across the four jobs.
- PT-CI-002 rejects non-SHA GitHub Actions and non-digest PostgreSQL or Playwright image references.
- PT-CI-003 rejects filtered zero-skip browser commands under the governed Node runtime.

## Local Validation

- PT-CI-001, PT-CI-002, and PT-CI-003: 3 passed, 0 failed.
- Workflow YAML parse: PASS.
- Full repository suite after publication remediation: 555 tests, 462 passed, 0 failed, 93 environment-gated skips.
- Coverage gate: 85.63% lines, 86.18% branches, 81.00% functions.
- Exact digest-pinned Playwright image inspection: Ubuntu 24.04 and bundled Node 24.20.0, confirming the need for explicit Node setup in that job.
- Exact digest-pinned Playwright image with networking disabled: 3 passed, 0 failed, 0 skipped.
- TypeScript lint, dependency audit, SAST, and secret scan: PASS.
- Commit-bound security evidence: fail-closed locally without GitHub identity; exact-commit CI pending.
- Code, security, and architecture review: REV-210, REV-211, and REV-212 PASS.
- Exact-commit publication CI: PASS.

Initial implementation commit `bb335c0a4da02b4f97185117abcb8cd108527453` passed build-and-test, security-audit, and CodeQL in run `36324909062`. Browser accessibility failed because Node 20.20.2 reported the test excluded by `--test-name-pattern` as skipped and the zero-skip gate rejected it. The root correction removes the filter and executes all three tests in the owned browser file; replacement exact-commit CI is required.

Replacement implementation commit `42bc4f4385ba1eb9c41efb865f2a660b2d057eb8` passed CI run `36326805089`: build-and-test, browser-accessibility, security-audit, and CodeQL all succeeded.

## Publication Condition

Issue #90 is authorized to close after independent review and exact implementation CI passed all jobs. No release, promotion, deployment, or production authority follows.
