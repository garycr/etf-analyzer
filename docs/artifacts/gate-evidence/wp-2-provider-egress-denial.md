# WP-2 Provider Egress Denial Evidence

**Date:** 2026-09-15
**Scope:** PT-FIX-001O application-level provider egress denial with no fixture substitution
**Result:** PASS; approved for bounded publication

## Executed Behavior

A valid golden fixture package is loaded under explicit fixture-only configuration. Product-provider DNS-resolution and network-connection attempts both throw `ProviderEgressDeniedError` before the supplied transport callback executes. Evidence records `outcome: "denied"` and `successfulConnections: 0`, and the evidence object is immutable.

A credential-bearing endpoint proves denial evidence retains only `https://provider.example.test`, excluding user information, path, query, and fragment. An unparseable endpoint containing sensitive material produces `[REDACTED]`. The shared transport counter remains zero across all attempts, and the validated fixture package remains byte-for-byte structurally unchanged.

## Validation

- Initial test-first check: 1 discovered, 0 passed, 1 failed because the provider-egress guard API did not exist.
- Final focused PT-FIX-001O check: 1 discovered, 1 passed, 0 failed, 0 skipped.
- Complete repository suite: 292 discovered, 262 passed, 30 environment-skipped, 0 failed.
- TypeScript build and lint passed.
- Editor diagnostics reported no changed-file errors.
- `npm audit --audit-level=low` reported zero vulnerabilities.
- `git diff --check` passed.
- REV-058 final alternate-model Code Reviewer recheck returned PASS with no open findings.
- Test-quality weighted composite: 4.63/5.0, Excellent.

## Boundary

This evidence does not claim deployment-level firewall, container network policy, egress proxy, or production-provider enforcement. No such deployment artifact exists in this prototype repository. Complete WP-2 approval, legacy migration, release, deployment, and production action remain outside this bounded evidence.
