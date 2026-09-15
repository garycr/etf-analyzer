# WP-2 Economic Replay Evidence

**Date:** 2026-09-15
**Scope:** PT-FIX-001J economic replay, identity conflict, and release-instant uniqueness
**Result:** PASS for the reviewed increment

## Executed Behavior

The package validator derives an unambiguous canonical key from each economic record's provider ID, series ID, observation date, release timestamp, and vintage ID. Repeated rows with byte-identical canonical content produce one logical vintage and explicit idempotent replay counts. Reusing that identity with changed content fails with `FIXTURE_IDEMPOTENCY_CONFLICT`; a changed ingestion-job identifier cannot bypass the full-identity check.

After all identity conflicts have been evaluated, a separate pass rejects different vintage IDs at one provider, series, observation date, and release instant with `FIXTURE_TEMPORAL_INVALID`. This two-pass ordering makes idempotency precedence independent of JSONL record order. No database row, package file, or network resource is mutated by this increment.

## Validation

- Focused fixture package tests: 90/90 passed.
- Complete repository suite: 189 discovered, 160 passed, 29 environment-skipped, 0 failed.
- Build, lint, and editor diagnostics passed.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `git diff --check` passed.
- REV-049 records alternate-model Code Reviewer PASS after remediation and final recheck.

## Boundary

This evidence covers only in-memory PT-FIX-001J economic replay and release-instant uniqueness. PT-FIX-001D..G and K..O remain open, including timestamp grammar, point-in-time selection, numeric validation, quality suppression, complete deterministic multi-defect ordering, persistence, and provider-egress denial. This evidence does not authorize complete WP-2, legacy data migration, WP-3 overlap, release, deployment, or production action.
