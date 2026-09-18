# REV-133 - WP-6 Restore Integrity Architecture Review

**Date:** 2026-09-18
**Reviewer:** Architect Reviewer agent using GPT-5 mini, independent review
**Scope:** ADR-002 signed backup manifests, durable restore gating, retained-chain verification, and rotation continuity
**Disposition:** PASS

## Findings

No Critical or Major architecture finding remains. The accepted design uses PostgreSQL 16 shared/exclusive transaction advisory locks on one global integrity key, a DB-derived HMAC-signed manifest bound to one exported repeatable-read backup snapshot, and separately committed begin and verify phases. Failed verification cannot restore readiness because the prior `NotReady` transition remains committed.

The global gate intentionally covers all portfolios and the shared audit chain. Verification authenticates the manifest before trusting fields, validates complete retained portfolio and audit chains and historical keys, performs an exact authoritative rebuild without requiring a pre-existing projection, and resumes immutable predecessor/successor rotation evidence deterministically. Runtime identities receive no restore bypass or key access.

## Evidence

- ADR-002 accepted candidate with explicit PostgreSQL 16 lock and snapshot APIs.
- DEC-016 and CT-LED-019 recovery requirements mapped without production scope expansion.
- WAF assessment: Security 4/5, Reliability 4/5, Performance 3/5, Operational Excellence 3/5, Cost Optimization 3/5; overall 3.4/5.
- Architecture diagnostics: clean.

## Residual Risk

Full retained-history verification is intentionally offline and may challenge the four-hour RTO as history grows. Production KMS/unwrap, key destruction, and long-running verification telemetry require separate decisions if the local prototype scope changes. These are nonblocking for test-first #82 implementation.
