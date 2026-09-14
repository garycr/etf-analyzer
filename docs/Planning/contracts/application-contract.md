# Application Boundary Contract

**Contract version:** `1.0.0-candidate.2`
**Prototype candidate:** `v1.0.0-prototype.1` - planning, inactive
**Status:** Complete for design-time resolution; candidate.2 custody and REV-026 independent verification PASS; REV-022/023 remain historical for candidate.1
**Owner:** Team Lead
**Conformance check:** `PT-APP-001A..P`
**Architecture status:** Proposed
**Implementation status:** Not started

## Scope and Authority

This contract defines the transport-independent application boundary consumed by the local browser workbench. It owns the closed operation catalog, common command/query and result envelopes, application orchestration, durable job presentation, readiness semantics, canonical display values, redaction, research-only warnings, and keyboard-operable recovery.

Domain/order, ledger, fixture, and analytics contracts retain authority over their states, invariants, arithmetic, identities, and stable errors. This contract preserves those meanings and cannot translate a failure into success, bypass a guard, collapse a paper-order transition, modify a canonical value, or publish blocked evidence.

This contract does not define HTTP paths/status codes, PostgreSQL tables, CSS/component layout, authentication infrastructure, event transport, or deployment. Those belong to the later OpenAPI, PostgreSQL, implementation, and deployment surfaces. It authorizes no broker, external account, credential transmission, real order, provider-side paper API, public ingress, dependency, implementation, baseline activation, or Ring 2 work.

## Prototype Boundary

- One local user operates one browser workbench against one localhost application runtime.
- Approved local fixtures are the only prototype input source; provider egress remains disabled.
- Commands execute through one sequential application stream. No operation creates a durable asynchronous handoff, outbox, queue, scheduled consumer, or parallel contract consumer.
- Durable job status, checkpoint, restart, failure visibility, and readiness remain mandatory even without an event surface.
- The exact warning `Research only — hypothetical — user makes all investment decisions.` is visible on every analytical result, evidence, and paper-action view.

## Closed Operation Catalog

Operation names are case-sensitive. Unknown names fail with `APPLICATION_OPERATION_UNKNOWN` before any owning behavior is invoked.

### Commands

| Operation | Required intent | Owning contract effect |
| --- | --- | --- |
| `WatchlistPut` | Add or update one validated ETF instrument in the local watchlist | Application-owned configuration only; no order or ingestion side effect |
| `WatchlistRemove` | Remove one watchlist instrument | Application-owned configuration only; immutable evidence is not deleted |
| `WatchlistReorder` | Replace display order using the complete deduplicated watchlist identity set | Application-owned configuration only |
| `FixtureIngestionStart` | Start one bounded load of an explicitly named fixture dataset/version | Fixture contract validation; durable job lifecycle |
| `JobRestart` | Resume one restartable Failed job from its last committed checkpoint | Same job identity and operation; no duplicate committed effects |
| `AnalyticsRun` | Run the accepted P0 analytics allocation for a named point-in-time input/configuration | Analytics contract and DEC-021/#65 guards |
| `PaperOrderDraftCreate` | Create one local Draft from displayed research after explicit user action | Domain OT-01 only |
| `PaperOrderTransition` | Request exactly one named OT transition with explicit confirmation where required | Domain contract; cannot skip or collapse transitions |
| `DiagnosticsExportCreate` | Produce one redacted diagnostic export from allowlisted operational metadata | Application redaction rules; no raw payload export |

### Queries

| Operation | Result | Side-effect boundary |
| --- | --- | --- |
| `WatchlistGet` | Ordered local watchlist with validation state | No ingest, analytics, or paper mutation |
| `JobGet` | Durable status, progress, checkpoint, controlling error, and recovery for one job | No implicit retry or restart |
| `ReadinessGet` | Current application readiness and dependency details | No dependency repair or analytical-validity claim |
| `AnalyticsResultGet` | Current publishable result or owning analytics blocking error | Never returns an unpublished/invalid result as current |
| `EvidenceGet` | Authorized, redacted evidence metadata/content permitted by analytics policy | Denial never mutates evidence/publication state |
| `PaperOrderGet` | Canonical order state, aggregate version, and redacted transition history | No transition or simulation |
| `PortfolioGet` | Canonical cash, lots, positions, valuations, and reconciliation state | No rebuild repair or ledger mutation |

Each operation resolves to exactly one definition above. An OpenAPI operation may map to one catalog entry but cannot introduce another application operation without a new candidate classification and review.

### Closed Operation Schemas

Schema notation is normative: `T?` is the only nullable form, `T[]` is an ordered list, `{}` is the closed empty record, and fields appear below in canonical serialization order. `UUID`, `Date`, `UTCInstant`, `Sha256`, and fixed-point values use the grammars already owned by their source contracts; `UInt` is a canonical non-negative integer string. Every named record is closed. A missing required field, duplicate member, unknown member, invalid scalar, or null outside `?` fails with `APPLICATION_REQUEST_INVALID` before owner dispatch.

