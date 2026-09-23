# WP-8 PostgreSQL Manifest Reconciliation

**Date:** 2026-09-23  
**Decision:** DEC-086  
**Status:** Superseding migration-identity authority; independent review pending  
**Baseline commit:** `a714f072f5df00ad69645b6013b194dcb0fcba64`

## Cause

Ring 2 review hardening found mutually inconsistent accepted schema-manifest roots. Reproduction against the exact PostgreSQL digest showed that the normative roots committed in `cc3f5c2` did not match the current catalog projector at that commit's unchanged SQL identities. The mismatch reproduced under both Node 20 and Node 24, trust and password bootstrap shapes, and `16.15|UTF8|UTC|on|C`.

No migration SQL changed during this reconciliation. The seven content hashes, candidate version `1.0.0-candidate.3`, migration count, and PostgreSQL-only greenfield boundary remain unchanged.

## Authoritative Seven-Row Identity

| Sequence | Migration | SQL SHA-256 | Schema-manifest SHA-256 |
| ---: | --- | --- | --- |
| 1 | `0001-foundation` | `a604802a67bed66c6ce79d2f2f856b48e184ae5b4f76803ab8ead3a135c85291` | `f6be4a872519869b56b35d084377af52811eaef5b123b0cac6410ad29ba6f235` |
| 2 | `0002-application` | `6ad48f730617fadff8ae80d58171c84707d9159af8f0186e71538861d92d730a` | `0fde1bcd49ac6dbcf6db036b7110c1c61c1bddd6e534c9fc27f9c5fe18b80e3e` |
| 3 | `0003-domain-ledger` | `c5da21109969595e17dfb7b31e5c45296324b6d20caf1f1debdb1a70ea84a496` | `78e552a59866cc93bf6e4b198e5a99b1cd53dae96c6aba805afced93d83c07a4` |
| 4 | `0004-fixtures` | `9bf81885aab5fafe8bcac9b372d7bbd0bec601fc29e0cdbc234a65fc3d5489f1` | `efd8177a365c073cb11a914fd66c5adc2fa53339d9aefbc47e8b41b00016ef08` |
| 5 | `0005-analytics-evidence` | `2a848c629d66a7e3e2621ea065f684a94fc82acb9b7e85477a228c30c8ed8001` | `51dd362827c52929203cc465a75e791a2a995627e9989867580cb702d97b4990` |
| 6 | `0006-controlled-access` | `d8ad459296b049ce681a216573159b09d3f95be9297af727f1335b6da75c738a` | `d35a8d12cf8166f4c85b21544949fbe06810c0f474e3efb35950a6f1a1f71b24` |
| 7 | `0007-denial-backend-verifier` | `0d07358c3056885e15ba190681402a381ed71485beb35e3b9088cc8d107b1340` | `e7db4b10fc5464692009f66c303163a5a3d7690897e5fc6cc393ee479476debb` |

## Validation

- PostgreSQL image: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`.
- Node image: `node@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293` (Node 20.20.2).
- PostgreSQL environment: `16.15|UTF8|UTC|on|C`.
- Repository command: `npm run test:postgres:wp8`.
- Canonical A-L result: 12 tests, 12 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo.
- Fail-closed control with `ETF_TEST_POSTGRES_URL` unset: 12 tests, 0 pass, 12 skipped; runner rejected the result.
- Focused API/zero-skip host regression: 12/12 PASS, zero skips.
- Temporary containers: removed; no `etf-wp8-*` container remains.

## Supersession

This artifact supersedes SQL/schema-manifest identity tables in the earlier A-C, D, E, I, J, and PT-E2E evidence. It does not erase their behavioral history or alter REV-164 and the original CT-DB-001K invalidation. It does not close review hardening, WP-8, DP-33, Ring 2, release, deployment, or production.
