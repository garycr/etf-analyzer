# WP-2 PostgreSQL Decimal Validation Evidence

**Date:** 2026-09-15
**Scope:** PT-FIX-001F PostgreSQL exact decimal admission, persistence, and migration re-baseline
**Result:** PASS; aggregate PT-FIX-001F implemented, reviewed, and approved for bounded publication

## Executed Behavior

The fixture ingestion function validates canonical decimal text before any PostgreSQL cast. Quantity and UnitPrice admit at most 18 integer digits at scale 10, Money admits 20 at scale 8, and Rate admits 16 at scale 12. Both observation tables enforce the same class-specific absolute bounds alongside `NUMERIC(28,10)`, `NUMERIC(28,8)`, and `NUMERIC(28,12)` typmods.

PostgreSQL 16.15 accepted Money values with 18, 19, and 20 integer digits across market and economic records. The vectors include positive and negative values and both signs at the exact 20-digit maximum. Scale-8 readback matched every input string exactly. A 21-integer-digit value and a scale-9 value failed with `FIXTURE_DECIMAL_INVALID` before casts; fixture ingestion never rounded.

## Migration Re-baseline

The closed sequence-1-through-6 migration set remains structurally unchanged. Sequence 4 was corrected in place because the prototype baseline is inactive, has no released or production migration ledger, and supports empty-database installation only. PostgreSQL `16.15|C|UTF8|UTC|on` produced these canonical changes:

- Sequence 4 SQL SHA-256: `bd34aa3c5701ef42267fccf797284507db25a9319342a1553898d2f84af1cc56`.
- Sequence 4 manifest SHA-256: `cb0955c4952e7e3994a224c390cc8b41bb0a3a7c63a28e522051b0cd29467f69`.
- Sequence 5 manifest SHA-256: `fa108eee32e09d81829c175e68387a896b99b210193c3feaad2f30cccaf34366`; sequence-5 SQL is unchanged.
- Sequence 6 manifest SHA-256: `cac533a25d652e9bd3da840632f8b131ba98b82ed6898d0115acc56228412d02`; sequence-6 SQL is unchanged.

The PostgreSQL contract, executable hash assertions, and WP-1 evidence records contain these exact values. Prior journal events remain immutable historical records.

## Validation

- Test-first red check: fixture migration unit suite 5 passed, 1 failed at the old 18-digit Money grammar.
- Focused fixture migration suite after remediation: 5/5 passed with zero skips.
- Affected sequence-4-through-6 migration chain: 12/12 passed with zero skips.
- Complete serial PostgreSQL-backed repository suite: 248/248 passed with zero skips.
- Exact CI command `npm test`: 248/248 passed with zero skips.
- TypeScript build and lint passed.
- Editor diagnostics reported no changed-file errors.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `git diff --check` passed, and no stale superseded hash remains outside append-only journal history.

## Boundary

This evidence covers the PostgreSQL half of PT-FIX-001F and the necessary inactive empty-database re-baseline. It does not authorize mutation of an applied release or production migration ledger. PT-FIX-001G, K, N, and O remain open, as do complete quality suppression, coverage, provider-egress, WP-2, legacy migration, release, deployment, and production action.
