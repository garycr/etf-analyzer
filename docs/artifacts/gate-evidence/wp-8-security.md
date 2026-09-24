# WP-8 PT-SEC-001 Security Evidence

**Date:** 2026-09-23
**Scope:** Dependency, secret, SAST, OSS, and redaction gates only
**Status:** Accepted under DEC-085, REV-192, and REV-193

## Executable Gates

| Control | Result |
| --- | --- |
| Dependency audit policy | PASS; 0 Info, Low, Moderate, High, or Critical across 30 dependencies |
| Moderate disposition policy | PASS; no current Moderate finding; any future finding requires unique package/advisory source, owner, rationale, and unexpired disposition |
| SAST adversarial controls | 2/2 PASS; zero skips |
| Banned-function source guardrail | PASS; zero findings across all JavaScript/TypeScript executable extensions |
| Secret-signature controls | 2/2 PASS; zero skips |
| Current, staged, untracked, and full-history secret scan | PASS; zero unapproved findings |
| Focused build and redaction controls | 11/11 PASS; zero skips |
| CI integration | PASS; security checkout fetches full history and runs all three security gates |

The source guardrail rejects child-process acquisition through static import, `require`, aliased loaders, and dynamic import; dynamic or aliased `eval`/`Function`; malformed source; and source symlinks. It scans `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and `.cts`. Regular-expression `.exec()` remains allowed. This is a bounded banned-function control, not general taint-flow SAST. DEC-087 adds pinned CodeQL JavaScript/TypeScript analysis as the broader semantic control.

## Review-Hardening Addendum

DEC-087 adds a distinct commit-pinned CodeQL JavaScript/TypeScript job and a fail-closed security evidence runner. The runner captures raw stdout and stderr for dependency audit, full-history secret scanning, and the bounded banned-function guardrail, then records byte counts and SHA-256 digests under exact GitHub commit, repository, workflow, job, ref, run, and attempt identity. CI uploads the bundle even when a gate fails and retains it for 90 days.

Local verification passed all three gates and independently recomputed every raw-stream byte count and digest. Pushed CI run 35902418187 passed all jobs and steps, including CodeQL with no alerts. Its downloaded artifact matched commit `8c362813f1ae3e7857971cba66c6c739d9daa20a`, repository, workflow, job, ref, run, attempt, and every recorded raw-stream byte count and SHA-256 hash. RH-011 and RH-012 are technically remediated and await DP-33 reviewer confirmation; this addendum does not retroactively alter REV-192 or REV-193.

The secret gate scans every blob/path in every reachable commit, exact staged index blobs, and tracked or untracked working files. It includes binary bytes and lockfiles and fails closed on Git or file errors. Signatures cover private keys, AWS, GitHub, GitLab, npm, OpenAI, Slack, credential-bearing database URIs, bearer/JWT, and Azure-like keys. Five exact synthetic PostgreSQL fixture fingerprints are allowlisted only at reviewed test/evidence paths with owner, rationale, and 2027-09-23 expiry; copying the same value elsewhere fails.

## Dependency And License Review

WP-8 introduced no package version, lock integrity, runtime dependency, or transitive dependency change. The only package metadata changes were test/security scripts and the Node 20.1 built-in-coverage floor.

| Package | Version | License | Disposition |
| --- | --- | --- | --- |
| `pg` | 8.16.0 | MIT | Existing exact runtime dependency; PASS |
| `typescript` | 5.9.2 | Apache-2.0 | Existing exact development dependency; PASS |
| `playwright` / `playwright-core` | 1.63.0 | Apache-2.0 | Existing exact test dependencies; PASS |
| `@axe-core/playwright` / `axe-core` | 4.13.0 | MPL-2.0 | Existing exact unmodified test-only dependencies; prior weak-copyleft disposition remains valid |

## Redaction Evidence

Focused controls passed for PT-UI-010, both PT-OPS-001 evaluator outcomes, recursive structured-log field redaction, configured PostgreSQL URL redaction, owner-code fixed causes, API unknown-sensitive failures, authorization audit redaction, and readiness error redaction. PostgreSQL operations evidence retains full connection-string suppression and checks the exact password only when nonempty, allowing CI's passwordless local service without the empty-string assertion defect.

## Review History

- Initial independent Security Review: CONDITIONAL on SAST bypasses, narrow secret scanning, and unenforced Moderate disposition.
- Initial independent Code Review: FAIL on SAST aliases, shallow/current-only secret coverage, audit fail-open behavior, and policy expiry/identity gaps.
- Subsequent reviews exposed passwordless redaction assertion, shallow checkout, staged/history provenance, lockfile/binary omission, audit reconciliation, and dynamic import/global alias edge cases.
- Remediation replaced fragile text scanning with TypeScript AST and Git object-model controls, strengthened audit schema/policy enforcement, broadened token signatures, and added adversarial tests.
- Final Security Review REV-192: PASS with no remaining Critical, High, or Medium finding.
- Final Code Review REV-193: PASS with no blocking finding.
- Aggregate Ring 2 hardening subsequently opened RH-011/RH-012; DEC-087 now has successful pushed CI and downloaded artifact evidence, with DP-33 reviewer confirmation pending.

## Boundary

This evidence supports PT-SEC-001 only. It does not close WP-8, DP-33, Ring 2, release, deployment, or production. It adds no runtime dependency, endpoint, service, migration, public ingress, provider, broker, queue, or durable handoff. Greenfield PostgreSQL remains the only persistence target; no SQL Server migration or conversion is authorized. REV-164 and the original CT-DB-001K evidence remain invalidated history.
