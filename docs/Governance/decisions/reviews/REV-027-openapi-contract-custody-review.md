# REV-027 - OpenAPI Contract Custody Review

**Date:** 2026-09-12  
**Review type:** Team Lead contract custody  
**Artifacts:** OpenAPI `1.0.0-candidate.1`; `CT-API-001A..L`; application `1.0.0-candidate.2`  
**Reviewer:** Team Lead, distinct from originator  
**Verdict:** FAIL  
**Critical findings:** 2  
**Major findings:** 4  
**Minor findings:** 1  
**Design-time test quality:** 3.84/5.0

## Findings

### CRITICAL-1 - Analytics and Evidence schemas contradict owner authority

The OpenAPI AnalyticsResult and Evidence shapes narrow, widen, or regroup fields relative to analytics/evidence `1.0.0-candidate.2`. Undefined owner-import extensions cannot repair incompatible standard schemas or prove byte-preserving transfer.

**Required correction:** Reproduce or reference a machine-resolvable exact pinned owner schema and validate owner golden AnalyticsResult and Full Evidence Bundle records against endpoint response schemas.

### CRITICAL-2 - Error-code/status and reachable response sets are open

Any nonempty error code currently validates under multiple HTTP statuses. Default responses admit unspecified statuses, protocol status/body pairs are not fixed, and 406/413/415 are not explicit.

**Required correction:** Remove default responses, enumerate reachable statuses, define status-specific closed application code sets, and define protocol variants whose type and body status equal the HTTP status.

### MAJOR-1 - Endpoint operation constants are not enforceable

Shared Job, PaperOrder, and Failed schemas accept operation values belonging to other endpoints; unsupported extensions do not enforce endpoint ownership.

**Required correction:** Reference endpoint-specific success and failure envelopes with JSON Schema `const` operation values.

### MAJOR-2 - Runtime adaptation profile is vague

Origin, CORS, Host-with-port, numeric body limit, UTF-8, injected constants, query idempotency-header rejection, and duplicate-member behavior lack one structured normative extension vocabulary and exact failure behavior.

**Required correction:** Define a closed conformance profile for rules OpenAPI cannot express and state generic-tooling limitations.

### MAJOR-3 - Cross-field, warning, and accessibility invariants are open

Presentation warning combinations, readiness/error relationship, and Job type/operation/input identity are not conditionally closed.

**Required correction:** Add conditional schemas and positive/adversarial vectors for these relationships and endpoint-specific presentation requirements.

### MAJOR-4 - CT-API-001 lacks direct verification vectors

The A..L plan aggregates assertions without literal valid/malformed tables for each operation, transition payload, status/code, protocol problem, owner golden record, warning combination, or endpoint operation constant.

**Required correction:** Retain exactly A..L and add direct tables for all named boundaries.

### MINOR-1 - YAML aliases obscure operation ownership

Shared parsed parameter and response objects compound operation-constant ambiguity and may leak mutation in tooling.

**Required correction:** Expand operation-level aliases when endpoint-specific schemas are introduced.

## Preserved Results

OpenAPI 3.1/Draft 2020-12 syntax, local reference resolution, exactly sixteen one-to-one operations, 9-command/7-query cardinality, request adaptation, OT-02..OT-10 discrimination, no callbacks/webhooks/security schemes/provider/broker/public server, no explicit 202, jobs/readiness/no-baseline boundaries, and exactly `CT-API-001A..L` passed custody inspection.

## Disposition Required

Workspace Owner disposition is required. The Team Lead recommends approving all findings and remediating as OpenAPI `1.0.0-candidate.2`; independent verification remains unauthorized.

## Workspace Owner Disposition

**Decision:** Approve CRITICAL-1/2, MAJOR-1..4, and MINOR-1; remediate as OpenAPI `1.0.0-candidate.2`.  
**Policy:** Human-in-the-Loop finding disposition; DEC-013 default-to-breaking; pinned application and owner authority.  
**Authority:** Workspace Owner approval in the governed session.  
**Accountability:** Originating agent expands `CT-API-001A..L` first, corrects the candidate, obtains Team Lead recheck, and returns the unchanged candidate to independent verification.

Candidate.2 now uses exact flat analytics owner records validated against golden hashes, 57 disjoint public code bindings, endpoint-specific operation constants, explicit protocol status variants, a structured conformance profile, closed presentation/readiness/job relationships, direct adversarial vectors, and no YAML aliases. Focused validation must pass before custody recheck.

## Custody Recheck 1 - FAIL

The Team Lead closed CRITICAL-2, MAJOR-1, MAJOR-2, and MINOR-1 without new findings. CRITICAL-1 remained open because value-key uniqueness/order and Evidence status/reason relationships were not machine-enforced. MAJOR-3 remained open because operation-specific warning applicability was not constrained. MAJOR-4 remained open because the feature catalog did not contain literal JSON valid/malformed vectors.

