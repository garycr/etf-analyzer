# WP-8 Integration And Ring 2 Evidence Implementation Plan

**Date:** 2026-09-21
**Status:** Active under DEC-069; REV-157 Plan PASS; REV-158 Architecture PASS
**Estimate:** L / 16 agent-hours
**Tracking:** GitHub issue #84

## Outcome

Integrate and harden the complete local fixture-only prototype, prove one clean bootstrap-to-reconciled-paper-portfolio workflow, close integrated `CT-DB-001A..L`, package Ring 2 evidence, and complete DP-33 gap review and Workspace Owner disposition before Ring 3.

## Ownership And Boundaries

- Existing Domain, Application, PostgreSQL, HTTP, and Web owners remain authoritative; WP-8 adds no second state machine or operation.
- The first slice closes the two REV-100 API hardening Minors in `src/Infrastructure/Http/api-adapter.ts` without changing the closed 16-operation API.
- Integration evidence composes approved local fixtures only. Provider egress remains disabled.
- No new runtime package, service, route, API operation, migration, or durable handoff is permitted. Any exception requires OSS/dependency review, architecture impact review, and effort reforecast before implementation.
- WP-8 does not authorize a baseline, live provider, broker, external account, public ingress, event, queue, scheduler, worker, release, deployment, production use, or Ring 3 entry.

## Test-First Sequence

1. **API hardening red-green:** add failing `CT-API-001M/N`; implement only explicit request bounds and plain-record admission; rerun focused adapter tests before proceeding.
2. **Integrated persistence red-green:** bind each `CT-DB-001A..L` scenario to the integrated PostgreSQL test; run it to expose missing cross-owner composition; repair one owning boundary at a time and rerun the focused scenario after every edit.
3. **Vertical walkthrough red-green:** add failing `PT-E2E-001`; compose the existing bootstrap, fixture, analytics, paper-order, and ledger owners; rerun the walkthrough after each integration repair.
4. **Operations red-green:** add exact readiness/recovery, diagnostic-redaction, and Golden Signals assertions before any observability change; rerun focused operations checks after each edit.
5. **Aggregate quality:** run PostgreSQL and browser zero-skip suites, built-in coverage, all-route coverage, accessibility, audit, secret/SAST scans, and immutable evidence.
6. **Ring 2 controls:** execute review-hardening, reasoning-ledger validation, lessons learned and severity reconciliation, Document Manager artifact compliance, and final full-scope DP-33 Plan/Architecture/Security review. Create one issue per Minor+ gap and stop for Workspace Owner disposition.
7. **Final pre-exit action:** after every remediation and approval, invoke Plaid CL Analyze Recent Sessions and journal it last. Any later non-GATE work requires rerunning Plaid.

## First Discriminating Slice

Hypothesis: the existing adapter admits canonical requests correctly but leaves slow local uploads bounded only by external process behavior and accepts top-level body shape through incidental object spread semantics. Explicit server timeouts and a plain-record guard will close both REV-100 Minors without changing valid request envelopes.

1. Add a failing unit test proving body operations reject `null`, arrays, and primitive top-level JSON before dispatch through an explicit record boundary.
2. Add a failing integration test proving a partial request body cannot remain open beyond the configured request timeout and never dispatches.
3. Add validated positive controls for canonical command bodies and normal loopback requests.
4. Implement the smallest adapter/config changes and rerun the focused tests immediately.

### Request Timeout Contract

- `ApiAdapterConfig.requestTimeoutMs` is measured in integer milliseconds, defaults to `5_000`, and must be within `100..30_000`; invalid values fail startup before listening.
- The adapter applies the same bound to Node request, header, and inactive socket handling so no slower implicit listener limit controls the local request.
- An incomplete request that exceeds the bound receives the fixed redacted JSON `408 Request Timeout` when headers permit a response, otherwise the socket closes. It never dispatches an Application operation.
- The adapter emits only `{ code: "API_REQUEST_TIMEOUT", stage: "RequestBody", reason: "DeadlineExceeded" }` through an optional injected audit callback. It emits no URL, headers, body bytes, identifiers, or exception text.
- `CT-API-001M` uses a short valid test timeout and synchronization on server acceptance; it must not rely on scheduler timing alone.

