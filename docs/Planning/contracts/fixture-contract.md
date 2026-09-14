# Fixture Input Contract

**Contract version:** `1.0.0-candidate.2`
**Prototype candidate:** `v1.0.0-prototype.1` - planning, inactive
**Status:** Reviewed candidate; REV-020 Team Lead custody PASS; REV-021 independent alternate-role PASS
**Owner:** Team Lead
**Conformance check:** `PT-FIX-001`
**Architecture status:** Proposed
**Implementation status:** Not started

## Scope and Authority

This contract defines the sole input package boundary for the fixture-only prototype. It governs package identity, file integrity, market and economic observation identities, replay behavior, point-in-time availability, fixture revision order, exact decimal grammar, provenance, data-quality failure, and analytics eligibility.

It does not authorize a live-provider adapter, network egress, provider failover, raw-data redistribution, brokerage behavior, production compatibility, or a Ring 2 implementation. Production-provider rights, identities, and total ordering remain owned by #17. Analytics evidence identity remains governed by `analytics-evidence-contract.md` `1.0.0-candidate.2` and DEC-021/#65.

## Fixture Mode Boundary

Fixture mode is selected explicitly. The ETF product runtime and product-facing contract consumers must have outbound provider access disabled by deterministic configuration and local network or egress policy. A live-provider outage, retry, or missing setting cannot select, alter, or supplement a fixture package. Any live endpoint or product data supplied over network egress promotes `PT-CONTRACT-SCOPE-PROVIDER` and #17 before connection.

Every accepted package is immutable. Loading, validating, or replaying it cannot rewrite package files, normalized observations, prior vintages, or prior revisions.

## Package Layout

One package contains one manifest, the two governed UTF-8 observation files, and one or more governed raw-source objects:

| Relative path | Role | Format |
| --- | --- | --- |
| `manifest.json` | Dataset identity, ordered file descriptors, coverage, and dataset digest | RFC 8785 canonical JSON |
| `market-observations.jsonl` | Market and corporate-action revision observations | One RFC 8785 canonical JSON object per line |
| `economic-vintages.jsonl` | Preserved economic observations and vintages | One RFC 8785 canonical JSON object per line |
| `raw-sources/<sha256>` | Approved source bytes referenced by normalized observations | Exact binary bytes; path suffix equals content SHA-256 |

JSONL files use LF line endings, no byte-order mark, and exactly one trailing LF. Blank lines are prohibited. Each record is independently canonicalized before the trailing LF is added. File descriptors in `manifest.json` are ordered by the UTF-8 bytes of normalized relative path; path separators are `/`, and absolute paths plus `.` or `..` segments are prohibited.

Raw-source objects are included in the ordered manifest file descriptors, exact byte-length checks, file hashes, and `datasetHash`. A package that cannot retain approved source bytes under its fixture policy fails Complete-provenance conformance; it cannot substitute an unverifiable reference or claim analytics eligibility.

## Closed Manifest and Dataset Identity

The manifest is a closed record with exactly these fields; unknown or duplicate JSON members fail with `FIXTURE_MANIFEST_INVALID` before hashing:

| Field | Type and rule |
| --- | --- |
| `datasetId` | String matching `[a-z0-9][a-z0-9-]{0,63}`; stable logical dataset name |
| `datasetVersion` | Immutable calendar version `YYYY.MM.PATCH`; `YYYY` is four digits, `MM` is `01` through `12`, and `PATCH` is `0` or a positive integer without leading zeroes |
| `schemaVersion` | Exact string `1.0.0` |
| `contractVersion` | Exact string `1.0.0-candidate.2` |
| `prototypeCandidate` | Exact string `v1.0.0-prototype.1` |
| `fixturePolicyId` | Exact string `fixture-policy-1` for this candidate |
| `files` | Descriptors for both JSONL files and every referenced raw-source object, using the closed schema below |
| `marketCoverage` | Ordered required market identities and expected session dates used to detect missing input |
| `economicCoverage` | Ordered required series identities and observation dates used to detect missing input |
| `datasetHash` | Lowercase 64-character hexadecimal digest defined below |

Each `files` descriptor is a closed record with exactly `byteLength`, `mediaType`, `recordCount`, `relativePath`, and `sha256`. `byteLength` is a non-negative JSON integer. `recordCount` is a positive JSON integer and equals `1` for each raw-source object. The JSONL media type is exactly `application/x-ndjson`; the raw-source media type is exactly `application/octet-stream`. `relativePath` is unique and normalized. `sha256` is the digest of exact file bytes.

