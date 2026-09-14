# Issue 65 - Prototype Analytics Acceptance Allocation

## Scope and Authority

This artifact allocates the DEC-020 prototype analytics subset to existing Ring 1 design evidence and precise Ring 2 executable tests. It does not execute those tests or authorize implementation. Candidate `1.0.0-candidate.2` remains a reviewed intermediate; full REV-014 remains FAIL.

Governed inputs:

- analytics contract SHA-256: `1023a5b416d4fb42c76b47b6b3deab5bb1a74612711a00159b5a4b4ce2b9c831`;
- analytics BDD SHA-256: `b7996bd41070f4802434b8d9921b7fc06c3de4a89a3dd8f71611b8302512d22f`;
- retention policy: `RET-A-1.0`; and
- administrative precondition: #64 completed under Workspace Owner approval, with independent Test Reviewer scoped PASS for M1-M6/M12/M14 and final narrow PASS for R-1..R-5. Candidate.2 remains a reviewed intermediate, and aggregate baseline custody remains pending.

## Prototype Assumptions

The accepted planning slice is fixture-only, local, single-user, single-writer, and research-only. It has no real provider, brokerage path, transformation-bearing displayed series, archive/restore/freeze/capacity lifecycle, or publication-version concurrency. These are executable entry conditions, not permanent waivers.

## Acceptance Allocation

| Existing check | Ring 1 design evidence | Precise Ring 2 executable allocation | Planning disposition |
| --- | --- | --- | --- |
| CT-ANA-001 | Seven pinned canonical vectors define exact input, configuration, result, lifecycle, transformation, bundle, and manifest bytes and hashes. | `PT-ANA-001-GOLDEN`: extract the five P0 input/configuration/result/bundle/manifest vectors without trailing newlines; assert exact bytes, SHA-256 values, embedded-result equality, hash-chain references, `RET-A-1.0`, and identical input/configuration/result output on two runs. | Allocated; exact Ring 1 vectors already revalidated. |
| CT-ANA-002 | Point-in-time selection requires `releaseTimestamp <= T`, greatest eligible release, and explicit `T-1ms`, `T`, `T+1ms` cases. | `PT-ANA-002-ECONOMIC-CUTOFF`: seed three vintages at those instants; assert the `T` vintage is selected, the future vintage is absent from canonical input bytes, and the selected identity is persisted. | Allocated. |
| CT-ANA-003A | Market selection filters `sourceAvailableAt <= T` before applying the fixture policy's integer revision order; absent total order has a stable error. | `PT-ANA-003A-MARKET-ORDER`: seed eligible revisions `9` and `10` plus future revision `11`; assert `10` is selected by integer value. Repeat with two eligible revisions and no total-order policy; assert `ANALYTICS_AMBIGUOUS_MARKET_REVISION`, no bundle, and no publication. | Allocated for fixtures; production-provider ordering remains #17-owned. |
| CT-ANA-005 | Hash domains enumerate every canonical dependency and exclude each digest from its own domain. | `PT-ANA-005-MUTATION`: mutate one market value, one rule parameter, and one result metric in separate cases. Assert input mutation changes input/configuration/result/bundle/manifest; parameter mutation preserves input and changes configuration/result/bundle/manifest; result mutation preserves input/configuration and changes result/bundle/manifest. | Allocated. |
| CT-ANA-006 | Missing, partial, stale, quarantined, rights-blocked, or ambiguous required data cannot become zero or a no-signal result. | `PT-ANA-006-MISSING-INPUT`: omit one required fixture observation; assert `ANALYTICS_INPUT_INCOMPLETE` plus `ANALYTICS_PUBLICATION_BLOCKED`, suppressed instrument output, no bundle/manifest, and unchanged current result. | Allocated. |
| CT-ANA-010 | A valid no-signal result is fully evaluated and hash-verified with an explicit empty signal set; a blocked run has no publishable bundle. | `PT-ANA-010-NO-SIGNAL`: run a valid neutral fixture and a missing-input fixture; assert the first commits `signals: []` with Complete evidence while the second returns a blocking code and commits no result bundle. | Allocated. |
| CT-ANA-008 | Hash failure before use, export, archive, restore, or publication quarantines evidence and blocks dependents. | `PT-ANA-008-QUARANTINE`: alter one persisted canonical byte after commit; assert `ANALYTICS_INTEGRITY_FAILED`, Quarantined state, blocked read-dependent publication, unchanged prior current result, and no exposure of the altered value. If `export` appears in the `PT-ANA-SCOPE-OPERATIONS` inventory, assert export also blocks. | Allocated to every inventoried prototype operation; unimplemented lifecycle operations remain out of surface. |
| CT-ANA-009 | Bundle, manifest, retention binding, eligibility, and current-reference update are one atomic visibility boundary. | `PT-ANA-009-ATOMIC-COMMIT`: inject failure immediately before the prototype's current-reference update; assert no new input-set reference, bundle, manifest, or current result is externally visible and retry can succeed once. | Allocated to the single prototype commit boundary; exhaustive failure permutations remain #60. |
| CT-ANA-014 | Idempotency lookup precedes mutable-state validation; equivalent replay returns the original and conflicting content fails without writing. | `PT-ANA-014-REPLAY`: submit one command, replay byte-equivalent content under the same `(evidenceId, evidenceCommitCommandId)`, then replay changed content. Assert one write total, original identity/result on equivalent replay, `ANALYTICS_IDEMPOTENCY_CONFLICT` on conflict, and unchanged publication state. | Allocated. |
| CT-ANA-013 | Authorization precedes input and integrity evaluation; denials are durable, redacted, and state preserving. | `PT-ANA-013-DENY-FIRST`: request every operation in the durable `PT-ANA-SCOPE-OPERATIONS` inventory with an authenticated unauthorized identity while the target input is also missing. Assert only `ANALYTICS_EVIDENCE_ACCESS_DENIED`, a durable allowlisted denial record, no data-state disclosure, and no evidence/publication mutation. | Allocated to the complete inventoried prototype surface; broader 7x7 matrix remains #62. |
| CT-ANA-019 | Audit-path failure never converts denial to access and emits a stable secondary code. | `PT-ANA-019-DENIAL-AUDIT`: fail denial-record persistence during an unauthorized request; assert access remains denied, response includes `ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED`, readiness degrades, no protected value is exposed, and no evidence/publication state changes. | Allocated. |
| CT-ANA-018 | DEC-014 fixes decimal grammar, class, scale, half-even rounding, one output quantization boundary, and canonical positive zero. | `PT-ANA-018-PROTOTYPE-NUMERIC`: inventory numeric fields displayed by the prototype; for each class present, assert one maximum in-range value, one exact half-even tie, rejection of exponent/excess-scale/out-of-bound input, and `-0` canonicalization. Assert UI text equals the canonical persisted string. | Allocated only to displayed prototype surfaces; cross-runtime and exhaustive vectors remain #57. |
| Accessibility subset | Stable failures expose bounded text, non-color status, redacted reason, and keyboard recovery or escalation; the Objective requires visible focus, semantic labels, and blocking warnings. | `PT-ANA-A11Y-001`: keyboard-only exercise of reachable blocked, denied, quarantined, and no-signal states at 1280x720. Assert semantic status/name, visible focus, non-color distinction, research-only disclaimer, no focus trap, and a keyboard-operable recovery or escalation action. | Allocated; requires UI implementation before Ring 3 evidence. |
| CT-ANA-004, conditional | Versioned transformations create derived observations, preserve sources, and have a standalone exact output-hash vector. | `PT-ANA-SCOPE-004`: inspect the implemented displayed-rule catalog and assert no forward-fill, alignment, lag, interpolation, or resampling declaration. If this guard fails, execute `PT-ANA-004-TRANSFORMATION` to reproduce the pinned output hash, preserve the source, and reject invalid lineage before commit. | Guard allocated; DEC-020 currently places transformations outside the prototype surface. |

