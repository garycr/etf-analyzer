# Tokenomics Operating Guide

> Applies to every workspace variant created by this template. Token review is a validation and governance loop, not a prompt-only optimization.

**Project:** ETF Analyzer
**Tier:** 1 — Small Team
**Created:** 2026-09-10

## Operating Loop

1. Set the measurable goal.
2. Establish the baseline.
3. Make the smallest safe change.
4. Validate with tests, reviews, or token measurements.
5. Decide whether to keep, revise, or defer.
6. Capture the evidence in the saved artifact.

## Ring Requirements

| Ring | Required token review action | Saved evidence | Human review requirement |
| ---- | ---------------------------- | -------------- | ------------------------ |
| Ring 1 | Attach token estimates to each architecture option, WBS option, and IMS or schedule baseline before human selection | `docs/Planning/token-review-baseline.md`, architecture artifact, WBS artifact, IMS/schedule artifact | Human reviewer receives the estimate and records the decision in the saved artifact |
| Ring 2 | During each development review, provide estimated development token cost and estimated operating token cost | `docs/Planning/token-review-baseline.md`, `validation-log.md` | Human reviewer accepts, rejects, or requests revised estimates as part of review disposition |
| Ring 3 | Present the original Ring 1 estimate beside the updated estimate after development moves to IV&V | `docs/Planning/token-review-baseline.md`, IV&V report, gate evidence | Human reviewer decides the variance disposition before Ring 3 can close |
