# Ring 3 OSS Review Report

**Project:** ETF Analyzer  
**Date:** 2026-09-25  
**Trigger:** Ring 3 IV&V  
**Reviewer:** Solo Orchestrator  
**Package manager:** npm, lockfile version 3  
**Status:** PASS with one nonblocking maintenance advisory

## Summary

| Measure | Result |
| --- | --- |
| Lockfile package entries | 31: one private root and 30 external packages |
| External direct dependencies | 6 |
| External transitive/optional dependencies | 24 |
| Known vulnerabilities | 0 |
| Deprecated packages | 0 |
| External packages without license metadata | 0 |
| Critical / Major / Minor findings | 0 / 0 / 0 |
| Informational findings | 1, tracked by GitHub #93 |

`npm audit --json` reported zero vulnerabilities and `npm ls --all --json` reported no dependency problems. All external packages resolve through the npm registry with lockfile integrity data. No package in the project lockfile declares an install script. The project root has no license field, but it is marked `private` and is not an external no-license dependency.

## Complete Inventory

| Package | Version | Relationship | License | Deprecated | Lifecycle disposition |
| --- | ---: | --- | --- | --- | --- |
| ETF Analyzer root | 0.1.0 | Private root | Not declared | No | Private project; excluded from external no-license finding |
| `@axe-core/playwright` | 4.13.0 | Dev direct | MPL-2.0 | No | Test/build custody; weak-copyleft disposition below |
| `@types/node` | 20.19.14 | Dev direct | MIT | No | Exact-pinned; clean; freshness tracked by #93 |
| `@types/pg` | 8.11.6 | Dev direct | MIT | No | Exact-pinned; clean; freshness tracked by #93 |
| `axe-core` | 4.13.0 | Test/build transitive | MPL-2.0 | No | Weak-copyleft disposition below |
| `obuf` | 1.1.2 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `pg` | 8.16.0 | Runtime direct | MIT | No | Exact-pinned; clean; freshness tracked by #93 |
| `pg-cloudflare` | 1.4.0 | Optional runtime | MIT | No | Parent-managed; audit and deprecation clean |
| `pg-connection-string` | 2.14.0 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `pg-int8` | 1.0.1 | Runtime transitive | ISC | No | Parent-managed; audit and deprecation clean |
| `pg-numeric` | 1.0.2 | Runtime transitive | ISC | No | Parent-managed; audit and deprecation clean |
| `pg-pool` | 3.14.0 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `pg-protocol` | 1.16.0 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `pg-types` | 4.1.0 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `pg-types` under `pg` | 2.2.0 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `postgres-array` | 2.0.0 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `postgres-array` | 3.0.4 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `postgres-bytea` | 1.0.1 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `postgres-bytea` | 3.0.0 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `postgres-date` | 1.0.7 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `postgres-date` | 2.1.0 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `postgres-interval` | 1.2.0 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `postgres-interval` | 3.0.0 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `postgres-range` | 1.1.4 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `pgpass` | 1.0.5 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `playwright` | 1.63.0 | Dev direct | Apache-2.0 | No | Exact-pinned; audit and deprecation clean |
| `playwright-core` | 1.63.0 | Test/build transitive | Apache-2.0 | No | Parent-managed; audit and deprecation clean |
| `split2` | 4.2.0 | Runtime transitive | ISC | No | Parent-managed; audit and deprecation clean |
| `typescript` | 5.9.2 | Dev direct | Apache-2.0 | No | Exact-pinned; clean; freshness tracked by #93 |
| `undici-types` | 6.21.0 | Test/build transitive | MIT | No | Parent-managed; audit and deprecation clean |
| `xtend` | 4.0.2 | Runtime transitive | MIT | No | Parent-managed; audit and deprecation clean |

## License Disposition

| License | Count | Disposition |
| --- | ---: | --- |
| MIT | 22 | Allowed permissive license |
| Apache-2.0 | 3 | Allowed permissive license |
| ISC | 3 | Allowed permissive license |
| MPL-2.0 | 2 | Accepted for unmodified test-only library use |

`@axe-core/playwright` and its `axe-core` dependency are used only by the browser accessibility test surface. They are consumed unmodified as libraries, are not linked into or distributed with a product artifact, and do not impose source obligations on the project's independent files. Fully Agentic policy assigns this weak-copyleft disposition to the agent; no exception is required.

## Maintenance And Supply Chain

`npm outdated --json` found four direct packages with newer upstream releases. The reviewed candidate retains its exact versions; no dependency update is authorized during IV&V.

| Package | Current / wanted | Latest | Disposition |
| --- | --- | --- | --- |
| `@types/node` | 20.19.14 | 26.6.2 | INFO; preserve Node 20 types and review compatibility under #93 |
| `@types/pg` | 8.11.6 | 8.23.1 | INFO; review with the `pg` lifecycle under #93 |
| `pg` | 8.16.0 | 8.23.0 | INFO; assess changelog and regression scope under #93 |
| `typescript` | 5.9.2 | 7.0.2 | INFO; major-version assessment required under #93 |

All resolved external entries use the npm registry and include integrity hashes in the committed lockfile. The 24-package transitive/optional set is bounded for the PostgreSQL and test-tool functions it supports. No typosquatting indicator, deprecation marker, unresolved tree problem, or vulnerability was observed. Direct package maintenance remains under upstream custody and issue #93 requires a fresh license, security, changelog, Node 20 compatibility, and regression review before any update.

## Gate Disposition

The Ring 3 OSS review passes. There are no unresolved Critical, Major, or Minor findings. Issue #93 is a nonblocking informational maintenance item and does not authorize a package update, Ring 4, release, deployment, or production.
