# Analytics Snapshot and Evidence Contract

**Contract version:** `1.0.0-candidate.2`
**Baseline target:** `v1.0.0`
**Status:** Candidate - gate-blocker remediation authorized; Test Reviewer recheck pending; broader #57-#62 coverage remains deferred
**Custodian:** Team Lead
**Source issues:** GitHub #15 and #11
**Decision authority:** DEC-017, DEC-018, and ADR-001
**Architecture status:** Proposed; this coordination contract does not accept an architecture or release implementation

## Scope

This contract defines point-in-time snapshot selection, deterministic P0 analytics/backtest configuration and result evidence, reproducibility status, canonical hashes, retention binding, and fail-closed publication behavior for the local research prototype. It governs evidence identity and behavior, not the physical PostgreSQL schema, API shape, event transport, provider allowlist, or transaction/outbox implementation.

Raw provider payload rights, provider approval states, fixture policy, and ingestion egress remain owned by GitHub #17. Ledger valuation arithmetic remains owned by the immutable FIFO ledger contract. This contract contains no brokerage, execution, external-account, production, multi-user, advice, or guarantee semantics.

## Point-in-Time Selection

An analytics run binds one immutable `evaluationAt` UTC instant, $T$. Every selected economic observation must have `releaseTimestamp <= T`. For each required `(providerId, seriesId, observationDate)`, selection chooses the eligible preserved vintage with the greatest `releaseTimestamp`. If more than one distinct eligible vintage shares that greatest timestamp and the provider contract supplies no reviewed ordering field, selection fails with `ANALYTICS_AMBIGUOUS_VINTAGE`; database row order, retrieval time, and lexical identifier order are not valid semantic tie-breakers.

`observationDate` and `tradingDate` are canonical Gregorian calendar dates serialized exactly as `YYYY-MM-DD` with zero-padded month and day. Invalid calendar dates and alternate date formats fail before selection or hashing.

Every market observation and corporate-action revision carries immutable `sourceAvailableAt` provenance outside its five-part business identity and is eligible only when `sourceAvailableAt <= T`. Selection first filters by that cutoff, then applies the #17-reviewed revision order within `(instrumentId, tradingDate, providerId, adjustmentPolicy)`. If #17 supplies no total order for multiple eligible revisions, selection fails with `ANALYTICS_AMBIGUOUS_MARKET_REVISION`; retrieval time and database row order are never substitutes. Later revisions remain preserved but cannot enter an earlier snapshot.

Vintages are append-only. A revision never updates or deletes an earlier vintage. Forward-fill, interpolation, period-end alignment, lag, and resampling each require a versioned transformation record that references its source observations, ordered parent transformation identities, algorithm identifier/version, canonical parameters, and output hash. Applying a transformation creates a new derived observation and never overwrites a source or prior derivation.

Each selected market observation references the five-part ingestion identity `(instrumentId, tradingDate, providerId, adjustmentPolicy, revision)` defined for #17 plus `sourceAvailableAt` and its canonical normalized value. Availability and job/idempotency identities are provenance and are not part of that five-part business identity. Missing, partial, stale, quarantined, rights-blocked, or ambiguously selected required data blocks the run; it cannot be represented as zero or as a valid no-signal result.

## Canonical Identities

### Reproducibility Input Set

An immutable input set contains exactly:

- `inputSetId`, `inputSchemaVersion`, and `evaluationAt`;
- market observations ordered by `(instrumentId, tradingDate, providerId, adjustmentPolicy, revision)`;
- economic vintages ordered by `(providerId, seriesId, observationDate, releaseTimestamp, vintageId)`;
- transformation lineage in deterministic topological order with identity as the final tie-breaker;
- `portfolioContextHash`, or the SHA-256 hash of canonical `null` when no portfolio context applies; and
- `inputHash`.

Every referenced identity and canonical value must remain resolvable and hash-verifiable for the input set to support `Complete` evidence. Shared input sets are retained through the latest full-bundle deadline of every bundle that references them.

### Full Evidence Bundle

An immutable full bundle contains exactly these logical groups:

