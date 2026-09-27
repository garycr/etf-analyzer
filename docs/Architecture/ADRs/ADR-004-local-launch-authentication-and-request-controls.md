# ADR-004 - Local Launch Authentication And Request Controls

**Status:** Accepted by DEC-097; REV-207, REV-208, and REV-209 PASS
**Date:** 2026-09-26
**Decision owner:** Agent under Fully Agentic mode
**Accountable custodian:** Solo Orchestrator
**Related:** DEC-095; issue #89; ADR-003

## Context

The supported workbench binds only to literal IPv4 loopback, but another process on the same host can still reach a known port. The local runtime also needs bounded behavior under slow or excessive requests without introducing a queue, worker, external identity provider, or public ingress.

## Decision

- Generate a fresh 256-bit token with `randomBytes(32)` for every launcher process.
- Keep the token out of disk configuration and HTTP request targets. Print it only in the launch URL fragment and send it from the browser as `X-Launch-Token`.
- Require exact lowercase hexadecimal token syntax and compare fixed SHA-256 digests with `timingSafeEqual`.
- Apply Host, Origin, and token guards before request-body buffering. Return one fixed, redacted `401` for absent, malformed, or incorrect tokens.
- Exempt only `GET /`, `GET /workbench.js`, and valid CORS preflight from token and capacity admission so the browser can bootstrap.
- Admit authenticated API requests through an in-memory, zero-queue concurrency cap and fixed-window request budget. Return one fixed, redacted `429` when either limit is exhausted.
- Release concurrency capacity idempotently on normal completion, timeout, error, abort, or incomplete connection close.
- Require explicit `maxConcurrentRequests`, `requestRateLimit`, and `requestRateWindowMs` values in the supported local launcher configuration.

## Consequences

The supported local runtime resists unauthorized same-host requests and bounds authenticated request work without new dependencies or durable handoff. A fixed window can permit a bounded burst across a window boundary; the concurrency cap remains authoritative during that burst. Direct adapter test harnesses may omit authentication, but `LocalRuntimeConfig` requires a launch token and the launcher always generates one.

The fragment remains visible to the local operator and same-page script. This is acceptable only for the current single-user, trusted-host boundary.

## Invalidation

Revisit this decision before public ingress, a shared or untrusted host, multiple users, remote clients, TLS termination, durable sessions, distributed replicas, or production deployment. Those conditions require a real identity/session design and a distributed rate-control strategy.

## Decision Boundary

This ADR authorizes only local fixture-based hardening on `127.0.0.1`. It does not authorize promotion, staging, deployment, release, production, provider access, brokerage, or multi-user identity.
