# REV-143 - WP-7 Analytics and Evidence Code Review

**Date:** 2026-09-21
**Reviewer:** Code Reviewer agent (Claude Sonnet 5)
**Scope:** PT-UI-005 implementation and tests
**Disposition:** CONDITIONAL PASS for the fixture-only prototype slice

## Findings

No Critical finding applies to the delivered PT-UI-005 behavior.

The initial Major finding that generic owner failures were mislabeled as integrity failures was remediated. Unknown or unsupported analytics/evidence owner failures now use the reviewed `NoSafeOperation` presentation, preserve successful widgets, and do not expose owner messages.

The reviewer identified two real-provider concerns outside the delivered fixture-only slice:

1. The existing Application `EvidenceGet` success validator accepts only `Complete` evidence with a null reproducibility reason. A lower-layer `Degraded` evidence record therefore cannot become a successful Application projection.
2. `ANALYTICS_RIGHTS_RESTRICTED` currently uses the generic `NoSafeOperation` presentation rather than a rights-specific workbench state.

DEC-020 and the approved WP-7 boundary do not authorize live providers or broaden the closed Application contract. These concerns are deferred to a future real-provider/evidence-contract change and do not block the fixture-only PT-UI-005 acceptance. They must be revisited before rights-restricted or degraded evidence is claimed as a supported browser workflow.

## Security And Correctness

- Analytics scores, metric values, warnings, evidence identity, status, and timestamps remain strings; rendering performs no numeric conversion.
- Every rendered owner value is HTML-escaped.
- Owner failure messages are discarded. Only reviewed blocked-state text reaches the document.
- Quarantined, denied, publication-blocked, and no-signal paths remain distinct in the workbench model.
- A blocked analytics/evidence widget does not collapse readiness, watchlist, or successful neighboring widgets.

## Test Quality

The PT-UI-005 test is deterministic, isolated, behavior-focused, and uses fixed clocks and identifiers. It covers successful canonical rendering, verified no-signal, access denial, quarantine, generic publication blocking, and redaction. Its weighted seven-dimension score is 4.05/5 (Excellent). Failure specificity and maintainability remain Minor concerns because multiple acceptance scenarios share one integration test.

## Residual Risk

PT-ANA-A11Y-001 retains real-DOM role, focus, keyboard, non-color, and recovery verification. PostgreSQL environment skips remain a WP-7 closure condition. Degraded and rights-restricted real-provider presentation is not claimed by this review.

## FinOps

Estimated review cost was below $0.15. Provider token telemetry and exact pricing are unavailable. Runtime product AI cost is $0.
