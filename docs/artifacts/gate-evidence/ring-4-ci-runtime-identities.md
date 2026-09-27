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

## Local Validation

- PT-CI-001 and PT-CI-002: 2 passed, 0 failed.
- Workflow YAML parse: PASS.
- Full repository suite: 553 tests, 460 passed, 0 failed, 93 environment-gated skips.
- Coverage gate: 85.63% lines, 86.18% branches, 81.00% functions.
- Exact digest-pinned Playwright image inspection: Ubuntu 24.04 and bundled Node 24.20.0, confirming the need for explicit Node setup in that job.
- TypeScript lint, dependency audit, SAST, and secret scan: PASS.
- Commit-bound security evidence: fail-closed locally without GitHub identity; exact-commit CI pending.
- Code, security, and architecture review: REV-210, REV-211, and REV-212 PASS.
- Exact-commit publication CI: pending.

## Publication Condition

Issue #90 may close only after independent review and exact implementation CI pass all jobs. No release, promotion, deployment, or production authority follows.