- identity: `evidenceId`, `evidenceSchemaVersion`, `baselineVersion`, `inputSetId`, and `evaluationAt`;
- rule: `ruleId`, `ruleVersion`, canonical `parameters`, `codeHash`, and canonical string `seed`;
- comparison: benchmark `instrumentId` and `version`;
- provenance: sorted `providerPolicyReferences` and environment `runtime` plus `dependencyLockHash`;
- assumptions: canonical cost rate, slippage rate, fill timing, and any additional versioned assumptions;
- result: `resultSchemaVersion`, deterministically ordered signals, trades, metrics, warnings, and explicit no-signal outcome where applicable;
- integrity: `inputHash`, `configurationHash`, `resultHash`, and `bundleHash`;
- reproducibility: `reproducibilityStatus` and nullable `reproducibilityReason`; and
- retention: `retentionPolicyVersion` and database-generated `retentionEpoch`.

Identifiers, assumptions, warnings, and reasons are immutable after commit. Credentials, secrets, prohibited raw provider payloads, brokerage identifiers, and unbounded free-form diagnostic content are invalid evidence fields.

### Closed Hash-Bearing Records

Every record below rejects unknown fields. Required collections use `[]`, never `null`; required objects use `{}`, never `null`. A field is nullable only where explicitly stated, and canonical JSON includes that null.

| Record | Exact fields | Identity and deterministic order |
| --- | --- | --- |
| Market observation | `instrumentId`, `tradingDate`, `providerId`, `adjustmentPolicy`, `revision`, `sourceAvailableAt`, `value` | Five-part identity; ascending tuple order shown |
| Economic vintage | `providerId`, `seriesId`, `observationDate`, `releaseTimestamp`, `vintageId`, `value` | All identity fields; ascending tuple order shown |
| Transformation | `transformationId`, `algorithmId`, `algorithmVersion`, `parameters`, `sourceObservationIds`, `parentTransformationIds`, `numericClass`, `outputValue`, `outputHash` | Unique `transformationId`; deterministic topological order then identifier; identity arrays ascending and duplicate-free |
| Signal | `instrumentId`, `label`, `score` | Unique `instrumentId`; ascending identifier |
| Trade | `tradeOrdinal`, `instrumentId`, `side`, `quantity`, `unitPrice`, `grossValue`, `fee`, `effectiveAt` | Zero-based contiguous ordinal; ascending ordinal; `side` is `Buy` or `Sell` |
| Metric | `metricId`, `numericClass`, `value` | Unique versioned metric identifier; ascending identifier |
| Warning | `warningCode`, `subjectId` | `(warningCode, subjectId)`; nullable `subjectId` sorts first, then ascending identifier |
| Lifecycle reference | `lifecycleSequence`, `state`, `eventAt`, `eventHash` | Zero-based contiguous sequence; ascending sequence |
| Deletion-certificate link | `deletionCertificateId`, `targetClass`, `certificateHash` | Unique certificate identity; ascending identifier |

Transformation and full-bundle `parameters` are closed by their immutable algorithm/rule versions. Parameter values are limited to null, Boolean, bounded UTF-8 strings, arrays of permitted values, and objects with unique keys; JSON numbers are prohibited. Integer and decimal parameters use canonical strings, so the golden `lookbackSessions` value is `"20"`. Signals, trades, metrics, and warnings are closed by `resultSchemaVersion`; adding a field or metric identifier requires a new version. The result object contains exactly `configurationHash`, `domain`, `metrics`, `resultSchemaVersion`, `signals`, `trades`, and `warnings`.

Each `sourceObservationIds` entry is the ASCII prefix `market|` or `economic|` followed by each canonical identity component encoded as `<utf8-byte-length>:<value>` with components separated by `|`. Length-prefixing is the only escaping mechanism, so `|`, `:`, and non-ASCII content inside an identifier cannot create ambiguity. Market component order is `instrumentId`, `tradingDate`, `providerId`, `adjustmentPolicy`, `revision`; economic component order is `providerId`, `seriesId`, `observationDate`, `releaseTimestamp`, `vintageId`. Entries sort by their complete encoded byte strings.

A non-null portfolio context hashes a closed object containing exactly `domain`, `portfolioId`, `portfolioVersion`, `valuationSnapshotId`, `precisionPolicyVersion`, and `baselineVersion`. The null context remains SHA-256 of canonical `null` and does not use the object envelope.

### Verification Manifest