The originating agent then added literal vectors before correction, observed the expected RED result, and corrected only the approved finding scope. Focused validation now confirms:

- structured executable owner rules reject duplicate/out-of-order signals, trades, metrics, and warnings;
- Evidence requires `Complete`/null reason or `Degraded`/bounded non-null policy reason;
- all sixteen success and all sixteen operation-specific failure schemas enforce the exact warning applicability matrix;
- each of sixteen adapters has a literal closed valid payload and single-defect malformed payload; and
- local references, Draft 2020-12 schemas, golden hashes, Gherkin structure, and file-scoped whitespace checks pass.

Custody remains pending Team Lead recheck 2. Independent verification and synchronization remain unauthorized.

## Custody Recheck 2 - FAIL

The Team Lead closed CRITICAL-1/2, MAJOR-1/2/3, and MINOR-1 with no new findings. MAJOR-4 remained open only because the `portfolioGet` valid and malformed literals both omitted required `asOf`; the valid vector therefore failed and the malformed vector contained two defects.

The originating agent added valid `asOf` to both literals while retaining null `portfolioId` as the malformed vector's only defect. Focused validation confirms all 32 JSON cells parse, all sixteen valid adapter payloads pass, all sixteen malformed payloads fail for exactly one intentional defect, operation coverage is exact, and Gherkin/whitespace checks pass.

Custody remains pending Team Lead recheck 3. Independent verification and synchronization remain unauthorized.

## Custody Recheck 3 - PASS

The Team Lead closed CRITICAL-1/2, MAJOR-1..4, and MINOR-1 with no new findings. Validation passed 651 local references, 123 Draft 2020-12 component schemas, exact 9-command/7-query coverage, 57 disjoint public codes, six protocol pairs, 32 operation warning schemas, all owner/hash and selector adversaries, and sixteen literal valid/single-defect-malformed adapter pairs.

Reviewed artifact hashes:

- OpenAPI: `bc6e6e6f38701ff93644466cbf448141b29e7a24a9a3c79e19a76016f47cf539`
- Feature: `2594940bbf2f8cd6c60ee50dd0fabfa1116db82905c0ff04056c0724ddf1376e`

**Custody verdict:** PASS. OpenAPI `1.0.0-candidate.2` is eligible, but not yet independently verified, for the next review stage. Synchronization remains unauthorized until independent PASS.

## Independent Verification - PASS, Minor Disposition Pending

The independent Architect Reviewer on alternate model `Claude Sonnet 5` returned PASS with zero Critical, zero Major, and two Minor findings:

1. Reconcile the custody claim of 651 references with the reviewer's manual text count of 501.
2. Replace stale `x-etf-status: rev-027-remediation-pending-team-lead-recheck` during synchronization after approval.

The parent agent independently executed byte hashing and parsed reference enumeration. Both candidate hashes exactly match custody; the YAML contains 651 literal `$ref` keys, 158 unique local targets, and zero unresolved targets. MINOR-1 is therefore resolved as reviewer counting-method error without an artifact change. MINOR-2 is valid and remains pending Workspace Owner disposition; changing it before disposition would be unauthorized synchronization.

Independent verification does not itself authorize synchronization. Workspace Owner disposition is required before status, inventory, registry, change-log, or closure-evidence updates.

## Workspace Owner Minor Disposition and Synchronization

**Decision:** Approve both independent-review Minor findings and synchronize the reviewed OpenAPI candidate.  
**Policy:** Human-in-the-Loop finding disposition; DEC-013 custody separation and change governance.  
**Authority:** Workspace Owner approval in the governed session.  
**Accountability:** Solo Orchestrator updates the stale status and mutable records without changing candidate behavior, closing #21, or authorizing implementation/Ring 2.

MINOR-1 is closed by exact byte-hash and parsed-reference evidence. MINOR-2 is closed by setting `x-etf-status` to `rev-027-independent-pass-design-time`. Inventory `1.0.0-candidate.3`, registry, CC-008, and #21 closure evidence are synchronized. `PT-CONTRACT-SCOPE-API` passes qualified at design time; issue #21 remains open on its other recorded evidence and guard obligations.

The approved metadata-only status synchronization changes the OpenAPI digest to `5adf8deef8ef1cd2963b4a0d3f1b3b27640b2d6f8ab8bde8f5273ed11a6358e2`; the feature digest remains `2594940bbf2f8cd6c60ee50dd0fabfa1116db82905c0ff04056c0724ddf1376e`. Behavioral revalidation passes unchanged.

## Preserved Boundaries

This FAIL does not authorize metadata synchronization, HTTP implementation, dependencies, public ingress, providers, brokers, events, baseline activation, deployment, parallel work, Ring 2 advancement, guard unblocking, or issue #21 closure.