`marketCoverage` contains closed records with exactly `adjustmentPolicy`, `instrumentId`, and `requiredTradingDates`. Entries are unique and ordered by `(instrumentId, adjustmentPolicy)`; each non-empty date array is strictly ascending and duplicate-free. `economicCoverage` contains closed records with exactly `observationDates`, `providerId`, and `seriesId`. Entries are unique and ordered by `(providerId, seriesId)`; each non-empty date array is strictly ascending and duplicate-free. Duplicate file descriptors, coverage identities, or dates fail manifest validation.

`datasetHash` is SHA-256 over the UTF-8 RFC 8785 canonical JSON bytes of the entire closed manifest after removing only `datasetHash` and adding the `domain` member with value `etf.fixture.dataset.v1`; no trailing newline is hashed. Unknown fields are rejected, never ignored. The resulting domain has this shape:

```json
{
  "contractVersion": "1.0.0-candidate.2",
  "datasetId": "<datasetId>",
  "datasetVersion": "<datasetVersion>",
  "domain": "etf.fixture.dataset.v1",
  "economicCoverage": "<manifest economicCoverage value>",
  "files": "<manifest files value>",
  "fixturePolicyId": "fixture-policy-1",
  "marketCoverage": "<manifest marketCoverage value>",
  "prototypeCandidate": "v1.0.0-prototype.1",
  "schemaVersion": "1.0.0"
}
```

The angle-bracket values above denote insertion of typed manifest values, not JSON strings. Each file digest is computed over exact file bytes. Therefore, changing any governed record byte, raw object, path, length, count, media type, descriptor, coverage declaration, or identity changes the dataset digest. Any such change requires a new `datasetVersion`; an existing version cannot be republished with different bytes.

## Common Encoding Rules

- Dates use `YYYY-MM-DD` and must be valid Gregorian dates.
- Timestamps use UTC `YYYY-MM-DDTHH:mm:ss.SSSZ` exactly.
- Identifier fields are case-sensitive. Contract-defined identifiers use ASCII and are not trimmed or case-folded.
- Manifest, descriptor, coverage, market, and economic records are closed; unknown or duplicate fields are prohibited. Required values cannot be JSON null.
- Arrays use the explicit order defined by this contract. Runtime map, filesystem, and database row order have no semantic meaning.
- Hashes use SHA-256 and lowercase hexadecimal.
- Binary floating-point JSON numbers are prohibited for financial values.

## Market Observation Record

Each market record contains exactly these fields:

| Field | Rule |
| --- | --- |
| `instrumentId` | `[A-Z0-9][A-Z0-9._-]{0,63}` |
| `tradingDate` | Canonical date |
| `providerId` | Exact string `fixture` |
| `adjustmentPolicy` | `unadjusted`, `split-adjusted`, or `total-return-adjusted` |
| `revision` | Canonical non-negative integer string: `0` or `[1-9][0-9]*` |
| `sourceAvailableAt` | Canonical UTC timestamp |
| `numericClass` | `UnitPrice`, `Quantity`, `Money`, or `Rate` |
| `value` | Canonical decimal string valid for `numericClass` |
| `currency` | Exact string `USD` for `UnitPrice` or `Money`; exact empty string otherwise |
| `rawSourceRef` | Normalized package path `raw-sources/<rawSourceHash>` resolving to governed source bytes |
| `rawSourceHash` | SHA-256 of the approved source bytes represented by `rawSourceRef` |
| `normalizationId` | Identifier and semantic version of the normalization rule |
| `ingestionJobId` | Immutable fixture-build job identifier |
| `qualityState` | `Valid`, `Partial`, `Stale`, or `Quarantined` |
| `qualityCodes` | Lexically sorted unique stable codes; empty only when `qualityState` is `Valid` |

The five-part market business identity is `(instrumentId, tradingDate, providerId, adjustmentPolicy, revision)`. `sourceAvailableAt`, `ingestionJobId`, and package identity are provenance and replay controls, not members of that business identity.

The job idempotency key is `(datasetId, datasetVersion, ingestionJobId, instrumentId, tradingDate, providerId, adjustmentPolicy, revision)`. Repeating the same key with byte-identical canonical record content is an idempotent success and creates one logical observation. Repeating the key or five-part business identity with different canonical content fails with `FIXTURE_IDEMPOTENCY_CONFLICT`; neither conflicting record is analytics-eligible.

