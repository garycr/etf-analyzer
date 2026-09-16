# WP-2 Deterministic Error Ordering Evidence

**Date:** 2026-09-15
**Scope:** PT-FIX-001N aggregate fixture diagnostics and total ordering
**Result:** PASS; approved for bounded publication

## Executed Behavior

A cross-family package combines manifest, file-integrity, temporal, provenance, undeclared-input, and selected-quality defects. Its controlling code remains `FIXTURE_MANIFEST_INVALID`; its complete safely detectable issue batch follows contract precedence. Shared raw-source tampering reports each affected record-level provenance failure.

Same-code malformed market records prove absent, invalid, and valid identity-component ordering. Two invalid raw values prove UTF-8 byte-length-prefixed ordering, and reversing record discovery produces an identical issue sequence. The issue batch, issue records, component arrays, individual components, and relative paths are immutable.

Reviewer-directed vectors prove record-count mismatch attribution to its fixture path, record-type-specific provider grammar, and suppression of derived required-input diagnostics when the evaluation instant is malformed. Diagnostic collection failures cannot mask the original controlling error.

## Validation

- Initial test-first check: 2 discovered, 0 passed, 2 failed because `issues` was absent.
- Final focused PT-FIX-001N suite: 5 discovered, 5 passed, 0 failed, 0 skipped.
- Complete repository suite: 291 discovered, 261 passed, 30 environment-skipped, 0 failed.
- TypeScript build and lint passed.
- Editor diagnostics reported no changed-file errors.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `git diff --check` passed.
- REV-057 final alternate-model Code Reviewer recheck returned PASS with no open findings.
- Test-quality weighted composite: 4.89/5.0, Excellent.

## Boundary

This evidence does not claim PT-FIX-001O provider-egress denial, complete WP-2, the pre-existing primary-validator `seriesId`/`vintageId` grammar gap, legacy migration, release, deployment, or production action.
