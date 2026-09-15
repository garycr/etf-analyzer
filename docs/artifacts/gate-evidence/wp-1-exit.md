# WP-1 Executable Foundation Exit Evidence

**Date:** 2026-09-15
**Scope:** WP-1 build, CI, local configuration, observability primitives, PostgreSQL bootstrap, migrations, authority, and exact catalog
**Result:** PASS

## Canonical Migration Set

| Sequence | Migration | Exact SQL-byte SHA-256 | Resulting manifest SHA-256 |
| ---: | --- | --- | --- |
| 1 | `0001-foundation` | `a604802a67bed66c6ce79d2f2f856b48e184ae5b4f76803ab8ead3a135c85291` | `3ba3b63c429cf051378ce3eb4adafe0db697dec487d070669a6bc47dba2f8f7c` |
| 2 | `0002-application` | `9865cd75bd6249b4a567daf840f95ad3d7b52bbf534060e87a34516fd0867fdb` | `405d4e276efbf43f40c4856be1c7536b7cc0d8d37329416d8df7e8ed24bb34cc` |
| 3 | `0003-domain-ledger` | `d514c7f3b75c6ed83dfdbd9b54b406b14814b2bf8f40bd1e04a9d70a303346a3` | `61008ff4dd4898afb0f0b168c4d063dae4894fb8257f9ee77db3af95fdde54d4` |
| 4 | `0004-fixtures` | `8f73d86024e38c043328c3ac3102dffb627df579757009f150f789bba1bb5b60` | `897c67ad05bb35c602c74d412172c8cc0aff398b5448711af25a43974017fda6` |
| 5 | `0005-analytics-evidence` | `638fdcb40695be04a30c56807e529f753fd37c80ccfdcd6ad58f04e603287cc4` | `92f3a9dcf71e61ae42977d2a2c009130ec4b622f1370239e65a6d5fdc8e54d46` |
| 6 | `0006-controlled-access` | `62d4c23bcb89cbf26d58af8a994c765d74cf64e2267c0ae52e240f2632be0235` | `10feee5e5a5a58137767a9a9803ee5659b56a5feca9b8fb9f9ae45da3cedbf01` |

Every value is pinned by the corresponding PostgreSQL integration test. Sequence 1 through 5 evidence was recomputed with the final sequence-6 catalog projector so cumulative grant-option and column ACL state is represented consistently.

## WP-1 Exit Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Build, lint, and test pipeline | PASS | Root Node 20 scripts and pinned PostgreSQL CI service; complete local suite 99/99 |
| Dependency review | PASS | `pg` and TypeScript dependency set unchanged; `npm audit --audit-level=low` reported zero vulnerabilities |
| Configuration, logging, and health primitives | PASS | Fail-closed fixture-only configuration, credential redaction, structured logging, liveness, ordered readiness, and stable failure checks |
| PostgreSQL baseline | PASS | PostgreSQL `16.15|UTF8|UTC|on|C`; externally provisioned `pgcrypto 1.3` and system `plpgsql 1.0` |
| External bootstrap | PASS | Fourteen closed product roles, nine set-only memberships, exact database ACL, transactional rollback, and cleanup |
| Six migrations | PASS | Contiguous exact identities, SQL hashes, transaction advisory lock, deterministic replay, fail-closed drift, and rollback at every sequence |
| Exact catalog | PASS | RFC 8785 projection of schemas, roles, memberships, extensions, tables, constraints, indexes, functions, views, triggers, relation ACLs, and column ACLs |
| Authority closure | PASS | Exact ownership, no PUBLIC execution, no runtime base-table authority, fixed function search paths, bounded-reader definitions/ACLs/hardening, and immutable statement triggers; end-to-end reader behavior remains allocated to later packages |
| Scope guards | PASS | Product-created extensions and durable handoff objects rejected; no queue, scheduler, event, provider, broker, public ingress, or production action |
| Reforecast | PASS | WP-1 estimate reviewed; unavailable execution telemetry is disclosed without fabricated actuals; remaining baseline is unchanged |

## CT-DB-001 Allocation

WP-1 closes complete `CT-DB-001A`, `B`, `C`, and `L`: exact empty bootstrap, replay/drift, transactional rollback, and absence of durable handoff. It also closes only the WP-1 foundation leaves of D and K: database/role deny-by-default authority, controlled-function hardening, PostgreSQL connectivity, migration/catalog readiness, and scope-guard state. Issue #66 explicitly required `CT-DB-001A..D/K/L` foundation execution while leaving E-J to their owning later packages.

WP-1 does not claim complete D or K because their bounded-reader, denial-audit, fixture-policy, and ledger-integrity leaves depend on later packages. It does not claim E-J package acceptance. DEC-030 and the corrected WBS assign domain leaves to WP-2 through WP-6 when executable dependencies exist and retain complete integrated `CT-DB-001A..L` closure in WP-8.

## Review Chain

REV-028 through REV-042 record the incremental Code Reviewer, Architect Reviewer, and Security Reviewer dispositions. REV-043 records Plan Reviewer PASS for DEC-030. REV-044 records final aggregate Code Reviewer PASS. No finding remains open.

## Empty-Database Boundary

The target contains no legacy data. WP-1 performs additive empty-database installation and synthetic conformance only: no row copy, transformation, backfill, historical reconciliation, cutover, baseline activation, live provider integration, analytics computation, release, deployment, or production action.

Issue #66 may close as completed. WP-2 is the next authorized sequential package; all later packages remain blocked by their declared dependencies.
