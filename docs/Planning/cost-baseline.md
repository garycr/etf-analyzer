# Project Cost Baseline

> Effort-based and token-based cost estimate produced during Ring 1 from WBS work packages.
> See `.github/skills/cost-estimation.md`, `.github/skills/finops.md`, and `docs/Planning/token-review-baseline.md`.
> Approved by human at DP-7 before Ring 1 → Ring 2 gate.

**Project:** ETF Analyzer
**Version:** 1.0-candidate.1
**Date:** 2026-09-11
**Approved By:** Workspace Owner at Ring 1 exit gate

## Summary

| Metric | Value |
|--------|-------|
| Agent implementation hours | 180 |
| Human review hours | 22 |
| Total estimated hours | 202 |
| Estimated human labor cost | $3,890 |
| Contingency | 20% / $778 |
| Total with contingency | $4,668 |
| Development token estimate | 1,310,000 input / 655,000 output tokens |
| Operating token estimate | 0; the prototype has no runtime AI dependency |
| AI dollar budget | Unavailable until execution model/provider pricing is selected; token volumes remain the control baseline |

## Ring 1 Human Review Attachments

| Artifact | Estimate Attached | Human Disposition | Saved Artifact Link |
| -------- | ----------------- | ----------------- | ------------------- |
| Architecture / ADR | Yes | Approved as Proposed planning input; no ADR accepted | `docs/Architecture/` |
| WBS / work packages | Yes | Approved | `docs/Planning/tasks/ring-2-wbs.md` |
| IMS / schedule baseline | Yes | Approved | `docs/Planning/schedule/ring-2-delivery-schedule.md` |

## Work Package Cost Breakdown

| WP # | Work Package | Ring | Effort | Hours | Rate | Labor cost | Owner |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| WP-1 | Foundation and PostgreSQL | Ring 2 | XL | 20 | $0 | $0 | AI agent |
| WP-2 | Fixture ingestion | Ring 2 | XL | 20 | $0 | $0 | AI agent |
| WP-3 | Application boundary | Ring 2 | XL | 20 | $0 | $0 | AI agent |
| WP-4 | Loopback API | Ring 2 | L | 16 | $0 | $0 | AI agent |
| WP-5 | Analytics and evidence | Ring 2 | XXL | 32 | $0 | $0 | AI agent |
| WP-6 | Paper order and ledger | Ring 2 | XXL | 32 | $0 | $0 | AI agent |
| WP-7 | Accessible workbench | Ring 2 | XL | 24 | $0 | $0 | AI agent |
| WP-8 | Integration and evidence | Ring 2 | L | 16 | $0 | $0 | AI agent |
| Review | Ring 2 code/security review | Ring 2 | L | 10 | $175 | $1,750 | Human reviewer |
| Gate | Ring 2 gate review | Ring 2 | S | 2 | $185 | $370 | Workspace Owner |
| IVV | Independent verification | Ring 3 | L | 8 | $175 | $1,400 | Human reviewer |
| Gate | Ring 3 gate review | Ring 3 | S | 2 | $185 | $370 | Workspace Owner |
| | **Total** | | | **202** | | **$3,890** | |
| | **Total with 20% contingency** | | | | | **$4,668** | |

## Assumptions

1. Tier 1 agent labor is costed at $0; only human review time is monetized.
2. The schedule uses one sequential stream and 12 productive agent-hours per week.
3. Estimates include tests and local correction but exclude production deployment and live-provider integration.
4. AI dollar cost is intentionally not fabricated without a selected execution model and current provider prices.
5. Variance is reviewed at each ring gate; variance above 25% requires explicit scope or baseline disposition.

## Human Decision

**Status:** Approved
**Decision:** Accept the simplified Tier 1 baseline and 20% contingency; reforecast after WP-1
**Decision date:** 2026-09-11T19:36:59Z

## WP-1 Reforecast

**Review date:** 2026-09-15
**Disposition:** No baseline change

| Measure | WP-1 baseline | Measured actual | Variance | Disposition |
| --- | ---: | ---: | ---: | --- |
| Agent implementation effort | 20 hours | Unavailable | Not computable | Tier 1 execution did not instrument agent-active hours; no value is fabricated |
| Agent labor cost | $0 | $0 | $0 | Tier 1 AI-agent labor rate remains $0 |
| Human review effort | Included in 10-hour Ring 2 review allowance | Unavailable | Not computable | Human reviewer time was not instrumented |
| Operating AI cost | $0 | $0 | $0 | The prototype has no runtime AI dependency |

WP-1 implementation has delivered the planned foundation and PostgreSQL outcome; formal package closure remains pending final independent disposition. DEC-030 corrects package acceptance allocation at leaf level while retaining complete integrated `CT-DB-001A..L` closure in WP-8; impact review found no added work, removed obligation, changed dependency, or schedule effect. The remaining implementation forecast stays at 160 agent hours across WP-2 through WP-8, and the approved project totals remain 202 hours, $3,890 human labor, and $4,668 with contingency. Because actual effort telemetry is unavailable, no percentage variance is asserted and the 15%/25% variance triggers cannot be evaluated retrospectively. WP-2 must capture elapsed or active effort if quantified variance is required at its exit.
