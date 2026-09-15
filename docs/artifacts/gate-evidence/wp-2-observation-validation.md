# WP-2 Observation Validation Evidence

**Date:** 2026-09-15
**Scope:** Closed observation schemas and PT-FIX-001L/M revision and numeric-class pairing
**Result:** PASS for the reviewed increment

## Executed Behavior

Both governed JSONL record families enforce their exact contract member sets. Structural errors control over dataset hash or immutable-version conflicts but remain subordinate to file byte, digest, and record-count integrity. Missing provenance members flow to the dedicated provenance error rather than being misclassified as structural errors.

Market revisions reject leading zeroes, signs, decimals, and empty values with `FIXTURE_TEMPORAL_INVALID`. Numeric classes are restricted to `UnitPrice`, `Quantity`, `Money`, and `Rate` across both families. Market currency pairing requires `USD` for `UnitPrice` and `Money` and an empty string for `Quantity` and `Rate`; violations fail with `FIXTURE_DECIMAL_INVALID`.

## Validation

- Focused fixture package tests: 111/111 passed.
- Complete repository suite: 210 discovered, 181 passed, 29 environment-skipped, 0 failed.
- Build, lint, and editor diagnostics passed.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `git diff --check` passed.
- REV-050 records alternate-model Code Reviewer PASS after remediation and final recheck.

## Boundary

This evidence covers only closed observation schemas and PT-FIX-001L/M. PT-FIX-001D..G, K, N, and O remain open, including timestamp/date grammar, decimal value grammar, temporal selection, data-quality suppression, coverage, complete deterministic error ordering, persistence, and provider-egress denial. This evidence does not authorize complete WP-2, legacy data migration, WP-3 overlap, release, deployment, or production action.
