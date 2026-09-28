# FinOps Configuration

**Date:** 2026-09-27
**Scope:** ETF Analyzer Ring 4 local candidate
**Status:** Populated for release review; production remains unauthorized

## Budget Configuration

| Scope | Daily Limit | Weekly Limit | Monthly Limit | Alert At |
| --- | ---: | ---: | ---: | ---: |
| Product runtime AI | $0 | $0 | $0 | Any nonzero use |
| External provider or brokerage spend | $0 | $0 | $0 | Any nonzero use |
| Non-production cloud deployment | $0 | $0 | $0 | Any nonzero use |
| Production cloud deployment | $0 | $0 | $0 | Any nonzero use |

The candidate has no runtime AI call, provider adapter, broker path, cloud resource, staging environment, or production deployment. Any nonzero spend requires a new approved architecture, budget extension, and applicable gate authority. DP-25 remains human-owned.

## Engineering Token Controls

| Scope | Control envelope | Actuals | Disposition |
| --- | ---: | --- | --- |
| Ring 2 development | 1,310,000 input / 655,000 output tokens | Provider telemetry unavailable | Preserve the approved control baseline; do not fabricate variance |
| Ring 3 IV&V | Included in review allowance; no separate token volume | Provider telemetry unavailable | Limitation accepted in Ring 3 evidence |
| Ring 4 release work | No approved quantitative token baseline | Provider telemetry unavailable | Estimate significant delegations before execution; stop or create an autonomous budget issue if a high-cost path exceeds $0.50 |
| Product operation | 0 tokens | 0 tokens | Hard stop on any runtime AI dependency |

## Alerts And Enforcement

- Runtime AI, external provider, brokerage, or cloud spend above $0 is a 100% budget breach and blocks further use until explicitly approved.
- Agent-work cost uses the default FinOps thresholds: low below $0.05, medium from $0.05 through $0.50, and high above $0.50.
- High-cost work requires an approval record; Fully Agentic mode must choose the cheapest viable alternative and create a GitHub issue for any budget breach.
- Provider token counts, cache accounting, and dollar actuals remain unavailable and are not estimated retroactively.
