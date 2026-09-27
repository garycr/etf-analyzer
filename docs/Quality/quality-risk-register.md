# Ring 3 Quality Risk Register

**Date:** 2026-09-25  
**Status:** Reviewed for Ring 3 completion

| ID | Risk | Likelihood / impact | Control | Owner / disposition |
| --- | --- | --- | --- | --- |
| QR-001 | Branch behavior regresses despite line coverage | Low / Medium | Per-file line gate and broad negative-path suite | #94; nonblocking prototype hardening |
| QR-002 | Local green run hides environment-gated skips | Medium / Medium | Published CI PostgreSQL plus zero-skip WP-8 parents | #94; document canonical environment |
| QR-003 | Deadline test flakes under runner starvation | Low / Low | CI history and focused watch | #94; revise only on demonstrated instability |
| QR-004 | Large integration suites become costly to maintain | Medium / Medium | Structured scenarios and focused parents | #87 |
| QR-005 | Same-host process abuses loopback API | Low / Medium | Per-launch token, loopback/Host/Origin guards, and zero-queue request limits | Closed under #89 and DEC-097 for the current boundary |
| QR-006 | Tool/runtime identity is not release-reproducible | Medium / Medium | Ubuntu 24.04 generation, Node 20.20.2, pinned actions/images, and fail-fast assertions | Closed under #90 and DEC-098 |
| QR-007 | Exact dependencies age | Medium / Low | Audit, complete inventory, exact lockfile, source-backed lifecycle review | Closed under #93 and DEC-099; reopen on advisory, support loss, or release-blocking upstream fix |

No risk is Sev 1/2 within the implemented boundary. Public ingress, multi-user identity, deployment, production, provider, brokerage, or database-platform changes invalidate this register and require reassessment.
