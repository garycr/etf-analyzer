# WP-6 Paper Order and Ledger Exit Evidence

**Date:** 2026-09-18
**Scope:** WP-6 hypothetical paper-order lifecycle, immutable ledger, FIFO allocation, reversal, audit chains, and exact projection reconciliation
**Result:** PASS; approved by DEC-058 and REV-134

## Scope Disposition

DEC-057 defers CT-LED-019 custom restore controls outside WP-6. The product provisions a greenfield PostgreSQL database and performs no SQL Server data migration or DDL conversion. WP-6 acceptance therefore covers OT-01..OT-10, CT-ORD-001..012, and CT-LED-001..018. ADR-002 and GitHub issue #82 remain nonblocking future operational hardening.

## Exit Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Closed order lifecycle | PASS | All eight states and OT-01..OT-10; invalid complements and terminal transitions reject atomically |
| Confirmation and research boundary | PASS | Explicit same-user confirmation; displayed signals never create orders; no brokerage path |
| Application composition | PASS | Trusted bounded dispatch, exact replay, owner error mapping, and one PostgreSQL transaction |
| Ledger arithmetic | PASS | Bounded fixed-point values, half-even rounding, FIFO allocation, residual handling, no overspend or short position |
| Immutable correction | PASS | Reversal lineage, dependency rejection, exact stored restoration, and stable replay |
| Concurrency | PASS | Observed two-client serialization, deterministic equal-time ordering, loser rollback, and idempotent winner replay |
| Audit lifecycle | PASS | Immutable intent, one terminal outcome, ordered timeout/recovery, collision-safe identity, and anchored HMAC continuity |
| Dual-chain atomicity | PASS | Business, audit, commitments, anchors, checkpoints, and versions commit or roll back together |
| Authorization | PASS | Runtime roles execute only controlled procedures; owner roles are NOLOGIN/NOINHERIT; direct bypass is denied |
| Projection reconciliation | PASS | Exact scalar and keyed rebuild, verified atomic publication, corruption rejection, blocked-publication evidence, and cache continuity |
| Migration identity | PASS | Sequence 3 and 6 content plus cumulative schema-manifest identities pass executable checks |
| Deferred recovery scope | PASS | CT-LED-019 is excluded by DEC-057; no custom restore-control SQL or tests remain in the baseline |
| Code review | PASS | REV-106, REV-107, REV-109, REV-111, REV-113, REV-115, REV-117, REV-119, REV-121, REV-123, REV-125, REV-127, REV-129, and REV-131 |
| Security review | PASS | REV-108, REV-110, REV-112, REV-114, REV-116, REV-118, REV-120, REV-122, REV-124, REV-126, REV-128, REV-130, and REV-132 |
| Closure plan review | PASS | REV-134; no open Critical, Major, or blocking Minor finding |

## Validation

- TypeScript build: PASS.
- TypeScript lint/typecheck: PASS.
- PostgreSQL 16 repository suite: 423 discovered, 423 passed, 0 failed, 0 skipped.
- Dependency audit: 0 vulnerabilities.
- All CT-LED-019 implementation and test experiments were uncommitted, removed, and confirmed absent from `HEAD` before this gate.
- The pre-existing bounded decimal-string denial-of-service hardening opportunity remains nonblocking in GitHub issue #81.

## Immutable Artifacts

| Artifact | SHA-256 |
| --- | --- |
| `src/Application/application-boundary.ts` | `867498980f1dfd027b6b7edb58764362f4b3113064a44472a9d5e52015055f6b` |
| `src/Domain/Orders/paper-order.ts` | `5a60680601b01e4a2339fddfbd9971ccd691b6dc0d0ef19b8de16a191a9240ff` |
| `src/Infrastructure/PostgreSQL/application-replay-store.ts` | `09a3773f8330996092e184381282748344df6263b06156a65c2ee3131887e9f8` |
| `src/Infrastructure/PostgreSQL/migrations/controlled-access.ts` | `7f644e444a5b4632380ff79a2e2615485ab1831c50df13f4d251236ced0e656b` |
| `src/Infrastructure/PostgreSQL/migrations/domain-ledger.ts` | `fc32a04fdfbb06cad9b7b0b268c756fdf50d43742ff0fec6cd37820e79808c46` |
| `src/Infrastructure/PostgreSQL/paper-order-owner.ts` | `5fc23290f832593677e1d528677ae1144a4726c9cf0a5dfc696bb17b7f66abbb` |
| `tests/Integration/analytics-evidence-migration.test.mjs` | `62a2673ce80ded98060b03a87f560b3733cd5236c64d59606a6b0f3b4fcd09e1` |
| `tests/Integration/controlled-access-migration.test.mjs` | `9b13096d827b3d0294e018b3aa2a603e20f90d0c8af621b926240d45be01e6c8` |
| `tests/Integration/domain-ledger-migration.test.mjs` | `1bf1c1b0d5c835a79c9fe4d45b4d5006ecba696c2aa028fd562212913bda3765` |
| `tests/Integration/fixture-migration.test.mjs` | `c60704705d35aa16640ac36aaa589375b88a66fe52cd481e185191c508bad75b` |
| `tests/Unit/application-boundary.test.mjs` | `c651637462bdb069cbad9fdde6ed39bb7e9cb4464a0b2eeaf6f491ff4ef5245c` |
| `tests/Unit/controlled-access-migration.test.mjs` | `d8332b97ae39e3ccf1d55caf380fc1f5ff8805ae8b1f09f7ba712b62d4389760` |
| `tests/Unit/domain-ledger-migration.test.mjs` | `8acc182571cadcb3bdfdb0f2322916ecbd7149cdccd01580ba97838a7de3039e` |
| `tests/Unit/ledger.test.mjs` | `777e4386364b1d2ea915182416ee2b6cd6ba878c69f9859583741646e450f3a2` |
| `tests/Unit/paper-order-owner.test.mjs` | `4d5cc8c568a9277f36e5e740e18633a017672bd646f8cb621a8b6934495fbf27` |
| `tests/Unit/paper-order-scope.test.mjs` | `45a0206f8609d7fa4ca21109ec053a18bd41d3a193f4936387cadb38fc1bf4c7` |
| `tests/Unit/paper-order.test.mjs` | `e70361aedfbc1f98873b54734f85e2cb15dbd55e14d78ec64917ab4880949996` |
| `tests/Unit/postgres-application-replay-store.test.mjs` | `a4fadc1143c0fc175f979730fe1b34701127ab58bc4641357708174692d3580a` |

## Cost And Token Review

WP-6 retained the approved 32 agent-hour point estimate and XXL risk label. Provider token telemetry and agent-active hours are unavailable, so actual token, dollar, and labor variance is not fabricated. Runtime AI cost remains zero because the implemented order and ledger paths invoke no AI workflow.

## Boundary

This evidence closes only WP-6. It makes WP-7 eligible as the next sequential package but does not start it. Ring 2 remains Active. No browser implementation, baseline activation, live provider, brokerage, external account, public ingress, release, deployment, or production action is authorized.
