# WP-2 Selection-Before-Quality Evidence

**Date:** 2026-09-15
**Scope:** PT-FIX-001K market and economic selection-before-quality with no fallback
**Result:** PASS; approved for bounded publication

## Executed Behavior

The market vectors provide an older eligible Valid revision and a newer eligible `Partial`, `Stale`, or `Quarantined` revision for the same business selection key. The economic vectors provide equivalent older Valid and newer non-Valid vintages. In every case, the newer record is eligible at the evaluation instant and selection fails with the matching `FIXTURE_REQUIRED_PARTIAL`, `FIXTURE_REQUIRED_STALE`, or `FIXTURE_REQUIRED_QUARANTINED` code. No case falls back to the older Valid record.

These six vectors isolate PT-FIX-001K from future-record exclusion: both competing records are temporally eligible. Their distinct revisions or release identities also avoid replay and temporal conflicts that could mask the quality-selection assertion.

## Validation

- Focused PT-FIX-001K suite: 6 discovered, 6 passed, 0 failed, 0 skipped.
- Complete repository suite: 277 discovered, 247 passed, 30 environment-skipped, 0 failed.
- TypeScript build and lint passed.
- Editor diagnostics reported no changed-file errors.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `git diff --check` passed.
- REV-055 final alternate-model Code Reviewer recheck returned PASS with no Critical, Major, or open Minor finding.
- Test-quality weighted composite: 4.79/5.0, Excellent.

## Boundary

This evidence does not claim PT-FIX-001N deterministic multi-defect collection and ordering, PT-FIX-001O provider-egress denial, `FIXTURE_UNDECLARED_INPUT`, complete WP-2, legacy migration, release, deployment, or production action.
