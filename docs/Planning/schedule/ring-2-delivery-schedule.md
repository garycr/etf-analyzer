# Ring 2 Sequential Delivery Schedule

**Plan:** `v1.0.0-prototype.1`
**WBS:** `docs/Planning/tasks/ring-2-wbs.md`
**Status:** Approved by Workspace Owner on 2026-09-11; clock starts when WP-1 implementation begins
**Scheduling basis:** One Tier 1 stream at 12 productive agent-hours per week, including test and review correction time

## Milestones

| Milestone | Work package | Planned window after Ring 2 authorization | Exit evidence |
| --- | --- | --- | --- |
| M1 - Executable foundation | WP-1 | Weeks 1-2 | CI green; PostgreSQL bootstrap and empty migration checks pass |
| M2 - Fixture truth | WP-2 | Weeks 3-4 | Fixture conformance and provider-egress denial evidence pass |
| M3 - Application boundary | WP-3 | Weeks 5-6 | Application behavior, replay, jobs, readiness, and redaction pass |
| M4 - Loopback API | WP-4 | Week 7 | OpenAPI adapter conformance passes without public or event scope |
| M5 - Deterministic analytics | WP-5 | Weeks 8-10 | Reproducible P0 backtest and evidence/publication guards pass |
| M6 - Paper order and ledger | WP-6 | Weeks 11-13 | Eight-state lifecycle, immutable FIFO ledger, and reconciliation pass |
| M7 - Accessible workbench | WP-7 | Weeks 14-15 | Keyboard, warning, non-color, canonical display, and responsive checks pass |
| M8 - Integrated evidence | WP-8 | Week 16 | Clean greenfield PostgreSQL deployment-candidate walkthrough, Ring 2 evidence package, and DP-33 architecture/gap review and owner disposition complete before IV&V; no SQL Server or data-migration cutover evidence required |

## Critical Path and Controls

The critical path is M1 -> M2 -> M3 -> M4 -> M5 -> M6 -> M7 -> M8. No planned package overlaps another. A package starts only after its predecessor's tests and code review pass.

- Schedule baseline: 16 elapsed weeks after explicit Ring 2 authorization.
- Each package is rounded up to a whole calendar-week window; unused capacity is review/recovery reserve and cannot start the next package early without rebaselining. This produces 16 weeks from 180 point-estimate hours at 12 productive hours per week.
- Estimate confidence: Low-to-medium until WP-1 establishes the executable toolchain.
- Contingency: 20% cost contingency is held in the cost baseline; schedule reserve is included in the 12 productive-hour weekly assumption.
- Reforecast trigger: forecast variance above 15% is presented to the Workspace Owner; scope or schedule variance above 25% requires explicit disposition before continuing.
- DEC-023 authorizes Ring 2 to begin at WP-1 only. The clock remains stopped until WP-1 starts; dependency installation is limited to reviewed WP-1 needs, and no baseline activation, parallel package, architecture acceptance, release, deployment, or production action is authorized.