| Operation | Exact payload | Exact success `data` |
| --- | --- | --- |
| `WatchlistPut` | `{instrumentId: String, displayName: String, expectedVersion: UInt}` | `{item: WatchlistItem, version: UInt}` |
| `WatchlistRemove` | `{instrumentId: String, expectedVersion: UInt}` | `{version: UInt}` |
| `WatchlistReorder` | `{orderedInstrumentIds: String[], expectedVersion: UInt}` | `{orderedItems: WatchlistItem[], version: UInt}` |
| `FixtureIngestionStart` | `{jobId: UUID, datasetId: String, datasetVersion: String, fixturePackageHash: Sha256}` | `{job: Job}` |
| `JobRestart` | `{jobId: UUID}` | `{job: Job}` |
| `AnalyticsRun` | `{jobId: UUID, evidenceCommandId: UUID, asOfDate: Date, configurationHash: Sha256, inputEvidenceIds: UUID[]}` | `{job: Job}` |
| `PaperOrderDraftCreate` | `{orderId: UUID, researchEvidenceId: UUID, side: OrderSide, quantity: Quantity, unitPrice: UnitPrice, tradeDate: Date}` | `{order: PaperOrder}` |
| `PaperOrderTransition` | `{orderId: UUID, transitionCommandId: UUID, expectedVersion: UInt, transition: OrderTransition, transitionPayload: TransitionPayload}` | `{order: PaperOrder}` |
| `DiagnosticsExportCreate` | `{exportId: UUID, from: UTCInstant, through: UTCInstant, requestedCodes: String[]}` | `{export: DiagnosticExport}` |
| `WatchlistGet` | `{}` | `{orderedItems: WatchlistItem[], version: UInt}` |
| `JobGet` | `{jobId: UUID}` | `{job: Job}` |
| `ReadinessGet` | `{}` | `{readiness: Readiness}` |
| `AnalyticsResultGet` | `{publicationTargetId: UUID}` | `{result: AnalyticsResult}` |
| `EvidenceGet` | `{evidenceId: String}` | `{evidence: Evidence}` |
| `PaperOrderGet` | `{orderId: UUID}` | `{order: PaperOrder}` |
| `PortfolioGet` | `{portfolioId: UUID, asOf: UTCInstant}` | `{portfolio: Portfolio}` |

`WatchlistItem` is `{instrumentId: String, displayName: String, validationState: Valid|Invalid, position: UInt}`. Watchlist lists sort by numeric `position`, then `instrumentId`. `Confirmation` is `{actorId: local-user, confirmedAt: UTCInstant, confirmationText: String}`. `DiagnosticExport` is `{exportId: UUID, createdAt: UTCInstant, codes: String[], itemCount: UInt, contentHash: Sha256}` with unique codes sorted by Unicode code point. `Job`, `Readiness`, and presentation records are closed below.

`Quantity` and `UnitPrice` are exact DEC-014/ledger `1.0.0-candidate.2` canonical scale-10 strings; `Money` is its canonical scale-8 string. `OrderSide` is the closed application input enum `Buy|Sell`. `OrderState` is the exact domain `1.0.0-candidate.1` enum `Draft|Submitted|Accepted|Partial|Filled|Rejected|Canceled|Expired`. `OrderTransition` is `OT-02|OT-03|OT-04|OT-05|OT-06|OT-07|OT-08|OT-09|OT-10`; OT-01 is dispatched only by `PaperOrderDraftCreate`.

`PaperOrder` is the closed application projection `{orderId: UUID, state: OrderState, aggregateVersion: UInt, researchEvidenceId: UUID, side: OrderSide, requestedQuantity: Quantity, filledQuantity: Quantity, openQuantity: Quantity, unitPrice: UnitPrice, tradeDate: Date, confirmation: Confirmation?, transitionHistory: OrderTransitionRecord[]}`. `OrderTransitionRecord` is `{transitionCommandId: UUID, transition: OT-01|OrderTransition, sourceState: Initial|OrderState, targetState: OrderState, trigger: String, occurredAt: UTCInstant, actorId: local-user, correlationId: UUID, priorVersion: UInt, resultingVersion: UInt, baselineVersion: v1.0.0}` and sorts by numeric `resultingVersion`, then `transitionCommandId`. Every value is copied from domain-authoritative state/evidence; the application cannot infer or rewrite it.

