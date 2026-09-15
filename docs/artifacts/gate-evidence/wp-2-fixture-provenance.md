# WP-2 Fixture Provenance Evidence

**Date:** 2026-09-15
**Scope:** PT-FIX-001I governed raw-source retention and independent provenance verification
**Result:** PASS for the reviewed increment

## Executed Behavior

The package validator parses the two governed JSONL files directly from supplied bytes without opening paths. It enforces fatal UTF-8, no byte-order mark, LF-only canonical records, exactly one trailing LF, no blank lines, and descriptor record-count equality.

Raw-source paths are content addressed by the independently recomputed SHA-256 of retained bytes. Each normalized record must use an exact local `raw-sources/<rawSourceHash>` reference that resolves to those verified bytes and must retain nonempty normalization and ingestion-job provenance. Self-consistent manifest changes cannot substitute changed raw bytes under the original content-addressed path. URLs, credentials, query strings, mismatched references, and missing governed objects are rejected.

## Validation

- Focused fixture package tests: 82/82 passed.
- Complete clean-state serial repository suite: 181/181 passed.
- PostgreSQL baseline: `16.15|UTF8|UTC|on|C` from pinned image digest `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Build and lint passed; editor diagnostics were clean.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `git diff --check` passed.
- REV-047 records alternate-model Code Reviewer PASS and a final PASS recheck after both suggestions were implemented.

## Boundary

No filesystem, database, or network operation was added to the validator. PT-FIX-001B..G and J..O remain open, including full multi-defect precedence in PT-FIX-001N. This evidence does not authorize complete WP-2, legacy data migration, WP-3 overlap, release, deployment, or production action.
