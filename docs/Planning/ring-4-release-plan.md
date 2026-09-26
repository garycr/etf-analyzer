# Ring 4 Release Management Plan

**Date:** 2026-09-25
**Decision:** DEC-095
**Tracking:** GitHub #97
**Status:** Active

## Release Boundary

Ring 4 prepares a versioned, immutable release candidate for the local single-user, loopback-only ETF Analyzer backed by greenfield PostgreSQL 16.15. The release candidate remains fixture-only and research-only. It excludes public ingress, multi-user identity, providers, brokerage, durable handoff, SQL Server migration, staging, and production.

No Ring 4 artifact or promotion authorizes production. DP-25 remains human-owned.

## Entry Evidence

| Criterion | Evidence | Result |
| --- | --- | --- |
| IV&V GREEN/YELLOW with no Sev 1/2 | DEC-094; `docs/artifacts/gate-evidence/ring-3-ivv.md` | PASS |
| Independent report delivered | REV-202 and REV-203 | PASS |
| Review findings resolved or tracked | #87, #89, #90, #93, #94 | PASS |
| OSS review | `docs/Planning/oss-review-ring3.md` | PASS |
| FinOps high-cost approvals | No high-cost path; provider actuals unavailable and recorded | PASS |
| Test quality | Composite 4.11; no dimension below 3 | PASS |
| Ring 3 lessons learned | `docs/Quality/lessons-learned-ring-3.md` | PASS |

## Work Sequence

| Order | Work | Issue | Status | Promotion impact |
| ---: | --- | --- | --- | --- |
| 1 | Supported local composition root, six missing authoritative query owners plus the existing portfolio owner (seven total), fixture artifact-loading policy, launch/shutdown tests | #88 | Complete; CI `36260497399` passed | Required for truthful DEV and SMOKE gates |
| 2 | Per-launch token and explicit request concurrency/rate controls | #89 | Pending | Required before promoting the supported launcher |
| 3 | Exact release-grade runner and Node identities | #90 | Pending | Required for reproducible release evidence |
| 4 | Dependency compatibility, advisory, changelog, and lifecycle disposition | #93 | Pending | Required before freezing the release manifest |
| 5 | Branch coverage, local skip enforcement, and timing determinism | #94 | Pending | Required before final TEST promotion |
| 6 | Structured scenario extraction | #87 | Pending if needed | Maintenance work; include only if needed for release evidence reliability |

## Release Outputs

- Supported local launch and shutdown commands with recovery guidance.
- Versioned release manifest and deterministic artifact checksums.
- Release notes, rollback plan, and updated implemented-state architecture.
- DEV, SMOKE, and TEST promotion evidence in `docs/Operations/promotion-log.md`.
- Populated non-production/production budget boundaries in `docs/Operations/finops-config.md` before any Ring 4 exit review.
- Periodic structured code review and Ring 4 lessons learned.

## Exit Conditions

Ring 4 remains Active until documentation is synchronized, release artifacts are versioned, architecture is current, periodic structured code review passes, a checkpoint is published, FinOps budgets are populated, and Ring 4 lessons learned are complete. Ring 5 requires a separate gate decision.
