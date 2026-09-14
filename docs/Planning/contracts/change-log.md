# Contract Change Log

**Current active baseline:** None
**Candidate baseline:** `v1.0.0` - Building

## Required Entry Schema

Each future entry must contain:

| Field | Requirement |
| --- | --- |
| Change ID | Stable `CC-NNN` identifier |
| Date | ISO date/time |
| Originator | Person or distinct agent proposing the change |
| Target baseline | Version consumed or proposed |
| Affected contracts/streams | Fixed paths and MAI-ST consumers |
| Classification | Patch, additive minor, or breaking major |
| Classification evidence | Rubric example and compatibility impact |
| DEC-011 floor assertion | Pass, possible impact, or fail with rationale |
| Specialist reviews | Required Code/Test/Security/accessibility evidence |
| Compatibility checks | Named CT test IDs and results |
| Custodian disposition | Approve, reject, or escalate |
| Co-signature | Solo Orchestrator when originator/conflict rule applies |
| Human approval | Required for breaking, scope, floor-impact, or ADR changes |
| Invalidation notice | Affected baseline/streams and acknowledgement status |

## Classification Defaults

Disputed or unclassifiable changes are breaking. The originator cannot approve their own change. Technical compatibility never replaces the DEC-011 canonical-floor assertion.

## Emergency Rule

Emergency changes are revert-only to the last active baseline. Forward-breaking changes require Workspace Owner approval.

## Entries

### CC-001 - Ledger Architecture Alignment Amendment

| Field | Value |
| --- | --- |
| Change ID | CC-001 |
| Date | 2026-09-10 |
| Originator | Solo Orchestrator implementing approved DEC-015 remediation |
| Target baseline | `v1.0.0-candidate.2` |
| Affected contracts/streams | `ledger-contract.md`; PostgreSQL, audit, projection, security, and operations consumers |
| Classification | Additive minor candidate amendment; confirmed by Team Lead custody review |
| Classification evidence | Clarifies authority, transactionality, audit lifecycle, and publication timing without changing accounting outputs or existing command identities |
| DEC-011 floor assertion | Pass expected: immutable FIFO, reversing correction, exact reconciliation, no-broker, and deterministic evidence floors are preserved |
| Specialist reviews | Code, Test, Security, accessibility, final Team Lead custody, and Architect Reviewer rechecks PASS; DP-33 architecture acceptance recorded in DEC-016 |
| Compatibility checks | CT-LED-001..012 unchanged; CT-LED-013..019 define attempt/audit-chain, role, transaction rollback, projection-publication, crash-recovery, and anti-rollback checks for Ring 2 execution |
| Custodian disposition | PASS; candidate.2 accepted for specialist rechecks |
| Detached final digest | `0e223c5d4e4af1a1cd42cd9dbd8e2275f90b1904efd6eaa68555e7ad7dd376e2` in `docs/Planning/contracts/evidence/CC-001-ledger-candidate-delta.md` |
| Co-signature | Solo Orchestrator originated amendment; independent Team Lead disposition required |
| Human approval | DEC-016 accepts the reviewed ledger-security architecture at DP-33; implementation, baseline freeze, and contract activation remain unauthorized |
| Invalidation notice | `1.0.0-candidate.1` custody evidence remains historical; candidate.2 cannot freeze until reviews and affected-stream acknowledgements complete |

### CC-002 - Analytics Evidence Candidate.2 Integrity Amendment