Each append-only manifest record contains exactly `domain`, `manifestId`, `manifestSequence`, `previousManifestHash`, `evidenceId`, `evidenceSchemaVersion`, `baselineVersion`, `retentionPolicyVersion`, `retentionEpoch`, `reproducibilityStatus`, `reproducibilityReason`, `inputHash`, `configurationHash`, `resultHash`, `bundleHash`, `lifecycleReferences`, `deletionCertificateLinks`, and `manifestHash`. Sequence starts at zero; `previousManifestHash` is null only at sequence zero and otherwise equals the prior record hash. Lifecycle events append a successor record with complete ordered references; they never rewrite a prior record or alter reproducibility status.

## Independent Status Dimensions

`reproducibilityStatus` is closed to:

- `Complete`: every required input is retained, resolvable, and hash-verifiable.
- `Degraded`: provider rights prohibit retention of a required input. `reproducibilityReason` contains only the immutable governing rights-policy identifier.

`Complete` requires a null reason. `Degraded` requires a non-empty bounded policy identifier and cannot satisfy CT-ANA-001 or support evidence-backed publication.

Reproducibility is independent of storage, verification, capacity, and deletion state. `Hot`, `Archived`, `Quarantined`, `DeletionFrozen`, `ExpiredFrozen`, `PendingBackupExpiry`, capacity alert/block, and deletion outcomes are never serialized as reproducibility status. Archive, restore, capacity, freeze, or deletion processing cannot change `Complete` to `Degraded` or `Degraded` to `Complete`.

## Least-Privilege Access

Analytics evidence access is deny-by-default. Authenticated workload authority is checked separately for read, verify, export, archive, restore, deletion, and lifecycle administration; authority for one operation never implies another. The Workspace Owner alone authorizes accelerated deletion, corrupt-evidence destruction, and manual deletion freeze or reaffirmation. Runtime analytics may create and verify evidence through controlled operations but cannot delete, rewrite, bypass retention, grant authority, or read prohibited raw provider payloads.

Diagnostics expose only allowlisted bounded identifiers, lifecycle/status values, timestamps, counts, stable error codes, and hashes. Evidence values, canonical parameters, portfolio context, environment details, credentials, prohibited provider payloads, and authorization internals are excluded. Unauthorized operations fail closed with `ANALYTICS_EVIDENCE_ACCESS_DENIED`, durably append a redacted denial through a separately authorized audit path, and do not change evidence, manifest, lifecycle, publication, or deletion state. If denial recording fails, access remains denied, the response also carries `ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED`, and readiness degrades until the audit path is restored. Physical roles, grants, and API policy remain owned by the PostgreSQL and OpenAPI contracts.

## Canonical Hash Contract

All hashes use SHA-256 over UTF-8 RFC 8785 canonical JSON and are lowercase 64-character hexadecimal strings. Each hash domain includes the literal `domain` discriminator below. Decimal values are fixed-point JSON strings governed by DEC-014; binary floating values are prohibited. Timestamps use `YYYY-MM-DDTHH:mm:ss.SSSZ`. Null fields are included. Arrays use the ordering defined by this contract, never runtime map/database order. Each digest field is excluded from its own hash domain.

| Hash | Domain discriminator | Canonical content |
| --- | --- | --- |
| `inputHash` | `etf.analytics.input.v1` | `domain`, `economicVintages`, `evaluationAt`, `inputSchemaVersion`, `marketObservations`, `portfolioContextHash`, `transformationLineage` |
| `configurationHash` | `etf.analytics.configuration.v1` | `assumptions`, `baselineVersion`, `benchmark`, `codeHash`, `domain`, `environment`, `evaluationAt`, `inputHash`, `parameters`, `providerPolicyReferences`, `ruleId`, `ruleVersion`, `seed` |
| `resultHash` | `etf.analytics.result.v1` | `configurationHash`, `domain`, `metrics`, `resultSchemaVersion`, `signals`, `trades`, `warnings`, with absent optional result collections represented as empty arrays |
| `portfolioContextHash` | `etf.analytics.portfolio-context.v1` | `baselineVersion`, `domain`, `portfolioId`, `portfolioVersion`, `precisionPolicyVersion`, `valuationSnapshotId` for non-null context; canonical `null` otherwise |
| `outputHash` | `etf.analytics.transformation.v1` | `algorithmId`, `algorithmVersion`, `domain`, `numericClass`, `outputValue`, `parameters`, `parentTransformationIds`, `sourceObservationIds`, `transformationId` |
| `eventHash` | `etf.analytics.lifecycle.v1` | `domain`, `eventAt`, `lifecycleSequence`, `state` |
| `bundleHash` | `etf.analytics.bundle.v1` | Every immutable full-bundle field except `bundleHash`; integrity fields include `inputHash`, `configurationHash`, and `resultHash` |
| `manifestHash` | `etf.analytics.manifest.v1` | Every immutable manifest field except `manifestHash` |

