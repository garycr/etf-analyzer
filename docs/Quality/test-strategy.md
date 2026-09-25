# Ring 3 Test Strategy

**Project:** ETF Analyzer  
**Date:** 2026-09-25  
**Scope:** Independent validation of the local single-user prototype  
**Status:** Executed

## Objectives And Boundary

The strategy validates functional suitability, reliability, security, maintainability, accessibility, performance bounds, and compatibility for the reviewed Node 20/PostgreSQL 16.15 candidate. It covers Domain, Application, loopback Infrastructure, browser workbench, and greenfield PostgreSQL behavior. Release, deployment, production, public ingress, providers, brokerage, distributed workers, and SQL Server migration are excluded.

## Test Model

| Level | Purpose | Canonical control |
| --- | --- | --- |
| Unit | Domain/Application rules, parsers, state machines, policies, guardrails | `npm test` |
| Integration | PostgreSQL migrations, roles, replay, owners, HTTP composition | `npm test`; `npm run test:postgres:wp8` |
| End-to-end | Fixture through analytics, paper order, reconciliation, recovery | PT-E2E-001 / PT-OPS-001 |
| Browser/accessibility | Keyboard workflow, reflow, focus, full-document axe | `npm run test:browser` |
| Security | Audit policy, secrets, banned functions, redaction, CodeQL | `npm run test:security:evidence`; CI CodeQL |
| Coverage | Every compiled Domain/Application file and all 16 public routes | `npm run test:coverage:wp8` |

## Gates

- Every compiled `dist/Domain` and `dist/Application` file must independently meet 80% line coverage.
- The line-only threshold is intentional for this candidate. Branch and function percentages remain diagnostic; branch gating is deferred as nonblocking hardening.
- The 16 reviewed public method/target pairs must resolve behaviorally to 16 unique Application operations.
- WP-8 PostgreSQL parents and the dedicated coverage gate must report zero failures, skips, todos, and cancellations.
- Browser parents must pass at 1280x720, 768x1024, and 320x568 with zero axe violations and complete keyboard access.
- Security audit, secret scan, AST guardrail, CodeQL, and evidence provenance must fail closed.
- Independent test quality must score at least 3.0, with no dimension below 2.

## Environment And Determinism

CI uses Node 20 and digest-pinned PostgreSQL 16.15 with a health-gated service. Generic local `npm test` may skip environment-gated PostgreSQL tests when `ETF_TEST_POSTGRES_URL` is absent; that command is not standalone integration acceptance. The canonical CI supplies the database and separately runs the 12 zero-skip WP-8 parents. The PT-COVERAGE-001 parent intentionally skips during generic `npm test` because it requires a generated coverage report; the dedicated command executes it and its adversarial parser controls.

Tests use isolated loopback servers on ephemeral ports, fresh browser contexts, transactional database setup, controlled fixture time, and explicit teardown. The API deadline elapsed-time assertion is retained as a determinism watch item; a demonstrated flake requires an injectable clock or revised bound.

## Exit Criteria

Exit requires green published CI, no open Sev 1/2 quality defect, per-file business line coverage at or above 80%, zero-skip canonical PostgreSQL/browser/coverage parents, complete OSS and security review, WCAG 2.1 AA evidence, an independent score at or above Good, and traceable disposition of every Sev 3 finding.

Residual maintainability is tracked by #87, dependency freshness by #93, and coverage/skip/timing hardening by the Ring 3 test-improvement issue. None authorizes later-ring scope.