| Field | Value |
| --- | --- |
| Change ID | CC-002 |
| Date | 2026-09-11T13:59:01Z |
| Originator | Solo Orchestrator implementing the Workspace Owner-approved gate-blocker remediation and #63 |
| Target baseline | Analytics contract `1.0.0-candidate.2`; aggregate `v1.0.0` remains building and inactive |
| Affected contracts/streams | `analytics-evidence-contract.md`; `Analytics-Evidence-Reproducibility.feature`; analytics, ingestion #17, portfolio-context, evidence, and prototype acceptance #65 consumers |
| Classification | Breaking major candidate amendment; no active baseline changed |
| Classification evidence | Changes canonical hash domains, adds schema-version and portfolio-context bindings, replaces candidate.1 fixture digests, and adds lifecycle/transformation/bundle/manifest vectors. Candidate.1 consumers must migrate to candidate.2 digests. |
| DEC-011 floor assertion | Pass for the reviewed slice: deterministic evidence, point-in-time selection, exact arithmetic, no-broker, deny-by-default, and accessibility floors are not weakened. Full-floor acceptance remains subject to #65 and the unresolved full REV-014 scope. |
| Specialist reviews | Existing Team Lead and Code Reviewer PASS retained as historical input; scoped Test Reviewer PASS for M1-M6/M12/M14; final narrow Test Reviewer PASS for R-1..R-5; full REV-014 remains FAIL |
| Compatibility checks | CT-ANA-001, CT-ANA-002, CT-ANA-003A, and CT-ANA-004 integrity assertions passed in the scoped review; all seven canonical fixture byte lengths and SHA-256 digests revalidated; #65 prototype set remains pending |
| Custodian disposition | Candidate.2 accepted only as a reviewed intermediate; prototype acceptance and aggregate baseline custody remain pending |
| Detached final digest | Contract `1023a5b416d4fb42c76b47b6b3deab5bb1a74612711a00159b5a4b4ce2b9c831`; BDD `b7996bd41070f4802434b8d9921b7fc06c3de4a89a3dd8f71611b8302512d22f`; evidence in `docs/Planning/contracts/evidence/CC-002-analytics-candidate-delta.md` |
| Co-signature | Solo Orchestrator originated the amendment; independent Test Reviewer supplied scoped and final narrow dispositions |
| Human approval | Workspace Owner approved gate blockers first, then #63 only; #64 administrative synchronization was approved separately. No implementation, baseline freeze, or ring advancement was approved. |
| Invalidation notice | Candidate.1 digests and REV-014 findings remain historical. Any byte change, #17 identity/order change, or prototype-boundary expansion requires new digests and the applicable custody/review cycle. |

### CC-003 - Prototype Contract-Freeze Scope Amendment

| Field | Value |
| --- | --- |
| Change ID | CC-003 |
| Date | 2026-09-11T15:18:00Z |
| Originator | Solo Orchestrator implementing Workspace Owner-approved DEC-022 and REV-017 remediation |
| Target baseline | Non-active `v1.0.0-prototype.1` beneath Building aggregate `v1.0.0` |
| Affected contracts/streams | Contract registry, prototype surface inventory, fixtures, application boundary, HTTP API, durable storage/PostgreSQL, events, domain/ledger, and analytics consumers |
| Classification | Breaking scope amendment to the Building candidate; no active baseline changed |
| Classification evidence | Replaces unconditional future-state breadth with fixed minimum prototype boundaries, expected canonical API/PostgreSQL surfaces, deterministic guards, and explicit deviation paths |
| DEC-011 floor assertion | Pass pending final recheck: no-broker, deterministic evidence, exact arithmetic, fail-closed security, reachable-state accessibility, canonical browser/PostgreSQL expectations, and Proposed architecture status remain explicit |
| Specialist reviews | REV-017 Plan Review identified C-1..C-4, M-1..M-6, Mi-1..Mi-7, and S-1..S-2; Workspace Owner approved all corrections; focused recheck pending |
| Compatibility checks | `PT-CONTRACT-001` unconditional; fixture conformance required; CT-API-001 and CT-DB-001 expected; CT-DB-002 and CT-EVT-001 guard-triggered; retained CT-LED and prototype CT-ANA allocations unchanged |
| Custodian disposition | Team Lead review required before #21 closure |
| Co-signature | Solo Orchestrator originated the amendment and records classification; distinct Team Lead disposition remains required |
| Human approval | Workspace Owner approved the #21 re-scope and every REV-017 correction; no implementation, activation, parallel release, or Ring 2 authority granted |
| Invalidation notice | Any inventory omission, guard failure, Objective deviation, real-provider connection, prior-baseline compatibility claim, or second stream blocks closure/merge and re-triggers custody and independent review |