`Portfolio` is the closed application projection `{portfolioId: UUID, portfolioVersion: UInt, asOf: UTCInstant, valuationSnapshotId: UUID, precisionPolicyVersion: DEC-014, baselineVersion: v1.0.0, cash: Money, lots: PortfolioLot[], positions: PortfolioPosition[], realizedPnL: Money, totalEquity: Money, reconciliationState: Reconciled|IntegrityBlocked}`. `PortfolioLot` is `{lotId: UUID, instrumentId: String, acquiredAt: UTCInstant, ledgerSequence: UInt, openQuantity: Quantity, openBasis: Money}` and sorts by `(acquiredAt, numeric ledgerSequence, lotId)`. `PortfolioPosition` is `{instrumentId: String, quantity: Quantity, basis: Money, valuation: Money, unrealizedPnL: Money}` and sorts by `instrumentId`. Values are copied from the ledger `1.0.0-candidate.2` authoritative rebuild and reconciliation result; `IntegrityBlocked` exposes no unreconciled values as current.

`AnalyticsResult` is a normative opaque import of the analytics/evidence `1.0.0-candidate.2` closed result object under `resultSchemaVersion`: exactly `domain`, `resultSchemaVersion`, `configurationHash`, `signals`, `trades`, `metrics`, and `warnings` in owner-defined order. `Evidence` is a normative opaque import of that candidate's Full Evidence Bundle under `evidenceSchemaVersion`. Opaque import means the application returns the complete owner record byte-for-byte after authorization, redaction, and hash verification; it cannot add, remove, reorder, null, or reinterpret owner fields. A changed owner candidate or schema version requires application impact classification.

### Domain Transition Mapping

The application constructs exactly one domain `1.0.0-candidate.1` transition command. It copies `orderId`, `transitionCommandId`, `correlationId`, and `expectedVersion`; reads `sourceState` from the authoritative aggregate; derives `targetState` and `trigger` only from this table; validates and copies the exact normalized payload; and sets `baselineVersion` to `v1.0.0`. Any source mismatch or payload member outside the selected row is left to the unchanged domain guard/error precedence.

| OT | Required source | Target | Trigger | Exact normalized transition payload |
| --- | --- | --- | --- | --- |
| OT-01 | `Initial` | `Draft` | `UserCreatedFromResearch` | `{researchEvidenceId, side, quantity, unitPrice, tradeDate}`; application `commandId` becomes `transitionCommandId`, version is `0` |
| OT-02 | `Draft` | `Submitted` | `UserConfirmedPaperAction` | `{confirmation: Confirmation}` |
| OT-03 | `Submitted` | `Accepted` | `PortfolioValidationPassed` | `{portfolioId: UUID, validationSnapshotId: UUID, expectedPortfolioVersion: UInt}` |
| OT-04 | `Submitted` | `Rejected` | `PortfolioValidationFailed` | `{rejectionCode: String}` |
| OT-05 | `Accepted` | `Partial` | `LocalPartialFillSimulated` | `FillPayload` |
| OT-06 | `Accepted` | `Filled` | `LocalCompleteFillSimulated` | `FillPayload` |
| OT-07 | `Accepted` | `Canceled` | `UserCanceledOpenQuantity` | `{reasonCode: String}` |
| OT-08 | `Accepted` | `Expired` | `DeterministicExpiryReached` | `{expiresAt: UTCInstant}` |
| OT-09 | `Partial` | `Filled` | `LocalRemainderFillSimulated` | `FillPayload` |
| OT-10 | `Partial` | `Canceled` | `UserCanceledRemainingQuantity` | `{reasonCode: String}` |

`FillPayload` is exactly `{portfolioId: UUID, transactionId: UUID, fillId: UUID, expectedPortfolioVersion: UInt, quantity: Quantity, unitPrice: UnitPrice, fee: Money}`. `TransitionPayload` is the closed discriminated union of the OT-02..OT-10 payload rows; it has no discriminator member because `transition` selects the variant. Draft creation maps to OT-01; every other operation is forbidden from constructing a domain transition command.

| Operation group | Owning identity and errors | Allowed effect |
| --- | --- | --- |
| Watchlist operations | Application version; `APPLICATION_REQUEST_INVALID` or owning version conflict | One atomic local watchlist mutation |
| `FixtureIngestionStart` | `(datasetId, datasetVersion, jobId)`; unchanged `FIXTURE_*` errors | One job plus accepted fixture observations |
| `JobRestart` | Existing `jobId`; job/application or unchanged owning failure | One new attempt on the same job |
| `AnalyticsRun` | `(evidenceCommandId, jobId)`; unchanged `ANALYTICS_*` errors | One job plus owner-authorized evidence/publication |
| Paper-order commands | Domain identities; unchanged `ORDER_*` and `LEDGER_*` errors | Exactly OT-01 or one named OT transition |
| `DiagnosticsExportCreate` | `exportId`; application redaction errors | One allowlisted diagnostic export |
| All queries | Named payload identity; unchanged owning access/integrity errors | None |

