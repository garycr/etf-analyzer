# REV-013 - Analytics Evidence Retention ADR Review

**Date:** 2026-09-10
**Artifact:** `docs/Architecture/ADRs/ADR-001-analytics-evidence-retention.md`
**Reviewer dispatch:** `Claude Opus 5 (copilot)` process evidence only
**Final verdict:** PASS; DP-12 eligible

## Initial Review

The initial ADR equivalence review returned REVISE with two Major and seven Minor findings. All selected `RET-A-1.0` durations, thresholds, and capacity values matched, but the ADR narrowed shared reproducibility-input retention and misattributed Option A selection to REV-012.

The Workspace Owner approved all correction groups. GitHub #43-#47 captured the work and are closed as completed.

## Remediation

- Shared input sets remain retained through the latest deadline of every referencing bundle.
- REV-012 is credited only with clearing the options; DEC-017 records Workspace Owner selection.
- UTC deadline arithmetic is non-resetting and both 30-day backup/freeze intervals use distinct lifecycle states.
- SHA-256 key independence, immutable redacted degradation reasons, export warnings, prospective reductions, reviewed extensions, accessibility, and the operational-history tradeoff are explicit.
- DEC-017 recovery invalidation cites the RPO/RTO source views and neither the analytics contract nor aggregate baseline is frozen by ADR acceptance.

## Confirmation

The confirmation review returned PASS with no Critical, Major, or blocking Minor findings. `RET-A-1.0` remains unchanged: day 90 hot, day 730 full evidence/input retention, day 1,825 manifest retention, day 365 operational metadata, 30-day backup tail, 25 GiB envelope, Team Lead alert at 80%, and fail-closed run blocking at 100%.

## Boundary

REV-013 authorizes DP-12 presentation only. ADR-001 remains Proposed until the Workspace Owner accepts it. Acceptance does not authorize implementation, provider ingestion, dependency installation, production deployment, contract or aggregate baseline freeze, Ring 2 advancement, or parallel execution.
