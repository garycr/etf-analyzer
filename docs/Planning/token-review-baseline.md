# Token Review Baseline

> Canonical saved artifact for token review validation. Every workspace variant uses this file to carry Ring 1 estimates into Ring 2 review and Ring 3 IV&V.

**Project:** ETF Analyzer
**Created:** 2026-09-10
**Updated:** 2026-09-15
**Pricing basis:** Token volumes are estimated; dollar pricing is unavailable until the Ring 2 execution model/provider is selected.

## Ring 1 - Human Review Attachments

Attach estimates to every architecture, WBS, and IMS/schedule artifact presented for human review. The human decision is part of the saved artifact.

| Artifact ID | Artifact type | Artifact path | Estimated input tokens | Estimated output tokens | Model/profile | Estimated input cost | Operating cost impact | Human decision | Decision date |
| ----------- | ------------- | ------------- | ---------------------- | ----------------------- | ------------- | -------------------- | --------------------- | -------------- | ------------- |
| ARCH-R1 | Architecture | `docs/Architecture/` | 80,000 | 30,000 | Review model selected at execution | Unavailable | None; no runtime AI | Approved as Proposed input | 2026-09-11 |
| WBS-R2 | WBS | `docs/Planning/tasks/ring-2-wbs.md` | 25,000 | 12,000 | Planning/review model selected at execution | Unavailable | None | Approved | 2026-09-11 |
| SCHED-R2 | IMS / Schedule | `docs/Planning/schedule/ring-2-delivery-schedule.md` | 12,000 | 6,000 | Planning/review model selected at execution | Unavailable | None | Approved | 2026-09-11 |

## Ring 2 Work-Package Token Estimate

| Work package | Estimated input tokens | Estimated output tokens | Model/profile | Operating token impact |
| --- | ---: | ---: | --- | --- |
| WP-1 | 120,000 | 60,000 | Coding model selected at execution | None |
| WP-2 | 150,000 | 75,000 | Coding model selected at execution | None |
| WP-3 | 160,000 | 80,000 | Coding model selected at execution | None |
| WP-4 | 120,000 | 60,000 | Coding model selected at execution | None |
| WP-5 | 220,000 | 110,000 | Coding model selected at execution | None |
| WP-6 | 220,000 | 110,000 | Coding model selected at execution | None |
| WP-7 | 180,000 | 90,000 | Coding model selected at execution | None |
| WP-8 | 140,000 | 70,000 | Coding/review model selected at execution | None |
| **Total** | **1,310,000** | **655,000** | Mixed, selected per package | **None** |

These are control estimates, not spending authorization. Ring 2 reviews report actual token use when provider telemetry is available; otherwise they report the same limitation explicitly.

## Ring 2 - Development Review Estimates

Provide the human reviewer both development token cost and operating token cost during each Ring 2 review.

| Review ID | Work package | Development token cost estimate | Operating token cost estimate | Assumptions | Human disposition | Evidence |
| --------- | ------------ | ------------------------------- | ----------------------------- | ----------- | ----------------- | -------- |
| R2-BASELINE | WP-1..WP-8 | 1,310,000 input / 655,000 output | 0 operating tokens | One sequential fixture-only prototype; no runtime AI | Approved 2026-09-11; actuals start at WP-1 | `docs/Planning/tasks/ring-2-wbs.md` |
| R2-WP1 | WP-1 | 120,000 input / 60,000 output | 0 operating tokens | Provider telemetry is unavailable; no measured token actual or dollar cost is fabricated | Reviewed 2026-09-15; remaining forecast unchanged | `docs/artifacts/gate-evidence/wp-1-exit.md` |
| R2-WP2 | WP-2 | 150,000 input / 75,000 output | 0 operating tokens | Provider telemetry is unavailable; no measured token actual or dollar cost is fabricated | Reviewed 2026-09-15; remaining forecast unchanged; #71 is a WP-3 entry repair | `docs/artifacts/gate-evidence/wp-2-exit.md` |

### WP-1 Actuals Limitation

The execution surface did not expose model identity, token counts, cache accounting, or provider pricing for the completed WP-1 sessions. Actual development tokens and dollar cost are therefore unavailable. This is an explicit telemetry limitation, not a zero-token claim. Operating token actuals are zero because the implemented prototype has no runtime AI workflow. The WP-2 control estimate remains 150,000 input and 75,000 output tokens; future reviews use provider telemetry when available.

### WP-2 Actuals Limitation

The execution surface did not expose agent-active hours, model identity, token counts, cache accounting, or provider pricing for WP-2. Actual development effort, token use, dollar cost, and percentage variance are unavailable and are not fabricated. Operating token actuals remain zero because the prototype has no runtime AI workflow. REV-059 found no evidence requiring a scope, sequence, schedule, or baseline change; GitHub #71 is bounded remediation at the WP-3 entry point.

The unchanged remaining WP-3-through-WP-8 control forecast is 1,040,000 input tokens and 520,000 output tokens, with zero operating tokens.

## Ring 3 - IV&V Estimate Reconciliation

When development moves to IV&V, carry forward the original Ring 1 estimate and record the updated estimate.

| IV&V item | Original Ring 1 estimate | Updated Ring 3 estimate | Variance | Reason for variance | Human disposition | Evidence |
| --------- | ------------------------ | ----------------------- | -------- | ------------------- | ----------------- | -------- |
| | | | | | Pending | |