Input identity lists reject duplicates. `orderedInstrumentIds` must equal the complete watchlist identity set and preserves caller order; `inputEvidenceIds` sorts lexically before owner dispatch. Result lists use the ordering defined here or by their owning contract and never depend on storage retrieval order.

## Common Request Envelope

Every operation request is a closed record with exactly these common fields plus its operation-specific payload:

| Field | Rule |
| --- | --- |
| `operation` | Exact catalog name |
| `requestId` | Non-empty UUID; identifies one invocation and is never an idempotency key |
| `correlationId` | Non-empty UUID linking one user workflow; trace-only |
| `actorId` | Exact prototype value `local-user` |
| `prototypeCandidate` | Exact value `v1.0.0-prototype.1` |
| `contractVersion` | Exact value `1.0.0-candidate.2` |
| `requestedAt` | Canonical UTC timestamp `YYYY-MM-DDTHH:mm:ss.SSSZ` supplied by an injected clock |
| `payload` | Closed operation-specific record; unknown fields fail |

Every command additionally requires `commandId`, a non-empty UUID. The application replay key is `(operation, commandId)`. Canonical replay content is RFC 8785 JSON containing exactly `operation`, `actorId`, `prototypeCandidate`, `contractVersion`, and the complete `payload`; it excludes `commandId`, `requestId`, `correlationId`, and `requestedAt`.

After operation/envelope grammar and authorization, but before readiness, admission, or owner dispatch, the application looks up that replay key atomically. Equivalent canonical content returns the original complete result without rechecking readiness or repeating effects. Different canonical content returns `APPLICATION_IDEMPOTENCY_CONFLICT` without owner dispatch. A new application replay key proceeds to the owner and never bypasses owning idempotency: transition commands use `(orderId, transitionCommandId)`, fixture ingestion uses `(datasetId, datasetVersion, jobId)`, and analytics uses `(evidenceCommandId, jobId)`; any owner conflict is returned unchanged.

Queries have no `commandId`, are side-effect free, and cannot invoke a command as a hidden refresh, recovery, or convenience behavior.

## Common Result Envelope

Every result is a closed record:

| Field | Rule |
| --- | --- |
| `operation` | Echoed exact catalog name when parseable |
| `requestId` | Echoed invocation identity |
| `correlationId` | Echoed trace identity |
| `outcome` | `Succeeded` or `Failed` |
| `completedAt` | Canonical UTC timestamp from an injected clock |
| `data` | Operation result when `Succeeded`; absent when `Failed` |
| `error` | Error envelope when `Failed`; absent when `Succeeded` |
| `warnings` | Ordered unique warning codes; empty when none |
| `presentation` | Presentation metadata defined below |

An error envelope contains exactly `code`, `message`, `boundedIdentifiers`, and `recovery`. `code` is the unchanged owning stable code when one exists. `message` is plain language that states what failed and how the operator can proceed without values, secrets, raw payloads, stack traces, or command bodies. `boundedIdentifiers` is an allowlisted map containing only identifiers needed to locate the affected local object. `recovery` is either null for an unrecoverable terminal result or the closed recovery action below.

## Command Orchestration and Paper Safety

Displaying, refreshing, selecting, or querying research has no paper-order or portfolio effect. `PaperOrderDraftCreate` requires an explicit user invocation and dispatches only OT-01. `PaperOrderTransition` dispatches exactly one transition command. Draft-to-Submitted requires explicit confirmation by the same local user; absent, canceled, expired, or incomplete confirmation leaves the order Draft and performs no fill, ledger, or portfolio mutation.

An application workflow may guide the user through later transitions but cannot send them implicitly, batch multiple OT transitions into one domain command, skip an intermediate state, or present local validation/simulation as external execution. Every transition result exposes its actual canonical state and aggregate version.

## Durable Job Contract

The closed serialized job statuses are `Pending`, `Running`, `Succeeded`, and `Failed`; job types are `FixtureIngestion` and `Analytics`; restartability values are `Restartable` and `NotRestartable`. No cancellation operation or status exists.

`Job` is exactly `{jobId: UUID, jobType: FixtureIngestion|Analytics, status: Pending|Running|Succeeded|Failed, restartability: Restartable|NotRestartable, attempt: UInt, operation: FixtureIngestionStart|AnalyticsRun, originalCommandId: UUID, inputIdentity: FixtureInputIdentity|AnalyticsInputIdentity, createdAt: UTCInstant, startedAt: UTCInstant?, completedAt: UTCInstant?, checkpoint: JobCheckpoint?, acceptedCount: UInt, rejectedCount: UInt, controllingError: Error?}`. `attempt` begins at `1`. `FixtureInputIdentity` is `{datasetId: String, datasetVersion: String, fixturePackageHash: Sha256}`; `AnalyticsInputIdentity` is `{evidenceCommandId: UUID, asOfDate: Date, configurationHash: Sha256, inputEvidenceIds: UUID[]}`. `JobCheckpoint` is `{checkpointId: UUID, attempt: UInt, sequence: UInt, committedAt: UTCInstant, contentHash: Sha256}` and identifies only committed work. Progress and status survive process restart through the future PostgreSQL contract.

