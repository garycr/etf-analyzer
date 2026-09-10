Feature: Legacy price persistence evidence and identity ambiguity
  As a migration analyst
  I need to understand the historical insert and identity behavior for daily OHLCV data
  So that the target design can preserve valid semantics while replacing machine-specific persistence assumptions

  Background:
    Given the legacy database layer stores ETF price rows and symbol metadata in a SQL Server data context
    And each price row carries date, open, high, low, close, volume, and adjusted close values
    And the Objective PDF calls for bounded numeric semantics, referential integrity, and migration validation

  Rule: Price insert path
  Scenario: The legacy insert loop writes price records with the symbol attached
    Given a list of parsed price objects for one symbol
    When the database wrapper loops through each price and assigns the current symbol
    Then each row is submitted as a batch to the data context
    And the stored record set keeps the symbol alongside the price values

  Rule: Symbol and date identity
  Scenario: The legacy schema shows a primary key on Id but does not prove a unique business key by symbol and date
    Given the generated database metadata declares Id as the primary key and the UpSert_ETFPrices procedure name implies an upsert pattern
    When the data team studies the schema and generated methods
    Then the source does not demonstrate a proven unique(Symbol, Date) requirement
    And the target design must validate and enforce the required uniqueness explicitly before claiming identity semantics

  Rule: Numeric and migration constraints
  Scenario: The legacy model exposes decimal-based values and machine-bound persistence semantics
    Given the generated database model declares decimal fields for price values and a SQL Server machine binding
    And the objective document requires bounded numeric types and migration testing against empty and prior-release states
    When the team compares the legacy persistence layer to the target design
    Then the decimal semantics are retained as a validation signal for the new PostgreSQL design
    And the SQL Server-specific machine binding is treated as a migration constraint and not as a future-state requirement

  # Source: docs/customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.Database/ETFDb.cs
  # Source: docs/customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.Database/ETF.dbml
  # Source: docs/customer-docs/Legacy-Code/Strategic.DataServices.HtmlParser/Strategic.DataServices.Database/ETF.designer.cs
  # Source: docs/customer-docs/Objective/ETF Trade Recommendation Prototype Requirements.pdf
  # Priority: Medium
