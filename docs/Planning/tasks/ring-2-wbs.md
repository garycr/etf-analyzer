# Ring 2 Sequential Delivery WBS

**Plan:** `v1.0.0-prototype.1`
**Source strategy:** Workspace Owner-selected MAI-ST, constrained to one sequential Tier 1 delivery stream
**Status:** Approved by Workspace Owner on 2026-09-11; WP-1 through WP-5 complete; WP-6 active under DEC-042
**Owner:** Solo Orchestrator

This approved artifact governs one sequential Ring 2 stream. WP-1 completed on 2026-09-15 with REV-044 PASS. WP-2 completed on 2026-09-15 with REV-059 conditional PASS and issue #70 closed. WP-3 completed on 2026-09-16 with REV-094/095/096/097 PASS and #71 satisfied. WP-4 completed on 2026-09-17 with REV-098/099 PASS and REV-100 conditional PASS. WP-5 completed on 2026-09-17 with REV-101/102/103/104 PASS and DEC-041. WP-6 is active under DEC-042 and REV-105; WP-7 and WP-8 remain blocked by their declared dependencies.

## Delivery Rule

Only one work package may be in implementation at a time. Each package uses test-first development, targets `v1.0.0-prototype.1`, consumes the reviewed candidate contracts, and completes code review before the next package starts. Ring 2 may refine tasks inside a package without changing its outcome, dependencies, or contract boundary. Scope change requires impact classification and Workspace Owner disposition.

## Work Packages

| ID | Outcome | Depends on | Required Ring 2 evidence | Estimate |
| --- | --- | --- | --- | --- |
| WP-1 | Establish build, CI, local configuration, structured logging, health checks, and PostgreSQL 16 bootstrap/migration execution | None | Build/lint/test pipeline; dependency review; `CT-DB-001A/B/C/L` plus D/K foundation leaves; no product-created extension; migration and manifest hashes | XL / 20 agent-hours |
| WP-2 | Implement fixture package validation, deterministic ingestion, provenance, DQ states, and resumable fixture jobs with provider egress disabled | WP-1 | `PT-FIX-001A..O`; five-part market identity; vintage cutoff; package hash; idempotent restart; configuration and network/egress denial evidence | XL / 20 agent-hours |
| WP-3 | Implement application command/query handlers, durable job/readiness behavior, replay, stable errors, and redacted diagnostics | WP-2 | `PT-APP-001A..P`; 9-command/7-query catalog; replay and error precedence; failed-job visibility; readiness and redaction checks | XL / 20 agent-hours |
| WP-4 | Implement the loopback-only API adapter for the reviewed application boundary | WP-3 | `CT-API-001A..L`; exact 16-operation mapping; Host/Origin/body limits; status/code closure; no callbacks, webhooks, public ingress, providers, brokers, or events | L / 16 agent-hours |
| WP-5 | Implement deterministic analytics, one P0 rule/backtest, point-in-time evidence, canonical hashes, and publication guards | WP-4 | Prototype CT-ANA allocation; two-run reproducibility; configuration/result/bundle hashes; stale/quarantined/rights-denied publication blocks | XXL / 32 agent-hours |
| WP-6 | Implement the complete hypothetical paper-order lifecycle, immutable ledger, FIFO allocation, reversing correction, and exact reconciliation | WP-5 | OT-01..OT-10 and all eight states; CT-LED-001..019; confirmation gate; no brokerage path; rebuild and reconciliation checks | XXL / 32 agent-hours |
| WP-7 | Implement the local browser workbench for watchlist, jobs, evidence, analytics, paper actions, portfolio, and recovery | WP-6 | Keyboard-only workflows; WCAG 2.1 AA checks; exact research warning; non-color status; canonical value display; responsive browser checks | XL / 24 agent-hours |
| WP-8 | Integrate and harden the end-to-end local prototype, package Ring 2 evidence, and complete DP-33 architecture/gap review before IV&V | WP-7 | Clean bootstrap-to-fixture-to-analysis-to-confirmed-paper-order walkthrough; full test suite; coverage; security/dependency scans; observability evidence; Plan/Architect/Security Reviewer DP-33 findings and owner disposition; issue and traceability updates | L / 16 agent-hours |