For point-in-time selection at evaluation instant `T`, structurally conforming records with `sourceAvailableAt > T` are excluded before revision ordering. Candidate.2 fixture revisions are ordered as non-negative integers; lexical order is prohibited. The greatest eligible revision is selected before its quality state is evaluated. A selected non-Valid record blocks publication without fallback to an older Valid record. A revision that does not match the canonical integer grammar fails package conformance rather than entering selection; structurally invalid records anywhere in the package fail the package even when they would not be selected.

## Economic Vintage Record

Each economic record contains exactly these fields:

| Field | Rule |
| --- | --- |
| `providerId` | Approved fixture source family identifier: `FRED`, `ALFRED`, `BLS`, `BEA`, or `TREASURY_FISCAL_DATA` |
| `seriesId` | Non-empty case-sensitive ASCII identifier of at most 128 characters |
| `observationDate` | Canonical date |
| `releaseTimestamp` | Canonical UTC timestamp |
| `vintageId` | Non-empty case-sensitive ASCII identifier of at most 128 characters |
| `numericClass` | `UnitPrice`, `Quantity`, `Money`, or `Rate` |
| `value` | Canonical decimal string valid for `numericClass` |
| `rawSourceRef` | Normalized package path `raw-sources/<rawSourceHash>` resolving to governed source bytes |
| `rawSourceHash` | SHA-256 of the approved source bytes represented by `rawSourceRef` |
| `normalizationId` | Identifier and semantic version of the normalization rule |
| `ingestionJobId` | Immutable fixture-build job identifier |
| `qualityState` | `Valid`, `Partial`, `Stale`, or `Quarantined` |
| `qualityCodes` | Lexically sorted unique stable codes; empty only when `qualityState` is `Valid` |

The economic vintage identity is `(providerId, seriesId, observationDate, releaseTimestamp, vintageId)`. The economic job idempotency key is `(datasetId, datasetVersion, ingestionJobId, providerId, seriesId, observationDate, releaseTimestamp, vintageId)`. Repeating the same key and full identity with byte-identical canonical content is an idempotent success and creates one logical vintage. Reusing either with different canonical content fails with `FIXTURE_IDEMPOTENCY_CONFLICT`. Different `vintageId` values at one `(providerId, seriesId, observationDate, releaseTimestamp)` fail with `FIXTURE_TEMPORAL_INVALID`. Production-provider tie behavior remains #17-owned.

For selection at `T`, structurally conforming records with `releaseTimestamp <= T` are eligible. The record with the greatest release timestamp is selected before its quality state is evaluated. A selected non-Valid vintage blocks publication without fallback to an older Valid vintage. Vintages are append-only: a later release never updates, deletes, or reuses an earlier identity. Structurally invalid records anywhere in the package fail the package even when they would not be selected.

## Decimal Grammar and Scale

A canonical decimal is a JSON string matching `-?(0|[1-9][0-9]*)\.[0-9]+`. Positive values have no `+`; exponent notation, leading zeroes, negative zero, `NaN`, and infinities are prohibited. Fixture loading accepts only positive canonical zero. Any negative-zero normalization occurs before package creation and is never performed by a package loader. Every accepted value has exactly the declared number of fractional digits:

| Numeric class | Exact scale | DEC-014 storage class |
| --- | --- | --- |
| `Quantity` | 10 | `NUMERIC(28,10)` |
| `UnitPrice` | 10 | `NUMERIC(28,10)` |
| `Money` | 8 | `NUMERIC(28,8)` |
| `Rate` | 12 | `NUMERIC(28,12)` |

The total coefficient must fit precision 28. Loaders parse exact decimal coefficients and scales; they cannot pass through binary floating point. Excess scale, excess precision, or non-canonical spelling fails conformance. Fixture ingestion never rounds. Derived-result half-even rounding remains governed by DEC-014 and occurs outside this input boundary.

## Provenance and Data Quality

Every normalized record binds its approved source bytes through `rawSourceRef` and `rawSourceHash`, names its normalization rule, and retains its fixture-build job identity. The loader resolves the governed object, verifies its descriptor and exact bytes, then verifies `rawSourceHash`; references cannot be external locations, credentials, or query-bearing URLs. The package cannot claim rights beyond its approved local-fixture policy.

