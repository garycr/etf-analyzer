# Ring 4 Release Management Plan

**Date:** 2026-09-25
**Decision:** DEC-095
**Tracking:** GitHub #97
**Status:** Closed under DEC-104; Ring 5 eligible, staging and production unauthorized

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
| 2 | Per-launch token and explicit request concurrency/rate controls | #89 | Complete; CI `36293666091` passed | Required before promoting the supported launcher |
| 3 | Exact release-grade runner and Node identities | #90 | Complete; CI `36326805089` passed | Required for reproducible release evidence |
| 4 | Dependency compatibility, advisory, changelog, and lifecycle disposition | #93 | Complete; CI `36330071820` passed; pins retained | Required before freezing the release manifest |
| 5 | Branch coverage, local skip enforcement, and timing determinism | #94 | Complete; CI `36355866056` passed | Required before final TEST promotion |
| 6 | Structured scenario extraction | #87 | Deferred under DEC-101; open post-release maintenance | Current release evidence is reliable; reopen on invalidation criteria |

## Release Outputs

### Candidate Status

`v0.1.0-rc.2` is assigned to source commit `1e7605f72722b6f59e63e5a168548b1aac69415e`, CI run `36442957057`, and archive SHA-256 `a5895c5fa378b362c84104c914be738a4d053ccc44a9913bf93c3bea9061a846`. Exact-commit CI, independent downloaded-artifact verification, clean-environment DEV preparation, bounded SMOKE, and TEST evidence passed. Ring 4 lessons learned and the release checkpoint are published; final Ring 4 exit review remains, and staging/production remain out of scope and unauthorized.

- Supported local launch and shutdown commands with recovery guidance.
- Versioned release manifest and deterministic artifact checksums.
- Release notes, rollback plan, and updated implemented-state architecture.
- DEV, SMOKE, and TEST evidence in `docs/Operations/promotion-log.md`.
- Ring 4 checkpoint in `docs/artifacts/gate-evidence/ring-4-release.md` and lessons learned in `docs/Quality/lessons-learned-ring-4.md`.
- Populated non-production/production budget boundaries in `docs/Operations/finops-config.md` before any Ring 4 exit review.
- Periodic structured code review and Ring 4 lessons learned.

## Exit Conditions

Ring 4 exit conditions are complete under DEC-104: documentation is synchronized, release artifacts are versioned, architecture is current, periodic structured review passed, a checkpoint is published, FinOps budgets are populated, and Ring 4 lessons learned are complete. Ring 5 is eligible but requires a separate gate decision; DP-25 remains human-owned for production.
