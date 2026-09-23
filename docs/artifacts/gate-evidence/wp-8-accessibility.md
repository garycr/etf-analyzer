# WP-8 PT-A11Y-002 Accessibility Evidence

**Date:** 2026-09-23
**Scope:** PT-A11Y-002 retained workflow accessibility only
**Status:** Accepted under DEC-084, REV-190, and REV-191

## Digest-Pinned Execution

The canonical browser suite executed in the official Playwright image pinned to:

`mcr.microsoft.com/playwright@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`

Command:

`docker run --rm --ipc=host -v "$PWD:/work" -w /work <pinned-image> npm run test:browser`

Final result: 2 passed, zero failed, zero skipped in 5,055.176297 ms. The two parents were PT-ANA-A11Y-001 and PT-A11Y-002. The disposable container was removed.

## Viewport Evidence

PT-A11Y-002 creates a fresh browser context and resets authoritative state for each required viewport:

| Viewport | Axe WCAG 2.0/2.1 A/AA | Keyboard and focus | Reflow and bounds |
| --- | --- | --- | --- |
| 1280x720 | PASS, full document | PASS | PASS |
| 768x1024 | PASS, full document | PASS | PASS |
| 320x568 | PASS, full document | PASS | PASS |

At every viewport, keyboard-only Tab traversal reaches and activates the skip link, watchlist inputs, add/update, reorder, remove, and paper-order submission controls. Assertions verify each focused control's accessible name, logical focus restoration after reorder/remove, one confirmed submission, and post-reload focus on an authoritative Submitted status.

The Submitted projection is version 5 with an OT-02 Draft-to-Submitted history entry. The restored target exposes exact Submitted state and text, a measurable 3px visible focus outline, and an in-viewport position. Browser API evidence verifies `focus({ preventScroll: true })` followed on the next animation frame by `scrollIntoView({ block: "center" })`.

Full-document axe scans return zero violations. Document width and every interactive control remain within each viewport's horizontal bounds.

## Validation And Review

- TypeScript build in the pinned image: PASS.
- Editor diagnostics for all changed code and tests: zero errors.
- Diff integrity: PASS.
- Initial Accessibility Review: FAIL on desktop-only keyboard/focus, injected test focus, invisible restored focus, stale skip pattern, partial axe scope, and incomplete reflow evidence.
- Remediation added complete natural-Tab workflows at every viewport, full-document axe, visible centered focus recovery, and corrected test selection.
- Follow-up Accessibility Review: FAIL on contradictory Draft presentation in the simulated Submitted projection.
- Final Accessibility Review REV-190: PASS after canonical Submitted presentation and exact focused-state assertions.
- Initial Code Review: FAIL on incomplete authoritative Submitted projection and missing direct focus/scroll option evidence; its zero-skip concern was disproved by the actual Node summary.
- Final Code Review REV-191: PASS after version 5, OT-02 history, and direct API-option assertions; final runner summary remained 2 passed, zero failed, zero skipped.

## Boundary

This evidence supports PT-A11Y-002 only. It does not close WP-8, DP-33, Ring 2, release, deployment, or production. It adds no endpoint, service, dependency, migration, public ingress, provider, broker, queue, or durable handoff. Greenfield PostgreSQL remains the only persistence target; no SQL Server migration or conversion is authorized. REV-164 and the original CT-DB-001K evidence remain invalidated history.