`marketCoverage` entries are ordered by `(instrumentId, adjustmentPolicy)`, with `requiredTradingDates` strictly ascending and duplicate-free within each entry. `economicCoverage` entries are ordered by `(providerId, seriesId)`, with `observationDates` strictly ascending and duplicate-free within each entry. Every declared required identity must resolve to at least one conforming record. Undeclared extra identities fail with `FIXTURE_UNDECLARED_INPUT`; absent required identities fail with `FIXTURE_REQUIRED_MISSING`.

Conformance processing is ordered: closed-record and structural validation; manifest/file/raw-source integrity; identity and replay validation; temporal cutoff; greatest numeric market revision or latest economic release selection; then selected-record quality evaluation and coverage completion. Quality filtering never precedes temporal selection. Only a selected `Valid` record is analytics-eligible. A selected required `Partial`, `Stale`, or `Quarantined` record fails respectively with `FIXTURE_REQUIRED_PARTIAL`, `FIXTURE_REQUIRED_STALE`, or `FIXTURE_REQUIRED_QUARANTINED`, without substitution of an older Valid record. A failure suppresses the affected instrument output and prohibits creation or replacement of an analytics bundle, manifest, or current result. Missing or invalid data cannot be converted to zero, an empty successful result, or a valid no-signal result.

## Deterministic Error Precedence

All defects are collected after safe parsing and reported in this precedence: `FIXTURE_MANIFEST_INVALID`, `FIXTURE_FILE_INTEGRITY_FAILED`, `FIXTURE_DATASET_HASH_MISMATCH`, `FIXTURE_IDEMPOTENCY_CONFLICT`, `FIXTURE_TEMPORAL_INVALID`, `FIXTURE_DECIMAL_INVALID`, `FIXTURE_PROVENANCE_INVALID`, `FIXTURE_UNDECLARED_INPUT`, `FIXTURE_REQUIRED_MISSING`, `FIXTURE_REQUIRED_PARTIAL`, `FIXTURE_REQUIRED_STALE`, then `FIXTURE_REQUIRED_QUARANTINED`. The first code is controlling. Within one code, errors sort by dataset identity, relative path, record type (`market` before `economic`), and complete business identity. Each component uses canonical bytes when valid, the single-byte sentinel `0x00` when absent, or `0x01` followed by its raw UTF-8 `<byte-length>:<value>` encoding when present but invalid; a valid component is prefixed `0x02`. This defines a total order even when canonicalization fails. Runtime discovery and database order are prohibited.

## Stable Conformance Errors

| Code | Meaning |
| --- | --- |
| `FIXTURE_MANIFEST_INVALID` | Manifest schema, path, order, coverage, or fixed binding is invalid |
| `FIXTURE_FILE_INTEGRITY_FAILED` | File byte length, record count, or SHA-256 differs |
| `FIXTURE_DATASET_HASH_MISMATCH` | Canonical dataset digest differs |
| `FIXTURE_IDEMPOTENCY_CONFLICT` | Reused business or job identity has different canonical content |
| `FIXTURE_TEMPORAL_INVALID` | Date, timestamp, vintage, availability, or revision order is invalid |
| `FIXTURE_DECIMAL_INVALID` | Decimal grammar, precision, scale, or numeric class is invalid |
| `FIXTURE_PROVENANCE_INVALID` | Required source or normalization provenance is absent or prohibited |
| `FIXTURE_UNDECLARED_INPUT` | A record is outside declared package coverage |
| `FIXTURE_REQUIRED_MISSING` | Declared required input has no conforming record |
| `FIXTURE_REQUIRED_PARTIAL` | Required record is partial |
| `FIXTURE_REQUIRED_STALE` | Required record is stale |
| `FIXTURE_REQUIRED_QUARANTINED` | Required record is quarantined |

Errors are stable machine-readable codes. Operator-facing application and API contracts must add plain-language recovery without replacing these codes or exposing prohibited source content.

## Candidate.2 Golden Package

The golden raw object is the 30 UTF-8 bytes represented by `approved local fixture source\n`. Its SHA-256 is `70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df`.

The market JSONL file is exactly 543 bytes including its one trailing LF. SHA-256: `bf5e14badd7df4312cc69f818ba8e9123dfe33d0e934223eef5308520aa45cab`.

