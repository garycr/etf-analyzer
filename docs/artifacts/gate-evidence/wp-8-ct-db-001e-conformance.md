# WP-8 CT-DB-001E Conformance Evidence

**Date:** 2026-09-22
**Decision:** DEC-069; DEC-075
**Status:** Accepted under REV-172 and REV-173
**Scope:** CT-DB-001E only

## Exact Values And Pre-Cast Rejection

The canonical `CT-DB-001E exact values reject noncanonical input before PostgreSQL cast` test executes six owning tests and requires all six to pass without skips:

| Owner / class | Accepted evidence | Rejected evidence |
|---|---|---|
| Ledger Quantity `numeric(28,10)` | `1.0000000000` round-trips exactly | `1.00000000001` returns `LEDGER_EXCESS_SCALE` |
| Ledger Money `numeric(28,8)` | `100.00000000` round-trips exactly; `-0.00000000` stores as `0.00000000` | `1e2` returns `LEDGER_INVALID_DECIMAL` |
| Analytics Rate `numeric(28,12)` | `0.010000000000` commits exactly; negative zero normalizes | `NaN` returns `ANALYTICS_NUMERIC_CLASS_INVALID` |
| Fixture Quantity `numeric(28,10)` | `0.0000000000` persists exactly with its valid empty currency | `-0.0000000000` returns `FIXTURE_DECIMAL_INVALID` |
| Fixture UTCInstant `timestamptz(3)` | `2026-01-30T12:00:00.000Z` persists exactly | `2026-01-30T12:00:00.0001Z` returns `FIXTURE_TEMPORAL_INVALID` |
| Application ClosedJson `jsonb` | Exact `JobRestart` record reaches its owner | The same record plus `extra` returns `APPLICATION_REQUEST_INVALID` before owner dispatch |

The ledger, fixture, and analytics owners assert persistent readback or canonical hashes for accepted values. Their rejected matrices assert unchanged protected state. The application owner-call count remains unchanged after malformed admission.

## Validation

- Image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Environment: `16.15|UTF8|UTC|on|C`.
- Canonical CT-DB-001E parent: 1/1 PASS, zero failed, zero skipped.
- Embedded owner set: 6/6 PASS, zero failed, zero skipped.
- Focused post-review application parent: 1/1 PASS.
- Build, lint, `git diff --check`, and editor diagnostics: PASS.
- Temporary containers: removed and absence verified.
- Sequence 4 cumulative manifest hash: `bc0e77af221c697b287d6e82e70a2400d569d56b371b42686ad5398c909db4c3`.
- Sequence 5 cumulative manifest hash: `089df576fc69615023861fbb3909b36ee06359db19a4f8637cedd455de2fb8f2`.
- Final sequence 7 SQL and cumulative manifest hashes remain unchanged.
- Independent Code Review: REV-172 PASS after hardening remediation and focused re-review.
- Independent Security Review: REV-173 PASS with no blocking findings.

## Boundary

This evidence accepts CT-DB-001E only. CT-DB-001F-J, PT-E2E-001, WP-8 closure, DP-33, Ring 2 closure, release, deployment, and production remain open or unauthorized. CT-DB-001K remains separately accepted under DEC-072/REV-168; CT-DB-001A-C under DEC-073/REV-169; and CT-DB-001D under DEC-074/REV-170/REV-171. REV-164 and the original CT-DB-001K evidence remain invalidated history.
