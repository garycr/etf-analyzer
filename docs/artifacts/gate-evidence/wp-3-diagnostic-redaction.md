# WP-3 Diagnostic Redaction Evidence

**Date:** 2026-09-16
**Scope:** PT-APP-001K allowlist-only diagnostic export and recursive structured-log redaction
**Result:** PASS

## Executed Behavior

`exportDiagnosticMetadata` classifies every record before creating an export. Known prohibited fields are removed; an unknown field, nested value under an allowlisted name, or value that violates its field grammar fails the whole batch with `APPLICATION_REDACTION_FAILED`. The failure contains only an optional UUID-validated correlation ID from the offending record. No partial export is created.

Allowed values use field-specific grammars for stable codes, UUIDs, bounded identifiers, canonical statuses, canonical UTC instants, nonnegative safe-integer counts and durations, versions, and lowercase SHA-256 hashes. Export records, code arrays, the records collection, the application-owned export descriptor, and failure envelopes are frozen.

`serializeLogEvent` recursively redacts sensitive fields in nested objects and arrays through the JSON replacer. Name normalization covers separator and case variants, and the redaction vocabulary matches the diagnostic prohibited-content categories.

## Test-First Evidence

- Red: nested structured-log values escaped the former top-level-only redaction.
- Red: diagnostic export was absent before PT-APP-001K implementation.
- Review red: `{ status: { password: "protected-password" } }`, a secret-shaped stable code, and a malformed hash exposed coarse value acceptance; the focused check failed with `Succeeded` instead of `Failed`.
- Security red: the expanded structured-log matrix failed on `apiKey`, proving logger vocabulary lagged the diagnostic prohibition list.
- Green: allowed-key nesting, malformed codes and hashes, distinct offending-record correlation attribution, all-or-nothing creation, recursive logging, and every prohibited name category pass.
- Focused final build/test: 3/3 passed.
- Complete default suite: 307 discovered, 277 passed, 30 PostgreSQL environment skips, zero failed.
- TypeScript lint and changed-file diagnostics: PASS.
- Dependency audit: zero vulnerabilities.
- `git diff --check`: PASS.

## Review

Alternate-model Code Review returned final PASS with no critical, major, or minor findings after remediation; the PT-APP-001K tests scored 4.71/5 across the seven test-quality dimensions. Alternate-model Security Review returned PASS with no critical, major, or minor findings after the logger vocabulary and caller-obligation remediation. Both reviews support PT-APP-001K and issue #22's redaction acceptance input at this design-time boundary.

Identifier-shaped fields remain domain identifiers rather than generic diagnostic text channels. Ring 2 retains transport-level rebinding, optional value-shape defense in depth, and future handling if richer nested export descriptors are introduced. This evidence closes PT-APP-001K only; PT-APP-001L..P remain open.
