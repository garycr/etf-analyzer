# REV-010 - Financial Precision Options Review

**Date:** 2026-09-10
**Decision scope:** GitHub #9/#20 financial precision, rounding, arithmetic, and reconciliation policy
**Reviewer:** Architect Reviewer
**Final verdict:** APPROVED
**Architecture status:** Proposed; no ADR or option accepted

## Authority

- DEC-006 bounded financial precision policy
- DEC-011 immutable/reversing FIFO and exact reconciliation floor
- Objective O-CST-007 and O-MET-004
- Proposed ledger and reconciliation architecture views

## Review History

The initial review returned **IMPROVEMENTS IDENTIFIED** with four Major and one Minor issue:

1. Incorrect `NUMERIC(p,s)` integer-headroom claims and unproven coupled formula bounds.
2. Incomplete division, residual allocation, operation-order, and reversal arithmetic.
3. Underspecified TypeScript/Python/PostgreSQL canonicalization and pre-cast validation.
4. Insufficient concrete pre-selection comparison vectors.
5. Conflated exact reconstruction with fidelity and unqualified efficiency statements.

## Remediation Closure

| Finding | Result |
| --- | --- |
| Numeric headroom and coupled bounds | Closed - exact `p-s`, ULP, maximum-value formulas and independently enforced workload bounds added |
| Arithmetic and quantization | Closed - arbitrary-precision integer coefficients, quotient/remainder rounding, final residual allocation, deterministic summation, and stored-effect reversal defined |
| Cross-language/database determinism | Closed - strict ingress grammar, canonical fixed-point strings, signed-zero normalization, controlled PostgreSQL writes, and pre-cast validation defined |
| Pre-selection evidence | Closed - option-specific positive/negative ties, ULP neighbors, bounds, scale rejection, column overflow, and allocation example added |
| Comparison wording | Closed - exact rebuild separated from retained fidelity; storage/arithmetic differences identified as unmeasured expectations pending Ring 2 benchmarks |

An independent arithmetic audit returned PASS after remediation.

## Final Assessment

No Critical, Major, Minor, or Nit findings remain. Options A, B, and C are viable bounded policies under their documented assumptions and invalidation criteria. Option A is a defensible recommendation because it combines semantic field classes, sufficient coupled workload headroom, half-even rounding, retained research fidelity, and explicit fail-closed boundaries.

The options artifact is ready for Workspace Owner selection. This approval does not select an option, accept an ADR, freeze baseline `v1.0.0`, close #9/#20, authorize implementation, or release parallel work.