```json
{"adjustmentPolicy":"split-adjusted","currency":"USD","ingestionJobId":"fixture-build-1","instrumentId":"ETF-1","normalizationId":"fixture-normalization@1.0.0","numericClass":"UnitPrice","providerId":"fixture","qualityCodes":[],"qualityState":"Valid","rawSourceHash":"70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","rawSourceRef":"raw-sources/70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","revision":"1","sourceAvailableAt":"2026-01-30T22:00:00.000Z","tradingDate":"2026-01-30","value":"100.0000000000"}
```

The economic JSONL file is exactly 489 bytes including its one trailing LF. SHA-256: `6d274e625f2f3efbe6e2b6f3160531b8f3b96ab86e846f7167e17ecf3e5ceb13`.

```json
{"ingestionJobId":"fixture-build-1","normalizationId":"fixture-normalization@1.0.0","numericClass":"Rate","observationDate":"2025-12-01","providerId":"FRED","qualityCodes":[],"qualityState":"Valid","rawSourceHash":"70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","rawSourceRef":"raw-sources/70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","releaseTimestamp":"2026-01-15T13:30:00.000Z","seriesId":"CPI","value":"3.000000000000","vintageId":"2026-01-15"}
```

The closed dataset hash domain for these files is exactly 1079 UTF-8 bytes with no trailing LF. SHA-256 and manifest `datasetHash`: `5c68a8c394aecb6e27833f4216bfcd5f5c724e3aff6cfad7980192ec8d1e0b68`.

```json
{"contractVersion":"1.0.0-candidate.2","datasetId":"etf-prototype-core","datasetVersion":"2026.01.0","domain":"etf.fixture.dataset.v1","economicCoverage":[{"observationDates":["2025-12-01"],"providerId":"FRED","seriesId":"CPI"}],"files":[{"byteLength":489,"mediaType":"application/x-ndjson","recordCount":1,"relativePath":"economic-vintages.jsonl","sha256":"6d274e625f2f3efbe6e2b6f3160531b8f3b96ab86e846f7167e17ecf3e5ceb13"},{"byteLength":543,"mediaType":"application/x-ndjson","recordCount":1,"relativePath":"market-observations.jsonl","sha256":"bf5e14badd7df4312cc69f818ba8e9123dfe33d0e934223eef5308520aa45cab"},{"byteLength":30,"mediaType":"application/octet-stream","recordCount":1,"relativePath":"raw-sources/70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df","sha256":"70c5f44217c47edb5239e56ffcb9d4e53581ff58c189ac6912870f1593af74df"}],"fixturePolicyId":"fixture-policy-1","marketCoverage":[{"adjustmentPolicy":"split-adjusted","instrumentId":"ETF-1","requiredTradingDates":["2026-01-30"]}],"prototypeCandidate":"v1.0.0-prototype.1","schemaVersion":"1.0.0"}
```

These values were independently calculated with Node.js standard `crypto` over the displayed exact bytes. Ring 2 must recompute them in every supported runtime; copying the expected digest into actual output is not a valid check.

## PT-FIX-001 Conformance Plan

`specs/features/Fixture-Contract-Conformance.feature` is the design-time behavioral specification for this contract. Its scenarios bind as follows:

| Scenario | Contract behavior |
| --- | --- |
| `PT-FIX-001A` | Fixed golden bytes, exact file integrity, canonical dataset digest, and immutable version |
| `PT-FIX-001B` | Five-part market identity and byte-identical job replay |
| `PT-FIX-001C` | Conflicting replay fails closed |
| `PT-FIX-001D` | Economic `T-1ms`, `T`, and `T+1ms` cutoff with append-only vintages |
| `PT-FIX-001E` | Availability filtering before numeric fixture revision order |
| `PT-FIX-001F` | DEC-014 exact grammar, scale boundaries, and no implicit rounding |
| `PT-FIX-001G` | Missing, partial, stale, and quarantined input suppression |
| `PT-FIX-001H` | Closed manifest/coverage schemas, uniqueness, and normalized paths |
| `PT-FIX-001I` | Governed raw-source retention and independent provenance verification |
| `PT-FIX-001J` | Economic replay, identity conflict, and release-instant uniqueness |
| `PT-FIX-001K` | Selection-before-quality and no stale-to-older-valid fallback for both families |
| `PT-FIX-001L` | Malformed fixture revision rejection before numeric ordering |
| `PT-FIX-001M` | Numeric-class and currency pairing |
| `PT-FIX-001N` | Multi-defect precedence and deterministic batch ordering |
| `PT-FIX-001O` | Observable product-provider egress denial with no fixture substitution |