## Conditional Entry Guards

Ring 2 must execute these guards before treating the allocations above as sufficient:

| Guard | Passing condition | Failure consequence |
| --- | --- | --- |
| `PT-ANA-SCOPE-OPERATIONS` | A durable inventory names every exposed evidence operation and is non-empty with at least separate `read` and `verify` operations | Escalate to the Workspace Owner before accepting CT-ANA-008 or CT-ANA-013; add every newly exposed operation to both executable allocations. |
| `PT-ANA-SCOPE-004` | No displayed transformation-bearing series | CT-ANA-004 becomes mandatory. |
| `PT-ANA-SCOPE-PROVIDER` | Every input provider is the approved fixture provider | CT-ANA-007 rights-restricted Degraded behavior becomes mandatory. |
| `PT-ANA-SCOPE-LIFECYCLE` | Archive, restore, freeze, and capacity operations are absent | CT-ANA-011 and applicable CT-RET checks enter the prototype set. |
| `PT-ANA-SCOPE-RUNTIME` | One canonical analytics runtime owns decimal computation | Cross-runtime decimal equivalence becomes mandatory. |
| `PT-ANA-SCOPE-WRITER` | One writer owns each publication target | CT-ANA-015 publication-version concurrency becomes mandatory. |
| `PT-ANA-SCOPE-ECONOMIC` | Fixture economic releases have unique latest identity | CT-ANA-003 ambiguity handling becomes mandatory. |

## Traceability and Residual Work

Every unconditional #65 row now has existing design evidence and a named executable allocation. Every conditional row has a deterministic entry guard and escalation consequence. Issues #57-#62 remain open as post-prototype work and are not completed by this allocation. The test names above must be linked to concrete repository test paths during Ring 2 planning before implementation starts.

## REV-016 Minor Disposition

On 2026-09-11, the Workspace Owner approved remediation of REV-016 M-1 and M-2 and deferred Mi-1 through Mi-10. The Minors do not remove a retained prototype behavior because each affected row also has sufficient normative Ring 1 evidence or an executable allocation for its required branch. They remain review debt for Ring 2 test-path registration and #57-#62/#61 breadth: replay-order discrimination, combined input/integrity precedence, commit error-code specificity, explicit DEC-014 bound citation, exact rendered disclaimer/redaction assertions, execution-label registry wording, DEC-020 guard routing, lifecycle CT-RET enumeration, local/single-user scope guard, and lifecycle-vector recomputation. This deferral does not waive the applicable contract clause or permit an implementation to omit it.

Passing #65 is prototype-analytics planning acceptance only. It is not whole-prototype acceptance, a full REV-014 PASS, baseline `v1.0.0` freeze, issue #15/#11 closure, implementation authorization, parallel-work release, or Ring 2 advancement.