The only legal transitions are `Pending -> Running`, `Pending -> Failed`, `Running -> Succeeded`, `Running -> Failed`, and `Failed -> Pending` through explicit `JobRestart`. Terminal `Succeeded` cannot transition. Any other transition fails without mutation under the controlling application or owning code.

`JobRestart` is valid only for a `Failed` job whose `restartability` is `Restartable`. It retains `jobId`, `jobType`, `operation`, `originalCommandId`, input identity, and committed checkpoint; it increments `attempt` by exactly one, transitions to `Pending`, and cannot duplicate previously committed effects. Non-restartable or non-Failed jobs return `APPLICATION_JOB_NOT_RESTARTABLE` without changing status, attempt, checkpoint, or committed effects.

A required-input, dependency, integrity, persistence, or provider-policy failure produces `Failed` with the specific owning code. Zero accepted rows never proves success. `Succeeded` requires the operation's completeness conditions; a valid analytical no-signal result is successful only when fully evaluated and hash-verified under the analytics contract. Failed jobs keep dependent research blocked and visible until corrected and explicitly restarted.

The `Pending` status represents an in-process sequential operation awaiting its turn in the single application stream. It does not authorize a queue, outbox, delayed consumer, scheduler, or event contract.

## Readiness Contract

`ReadinessGet` returns wire state `Ready` or `NotReady`. Readiness is `NotReady` when required PostgreSQL connectivity fails, required migrations are incomplete, required fixture/provider policy configuration is invalid, local dependency checks fail, or a security-critical audit/integrity path explicitly requires readiness degradation.

`Readiness` is exactly `{state: Ready|NotReady, checkedAt: UTCInstant, displayTimezone: UTC, liveness: Live|NotLive, dependencies: ReadinessDependency[], controllingError: Error?}`. `ReadinessDependency` is exactly `{dependency: PostgreSQL|Migrations|FixturePolicy|LocalDependency|DenialAudit|LedgerIntegrity, state: Ready|NotReady, checkedAt: UTCInstant, code: String?}`. Dependencies always appear in that enum order. `controllingError` is null only for `Ready`; for `NotReady`, it is selected under application error precedence. Liveness is reported in the same snapshot but does not alter `state`.

| Application code | Condition |
| --- | --- |
| `APPLICATION_DATABASE_UNAVAILABLE` | Required PostgreSQL connectivity failed |
| `APPLICATION_MIGRATIONS_INCOMPLETE` | Required migration set is absent, incomplete, repeated incorrectly, or incompatible |
| `APPLICATION_CONFIGURATION_INVALID` | Required fixture, policy, baseline, or local configuration is missing or invalid |
| `APPLICATION_DEPENDENCY_UNAVAILABLE` | Another mandatory local dependency check failed |

Owning security/integrity codes, including `ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED` and `LEDGER_INTEGRITY_FAILED`, remain unchanged when they control readiness. Liveness reports process health separately and never implies readiness. `Ready` confirms only application dependencies and required controls; it does not claim provider rights, fixture freshness, analytical validity, evidence completeness, ledger reconciliation, or release readiness.

## Stable Application Errors and Precedence

| Code | Condition |
| --- | --- |
| `APPLICATION_OPERATION_UNKNOWN` | Operation name is absent, unknown, or incorrectly cased |
| `APPLICATION_REQUEST_INVALID` | Common or operation payload is malformed, open, or fails field grammar |
| `APPLICATION_UNAUTHORIZED` | The local actor is not authorized for the operation |
| `APPLICATION_IDEMPOTENCY_CONFLICT` | Application command identity is reused with different content and no narrower owning code applies |
| `APPLICATION_JOB_NOT_FOUND` | Requested job identity does not exist |
| `APPLICATION_JOB_NOT_RESTARTABLE` | Job status or policy forbids restart |
| `APPLICATION_DATABASE_UNAVAILABLE` | Required PostgreSQL connectivity failed |
| `APPLICATION_MIGRATIONS_INCOMPLETE` | Required migrations are incomplete or invalid |
| `APPLICATION_CONFIGURATION_INVALID` | Required application configuration is invalid |
| `APPLICATION_DEPENDENCY_UNAVAILABLE` | Required local dependency failed |
| `APPLICATION_PERSISTENCE_FAILED` | Application-owned atomic persistence failed after owner validation |
| `APPLICATION_REDACTION_FAILED` | Safe allowlist export or presentation cannot be proven |