### CC-004 - Prototype Surface Inventory Publication

| Field | Value |
| --- | --- |
| Change ID | CC-004 |
| Date | 2026-09-11T15:46:00Z |
| Originator | Solo Orchestrator implementing the Workspace Owner-approved #21 inventory and REV-018 remediation |
| Target baseline | Inventory `1.0.0-candidate.1` for inactive `v1.0.0-prototype.1` |
| Affected contracts/streams | `docs/Planning/contracts/prototype-surface-inventory.md`; domain/order, ledger, analytics, fixture, storage, application, API, and guarded event consumers |
| Classification | Breaking candidate publication; no active baseline changed |
| Classification evidence | Establishes the first fixed inventory, candidate bindings, justified event absence, guard statuses/consequences, and path-independent re-evaluation triggers |
| DEC-011 floor assertion | Pass expected: browser/API/PostgreSQL expectations, no-broker, deterministic evidence, exact arithmetic, fail-closed security, accessible recovery, job failure/readiness, and Proposed architecture status are explicit |
| Specialist reviews | REV-018 Team Lead review identified 4 Major, 6 Minor, and 2 Nit findings; Workspace Owner approved all and custody recheck passed. REV-019 independent Architect Reviewer verification passed with 0 Critical/Major; Workspace Owner approved all 5 Minor and 2 Suggestion patch corrections, which are applied. |
| Compatibility checks | `PT-CONTRACT-001` planning-inventory completeness leg PASS; contract-resolution and implementation-agreement legs pending; API/store/provider/stream guards remain BLOCKED |
| Custodian disposition | Team Lead final recheck PASS and independent Architect Reviewer REV-019 PASS; inventory accepted as the first reviewed #21 execution artifact; #21 remains open |
| Co-signature | Solo Orchestrator originator; distinct Team Lead custody and independent alternate-model verification complete under REV-018 and REV-019 |
| Human approval | Workspace Owner approved all REV-018 corrections and REV-019 MIN-1..MIN-5/SUG-1..SUG-2 patch corrections; no implementation, activation, parallel release, or Ring 2 authority granted |
| Invalidation notice | Any surface or binding change, accepted/changed architecture or ADR, DEC-021/DEC-022 invalidation, guard failure, or executable/deployable surface drift blocks merge and re-triggers review |

### CC-005 - Prototype Fixture Contract Candidate.2

| Field | Value |
| --- | --- |
| Change ID | CC-005 |
| Date | 2026-09-11T17:03:00Z |
| Originator | Solo Orchestrator implementing issue #21 and Workspace Owner-approved REV-020/REV-021 remediation |
| Target baseline | Fixture contract `1.0.0-candidate.2` for inactive `v1.0.0-prototype.1` |
| Affected contracts/streams | `fixture-contract.md`; `Fixture-Contract-Conformance.feature`; fixture loader, analytics input, PostgreSQL, and provider-egress consumers |
| Classification | Breaking candidate amendment from unaccepted candidate.1; no active baseline changed |
| Classification evidence | Closes manifest/package schemas, adds governed raw-source objects, defines replay/selection/error semantics, fixes DEC-014 boundaries, and publishes normative package hashes |
| DEC-011 floor assertion | Pass expected: fixture-only point-in-time truth, deterministic evidence, exact arithmetic input, DQ suppression, no provider failover, and Proposed architecture status are preserved |
| Specialist reviews | REV-020 Team Lead custody PASS after all approved findings; REV-021 independent alternate-role PASS with 0 Critical/Major; all approved Minor/Suggestion corrections applied |
| Compatibility checks | `PT-FIX-001A..O` design-time plan complete; four golden vectors recomputed locally; Ring 2 executable bindings and CT-ANA fixture-reference/canonical-byte impact assessment pending |
| Custodian disposition | Team Lead final custody PASS; fixture portion of `PT-CONTRACT-001` design-time resolution complete |
| Co-signature | Solo Orchestrator originator; distinct Team Lead custody and independent Architect Reviewer verification complete |
| Human approval | Workspace Owner approved REV-020 Major/Minor/Nit remediation, new NIT-2, and REV-021 MINOR-1..3/SUGGESTION-1 using the 4.74 quality score |
| Invalidation notice | Any package/hash, identity, availability, ordering, decimal, provenance, DQ, fixture-policy, or provider-ID change requires classification, CT-ANA impact assessment, custody, and independent re-review |

