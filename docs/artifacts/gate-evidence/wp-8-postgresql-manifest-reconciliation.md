# WP-8 PostgreSQL Manifest Reconciliation

**Date:** 2026-09-23  
**Decision:** DEC-086, rebaselined by DEC-088
**Status:** Current migration-identity authority; DEC-088 accepted under REV-194/195
**Baseline commit:** `a714f072f5df00ad69645b6013b194dcb0fcba64`

## Cause

Ring 2 review hardening found mutually inconsistent accepted schema-manifest roots. Reproduction against the exact PostgreSQL digest showed that the normative roots committed in `cc3f5c2` did not match the current catalog projector at that commit's unchanged SQL identities. The mismatch reproduced under both Node 20 and Node 24, trust and password bootstrap shapes, and `16.15|UTF8|UTC|on|C`.

DEC-086 originally reconciled unchanged SQL to the live catalog projector. DEC-088 subsequently normalized public Job `UInt` values from `job_start` and `job_get` to canonical strings, changing SQL bytes in migrations 0002 and 0006 and therefore every cumulative root. The table below is the mechanically reproduced DEC-088 chain under the authoritative CI bootstrap: database `etf_analyzer`, C collation, UTF8, UTC, and the exact PostgreSQL image. Database ACLs are intentionally projected, so roots from a differently initialized `postgres` database are not interchangeable. Candidate version `1.0.0-candidate.3`, migration count, and PostgreSQL-only greenfield boundary remain unchanged because no database has been released or deployed.

## Authoritative Seven-Row Identity

| Sequence | Migration | SQL SHA-256 | Schema-manifest SHA-256 |
| ---: | --- | --- | --- |
| 1 | `0001-foundation` | `a604802a67bed66c6ce79d2f2f856b48e184ae5b4f76803ab8ead3a135c85291` | `f6be4a872519869b56b35d084377af52811eaef5b123b0cac6410ad29ba6f235` |
| 2 | `0002-application` | `e944f4c75488cba07045595b1769517ddfc369b6828b747091cc9774464fdb8d` | `0418e808ca3d371e273b7500c8f836bf2cc5a06b613b1c50c40da579ed592e01` |
| 3 | `0003-domain-ledger` | `c5da21109969595e17dfb7b31e5c45296324b6d20caf1f1debdb1a70ea84a496` | `ed2b0c90c02e7eb39a2818ee890f41713475ed7ef2e19e90569bd54f37c2d9f3` |
| 4 | `0004-fixtures` | `9bf81885aab5fafe8bcac9b372d7bbd0bec601fc29e0cdbc234a65fc3d5489f1` | `d6e0e28b925a9dbad5375a2042b3bd84d7e26cb3861a1f45e8d4a52175f01009` |
| 5 | `0005-analytics-evidence` | `2a848c629d66a7e3e2621ea065f684a94fc82acb9b7e85477a228c30c8ed8001` | `05f956d422453a53346b7ac1280d801bd3eb47211817bfd13fc9cc8060d34e95` |
| 6 | `0006-controlled-access` | `69edc73adca240b45af423ee4d4725b1999692b561e9d3d79bcd8cc6bede81cb` | `91d0b8b2c12284b2d1fe481242388a32668424309e74ef2f82f1850d62f6a4de` |
| 7 | `0007-denial-backend-verifier` | `0d07358c3056885e15ba190681402a381ed71485beb35e3b9088cc8d107b1340` | `690a7efe18d5279f84ca5c7af3cf507a1bcc2a38841a1d3b3a622cbae9f3dc43` |

## Validation

- PostgreSQL image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Node image: `node@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293` (Node 20.20.2).
- PostgreSQL environment: `16.15|UTF8|UTC|on|C`.
- Repository command: `npm run test:postgres:wp8`.
- Canonical A-L result: 12 tests, 12 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo.
- DEC-088 focused live result: application and controlled-access migration files, 32 tests, 32 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo.
- Fail-closed control with `ETF_TEST_POSTGRES_URL` unset: 12 tests, 0 pass, 12 skipped; runner rejected the result.
- Focused API/zero-skip host regression: 12/12 PASS, zero skips.
- Temporary containers: removed; no `etf-wp8-*` container remains.

## Supersession

This artifact supersedes SQL/schema-manifest identity tables in the earlier A-C, D, E, I, J, and PT-E2E evidence, as well as its own DEC-086 table before DEC-088. It does not erase their behavioral history or alter REV-164 and the original CT-DB-001K invalidation. It does not close review hardening, WP-8, DP-33, Ring 2, release, deployment, or production.
