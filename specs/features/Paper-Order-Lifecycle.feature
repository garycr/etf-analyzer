@contract @paper-order @baseline-v1
Feature: Complete local paper-order lifecycle
  As a research operator
  I need every paper-order state transition to be explicit and locally enforced
  So that hypothetical decisions remain user-controlled, auditable, and disconnected from brokerage execution

  Background:
    Given the paper-order contract version is "1.0.0-candidate.1"
    And the allowed domain states are Draft, Submitted, Accepted, Partial, Filled, Rejected, Canceled, and Expired
    And "Partial" is displayed to the user as "Partially Filled"
    And no broker connector, provider paper-trading API, real-order endpoint, external account, credential, or transmission path exists

  Rule: Only the closed transition set is accepted
  @CT-ORD-003 @CT-ORD-004 @CT-ORD-005 @CT-ORD-006
  Scenario Outline: An allowed transition applies its local lifecycle effect
    Given a paper order is in the <source> state
    And the <guard> guard is satisfied
    When the <transition> transition to <target> is requested
    Then the paper order state becomes <target>
    And the simulated fill delta is <fill_delta>
    And the remaining open quantity is <open_quantity>
    And the ledger effect is <ledger_effect>
    And terminal status is <terminal>
    And transition evidence records the source, target, trigger, UTC timestamp, actor, correlation identifier, transition command identifier, prior aggregate version, resulting aggregate version, and baseline version

    Examples:
      | transition | source    | target    | guard                           | fill_delta                    | open_quantity       | ledger_effect                       | terminal |
      | OT-02      | Draft     | Submitted | explicit confirmation recorded  | zero                          | not yet evaluated   | unchanged                           | no       |
      | OT-03      | Submitted | Accepted  | local validation passes         | zero                          | full request        | unchanged                           | no       |
      | OT-04      | Submitted | Rejected  | local validation fails          | zero                          | none                | unchanged                           | yes      |
      | OT-05      | Accepted  | Partial   | partial local fill exists       | positive and less than open   | positive remainder  | append only the simulated fill      | no       |
      | OT-06      | Accepted  | Filled    | complete local fill exists      | equal to open quantity        | zero                | append the complete simulated fill  | yes      |
      | OT-07      | Accepted  | Canceled  | user cancels before fill        | zero                          | zero                | unchanged                           | yes      |
      | OT-08      | Accepted  | Expired   | deterministic expiry is reached | zero                          | zero                | unchanged                           | yes      |
      | OT-09      | Partial   | Filled    | remaining quantity fills        | equal to prior open remainder | zero                | append fill and preserve prior fills| yes      |
      | OT-10      | Partial   | Canceled  | user cancels remainder          | zero                          | zero                | preserve all prior fills            | yes      |

  @CT-ORD-001
  # This scenario is the OT-01 guard-failure case: without explicit user choice, Initial does not create Draft.
  Scenario: A displayed signal never creates a paper order automatically
    Given a research signal is displayed
    When the user takes no paper-order action
    Then no paper order, fill, position, cash, lot, or ledger mutation occurs

  @CT-ORD-002
  Scenario: An unconfirmed paper order remains Draft
    Given the user explicitly creates a local paper order in Draft
    When explicit confirmation is absent
    Then the paper order remains Draft
    And no fill, position, cash, lot, or ledger mutation occurs

  @CT-ORD-003
  Scenario: Explicit user creation is the only initial transition
    Given a research signal is displayed
    When the user explicitly chooses to create a paper order
    Then transition OT-01 creates a local Draft
    And no fill, position, cash, lot, or ledger mutation occurs
    And transition evidence records Initial, Draft, the user trigger, UTC timestamp, actor, correlation identifier, transition command identifier, an absent prior aggregate version, resulting aggregate version, and baseline version

  @CT-ORD-007
  Scenario Outline: Every unlisted source and target pair is rejected atomically
    Given a paper order is in the <source> state
    When a transition to <target> that is absent from OT-01 through OT-10 is requested
    Then the transition is rejected with ORDER_INVALID_TRANSITION
    And the current state, aggregate version, fills, positions, cash, lots, and ledger are unchanged
    And redacted audit evidence identifies the current state and requested target
    And the result provides a recoverable explanation without secrets or prohibited raw provider payloads

    Examples:
      | source    | target    |
      | Draft     | Draft     |
      | Draft     | Accepted  |
      | Draft     | Partial   |
      | Draft     | Filled    |
      | Draft     | Rejected  |
      | Draft     | Canceled  |
      | Draft     | Expired   |
      | Submitted | Draft     |
      | Submitted | Submitted |
      | Submitted | Partial   |
      | Submitted | Filled    |
      | Submitted | Canceled  |
      | Submitted | Expired   |
      | Accepted  | Draft     |
      | Accepted  | Submitted |
      | Accepted  | Accepted  |
      | Accepted  | Rejected  |
      | Partial   | Draft     |
      | Partial   | Submitted |
      | Partial   | Accepted  |
      | Partial   | Partial   |
      | Partial   | Rejected  |
      | Partial   | Expired   |

  @CT-ORD-007
  Scenario Outline: Initial can only create Draft
    Given no paper order aggregate exists
    When an Initial transition to <target> is requested
    Then the transition is rejected with ORDER_INVALID_TRANSITION
    And no paper order, aggregate version, fill, position, cash, lot, or ledger mutation occurs
    And redacted audit evidence identifies Initial and the requested target
    And the result provides a recoverable explanation without secrets or prohibited raw provider payloads

    Examples:
      | target    |
      | Submitted |
      | Accepted  |
      | Partial   |
      | Filled    |
      | Rejected  |
      | Canceled  |
      | Expired   |

  @CT-ORD-007
  Scenario Outline: Missing transition guards are rejected atomically
    Given a paper order is in the <source> state
    And the <guard> guard is not satisfied
    When the <transition> transition to <target> is requested
    Then the transition is rejected with a stable guard-failed error
    And the current state, aggregate version, fills, positions, cash, lots, and ledger are unchanged
    And redacted audit evidence identifies the current state and requested target
    And the result provides a recoverable explanation without secrets or prohibited raw provider payloads

    Examples:
      | transition | source    | target    | guard                           |
      | OT-02      | Draft     | Submitted | explicit confirmation recorded  |
      | OT-03      | Submitted | Accepted  | local validation passes         |
      | OT-04      | Submitted | Rejected  | local validation fails          |
      | OT-05      | Accepted  | Partial   | partial local fill exists       |
      | OT-06      | Accepted  | Filled    | complete local fill exists      |
      | OT-07      | Accepted  | Canceled  | user cancels before fill        |
      | OT-08      | Accepted  | Expired   | deterministic expiry is reached |
      | OT-09      | Partial   | Filled    | remaining quantity fills        |
      | OT-10      | Partial   | Canceled  | user cancels remainder          |

  @CT-ORD-007
  Scenario Outline: Unknown and incorrectly cased domain states are rejected
    Given a transition request contains the invalid enum value <value>
    When the transition is requested
    Then the transition is rejected with ORDER_UNKNOWN_STATE
    And no paper order, aggregate version, fill, position, cash, lot, or ledger mutation occurs
    And redacted audit evidence identifies the invalid requested value
    And the result provides a recoverable explanation without secrets or prohibited raw provider payloads

    Examples:
      | value              |
      | Cancelled          |
      | PartiallyFilled    |
      | Partially Filled   |
      | partial            |
      | Unknown            |

  @CT-ORD-008
  Scenario Outline: Every terminal source and target pair is rejected
    Given a paper order is in the terminal <source> state
    When a transition to <target> is requested
    Then the transition is rejected with ORDER_TERMINAL_STATE
    And the current state, aggregate version, fills, positions, cash, lots, and ledger are unchanged
    And redacted audit evidence identifies the current state and requested target
    And the result provides a recoverable explanation without secrets or prohibited raw provider payloads

    Examples:
      | source   | target    |
      | Filled   | Draft     |
      | Filled   | Submitted |
      | Filled   | Accepted  |
      | Filled   | Partial   |
      | Filled   | Filled    |
      | Filled   | Rejected  |
      | Filled   | Canceled  |
      | Filled   | Expired   |
      | Rejected | Draft     |
      | Rejected | Submitted |
      | Rejected | Accepted  |
      | Rejected | Partial   |
      | Rejected | Filled    |
      | Rejected | Rejected  |
      | Rejected | Canceled  |
      | Rejected | Expired   |
      | Canceled | Draft     |
      | Canceled | Submitted |
      | Canceled | Accepted  |
      | Canceled | Partial   |
      | Canceled | Filled    |
      | Canceled | Rejected  |
      | Canceled | Canceled  |
      | Canceled | Expired   |
      | Expired  | Draft     |
      | Expired  | Submitted |
      | Expired  | Accepted  |
      | Expired  | Partial   |
      | Expired  | Filled    |
      | Expired  | Rejected  |
      | Expired  | Canceled  |
      | Expired  | Expired   |

  @CT-ORD-009
  Scenario: Replaying an applied transition is idempotent
    Given a transition command has already been applied for an orderId and transitionCommandId
    When canonically equivalent command content is replayed with the same orderId and transitionCommandId
    Then the original result is returned
    And no second state, fill, position, cash, lot, or ledger mutation occurs

  @CT-ORD-009
  Scenario: Correlation is trace-only and does not alter idempotency equivalence
    Given a transition command has already been applied for an orderId and transitionCommandId
    When canonically equivalent command content is replayed with a different correlationId
    Then the original result is returned
    And no idempotency conflict is produced
    And no second state, aggregate version, fill, position, cash, lot, or ledger mutation occurs

  @CT-ORD-009
  Scenario: Reusing an idempotency identity for different command content is rejected
    Given a transition command has already been applied for an orderId and transitionCommandId
    When different canonical command content is submitted with the same orderId and transitionCommandId
    Then the command is rejected with ORDER_IDEMPOTENCY_CONFLICT
    And the original result remains authoritative
    And no second state, fill, position, cash, lot, or ledger mutation occurs
    And redacted audit evidence identifies the conflict without exposing command payload or secrets

  @CT-ORD-012
  Scenario: A stale concurrent transition is rejected
    Given a transition command carries an expectedVersion that no longer matches the authoritative aggregate version
    When expectedVersion comparison, guard evaluation, effects, and evidence are attempted atomically
    Then the command is rejected with ORDER_VERSION_CONFLICT
    And the result identifies the authoritative current state and a recoverable conflict explanation
    And state, aggregate version, fills, positions, cash, lots, and ledger are unchanged
    And redacted audit evidence contains no secrets or prohibited raw provider payloads

  @CT-ORD-010 @accessibility
  Scenario: Partial uses a stable wire value and accessible display label
    Given a paper order is in the Partial state
    When its status is serialized and rendered
    Then the domain and wire value is "Partial"
    And the visible status is "Partially Filled"
    And text or semantics communicates the status without relying on color alone

  @CT-ORD-011 @security
  Scenario: Lifecycle evidence contains no execution path or prohibited diagnostics
    Given every allowed lifecycle path and rejection family has been exercised
    When external calls, persisted evidence, and diagnostic exports are inspected
    Then no broker connector, provider paper-trading API, real-order endpoint, external account, credential, or transmission exists
    And no secret or prohibited raw provider payload appears in lifecycle evidence

  # Contract: docs/Planning/contracts/domain-contract.md
  # Objective: specs/features/Objective-ETF-Trade-Recommendation-Prototype-Requirements.feature
  # Architecture: docs/Architecture/proposed-paper-order-state.md
  # Architecture: docs/Architecture/proposed-paper-order-sequence.md
  # Source issue: GitHub #14
