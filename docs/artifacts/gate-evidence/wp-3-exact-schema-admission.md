# WP-3 Exact Schema Admission Evidence

**Date:** 2026-09-16
**Scope:** PT-APP-001M exact request and success-data admission for the closed application catalog
**Result:** PASS

## Executed Behavior

Raw JSON is scanned before parsing so duplicate object members, escaped-equivalent names, and nested duplicates fail with `APPLICATION_REQUEST_INVALID`. The boundary admits exact closed payloads for all 9 commands and 7 queries, validates scalar grammars, rejects inverted diagnostic windows, and invokes no owner for malformed input. Analytics evidence identities are unique and sorted lexically in a newly frozen payload before owner dispatch.

Application-owned success projections are deeply validated and canonically ordered. Paper-order transition history must match the exact OT-01 through OT-10 source, target, and trigger rows. Job state, timestamps, and controlling errors are coherent. Diagnostic export codes and Analytics job evidence identities are nonempty and unique. IntegrityBlocked portfolios expose no lots, positions, or nonzero current values. Opaque AnalyticsResult and Evidence imports must be ordinary recursively frozen acyclic records and are returned by identity.

## Test-First Evidence

- Initial red: the focused tests failed because PT-M exports were absent.
- Review red: unsorted Analytics evidence identities reached the owner unchanged; result state contradictions were admitted.
- OT-02 through OT-10 valid and malformed payloads prove exact transition schema admission and owner-call suppression; OT-01 remains represented by PaperOrderDraftCreate.
- Prototype red: frozen null-prototype opaque records were initially accepted, then rejected after ordinary-record enforcement.
- Cycle red: circular frozen owner data initially escaped as `RangeError`, then normalized to `APPLICATION_RESULT_INVALID` through active-path cycle detection.
- Focused final build/test: 2/2 passed.
- Complete default suite: 310 discovered, 280 passed, 30 PostgreSQL environment skips, zero failed.
- TypeScript lint and changed-file diagnostics: PASS.
- Dependency audit: 0 vulnerabilities.
- `git diff --check`: PASS.

## Review

Alternate-model Code Review returned final PASS with all four initial Major findings and the prototype Minor closed; test quality was 4.5/5. Alternate-model Security Review returned PASS with no severity finding, and its circular-owner Informational was remediated and rechecked PASS.

This closes PT-APP-001M only. PT-APP-001N replay identity, PT-APP-001O precedence, PT-APP-001P result composition, WP-4 surfaces, live providers, release, deployment, and production authority remain open.
