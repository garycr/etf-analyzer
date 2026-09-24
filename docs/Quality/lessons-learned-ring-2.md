# Ring 2 Lessons Learned

**Project:** ETF Analyzer  
**Ring:** Ring 2 - Development  
**Date:** 2026-09-23  
**Owner:** Solo Orchestrator  
**Status:** Draft for DP-33 and gate review

## Outcome

Ring 2 delivered eight sequential work packages culminating in a fixture-only, loopback-only, greenfield PostgreSQL integration candidate. Exact PostgreSQL A-L, end-to-end workflow, coverage, accessibility, observability, dependency, secret, CodeQL, redaction, and evidence-provenance controls pass. Release, deployment, production, public ingress, providers, brokerage, and SQL Server migration remain outside this outcome.

## Lessons

| ID | Severity | Lesson | Forward action | Status |
| --- | --- | --- | --- | --- |
| LL-R2-001 | Sev 2 | Accepted evidence can still conflict when identity values are copied across sequential slices. | Reproduce aggregate identities mechanically and publish one authority before gate review. | Remediated by DEC-086 |
| LL-R2-002 | Sev 2 | Traceability to leaf tests is not equivalent to executable aggregate parents. | Require exact named parent execution and fail on skip, todo, cancel, or zero tests. | Remediated by RH-002/RH-005 |
| LL-R2-003 | Sev 2 | A narrow source guardrail must not be described as broad SAST. | Name bounded controls precisely and pair them with pinned CodeQL plus raw provenance. | Remediated by DEC-087 |
| LL-R2-004 | Sev 2 | Integration composition can prove behavior without creating a supported product launcher. | Make productization and read-owner composition an explicit post-IV&V scope decision before release planning. | DP-33 disposition pending |
| LL-R2-005 | Sev 3 | Future-state architecture can be mistaken for implemented state. | Maintain a current-state overlay and label every proposed view explicitly. | Remediated by RH-006/RH-008 |
| LL-R2-006 | Sev 3 | Successful CI summaries are insufficient evidence when raw outputs are discarded. | Upload commit-bound raw streams and verify hashes after download. | Remediated by DEC-087 |
| LL-R2-007 | Sev 3 | Large owner tests and TAP composition increase maintenance cost. | Track structured scenario-result extraction as post-gate debt. | Open; RH-017 |
| LL-R2-008 | Sev 3 | Environment-sensitive browser/PostgreSQL tests need explicit zero-skip commands. | Keep pinned environment commands separate from the host convenience suite. | Adopted |

## Gate Statement

No Sev 1 lesson exists. LL-R2-001 through LL-R2-003 are remediated. LL-R2-004 requires DP-33 disposition; Sev 3 items do not block Ring 2 when assigned and preserved as explicit follow-up work.
