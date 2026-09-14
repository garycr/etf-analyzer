@planning @contract @postgresql @ct-db-001
Feature: CT-DB-001 PostgreSQL contract conformance
  The inactive prototype candidate requires one deterministic local PostgreSQL schema.
  These scenarios specify the closed contract; Ring 2 supplies executable evidence.

  Background:
    Given prototype candidate "v1.0.0-prototype.1"
    And PostgreSQL contract "1.0.0-candidate.2"
    And an empty database administered by an external PostgreSQL cluster provisioner

  Rule: Empty bootstrap has one ordered result
  Scenario: CT-DB-001A an empty database reaches the exact candidate schema
    Given no application schema, migration row, extension, or product role exists
    And the external provisioner is not a product role and has PostgreSQL CREATEROLE and database-owner authority
    When the provisioner creates all fourteen product roles with the contract attributes
    And the provisioner grants deployment_login membership in migration_executor with ADMIN FALSE, INHERIT FALSE, and SET TRUE
    And the provisioner grants migration_executor membership in migration_owner with ADMIN FALSE, INHERIT FALSE, and SET TRUE
    And the provisioner grants migration_owner SET TRUE, INHERIT FALSE, and ADMIN FALSE membership in every other owner role
    And the provisioner revokes database CONNECT and TEMPORARY from PUBLIC
    And the provisioner grants database CONNECT only to deployment_login, migration_executor, app_runtime, projection_runtime, audit_runtime, and key_injector
    And the provisioner creates only empty schema etf authorized to schema_owner
    And schema etf has no explicit ACL, relation, routine, or schema-scoped default privilege
    And deployment_login connects and sets migration_executor then migration_owner
    And the closed migration set is applied in ascending migration identity order
    Then every migration commits exactly once
    And every product role has SUPERUSER false, CREATEROLE false, CREATEDB false, REPLICATION false, and BYPASSRLS false
    And the recorded migration identities, content hashes, and schema manifest hash match the contract
    And system extension "plpgsql" is present and no product-created extension exists
    And no table, column, constraint, index, role, grant, function, trigger, product extension, or schema exists outside the manifest

  Scenario Outline: CT-DB-001B migration replay is deterministic and drift fails closed
    Given the complete candidate migration set has committed
    When the identical migration set is applied again
    Then no product object or migration record changes
    And schema, role, constraint, index, trigger, table, function, and view records use their closed canonical shapes and SQL hash input rules
    And migration 0006 allocates reject_immutable_change and every named immutable-table trigger
    When drift "<drift>" is detected
    Then readiness is "NotReady"
    And the controlling error is "APPLICATION_MIGRATIONS_INCOMPLETE"
    And catalog projection recomputes the canonical manifest before readiness changes
    And no repair, downgrade, or destructive rewrite occurs implicitly

    Examples:
      | drift                                      |
      | missing migration 0004-fixtures            |
      | duplicate migration sequence 4             |
      | reordered migrations 0004 and 0005         |
      | unknown migration 0007-outbox              |
      | changed migration content hash             |
      | changed check constraint expression        |
      | unknown table etf.event_outbox              |
      | changed function body hash                 |
      | extra runtime role membership              |
      | PUBLIC execute grant                       |
      | PUBLIC database CONNECT grant              |
      | PUBLIC database TEMPORARY grant            |
      | missing app_runtime database CONNECT grant |

  Scenario Outline: CT-DB-001C a failed migration leaves no partial candidate state
    Given migration "<migration>" is forced to fail at "<boundary>"
    When the migration transaction rolls back
    Then none of that migration's objects, grants, functions, triggers, or migration record remain
    And when migration is "0001-foundation" the exact empty provisioner schema remains unchanged
    And every earlier committed migration remains byte-for-byte unchanged
    And the advisory lock releases only after rollback completes
    And application runtime authority remains unavailable

    Examples:
      | migration                   | boundary                         |
      | 0001-foundation             | after first table                |
      | 0002-application            | after first table                |
      | 0003-domain-ledger          | after first ledger table         |
      | 0004-fixtures               | after first observation table    |
      | 0005-analytics-evidence     | after first evidence table       |
      | 0006-controlled-access      | after first function grant       |

  Rule: Database authority is deny by default
  Scenario: CT-DB-001D roles and controlled operations enforce least privilege
    Given the closed owner and runtime roles from PostgreSQL candidate.2
    And PostgreSQL 16 membership records are exactly
      | role               | member             | adminOption | inheritOption | setOption |
      | migration_executor | deployment_login   | false       | false         | true      |
      | migration_owner    | migration_executor | false       | false         | true      |
      | anchor_owner       | migration_owner    | false       | false         | true      |
      | application_writer_owner | migration_owner | false     | false         | true      |
      | audit_writer_owner | migration_owner    | false       | false         | true      |
      | evidence_writer_owner | migration_owner | false       | false         | true      |
      | ledger_writer_owner | migration_owner   | false       | false         | true      |
      | projection_owner   | migration_owner    | false       | false         | true      |
      | schema_owner       | migration_owner    | false       | false         | true      |
    And deployment_login connects, sets migration_executor, sets migration_owner, then resets and closes before its credential is removed
    When grants are compared with the closed role matrix
    Then PUBLIC has no database, schema, table, sequence, function, or role privilege
    And database CONNECT is granted only to deployment_login, migration_executor, app_runtime, projection_runtime, audit_runtime, and key_injector
    And app_runtime cannot own objects, run DDL, set role, bypass row security, or directly mutate protected tables
    And each SECURITY DEFINER function has a fixed trusted search_path, fully qualified objects, revoked PUBLIC execution, and no caller-derived dynamic SQL
    And a denied attempt records no SQL text, parameter value, secret, or protected key material
    And audit_runtime accepts only its authenticated audit outcomes
    And a nested projection call accepts only BlockedPublication or PublicationCompleted while direct projection_runtime audit execution remains denied
    And denial collection verifies the still-live original backend identity before deriving its authentication-context digest
    When each actor attempts the following operation
      | actor              | attack                              |
      | app_runtime        | SET ROLE migration_owner            |
      | app_runtime        | INSERT into ledger_transactions     |
      | key_injector       | execute anchor_append                |
      | projection_runtime | replace ledger anchor               |
      | app_runtime        | SELECT protected key material       |
      | PUBLIC             | execute controlled writer           |
    Then PostgreSQL denies every attempt with SQLSTATE "42501"
    And the separately authorized denial collector appends "PermissionDenied" or returns "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED"
    When each denial binding case is collected
      | bindingCase                         | denialResult                         |
      | original backend vanished          | ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED |
      | backend PID reused with new start   | ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED |
      | backend start differs               | ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED |
      | nonce is missing                    | ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED |
      | nonce differs from application_name | ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED |
      | dedup key has conflicting content   | ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED |
      | denial audit insert rolls back      | ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED |
      | live backend and nonce match        | PermissionDenied                     |
    Then every denial result matches its table row
    And access_denial_audit, ledger_audit, order_audit, readiness_audit, and protected records remain unchanged unless one valid denial row commits
    When app_runtime invokes each bounded reader
      | reader          | exact owner result                                      |
      | evidence_read   | Evidence after authorization, redaction, and hash checks |
      | job_get         | Job including committed checkpoint                      |
      | paper_order_get | PaperOrder including confirmation and transition history |
      | portfolio_get   | Portfolio at asOf including verified projection content  |
    Then each complete result is returned without a direct base-table grant

  Rule: Physical values preserve owning contracts
  Scenario Outline: CT-DB-001E exact values reject noncanonical input before PostgreSQL cast
    Given owner "<owner>" class "<numericClass>" maps to PostgreSQL type "<postgresType>"
    When canonical value "<accepted>" is stored through its controlled writer
    Then PostgreSQL returns the identical fixed-point text
    And every UTCInstant physical column is timestamp(3) with time zone and rejects sub-millisecond input before cast
    And every JSON column resolves to one named owner record and hash domain
    When value "<rejected>" is submitted
    Then "<errorCode>" controls before any cast or row mutation
    And ledger input "-0.00000000" is normalized before cast and stored as "0.00000000"

    Examples:
      | owner     | numericClass | postgresType   | accepted         | rejected          | errorCode              |
      | ledger    | Quantity     | numeric(28,10) | 1.0000000000     | 1.00000000001     | LEDGER_EXCESS_SCALE    |
      | ledger    | Money        | numeric(28,8)  | 100.00000000     | 1e2               | LEDGER_INVALID_DECIMAL |
      | analytics | Rate         | numeric(28,12) | 0.010000000000   | NaN               | ANALYTICS_NUMERIC_CLASS_INVALID |
      | fixture   | Quantity     | numeric(28,10) | 0.0000000000     | -0.0000000000     | FIXTURE_DECIMAL_INVALID |
      | fixture   | UTCInstant   | timestamptz(3) | 2026-01-30T12:00:00.000Z | 2026-01-30T12:00:00.0001Z | FIXTURE_TEMPORAL_INVALID |
      | application | ClosedJson | jsonb           | {"jobId":"73000000-0000-4000-8000-000000000001"} | {"jobId":"73000000-0000-4000-8000-000000000001","extra":true} | APPLICATION_REQUEST_INVALID |

  Scenario Outline: CT-DB-001F paper-order state, replay, and history are atomic
    Given one paper-order transition has current expected aggregate version and a new transition command identity
    When its controlled transaction commits
    Then order state, aggregate version, application replay, domain replay, transition history, and audit evidence become visible together
    And exactly one OT transition is represented
    When paper-order failure "<failure>" is forced before commit
    Then the controlling error is "<errorCode>"
    And paper_orders, order_transitions, application_replays, order_command_replays, order_audit, and aggregate version remain byte-for-byte unchanged

    Examples:
      | failure                                  | errorCode                    |
      | stale expected aggregate version         | ORDER_VERSION_CONFLICT       |
      | reused command identity with new content | ORDER_IDEMPOTENCY_CONFLICT   |
      | transition guard fails                   | ORDER_GUARD_FAILED           |

  Scenario Outline: CT-DB-001G ledger evidence is immutable, anchored, and projection-safe
    Given one owner-valid ledger transaction with ordered effects and allocations
    When its controlled transaction commits
    Then transaction, effects, allocations, reversal links, audit, deduplication, chain commitment, and protected anchor become visible atomically
    And update, delete, truncate, direct insert, anchor replacement, and unverified projection publication are denied
    And corrections append reversal records rather than rewriting evidence
    When ledger failure "<failure>" is forced before the business commit
    Then the controlling error is "<errorCode>"
    And fills, ledger transactions, effects, lots, allocations, reversal links, replay, versions, commitments, anchors, and checkpoints remain byte-for-byte unchanged
    And only the separately committed redacted rejection or integrity audit may append after rollback

    Examples:
      | failure                                  | errorCode                    |
      | stale expected portfolio version         | LEDGER_VERSION_CONFLICT      |
      | reused transaction identity with new content | LEDGER_IDEMPOTENCY_CONFLICT |
      | protected checkpoint HMAC mismatch       | LEDGER_INTEGRITY_FAILED      |
      | insufficient long position               | LEDGER_INSUFFICIENT_POSITION |

  Scenario Outline: CT-DB-001H fixture identity and provenance constraints reject ambiguity
    Given a reviewed fixture package with manifest, descriptors, raw-source objects, market observations, and economic vintages
    When package records commit
    Then package hash, ordered descriptors, raw-source hashes, business identities, availability timestamps, revisions, normalization identifiers, quality states, and quality codes remain queryable without storage-order dependence
    And owner ingestion job identifier "fixture-build-1" is stored and returned as identical text
    When fixture failure "<failure>" is forced before commit
    Then the controlling error is "<errorCode>"
    And fixture_packages, fixture_descriptors, fixture_raw_sources, both observation tables, fixture_ingestion_replays, jobs, and checkpoints remain byte-for-byte unchanged

    Examples:
      | failure                                  | errorCode                         |
      | reused market identity with changed content | FIXTURE_IDEMPOTENCY_CONFLICT   |
      | two vintage identifiers at one release   | FIXTURE_TEMPORAL_INVALID          |
      | raw-source bytes differ from hash         | FIXTURE_FILE_INTEGRITY_FAILED     |
      | normalization identifier is absent       | FIXTURE_PROVENANCE_INVALID        |
      | selected record is Quarantined            | FIXTURE_REQUIRED_QUARANTINED      |

  Scenario Outline: CT-DB-001I analytics evidence publishes only complete verified bundles
    Given a complete owner-valid input set, configuration, result, evidence bundle, retention binding, and manifest chain
    When evidence commit and current-publication replacement succeed
    Then immutable evidence, hashes, audit, retention, and one versioned publication reference become visible atomically
    And owner identifiers "input-fixture-1", "evidence-fixture-1", and "manifest-fixture-1" are stored and returned as identical text
    When analytics failure "<failure>" is forced before commit
    Then the controlling error is "<errorCode>"
    And input sets, bundles, manifests, lifecycle references, deletion links, retention bindings, replay, audit, and current publication remain byte-for-byte unchanged
    And companion code "ANALYTICS_PUBLICATION_BLOCKED" does not replace the controlling error

    Examples:
      | failure                                  | errorCode                              |
      | bundle hash verification differs         | ANALYTICS_INTEGRITY_FAILED             |
      | required input is incomplete              | ANALYTICS_INPUT_INCOMPLETE             |
      | provider policy forbids retention         | ANALYTICS_RIGHTS_RESTRICTED            |
      | managed capacity is exhausted             | ANALYTICS_CAPACITY_BLOCKED             |
      | expected publication version is stale     | ANALYTICS_PUBLICATION_VERSION_CONFLICT |
      | evidence transaction persistence fails    | ANALYTICS_EVIDENCE_COMMIT_FAILED       |

  Rule: Jobs and readiness survive process restart without event scope
  Scenario Outline: CT-DB-001J job state and checkpoints resume without duplicate effects
    Given a Failed Restartable job at attempt "1" with one committed checkpoint
    When the process restarts and JobRestart commits
    Then the job row is locked before status, restartability, checkpoint, or replay is read
    And application replay is resolved before job state mutates
    Then the same job and input identities remain
    And attempt becomes "2"
    And status, checkpoint, counts, controlling error, and application replay survive restart
    And the checkpoint names its effect domain, first identity, last identity, and exact committed effect count
    And every named effect exists in the same commit and no effect outside that inclusive range is claimed
    And no committed fixture or analytics effect is duplicated
    When restart case "<restartCase>" is attempted
    Then the exact result is "<result>"
    And job, checkpoint, replay, and committed-effect rows remain atomic
    And on failure all four row sets remain byte-for-byte unchanged

    Examples:
      | restartCase                              | result                              |
      | equivalent application replay           | original result                     |
      | conflicting application replay          | APPLICATION_IDEMPOTENCY_CONFLICT    |
      | Running job                             | APPLICATION_JOB_NOT_RESTARTABLE     |
      | Failed NotRestartable job               | APPLICATION_JOB_NOT_RESTARTABLE     |
      | crash before transaction commit         | attempt remains 1                   |
      | crash after transaction commit          | attempt 2 returned by replay        |

  Scenario Outline: CT-DB-001K readiness reflects connectivity, migration, and security state
    Given database condition "<condition>"
    When readiness is evaluated
    Then database readiness is "<state>"
    And the exact controlling error is "<errorCode>"
    And application dependencies remain ordered "PostgreSQL,Migrations,FixturePolicy,LocalDependency,DenialAudit,LedgerIntegrity"

    Examples:
      | condition                                      | state    | errorCode                            |
      | all database checks match                      | Ready    | <null>                               |
      | connectivity refused                           | NotReady | APPLICATION_DATABASE_UNAVAILABLE     |
      | migration hash differs                         | NotReady | APPLICATION_MIGRATIONS_INCOMPLETE    |
      | schema manifest differs                        | NotReady | APPLICATION_MIGRATIONS_INCOMPLETE    |
      | PUBLIC has execute                             | NotReady | APPLICATION_MIGRATIONS_INCOMPLETE    |
      | denial audit cannot append                     | NotReady | ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED |
      | protected ledger checkpoint cannot verify     | NotReady | LEDGER_INTEGRITY_FAILED              |

  Scenario: CT-DB-001L the prototype schema contains no durable handoff
    When every manifested table, function, trigger, and index is classified
    Then no outbox, event, queue, schedule, lease, worker inbox, notification, or delayed-consumer object exists
    And transaction-local atomicity does not create an event contract
    And CT-DB-002 remains guard-triggered because no prior active populated baseline exists

  # Sources: issue #21; DEC-011/013/014/021/022; O-CST-007; O-REQ-003/007/009; O-MET-006/008
  # Ring 1 behavioral specification only; executable PostgreSQL bindings are required in Ring 2
