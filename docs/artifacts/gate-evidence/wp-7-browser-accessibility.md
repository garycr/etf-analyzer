# WP-7 Browser Accessibility Evidence

**Date:** 2026-09-21
**Scope:** PT-ANA-A11Y-001 and PT-UI-009
**Result:** PASS; WP-7 remains active

## Executable Evidence

| Check | Result |
| --- | --- |
| Digest-pinned Chromium acceptance | 2/2 PASS, zero skipped |
| Repeated browser stability | 3 runs; 6/6 PASS, zero skipped |
| Workbench regression | 26/26 PASS, zero skipped |
| Host aggregate suite | 447 discovered; 392 passed; 0 failed; 55 PostgreSQL-environment skips |
| TypeScript build and lint | PASS |
| Editor diagnostics | Zero changed-file errors |
| Dependency audit | Zero vulnerabilities |
| Diff integrity | PASS |
| Accessibility review | REV-150 PASS; no open Critical, Major, or High findings |
| Code review | REV-151 PASS; no open Critical, Major, or High findings |
| Security and OSS review | REV-152 PASS; no open Critical, Major, or Medium findings |

## Browser Coverage

- Chromium runs from the official Playwright 1.63.0 image pinned by immutable digest.
- Axe evaluates the main application DOM against WCAG 2.0/2.1 A and AA tags for no-signal, access-denied, quarantined, and no-safe-operation analytics/evidence states.
- Keyboard-only flows add, reorder, and remove watchlist items, restore logical focus, activate the skip link, and explicitly confirm a hypothetical paper submission.
- Paper submission reloads authoritative state, restores a canonical live-region outcome, and focuses the order status after load.
- Desktop 1280x720, tablet 768x1024, and mobile 320x568 pass document and interactive-control horizontal-overflow checks.

## Dependency Review

Playwright 1.63.0/playwright-core 1.63.0 are Apache-2.0. `@axe-core/playwright` 4.13.0/axe-core 4.13.0 are MPL-2.0 and approved under Fully Agentic weak-copyleft review for unmodified test-only dynamic use. All versions are exact, lock integrity is present, lifecycle hooks are absent, and runtime dependencies are unchanged.

## Residual Boundary

PT-UI-010 retains local security, performance, and redaction gates. The 55 PostgreSQL environment skips must reach zero before WP-7 closure, and Ring 3 retains independent assistive-technology verification.
