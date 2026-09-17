# REV-102 - WP-5 Deterministic Analytics Security Review

**Date:** 2026-09-17
**Reviewer:** Security Reviewer, independent agent
**Scope:** Identity, authorization, denial audit, canonical integrity, resource admission, and PostgreSQL composition
**Result:** PASS

## Findings

No Critical or Major findings remain. Remediation replaced caller-asserted actors with a trusted identity port, bound commit authority to the evidence identity, normalized identity and authorization failures through the redacted audited-denial path, and removed arbitrary JavaScript request objects from the service boundary.

The final service accepts primitive evidence identifiers and bounded JSON text. It applies the 1 MiB UTF-8 limit before parsing, parses once, validates a bounded plain-data graph, and passes only that snapshot through authorization and persistence. Unknown hash domains fail closed. Decimal, revision, collection, transformation, identifier, lookback, and reproducibility-reason limits apply before expensive conversion or traversal.

## Positive Controls

Deferred-authorization tests prove caller mutation cannot change an authorized operation. Malformed, oversized, non-string, and proxy payloads fail before authorization or persistence without leaking adapter details. PostgreSQL functions retain hardened owners/search paths, denied PUBLIC execution, atomic rollback, replay conflict handling, complete-only publication, and tamper detection.

## Residual Risk

The prototype remains fixture-only, local, single-runtime, and inactive. Any public ingress, live provider, multi-user execution, or changed publication owner invalidates this review and requires renewed threat modeling.
