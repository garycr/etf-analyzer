# REV-014 - Analytics Evidence Contract Test Review

**Date:** 2026-09-11
**Artifact:** `docs/Planning/contracts/analytics-evidence-contract.md` candidate `1.0.0-candidate.1`
**BDD artifact:** `specs/features/Analytics-Evidence-Reproducibility.feature`
**Reviewer dispatch:** `Claude Opus 5 (copilot)` process evidence only
**Verdict:** FAIL (design-time)
**Composite test-quality score:** 3.89 / 5

This header records the historical full review of candidate.1. Candidate.2 scoped rechecks below do not replace or upgrade that full-review verdict.

## Review Sequence

Team Lead custody initially failed candidate.1 on four Major findings. Workspace Owner-approved remediation #48-#51 corrected the result schema/hash chain, market/corporate-action availability cutoff, least-privilege behavior, and exact BDD hash assertions. Team Lead recheck passed.

Alternate-model Code Review then required closed hash-bearing schemas, deterministic idempotency/concurrency/precedence, DEC-014 numeric allocation, and deterministic denial auditing. Workspace Owner-approved remediation #52-#55 was applied, executable golden-vector validation passed, and Code Reviewer recheck approved the candidate. Administrative registry correction #56 was approved and applied.

## Test Review Findings

The independent Test Reviewer scored the design 3.89 / 5 with no quality dimension below 3, but returned FAIL because the named compatibility evidence was not complete enough for independent implementation and baseline use. Findings were grouped into these open remediation packages:

- #59: canonical-null fixture semantics, bundle/manifest/lifecycle/transformation hash domains, schema-version binding, golden metadata, and #17 invalidation;
- #60: inclusive point-in-time boundaries, schema negatives, mutation propagation, atomic-failure points, concurrency, and prohibited-field vectors;
- #57: parameter grammar, exact numeric/bound/trade vectors, and concrete precedence matrix;
- #62: operation-authority matrix, denial-audit recovery, and accessibility status/recovery evidence;
- #58: expanded BDD plus retention, restore, and shared-input linkage; and
- #61: contiguous CT-ANA numbering and registry coverage.

The current input, configuration, and result digests were independently recomputed by the Solo Orchestrator before review. REV-014 therefore treats the reviewer's digest-verification limitation as a documentation/reproducibility-metadata gap, not evidence that the published digests are numerically wrong.

## Itemized Finding Reconstruction

The original candidate.1 Major findings and their candidate.2 dispositions are preserved here for independent reconstruction:

| Finding | Candidate.1 finding | Candidate.2 disposition |
| --- | --- | --- |
| TR-ANA-M1 | Canonical-null and opaque/computed fixture policy | PASS in scoped recheck |
| TR-ANA-M2 | `inputSchemaVersion` binding | PASS in scoped recheck |
| TR-ANA-M3 | String-only parameter numeric grammar | PASS in scoped recheck |
| TR-ANA-M4 | Cross-run hashes versus pinned per-commit bundle/manifest semantics | PASS in scoped recheck |
| TR-ANA-M5 | Lifecycle and transformation hash domains | PASS in scoped recheck |
| TR-ANA-M6 | Seven exact fixture strings, byte lengths, digests, and chain references | PASS in scoped recheck |
| TR-ANA-M7 | Concrete validation-precedence coverage | Open as post-prototype breadth in #57-#62 |
| TR-ANA-M8 | Closed-schema negative, mutation, atomic-failure, and concurrency coverage | Open as post-prototype breadth in #57-#62 |
| TR-ANA-M9 | Exact numeric, bound, chained-transform, and trade vectors | Open as post-prototype breadth in #57-#62 |
| TR-ANA-M10 | Operation-authority and runtime-ceiling matrix | Open as post-prototype breadth in #57-#62 |
| TR-ANA-M11 | Denial-audit recovery and accessible status/recovery evidence | Open as post-prototype breadth in #57-#62 |
| TR-ANA-M12 | Inclusive cutoff, latest-eligible selection, transformation ordering, and cycle rejection | PASS in scoped recheck |
| TR-ANA-M13 | Expanded BDD and retention/restore/shared-input linkage | Open as post-prototype breadth in #57-#62 |
| TR-ANA-M14 | #17 invalidation and fixture total-order boundary | PASS in scoped recheck |

Candidate.2's first scoped recheck passed M1-M6/M12/M14 and allowed the artifact to stand as a reviewed intermediate. That recheck raised R-1..R-5: standalone transformation labeling, canonical source-observation identity encoding, non-null portfolio-context hash domain, numeric fixture revision ordering, and canonical date-only formatting. Workspace Owner-approved #63 corrected all five. A final narrow Test Reviewer recheck returned PASS with no residual integrity blocker, and #63 closed. Custody observations C-1..C-3 are completed by CC-002 and the candidate.2 registry/review synchronization.

The seven candidate.2 fixture vectors were executable-revalidated after synchronization. Exact evidence and before/after contract and BDD digests are recorded in `docs/Planning/contracts/evidence/CC-002-analytics-candidate-delta.md`.

## Disposition

The Workspace Owner initially selected **Defer remediation** on 2026-09-11 after receiving the full-remediation estimate of 70k-110k additional tokens and $0.55-$0.95, then approved gate blockers first and #63. Candidate.2 is a reviewed intermediate for prototype-scoped acceptance #65. The full REV-014 verdict remains FAIL, and #57-#62 remain open as post-prototype work under DEC-020.

## Boundary

This disposition does not authorize implementation, dependency installation, architecture acceptance, issue #15/#11 closure, contract or aggregate baseline freeze, Ring 2 advancement, or parallel execution.
