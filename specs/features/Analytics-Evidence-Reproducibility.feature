Feature: Point-in-time analytics evidence reproducibility
  As a research operator
  I need analytics and backtest evidence bound to immutable point-in-time inputs
  So that a published result can be reproduced without using information unavailable at its evaluation time

  Background:
    Given the prototype is local, single-user, research-only, and has no brokerage execution path
    And analytics evidence uses RFC 8785 canonical JSON and SHA-256
    And provider rights are enforced by the separately governed provider policy

  Rule: Point-in-time inputs never use future knowledge
  Scenario: A P0 backtest excludes revisions released after its evaluation time
    Given preserved economic vintages released before, at, and after evaluation time T
    And preserved market and corporate-action revisions available before, at, and after T
    And forward-fill and resampling are versioned non-overwriting transformations
    When the P0 backtest input snapshot is selected as of T
    Then every selected observation has a release timestamp at or before T
    And every selected market or corporate-action revision has source availability at or before T
    And the vintage released exactly at T is selected
    And the latest eligible market or corporate-action revision is selected under its reviewed revision order
    And no later vintage overwrites a preserved earlier vintage
    And the snapshot records the selected vintage and transformation identities

  Rule: Complete evidence is deterministically reproducible
  Scenario: CT-ANA-001 identical P0 inputs produce matching evidence hashes
    Given the CT-ANA-001 golden Complete P0 input snapshot
    And identical code hash, canonical parameters, seed, provider, benchmark, environment, and assumptions
    When the P0 backtest is repeated under the same evidence schema and baseline version
    Then the canonical input bytes match the golden vector exactly
    And the input hash is "cca3db225eaa64d91b3c971b2d366ef7fb8bc0a860b7081349ac622920e5f4fa"
    And the canonical configuration bytes match the golden vector exactly
    And the configuration hash is "fa8aac858ca5cee95f658206c1d30bc3ef45e9c4f52867801e27d42e33324d37"
    And the canonical result bytes match the golden vector exactly
    And the result hash is "4ffe4f8e3ee4c0f4d53f90760cdbecbe93f60ee02fa992cc1e350b2e6f819d18"
    And the result remains eligible for evidence-backed publication

  Scenario: Rights-restricted inputs fail closed
    Given provider policy prohibits retaining an input required to reproduce a P0 result
    When the evidence bundle is committed
    Then reproducibility status is Degraded with only the governing rights-policy identifier as its reason
    And the result is not eligible for evidence-backed publication
    And CT-ANA-001 does not pass

  # Sources: GitHub #15 and #11; ADR-001; DEC-017; DEC-018
  # Ring 1 behavioral specification only; executable bindings are required in Ring 2