Changing any input identity/value, evaluation time, transformation, portfolio context, rule/version, parameter, code hash, seed, benchmark, provider policy reference, environment, assumption, or baseline changes the applicable canonical bytes and hash. Repeating identical analytical content produces identical `inputHash`, `configurationHash`, and `resultHash` in TypeScript, Python, and PostgreSQL verification. `bundleHash` and `manifestHash` are per-commit integrity values because they include pinned server-generated identities, epoch, sequence, and predecessor fields; they are reproducible only when those fixture fields are also identical.

Unknown fields, duplicate identities, unordered arrays, omitted required collections, null in place of an empty collection, and non-canonical decimal strings fail before hashing. `bundleHash` includes the closed result and `resultSchemaVersion`; `manifestHash` includes complete ordered lifecycle/deletion-link arrays and its predecessor link.

For CT-ANA fixtures, `codeHash` and `dependencyLockHash` made only of repeated `1` and `2` characters are opaque, syntactically valid test literals and do not claim known preimages. `portfolioContextHash`, `inputHash`, `configurationHash`, `resultHash`, `outputHash`, `eventHash`, `bundleHash`, `manifestHash`, and certificate hashes are computed values. No portfolio context is present in CT-ANA-001, so `portfolioContextHash` is SHA-256 over the four UTF-8 bytes `null`: `74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b`.

## Canonical Numeric Classes

DEC-014 governs every persisted or hashed decimal. Inputs are canonical fixed-point strings at the assigned scale; binary floating point, exponent notation, excess scale, and omitted required numeric values are invalid. Negative zero canonicalizes to positive zero. Optional numeric absence is permitted only through a field explicitly made nullable by a future schema version.

| Numeric surface | DEC-014 class and scale |
| --- | --- |
| Market/economic value, transformation unit output, trade quantity, trade unit price | Quantity and unit value, 10 |
| Trade gross value, fee, monetary metric | Money, 8 |
| Cost/slippage assumptions, signal score, return/rate/ratio metric | Rate/ratio, 12 |

Each transformation and metric declares `numericClass` as `Quantity`, `Money`, or `Rate`; its immutable versioned definition fixes the valid class. Multiplication, division, and aggregate intermediates use signed arbitrary-precision integer coefficients and quantize exactly once at the declared output boundary using round-half-even. A downstream transformation consumes the prior canonical output without requantizing an earlier intermediate. Trade `grossValue` is `quantity * unitPrice` quantized once to Money. Unknown classes or field/class mismatches fail with `ANALYTICS_NUMERIC_CLASS_INVALID`.

## Commit, Replay, and Publication Invariants

An evidence command contains `evidenceId`, `evidenceCommitCommandId`, `publicationTargetId`, `expectedPublicationVersion`, complete canonical input/configuration/result content, `baselineVersion`, and `retentionPolicyVersion`. `(evidenceId, evidenceCommitCommandId)` is the idempotency identity. Equivalent content is the RFC 8785 serialization of every command field except `expectedPublicationVersion`; generated hashes, manifest identity/sequence, database-generated `retentionEpoch`, and resulting publication version are excluded as deterministic or server-generated outputs.

After syntax and authorization checks, idempotency lookup precedes mutable-state validation. Equivalent replay returns the original result without rechecking current capacity or publication version and never writes again. Different content under the same identity fails with `ANALYTICS_IDEMPOTENCY_CONFLICT` and changes nothing.

`publicationTargetId` is the stable logical analytical surface whose current result is replaced. Each target has a non-negative monotonic `publicationVersion`. A non-replay command succeeds only when `expectedPublicationVersion` equals the authoritative version; mismatch returns `ANALYTICS_PUBLICATION_VERSION_CONFLICT`. One successful commit atomically persists the immutable input-set reference, full bundle, initial manifest, retention binding, publication eligibility result, and, when eligible, the incremented current publication reference. Competing commands cannot both replace the same version.

