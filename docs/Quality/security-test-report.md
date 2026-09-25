# Ring 3 Security Test Report

**Date:** 2026-09-25  
**Commit:** `2b8a21d4ad55ea489eed9546824a64f161c3a1d6`  
**CI run/attempt:** 36168279046 / 1  
**Independent review:** REV-203  
**DP-32 status:** ACCEPT for the implemented prototype boundary

## Executed Controls

| Control | Result |
| --- | --- |
| Dependency audit | PASS; zero vulnerabilities across 30 external packages |
| Complete OSS inventory | PASS; no blocked or missing external license; no deprecations |
| Secret scan | PASS; current, index, untracked, and full reachable history; zero unapproved findings |
| AST banned-function guardrail | PASS; zero findings |
| CodeQL JavaScript/TypeScript | PASS; no alert reported by the published run |
| Redaction and fixed-error controls | PASS |
| PostgreSQL roles and controlled functions | PASS under zero-skip parents |

## Immutable Evidence

Artifact `security-evidence-2b8a21d4ad55ea489eed9546824a64f161c3a1d6-1` has archive digest `sha256:33056a37a6805886525a8e361c61aa7ae30e75e081e50232c110ccbefa82450c`, size 1,864 bytes, and expiry 2026-12-24. Its manifest binds repository, branch, commit, workflow, job, run, attempt, and these raw streams:

| Result | Stdout bytes / SHA-256 | Stderr bytes / SHA-256 |
| --- | --- | --- |
| Dependency audit | 75 / `1e6523bc9a6c08ed44135ebf82e43173bfc5049cfdf52c0b266e1981a5769f73` | 0 / empty-stream SHA-256 |
| Secret scan | 81 / `994109321172d4b99e574cdb4f9534b80c4b91df1b98be4a1fe7710d40d39dd8` | 0 / empty-stream SHA-256 |
| Banned-function guardrail | 76 / `698bf993b1f5f0e4e6de951672ff44a62e116ab0d6c5e52936e09c4fdd2d45a1` | 0 / empty-stream SHA-256 |

The empty-stream SHA-256 is `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

## Eleven-Dimension Result

Identity, secrets, network, secure coding, CI/CD, data protection, threat modeling, monitoring, and governance pass for the local single-user boundary. Confidential computing is not applicable. Container security passes for disposable digest-pinned CI containers; no production container exists.

Accepted residual risks are same-host loopback request forgery and bounded resource exhaustion, tracked by #89 and blocking before boundary widening. Dependency freshness is tracked by #93. The reference APIM template is non-deployed and requires fresh review before use. No Critical/High finding or Sev 1/2 blocker remains.

This report does not authorize Ring 4, release, deployment, production, public ingress, providers, brokerage, or SQL Server migration.
