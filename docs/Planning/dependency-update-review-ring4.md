# Ring 4 Dependency Update Review

**Date:** 2026-09-27
**Issue:** #93
**Decision:** DEC-099 accepted; REV-213 and REV-214 PASS
**Scope:** Direct dependency freshness only; no package or lockfile change

## Current Baseline

The release candidate uses exact direct versions and lockfile version 3:

| Package | Current | Review target | Role |
| --- | ---: | ---: | --- |
| `pg` | 8.16.0 | 8.23.0 | Runtime PostgreSQL client |
| `@types/pg` | 8.11.6 | 8.23.1 | Development types for `pg` |
| `@types/node` | 20.19.14 | 26.6.2 | Development types for governed Node 20 |
| `typescript` | 5.9.2 | 7.0.2 | Development compiler |

The Ring 3 inventory records 30 external packages, zero known vulnerabilities, zero deprecations, and no missing external license metadata. CI run `36329422888` passed dependency audit, security evidence, build/test, browser accessibility, and CodeQL at the current lockfile.

## Compatibility And Lifecycle Assessment

| Package | Assessment | Disposition |
| --- | --- | --- |
| `pg` 8.23.0 | Upstream changelog entries after 8.16.0 add pipeline support, direct SSL negotiation, Node 26 support, SCRAM error handling, transaction status, pool initialization, password callback context, and a changed `connect` return. Version 8.19.0 also deprecates the internal query queue. The package still declares Node `>=16`, but these changes touch connection, authentication, queueing, and typing surfaces used by this project. No listed entry identifies a security fix requiring immediate adoption. | Retain 8.16.0 for this candidate. Evaluate 8.23.x with `@types/pg` in a separate PostgreSQL compatibility change and run all live A-L, lifecycle, concurrency, and recovery tests. |
| `@types/pg` 8.23.1 | Current upstream definitions add import/require exports and remain coupled to `pg`, `pg-protocol`, `pg-types`, and Node definitions. Updating types independently can change compile-time contracts without changing runtime behavior. | Retain 8.11.6 and review only with the matching `pg` update. |
| `@types/node` 26.6.2 | The newer major models Node 26 and depends on the Node 26-era `undici-types` line. The governed project runtime is Node 20.20.2. | Retain the Node 20 definitions. Do not model APIs unavailable in the governed runtime. |
| `typescript` 7.0.2 | This is a major compiler transition. The inspected upstream tag does not expose matching stable package metadata and uses a Node 22 development toolchain, so compatibility cannot be established from the available source evidence. | Retain 5.9.2. A TypeScript major upgrade requires its own design, compiler-diagnostic review, emitted-output comparison, and full regression approval. |

## Security, License, And Provenance

- Current CI dependency audit reports zero vulnerabilities; no advisory requires changing the reviewed pins.
- Current licenses remain accepted: MIT for `pg`, `@types/pg`, and `@types/node`; Apache-2.0 for TypeScript.
- The `pg@8.23.0` upstream tag resolves to commit `df274d1ba9ad9d11a8f1079314faeafde7208207` through an unsigned annotated tag. This review does not substitute that tag for npm package integrity or approve installation.
- Machine policy blocks direct npm retrieval in this environment. The review used the committed lockfile, successful commit-bound CI audit, and upstream GitHub source metadata; it did not weaken policy or install packages.

## Decision

Retain all four exact versions for the bounded local candidate. Freshness alone does not justify introducing runtime, type-model, compiler-major, or transitive-lockfile churn after the candidate passed Ring 3 IV&V and Ring 4 hardening. Reopen immediately for a relevant security advisory, loss of Node 20 support, or a release-blocking defect fixed only upstream.

This disposition closes the required pre-manifest review. It does not authorize release, promotion, deployment, production, provider access, brokerage, public ingress, or a future dependency update.

## Sources

- Committed inventory: `docs/Planning/oss-review-ring3.md`
- `pg` 8.23.0 package metadata: <https://github.com/brianc/node-postgres/blob/pg%408.23.0/packages/pg/package.json>
- `pg` changelog: <https://github.com/brianc/node-postgres/blob/pg%408.23.0/CHANGELOG.md>
- Current `@types/pg` metadata: <https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pg/package.json>
- Current `@types/node` metadata: <https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/node/package.json>
- TypeScript 5.9.2 metadata: <https://github.com/microsoft/TypeScript/blob/v5.9.2/package.json>
- TypeScript 7.0.2 source tag metadata: <https://github.com/microsoft/TypeScript/blob/v7.0.2/package.json>