## Acceptance Traceability

| Acceptance ID | Exact test title | Path / evidence | Pass criterion |
| --- | --- | --- | --- |
| CT-API-001M | `CT-API-001M bounds incomplete local uploads without dispatch` | `tests/Integration/api-adapter.test.mjs` | Timeout closes partial request; zero dispatch |
| CT-API-001N | `CT-API-001N explicitly rejects non-record top-level payloads` | `tests/Unit/api-adapter.test.mjs` | Null, arrays, and primitives reject; canonical record passes |
| CT-DB-001A | `CT-DB-001A an empty database reaches the exact candidate schema` | `tests/Integration/wp-8-contract-conformance.test.mjs` | Exact closed schema from empty bootstrap |
| CT-DB-001B | `CT-DB-001B migration replay is deterministic and drift fails closed` | Same | Replay stable; all declared drift controls readiness |
| CT-DB-001C | `CT-DB-001C a failed migration leaves no partial candidate state` | Same | Six migration rollback boundaries pass |
| CT-DB-001D | `CT-DB-001D roles and controlled operations enforce least privilege` | Same | Closed role matrix, denials, audits, and bounded readers pass |
| CT-DB-001E | `CT-DB-001E exact values reject noncanonical input before PostgreSQL cast` | Same | All six owner/numeric vectors pass without mutation |
| CT-DB-001F | `CT-DB-001F paper-order state replay and history are atomic` | Same | Three failure vectors and successful visibility are atomic |
| CT-DB-001G | `CT-DB-001G ledger evidence is immutable anchored and projection-safe` | Same | Four failure vectors, immutability, anchor, and projection checks pass |
| CT-DB-001H | `CT-DB-001H fixture identity and provenance constraints reject ambiguity` | Same | Five fixture failure vectors roll back exactly |
| CT-DB-001I | `CT-DB-001I analytics evidence publishes only complete verified bundles` | Same | Six publication failure vectors preserve prior state |
| CT-DB-001J | `CT-DB-001J job state and checkpoints resume without duplicate effects` | Same | Six restart vectors preserve exact effects and replay |
| CT-DB-001K | `CT-DB-001K readiness reflects connectivity migration and security state` | Same | Seven readiness conditions return exact state/error |
| CT-DB-001L | `CT-DB-001L the prototype schema contains no durable handoff` | Same | No durable handoff object; CT-DB-002 remains guard-triggered |
| PT-E2E-001 | `PT-E2E-001 completes fixture analysis confirmed paper order and reconciliation through reviewed HTTP operations` | `tests/Integration/prototype-workflow.test.mjs` | Enter through loopback HTTP and exact envelopes for FixtureIngestionStart, AnalyticsRun, PaperOrderDraftCreate, PaperOrderTransition, and PortfolioGet; direct SQL only for bootstrap/fault injection/postcondition inspection; no unreviewed route or bypass |
| PT-OPS-001 | `PT-OPS-001 exposes readiness recovery redaction and Golden Signals evidence` | `tests/Integration/prototype-operations.test.mjs`; `docs/artifacts/gate-evidence/wp-8-observability.md` | API p95 <1s; dashboard <2s; exact workflow counts/no duplicate submissions; zero unexpected 5xx, hash mismatch, reconciliation difference, or unresolved intent; structural absence of queue/outbox; evidence capacity <80%; DB connections below configured maximum; failures redacted and recoverable |
| PT-COVERAGE-001 | `PT-COVERAGE-001 meets business logic and public endpoint coverage gates` | Node `--experimental-test-coverage`; `docs/Quality/wp-8-coverage.md` | Domain/Application lines >=80%; all 16 routes tested |
| PT-A11Y-002 | `PT-A11Y-002 retains WP-8 workflow accessibility` | Digest-pinned browser suite; `docs/artifacts/gate-evidence/wp-8-accessibility.md` | Axe/keyboard/focus/reflow pass at 1280x720, 768x1024, and 320x568 with zero skips |
| PT-SEC-001 | `PT-SEC-001 passes dependency secret SAST and redaction gates` | `docs/artifacts/gate-evidence/wp-8-security.md` | Zero Critical/High vulnerabilities; every Medium explicitly dispositioned; zero CI secret/SAST pattern matches; lockfile/dependency diff and license review pass; redaction pass |
| DP-33 | Final full-scope model update and gap disposition | `docs/Architecture/`; `docs/Planning/wp-8-dp-33-gap-analysis.md`; GitHub issues | Three reviewers complete; no Critical; owner disposes every gap |