The lowest numeric rank controls:

| Rank | Validation phase |
| ---: | --- |
| 10 | Operation presence, exact spelling, and catalog membership |
| 20 | Closed common envelope and operation payload grammar |
| 30 | Authorization |
| 40 | Application replay lookup and canonical-content conflict |
| 50 | Readiness and operation admission |
| 60 | Owning contract validation in that owner's published numeric precedence |
| 70 | Application-owned atomic persistence; `APPLICATION_PERSISTENCE_FAILED` |
| 80 | Result redaction and presentation |

All detectable candidates are ranked before one public result is selected. Application codes have exactly the phase shown above: `APPLICATION_DEPENDENCY_UNAVAILABLE` is rank 50 and never represents persistence; `APPLICATION_PERSISTENCE_FAILED` is rank 70. When multiple owner failures are candidates at application rank 60, the owner's published internal precedence selects first; for example, analytics rank-40 `ANALYTICS_INPUT_INCOMPLETE` controls analytics rank-80 `ANALYTICS_INTEGRITY_FAILED`. Remaining same-rank candidates sort by `(operation, requestId, code)` using Unicode code-point order; absent or grammatically invalid `operation` or `requestId` sorts as the empty string. The first candidate controls. Required companion codes such as `ANALYTICS_PUBLICATION_BLOCKED` remain companions and do not replace the specific cause.

Owning codes retain exact spelling and cause, including all `ORDER_*`, `FIXTURE_*`, `ANALYTICS_*`, and `LEDGER_*` families defined by reviewed candidates. Unknown internal exceptions fail as `APPLICATION_DEPENDENCY_UNAVAILABLE`; stack traces and internal messages are not promoted into the public error model.

## Canonical Display Contract

Wire values remain canonical contract values. Presentation cannot round, localize, abbreviate, or change semantic state.

| Value class | Wire rule | Display rule |
| --- | --- | --- |
| Domain state | Exact domain enum | `Partial` displays **Partially Filled**; other states display their domain labels |
| Job status | Exact job enum | `Pending`, `Running`, `Succeeded`, `Failed` |
| Readiness | `Ready` or `NotReady` | **Ready** or **Not Ready** |
| Date | `YYYY-MM-DD` | Same text |
| Trade date | `YYYY-MM-DD` | `Trade date: YYYY-MM-DD` |
| UTC instant | `YYYY-MM-DDTHH:mm:ss.SSSZ` | `YYYY-MM-DD HH:mm:ss.SSS UTC` |
| Source timestamp | Canonical UTC instant | `Source time: YYYY-MM-DD HH:mm:ss.SSS UTC` |
| Retrieval timestamp | Canonical UTC instant | `Retrieved at: YYYY-MM-DD HH:mm:ss.SSS UTC` |
| Completion timestamp | Canonical UTC instant | `Completed at: YYYY-MM-DD HH:mm:ss.SSS UTC` |
| Display timezone | Exact `UTC` | `Display timezone: UTC` |
| Quantity/UnitPrice | DEC-014 exact scale 10 | Fixed-point text with exactly 10 fractional digits |
| Money | DEC-014 exact scale 8 | Fixed-point text with exactly 8 fractional digits |
| Rate/ratio/weight | DEC-014 exact scale 12 | Fixed-point text with exactly 12 fractional digits |
| Error | Stable code plus plain message | Both code and message available programmatically; never color-only |

Presentation may add a separately labeled human-friendly value only when the canonical value remains available and unchanged. Locale grouping, currency symbols, percentages, relative time, and timezone conversion are outside candidate.1 because they can obscure canonical evidence.

## Presentation and Accessible Recovery

The result `presentation` record contains exactly `statusText`, `announcement`, `warningText`, and `researchWarningRequired`. `announcement` is `None`, `PoliteStatus`, or `AssertiveAlert`. Persistent progress/recovery uses `PoliteStatus`; a newly reached blocked integrity, denial, or readiness state uses `AssertiveAlert`; routine query refresh uses `None`. Repeated unchanged states are not re-announced. Analytical-result, evidence, and paper-action results set `researchWarningRequired` to `true` and `warningText` to exactly `Research only — hypothetical — user makes all investment decisions.`; every other result sets `researchWarningRequired` to `false` and `warningText` to null.

Every reachable Failed, blocked, quarantined, version-conflict, integrity-blocked, and NotReady state provides visible non-color text, programmatic name/role/state, a plain cause, and a keyboard-operable recovery or escalation action when one exists. A recovery record contains exactly:

| Field | Rule |
| --- | --- |
| `actionId` | Stable case-sensitive action identity |
| `label` | Plain visible command label |
| `targetOperation` | One catalog command/query invoked only after explicit activation |
| `focusTarget` | Stable target receiving focus after success or failure |
| `requiresConfirmation` | Boolean; true for any paper mutation or destructive local action |