A result becomes current only after all required data-quality checks pass, reproducibility status is `Complete`, and every canonical hash verifies. Failure before completion leaves no partial evidence bundle and does not replace the current published signal. The physical transaction/outbox design remains Proposed architecture and requires its own review; no implementation shape is accepted here.

A valid no-signal result is a fully evaluated, hash-verified result with an explicit empty signal set. It is distinct from a blocked run. A blocked run records bounded redacted operational evidence but no publishable result bundle.

### Validation Precedence

One command returns the first applicable outcome by rank. Batch failures order by `(precedenceRank, publicationTargetId, evidenceId)`.

| Rank | Validation or outcome |
| ---: | --- |
| 10 | Authentication, operation authorization, field grammar, closed schema, and decimal/class validation |
| 20 | Idempotency lookup: equivalent replay returns original; different content conflicts |
| 30 | RET-A-1.0 capacity admission |
| 40 | Missing, partial, stale, or quarantined input |
| 50 | Economic-vintage or market-revision ambiguity |
| 60 | Rights restriction: commit `Degraded` evidence when permitted, but block publication |
| 70 | Publication expected-version comparison |
| 80 | Canonical hash, integrity, and repeated-result determinism verification |
| 90 | Atomic evidence persistence and publication-reference update |

`ANALYTICS_PUBLICATION_BLOCKED` accompanies the controlling input, rights, integrity, lifecycle, or capacity code; it never replaces the more specific cause.

## RET-A-1.0 Binding

Every committed bundle binds immutable `retentionPolicyVersion = "RET-A-1.0"` and database-generated `retentionEpoch`. Deadlines are exactly epoch plus $N \times 24$ hours and never reset on access, verification, archive, or restore:

- full bundle and required inputs: hot through day 90, archive through day 730;
- manifest and deletion certificates: through day 1,825;
- operational metadata: through day 365 from each event epoch;
- workspace-managed backup tail: at most 30 days after logical expiry;
- manual deletion freeze: at most 30 days unless explicitly reaffirmed by the Workspace Owner; and
- hot-plus-archive capacity: 25 GiB, Team Lead alert at 80%, block new evidence-backed runs at 100% without early eviction.

Deletion certificate fields, authority types, outcomes, corruption handling, export warnings, restore re-deletion, and terminal deletion behavior are incorporated from ADR-001 and the reviewed retention-policy artifact without alteration. Analytics hashes are independent of DEC-016 ledger HMAC keys.

## Stable Error Families

| Code | Condition |
| --- | --- |
| `ANALYTICS_INPUT_INCOMPLETE` | Required input is missing or partial |
| `ANALYTICS_INPUT_STALE` | Required input violates its versioned freshness policy |
| `ANALYTICS_INPUT_QUARANTINED` | Required input is quarantined or integrity-blocked |
| `ANALYTICS_AMBIGUOUS_VINTAGE` | Multiple latest eligible vintages lack a reviewed deterministic order |
| `ANALYTICS_AMBIGUOUS_MARKET_REVISION` | Multiple eligible market/corporate-action revisions lack a #17-reviewed total order |
| `ANALYTICS_RIGHTS_RESTRICTED` | Provider policy prohibits retaining a required reproducibility input |
| `ANALYTICS_INTEGRITY_FAILED` | Any canonical evidence hash fails verification |
| `ANALYTICS_EVIDENCE_ACCESS_DENIED` | Authenticated identity lacks authority for the requested evidence operation |
| `ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED` | Durable denial recording failed; access remains denied and readiness degrades |
| `ANALYTICS_NUMERIC_CLASS_INVALID` | Decimal grammar, scale, declared class, or field/class allocation is invalid |
| `ANALYTICS_CAPACITY_BLOCKED` | RET-A-1.0 managed capacity is at 100% |
| `ANALYTICS_EVIDENCE_COMMIT_FAILED` | The complete evidence commit cannot persist atomically |
| `ANALYTICS_PUBLICATION_BLOCKED` | Evidence is not Complete and verified, or lifecycle state forbids publication |
| `ANALYTICS_DETERMINISM_FAILED` | Identical canonical configuration produces unequal canonical result bytes or hash |
| `ANALYTICS_IDEMPOTENCY_CONFLICT` | Evidence command identity is reused with different canonical content |
| `ANALYTICS_PUBLICATION_VERSION_CONFLICT` | Expected publication version differs from the authoritative version |

