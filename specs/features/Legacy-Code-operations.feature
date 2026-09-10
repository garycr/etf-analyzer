Feature: Legacy operations evidence and unverified scheduling gap
  As a platform operator
  I need to understand the historical operational behavior and missing resilience controls
  So that the target system can replace brittle manual steps with healthy operations, diagnostics, and migration-safe behavior

  Background:
    Given the legacy console service and tester use a local XML symbol list and manual local invocation pattern
    And the Objective PDF requires scheduled workflows, health visibility, job validation, and resilience around missing or stale data
    And the prototype must keep operational controls and observability beyond the historical tester approach

  Rule: Console entry-point behavior
  Scenario: The legacy quote service derives a default lookback and optional day-count or end-date values
    Given the command-line Program.cs implementation and a symbol configuration file
    When the service loads the symbol list and builds the quote request
    Then it defaults to a three-day lookback and accepts optional command-line day-count or end-date overrides
    And it is still a console entry point rather than a proven scheduling system

  Rule: Manual testing and visibility
  Scenario: The legacy WinForms tester accepts a symbol and surfaces results directly to the user
    Given a desktop user enters a symbol in the tester form
    When the form fetches the data and extracts the price stream
    Then the user sees the result in the rich-text output and exceptions are displayed immediately
    And this direct visibility remains historical evidence for a replacement operations UI rather than a target scheduling requirement

  Rule: Migration gaps and resilience
  Scenario: The legacy flow exposes missing resilience and observability that the target must improve
    Given a failed network call, malformed HTML, missing data, or a bad provider response
    When the system proceeds without explicit DQ quarantine, structured diagnostics, or retry-idempotency controls
    Then the result is an operational gap rather than a resilient target state
    And the target design must add health checks, job status, stale-symbol tracking, and explicit failure handling

  # Source: docs/customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.YahooQuoteService/Program.cs
  # Source: docs/customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.ClientTester/Form1.cs
  # Source: docs/customer-docs/Objective/ETF Trade Recommendation Prototype Requirements.pdf
  # Priority: Medium