### CC-006 - Prototype Application Contract Candidate.1

| Field | Value |
| --- | --- |
| Change ID | CC-006 |
| Date | 2026-09-11T18:45:00Z |
| Originator | Solo Orchestrator implementing issue #21 and Workspace Owner-approved REV-022/REV-023 remediation |
| Target baseline | Application contract `1.0.0-candidate.1` for inactive `v1.0.0-prototype.1` |
| Affected contracts/streams | `application-contract.md`; `Application-Boundary-Conformance.feature`; browser workbench, future OpenAPI, PostgreSQL, domain, ledger, fixture, and analytics consumers |
| Classification | Breaking first candidate publication; no active baseline or consumer changed |
| Classification evidence | Establishes the transport-independent 9-command/7-query application surface, exact operation schemas, layered replay, durable jobs, readiness, error precedence, canonical display, redaction, and accessible recovery |
| DEC-011 floor assertion | Pass expected: no-broker, fixture-only deterministic evidence, exact arithmetic display, fail-closed publication/security, accessible recovery, and Proposed architecture status are preserved |
| Specialist reviews | REV-022 Team Lead custody PASS after all approved findings; REV-023 independent Architect Reviewer alternate-role PASS after all five Major corrections; alternate-model provenance unproven |
| Compatibility checks | `PT-APP-001A..P` design-time plan complete with 16 unique scenarios; literal payload/replay/precedence/readiness/recovery vectors validated locally; Ring 2 executable bindings pending |
| Custodian disposition | Team Lead final substantive PASS; application portion of `PT-CONTRACT-001` design-time resolution complete |
| Co-signature | Solo Orchestrator originator; distinct Team Lead custody and independent Architect Reviewer verification complete |
| Human approval | Workspace Owner approved REV-022 MAJOR-1..7/MINOR-1..2 and REV-023 MAJOR-1..5/MINOR-1 while retaining candidate.1 |
| Invalidation notice | Any operation, envelope, owner mapping, replay, job, readiness, error, display, warning, redaction, recovery, or authority change requires classification, OpenAPI/PostgreSQL impact assessment, custody, and independent re-review |

### CC-007 - Application Candidate.2 and PostgreSQL Candidate.2

| Field | Value |
| --- | --- |
| Change ID | CC-007 |
| Date | 2026-09-12T01:15:00Z |
| Originator | Solo Orchestrator implementing Workspace Owner-approved REV-025 and REV-026 remediation |
| Target baseline | Application and PostgreSQL contracts `1.0.0-candidate.2` for inactive `v1.0.0-prototype.1`; inventory `1.0.0-candidate.2` |
| Affected contracts/streams | `application-contract.md`; `postgresql-contract.md`; both conformance features; inventory/registry; future OpenAPI consumer |
| Classification | Breaking application owner-identity correction plus first bounded PostgreSQL candidate publication; no active baseline or executable consumer changed |
| Classification evidence | Preserves opaque analytics evidence IDs as String/text; defines native PostgreSQL 16 external role provisioning, nine-member SET graph, closed six-migration physical/authority manifest, complete bounded readers, denial binding, system `plpgsql`, and no-event scope |
| DEC-011 floor assertion | Pass expected: no broker/provider, fixture-only deterministic evidence, exact arithmetic, fail-closed security/publication, accessible recovery, canonical browser/PostgreSQL expectations, and Proposed architecture status remain explicit |
| Specialist reviews | Application and PostgreSQL final Team Lead custody PASS; REV-026 independent Architect Reviewer PASS; model provenance unavailable and not claimed |
| Compatibility checks | Exactly `PT-APP-001A..P` and `CT-DB-001A..L` pass design-time structural and semantic validation; Ring 2 executable bindings, SQL bytes, and manifest hashes pending |
| Custodian disposition | Both candidate.2 contracts complete for design-time resolution; PostgreSQL STORE planning guard passes qualified; OpenAPI and aggregate resolution remain pending |
| Co-signature | Solo Orchestrator originator; distinct Team Lead custody and independent Architect Reviewer verification complete |
| Human approval | Workspace Owner approved REV-025 CRITICAL-1/MAJOR-1..4, NEW-MAJOR-1, and REV-026 MINOR-1 metadata synchronization |
| Invalidation notice | Any evidence identity, application operation, PostgreSQL role/membership, migration allocation, physical object, reader, grant, catalog hash, readiness, or event-boundary change requires impact classification, custody, independent review, and affected registry synchronization |