Failures expose a stable code, bounded identifiers, non-color status text, a plain redacted reason, and a keyboard-operable recovery or escalation action. They do not expose values, raw payloads, credentials, environment secrets, or stack traces.

## CT-ANA-001 Golden P0 Vector

The following UTF-8 lines have no trailing newline. They are RFC 8785 canonical for the represented simple JSON values.

Input bytes:

```json
{"domain":"etf.analytics.input.v1","economicVintages":[{"observationDate":"2025-12-01","providerId":"FRED","releaseTimestamp":"2026-01-15T13:30:00.000Z","seriesId":"CPI","value":"300.0000000000","vintageId":"v1"}],"evaluationAt":"2026-01-31T00:00:00.000Z","inputSchemaVersion":"1.0.0","marketObservations":[{"adjustmentPolicy":"split-adjusted","instrumentId":"ETF-1","providerId":"fixture","revision":"1","sourceAvailableAt":"2026-01-30T22:00:00.000Z","tradingDate":"2026-01-30","value":"100.0000000000"}],"portfolioContextHash":"74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b","transformationLineage":[]}
```

Byte length: 623. Expected `inputHash`: `cca3db225eaa64d91b3c971b2d366ef7fb8bc0a860b7081349ac622920e5f4fa`.

Configuration bytes:

```json
{"assumptions":{"costRate":"0.001000000000","fillTiming":"next-session-open","slippageRate":"0.000500000000"},"baselineVersion":"v1.0.0","benchmark":{"instrumentId":"BENCH-1","version":"1"},"codeHash":"1111111111111111111111111111111111111111111111111111111111111111","domain":"etf.analytics.configuration.v1","environment":{"dependencyLockHash":"2222222222222222222222222222222222222222222222222222222222222222","runtime":"python-3.13"},"evaluationAt":"2026-01-31T00:00:00.000Z","inputHash":"cca3db225eaa64d91b3c971b2d366ef7fb8bc0a860b7081349ac622920e5f4fa","parameters":{"lookbackSessions":"20"},"providerPolicyReferences":["fixture-policy-1"],"ruleId":"p0-rule","ruleVersion":"1.0.0","seed":"42"}
```

Byte length: 699. Expected `configurationHash`: `fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37`.

Result bytes:

```json
{"configurationHash":"fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37","domain":"etf.analytics.result.v1","metrics":[{"metricId":"totalReturn","numericClass":"Rate","value":"0.010000000000"}],"resultSchemaVersion":"1.0.0","signals":[{"instrumentId":"ETF-1","label":"Neutral","score":"0.000000000000"}],"trades":[],"warnings":[]}
```

Byte length: 345. Expected `resultHash`: `4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18`.

Lifecycle-event bytes:

```json
{"domain":"etf.analytics.lifecycle.v1","eventAt":"2026-01-31T00:00:00.000Z","lifecycleSequence":0,"state":"Hot"}
```

Byte length: 112. Expected `eventHash`: `68d6a985505e451a7d6adda9fbf40dd3ba4085edfe7867876a72aacd324e9808`.

Standalone transformation-domain bytes supporting CT-ANA-004 follow. This fixture is not referenced by CT-ANA-001 and is intentionally excluded from that input set's empty `transformationLineage`:

```json
{"algorithmId":"forward-fill","algorithmVersion":"1.0.0","domain":"etf.analytics.transformation.v1","numericClass":"Quantity","outputValue":"100.0000000000","parameters":{"maximumGapSessions":"1"},"parentTransformationIds":[],"sourceObservationIds":["market|5:ETF-1|10:2026-01-30|7:fixture|14:split-adjusted|1:1"],"transformationId":"transform-fixture-1"}
```

Byte length: 355. Expected `outputHash`: `238e3d87efe0349fbab3fb70ea4b800e0488db24b8d902874dd1a4608ceca998`.

Bundle bytes pin `evidenceId`, `inputSetId`, and `retentionEpoch` for per-commit verification:

