# Ring 2 Review-Hardening Campaign

**Date:** 2026-09-23  
**Scope:** WP-8 committed state through `a714f07`, followed by bounded remediation  
**Disposition:** FAIL - remediation in progress  
**Critical findings:** 0

This campaign does not close WP-8, DP-33, or Ring 2 and does not authorize Ring 3, release, deployment, production, public ingress, provider/broker work, or SQL Server migration/conversion.

## Independent Reviews

| Review | Initial disposition | Critical | Major | Minor |
| --- | --- | ---: | ---: | ---: |
| Code | FAIL | 0 | 2 | 1 |
| Architecture | CONDITIONAL | 0 | 5 | 3 |
| Security | FAIL | 0 | 3 | 3 |
| Test quality | CONDITIONAL | 0 | 3 | 2 |

No review returned unconditional PASS. Slice-level reviews remain historical inputs but do not replace this aggregate campaign.

## Finding Disposition

| ID | Severity | Finding | Current disposition |
| --- | --- | --- | --- |
| RH-001 | Major | Sixteen-route coverage resolved only route lookup | Remediated in test: all 16 requests now execute adapter reconstruction, dispatch, exact envelope, and response status; focused test passes |
| RH-002 | Major | Canonical CT-DB-001K/L parents absent | Remediated in aggregate: exact K/L parents pass 2/2 with zero skips on fresh pinned PostgreSQL |
| RH-003 | Major | Accepted evidence contains conflicting migration identities | Remediated under DEC-086: reproducible roots are normative, stale evidence is marked superseded, and canonical A-L passes 12/12 with zero skips |
| RH-004 | Major | PT-E2E artifact and REV-184 were future-dated | Remediated: metadata corrected to the verified 2026-09-23 session date |
| RH-005 | Major | Mandatory runners do not universally fail on skip/todo/cancelled | Remediated: shared runner rejects fail/cancelled/skipped/todo and is wired to PostgreSQL and browser parent commands; unset PostgreSQL URL rejects 12 skipped parents |
| RH-006 | Major | Architecture views represented future Kubernetes/worker/outbox state as current | Remediated: proposed views are explicitly future-state and implemented WP-8 overlay is published |
| RH-007 | Major | Complete composition exists only in integration assembly | Open for DP-33 disposition: executable integration candidate has no product launcher/composition root |
| RH-008 | Major | Observability claim exceeds implemented capability | Remediated in architecture: bounded test observations are separated from absent retained telemetry pipeline |
| RH-009 | Major | DP-33 aggregate packet and owner disposition absent | Open by design; packet may start only after exit controls pass |
| RH-010 | Major | Threat model was an empty template | Remediated: implemented-boundary STRIDE model now records mitigated, accepted, and open risks |
| RH-011 | Major | “Production SAST” claim exceeded custom scanner | Remediation implemented under DEC-087: bounded guardrail retained and distinct commit-pinned CodeQL analysis added; pushed CI result and independent re-review pending |
| RH-012 | Major | Security evidence lacks commit-bound raw provenance bundle | Remediation implemented under DEC-087: CI always uploads raw stdout/stderr with SHA-256, byte counts, and exact commit/run/job identity; pushed artifact verification and independent re-review pending |
| RH-013 | Minor | PT-OPS passes empty workflow-count maps | Open: exact counts exist in PT-E2E but must be composed into PT-OPS evidence or its claim narrowed |
| RH-014 | Minor | Full transitive OSS inventory incomplete | Open: lockfile-derived license/maintenance/lifecycle inventory required |
| RH-015 | Minor | CI runner and Node selector remain mutable | Open: pin runner generation/exact Node patch or record owner acceptance |
| RH-016 | Minor | Same-user process can forge local Host/Origin; no rate limit | Accepted only for current local prototype; per-launch token and concurrency/rate limit required before boundary widening |
| RH-017 | Minor | A-L wrappers parse child TAP and large owner files reduce maintainability | Open debt; structured owner scenario results preferred |

## Executable Remediation Evidence

- `CT-API-001B adapts all 16 reviewed routes through application dispatch`: 1 passed, 0 failed.
- Exact canonical A-L parents on fresh digest-pinned PostgreSQL and pinned Node 20: 12 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo; container removed.
- TypeScript lint: PASS.
- Editor diagnostics for both changed test files: no errors.
- Seven-row manifest reconciliation: deterministic across Node 20/24 and trust/password bootstrap shapes; normative roots corrected under DEC-086.
- Focused independent Code Reviewer follow-up for DEC-086/RH-003/RH-005: PASS with no remaining bounded finding.
- DEC-087 local security provenance run: three gates passed; manifest commit matched HEAD; all six raw streams matched recorded byte counts and SHA-256 digests; unit contract 3/3 passed.
- Focused independent Security Reviewer follow-up for DEC-087: CONDITIONAL with no Critical or Major implementation defect; pushed CodeQL and downloaded artifact verification remain required.

## Gate Result

Review hardening remains **FAIL** because RH-007, RH-009, RH-011, and RH-012 remain open Major findings. RH-011/RH-012 now await pushed CI evidence and independent re-review; no finding closes from local implementation alone. DP-33 packet preparation remains blocked on exit-control disposition.

REV-164 and the original CT-DB-001K evidence remain invalidated history. Greenfield PostgreSQL is the sole persistence target.
