@planning @contract @openapi @ct-api-001
Feature: CT-API-001 localhost OpenAPI contract conformance
  The inactive prototype exposes only the reviewed application candidate through a loopback API.
  These scenarios specify Ring 1 behavior and do not authorize an HTTP implementation or deployment.

  Background:
    Given prototype candidate "v1.0.0-prototype.1"
    And application contract "1.0.0-candidate.2"
    And OpenAPI contract "1.0.0-candidate.3"

  Scenario: CT-API-001A the API is versioned and loopback only
    Given the server URL is "http://127.0.0.1:{port}/api/v1"
    Then the document is OpenAPI 3.1.0 with JSON Schema 2020-12 semantics
    And no public host, wildcard host, provider URL, broker URL, TLS termination, or remote ingress is defined
    And Host and Origin validation fail closed outside the configured local workbench origins

  Scenario: CT-API-001B exactly sixteen application operations cross the process boundary
    When path and method operations are compared with the application catalog
    Then each application command and query has exactly one case-sensitive operationId
    And every operationId maps to exactly one application operation
    And no batch, refresh, repair, cancel, provider, broker, event, stream, or administrative operation exists

  Scenario Outline: CT-API-001C transport fields reconstruct one closed application request
    Given HTTP operation "<operationId>" has application operation "<applicationOperation>"
    When valid path, query, header, and body fields are adapted
    Then operation, requestId, correlationId, actorId, prototypeCandidate, contractVersion, requestedAt, commandId when applicable, and the exact closed payload are reconstructed
    And duplicated transport identities must be identical or fail with "APPLICATION_REQUEST_INVALID"
    And an unknown, missing, duplicate, null, or malformed field fails before application dispatch
    And each adapter has one literal closed valid payload and one literal single-defect malformed payload
      | operationId             | valid payload | malformed payload |
      | watchlistPut            | {"instrumentId":"SPY","displayName":"SPDR S&P 500 ETF Trust","expectedVersion":"1"} | {"instrumentId":"SPY","displayName":"SPDR S&P 500 ETF Trust","expectedVersion":null} |
      | watchlistRemove         | {"instrumentId":"SPY","expectedVersion":"1"} | {"instrumentId":"SPY","expectedVersion":"01"} |
      | watchlistReorder        | {"orderedInstrumentIds":["SPY","QQQ"],"expectedVersion":"1"} | {"orderedInstrumentIds":["SPY","SPY"],"expectedVersion":"1"} |
      | fixtureIngestionStart   | {"jobId":"00000000-0000-4000-8000-000000000001","datasetId":"market-fixture","datasetVersion":"1.0.0","fixturePackageHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"} | {"jobId":"not-a-uuid","datasetId":"market-fixture","datasetVersion":"1.0.0","fixturePackageHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"} |
      | jobRestart              | {"jobId":"00000000-0000-4000-8000-000000000001"} | {"jobId":null} |
      | analyticsRun            | {"jobId":"00000000-0000-4000-8000-000000000001","evidenceCommandId":"00000000-0000-4000-8000-000000000002","asOfDate":"2026-09-11","configurationHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","inputEvidenceIds":["00000000-0000-4000-8000-000000000003"]} | {"jobId":"00000000-0000-4000-8000-000000000001","evidenceCommandId":"00000000-0000-4000-8000-000000000002","asOfDate":"2026-09-11","configurationHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","inputEvidenceIds":["00000000-0000-4000-8000-000000000003","00000000-0000-4000-8000-000000000003"]} |
      | paperOrderDraftCreate   | {"orderId":"00000000-0000-4000-8000-000000000001","researchEvidenceId":"00000000-0000-4000-8000-000000000002","side":"Buy","quantity":"1.0000000000","unitPrice":"500.0000000000","tradeDate":"2026-09-11"} | {"orderId":"00000000-0000-4000-8000-000000000001","researchEvidenceId":"00000000-0000-4000-8000-000000000002","side":"Hold","quantity":"1.0000000000","unitPrice":"500.0000000000","tradeDate":"2026-09-11"} |
      | paperOrderTransition    | {"orderId":"00000000-0000-4000-8000-000000000001","transitionCommandId":"00000000-0000-4000-8000-000000000002","expectedVersion":"1","transition":"OT-02","transitionPayload":{"confirmation":{"actorId":"local-user","confirmedAt":"2026-09-11T12:00:00.000Z","confirmationText":"Confirm hypothetical paper order"}}} | {"orderId":"00000000-0000-4000-8000-000000000001","transitionCommandId":"00000000-0000-4000-8000-000000000002","expectedVersion":"1","transition":"OT-02","transitionPayload":{"reasonCode":"wrong-variant"}} |
      | diagnosticsExportCreate | {"exportId":"00000000-0000-4000-8000-000000000001","from":"2026-09-01T00:00:00.000Z","through":"2026-09-11T00:00:00.000Z","requestedCodes":["APPLICATION_REQUEST_INVALID"]} | {"exportId":"00000000-0000-4000-8000-000000000001","from":"2026-09-01T00:00:00.000Z","through":"2026-09-11T00:00:00.000Z","requestedCodes":["APPLICATION_REQUEST_INVALID","APPLICATION_REQUEST_INVALID"]} |
      | watchlistGet            | {} | {"unexpected":true} |
      | jobGet                  | {"jobId":"00000000-0000-4000-8000-000000000001"} | {"jobId":"not-a-uuid"} |
      | readinessGet            | {} | {"unexpected":true} |
      | analyticsResultGet      | {"publicationTargetId":"00000000-0000-4000-8000-000000000001"} | {"publicationTargetId":null} |
      | evidenceGet             | {"evidenceId":"evidence-fixture-1"} | {"evidenceId":1} |
      | paperOrderGet           | {"orderId":"00000000-0000-4000-8000-000000000001"} | {"orderId":"not-a-uuid"} |
      | portfolioGet            | {"portfolioId":"00000000-0000-4000-8000-000000000001","asOf":"2026-09-11T12:00:00.000Z"} | {"portfolioId":null,"asOf":"2026-09-11T12:00:00.000Z"} |

    Examples:
      | operationId             | applicationOperation     |
      | watchlistPut            | WatchlistPut             |
      | watchlistRemove         | WatchlistRemove          |
      | watchlistReorder        | WatchlistReorder         |
      | fixtureIngestionStart   | FixtureIngestionStart    |
      | jobRestart              | JobRestart               |
      | analyticsRun            | AnalyticsRun             |
      | paperOrderDraftCreate   | PaperOrderDraftCreate    |
      | paperOrderTransition    | PaperOrderTransition     |
      | diagnosticsExportCreate | DiagnosticsExportCreate |
      | watchlistGet            | WatchlistGet             |
      | jobGet                  | JobGet                   |
      | readinessGet            | ReadinessGet             |
      | analyticsResultGet      | AnalyticsResultGet       |
      | evidenceGet             | EvidenceGet              |
      | paperOrderGet           | PaperOrderGet            |
      | portfolioGet            | PortfolioGet             |

  Scenario: CT-API-001D command replay is explicit and queries remain side-effect free
    Given every command requires Idempotency-Key as its application commandId
    And every request requires X-Request-ID, X-Correlation-ID, and X-Requested-At
    When an equivalent command is retried with the same Idempotency-Key
    Then the original complete result and HTTP status are returned without repeating effects
    When the canonical command content conflicts
    Then HTTP 409 carries "APPLICATION_IDEMPOTENCY_CONFLICT"
    And queries reject Idempotency-Key and cannot invoke hidden refresh, retry, restart, or repair
    And operation classes are exactly
      | class   | operationIds |
      | command | watchlistPut,watchlistRemove,watchlistReorder,fixtureIngestionStart,jobRestart,analyticsRun,paperOrderDraftCreate,paperOrderTransition,diagnosticsExportCreate |
      | query   | watchlistGet,jobGet,readinessGet,analyticsResultGet,evidenceGet,paperOrderGet,portfolioGet |

  Scenario: CT-API-001E successful responses preserve exact application results
    When a command or query succeeds
    Then the body is the complete closed application result envelope without transport-added members
    And fixtureIngestionStart, analyticsRun, paperOrderDraftCreate, and diagnosticsExportCreate use HTTP 201
    And every other successful operation uses HTTP 200
    And Content-Type is exactly "application/json"
    And canonical numbers, dates, timestamps, states, collection order, presentation, and warnings are unchanged
    And each endpoint accepts only its exact operation constant and success status
      | operationId             | operation               | status |
      | watchlistPut            | WatchlistPut             | 200    |
      | watchlistRemove         | WatchlistRemove          | 200    |
      | watchlistReorder        | WatchlistReorder         | 200    |
      | fixtureIngestionStart   | FixtureIngestionStart    | 201    |
      | jobRestart              | JobRestart               | 200    |
      | analyticsRun            | AnalyticsRun             | 201    |
      | paperOrderDraftCreate   | PaperOrderDraftCreate    | 201    |
      | paperOrderTransition    | PaperOrderTransition     | 200    |
      | diagnosticsExportCreate | DiagnosticsExportCreate | 201    |
      | watchlistGet            | WatchlistGet             | 200    |
      | jobGet                  | JobGet                   | 200    |
      | readinessGet            | ReadinessGet             | 200    |
      | analyticsResultGet      | AnalyticsResultGet       | 200    |
      | evidenceGet             | EvidenceGet              | 200    |
      | paperOrderGet           | PaperOrderGet            | 200    |
      | portfolioGet            | PortfolioGet             | 200    |
    And each endpoint rejects a success or failure envelope containing another operation constant

  Scenario: CT-API-001F one stable error controls each HTTP response
    Given transport classes map to HTTP statuses exactly
      | class                    | status |
      | request grammar          | 400    |
      | authorization or denial  | 403    |
      | missing local resource   | 404    |
      | replay or version conflict | 409  |
      | owning semantic rejection | 422  |
      | readiness or dependency  | 503    |
      | persistence or result-construction failure | 500 |
    Then each status carries the unchanged complete Failed result envelope
    And the transport never replaces the code, cause, bounded identifiers, recovery, presentation, or warnings
    And exact public code-to-status bindings are
      | status | codes |
      | 400 | APPLICATION_OPERATION_UNKNOWN,APPLICATION_REQUEST_INVALID,FIXTURE_MANIFEST_INVALID,FIXTURE_FILE_INTEGRITY_FAILED,FIXTURE_DATASET_HASH_MISMATCH,FIXTURE_TEMPORAL_INVALID,FIXTURE_DECIMAL_INVALID,FIXTURE_PROVENANCE_INVALID,FIXTURE_UNDECLARED_INPUT,FIXTURE_REQUIRED_MISSING,ANALYTICS_NUMERIC_CLASS_INVALID,ORDER_UNKNOWN_STATE,LEDGER_INVALID_DECIMAL,LEDGER_EXCESS_SCALE |
      | 403 | APPLICATION_UNAUTHORIZED,ANALYTICS_EVIDENCE_ACCESS_DENIED,ANALYTICS_RIGHTS_RESTRICTED |
      | 404 | APPLICATION_JOB_NOT_FOUND |
      | 409 | APPLICATION_IDEMPOTENCY_CONFLICT,ANALYTICS_IDEMPOTENCY_CONFLICT,ANALYTICS_PUBLICATION_VERSION_CONFLICT,ORDER_IDEMPOTENCY_CONFLICT,ORDER_VERSION_CONFLICT,FIXTURE_IDEMPOTENCY_CONFLICT,LEDGER_IDEMPOTENCY_CONFLICT,LEDGER_VERSION_CONFLICT |
      | 422 | APPLICATION_JOB_NOT_RESTARTABLE,ANALYTICS_INPUT_INCOMPLETE,ANALYTICS_INPUT_STALE,ANALYTICS_INPUT_QUARANTINED,ANALYTICS_AMBIGUOUS_VINTAGE,ANALYTICS_AMBIGUOUS_MARKET_REVISION,ANALYTICS_INTEGRITY_FAILED,ORDER_INVALID_TRANSITION,ORDER_GUARD_FAILED,ORDER_TERMINAL_STATE,FIXTURE_REQUIRED_PARTIAL,FIXTURE_REQUIRED_STALE,FIXTURE_REQUIRED_QUARANTINED,LEDGER_INSUFFICIENT_CASH,LEDGER_INSUFFICIENT_POSITION,LEDGER_REVERSAL_DEPENDENCY,LEDGER_ALREADY_REVERSED,LEDGER_BOUND_EXCEEDED |
      | 500 | APPLICATION_PERSISTENCE_FAILED,APPLICATION_REDACTION_FAILED,ANALYTICS_EVIDENCE_COMMIT_FAILED,ANALYTICS_DETERMINISM_FAILED,LEDGER_INTEGRITY_FAILED,LEDGER_FIFO_MISMATCH,LEDGER_RECONCILIATION_FAILED |
      | 503 | APPLICATION_DATABASE_UNAVAILABLE,APPLICATION_MIGRATIONS_INCOMPLETE,APPLICATION_CONFIGURATION_INVALID,APPLICATION_DEPENDENCY_UNAVAILABLE,ANALYTICS_CAPACITY_BLOCKED,ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED |
    And no public code validates under another HTTP status

  Scenario: CT-API-001G paper actions remain hypothetical and confirmation bound
    Given paperOrderDraftCreate can create only a local Draft
    When paperOrderTransition requests a confirmation-required transition
    Then the body requires the exact application Confirmation and expectedVersion
    And one request maps to exactly one OT transition without skipping or collapsing transitions
    And no endpoint, link, callback, webhook, or schema represents real execution, an external account, credentials, or broker connectivity
    And transition payload variants are exactly
      | transitions       | required payload fields |
      | OT-02             | confirmation |
      | OT-03             | portfolioId,validationSnapshotId,expectedPortfolioVersion |
      | OT-04             | rejectionCode |
      | OT-05,OT-06,OT-09 | portfolioId,transactionId,fillId,expectedPortfolioVersion,quantity,unitPrice,fee |
      | OT-07,OT-10       | reasonCode |
      | OT-08             | expiresAt |
    And each transition rejects every other variant and every extra member

  Scenario: CT-API-001H opaque evidence identity and redaction survive URL transport
    Given evidenceId "evidence-fixture-1" is an owner-valid opaque String
    And UUID-shaped evidenceId text is also valid owner input
    When evidenceGet receives the required evidenceId query parameter
    Then the adapter passes the String unchanged exactly once
    And the response is complete authorized redacted Evidence after hash verification
    And denial exposes no evidence content and mutates no evidence or publication state
    And the exact owner result with resultHash "4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18" validates
    And the exact flat owner bundle with evidenceId "evidence-fixture-1" and bundleHash "20f33dce407668ea1d60f9367af21e4cd1d968d46475f32dac709da7842fc3e6" validates
    And grouped, missing, reordered, null-substituted, widened, or extra owner fields fail owner-import validation
    And literal owner mutations {"signals":[{"instrumentId":"SPY"},{"instrumentId":"SPY"}]} and {"signals":[{"instrumentId":"ZZZ"},{"instrumentId":"AAA"}]} fail uniqueness and ascending-order validation
    And literal reproducibility mutations {"reproducibilityStatus":"Complete","reproducibilityReason":"POLICY-1"} and {"reproducibilityStatus":"Degraded","reproducibilityReason":null} fail schema validation

  Scenario: CT-API-001I jobs and readiness expose state without hidden work
    Given jobGet, jobRestart, readinessGet, fixtureIngestionStart, and analyticsRun map to durable application operations
    Then Pending, Running, Succeeded, and Failed remain distinct
    And failed work never appears as zero-row success
    And restart uses the same job identity and last committed checkpoint without duplicate effects
    And readiness returns current dependency detail without repair or analytical-validity claims
    And no HTTP 202, polling side effect, callback, webhook, queue, worker, or scheduler is introduced

  Scenario: CT-API-001J recovery and warning metadata remain accessible
    When any reachable blocked or Failed result crosses the API
    Then stable code, plain remediation message, recovery record, statusText, announcement, and canonical values remain programmatically available
    And analytical, evidence, and paper-action results carry exactly "Research only — hypothetical — user makes all investment decisions."
    And status, error, warning, or required action is never conveyed by color, position, or HTTP status alone
    And cross-field relationships are exactly
      | record | selector | required relationship |
      | Presentation | researchWarningRequired=true | warningText is exact research warning |
      | Presentation | researchWarningRequired=false | warningText is null |
      | Readiness | state=Ready | controllingError is null |
      | Readiness | state=NotReady | controllingError is Error |
      | Job | jobType=FixtureIngestion | operation=FixtureIngestionStart and inputIdentity=FixtureInputIdentity |
      | Job | jobType=Analytics | operation=AnalyticsRun and inputIdentity=AnalyticsInputIdentity |
    And every mismatched selector relationship fails schema validation
    And AnalyticsResultGet, EvidenceGet, PaperOrderDraftCreate, and PaperOrderTransition reject literal presentation {"statusText":"Succeeded","announcement":"None","warningText":null,"researchWarningRequired":false}
    And those operations accept literal presentation {"statusText":"Succeeded","announcement":"None","warningText":"Research only — hypothetical — user makes all investment decisions.","researchWarningRequired":true}
    And every other operation rejects that literal research-warning presentation and accepts the literal false/null presentation

  Scenario: CT-API-001K protocol handling fails closed and exports no sensitive content
    Then requests accept only UTF-8 application/json with a finite configured body limit
    And malformed JSON, unsupported media type, unacceptable response type, invalid Host, and disallowed Origin fail before application dispatch
    And each pre-dispatch failure returns the closed transport Problem schema rather than fabricating an application result envelope
    And diagnostics and errors expose no credential, token, raw fixture source, URL query, payload, stack trace, SQL, protected key, or brokerage artifact
    And CORS permits only configured local workbench origins, required methods, and required headers without wildcard credentials
    And protocol responses are exactly
      | condition | status | problem type |
      | malformed JSON | 400 | malformed-json |
      | invalid Host | 400 | invalid-host |
      | disallowed Origin | 403 | disallowed-origin |
      | unacceptable response type | 406 | unacceptable-response-type |
      | request too large | 413 | request-too-large |
      | unsupported media type | 415 | unsupported-media-type |
      | contained adapter failure | 500 | internal-server-error |
    And each protocol body status equals its HTTP status and rejects every other type/status pair
    And the conformance profile fixes body limit 1048576 bytes, UTF-8 JSON decoding, Host "127.0.0.1:<configured-port>", configured local Origins, allowed methods, allowed headers, credentials false, injected actor/version values, and duplicate-member rejection

  Scenario: CT-API-001L compatibility and absence guards remain explicit
    Given no active API baseline exists
    Then CT-API-001 is a design-time conformance plan without a backward-compatibility claim
    And the first activated document becomes the comparison baseline only after its governed release
    And any removed or narrowed field, enum, status, path, method, idempotency rule, error mapping, or application operation requires breaking-change classification
    And CT-EVT-001 remains guard-triggered because no durable delayed handoff exists
    And implementation, dependency, deployment, baseline activation, Ring 2, and issue closure remain unauthorized

  # Ring 1 behavioral specification only; executable bindings and compatibility tooling are required in Ring 2.