```json
{"assumptions":{"costRate":"0.001000000000","fillTiming":"next-session-open","slippageRate":"0.000500000000"},"baselineVersion":"v1.0.0","benchmark":{"instrumentId":"BENCH-1","version":"1"},"codeHash":"1111111111111111111111111111111111111111111111111111111111111111","configurationHash":"fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37","domain":"etf.analytics.bundle.v1","environment":{"dependencyLockHash":"2222222222222222222222222222222222222222222222222222222222222222","runtime":"python-3.13"},"evaluationAt":"2026-01-31T00:00:00.000Z","evidenceId":"evidence-fixture-1","evidenceSchemaVersion":"1.0.0","inputHash":"cca3db225eaa64d91b3c971b2d366ef7fb8bc0a860b7081349ac622920e5f4fa","inputSetId":"input-fixture-1","parameters":{"lookbackSessions":"20"},"providerPolicyReferences":["fixture-policy-1"],"reproducibilityReason":null,"reproducibilityStatus":"Complete","result":{"configurationHash":"fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37","domain":"etf.analytics.result.v1","metrics":[{"metricId":"totalReturn","numericClass":"Rate","value":"0.010000000000"}],"resultSchemaVersion":"1.0.0","signals":[{"instrumentId":"ETF-1","label":"Neutral","score":"0.000000000000"}],"trades":[],"warnings":[]},"resultHash":"4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18","retentionEpoch":"2026-01-31T00:00:00.000Z","retentionPolicyVersion":"RET-A-1.0","ruleId":"p0-rule","ruleVersion":"1.0.0","seed":"42"}
```

Byte length: 1,456. Expected `bundleHash`: `20f33dce407668ea1d60f9367af21e4cd1d968d46475f32dac709da7842fc3e6`.

Initial-manifest bytes pin manifest identity/sequence and include the verified lifecycle reference:

```json
{"baselineVersion":"v1.0.0","bundleHash":"20f33dce407668ea1d60f9367af21e4cd1d968d46475f32dac709da7842fc3e6","configurationHash":"fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37","deletionCertificateLinks":[],"domain":"etf.analytics.manifest.v1","evidenceId":"evidence-fixture-1","evidenceSchemaVersion":"1.0.0","inputHash":"cca3db225eaa64d91b3c971b2d366ef7fb8bc0a860b7081349ac622920e5f4fa","lifecycleReferences":[{"eventAt":"2026-01-31T00:00:00.000Z","eventHash":"68d6a985505e451a7d6adda9fbf40dd3ba4085edfe7867876a72aacd324e9808","lifecycleSequence":0,"state":"Hot"}],"manifestId":"manifest-fixture-1","manifestSequence":0,"previousManifestHash":null,"reproducibilityReason":null,"reproducibilityStatus":"Complete","resultHash":"4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18","retentionEpoch":"2026-01-31T00:00:00.000Z","retentionPolicyVersion":"RET-A-1.0"}
```

Byte length: 893. Expected `manifestHash`: `78469b3c9f981b9ffa5752120718bd7baa81e2156a007dbc5f8fbcf49139f4f8`.

Each digest is reproducible with Node.js `crypto.createHash("sha256").update(bytes, "utf8").digest("hex")`; byte length uses `Buffer.byteLength(bytes, "utf8")`. The shell equivalent is `printf '%s' '<exact JSON line>' | sha256sum`; `printf` must not append a newline.

CT-ANA-001 requires two executions with this same frozen input/configuration to reproduce all three exact byte sequences and hashes. A different result fails with `ANALYTICS_DETERMINISM_FAILED`; a `Degraded` bundle cannot be used as a passing sample.

## Planned Contract Tests