### CC-008 - OpenAPI Candidate.2 Design-Time Resolution

| Field | Value |
| --- | --- |
| Change ID | CC-008 |
| Date | 2026-09-11T19:19:07Z |
| Originator | Solo Orchestrator implementing Workspace Owner-approved REV-027 remediation and synchronization |
| Target baseline | OpenAPI contract `1.0.0-candidate.2` for inactive `v1.0.0-prototype.1`; inventory `1.0.0-candidate.3` |
| Affected contracts/streams | `openapi-contract.yaml`; `OpenAPI-Contract-Conformance.feature`; inventory/registry; application, analytics/evidence, PostgreSQL, and future browser/API adapter consumers |
| Classification | Breaking first bounded OpenAPI candidate publication; no active baseline or executable consumer changed |
| Classification evidence | Establishes the exact 16-operation loopback HTTP surface, explicit success/error statuses, owner-preserving schemas, protocol failures, runtime adaptation profile, idempotency, paper-action, warning, and accessibility constraints |
| DEC-011 floor assertion | Pass expected: no broker/provider, fixture-only deterministic evidence, exact canonical values, fail-closed security/publication, accessible warning/recovery, loopback-only ingress, and Proposed architecture status remain explicit |
| Specialist reviews | REV-027 Team Lead custody PASS after three preserved rechecks; independent Architect Reviewer on alternate model Claude Sonnet 5 PASS with 0 Critical/0 Major; Workspace Owner approved both Minor dispositions |
| Compatibility checks | Exactly `CT-API-001A..L`; 123 Draft 2020-12 schemas, 651 literal local references/158 unique targets/0 unresolved, 57 disjoint public codes, 32 warning schemas, owner golden hashes/adversaries, and 16 valid/single-defect-malformed adapter pairs pass design-time validation |
| Custodian disposition | OpenAPI candidate.2 complete for design-time resolution; `PT-CONTRACT-SCOPE-API` passes qualified; Ring 2 executable conformance remains pending |
| Post-synchronization digests | OpenAPI `5adf8deef8ef1cd2963b4a0d3f1b3b27640b2d6f8ab8bde8f5273ed11a6358e2`; feature unchanged at `2594940bbf2f8cd6c60ee50dd0fabfa1116db82905c0ff04056c0724ddf1376e`; OpenAPI byte change is only the approved `x-etf-status` synchronization |
| Co-signature | Solo Orchestrator originator; distinct Team Lead custody and independent alternate-model Architect Reviewer verification complete |
| Human approval | Workspace Owner approved both independent-review Minor findings and synchronization; no implementation, baseline activation, issue closure, parallel release, or Ring 2 authority granted |
| Invalidation notice | Any path, method, operation, payload, owner import, warning, status/code, protocol, idempotency, Host/Origin, ingress, paper-action, or absence-boundary change requires classification, custody, independent review, and registry synchronization |