The following mapping is closed. The named state and available bounded context determine exactly one record and target payload:

| State | Required bounded context | Exact recovery record | Exact target payload |
| --- | --- | --- | --- |
| `Failed` and `Restartable` | `jobId` | `{actionId: retry-job, label: Retry job, targetOperation: JobRestart, focusTarget: job-status, requiresConfirmation: false}` | `{jobId}` |
| `Failed` and `NotRestartable` | `jobId` | `{actionId: review-job, label: Review job details, targetOperation: JobGet, focusTarget: job-details, requiresConfirmation: false}` | `{jobId}` |
| `InputQuarantined` | `evidenceId` | `{actionId: review-evidence, label: Review data issue, targetOperation: EvidenceGet, focusTarget: evidence-details, requiresConfirmation: false}` | `{evidenceId}` |
| `VersionConflict` | `orderId` | `{actionId: reload-order, label: Reload current order, targetOperation: PaperOrderGet, focusTarget: order-details, requiresConfirmation: false}` | `{orderId}` |
| `IntegrityBlocked` | none | `{actionId: review-integrity, label: Review integrity status, targetOperation: ReadinessGet, focusTarget: readiness-details, requiresConfirmation: false}` | `{}` |
| `NotReady` | none | `{actionId: review-readiness, label: Review readiness details, targetOperation: ReadinessGet, focusTarget: readiness-details, requiresConfirmation: false}` | `{}` |
| `DraftAwaitingConfirmation` | `orderId`, presented `aggregateVersion`, fresh UUID from the activation-scoped injected generator, and user-supplied `Confirmation` | `{actionId: submit-paper-order, label: Submit paper order, targetOperation: PaperOrderTransition, focusTarget: order-status, requiresConfirmation: true}` | `{orderId, transitionCommandId: fresh UUID, expectedVersion: presented aggregateVersion, transition: OT-02, transitionPayload: {confirmation: Confirmation}}` |

The fresh `transitionCommandId` is generated only after explicit activation and remains fixed across transport retries of that activation. `expectedVersion` is copied from the presented `PaperOrder.aggregateVersion`; a changed authoritative version therefore produces unchanged `ORDER_VERSION_CONFLICT`. Missing required identity/context, denied access, or absence of a safe catalog operation yields `recovery: null`, no target payload, and a non-actionable escalation message. The application never invents an operation, dispatches a null recovery, or embeds an unbounded value.

Focusing, announcing, or rendering a recovery action never invokes it. Keyboard activation and pointer activation dispatch the same operation. Focus remains on the triggering control while processing, moves to the first actionable error on validation failure, and moves to the named result/status target on success. No recovery bypasses authorization, idempotency, expected-version, DQ, integrity, confirmation, or readiness guards.

## Redaction and Diagnostics

Diagnostic export is allowlist-only. Permitted fields are stable error/warning codes; bounded local identifiers (`requestId`, `correlationId`, `jobId`, `orderId`, `evidenceId`, dataset ID/version); canonical statuses; UTC timestamps; non-sensitive counts/durations; schema/contract/baseline versions; and lowercase SHA-256 evidence or configuration hashes.

Prohibited content includes credentials, API keys, passwords, tokens, Kubernetes Secret values, environment secrets, raw provider or fixture-source bytes, query-bearing source URLs, full command/request payloads, stack traces, SQL text/values, protected anchor keys, brokerage artifacts, and values denied by evidence policy. Symbols and user-entered text are excluded unless a future reviewed allowlist explicitly requires them.

Redaction occurs before logging, tracing, presentation, persistence of diagnostic bundles, or export. If safe redaction cannot be proven, the application returns `APPLICATION_REDACTION_FAILED`, produces no export, and records only that stable code plus bounded correlation metadata.

## PT-APP-001 Conformance Plan

`specs/features/Application-Boundary-Conformance.feature` is the design-time behavioral specification:

| Scenario | Contract behavior |
| --- | --- |
| `PT-APP-001A` | Closed case-sensitive operation catalog and unknown-operation rejection |
| `PT-APP-001B` | Displayed research has no paper mutation effect |
| `PT-APP-001C` | Explicit confirmation and exactly one visible domain transition |
| `PT-APP-001D` | Failed/Restartable checkpoint restart, incremented attempt, and restart refusal |
| `PT-APP-001E` | Failed job visibility; zero rows never means success |
| `PT-APP-001F` | Migration/database/config/audit readiness dependencies and keyboard recovery |
| `PT-APP-001G` | Readiness remains distinct from analytical validity |
| `PT-APP-001H` | Owning stable code/cause preservation and non-bypassing recovery |
| `PT-APP-001I` | Canonical decimal/state forms and five distinct timestamp/date roles |
| `PT-APP-001J` | Exact warning text and applicable/non-applicable presentation metadata |
| `PT-APP-001K` | Allowlist-only diagnostic export and fail-closed redaction |
| `PT-APP-001L` | Perceivable blocked states, announcements, focus, and keyboard recovery |
| `PT-APP-001M` | One valid and malformed closed-schema vector for each of 16 operations |
| `PT-APP-001N` | Application equivalent/conflicting replay and unchanged owning conflict |
| `PT-APP-001O` | Numeric error precedence, deterministic ties, and collision behavior |
| `PT-APP-001P` | Closed job enums/transitions without cancellation, queue, or event scope |

