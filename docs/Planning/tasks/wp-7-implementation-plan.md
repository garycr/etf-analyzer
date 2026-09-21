# WP-7 Local Browser Workbench Implementation Plan

**Date:** 2026-09-19
**Status:** Active under DEC-059; PT-UI-001..004 accepted; implementation plan REV-136 PASS
**Estimate:** XL / 24 agent-hours
**Tracking:** GitHub issue #83

## Ownership

- `src/Infrastructure/Web/` owns browser rendering, semantic structure, responsive layout, keyboard interaction, focus, and accessible presentation of Application-owned values.
- `src/Application/application-boundary.ts` remains the authority for operation names, result states, canonical values, recovery metadata, and the exact research warning.
- `src/Infrastructure/Http/api-adapter.ts` serves the same-origin workbench from the existing loopback-only server and retains the reviewed 16-operation API unchanged.
- Domain, analytics, order, ledger, and PostgreSQL owners remain authoritative. The browser never infers success, changes canonical values, or creates a second state machine.

## First Discriminating Slice

Hypothesis: a semantic browser shell can be served from the existing loopback process without a frontend dependency, a second runtime, or any change to the reviewed API operation set.

1. Add a failing semantic-shell test for landmarks, navigation, exact warnings, readiness text, and keyboard focus order.
2. Render the shell from one TypeScript module using native HTML semantics and responsive CSS.
3. Add a failing loopback integration test for `GET /` with a realistic browser `Accept` header and no Application dispatch.
4. Serve the shell with fixed security headers while preserving all `/api/v1/*` behavior.
5. Verify desktop and mobile layout, visible keyboard focus, no overflow, aggregate tests, dependency audit, and independent review.

## Test-First Sequence

1. Shell and local serving: `PT-UI-001..002`.
2. Readiness and jobs: authoritative readiness query, non-color blocked state, announcements, and bounded recovery.
3. Watchlist: list, add/remove/reorder, validation, version conflict, and keyboard parity.
4. Analytics and evidence: exact warning, canonical values, blocked publication states, evidence authorization, hash identity, and carried `PT-ANA-A11Y-001` blocked-state coverage.
5. Paper actions and portfolio: all eight order states, explicit confirmation, announced errors, canonical financial values, and integrity blocking.
6. Aggregate accessibility, responsive browser, performance, security, diagnostics, and package-exit evidence.

## Exact First-Slice Traceability

| Acceptance ID | Exact test title | Path | Status |
| --- | --- | --- | --- |
| PT-UI-001 | `PT-UI-001 renders an accessible research workbench shell` | `tests/Unit/workbench.test.mjs` | PASS |
| PT-UI-001 | `PT-UI-001 renders explicit NotReady status and rejects unknown state` | `tests/Unit/workbench.test.mjs` | PASS |
| PT-UI-002 | `PT-UI-002 serves the workbench at the loopback root without application dispatch` | `tests/Integration/api-adapter.test.mjs` | PASS |

## Pending Acceptance Traceability

| Acceptance ID | Intended test title | Path | Status |
| --- | --- | --- | --- |
| PT-UI-003A | `PT-UI-003A presents authoritative readiness jobs and bounded recovery` | `tests/Unit/workbench.test.mjs` | PASS |
| PT-UI-003B | `PT-UI-003B wires authoritative readiness and jobs through the browser composition root` | `tests/Integration/workbench.test.mjs` | PASS |
| PT-UI-004 | `PT-UI-004 performs watchlist workflows with keyboard and version safety` | `tests/Unit/workbench-client.test.mjs`; `tests/Integration/workbench.test.mjs` | PASS |
| PT-UI-005 | `PT-UI-005 preserves analytical and evidence warnings values and blocked states` | `tests/Integration/workbench.test.mjs` | PASS |
| PT-ANA-A11Y-001 | `PT-ANA-A11Y-001 exposes blocked denied quarantined and no-signal analytics accessibly` | `tests/Integration/workbench-accessibility.test.mjs` | PENDING |
| PT-UI-006 | `PT-UI-006 requires explicit paper confirmation and presents all eight order states` | `tests/Integration/workbench.test.mjs` | PASS |
| PT-UI-007 | `PT-UI-007 presents canonical reconciled portfolio values and integrity blocking` | `tests/Integration/workbench.test.mjs` | PENDING |
| PT-UI-008 | `PT-UI-008 announces invalid transitions conflicts and recovery outcomes` | `tests/Integration/workbench-accessibility.test.mjs` | PENDING |
| PT-UI-009 | `PT-UI-009 completes keyboard workflows without overflow at required viewports` | `tests/Integration/workbench-accessibility.test.mjs` | PENDING |
| PT-UI-010 | `PT-UI-010 meets local security performance and redaction gates` | `tests/Integration/workbench.test.mjs` | PENDING |

