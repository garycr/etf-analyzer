# WP-2 Fixture Manifest Conformance Evidence

**Date:** 2026-09-15
**Scope:** PT-FIX-001H closed manifest, descriptor, coverage, uniqueness, and normalized-path rules
**Result:** PASS for the reviewed increment

## Executed Behavior

The package boundary rejects duplicate JSON members before hashing and requires exact closed fields for the manifest, file descriptors, market coverage, and economic coverage. It validates candidate.2 identity constants and grammars, descriptor integer/count/media/hash shapes, the exact `economic-vintages.jsonl` and `market-observations.jsonl` members, normalized relative paths, ordered unique file paths, ordered unique coverage tuples, and ordered duplicate-free valid Gregorian coverage dates.

Path and identity ordering uses UTF-8 bytes. Coverage entries are compared as component tuples rather than delimiter-concatenated keys. Structural manifest defects return `FIXTURE_MANIFEST_INVALID` before file integrity, dataset hash, or immutable-version errors. Empty coverage date arrays remain structurally valid.

## Validation

- Focused fixture package tests: 54/54 passed.
- Complete clean-state serial repository suite: 153/153 passed.
- PostgreSQL baseline: `16.15|UTF8|UTC|on|C` from pinned image digest `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Build and lint passed; editor diagnostics were clean.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `git diff --check` passed.
- REV-046 records alternate-model Code Reviewer PASS after the two initial minor ordering findings and the final exact-layout finding were repaired and rechecked.

A diagnostic database initialized with `en_US.utf8` correctly failed readiness and projected catalog hashes; it was not accepted as gate evidence. The authoritative gate recreated the disposable database with the approved `C` collation and ran test files serially because integration files share one mutable database.

## Boundary

No file path is opened, no JSONL observation is loaded, no PostgreSQL call is made by the new validator, and no network or provider connection exists. PT-FIX-001B..G and I..O remain open. This evidence does not authorize complete WP-2, legacy data migration, WP-3 overlap, release, deployment, or production action.