## Scope Boundaries

- No live provider, broker, external account, real order, public ingress, durable event handoff, queue, scheduler, multi-user behavior, or production deployment is included.
- Provider assessment remains planning input; Ring 2 runtime data remains approved local fixtures with outbound provider access disabled.
- `CT-DB-002` is deferred until a populated-baseline compatibility claim exists. `CT-EVT-001` is deferred until a durable delayed handoff is proposed.
- Proposed architecture remains Proposed. This WBS does not accept an ADR, activate a baseline, or authorize production use.

Effort labels use the cost-estimation defaults as ranges: L is 8-16 hours, XL is 16-40 hours, and XXL is 40-80 hours. WP-5 and WP-6 use `XXL` as a risk label despite a 32-hour point estimate because each is a major subsystem with high-consequence integrity checks; point estimates, not labels, control arithmetic.

## Coverage Matrix

| Required planning coverage | Allocation |
| --- | --- |
| Exactly one sequential stream | WP-1 -> WP-2 -> WP-3 -> WP-4 -> WP-5 -> WP-6 -> WP-7 -> WP-8; no concurrent package |
| Reviewed contract bindings | Domain/order `1.0.0-candidate.1`; ledger, analytics evidence, fixture, application, and PostgreSQL `1.0.0-candidate.2`; OpenAPI `1.0.0-candidate.3`; inventory `1.0.0-candidate.4` |
| Present surfaces | Domain/order and ledger: WP-6; analytics evidence: WP-5; fixture input: WP-2; durable storage: WP-1; application: WP-3; API: WP-4; browser UX: WP-7; integration/operations: WP-8 |
| Controlled provider egress | WP-1 configuration foundation, WP-2 fixture-only runtime and denial evidence |
| Source-defined identity/idempotency | WP-2 five-part market identity and job replay; WP-3 command replay |
| Local secret lifecycle | WP-1 local configuration and dependency/security checks; no secret in contracts, logs, fixtures, or diagnostics |
| Immutable/redacted evidence | WP-5 immutable hash-verified evidence; WP-3 and WP-8 redaction checks |
| Bounded financial precision | WP-5 canonical analytics values; WP-6 DEC-014 ledger arithmetic and reconciliation |
| Diagnostic redaction | WP-3 allowlisted export; WP-8 security and observability verification |
| Complete order lifecycle | WP-6 implements Draft, Submitted, Accepted, Partial, Filled, Rejected, Canceled, and Expired through OT-01..OT-10; `Partial` displays as `Partially Filled` |
| P0 backtest | WP-5 implements one reproducible rule and benchmark with point-in-time inputs, cost/slippage, next-session-open timing, configuration hash, and result hash |
| Named checks | WP-1 `CT-DB-001A/B/C/L` and D/K foundation leaves; WP-2 `PT-FIX-001A..O`, H, and fixture E leaves; WP-3 `PT-APP-001A..P` plus application E and D/J/K leaves; WP-4 `CT-API-001A..L`; WP-5 prototype CT-ANA allocation, I, analytics E, and complete J; WP-6 `CT-LED-001..019`, F/G, ledger E, and complete D/E/K; WP-7 accessibility checks; WP-8 complete integrated `CT-DB-001A..L` and integrated suite |
| Explicit absences | Fixture-only; no live provider; no broker or real order; no public ingress; no outbox, queue, scheduler, or durable event; no production deployment |

## 2026-09-15 Allocation Clarification

The original WP-1 row used `CT-DB-001A..L` as shorthand for installing the complete physical schema. Issue #66 limited WP-1 execution to A-D/K/L foundation behavior and explicitly retained E-J for later owning packages. DEC-030 records the acceptance-allocation correction at leaf level: WP-1 closes complete A/B/C/L and only the foundation leaves of D/K; WP-2 through WP-6 close domain leaves when their dependencies exist; WP-8 closes the complete integrated A-L plan. A later complete-scenario check verifies composition and does not erase the earlier package evidence. This correction changes no product scope, dependency, estimate, sequence, contract, or total acceptance obligation.

## Exit Definition

WP-8 completion makes Ring 2 eligible for its own review. It does not imply Ring 3 entry, release readiness, or production authorization.
