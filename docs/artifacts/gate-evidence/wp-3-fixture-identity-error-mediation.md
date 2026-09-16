# WP-3 Fixture Identity and Error Mediation Evidence

**Date:** 2026-09-16
**Scope:** GitHub #71 mandatory WP-3 entry repair
**Result:** PASS

## Implemented Behavior

Application fixture validation now enforces every governed market and economic observation identity grammar before replay, value, provenance, and declared-coverage processing. Malformed `instrumentId`, market `providerId`, `adjustmentPolicy`, economic `providerId`, `seriesId`, and `vintageId` values return `FIXTURE_MANIFEST_INVALID` instead of falling through to `FIXTURE_UNDECLARED_INPUT` or persistence.

The PostgreSQL trust boundary now mirrors the application `datasetId` grammar and maps `check_violation` to `FIXTURE_MANIFEST_INVALID`. Direct `fixture_ingest(jsonb)` vectors prove malformed provider and self-consistent malformed dataset identities are rejected atomically with zero package, descriptor, raw-source, market, or replay rows.

## Test-First Evidence

- Application red: the malformed lowercase market instrument survived structural validation and failed later as `FIXTURE_UNDECLARED_INPUT`.
- Application green: one table-driven test covers all six affected observation identity fields and passes.
- PostgreSQL stable-error red: the existing invalid provider vector exposed no stable `FIXTURE_*` assertion.
- PostgreSQL complete-mediation red: a self-consistent `ETF/fixture` dataset identity was accepted and persisted.
- PostgreSQL green: both malformed identities return `FIXTURE_MANIFEST_INVALID`, and transaction rollback leaves all fixture tables empty.

## Canonical Migration Identities

PostgreSQL `16.15|C|UTF8|UTC|on` generated and executable tests pin:

| Sequence | Exact SQL-byte SHA-256 | Resulting schema-manifest SHA-256 |
| ---: | --- | --- |
| 4 | `9bf81885aab5fafe8bcac9b372d7bbd0bec601fc29e0cdbc234a65fc3d5489f1` | `d23310c3534fa40c6aafdaa951000bab43409bd99cc69264a33c8c5e111dc9d5` |
| 5 | `638fdcb40695be04a30c56807e529f753fd37c80ccfdcd6ad58f04e603287cc4` | `9de23c5c8bd50d9a7771bc67e8a4ffc8bb84175ab9b9ce2caa641d9114407ecd` |
| 6 | `62d4c23bcb89cbf26d58af8a994c765d74cf64e2267c0ae52e240f2632be0235` | `03e42f1f4de6d150d98058f072a24649b5c66adbc177825f211e2e94d73a8d1c` |

Sequence 4 was re-baselined in place because the prototype baseline remains inactive, empty-database-only, and absent from released, deployed, production, or legacy migration ledgers. Sequence 5 and 6 SQL bytes are unchanged; their cumulative manifests inherit the final sequence-4 root.

## Final Validation

- Exact CI-equivalent PostgreSQL-backed command: 293/293 passed, zero failed, zero skipped.
- TypeScript lint: PASS.
- Changed-file editor diagnostics: zero errors.
- Dependency audit at low threshold: zero vulnerabilities.
- `git diff --check`: PASS.
- Superseded/intermediate migration hash search: zero current-tree matches.

## Review and Residual Scope

Initial alternate-model Code and Security reviews returned CONDITIONAL with no Critical findings. Their shared missing-evidence Major is closed by this artifact. The Security review's dataset identity complete-mediation Major is closed by the mirrored PostgreSQL constraint and direct red/green integration vector. Final alternate-model Code and Security re-reviews returned PASS with no Critical or Major findings. Unmapped non-check SQLSTATE classes, explicit payload cardinality limits, and combined-defect diagnostic precedence remain outside GitHub #71 and require separate ownership if promoted.