Ring 2 must bind these scenarios to the public application service interface with injected clocks and fixed identities. Every scenario runs independently without network/provider access. Until bindings execute, `PT-APP-001` is a plan, not passing implementation evidence.

## Test Quality Assessment

| Dimension | Design-time score | Basis |
| --- | ---: | --- |
| Determinism | 5 | Fixed identities, timestamps, values, states, and no network dependency |
| Behavioral focus | 5 | Public application outcomes rather than UI, HTTP, or storage internals |
| Failure specificity | 4 | Stable codes are specified; executable owner collision bindings remain Ring 2 work |
| Refactoring resistance | 5 | Transport/storage/component implementations may change independently |
| Input coverage | 5 | Every operation has valid/malformed vectors plus replay, lifecycle, and collision boundaries |
| Isolation | 5 | Scenarios use independent state and explicit commands |
| Maintainability | 5 | One closed catalog and shared result/recovery vocabulary |

Weighted design-time score: 4.86/5.0, Excellent (`5/5/4/5/5/5/5`). Ring 2 reviewers must separately rescore executable bindings and enforce coverage gates.

## Traceability

| Authority | Binding |
| --- | --- |
| Issue #21 / DEC-022 / REV-017 | Unconditional transport-independent application boundary |
| Issue #22 | Accessibility, latency-adjacent presentation, readiness, recovery, observability, and redaction acceptance inputs |
| O-REQ-001 | Local single-user browser workbench; no brokerage/credential/real-order path |
| O-REQ-003 / O-MET-006 | Resumable jobs and explicit failure rather than zero-row success |
| O-REQ-004 / DEC-021 | DQ suppression and stable point-in-time analytics errors |
| O-REQ-006 / O-ACC-001..004 | Keyboard, focus, semantics, non-color status, and exact research warning |
| O-REQ-007 / O-MET-005 | Readiness, recovery, redacted diagnostics, and least privilege |
| O-REQ-009 / O-MET-008 | Migration/database-aware readiness |
| DEC-014 | Exact fixed-point wire/display scales without presentation rounding |
| Domain contract | Explicit paper confirmation, one-transition commands, stable states/errors |
| Fixture contract | Fixture-only input, restart/idempotency, DQ, and no provider fallback |
| Analytics contract | Stable errors, publication blocking, evidence access, and no-signal distinction |
| REV-019 | Application is one of the independently verified prototype surfaces |
| REV-022 / REV-023 | Team Lead custody PASS and independent alternate-role PASS; alternate-model provenance unproven |

## Invalidation and Candidate Checklist

Adding, removing, renaming, or changing an operation; changing envelope fields, job states, readiness meaning, owning-code preservation, canonical display, redaction allowlist, warning text, recovery semantics, or authority boundary is breaking for this candidate and requires classification, Team Lead custody, independent review, inventory synchronization, and OpenAPI/PostgreSQL impact assessment.

- [x] Closed command/query catalog is bounded to the first prototype.
- [x] Domain/fixture/analytics errors and invariants retain authority.
- [x] Job checkpoint/restart and failed-not-zero-row behavior are explicit.
- [x] Readiness dependencies and non-claims are explicit.
- [x] Canonical date/decimal/status displays are deterministic.
- [x] Redaction is allowlist-only and fails closed.
- [x] Exact research warning and keyboard recovery are normative.
- [x] All 16 operations have closed payload/result schemas and valid/malformed vectors.
- [x] Replay layering, job transitions, numeric error precedence, and timestamp roles are explicit.
- [x] `PT-APP-001A..P` is a named design-time conformance plan.
- [x] Distinct Team Lead custody review passes.
- [x] Independent alternate-role verification passes with no unresolved Critical or Major finding.

## Boundary

This is an inactive planning candidate. It does not make `PT-APP-001` executable, satisfy aggregate `PT-CONTRACT-001`, unblock API/store/provider/stream guards, define an HTTP or database contract, close #21/#22, activate a baseline, accept Proposed architecture, authorize implementation/dependencies/deployment, release parallel work, or advance Ring 2.
