# REV-015 - Analytics Prototype Re-scope Plan Review

**Date:** 2026-09-11
**Decision:** DEC-020 prototype-scoped analytics acceptance
**Reviewer:** Plan Reviewer
**Review model:** Claude Opus 5 (alternate to the producing model)
**Verdict:** IMPROVEMENTS IDENTIFIED AND ACCEPTED

## Review Summary

The reviewer affirmed that a first end-user prototype can defer permutation breadth without removing the canonical requirements for point-in-time truth, reproducibility, bounded decimal behavior, fail-closed publication, least privilege, and accessible blocking states. The Workspace Owner approved the refined minimum set and kept candidate.2 governance synchronization in #64 deferred.

## Accepted Refinements

- Retain authorization before input evaluation before integrity validation so unauthorized callers cannot infer data state.
- Retain both idempotency branches: equivalent replay returns the original without a second write, while changed canonical content under the same command identity fails without state change.
- Retain half-even quantization, negative-zero canonicalization, and declared bounds only for numeric surfaces displayed by the prototype.
- Require one deterministic, non-overwriting transformation vector if a displayed rule uses forward-fill, alignment, lag, interpolation, or resampling.
- Require rights-restricted Degraded behavior when the prototype first connects to a real provider.
- Use existing CT-ANA identifiers and label the selection as a prototype subset; do not create new test identifiers.
- Keep RET-A-1.0 field binding in retained hash fixtures while deferring restore, re-deletion, and shared-input deadline breadth.
- Make the prototype issue explicitly insufficient for whole-prototype acceptance or Ring 2 advancement.

## Prototype Minimum Set

| Existing check | Prototype assertion | Source |
|---|---|---|
| CT-ANA-001 | Reproduce exact input, configuration, result, bundle, and manifest hashes from the pinned P0 fixture | #59 |
| CT-ANA-002 | Select the latest eligible economic vintage at or before `T`; exclude `T+1ms` | #60 |
| CT-ANA-003A | Select the latest eligible market revision and fail on absent total order | #60 |
| CT-ANA-005 | Mutating one input, configuration parameter, or result changes only applicable hash domains | #60 |
| CT-ANA-006 | Missing required input blocks the run, suppresses the instrument, and publishes nothing | #58 |
| CT-ANA-010 | A valid no-signal result is programmatically distinct from a blocked run | #58 |
| CT-ANA-008 | Hash verification failure quarantines evidence and blocks dependent actions | #58 |
| CT-ANA-009 | Commit-boundary failure leaves no visible partial bundle or manifest and preserves the current result | #60 |
| CT-ANA-014 | Equivalent replay creates no second write; conflicting replay fails without state change | #60 |
| CT-ANA-013 | Unauthorized implemented operations fail with a durable redacted denial before input state is examined | #62, #57 |
| CT-ANA-019 | Denial-audit failure preserves denial and exposes a stable audit-failure code | #62 |
| CT-ANA-018 | Displayed numeric surfaces use bounded decimal grammar, one boundary half-even quantization, and canonical negative zero | #57 |
| Accessibility subset | Reachable blocked, denied, quarantined, and no-signal states use programmatic and non-color status, keyboard recovery or escalation, and the research-only disclaimer | #62 |
| CT-ANA-004, conditional | A transformation-bearing displayed series has a deterministic output hash and never overwrites its source | #60 |

## Deferred Boundary

The full rank matrix, exhaustive numeric and schema permutations, generalized lineage, every atomic and concurrency permutation, publication-version conflict, retention restore/re-deletion/shared-input deadline scenarios, the 7x7 authority matrix, inaccessible future failure-state permutations, and all #61 numbering/registry normalization remain post-prototype work.

Candidate.2 synchronization under #64 remains deferred by explicit Workspace Owner decision. Until #64 is approved and completed, the prototype-scoped acceptance issue cannot pass. Full REV-014 remains FAIL, and this review does not authorize implementation, baseline freeze, issue #15/#11 closure, Ring 2 advancement, or parallel execution.
