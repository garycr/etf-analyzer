# ADR-003 - Loopback Browser Client Boundary

**Status:** Accepted by DEC-061; REV-140 PASS
**Date:** 2026-09-20
**Decision owner:** Agent under Fully Agentic mode
**Accountable custodian:** Solo Orchestrator
**Related:** DEC-059; DEC-060; PT-UI-004; GitHub #83

## Context

The dependency-free workbench is server-rendered by the existing loopback HTTP process. PT-UI-004 adds keyboard-operable watchlist mutations through the already reviewed `WatchlistGet`, `WatchlistPut`, `WatchlistRemove`, and `WatchlistReorder` operations. The browser must not construct Application envelopes, infer authoritative versions, or become a second state machine.

## Decision

Use a small external same-origin ES module as a transport and DOM adapter:

- The server renders the initial authoritative watchlist and its version.
- The browser sends only the reviewed HTTP payloads and transport identities. The HTTP adapter remains the sole Application-envelope constructor for browser-originated requests; server composition constructs only its canonical read queries.
- Every mutation carries the currently displayed authoritative version and reloads `WatchlistGet` after success or conflict. Because the accepted PostgreSQL contract reports a stale watchlist version as `APPLICATION_REQUEST_INVALID`, the watchlist client treats that owner result as a reload signal while preserving HTTP 400; transport and envelope defects remain HTTP 400 without reaching this result path.
- The DOM holds no independent business state. Reorder identities are read from the authoritative rendered order immediately before dispatch.
- Server and client render the same minimal item projection independently. Both display only owner-provided identity, name, validation state, and order; server rendering escapes HTML and client rendering uses `textContent`.
- Browser response admission checks the same required projection fields and canonical unsigned version/position syntax before rendering.
- Controls are native form/buttons, lock while a mutation is active, announce outcomes, and restore focus to the same logical action or next remaining item after authoritative rerender.
- Browser failures emit only bounded `WORKBENCH_CLIENT_DEGRADED` stage/reason data and show plain recovery guidance. Raw exceptions never enter HTML or diagnostic events.
- The exact current loopback origin is admitted in addition to configured loopback origins; Host validation and rejection of other ports remain mandatory.
- JavaScript is served as an external same-origin module under `script-src 'self'`. Existing inline CSS is retained for this slice and must be reassessed before broader dynamic UI work.

## Alternatives

- A frontend framework or DOM test dependency was rejected because the interaction surface is small and no approved dependency currently exists.
- Optimistically mutating local state from command responses was rejected because it would duplicate version and ordering authority in the browser.
- Server-side form wrappers were rejected because they would add transport routes outside the closed 16-operation API.
- Fetching an HTML fragment after every mutation was rejected because it would introduce a second server rendering route and fragment contract.

## Consequences

The browser remains a thin single-user loopback adapter and reconciles every accepted or conflicted mutation through `WatchlistGet`. Two small render implementations exist: initial server HTML and subsequent safe DOM construction. Their shared behavioral contract is executable projection, escaping, order, empty-state, control, and focus evidence rather than shared markup code.

The external module adds no package or runtime dependency. Full automated browser/axe coverage remains part of later WP-7 accessibility work; PT-UI-004 retains deterministic controller tests plus real-browser workflow evidence at desktop and mobile viewports.

## Invalidation

Revisit this ADR if the workbench gains public ingress, multiple users, durable client state, offline behavior, a frontend framework, server-sent updates, a new API operation, or a production bootstrap. Reassess the dual-render contract if another interactive collection is added.

## Decision Boundary

This ADR authorizes only the local watchlist browser adapter inside WP-7. It does not authorize new Application operations, brokerage, public ingress, external providers, deployment, production use, WP-8, or Ring 3 advancement.