Ring 2 must bind `PT-FIX-001` to the actual package loader and use fixed package bytes. The runner must validate from a clean state, repeat each scenario independently, alter one governed byte for the negative digest case, and prove no network access. Until those bindings exist and pass, `PT-FIX-001` is a plan, not executed evidence.

## Test Quality Assessment

| Dimension | Design-time score | Basis |
| --- | --- | --- |
| Determinism | 5 | Fixed golden bytes/hashes, timestamps, identities, precedence, and no runtime order |
| Behavioral focus | 5 | Assertions target package acceptance, selection, replay, and publication eligibility |
| Failure specificity | 4 | Core negative paths have stable codes; decimal and currency example rows assert aggregate FAIL |
| Refactoring resistance | 5 | Checks bind the public fixture boundary rather than loader internals |
| Input coverage | 4 | Broad boundary coverage; some rights, duplicate-member, media-type, version-grammar, and coverage-order cases remain Ring 2 vectors |
| Isolation | 5 | Each scenario starts from fixed package state and has no ordering dependency |
| Maintainability | 5 | One aggregate check with lettered scenarios and shared contract vocabulary |

Weighted design-time score: 4.74/5.0, Excellent, using scores `5/5/4/5/4/5/5`. Ring 2 reviewers must rescore executable bindings; this assessment does not claim implementation quality or coverage.

## Traceability and Invalidation

| Authority | Binding |
| --- | --- |
| DEC-013 | Team Lead custody, no-self-approval, change classification, and independent verification remain mandatory |
| GitHub #21 / DEC-022 / REV-017 | Unconditional versioned fixture boundary and named conformance check |
| REV-019 | Fixture surface remains within the independently verified eight-category inventory boundary |
| O-REQ-003 / O-REQ-004 | Provenance, idempotency, DQ checks, failure suppression, vintages, and deterministic snapshots |
| O-CST-003 | UTC/exchange-date meaning and invalid-data blocking |
| O-CST-004 | Explicit fixtures with no within-dataset failover |
| O-CST-005 | Preserved economic vintage truth and non-overwriting transformations |
| O-MET-007 / DEC-021 | Reproducible point-in-time analytics input |
| DEC-014 | Exact field-specific financial precision and no input rounding |
| DEC-011 | Fixture/provider and point-in-time floors remain Proposed and unweakened |

Candidate.2 changes the fixture contract identity and package hash domain but preserves the market five-part identity, economic identity, availability cutoffs, and numeric fixture revision order consumed by the analytics contract. Therefore every dependent CT-ANA fixture binding must update its fixture-contract reference and assess whether its canonical input bytes change; no CT-ANA digest is declared compatible until that assessment and recheck pass.

Any later change to package files, manifest hash domain, market five-part identity, job idempotency, economic vintage identity, availability meaning, fixture revision order, decimal grammar/scale, provenance, DQ suppression, `fixture-policy-1`, or `providerId=fixture` requires a new candidate classification, dependent CT-ANA vector recomputation where affected, Team Lead custody, and independent re-review. Any real provider, network source, or provider-specific total order additionally promotes #17 and `PT-CONTRACT-SCOPE-PROVIDER`.

## Candidate Checklist

- [x] Dataset identity/version and exact content digest are normative.
- [x] Market five-part identity and job idempotency are distinct and deterministic.
- [x] Economic release/vintage timestamps and append-only behavior are normative.
- [x] Source availability is filtered before fixture revision ordering.
- [x] DEC-014 decimal grammar, precision, and scale fail closed without input rounding.
- [x] Raw/normalized provenance and stable DQ suppression are normative.
- [x] `PT-FIX-001A..O` defines the named fixture-conformance plan.
- [x] No live-provider, implementation, baseline activation, or Ring 2 authority is implied.
- [x] REV-020 Team Lead custody recheck passes after approved remediation.
- [x] REV-021 independent alternate-role review passes with no unresolved Critical or Major finding.

## Boundary

This is a non-active planning candidate. It does not make `PT-FIX-001` executable, satisfy `PT-CONTRACT-001` implementation agreement, unblock API/store/provider/stream guards, close #21, freeze `v1.0.0`, accept Proposed architecture, authorize dependencies or implementation, release parallel work, or advance Ring 2.
