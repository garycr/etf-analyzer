Feature: PT-FIX-001 fixture contract conformance
  As a research operator
  I need every local fixture package to have deterministic identity, provenance, and quality semantics
  So that fixture-only analytics cannot use ambiguous, malformed, incomplete, or future information

  Background:
    Given the inactive prototype candidate is "v1.0.0-prototype.1"
    And fixture mode is explicitly selected with outbound provider access disabled
    And the fixture package conforms to fixture contract "1.0.0-candidate.2"
    And no live-provider outage can select or mutate a fixture package

  Rule: Dataset identity and content are immutable
  Scenario: PT-FIX-001A an unchanged package has one reproducible identity
    Given a package with dataset ID "etf-prototype-core", dataset version "2026.01.0", and schema version "1.0.0"
    And the package bytes match the candidate.2 golden package in the fixture contract
    And its manifest orders file entries by normalized relative path
    And every file entry records its UTF-8 byte length and lowercase SHA-256 digest
    When the dataset digest is recomputed from the contract's canonical manifest hash domain
    Then every file byte length and digest matches the candidate.2 golden values
    And the dataset digest matches the candidate.2 golden value exactly
    And changing any governed byte, file path, byte length, or file digest changes the dataset digest
    And the original dataset version remains immutable

  Scenario: PT-FIX-001H manifest and coverage records are closed and unique
    Given a manifest with exact candidate.2 fields, media types, descriptors, and coverage entries
    When an unknown field, duplicate descriptor, duplicate coverage identity, absolute path, or parent path segment is introduced
    Then conformance fails with "FIXTURE_MANIFEST_INVALID"
    And no package observation is loaded

  Scenario: PT-FIX-001I raw provenance bytes are independently verified
    Given each raw-source reference resolves to a governed "raw-sources/<sha256>" object
    When the referenced raw bytes are changed without updating the observation and manifest
    Then conformance fails with "FIXTURE_FILE_INTEGRITY_FAILED"
    And no normalized observation is analytics-eligible

  Rule: Market observations preserve business and replay identity
  Scenario: PT-FIX-001B a repeated market row is idempotent
    Given a market observation identified by instrument ID, trading date, provider ID, adjustment policy, and revision
    And the observation records source availability, normalized value, raw-source reference, and ingestion job ID
    When the same idempotency key and identical canonical payload are loaded twice
    Then exactly one logical market observation exists
    And the replay is recorded as an idempotent success

  Scenario: PT-FIX-001C conflicting market replay fails closed
    Given two market rows have the same five-part business identity and idempotency key
    But their canonical payloads differ
    When fixture conformance is evaluated
    Then conformance fails with "FIXTURE_IDEMPOTENCY_CONFLICT"
    And neither row is eligible for analytics publication

  Scenario: PT-FIX-001J economic replay and release identity are deterministic
    Given two economic rows reuse one economic job idempotency key or one full vintage identity
    When their canonical payloads are byte-identical
    Then exactly one logical economic vintage exists as an idempotent success
    When their canonical payloads differ
    Then conformance fails with "FIXTURE_IDEMPOTENCY_CONFLICT"
    When different vintage IDs share one provider, series, observation date, and release timestamp
    Then conformance fails with "FIXTURE_TEMPORAL_INVALID"

  Rule: Point-in-time selection excludes future knowledge
  Scenario: PT-FIX-001D economic vintage cutoff includes exactly T
    Given economic vintages for one series and observation date are released at T minus 1 millisecond, T, and T plus 1 millisecond
    When the eligible vintage is selected at T
    Then the vintage released exactly at T is selected
    And the future vintage is excluded
    And every preserved vintage remains append-only

  Scenario: PT-FIX-001E fixture market revisions use numeric order after availability filtering
    Given eligible fixture revisions "9" and "10" and future revision "11" for one market identity
    When the market observation is selected at T
    Then revision "10" is selected by canonical non-negative integer order
    And future revision "11" is excluded before ordering
    And lexical ordering is not used

  Scenario Outline: PT-FIX-001K selected invalid latest input never falls back
    Given an older Valid <inputFamily> record and a latest eligible Stale <inputFamily> record
    When temporal selection runs before quality evaluation
    Then the latest eligible record is selected
    And conformance fails with "FIXTURE_REQUIRED_STALE"
    And the older Valid record is not substituted
    And no dependent result is published

    Examples:
      | inputFamily |
      | market      |
      | economic    |

  Scenario: PT-FIX-001L malformed fixture revision fails before selection
    Given an otherwise valid market record with revision "01"
    When fixture conformance is evaluated
    Then conformance fails with "FIXTURE_TEMPORAL_INVALID"
    And the malformed revision does not enter numeric ordering

  Rule: Decimal values use bounded exact grammar
  Scenario Outline: PT-FIX-001F canonical decimal values obey DEC-014 scale
    Given a fixture value of numeric class "<numericClass>" with declared exact scale <exactScale>
    When canonical decimal value "<value>" is validated
    Then fixture conformance is "<result>"
    And no binary floating-point conversion or implicit rounding occurs

    Examples:
      | numericClass | exactScale | value                         | result |
      | Quantity     | 10         | 1.2300000000                  | PASS   |
      | UnitPrice    | 10         | 100.0000000000                | PASS   |
      | Money        | 8          | 1000.00000000                 | PASS   |
      | Rate         | 12         | 0.012500000000                | PASS   |
      | UnitPrice    | 10         | 999999999999999999.0000000000 | PASS   |
      | UnitPrice    | 10         | 1000000000000000000.0000000000 | FAIL   |
      | UnitPrice    | 10         | 100.00000000001               | FAIL   |
      | UnitPrice    | 10         | 100.0                         | FAIL   |
      | UnitPrice    | 10         | 1e2                           | FAIL   |
      | UnitPrice    | 10         | 0100.0000000000               | FAIL   |
      | UnitPrice    | 10         | -0.0000000000                 | FAIL   |
      | Rate         | 12         | NaN                           | FAIL   |

  Scenario Outline: PT-FIX-001M numeric class and currency pairing fails closed
    Given numeric class "<numericClass>" and currency "<currency>"
    When their fixture field pairing is validated
    Then fixture conformance is "<result>"

    Examples:
      | numericClass | currency | result |
      | UnitPrice    | USD      | PASS   |
      | Money        | USD      | PASS   |
      | Quantity     |          | PASS   |
      | Rate         |          | PASS   |
      | UnitPrice    |          | FAIL   |
      | Quantity     | USD      | FAIL   |

  Rule: Data-quality failures suppress dependent outputs
  Scenario Outline: PT-FIX-001G invalid required input cannot become a valid no-signal result
    Given a required fixture observation is "<qualityState>"
    When fixture conformance and dependent analytics eligibility are evaluated
    Then conformance fails with "<errorCode>"
    And the affected instrument output is suppressed
    And no analytics bundle, manifest, or current result is published

    Examples:
      | qualityState | errorCode                   |
      | missing      | FIXTURE_REQUIRED_MISSING    |
      | partial      | FIXTURE_REQUIRED_PARTIAL    |
      | stale        | FIXTURE_REQUIRED_STALE      |
      | quarantined  | FIXTURE_REQUIRED_QUARANTINED |

  Rule: Validation result is stable across defects and environments
  Scenario: PT-FIX-001N multiple defects use deterministic precedence
    Given one package has an unknown manifest field, a raw-source digest mismatch, a malformed revision, and a stale required record
    And multiple temporal defects have absent, invalid, and valid identity components
    When candidate.2 conformance is evaluated in each supported runtime
    Then the controlling error is "FIXTURE_MANIFEST_INVALID"
    And all detected errors use the contract's precedence and canonical identity order
    And absent components sort by the contract sentinel
    And invalid components sort by raw UTF-8 length-prefixed offending value
    And valid components sort by canonical value
    And the complete error order is identical in every supported runtime
    And no record is loaded or published

  Scenario: PT-FIX-001O fixture mode blocks product provider egress
    Given a valid package is loaded in explicit fixture mode
    When the product runtime attempts DNS resolution or a network connection to a provider endpoint
    Then the attempt is denied by configuration and local egress policy
    And conformance evidence records no successful provider connection
    And the package is never replaced or supplemented with network data

  # Sources: GitHub #21; O-REQ-003; O-REQ-004; O-CST-003..005; O-MET-007; DEC-014; DEC-021; DEC-022
  # Ring 1 behavioral specification only; PT-FIX-001A..O executable bindings are required in Ring 2