## Effort Allocation

| Slice | Agent-hours |
| --- | ---: |
| Shell and loopback serving | 3 |
| Readiness and jobs | 4 |
| Watchlist workflows | 4 |
| Analytics and evidence | 4 |
| Paper actions and portfolio | 5 |
| Aggregate accessibility, security, and exit | 4 |
| **Total** | **24** |

## Risks and Assumptions

| Risk or assumption | Mitigation |
| --- | --- |
| A static `Ready` shell could be mistaken for authoritative readiness. | PT-UI-003B adds the authoritative provider callback and fail-closed `NotReady` behavior before any command control is enabled. |
| No list-jobs query or production bootstrap exists in the approved boundary. | Keep known-job IDs injected and provisional; require a bounded duplicate-free supplier when a bootstrap is authorized. |
| Canonical financial or owner-state values could drift in rendering. | Render admitted Application projections without numeric conversion or state inference; assert exact visible and accessible strings. |
| Dynamic behavior could weaken the inline-style CSP accepted by REV-135. | Reassess CSP before introducing script or dynamic style; prefer an external same-origin stylesheet and nonce/hash-bound scripts. |
| PostgreSQL-gated behavior may be unavailable in a generic test environment. | Preserve environment skips during development but require a PostgreSQL 16 zero-skip run for WP-7 closure. |
| Keyboard semantics may regress as controls are added. | PT-UI-004 covers pure mutation, ordering, and logical focus behavior. PT-UI-009 retains real-DOM event wiring, keyboard traversal, focus restoration, live-region, axe, and viewport automation after dependency review. |
| The reviewed API surface is closed. | Later slices consume the existing nine commands and seven queries; no new API operation is introduced by WP-7. |

## Open Work

- Implement the interactive operation workflows and their loading, empty, success, blocked, conflict, and recovery states.
- Execute `PT-ANA-A11Y-001` for blocked, denied, quarantined, and no-signal analytics states.
- Complete Playwright plus `@axe-core/playwright` automated WCAG 2.1 AA checks after OSS review, covering semantic relationships, keyboard/focus order, names/roles/values, contrast, status announcements, reflow, and error identification; Ring 3 retains independent accessibility verification.
- Run the PostgreSQL-gated suite with zero skips before WP-7 closure.

## WP-7 Exit Criteria

- PT-UI-001..010 and PT-ANA-A11Y-001 pass with no skipped UI checks.
- Every changed public workflow has executable success, empty, blocked/error, keyboard, and recovery coverage; changed business logic meets at least 80% coverage.
- Desktop 1280x720 and representative tablet/mobile viewports pass reflow, overflow, focus, and interaction checks.
- Build, lint, zero-skip PostgreSQL suite, dependency/license audit, security headers, redaction, and performance checks pass.
- Independent code, security, accessibility, and closure-plan reviews have no open Critical or Major findings.
- WP-7 exit evidence is committed and pushed before WP-8 becomes eligible.

## Boundaries

WP-7 does not authorize brokerage, real execution, external accounts, live providers, public ingress, durable events, queues, schedulers, workers, WP-8 integration, baseline activation, release, deployment, or production use.
