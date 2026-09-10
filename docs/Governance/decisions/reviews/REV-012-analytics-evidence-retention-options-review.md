# REV-012 - Analytics Evidence Retention Options Review

**Date:** 2026-09-10
**Scope:** GitHub #15/#11 analytics evidence retention policy options
**Artifact:** `docs/Planning/analytics-evidence-retention-options.md`
**Architecture reviewer dispatch:** `Claude Opus 5 (copilot)` process evidence only
**Security reviewer dispatch:** `GPT-5.6 Sol (copilot)` process evidence only
**Final verdict:** PASS; ready for Workspace Owner policy selection

## Initial Review

The Architect Reviewer returned REVISE with one Critical, eleven Major, and seven Minor findings. The Critical gap was that retaining a bundle reference without retaining its point-in-time snapshot and selected vintages could not satisfy reproducibility. Major findings covered immutable policy binding, UTC epoch semantics, deletion certificates, terminal lifecycle, integrity/key continuity, backup resurrection, export scope, corrupt-evidence destruction, capacity magnitude, irreversibility, and named test vectors.

The Workspace Owner approved all remediation groups. GitHub #34-#42 captured the work and are closed as completed.

## Closure Evidence

| Area | Final disposition |
| --- | --- |
| Reproducibility inputs | Full bundles co-retain normalized point-in-time snapshots, selected vintages, transformation lineage, and portfolio context; rights restrictions produce fail-closed `Degraded` status |
| Policy binding | `retentionPolicyVersion` and database-generated UTC `retentionEpoch` are immutable at creation |
| Integrity | RFC 8785 canonical bytes and SHA-256; explicitly independent of DEC-016 ledger HMAC keys |
| Deletion | Canonical chained certificate, closed authority/outcome vocabularies, partial/failure behavior, corrupt-evidence quarantine, and non-recursive terminal deletion |
| Backup/export | Backup tail capped at 30 days; restore re-applies certificates before readiness; user-owned exports are explicitly outside managed deletion |
| Capacity | Hot/archive formula, worked example, 10/25/75 GiB envelopes, Team Lead 80% alert, and 100% fail-closed behavior |
| Verification | CT-RET-001..012 plus CT-ANA-001 are mandatory Ring 2 executable evidence |
| Accessibility | Programmatic non-color blocked states, plain reasons, redacted messages, and keyboard-operable recovery/escalation |

## Final Reviews

The Architect Reviewer recheck passed with no Critical, Major, or unresolved Minor findings. Arithmetic for the three storage estimates passed, WAF scored 4.0/5, and the artifact was cleared for human selection.

The Security Reviewer returned APPROVED / PASS with no Critical, Major, or blocking Minor findings. Rights degradation, sensitive-field exclusions, least privilege, key independence, deletion authority, corruption handling, backup/restore, export warning, manual freeze, accelerated deletion, capacity blocking, and CT-RET coverage were accepted at design stage.

## Boundary

REV-012 approves the options artifact for selection; it does not select a policy, accept an ADR, authorize implementation, approve provider ingestion, freeze the contract baseline, advance Ring 2, or release parallel execution. If the selected policy is captured as an ADR, DP-12 Workspace Owner approval remains mandatory.
