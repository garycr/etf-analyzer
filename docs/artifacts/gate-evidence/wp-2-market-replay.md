# WP-2 Market Replay Evidence

**Date:** 2026-09-15
**Scope:** PT-FIX-001B/C five-part market identity and deterministic replay
**Result:** PASS for the reviewed increment

## Executed Behavior

The package validator derives an unambiguous canonical key from each market record's instrument ID, trading date, provider ID, adjustment policy, and revision. Repeated rows with byte-identical canonical content produce one logical observation and explicit idempotent replay counts. Reusing that identity with changed content fails with `FIXTURE_IDEMPOTENCY_CONFLICT`; a changed ingestion-job identifier cannot bypass the business-identity check.

Validation remains ordered after manifest, file-integrity, and dataset-hash checks and before later provenance errors. No database row, package file, or network resource is mutated by this increment.

## Validation

- Focused fixture package tests: 85/85 passed.
- Complete repository suite: 184 discovered, 155 passed, 29 environment-skipped, 0 failed.
- Build, lint, and editor diagnostics passed.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `git diff --check` passed.
- REV-048 records alternate-model Code Reviewer PASS after remediation and final recheck.

## Boundary

This evidence covers only in-memory PT-FIX-001B/C market replay. PT-FIX-001D..G and J..O remain open, including economic replay, temporal selection, numeric validation, quality suppression, deterministic multi-defect ordering, persistence, and provider-egress denial. This evidence does not authorize complete WP-2, legacy data migration, WP-3 overlap, release, deployment, or production action.