| ID | Given / trigger | Expected behavior |
| --- | --- | --- |
| CT-ANA-001 | Repeat the golden Complete P0 configuration | Input, configuration, and result canonical bytes/hashes match exactly |
| CT-ANA-002 | Economic vintages exist at `T - 1ms`, exactly `T`, and `T + 1ms` | The `T + 1ms` vintage is excluded and the greatest eligible release, exactly at `T`, is selected |
| CT-ANA-003 | Multiple latest eligible vintages lack reviewed ordering | Snapshot creation fails with `ANALYTICS_AMBIGUOUS_VINTAGE` |
| CT-ANA-003A | Market revisions exist before, at, and after `T` under a #17-reviewed total order, or multiple eligible revisions lack that order | The greatest ordered revision available at `T` is selected; the future revision is excluded; absent total order fails with `ANALYTICS_AMBIGUOUS_MARKET_REVISION` |
| CT-ANA-004 | A diamond-shaped transformation graph is serialized, or duplicate/unordered/self/cyclic parents are supplied | Deterministic topological-plus-ID order and `outputHash` reproduce exactly; invalid lineage fails before evidence commit; sources are never overwritten |
| CT-ANA-005 | One canonical input/configuration field changes | The applicable hash changes; unchanged domains remain stable |
| CT-ANA-006 | Required input is missing, partial, stale, or quarantined | Run and publication block with the applicable redacted stable error |
| CT-ANA-007 | Rights policy prohibits required retention | Status is `Degraded`; reason is the policy identifier; publication and CT-ANA-001 block |
| CT-ANA-008 | Hash verification fails before use/export/archive/restore/publication | Evidence quarantines and every dependent action blocks |
| CT-ANA-009 | Evidence persistence fails at any commit boundary | No partial bundle/manifest is visible and no current signal changes |
| CT-ANA-010 | Valid evaluation produces no signal | Empty signal result is committed and distinguishable from a blocked run |
| CT-ANA-011 | Storage/lifecycle/capacity state changes | Reproducibility status does not mutate or absorb another state dimension |
| CT-ANA-012 | Shared input set has multiple referencing bundles | It remains retained through the latest referencing full-bundle deadline |
| CT-ANA-013 | Identity without authority attempts read, verify, export, archive, restore, deletion, or administration | Operation fails with `ANALYTICS_EVIDENCE_ACCESS_DENIED`, redacted evidence, and no state change |
| CT-ANA-014 | Equivalent and conflicting commands reuse one idempotency identity | Equivalent replay returns the original result; different content conflicts; neither writes again |
| CT-ANA-015 | Two commands target one authoritative publication version | Exactly one commits; the stale command gets `ANALYTICS_PUBLICATION_VERSION_CONFLICT` |
| CT-ANA-016 | Multiple invalid conditions coexist | Lowest-ranked outcome is stable across runtimes and batch order is deterministic |
| CT-ANA-017 | Manifest successor appends lifecycle and deletion links | Closed fields/order and predecessor hash verify; unknown, duplicate, or unordered content fails |
| CT-ANA-018 | Half-even boundary, negative zero, and chained transformation vectors execute | TypeScript, Python, and PostgreSQL produce identical Quantity/Money/Rate strings and hashes |
| CT-ANA-019 | Denial audit persistence succeeds or fails | Durable redacted denial is recorded, or the secondary audit-failure code degrades readiness; access stays denied |

CT-RET-001..012 apply unchanged. These are design-time vectors; Ring 2 must provide executable TypeScript/Python/PostgreSQL evidence and repository coverage before this public surface is complete.

## Traceability and Open Dependencies

| Source | Coverage |
| --- | --- |
| GitHub #15 | Release-time cutoff, preserved vintages, versioned transformations, immutable reproduction key, and golden P0 hash proof |
| GitHub #11 | Immutable/versioned evidence, least privilege, hash verification, RET-A-1.0 archival/rotation, and governed deletion linkage |
| O-REQ-004 / O-MET-007 | Deterministic point-in-time analytics and exact repeated-run hashes |
| DEC-011 | Point-in-time truth and reproducibility floors are satisfied without weakening provider, security, accessibility, or no-broker floors |
| ADR-001 / DEC-017 / DEC-018 | Accepted retention values, status, integrity, deletion, restore, and capacity behavior |
| Analytics evidence BDD feature | CT-ANA-001, cutoff/no-overwrite, rights-restricted fail-closed behavior |

GitHub #17 must define provider rights records, fixture behavior, raw-payload retention, and the market/economic ingestion identities consumed here. The PostgreSQL, OpenAPI, and event contracts must preserve these identities, hashes, errors, status dimensions, and atomic visibility without changing their semantics. The Proposed analytics activity and physical publication mechanism still require architecture review before implementation.

Any #17 change to the five-part market identity, economic-vintage identity, source-availability meaning, revision ordering, fixture provider identifier, or fixture policy identifier invalidates CT-ANA-001 and requires recomputation of every dependent golden digest plus a repeat Test Reviewer PASS. CT-ANA-003A remains blocked on #17 for a production-provider total order; its fixture branch orders canonical non-negative integer revision strings by integer value after the availability cutoff solely as the versioned fixture-policy order.

This candidate does not freeze or activate `v1.0.0`, close #15/#11, authorize implementation or dependencies, accept Proposed architecture, advance Ring 2, or release parallel execution.
