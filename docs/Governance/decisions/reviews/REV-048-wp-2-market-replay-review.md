# REV-048: WP-2 Market Replay Review

**Date:** 2026-09-15
**Reviewer:** Code Reviewer dispatch using alternate model Claude Sonnet 5
**Scope:** PT-FIX-001B/C five-part market identity and deterministic replay
**Result:** PASS

## Disposition

The application boundary identifies market observations by the exact five-part tuple `(instrumentId, tradingDate, providerId, adjustmentPolicy, revision)`. Identity keys use canonical JSON arrays rather than delimiter concatenation. Byte-identical canonical rows collapse to one logical observation and increment explicit idempotent replay evidence. Reusing the five-part identity with any changed canonical content, including a changed ingestion-job identifier, fails closed with `FIXTURE_IDEMPOTENCY_CONFLICT`.

The initial alternate-model review rejected a redundant parallel job-key map and requested stronger proof. Remediation removed the mathematically redundant map: dataset identity is invariant within one package, while ingestion-job identity is part of canonical record content, so the five-part identity plus payload equality is the stricter package invariant. Tests now prove cumulative replay counting, changed-value conflict, and changed-job conflict. The final recheck returned PASS with no blocking finding.

## Boundary

This review accepts only in-memory PT-FIX-001B/C market identity and replay behavior. It does not accept persistence, economic replay, temporal or numeric validation, coverage completion, data-quality suppression, multi-defect ordering, provider egress, PT-FIX-001D..G or J..O, complete WP-2, legacy migration, WP-3, release, deployment, or production action.
