Feature: PT-APP-001 transport-independent application boundary conformance
  As a local research operator
  I need one stable application boundary for browser commands, queries, failures, and recovery
  So that transport choices cannot weaken research-only, readiness, redaction, or accessibility behavior

  Background:
    Given the inactive prototype candidate is "v1.0.0-prototype.1"
    And the application contract candidate is "1.0.0-candidate.2"
    And the workbench is local, single-user, fixture-only, and research-only
    And no command or query can invoke a broker, transmit an order, or expose credentials

  Rule: The application operation catalog is closed
  Scenario: PT-APP-001A only named prototype commands and queries are accepted
    Given the closed application operation catalog
    When each named command and query is dispatched
    Then each operation resolves to exactly one application definition
    And every unlisted or incorrectly cased operation fails with "APPLICATION_OPERATION_UNKNOWN"
    And no unlisted operation reaches domain, analytics, fixture, ledger, or storage behavior

  Rule: Research never mutates a paper portfolio without explicit action
  Scenario: PT-APP-001B displayed research has no paper mutation effect
    Given a Complete verified analytical result is displayed
    When the operator takes no paper action
    Then no paper order, fill, position, cash, lot, or ledger mutation occurs

  Scenario: PT-APP-001C paper submission requires explicit keyboard-operable confirmation
    Given a local paper-order draft created from displayed research
    When keyboard confirmation is absent, canceled, or not completed
    Then the order remains "Draft"
    And no fill, position, cash, lot, or ledger mutation occurs
    When the same user explicitly confirms the action using the keyboard
    Then exactly one OT-02 Draft-to-Submitted transition command is dispatched
    And it contains sourceState "Draft", targetState "Submitted", trigger "UserConfirmedPaperAction", and baselineVersion "v1.0.0"
    And its normalized transition payload contains only the exact confirmation record
    And no later transition is skipped, collapsed, or hidden

  Rule: Jobs are durable, resumable, and visibly failed
  Scenario: PT-APP-001D a fixture ingestion job resumes without duplicate effects
    Given a Failed fixture-ingestion job with restartability "Restartable", attempt "1", and a durable committed checkpoint
    When the operator invokes the named restart command
    Then the same job identity resumes from its last committed checkpoint
    And attempt "2" is persisted
    And the original operation and input identities are preserved
    And accepted observations are not duplicated
    And persisted status and progress are returned
    When JobRestart targets a job that is Running or "NotRestartable"
    Then the command fails with "APPLICATION_JOB_NOT_RESTARTABLE"
    And job status, attempt, checkpoint, and committed effects remain unchanged

  Scenario: PT-APP-001E a failed job never appears as zero-row success
    Given a required fixture input is missing or a job dependency fails
    When the ingestion or analytics job reaches a terminal outcome
    Then application status is "Failed"
    And the response contains a stable controlling error and a redacted recovery action
    And zero accepted rows is not represented as successful completion
    And dependent research remains blocked

  Rule: Readiness is distinct from liveness and analytical validity
  Scenario Outline: PT-APP-001F readiness fails closed on required dependencies
    Given process liveness is "<liveness>"
    And required dependency "<dependency>" is not ready
    When application readiness is queried
    Then readiness is "NotReady"
    And the response contains "<errorCode>"
    And dependencies are ordered "PostgreSQL,Migrations,FixturePolicy,LocalDependency,DenialAudit,LedgerIntegrity"
    And it provides a keyboard-operable recovery or escalation action

    Examples:
      | dependency      | liveness | errorCode                            |
      | PostgreSQL      | Live     | APPLICATION_DATABASE_UNAVAILABLE     |
      | Migrations      | NotLive  | APPLICATION_MIGRATIONS_INCOMPLETE    |
      | FixturePolicy   | Live     | APPLICATION_CONFIGURATION_INVALID    |
      | LocalDependency | NotLive  | APPLICATION_DEPENDENCY_UNAVAILABLE   |
      | DenialAudit     | Live     | ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED |
      | LedgerIntegrity | NotLive  | LEDGER_INTEGRITY_FAILED              |

  Scenario: PT-APP-001G ready does not claim fresh or valid analytics
    Given PostgreSQL, migrations, required configuration, and local dependencies are ready
    But the current analytical input is stale or quarantined
    When application readiness is queried
    Then readiness is "Ready"
    And analytical eligibility remains separately blocked by its stable analytics error
    And readiness makes no claim about provider rights
    And readiness makes no claim about fixture freshness
    And readiness makes no claim about analytical validity
    And readiness makes no claim about evidence completeness
    And readiness makes no claim about ledger reconciliation
    And readiness makes no claim about release readiness
    When process liveness changes from "Live" to "NotLive" without a dependency-state change
    Then readiness remains "Ready"

  Rule: Stable owning errors cross the boundary without semantic translation
  Scenario Outline: PT-APP-001H owning error codes and causes are preserved
    Given the owning contract returns "<errorCode>"
    When the application presents the failure
    Then the machine-readable code remains "<errorCode>"
    And the plain-language message identifies what failed without exposing protected values
    And the named recovery does not bypass a guard or mutate state implicitly

    Examples:
      | errorCode                              |
      | ORDER_INVALID_TRANSITION               |
      | ORDER_VERSION_CONFLICT                 |
      | FIXTURE_REQUIRED_QUARANTINED           |
      | ANALYTICS_INPUT_INCOMPLETE             |
      | ANALYTICS_INTEGRITY_FAILED             |
      | ANALYTICS_PUBLICATION_BLOCKED          |
      | APPLICATION_REQUEST_INVALID            |
      | APPLICATION_IDEMPOTENCY_CONFLICT       |
      | APPLICATION_JOB_NOT_RESTARTABLE        |
      | APPLICATION_REDACTION_FAILED           |
      | ORDER_IDEMPOTENCY_CONFLICT             |
      | FIXTURE_IDEMPOTENCY_CONFLICT           |
      | ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED   |
      | LEDGER_INTEGRITY_FAILED                |

  Rule: Display values are canonical, explicit, and accessible
  Scenario Outline: PT-APP-001I canonical values have one wire value and one display form
    Given a canonical "<valueClass>" value "<wireValue>"
    When it is rendered for the operator
    Then the visible text is "<displayValue>"
    And assistive technology receives the same semantic value
    And color, icon, or position is not the only status signal

    Examples:
      | valueClass   | wireValue                   | displayValue                 |
      | OrderStatus | Partial                     | Partially Filled             |
      | Readiness   | NotReady                    | Not Ready                    |
      | UTCInstant  | 2026-01-31T00:00:00.000Z    | 2026-01-31 00:00:00.000 UTC |
      | SourceTime  | 2026-01-30T22:00:00.000Z    | Source time: 2026-01-30 22:00:00.000 UTC |
      | RetrievedAt | 2026-01-30T22:01:00.000Z    | Retrieved at: 2026-01-30 22:01:00.000 UTC |
      | CompletedAt | 2026-01-31T00:00:00.000Z    | Completed at: 2026-01-31 00:00:00.000 UTC |
      | Timezone    | UTC                         | Display timezone: UTC        |
      | Date        | 2026-01-30                  | 2026-01-30                   |
      | TradeDate   | 2026-01-30                  | Trade date: 2026-01-30       |
      | UnitPrice   | 100.0000000000              | 100.0000000000               |
      | Money       | 1000.00000000               | 1000.00000000                |
      | Rate        | 0.012500000000              | 0.012500000000               |

  Scenario: PT-APP-001J analytical pages retain the exact research-only warning
    Given any analytical result, evidence, or paper-action page
    When the page is rendered or refreshed
    Then it visibly contains "Research only — hypothetical — user makes all investment decisions."
    And the warning is programmatically associated with the primary analytical content
    And presentation metadata has researchWarningRequired true and the exact warningText
    When a non-analytical non-paper result is rendered
    Then researchWarningRequired is false and warningText is null

  Rule: Diagnostics and failures are redacted by allowlist
  Scenario: PT-APP-001K diagnostic export contains only allowlisted metadata
    Given diagnostics contain bounded identifiers, statuses, hashes, timestamps, and error codes
    And internal failures also contain secrets, raw provider bytes, stack traces, and command payloads
    When diagnostic export is requested
    Then only allowlisted metadata is exported
    And no credential, secret, prohibited raw provider data, stack trace, brokerage artifact, or full command payload is present
    When one diagnostic field cannot be classified by the allowlist
    Then the command fails with "APPLICATION_REDACTION_FAILED"
    And no diagnostic bundle or export is created
    And no unclassified value appears in logs, traces, or presentation
    And only the stable code plus bounded correlation metadata is recorded

  Rule: Every reachable blocked state has keyboard recovery
  Scenario Outline: PT-APP-001L blocked states expose perceivable recovery without implicit mutation
    Given the current application state is "<blockedState>"
    And bounded recovery context is '<boundedContext>'
    When the state is presented
    Then visible non-color text identifies the state and cause
    And a programmatic status or alert announces the state at the required urgency
    And exact recovery is '<recoveryRecord>'
    And its action is keyboard-operable when the recovery is not null
    And focus moves predictably without triggering the action
    And focusing or announcing the recovery never invokes it
    And keyboard and pointer activation dispatch the same operation
    And focus remains on the trigger while processing
    And focus moves to the first actionable error after validation failure
    And focus moves to the named focusTarget after success
    And an unchanged state is not re-announced
    When the recovery is explicitly activated
    Then its target operation receives exact payload '<targetPayload>'
    And a null recovery dispatches no catalog operation

    Examples:
      | blockedState              | boundedContext                                                                                                                                                                                                                      | recoveryRecord                                                                                                                                                                      | targetPayload                                                                                                                                                                                                                                                                                                                                                                                                 |
      | FailedRestartable         | {"jobId":"73000000-0000-4000-8000-000000000001"}                                                                                                                                                                               | {"actionId":"retry-job","label":"Retry job","targetOperation":"JobRestart","focusTarget":"job-status","requiresConfirmation":false}                                  | {"jobId":"73000000-0000-4000-8000-000000000001"}                                                                                                                                                                                                                                                                                                                                                           |
      | FailedNotRestartable      | {"jobId":"73000000-0000-4000-8000-000000000002"}                                                                                                                                                                               | {"actionId":"review-job","label":"Review job details","targetOperation":"JobGet","focusTarget":"job-details","requiresConfirmation":false}                          | {"jobId":"73000000-0000-4000-8000-000000000002"}                                                                                                                                                                                                                                                                                                                                                           |
      | InputQuarantined          | {"evidenceId":"73000000-0000-4000-8000-000000000003"}                                                                                                                                                                          | {"actionId":"review-evidence","label":"Review data issue","targetOperation":"EvidenceGet","focusTarget":"evidence-details","requiresConfirmation":false}             | {"evidenceId":"73000000-0000-4000-8000-000000000003"}                                                                                                                                                                                                                                                                                                                                                      |
      | VersionConflict           | {"orderId":"73000000-0000-4000-8000-000000000004"}                                                                                                                                                                             | {"actionId":"reload-order","label":"Reload current order","targetOperation":"PaperOrderGet","focusTarget":"order-details","requiresConfirmation":false}             | {"orderId":"73000000-0000-4000-8000-000000000004"}                                                                                                                                                                                                                                                                                                                                                         |
      | IntegrityBlocked          | {}                                                                                                                                                                                                                                  | {"actionId":"review-integrity","label":"Review integrity status","targetOperation":"ReadinessGet","focusTarget":"readiness-details","requiresConfirmation":false}   | {}                                                                                                                                                                                                                                                                                                                                                                                                              |
      | NotReady                  | {}                                                                                                                                                                                                                                  | {"actionId":"review-readiness","label":"Review readiness details","targetOperation":"ReadinessGet","focusTarget":"readiness-details","requiresConfirmation":false}   | {}                                                                                                                                                                                                                                                                                                                                                                                                              |
      | DraftAwaitingConfirmation | {"orderId":"73000000-0000-4000-8000-000000000005","aggregateVersion":"4","newTransitionCommandId":"73000000-0000-4000-8000-000000000006","actorId":"local-user","confirmedAt":"2026-01-30T12:00:00.000Z","confirmationText":"Submit paper order"} | {"actionId":"submit-paper-order","label":"Submit paper order","targetOperation":"PaperOrderTransition","focusTarget":"order-status","requiresConfirmation":true}     | {"orderId":"73000000-0000-4000-8000-000000000005","transitionCommandId":"73000000-0000-4000-8000-000000000006","expectedVersion":"4","transition":"OT-02","transitionPayload":{"confirmation":{"actorId":"local-user","confirmedAt":"2026-01-30T12:00:00.000Z","confirmationText":"Submit paper order"}}} |
      | MissingIdentity           | {}                                                                                                                                                                                                                                  | null                                                                                                                                                                                | <none>                                                                                                                                                                                                                                                                                                                                                                                                          |
      | AccessDenied              | {"orderId":"73000000-0000-4000-8000-000000000007"}                                                                                                                                                                             | null                                                                                                                                                                                | <none>                                                                                                                                                                                                                                                                                                                                                                                                          |
      | NoSafeOperation           | {"code":"APPLICATION_DEPENDENCY_UNAVAILABLE"}                                                                                                                                                                                    | null                                                                                                                                                                                | <none>                                                                                                                                                                                                                                                                                                                                                                                                          |

  Rule: Every operation has a closed payload and success schema
  Scenario Outline: PT-APP-001M valid and malformed operation records are deterministic
    Given operation "<operation>" has exact success-data schema "<successDataSchema>"
    And EvidenceGet accepts every owner-defined opaque String evidenceId, including UUID-shaped text, and rejects non-string input
    When exact closed payload '<validPayload>' is dispatched
    Then the result data conforms exactly to "<successDataSchema>"
    And ordered collections follow the operation contract rather than storage retrieval order
    When exact malformed payload '<malformedPayload>' is dispatched
    Then the command or query fails with "APPLICATION_REQUEST_INVALID"
    And no owning contract or side effect is invoked

    Examples:
      | operation               | validPayload                                                                                                                                                                                                                                                                                                                    | malformedPayload                                                                                         | successDataSchema                            |
      | WatchlistPut            | {"instrumentId":"ETF-A","displayName":"ETF A","expectedVersion":"0"}                                                                                                                                                                                                                                                   | {"instrumentId":"ETF-A","expectedVersion":"0"}                                                    | {item:WatchlistItem,version:UInt}            |
      | WatchlistRemove         | {"instrumentId":"ETF-A","expectedVersion":"1"}                                                                                                                                                                                                                                                                         | {"instrumentId":"ETF-A","instrumentId":"ETF-B","expectedVersion":"1"}                          | {version:UInt}                               |
      | WatchlistReorder        | {"orderedInstrumentIds":["ETF-B","ETF-A"],"expectedVersion":"2"}                                                                                                                                                                                                                                                       | {"orderedInstrumentIds":["ETF-B","ETF-A"],"expectedVersion":"2","extra":true}                  | {orderedItems:WatchlistItem[],version:UInt}  |
      | FixtureIngestionStart   | {"jobId":"10000000-0000-4000-8000-000000000001","datasetId":"prices","datasetVersion":"2026-01-30","fixturePackageHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}                                                                                                                         | {"jobId":null,"datasetId":"prices","datasetVersion":"2026-01-30","fixturePackageHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}   | {job:Job}                                    |
      | JobRestart              | {"jobId":"10000000-0000-4000-8000-000000000001"}                                                                                                                                                                                                                                                                           | {"jobId":"not-a-uuid"}                                                                                | {job:Job}                                    |
      | AnalyticsRun            | {"jobId":"20000000-0000-4000-8000-000000000001","evidenceCommandId":"20000000-0000-4000-8000-000000000002","asOfDate":"2026-01-30","configurationHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","inputEvidenceIds":["20000000-0000-4000-8000-000000000003"]}                      | {"jobId":"20000000-0000-4000-8000-000000000001","asOfDate":"2026-01-30","configurationHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","inputEvidenceIds":[]} | {job:Job}                                    |
      | PaperOrderDraftCreate   | {"orderId":"30000000-0000-4000-8000-000000000001","researchEvidenceId":"30000000-0000-4000-8000-000000000002","side":"Buy","quantity":"1.0000000000","unitPrice":"100.0000000000","tradeDate":"2026-01-30"}                                                                                                      | {"orderId":"30000000-0000-4000-8000-000000000001","researchEvidenceId":"30000000-0000-4000-8000-000000000002","side":"Buy","quantity":"1.0000000000","unitPrice":"100.0000000000","tradeDate":"2026-01-30","extra":0} | {order:PaperOrder}                           |
      | PaperOrderTransition    | {"orderId":"30000000-0000-4000-8000-000000000001","transitionCommandId":"30000000-0000-4000-8000-000000000003","expectedVersion":"1","transition":"OT-02","transitionPayload":{"confirmation":{"actorId":"local-user","confirmedAt":"2026-01-30T12:00:00.000Z","confirmationText":"Submit paper order"}}}                    | {"orderId":"30000000-0000-4000-8000-000000000001","transitionCommandId":"30000000-0000-4000-8000-000000000003","expectedVersion":null,"transition":"OT-02","transitionPayload":{}} | {order:PaperOrder}                           |
      | DiagnosticsExportCreate | {"exportId":"40000000-0000-4000-8000-000000000001","from":"2026-01-30T00:00:00.000Z","through":"2026-01-31T00:00:00.000Z","requestedCodes":["APPLICATION_REQUEST_INVALID"]}                                                                                                                                            | {"exportId":"40000000-0000-4000-8000-000000000001","from":"yesterday","through":"2026-01-31T00:00:00.000Z","requestedCodes":[]} | {export:DiagnosticExport}                   |
      | WatchlistGet            | {}                                                                                                                                                                                                                                                                                                                             | {"unexpected":true}                                                                                     | {orderedItems:WatchlistItem[],version:UInt}  |
      | JobGet                  | {"jobId":"10000000-0000-4000-8000-000000000001"}                                                                                                                                                                                                                                                                           | {"jobId":null}                                                                                          | {job:Job}                                    |
      | ReadinessGet            | {}                                                                                                                                                                                                                                                                                                                             | {"repair":true}                                                                                         | {readiness:Readiness}                        |
      | AnalyticsResultGet      | {"publicationTargetId":"50000000-0000-4000-8000-000000000001"}                                                                                                                                                                                                                                                             | {"publicationTargetId":"bad"}                                                                         | {result:AnalyticsResult}                     |
      | EvidenceGet             | {"evidenceId":"evidence-fixture-1"}                                                                                                                                                                                                                                                                                         | {"evidenceId":42}                                                                                       | {evidence:Evidence}                          |
      | PaperOrderGet           | {"orderId":"30000000-0000-4000-8000-000000000001"}                                                                                                                                                                                                                                                                         | {"orderId":"30000000-0000-4000-8000-000000000001","orderId":"30000000-0000-4000-8000-000000000002"} | {order:PaperOrder}                           |
      | PortfolioGet            | {"portfolioId":"60000000-0000-4000-8000-000000000001","asOf":"2026-01-31T00:00:00.000Z"}                                                                                                                                                                                                                               | {"portfolioId":"60000000-0000-4000-8000-000000000001","asOf":"2026-01-31"}                        | {portfolio:Portfolio}                        |

  Rule: Application replay is deterministic and cannot bypass owning identity
  Scenario: PT-APP-001N application and owning replay keys remain distinct
    Given the original request is exactly
      """
      {"operation":"PaperOrderTransition","requestId":"71000000-0000-4000-8000-000000000001","correlationId":"71000000-0000-4000-8000-000000000002","actorId":"local-user","prototypeCandidate":"v1.0.0-prototype.1","contractVersion":"1.0.0-candidate.2","requestedAt":"2026-01-30T12:00:00.000Z","commandId":"70000000-0000-4000-8000-000000000001","payload":{"orderId":"30000000-0000-4000-8000-000000000001","transitionCommandId":"70000000-0000-4000-8000-000000000002","expectedVersion":"1","transition":"OT-02","transitionPayload":{"confirmation":{"actorId":"local-user","confirmedAt":"2026-01-30T12:00:00.000Z","confirmationText":"Submit paper order"}}}}
      """
    And its exact RFC 8785 replay content is
      """
      {"actorId":"local-user","contractVersion":"1.0.0-candidate.2","operation":"PaperOrderTransition","payload":{"expectedVersion":"1","orderId":"30000000-0000-4000-8000-000000000001","transition":"OT-02","transitionCommandId":"70000000-0000-4000-8000-000000000002","transitionPayload":{"confirmation":{"actorId":"local-user","confirmationText":"Submit paper order","confirmedAt":"2026-01-30T12:00:00.000Z"}}},"prototypeCandidate":"v1.0.0-prototype.1"}
      """
    When the equivalent request is exactly
      """
      {"operation":"PaperOrderTransition","requestId":"71000000-0000-4000-8000-000000000003","correlationId":"71000000-0000-4000-8000-000000000004","actorId":"local-user","prototypeCandidate":"v1.0.0-prototype.1","contractVersion":"1.0.0-candidate.2","requestedAt":"2026-01-30T12:01:00.000Z","commandId":"70000000-0000-4000-8000-000000000001","payload":{"orderId":"30000000-0000-4000-8000-000000000001","transitionCommandId":"70000000-0000-4000-8000-000000000002","expectedVersion":"1","transition":"OT-02","transitionPayload":{"confirmation":{"actorId":"local-user","confirmedAt":"2026-01-30T12:00:00.000Z","confirmationText":"Submit paper order"}}}}
      """
    Then the original result is returned before readiness or owning-contract dispatch
    And no side effect repeats
    When the application-conflict request is exactly
      """
      {"operation":"PaperOrderTransition","requestId":"71000000-0000-4000-8000-000000000005","correlationId":"71000000-0000-4000-8000-000000000006","actorId":"local-user","prototypeCandidate":"v1.0.0-prototype.1","contractVersion":"1.0.0-candidate.2","requestedAt":"2026-01-30T12:02:00.000Z","commandId":"70000000-0000-4000-8000-000000000001","payload":{"orderId":"30000000-0000-4000-8000-000000000001","transitionCommandId":"70000000-0000-4000-8000-000000000002","expectedVersion":"1","transition":"OT-02","transitionPayload":{"confirmation":{"actorId":"local-user","confirmedAt":"2026-01-30T12:00:00.000Z","confirmationText":"Submit changed paper order"}}}}
      """
    Then the command fails with "APPLICATION_IDEMPOTENCY_CONFLICT"
    And the owning contract is not invoked
    When the owner-conflict request is exactly
      """
      {"operation":"PaperOrderTransition","requestId":"71000000-0000-4000-8000-000000000007","correlationId":"71000000-0000-4000-8000-000000000008","actorId":"local-user","prototypeCandidate":"v1.0.0-prototype.1","contractVersion":"1.0.0-candidate.2","requestedAt":"2026-01-30T12:03:00.000Z","commandId":"70000000-0000-4000-8000-000000000003","payload":{"orderId":"30000000-0000-4000-8000-000000000001","transitionCommandId":"70000000-0000-4000-8000-000000000002","expectedVersion":"1","transition":"OT-02","transitionPayload":{"confirmation":{"actorId":"local-user","confirmedAt":"2026-01-30T12:00:00.000Z","confirmationText":"Submit owner-conflicting paper order"}}}}
      """
    Then unchanged "ORDER_IDEMPOTENCY_CONFLICT" is returned
    And no side effect repeats

  Rule: Validation precedence and tie ordering are stable
  Scenario Outline: PT-APP-001O simultaneous defects return one deterministic controlling error
    Given one request or candidate set contains both "<firstDefect>" and "<secondDefect>"
    When application validation runs
    Then the controlling error is "<expectedCode>"
    And the selected request identity is "<expectedRequestId>"
    And no lower-priority owner or side effect is invoked

    Examples:
      | firstDefect                                                                         | secondDefect                                                                       | expectedCode                       | expectedRequestId                            |
      | unknown operation on request 72000000-0000-4000-8000-000000000001                   | missing actorId on the same request                                                | APPLICATION_OPERATION_UNKNOWN      | 72000000-0000-4000-8000-000000000001         |
      | missing actorId on request 72000000-0000-4000-8000-000000000002                     | unauthorized actor on the same request                                            | APPLICATION_REQUEST_INVALID        | 72000000-0000-4000-8000-000000000002         |
      | unauthorized actor on request 72000000-0000-4000-8000-000000000003                  | conflicting application replay on the same request                                | APPLICATION_UNAUTHORIZED           | 72000000-0000-4000-8000-000000000003         |
      | conflicting application replay on request 72000000-0000-4000-8000-000000000004     | unavailable PostgreSQL on the same request                                        | APPLICATION_IDEMPOTENCY_CONFLICT   | 72000000-0000-4000-8000-000000000004         |
      | incomplete migrations on request 72000000-0000-4000-8000-000000000005              | unavailable PostgreSQL on the same request                                        | APPLICATION_DATABASE_UNAVAILABLE   | 72000000-0000-4000-8000-000000000005         |
      | unavailable PostgreSQL on request 72000000-0000-4000-8000-000000000006             | ORDER_IDEMPOTENCY_CONFLICT on the same request                                     | APPLICATION_DATABASE_UNAVAILABLE   | 72000000-0000-4000-8000-000000000006         |
      | ANALYTICS_INPUT_INCOMPLETE on request 72000000-0000-4000-8000-000000000007          | ANALYTICS_INTEGRITY_FAILED on the same request                                     | ANALYTICS_INPUT_INCOMPLETE         | 72000000-0000-4000-8000-000000000007         |
      | ORDER_IDEMPOTENCY_CONFLICT on request 72000000-0000-4000-8000-000000000008          | forced persistence failure on the same request                                    | ORDER_IDEMPOTENCY_CONFLICT         | 72000000-0000-4000-8000-000000000008         |
      | forced persistence failure on request 72000000-0000-4000-8000-000000000009         | unclassifiable result field on the same request                                    | APPLICATION_PERSISTENCE_FAILED     | 72000000-0000-4000-8000-000000000009         |
      | absent operation on request 72000000-0000-4000-8000-000000000011                    | invalid operation on request 72000000-0000-4000-8000-000000000010                 | APPLICATION_OPERATION_UNKNOWN      | 72000000-0000-4000-8000-000000000010         |
      | invalid operation with absent requestId                                             | invalid operation on request 72000000-0000-4000-8000-000000000012                 | APPLICATION_OPERATION_UNKNOWN      | <absent>                                     |

  Scenario: PT-APP-001P the closed job state machine has no cancellation or event scope
    Given job type is FixtureIngestion or Analytics
    And restartability is Restartable or NotRestartable
    When each legal job transition is enumerated
    Then only Pending-to-Running, Pending-to-Failed, Running-to-Succeeded, Running-to-Failed, and Failed-to-Pending-by-JobRestart are accepted
    And every other transition fails without mutation
    And no Canceled status, queue, event, outbox, scheduler, worker, or delayed consumer is introduced

  # Sources: GitHub #21/#22; O-REQ-001/003/004/006/007/009; O-MET-005/006/008; DEC-011/013/014/021/022; REV-017/019
  # Ring 1 behavioral specification only; PT-APP-001A..P executable bindings are required in Ring 2
