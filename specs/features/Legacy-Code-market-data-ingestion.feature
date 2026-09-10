Feature: Legacy market-data ingestion evidence and migration constraints
  As a migration analyst
  I need to understand the historical symbol-range retrieval and HTML extraction flow
  So that the target design can preserve valid behavior while discarding brittle legacy assumptions

  Background:
    Given the legacy solution loads a list of ETF symbols from a configuration file
    And it requests a daily price range for each symbol and date window
    And the Objective PDF treats the legacy mechanism as evidence rather than a future-state mandate

  Rule: Historical retrieval flow
  Scenario: The legacy requestor builds a Yahoo historical URL for each symbol and range
    Given a symbol list containing values such as SPY and XLU
    And a begin date and end date for a target market-data window
    When the requestor creates the Yahoo request URL and executes the HTTP fetch
    Then it retrieves the daily price page for each symbol in the configured range
    And it stores the result for parsing in the extractor stage

  Rule: HTML extraction behavior
  Scenario: The legacy parser converts the HTML table into OHLCV price records
    Given a historical page stream containing tabular daily price rows
    And the HTML uses table cells with right-aligned numeric fields
    When the extractor applies a regex to capture the daily row values
    Then it converts the matched date, open, high, low, close, volume, and adjusted close values into price objects
    And it returns a list that is ready for persistence

  Rule: Migration constraints
  Scenario: The legacy scraping and regex parsing remain historical evidence only
    Given the target objective requires legal/provider validation, deterministic provenance, and a clean migration path
    When the design team compares the legacy flow to the target requirements
    Then the HTTP Yahoo fetch and regex parsing remain evidence of past behavior and migration constraints
    And they are not used as direct requirements for the future prototype

  # Source: docs/customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.HtmlParser/Requestor.cs
  # Source: docs/customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.HtmlParser/Extractor.cs
  # Source: docs/customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.YahooQuoteService/Program.cs
  # Source: docs/customer-docs/Objective/ETF Trade Recommendation Prototype Requirements.pdf
  # Priority: Medium
