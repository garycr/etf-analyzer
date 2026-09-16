# WP-3 Application Replay Evidence

**Date:** 2026-09-16
**Scope:** PT-APP-001N deterministic application command replay distinct from owning idempotency
**Result:** PASS

## Executed Behavior

The replay boundary accepts only the exact command envelope, reuses duplicate-aware raw JSON parsing, requires the local prototype actor and exact contract versions, and rejects queries or unknown members before callbacks. The replay key is exactly `(operation, commandId)`. RFC 8785 replay content includes only operation, actor, prototype candidate, contract version, and complete payload; invocation, correlation, command, and timestamp identities are excluded.

An injected `ApplicationReplayStore` owns the atomic replay decision. Equivalent content returns the original result or throws the original owner error by identity without payload admission, readiness, or owner dispatch. Different content returns `APPLICATION_IDEMPOTENCY_CONFLICT` before those callbacks. New keys validate and normalize payloads, then call readiness and the owning contract. Owner-specific replay conflicts remain unchanged.

The synchronous in-memory reference store reserves a key before execution, preventing same-key reentrant duplication. It caches both returned and thrown outcomes. Analytics evidence identities are sorted for semantic replay comparison and again before owner dispatch. Different operations with the same command ID remain distinct.

## Test-First Evidence

- Red: focused load failed because the replay API did not exist.
- Initial green proved exact feature-vector replay, changed-content conflict, and unchanged owner conflict.
- Review remediation proved equivalent Analytics identity ordering replays, thrown owner outcomes are cached, and changed malformed content conflicts before payload admission.
- Reentrancy red reproduced duplicate synchronous owner execution; an in-flight reservation reduced readiness and owner entry to exactly one and cached the resulting failure.
- Malformed, unauthorized, duplicate-bearing, extra-member, and query envelopes dispatch neither readiness nor owner callbacks.
- Focused final build/test: 3/3 passed.
- Complete default suite: 313 discovered, 283 passed, 30 PostgreSQL environment skips, zero failed.
- TypeScript lint and changed-file diagnostics: PASS.
- Dependency audit: 0 vulnerabilities.
- `git diff --check`: PASS.

## Review

Alternate-model Code Review returned final PASS after closing all Major and Minor findings; test quality was 9.4/10. Alternate-model Security Review returned PASS with no severity finding. Its informational notes bind future persistent adapters to bounded retention and atomic cross-process reservation.

This closes PT-APP-001N only. PT-APP-001O error precedence, PT-APP-001P complete result composition, WP-4 surfaces, distributed replay persistence, live providers, release, deployment, and production authority remain open.