## Effort Budget

| Task | Hours |
| --- | ---: |
| REV-100 API hardening and reviews | 2.0 |
| Bind/reconcile integrated CT-DB-001A..L using existing leaf fixtures | 3.5 |
| PT-E2E-001 vertical walkthrough | 2.5 |
| Operations and Golden Signals evidence | 1.5 |
| Aggregate PostgreSQL/browser/coverage/security evidence | 1.5 |
| Review-hardening and artifact compliance | 1.5 |
| Reasoning, lessons learned, severity reconciliation | 1.0 |
| DP-33 triple review, issues, and owner packet | 2.0 |
| Final Plaid analysis and publication | 0.5 |
| **Total** | **16.0** |

Existing WP-1..7 implementation and zero-skip fixtures are reused; this budget covers integration bindings, missing hardening, evidence, and review rather than reimplementation. If any new Domain/Application behavior, migration change, Critical/Major architecture remediation, or more than two hours of unplanned repair is required, stop and reforecast through governance before reducing scope or quality.

## Ring 2 Exit Controls

| Control | Owner | Artifact / acceptance |
| --- | --- | --- |
| Review-hardening campaign | Solo Orchestrator + specialist reviewers | `docs/Quality/ring-2-review-hardening.md`; all phases run, no open Critical/Major |
| Reasoning-ledger validation | Solo Orchestrator | `docs/Governance/reasoning/reasoning-ledger.md`; assumptions validated, invalidated entries addressed |
| Lessons learned | Solo Orchestrator | `docs/Quality/lessons-learned-ring-2.md`; remediation owners assigned |
| Severity reconciliation | Solo Orchestrator | `docs/Quality/severity-bar-etf-analyzer.md`; no Sev 1, every Sev 2 assigned |
| Artifact compliance | Document Manager | `docs/Quality/ring-2-artifact-compliance.md`; no Critical missing artifact |
| DP-33 | Plan, Architect, Security reviewers + Workspace Owner | Updated architecture, gap report/issues, explicit owner disposition |
| Plaid session analysis | Solo Orchestrator | Final Ring 2 journal WORK entry records successful full-window analysis; no later non-GATE entry |

## Exit Criteria

- Both REV-100 Minors close with executable tests and independent code/security review.
- Complete integrated `CT-DB-001A..L` and `PT-E2E-001` pass against pinned PostgreSQL 16.15.
- Host and browser suites pass with zero skips; build, lint, diagnostics, dependency/security scans, and evidence hashes pass.
- `PT-OPS-001` enforces the canonical local prototype thresholds: non-analytical API p95 below 1 second and dashboard first meaningful content below 2 seconds; exact expected workflow request/job/row/run counts with no duplicate submission; zero unexpected 5xx, retry exhaustion, hash mismatch, non-zero reconciliation difference, or unresolved intent; structural absence of queue/outbox; evidence storage below the approved 80% alert and PostgreSQL connections below configured maximum. CPU and memory are recorded because no approved threshold exists; exceeding a future threshold requires a governed decision rather than an invented gate.
- `PT-A11Y-002` passes axe, keyboard, focus, and reflow at 1280x720, 768x1024, and 320x568 with zero skips. `PT-SEC-001` permits zero Critical/High vulnerabilities, requires explicit Medium disposition, and requires zero CI secret/SAST pattern matches plus lockfile/dependency and license evidence.
- DP-33 updates architecture views to distinguish implemented structural absence of durable handoff from runtime saturation metrics and to describe the actual local composition.
- Node built-in coverage reports at least 80% line coverage for Domain/Application business logic, and executable route evidence covers all 16 public API operations.
- DP-33 has no open Critical gap; every Major has an approved remediation completed before Ring 3; every Minor+ has a GitHub issue and Workspace Owner disposition.
- Review-hardening, reasoning validation, Ring 2 lessons, severity bar, and artifact compliance pass.
- WP-8 and Ring 2 exit evidence is committed and pushed before any Ring 3 transition.
