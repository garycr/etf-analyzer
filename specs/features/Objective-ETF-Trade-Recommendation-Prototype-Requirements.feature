Feature: ETF trade recommendation prototype requirements
  As a research operator
  I need a local-first ETF research and paper-portfolio workflow
  So that I can evaluate signals, preserve evidence, and make explicit paper decisions without brokerage execution

  Background:
    Given the Objective PDF pages 1-14 define the specified target scope for the prototype
    And the prototype is a local single-user browser workbench with no brokerage connector, real-order endpoint, user credentials, or transmission path
    And the design must preserve provenance, data quality checks, explicit confirmation, and provider policy controls
    And no provider-side paper-trading API or live brokerage execution may be used

  Rule: Scope and non-goals
  Scenario: The prototype is local-only and excludes execution and streaming features
    Given a system design that must maintain the local single-user workbench scope from the Objective PDF
    When the design is compared to the explicit non-goals in pages 1-2
    Then it must exclude brokerage connectors, real-money execution, streaming or intraday feeds, advice or guarantees, paid data, options/futures/leverage/margin/shorting/tax support, multi-tenancy, HA-DR, mobile, Azure, and backward-compatibility layers
    And it must operate with UTC and the exchange calendar meaning defined by the source rather than inventing a hidden execution path

  Rule: Watchlists, market data, and backfill
  Scenario: A user maintains a watchlist and resumable backfill without creating execution semantics
    Given a watchlist with ETF symbols, symbol validation, and a configured date window
    When the research operator adds, reorders, or deduplicates symbols and requests market-data ingestion
    Then the system supports watchlist CRUD, reorder, deduplication, symbol validation, and resumable backfill
    And it preserves raw and normalized provenance, idempotency metadata, DQ checks, and failure suppression for missing or partial inputs
    And the system never implicitly creates a real order or brokerage action from the watchlist state

  Rule: Economic data and provider policy
  Scenario: Official economic adapters and provider controls are required and revalidated
    Given FRED/ALFRED, BLS, BEA, and Treasury Fiscal Data adapters are in scope
    When an observation vintage is evaluated at time T
    Then the system uses only the observation whose release timestamp is less than or equal to T
    And forward-fill, period-end alignment, lag, interpolation, or resampling is treated as a separately versioned transformation and never as an overwrite
    And provider quotas, terms, settings acknowledgment, and organizational-use restrictions are reviewed and revalidated before production dependency

  Rule: Representative acceptance criteria
  Scenario: An ingestion rerun remains idempotent and auditable
    Given an ETF and date already loaded in the local store
    When the same ingestion job reruns
    Then no duplicate current-price record is created
    And the rerun remains auditable through provenance, timestamps, and job metadata

  Scenario: Missing-session data suppresses a signal instead of producing a false positive
    Given an expected session with missing or partial data
    When analytics starts for that instrument
    Then the instrument is skipped and a data-quality issue is visible
    And no valid signal is published from the incomplete input

  Scenario: Vintage cutoff preserves point-in-time truth
    Given an economic value or corporate-action revision that occurs after evaluation date T
    When a backtest runs as of T
    Then it uses only the vintage available at or before T
    And it records the rule version, parameters, seed, code hash, benchmark, provider, and environment

  Scenario: No user action means no paper mutation
    Given a displayed signal without any user confirmation
    When the user takes no action
    Then no paper order or portfolio mutation occurs
    And the system remains in research-only state

  Scenario: An unconfirmed paper order remains draft
    Given the user initiates a paper order from a research signal
    When confirmation is not completed
    Then the order remains in draft state
    And no fill, position, or ledger mutation occurs

  Scenario: The portfolio ledger rebuilds exactly within configured decimal precision
    Given confirmed starting cash and a valid set of fills and transactions
    When the portfolio is rebuilt from transactions and positions
    Then cash, lots, positions, realized P&L, valuations, and cached projections reconcile exactly within configured decimal precision
    And reconciliation differences are zero or explained as within tolerance

  Scenario: Repeated analytics and backtests are reproducible
    Given identical data snapshot, code hash, parameters, environment, and seed
    When the analytics or backtest run is repeated
    Then the outputs and evidence hashes match

  Scenario: Provider outages fail rather than succeed with zero rows
    Given a provider outage or retry exhaustion
    When the ingestion or dependent analytics job runs
    Then the job fails explicitly instead of succeeding with zero rows
    And dependent research remains blocked until the failure is resolved

  Scenario: Clean bootstrap and deploy reaches local readiness
    Given a repository checkout on supported local prerequisites and a supported WSL environment
    When bootstrap, migrations, and deploy run
    Then all local pods become ready, migrations apply once, fixture data loads, and the browser vertical slice works
    And the deployment remains local-only and does not expose a public load balancer

  Scenario: Diagnostics are fully redacted
    Given a diagnostic export
    When the export is inspected
    Then it contains no API keys, passwords, prohibited raw provider data, or brokerage artifacts

  Rule: UX, performance, and provider controls
  Scenario: The UI remains accessible and meets the required gates
    Given a desktop or tablet user operating at 1280x720 and keyboard-only navigation
    When they load the dashboard and analytical pages
    Then the interface supports keyboard navigation, visible focus, semantic headings, labels, and non-color-only status cues
      And the p95 non-analytical API response is under 1 second
      And the dashboard first meaningful content is under 2 seconds
    And stale, partial, quarantined, or incompatible data uses blocking warnings rather than color-only badges
    And each analytical page displays "Research only — hypothetical — user makes all investment decisions."

  Scenario: Organizational use is disabled until rights are confirmed
    Given a research deployment used in an organizational context rather than personal use
    When the provider configuration is reviewed
    Then free market-data ingestion is disabled until rights are confirmed
    And the settings acknowledgment records intended use, provider, terms URL/date, persistence/display permissions, and user choice
    And the provider acknowledgment records the provider, terms URL/date, persistence and display permissions, and user choice

  Scenario: Redacted diagnostics are preserved for export and operator review
    Given a diagnostic export from a local deployment
    When the export is inspected by an operator
    Then the export contains no API keys, passwords, prohibited raw provider data, or brokerage artifacts
    And the diagnostics remain redacted and reviewable for evidence collection

  # Source: docs/customer-docs/Objective/ETF Trade Recommendation Prototype Requirements.pdf
  # Source pages: 1-14
  # Priority: High
