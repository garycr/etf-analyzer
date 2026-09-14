# PostgreSQL Persistence Contract

**Contract version:** `1.0.0-candidate.2`
**Prototype candidate:** `v1.0.0-prototype.1` - planning, inactive
**Status:** Complete for design-time resolution; candidate.2 custody and REV-026 independent verification PASS
**Owner:** Team Lead
**Conformance check:** `CT-DB-001A..L`
**Architecture status:** Proposed
**Implementation status:** Not started; no SQL migration is authorized or supplied by this contract

## Scope and Authority

This contract defines the bounded PostgreSQL persistence surface for the local single-user prototype. It owns physical schemas, table/column types, keys, constraints, indexes, migration identity/order, database roles/grants, transaction boundaries, append-only enforcement, and readiness evidence. Domain, ledger, fixture, analytics/evidence, and application candidates retain authority over business identities, states, ordering, hashes, arithmetic, errors, and allowed effects.

Normative owner imports are pinned to domain/order `1.0.0-candidate.1`, ledger `1.0.0-candidate.2`, fixture `1.0.0-candidate.2`, analytics/evidence `1.0.0-candidate.2`, and application `1.0.0-candidate.2`. Any owner candidate or schema-version change requires PostgreSQL impact classification before use.

The database preserves owner semantics and fails closed; it cannot translate an owner failure into success, infer missing evidence, round a canonical number, accept storage order as business order, publish unverified data, mutate immutable evidence, or create a hidden application operation.

This candidate defines no HTTP shape, UI, broker/provider connection, public ingress, external account, event/outbox/queue/scheduler/worker, Kubernetes deployment, backup service, dependency installation, executable migration, baseline activation, or Ring 2 work.

## PostgreSQL Baseline

The implementation target is PostgreSQL 16 with UTF-8 encoding, `C` collation for contract identifiers, UTC session timezone, and `standard_conforming_strings=on`. The system-provided `plpgsql` extension is required; no product migration executes `CREATE EXTENSION` or creates another extension. Product timestamps are `timestamptz` constrained to millisecond precision and returned as canonical UTC text. Owner-defined opaque identifiers use `text`; fields whose owning contract explicitly requires UUID use native `uuid`. SHA-256 values use `char(64)` with lowercase-hex checks; canonical dates use `date`; enums use checked `text` rather than mutable PostgreSQL enum types.

All application objects are in schema `etf`. No product object may be created in `public`. Unqualified object lookup is forbidden in controlled functions.

Before any product migration, an external PostgreSQL cluster provisioner with `CREATEROLE` and database-owner authority atomically creates the fourteen closed product roles and nine closed membership records, revokes database `CONNECT,TEMPORARY` from `PUBLIC`, grants database `CONNECT` only to `deployment_login`, `migration_executor`, `app_runtime`, `projection_runtime`, `audit_runtime`, and `key_injector`, and creates exactly one product-visible prerequisite: `CREATE SCHEMA etf AUTHORIZATION schema_owner`. The provisioner is not a product role, is excluded from the product manifest, and creates no table, function, view, trigger, extension, schema grant, default privilege, or other product object. Roles, memberships, the exact database ACL, and the exact empty schema are an allowed prerequisite state, not a migrated state; readiness remains `NotReady` until `0001-foundation` commits its migration row. Only after that prerequisite commits may `deployment_login` connect, `SET ROLE migration_executor`, then `SET ROLE migration_owner` and run the six product migrations. After migration, it resets role, closes the connection, and removes the deployment credential. Every product role remains without `SUPERUSER`, `CREATEROLE`, `CREATEDB`, `REPLICATION`, or `BYPASSRLS`.

Before `0001-foundation` DDL, the runner verifies that schema `etf` exists exactly once, is owned by `schema_owner`, has a null schema ACL, contains no relation or routine, and has no schema-scoped default privilege. Missing, wrong-owner, granted, or contaminated prerequisite state fails with `APPLICATION_MIGRATIONS_INCOMPLETE`; the runner never creates, drops, transfers, or repairs the schema implicitly. During `0001`, `schema_owner` transactionally grants schema `USAGE, CREATE` to `migration_owner` and temporary schema `USAGE, CREATE` to each other required final object owner. Each owner creates its own objects directly under `SET LOCAL ROLE`; all temporary owner grants are revoked before manifest projection and commit, leaving only the closed final `USAGE, CREATE` schema grant to `migration_owner`. A failed `0001` rolls back every table, grant, and migration row while preserving the externally provisioned empty schema prerequisite.

## Closed Migration Set

Migration identities and order are closed and case-sensitive:

| Sequence | Migration identity | Atomic responsibility |
| ---: | --- | --- |
| 1 | `0001-foundation` | Verify the external `etf` schema; create migration ledger, protected keys, and checkpoints |
| 2 | `0002-application` | Replay, watchlist, jobs, checkpoints, readiness/audit storage |
| 3 | `0003-domain-ledger` | Paper orders, transitions, ledger evidence, commitments, anchors, projections |
| 4 | `0004-fixtures` | Fixture packages, descriptors, governed raw sources, observations, ingestion replay |
| 5 | `0005-analytics-evidence` | Input sets, bundles, manifests, retention, replay, and publication references |
| 6 | `0006-controlled-access` | Controlled functions, append-only triggers, grants, and privilege revocation |

Each migration is one transaction under a transaction-scoped advisory lock derived from UTF-8 `etf:v1.0.0-prototype.1:migrations`. Before DDL, the deployment runner verifies the migration identity, ascending sequence, and lowercase SHA-256 of exact UTF-8 SQL bytes. A successful transaction inserts exactly one `schema_migrations` row with `sequence`, `migration_id`, `content_hash`, `applied_at`, and resulting `schema_manifest_hash`. A repeated identical identity/hash is a no-op; a missing, reordered, duplicate, changed, or unknown migration fails readiness with `APPLICATION_MIGRATIONS_INCOMPLETE` and performs no implicit repair.

The schema manifest is the canonical UTF-8 RFC 8785 JSON projection of all `etf` schemas, tables, ordered columns, types, nullability, defaults, primary/foreign/unique/check constraints, indexes, functions, triggers, roles, ownership, database grants, and schema-scoped grants after each migration. NULL database and function ACLs are expanded with PostgreSQL 16 `pg_catalog.acldefault` before projection so implicit `PUBLIC` authority remains visible. The manifest excludes PostgreSQL-generated OIDs and physical storage parameters. The first stored manifest is projected only from the committed post-`0001` state; the provisioner prerequisite has no migration row or manifest hash. Ring 2 migration artifacts must publish the six SQL content hashes and six resulting manifest hashes before execution; until then `CT-DB-001` is a design-time plan, not passing migration evidence.

## Candidate.2 Normative Closure

This section supersedes candidate.1 shorthand such as “owner checks,” “owner FKs,” an imported physical row without columns, and the candidate.1 role table where they conflict.

### Catalog and Migration Deltas

| Migration | Creates or changes exactly |
| --- | --- |
| `0001-foundation` | Schema `etf`; `schema_migrations`, `anchor_keys`, `portfolio_anchor_checkpoints`, `audit_anchor_checkpoints` |
| `0002-application` | `application_replays`, `watchlist_state`, `watchlist_items`, `jobs`, `job_checkpoints`, `readiness_audit`; `application_replay_get_or_put`, `watchlist_write`, `job_start`, `job_restart`, `readiness_append` |
| `0003-domain-ledger` | `paper_orders`, `order_transitions`, `order_command_replays`, `portfolios`, `fills`, `order_audit`, `access_denial_audit`, `ledger_transactions`, `ledger_effects`, `ledger_lots`, `ledger_allocations`, `ledger_reversal_links`, `ledger_command_replays`, `ledger_audit`, `ledger_commitments`, `audit_commitments`, `ledger_anchors`, `portfolio_projections`; `paper_order_transition`, `ledger_append`, `projection_publish`, `audit_append`, `anchor_append`, `anchor_key_inject` |
| `0004-fixtures` | `fixture_packages`, `fixture_descriptors`, `fixture_raw_sources`, `market_observations`, `economic_observations`, `fixture_ingestion_replays`; `fixture_ingest`; the two selection indexes below |
| `0005-analytics-evidence` | `analytics_input_sets`, `analytics_evidence_bundles`, `analytics_manifests`, `analytics_lifecycle_references`, `analytics_deletion_links`, `analytics_retention_bindings`, `analytics_evidence_replays`, `analytics_publications`, `analytics_audit`; `evidence_commit`, `evidence_read`; evidence indexes below |
| `0006-controlled-access` | `reject_immutable_change`; UPDATE/DELETE/TRUNCATE guard triggers for every explicitly listed immutable target; `job_get`, `paper_order_get`, `portfolio_get`; final ownership/grants; only reader views `current_watchlist`, `current_jobs`, `current_paper_orders`, `current_portfolios`, `current_analytics_publications` |

The manifest root is exactly `{contractVersion,systemExtensions,migrationSequence,objects,roleMemberships,grants}`. `systemExtensions` is exactly `[{name:"plpgsql"}]`; it records the PostgreSQL-provided language extension separately from product objects, and any other extension is drift. `migrationSequence` contains only `{sequence,migrationId,contentHash}` in ascending sequence; `schemaManifestHash` is computed from the completed root and stored in `schema_migrations`, never included in its own hash input. Objects are `{kind,schema,name,owner,definitionHash}` sorted by `(kind,schema,name)`, where kind order is `schema,role,table,function,view`; schema is null for schema and role records. `definitionHash` is lowercase SHA-256 of RFC 8785 bytes for exactly one definition record below.

- Schema definition: `{encoding,identifierCollation}`.
- Role definition: `{login,inherit,superuser,bypassRls,createDb,createRole,replication}`.
- Table definition: `{columns,constraints,indexes,triggers}`. Columns are `{ordinal,name,type,collation,nullable,defaultExpression}` in ordinal order. Constraints are `{name,kind,columns,referencedSchema,referencedTable,referencedColumns,onUpdate,onDelete,deferrable,initiallyDeferred,checkExpression}` sorted by name. Indexes are `{name,method,unique,keys,predicate}` sorted by name; each key is `{expression,direction,nulls,collation,opclass}` in ordinal order. Triggers are `{name,timing,events,level,functionSchema,functionName,whenExpression}` sorted by name, with events sorted `INSERT,UPDATE,DELETE,TRUNCATE`.
- Function definition: `{arguments,returns,language,securityDefiner,volatility,parallelSafety,searchPath,bodyHash}`.
- View definition: `{columns,queryHash,securityBarrier}`; columns are `{ordinal,name,type,collation,nullable}` in ordinal order.

Constraint kind is `primaryKey|unique|foreignKey|check`; fields inapplicable to a kind are null, and applicable column arrays retain declared order. Names and types use `pg_catalog` canonical rendering and contract text uses `COLLATE "C"`. Null means no default/reference/predicate/WHEN expression. Parsed default, check, key-expression, predicate, and trigger-WHEN expressions use `pg_get_expr`. Function `bodyHash` is SHA-256 over the complete text returned by PostgreSQL 16 `pg_get_functiondef(to_regprocedure('<schema>.<name>(<pg_catalog argument types>)')::oid)`. View `queryHash` is SHA-256 over the complete text returned by `pg_get_viewdef(to_regclass('<schema>.<name>')::oid,false)`. Each returned text is encoded UTF-8 after converting line endings to LF, removing trailing spaces on each line, and adding exactly one final newline after removing all existing trailing newlines. Memberships are `{role,member,adminOption,inheritOption,setOption}` sorted by `(role,member)` and read from PostgreSQL 16 `pg_auth_members`. Grants are `{objectKind,schema,object,grantee,privilege,grantOption}`, sorted by the tuple shown. Database grants set schema and object null and objectKind `database`; schema grants set schema to `etf` and object null; table/view grants use the unqualified object name; function grants use the unqualified signature such as `audit_append(jsonb)`. Unknown fields, kinds, records, extensions, or objects are drift. Ring 2 supplies actual SQL and definition/root hashes.

### Authority and Protected Integrity

DEC-025 supersedes the earlier owner-grant shorthand in this section: schema `USAGE` is retained for exactly `application_writer_owner`, `ledger_writer_owner`, `projection_owner`, `audit_writer_owner`, `anchor_owner`, and `evidence_writer_owner` after their controlled functions are introduced. Schema `CREATE` is always revoked from those six roles before each migration commits. This minimum namespace lookup is required for their qualified SECURITY DEFINER bodies and does not authorize DDL. The complete schema-USAGE set is therefore those six owner roles plus the four runtime roles already enumerated below; `migration_owner` separately retains `USAGE, CREATE`. No other role or PUBLIC receives schema authority.

Owner roles are `schema_owner`, `migration_owner`, `application_writer_owner`, `ledger_writer_owner`, `projection_owner`, `audit_writer_owner`, `anchor_owner`, and `evidence_writer_owner`; all are `NOLOGIN NOINHERIT` without superuser, create-role/database, replication, or bypass-RLS. Login roles are `deployment_login`, `migration_executor`, `app_runtime`, `projection_runtime`, `audit_runtime`, and deployment-only `key_injector`; all are `LOGIN NOINHERIT` without elevated attributes. No runtime is a member of an owner.

Object ownership is exact. `schema_owner` owns schema `etf`, `reject_immutable_change`, and `current_watchlist`, `current_jobs`, `current_paper_orders`, `current_portfolios`, `current_analytics_publications`. `migration_owner` owns `schema_migrations`. `application_writer_owner` owns `application_replays`, `watchlist_items`, `jobs`, `job_checkpoints`, `readiness_audit`, `paper_orders`, `order_transitions`, `order_command_replays`, `fixture_packages`, `fixture_descriptors`, `fixture_raw_sources`, `market_observations`, `economic_observations`, `fixture_ingestion_replays`, `application_replay_get_or_put`, `watchlist_write`, `job_start`, `job_restart`, `readiness_append`, `paper_order_transition`, `fixture_ingest`, `job_get`, and `paper_order_get`. `ledger_writer_owner` owns `portfolios`, `fills`, `ledger_transactions`, `ledger_effects`, `ledger_lots`, `ledger_allocations`, `ledger_reversal_links`, `ledger_command_replays`, `ledger_commitments`, and `ledger_append`. `projection_owner` owns `portfolio_projections`, `projection_publish`, and `portfolio_get`. `audit_writer_owner` owns `order_audit`, `access_denial_audit`, `ledger_audit`, `audit_commitments`, and `audit_append`. `anchor_owner` owns `anchor_keys`, `portfolio_anchor_checkpoints`, `audit_anchor_checkpoints`, `ledger_anchors`, `anchor_append`, and `anchor_key_inject`. `evidence_writer_owner` owns `analytics_input_sets`, `analytics_evidence_bundles`, `analytics_manifests`, `analytics_lifecycle_references`, `analytics_deletion_links`, `analytics_retention_bindings`, `analytics_evidence_replays`, `analytics_publications`, `analytics_audit`, `evidence_commit`, and `evidence_read`. No object has another owner.

Role memberships are exactly `(migration_executor,deployment_login,false,false,true)`, `(migration_owner,migration_executor,false,false,true)`, `(anchor_owner,migration_owner,false,false,true)`, `(application_writer_owner,migration_owner,false,false,true)`, `(audit_writer_owner,migration_owner,false,false,true)`, `(evidence_writer_owner,migration_owner,false,false,true)`, `(ledger_writer_owner,migration_owner,false,false,true)`, `(projection_owner,migration_owner,false,false,true)`, and `(schema_owner,migration_owner,false,false,true)`, where each tuple is `(role,member,adminOption,inheritOption,setOption)`. PostgreSQL 16 therefore permits connected `deployment_login` to `SET ROLE migration_executor`, then `SET ROLE migration_owner`; migration ownership changes can target every object owner because `migration_owner` may explicitly set each other owner role. No privilege set is inherited implicitly and no member can administer a role. The deployment credential is mounted only for the bootstrap transaction and removed after reset and connection close; time-bounding applies to credential availability, not unmanifested membership. Object grants are exactly: database CONNECT to `deployment_login`, `migration_executor`, `app_runtime`, `projection_runtime`, `audit_runtime`, and `key_injector`; schema USAGE to `app_runtime`, `projection_runtime`, `audit_runtime`, and `key_injector`; SELECT on each of the five reader views to `app_runtime`; EXECUTE on `application_replay_get_or_put(text,uuid,text,text)`, `watchlist_write(text,jsonb)`, `job_start(jsonb)`, `job_restart(jsonb)`, `readiness_append(jsonb)`, `paper_order_transition(jsonb)`, `fixture_ingest(jsonb)`, `evidence_commit(jsonb)`, `evidence_read(text)`, `job_get(uuid)`, `paper_order_get(uuid)`, and `portfolio_get(uuid,timestamptz)` to `app_runtime`; EXECUTE `ledger_append(jsonb)` to `app_runtime`; EXECUTE `projection_publish(jsonb)` to `projection_runtime`; EXECUTE `audit_append(jsonb)` to `audit_runtime` and `projection_owner`; EXECUTE `anchor_append(jsonb)` to `ledger_writer_owner` and `audit_writer_owner`; EXECUTE `anchor_key_inject(text,bytea,timestamptz)` to `key_injector`; schema CREATE and SELECT/INSERT/UPDATE/DELETE on `schema_migrations` to `migration_owner`; SELECT on `portfolios` and `portfolio_projections` to `projection_owner`. No grant has grant option; every unlisted grant is absent.

Controlled function signatures are exactly: `application_replay_get_or_put(text,uuid,text,text) returns jsonb`; `watchlist_write(text,jsonb) returns jsonb`; `job_start(jsonb) returns jsonb`; `job_restart(jsonb) returns jsonb`; `readiness_append(jsonb) returns uuid`; `paper_order_transition(jsonb) returns jsonb`; `ledger_append(jsonb) returns jsonb`; `fixture_ingest(jsonb) returns jsonb`; `evidence_commit(jsonb) returns jsonb`; `evidence_read(text) returns jsonb`; `job_get(uuid) returns jsonb`; `paper_order_get(uuid) returns jsonb`; `portfolio_get(uuid,timestamptz) returns jsonb`; `projection_publish(jsonb) returns jsonb`; `audit_append(jsonb) returns jsonb`; `anchor_append(jsonb) returns jsonb`; `anchor_key_inject(text,bytea,timestamptz) returns void`. All are PL/pgSQL, volatile, parallel unsafe, and SECURITY DEFINER except `evidence_read`, `job_get`, `paper_order_get`, and `portfolio_get`, which are stable, parallel safe, and SECURITY DEFINER. Each fixes `search_path=pg_catalog,etf`.

`evidence_read` is owned by `evidence_writer_owner`, accepts the application candidate.2 opaque String `evidenceId`, verifies authorization, redaction, and bundle hashes, and returns `{evidence: Evidence}` with the complete analytics/evidence candidate.2 Full Evidence Bundle byte-for-byte in owner-defined order. `job_get` is owned by `application_writer_owner` and returns `{job: Job}`, joining the latest committed checkpoint by `(job_id,attempt,sequence DESC)`. `paper_order_get` is owned by `application_writer_owner` and returns `{order: PaperOrder}`, including confirmation and transition history ordered by numeric resulting version then transition command identity. `portfolio_get` is owned by `projection_owner`, accepts `(portfolioId,asOf)`, and returns `{portfolio: Portfolio}` from the authoritative portfolio plus only the latest anchor-verified projection at or before `asOf`, ordered by `as_of DESC,portfolio_version DESC,valuation_snapshot_id`. Each returns one closed application success record or the application error envelope selected by existing precedence, exposes no audit/key/raw-source row, and has no dynamic SQL.

One function `reject_immutable_change() returns trigger` is owned by `schema_owner`, SECURITY DEFINER, and raises SQLSTATE `55000`. Its trigger targets are exactly `anchor_keys`, `audit_anchor_checkpoints`, `application_replays`, `job_checkpoints`, `readiness_audit`, `order_transitions`, `order_command_replays`, `fills`, `order_audit`, `access_denial_audit`, `ledger_transactions`, `ledger_effects`, `ledger_lots`, `ledger_allocations`, `ledger_reversal_links`, `ledger_command_replays`, `ledger_audit`, `ledger_commitments`, `audit_commitments`, `ledger_anchors`, `fixture_packages`, `fixture_descriptors`, `fixture_raw_sources`, `market_observations`, `economic_observations`, `fixture_ingestion_replays`, `analytics_input_sets`, `analytics_evidence_bundles`, `analytics_manifests`, `analytics_lifecycle_references`, `analytics_deletion_links`, `analytics_retention_bindings`, `analytics_evidence_replays`, and `analytics_audit`. For each target, triggers `trg_<table>__reject_update`, `trg_<table>__reject_delete`, and `trg_<table>__reject_truncate` execute it BEFORE the corresponding statement. No other product trigger exists.

`anchor_keys(key_identifier text PK,key_ciphertext bytea,activated_at timestamptz,retired_at timestamptz?)` is anchor-owner-only and key bytes are never returned. `portfolio_anchor_checkpoints(portfolio_id uuid PK,ledger_sequence bigint,portfolio_commitment char(64),audit_sequence bigint,audit_commitment char(64),key_identifier text,checkpoint_hmac char(64),accepted_at timestamptz)` and `audit_anchor_checkpoints(audit_sequence bigint PK,audit_commitment char(64),key_identifier text,checkpoint_hmac char(64),accepted_at timestamptz)` advance only through anchor owner. Key injection is deployment-only and removes the mounted secret after commit.

`audit_append(jsonb)` accepts a closed discriminated payload and executes with `audit_writer_owner` authority. Direct `session_user='audit_runtime'` with domain `Order` routes `IntentRecorded|Rejected` only to `order_audit`; domain `Ledger` routes `IntentRecorded|Rejected|IntegrityFailed|TimeoutRecovery|RecoveryCompleted` only to `ledger_audit`; domain `Denial` routes `PermissionDenied` only to `access_denial_audit`. Nested `session_user='projection_runtime'` with domain `Ledger` routes only `BlockedPublication|PublicationCompleted` to `ledger_audit`; the outer SECURITY DEFINER `projection_publish` executes with `projection_owner` authority, which alone has the required EXECUTE grant. `projection_runtime` has no direct EXECUTE grant on `audit_append`; every other session-user/domain/outcome tuple fails with `42501` before mutation.

Permission denial collection is synchronous and has no queue, worker, or retry scheduler. It applies only to `app_runtime|projection_runtime|audit_runtime|key_injector`, which have NOINHERIT, no role memberships, and no SET ROLE authority. Before the attempted operation, the trusted adapter generates a 128-bit random lowercase-hex `denial_nonce`, sets original-connection `application_name='etf-denial:' || denial_nonce`, and records server-returned PID, backend start, and session user. After `42501`, while that connection remains open, the adapter calls `audit_append` over a separate `audit_runtime` connection. The denial branch reads the original PID in `pg_stat_activity` and requires exact `backend_start`, `usename`, and `application_name`; an absent/reused backend or nonce mismatch fails closed. `authentication_context_digest` hashes RFC 8785 `{actorSubject,backendPid,backendStart,correlationId,denialNonce,sessionUser,workloadIdentity}`; `content_hash` hashes `{actorSubject,authenticationContextDigest,backendPid,backendStart,correlationId,denialCode,denialNonce,deniedAt,domain:"etf.audit.denial.v1",objectClass,objectName,sessionUser,workloadIdentity}`. The deduplication key is `(correlation_id,original_backend_pid,backend_start,denial_nonce,workload_identity,object_class,object_name,denial_code)`: equivalent content returns the existing audit identity; different content returns `ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED` with no mutation. Append failure uses the same code, degrades readiness, and never changes the original denial or grants runtime key/anchor access.

The five views are owned by `schema_owner`, use `security_barrier=true`, and have these complete ordered columns and query definitions: `current_watchlist(instrument_id,display_name,validation_state,position,version)` selects those columns from `etf.watchlist_items`; `current_jobs(job_id,job_type,status,restartability,attempt,created_at,started_at,completed_at,accepted_count,rejected_count)` selects those columns from `etf.jobs`; `current_paper_orders(order_id,state,aggregate_version,research_evidence_id,side,requested_quantity,filled_quantity,open_quantity,unit_price,trade_date)` selects those columns from `etf.paper_orders`; `current_portfolios(portfolio_id,portfolio_version,baseline_version,precision_policy_version)` selects those columns from `etf.portfolios`; `current_analytics_publications(publication_target_id,publication_version,evidence_id,published_at,bundle_hash)` selects those columns from `etf.analytics_publications`. Every query is a plain projection with no predicate, join, ordering, function, or caller-dependent expression.

### Ledger and Audit Records

`ledger_transactions` mandatorily adds `correlation_id uuid`, nullable `transition_command_id uuid`, `precision_policy_version text`, and `baseline_version text`. `fills` is exactly `(portfolio_id uuid,fill_id uuid,order_id uuid,transition_command_id uuid,transaction_id uuid,quantity numeric(28,10),unit_price numeric(28,10),fee numeric(28,8),simulated_at timestamptz)` with PK `(portfolio_id,fill_id)` and unique `(portfolio_id,transaction_id)`.

`order_audit` is exactly `(audit_id uuid PK,attempt_intent_id uuid,order_id uuid,transition_command_id uuid?,action text,outcome text,error_code text?,correlation_id uuid,old_order_version bigint?,new_order_version bigint?,actor_subject text?,workload_identity text,authentication_context_digest char(64),recorded_at timestamptz,evidence_hash char(64))`. `ledger_audit` is exactly the pinned record fields: `audit_id`, `attempt_intent_id`, `portfolio_id`, nullable `transaction_id`/`ledger_sequence`, `action`, `outcome`, nullable `error_code`, `replay_classification`, `correlation_id`, nullable `transition_command_id`, old/new order and portfolio versions, reversal lineage, nullable actor subject, workload identity, authentication-context digest, recorded time, and nullable transaction/allocation/audit evidence hashes. Nullability follows the pinned outcome.

`ledger_commitments` includes `audit_evidence_hash` and `previous_portfolio_commitment`. `audit_commitments` is `(audit_sequence bigint PK,audit_segment_hash char(64),previous_audit_commitment char(64)?,key_identifier text,audit_commitment char(64),anchor_hmac char(64),committed_at timestamptz)`.

`IntentRecorded` commits first in an audit transaction. Ledger success atomically commits order transition, fill when applicable, transaction/effects/allocations/reversal, both replay rows, versions, `Committed` audit, portfolio commitment, anchor, and protected checkpoint. Rejection/`IntegrityFailed` append after rollback; permission denial is collector-driven; timeout/recovery append without rewriting intent. Projection verification later, without an event object, atomically replaces projection and appends/anchors `PublicationCompleted`, or leaves it unchanged and appends/anchors `BlockedPublication`.

### Fixture Physical Closure

`market_observations` preserves every owner field plus package identity. It is exactly `(dataset_id text,dataset_version text,instrument_id text,trading_date date,provider_id text,adjustment_policy text,revision bigint,source_available_at timestamptz,numeric_class text,value_quantity numeric(28,10)?,value_money numeric(28,8)?,value_rate numeric(28,12)?,currency text,raw_source_ref text,raw_source_hash char(64),normalization_id text,ingestion_job_id text,quality_state text,quality_codes text[])`. PK is `(dataset_id,dataset_version,instrument_id,trading_date,provider_id,adjustment_policy,revision)`; UQ is the owner job-idempotency key `(dataset_id,dataset_version,ingestion_job_id,instrument_id,trading_date,provider_id,adjustment_policy,revision)`. Package and `(dataset_id,dataset_version,raw_source_hash)` FKs restrict update/delete. Revision is non-negative including `0`.

`economic_observations` has no currency field and is exactly `(dataset_id text,dataset_version text,provider_id text,series_id text,observation_date date,release_timestamp timestamptz,vintage_id text,numeric_class text,value_quantity numeric(28,10)?,value_money numeric(28,8)?,value_rate numeric(28,12)?,raw_source_ref text,raw_source_hash char(64),normalization_id text,ingestion_job_id text,quality_state text,quality_codes text[])`. PK is `(dataset_id,dataset_version,provider_id,series_id,observation_date,release_timestamp,vintage_id)`; UQ `(dataset_id,dataset_version,provider_id,series_id,observation_date,release_timestamp)` rejects different vintages at one release; the owner job-idempotency UQ adds `ingestion_job_id` before provider identity. Package and raw-source FKs restrict update/delete.

For both tables, `Quantity|UnitPrice` requires only `value_quantity`, `Money` requires only `value_money`, and `Rate` requires only `value_rate`; all other value columns are null. Every populated value is positive-zero canonical and obeys DEC-014 precision, class scale, and workload bound. Market currency is `USD` exactly for `UnitPrice|Money` and the empty string exactly for `Quantity|Rate`. Provider/adjustment/quality allowlists are exactly those in fixture candidate.2. `raw_source_ref` is exactly `raw-sources/` plus `raw_source_hash`; `normalization_id` is nonempty. `quality_codes` is duplicate-free and lexically ascending, empty exactly for `Valid`, and nonempty otherwise.

Selection indexes are btree market `(instrument_id,trading_date,provider_id,adjustment_policy,source_available_at,revision DESC)` and economic `(provider_id,series_id,observation_date,release_timestamp DESC,vintage_id)` with `C` collation on text. Database order never replaces owner selection.

### Exact Constraints

All unspecified columns have no default. Every FK is `MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE`; any null child column exempts that row from the FK comparison. Names are `pk_<table>`, `fk_<child>__<child-columns>__<parent>`, `uq_<table>__<columns>`, `ck_<table>__<rule>`, and `ix_<table>__<columns>`. Indexes are btree with keys in listed order and no predicate unless listed. Cross-row ordinals/chains are enforced by controlled procedures under owner locks and revalidated by CT-DB-001.

`jobs.job_type` is `FixtureIngestion|Analytics`; `operation` is respectively `FixtureIngestionStart|AnalyticsRun`; `status` is `Pending|Running|Succeeded|Failed`; and `restartability` is `Restartable|NotRestartable`. Attempt is at least 1 and counts are non-negative. `Pending` has null `started_at`, `completed_at`, and `controlling_error`; `Running` requires `started_at` and has null completion/error; `Succeeded` requires start/completion and null error; `Failed` requires completion and nonnull controlling error. `readiness_audit.state` is `Ready|NotReady`, `liveness` is `Live|NotLive`, display timezone is `UTC`, and controlling error is null exactly for Ready.

`ledger_transactions.type` is `CashDeposit|CashWithdrawal|BuyFill|SellFill|Reversal`. Cash types require null order/fill/transition/reversal links; fill types require nonnull order/fill/transition and null reversal; Reversal requires nonnull `reverses_transaction_id` unequal to its identity and null fill. `ledger_sequence` is positive. `precision_policy_version='DEC-014'` and `baseline_version='v1.0.0'`.

`order_audit.outcome` is `IntentRecorded|Committed|Rejected`. Intent has null transition/new version/error, Committed requires transition plus old/new versions and null error, and Rejected requires error plus old version and null new version. `ledger_audit.outcome` is `IntentRecorded|Committed|Rejected|IntegrityFailed|BlockedPublication|PublicationCompleted|TimeoutRecovery|RecoveryCompleted`; `error_code` is null for IntentRecorded/Committed/PublicationCompleted/RecoveryCompleted and nonnull otherwise. Committed requires transaction, sequence, new versions, and all three evidence hashes. IntentRecorded and every non-Committed outcome require null transaction/sequence/new versions/transaction and allocation hashes; audit evidence hash is nonnull exactly after its audit commitment exists. Actor subject may be null; workload identity and authentication-context digest never are.

Analytics reproducibility status is `Complete|Degraded`; Complete requires null reason and Degraded requires a nonempty rights-policy identifier. Lifecycle state is `Hot|Archived|Quarantined|DeletionFrozen|ExpiredFrozen|PendingBackupExpiry`; retention target class is `RawEligible|FullBundle|AuditManifest|DeletionCertificate|OperationalMetadata`. `analytics_audit.outcome` is `Committed|Rejected|PermissionDenied`; error code is null exactly for Committed. Its action is one of `EvidenceCommit|EvidenceRead|PublicationReplace|Archive|Restore|Delete|LifecycleAdmin`.

The following is the complete FK registry; every entry uses the global MATCH SIMPLE/RESTRICT/RESTRICT/NOT DEFERRABLE rule, and no unlisted FK exists:

| Child columns | Parent key |
| --- | --- |
| `portfolio_anchor_checkpoints(key_identifier)`; `audit_anchor_checkpoints(key_identifier)`; `audit_commitments(key_identifier)`; `ledger_anchors(key_identifier)` | `anchor_keys(key_identifier)` |
| `portfolio_anchor_checkpoints(portfolio_id,ledger_sequence)` | `ledger_commitments(portfolio_id,ledger_sequence)` |
| `portfolio_anchor_checkpoints(audit_sequence)`; `audit_anchor_checkpoints(audit_sequence)` | `audit_commitments(audit_sequence)` |
| `job_checkpoints(job_id)` | `jobs(job_id)` |
| `order_transitions(order_id)`; `order_command_replays(order_id)` | `paper_orders(order_id)` |
| `fills(order_id,transition_command_id)` | `order_transitions(order_id,transition_command_id)` |
| `ledger_transactions(portfolio_id)`; `ledger_command_replays(portfolio_id)`; `ledger_audit(portfolio_id)`; `ledger_commitments(portfolio_id)`; `ledger_anchors(portfolio_id)`; `portfolio_projections(portfolio_id)` | `portfolios(portfolio_id)` |
| `ledger_transactions(order_id,transition_command_id)` | `order_transitions(order_id,transition_command_id)` |
| `ledger_transactions(portfolio_id,fill_id,transaction_id)` | `fills(portfolio_id,fill_id,transaction_id)` |
| `ledger_effects(portfolio_id,transaction_id)`; `ledger_audit(portfolio_id,transaction_id)`; `ledger_command_replays(portfolio_id,transaction_id)` | `ledger_transactions(portfolio_id,transaction_id)` |
| `ledger_lots(portfolio_id,ledger_sequence)`; `ledger_commitments(portfolio_id,ledger_sequence)` | `ledger_transactions(portfolio_id,ledger_sequence)` |
| `ledger_allocations(portfolio_id,sell_transaction_id,effect_ordinal)` | `ledger_effects(portfolio_id,transaction_id,effect_ordinal)` |
| `ledger_allocations(portfolio_id,lot_id)` | `ledger_lots(portfolio_id,lot_id)` |
| `ledger_reversal_links(portfolio_id,reversal_transaction_id)`; `ledger_reversal_links(portfolio_id,target_transaction_id)` | `ledger_transactions(portfolio_id,transaction_id)` |
| `ledger_anchors(portfolio_id,ledger_sequence)` | `ledger_commitments(portfolio_id,ledger_sequence)` |
| `portfolio_projections(portfolio_id,source_commitment_hash)` | `ledger_commitments(portfolio_id,commitment_hash)` |
| `fixture_descriptors(dataset_id,dataset_version)`; `fixture_raw_sources(dataset_id,dataset_version)`; `market_observations(dataset_id,dataset_version)`; `economic_observations(dataset_id,dataset_version)`; `fixture_ingestion_replays(dataset_id,dataset_version)` | `fixture_packages(dataset_id,dataset_version)` |
| `market_observations(dataset_id,dataset_version,raw_source_hash)`; `economic_observations(dataset_id,dataset_version,raw_source_hash)` | `fixture_raw_sources(dataset_id,dataset_version,raw_source_hash)` |
| `analytics_evidence_bundles(input_set_id)` | `analytics_input_sets(input_set_id)` |
| `analytics_manifests(evidence_id)`; `analytics_lifecycle_references(evidence_id)`; `analytics_deletion_links(evidence_id)`; `analytics_retention_bindings(evidence_id)`; `analytics_evidence_replays(evidence_id)`; `analytics_audit(evidence_id)` | `analytics_evidence_bundles(evidence_id)` |
| `analytics_publications(evidence_id,bundle_hash)` | `analytics_evidence_bundles(evidence_id,bundle_hash)` |
| `analytics_audit(publication_target_id)` | `analytics_publications(publication_target_id)` |

Supporting referenced keys are exactly `UQ(fills: portfolio_id,fill_id,transaction_id)`, `UQ(ledger_commitments: portfolio_id,commitment_hash)`, and `UQ(analytics_evidence_bundles: evidence_id,bundle_hash)`. Controlled procedures lock parents before children in the registry's displayed dependency direction; the fill is inserted before its transaction, avoiding a cyclic immediate FK.

### Analytics and Retention Closure

Manifest canonical content preserves every candidate.2 field, ordered lifecycle references, and deletion links. Children are `analytics_lifecycle_references(evidence_id,lifecycle_sequence,state,event_at,event_hash)` and `analytics_deletion_links(evidence_id,deletion_certificate_id,target_class,certificate_hash)`, with owner keys/order and immutable restricted FKs. Retention is `(evidence_id,retention_epoch,target_class,retain_through,lifecycle_state,retention_policy_version)` keyed by the first three fields. Deadlines are RawEligible 90, FullBundle 730, AuditManifest 1825, DeletionCertificate 1825, and OperationalMetadata 365 days from the owner anchor; later immutable epochs may extend, never shorten.

Evidence commit verifies exact owner canonical bytes and all hashes before insert. Publication references `(evidence_id,bundle_hash)` and requires `Complete`, null reason, unexpired retention, verified manifest/chain, and expected version in one transaction. Failure exposes no partial bundle or replacement.

### Pre-Cast and JSON Closure

Controlled functions validate UTF-8 text before cast. Fixture negative zero is rejected; ledger negative zero normalizes to positive zero before persistence; analytics follows pinned canonicalization. Quantity/unit value, money, and rate use exact scales 10/8/12 and precision 28 with owner bounds. Grammar rejects whitespace, plus, exponent, NaN/infinity, omitted digits, and excess scale. UTC instants accept exactly `YYYY-MM-DDTHH:mm:ss.SSSZ`; other offsets and overprecision fail before `timestamptz(3)` cast. Generated time is captured once per attempt; replay-stable owner time is supplied by the injected clock.

The exhaustive column-to-record/hash-domain registry under Numeric, Time, and JSON Constraints controls every JSON column; there is no category fallback or unnamed record binding.

### Job and Readiness Closure

`job_checkpoints` adds `effect_domain text`, `first_effect_identity text`, `last_effect_identity text`, and `effect_count bigint`; the canonical ordered range commits with exactly those effects. Job CHECKs enumerate status/type/restartability, attempt, timestamp-nullability, and controlling-error rules. Restart uses `FOR UPDATE`, replay lookup before state checks, and one transaction. Wrong state/policy returns `APPLICATION_JOB_NOT_RESTARTABLE`; conflicting replay returns `APPLICATION_IDEMPOTENCY_CONFLICT`; pre-commit crash changes nothing and post-commit retry returns replay.

Database readiness covers PostgreSQL and Migrations. `readiness_append` persists the complete application snapshot only in order PostgreSQL, Migrations, FixturePolicy, LocalDependency, DenialAudit, LedgerIntegrity. Connectivity/drift use application database/migration codes; denial audit and protected checkpoint failure preserve analytics/ledger codes. Liveness remains orthogonal.

## Closed Physical Manifest

Notation: `!` means NOT NULL, `?` means nullable, `PK(...)`, `FK(...)`, and `UQ(...)` are database constraints. Every `timestamptz` token in the closure and manifest means PostgreSQL `timestamp(3) with time zone`; no product column uses unspecified timestamp precision. Every table includes only the ordered columns shown. Unknown columns, tables, functions, triggers, roles, or grants are schema drift.

### Foundation and Application

| Table | Ordered columns and constraints |
| --- | --- |
| `schema_migrations` | `sequence bigint! PK`, `migration_id text! UQ`, `content_hash char(64)!`, `applied_at timestamptz!`, `schema_manifest_hash char(64)!`; positive contiguous sequence and lowercase hashes |
| `anchor_keys` | `key_identifier text! PK`, `key_ciphertext bytea!`, `activated_at timestamptz!`, `retired_at timestamptz?`; anchor-owner-only, immutable key bytes |
| `portfolio_anchor_checkpoints` | `portfolio_id uuid! PK`, `ledger_sequence bigint!`, `portfolio_commitment char(64)!`, `audit_sequence bigint!`, `audit_commitment char(64)!`, `key_identifier text!`, `checkpoint_hmac char(64)!`, `accepted_at timestamptz!`; anchor-owner advance-only |
| `audit_anchor_checkpoints` | `audit_sequence bigint! PK`, `audit_commitment char(64)!`, `key_identifier text!`, `checkpoint_hmac char(64)!`, `accepted_at timestamptz!`; anchor-owner append-only |
| `application_replays` | `operation text!`, `command_id uuid!`, `canonical_content jsonb!`, `result_envelope jsonb!`, `created_at timestamptz!`; `PK(operation,command_id)`; canonical content/result validated before insert and immutable |
| `watchlist_state` | `singleton boolean! PK`, `version bigint!`; exactly one seeded `true` row, non-negative version, locked by `watchlist_write` for atomic expected-version compare-and-set |
| `watchlist_items` | `instrument_id text! PK`, `display_name text!`, `validation_state text!`, `position bigint! UQ`, `version bigint!`; non-empty text, state `Valid|Invalid`, non-negative position/version |
| `jobs` | `job_id uuid! PK`, `job_type text!`, `status text!`, `restartability text!`, `attempt bigint!`, `operation text!`, `original_command_id uuid!`, `input_identity jsonb!`, `created_at timestamptz!`, `started_at timestamptz?`, `completed_at timestamptz?`, `accepted_count bigint!`, `rejected_count bigint!`, `controlling_error jsonb?`; job value/nullability matrix above, attempt >= 1, counts >= 0 |
| `job_checkpoints` | `job_id uuid!`, `checkpoint_id uuid!`, `attempt bigint!`, `sequence bigint!`, `committed_at timestamptz!`, `content_hash char(64)!`, `effect_domain text!`, `first_effect_identity text!`, `last_effect_identity text!`, `effect_count bigint!`; `PK(job_id,checkpoint_id)`, `UQ(job_id,attempt,sequence)`, FK registry entry to jobs, positive attempt, non-negative sequence/count, immutable |
| `readiness_audit` | `readiness_id uuid! PK`, `state text!`, `checked_at timestamptz!`, `display_timezone text!`, `liveness text!`, `dependencies jsonb!`, `controlling_error jsonb?`; readiness value/nullability and JSON registries, immutable |

### Paper Order and Ledger

| Table | Ordered columns and constraints |
| --- | --- |
| `paper_orders` | `order_id uuid! PK`, `state text!`, `aggregate_version bigint!`, `research_evidence_id uuid!`, `side text!`, `requested_quantity numeric(28,10)!`, `filled_quantity numeric(28,10)!`, `open_quantity numeric(28,10)!`, `unit_price numeric(28,10)!`, `trade_date date!`, `confirmation jsonb?`; state `Draft|Submitted|Accepted|Partial|Filled|Rejected|Canceled|Expired`, side `Buy|Sell`, non-negative values/version, requested = filled + open |
| `order_transitions` | `order_id uuid!`, `transition_command_id uuid!`, `transition text!`, `source_state text!`, `target_state text!`, `trigger text!`, `normalized_payload jsonb!`, `occurred_at timestamptz!`, `actor_id text!`, `correlation_id uuid!`, `prior_version bigint!`, `resulting_version bigint!`, `baseline_version text!`; `PK(order_id,transition_command_id)`, `UQ(order_id,resulting_version)`, `FK(order_id)->paper_orders`, resulting = prior + 1, immutable |
| `order_command_replays` | `order_id uuid!`, `transition_command_id uuid!`, `canonical_content jsonb!`, `result jsonb!`, `created_at timestamptz!`; `PK(order_id,transition_command_id)`, immutable |
| `portfolios` | `portfolio_id uuid! PK`, `portfolio_version bigint!`, `baseline_version text!`, `precision_policy_version text!`; non-negative version, exact candidate versions |
| `fills` | `portfolio_id uuid!`, `fill_id uuid!`, `order_id uuid!`, `transition_command_id uuid!`, `transaction_id uuid!`, `quantity numeric(28,10)!`, `unit_price numeric(28,10)!`, `fee numeric(28,8)!`, `simulated_at timestamptz!`; `PK(portfolio_id,fill_id)`, `UQ(portfolio_id,transaction_id)`, `UQ(portfolio_id,fill_id,transaction_id)`, registry FK to order transition, positive quantity/price and non-negative fee, immutable; the transaction points to the preinserted fill |
| `order_audit` | `audit_id uuid! PK`, `attempt_intent_id uuid!`, `order_id uuid!`, `transition_command_id uuid?`, `action text!`, `outcome text!`, `error_code text?`, `correlation_id uuid!`, `old_order_version bigint?`, `new_order_version bigint?`, `actor_subject text?`, `workload_identity text!`, `authentication_context_digest char(64)!`, `recorded_at timestamptz!`, `evidence_hash char(64)!`; order-audit matrix above, immutable |
| `access_denial_audit` | `audit_id uuid! PK`, `correlation_id uuid!`, `original_backend_pid integer!`, `backend_start timestamptz!`, `original_session_user text!`, `denial_nonce char(32)!`, `actor_subject text?`, `workload_identity text!`, `authentication_context_digest char(64)!`, `object_class text!`, `object_name text!`, `denial_code text!`, `denied_at timestamptz!`, `content_hash char(64)!`; `UQ(correlation_id,original_backend_pid,backend_start,denial_nonce,workload_identity,object_class,object_name,denial_code)`, object class `table|function|schema|role`, denial code `PermissionDenied`, lowercase nonce/digests, immutable |
| `ledger_transactions` | `portfolio_id uuid!`, `transaction_id uuid!`, `ledger_sequence bigint!`, `type text!`, `effective_at timestamptz!`, `recorded_at timestamptz!`, `order_id uuid?`, `fill_id uuid?`, `correlation_id uuid!`, `transition_command_id uuid?`, `precision_policy_version text!`, `baseline_version text!`, `reverses_transaction_id uuid?`, `evidence_hash char(64)!`; `PK(portfolio_id,transaction_id)`, `UQ(portfolio_id,ledger_sequence)`, transaction type/link matrix above, immutable |
| `ledger_effects` | `portfolio_id uuid!`, `transaction_id uuid!`, `effect_ordinal bigint!`, `effect_type text!`, `instrument_id text?`, `lot_id uuid?`, `source_effect_id uuid?`, `quantity numeric(28,10)?`, `money numeric(28,8)?`, `rate numeric(28,12)?`; `PK(portfolio_id,transaction_id,effect_ordinal)`, FK registry entry to transaction, non-negative contiguous ordinal, owner canonical effect validation before insert, immutable |
| `ledger_lots` | `portfolio_id uuid!`, `lot_id uuid!`, `instrument_id text!`, `acquired_at timestamptz!`, `ledger_sequence bigint!`, `original_quantity numeric(28,10)!`, `original_basis numeric(28,8)!`; `PK(portfolio_id,lot_id)`, FK registry entry to transaction sequence, FIFO index below, immutable originals |
| `ledger_allocations` | `portfolio_id uuid!`, `sell_transaction_id uuid!`, `effect_ordinal bigint!`, `lot_id uuid!`, `consumed_quantity numeric(28,10)!`, `allocated_basis numeric(28,8)!`; `PK(portfolio_id,sell_transaction_id,effect_ordinal,lot_id)`, FK registry entries to effect and lot, positive quantity and non-negative basis, immutable |
| `ledger_reversal_links` | `portfolio_id uuid!`, `reversal_transaction_id uuid!`, `target_transaction_id uuid!`; `PK(portfolio_id,reversal_transaction_id)`, `UQ(portfolio_id,target_transaction_id,reversal_transaction_id)`, two FK registry entries to ledger transactions, unequal identities, immutable |
| `ledger_command_replays` | `portfolio_id uuid!`, `transaction_id uuid!`, `canonical_content jsonb!`, `result jsonb!`, `created_at timestamptz!`; `PK(portfolio_id,transaction_id)`, immutable |
| `ledger_audit` | `audit_id uuid! PK`, `attempt_intent_id uuid!`, `portfolio_id uuid!`, `transaction_id uuid?`, `ledger_sequence bigint?`, `action text!`, `outcome text!`, `error_code text?`, `replay_classification text!`, `correlation_id uuid!`, `transition_command_id uuid?`, `old_order_version bigint?`, `new_order_version bigint?`, `old_portfolio_version bigint?`, `new_portfolio_version bigint?`, `reverses_transaction_id uuid?`, `reversed_by_transaction_id uuid?`, `actor_subject text?`, `workload_identity text!`, `authentication_context_digest char(64)!`, `recorded_at timestamptz!`, `transaction_evidence_hash char(64)?`, `allocation_evidence_hash char(64)?`, `audit_evidence_hash char(64)?`; ledger-audit matrix above, immutable |
| `ledger_commitments` | `portfolio_id uuid!`, `ledger_sequence bigint!`, `transaction_evidence_hash char(64)!`, `allocation_evidence_hash char(64)!`, `audit_evidence_hash char(64)!`, `previous_portfolio_commitment char(64)?`, `commitment_hash char(64)!`; `PK(portfolio_id,ledger_sequence)`, `UQ(portfolio_id,commitment_hash)`, immutable chain |
| `audit_commitments` | `audit_sequence bigint! PK`, `audit_segment_hash char(64)!`, `previous_audit_commitment char(64)?`, `key_identifier text!`, `audit_commitment char(64)!`, `anchor_hmac char(64)!`, `committed_at timestamptz!`; immutable audit chain |
| `ledger_anchors` | `portfolio_id uuid!`, `ledger_sequence bigint!`, `key_identifier text!`, `commitment_hash char(64)!`, `anchor_hmac char(64)!`, `accepted_at timestamptz!`; `PK(portfolio_id,ledger_sequence)`, anchor-owner only, immutable |
| `portfolio_projections` | `portfolio_id uuid!`, `valuation_snapshot_id uuid!`, `portfolio_version bigint!`, `as_of timestamptz!`, `cash numeric(28,8)!`, `lots jsonb!`, `positions jsonb!`, `realized_pnl numeric(28,8)!`, `total_equity numeric(28,8)!`, `reconciliation_state text!`, `source_commitment_hash char(64)!`; `PK(portfolio_id,valuation_snapshot_id)`, controlled replace only after anchor verification |

### Fixture Input

| Table | Ordered columns and constraints |
| --- | --- |
| `fixture_packages` | `dataset_id text!`, `dataset_version text!`, `dataset_hash char(64)!`, `manifest jsonb!`, `accepted_at timestamptz!`; `PK(dataset_id,dataset_version)`, `UQ(dataset_hash)`, immutable |
| `fixture_descriptors` | `dataset_id text!`, `dataset_version text!`, `path text!`, `media_type text!`, `byte_length bigint!`, `content_hash char(64)!`, `ordinal bigint!`; `PK(dataset_id,dataset_version,path)`, `UQ(dataset_id,dataset_version,ordinal)`, FK registry entry to package, normalized relative path, closed media type, non-negative length/ordinal, lowercase hash, immutable |
| `fixture_raw_sources` | `dataset_id text!`, `dataset_version text!`, `raw_source_hash char(64)!`, `content bytea!`, `byte_length bigint!`; `PK(dataset_id,dataset_version,raw_source_hash)`, exact length/hash, immutable |
| `market_observations` | `dataset_id text!`, `dataset_version text!`, `instrument_id text!`, `trading_date date!`, `provider_id text!`, `adjustment_policy text!`, `revision bigint!`, `source_available_at timestamptz!`, `numeric_class text!`, `value_quantity numeric(28,10)?`, `value_money numeric(28,8)?`, `value_rate numeric(28,12)?`, `currency text!`, `raw_source_ref text!`, `raw_source_hash char(64)!`, `normalization_id text!`, `ingestion_job_id text!`, `quality_state text!`, `quality_codes text[]!`; exact PK/UQs/FKs/class matrix and selection index above, immutable |
| `economic_observations` | `dataset_id text!`, `dataset_version text!`, `provider_id text!`, `series_id text!`, `observation_date date!`, `release_timestamp timestamptz!`, `vintage_id text!`, `numeric_class text!`, `value_quantity numeric(28,10)?`, `value_money numeric(28,8)?`, `value_rate numeric(28,12)?`, `raw_source_ref text!`, `raw_source_hash char(64)!`, `normalization_id text!`, `ingestion_job_id text!`, `quality_state text!`, `quality_codes text[]!`; exact PK/UQs/FKs/class matrix and selection index above, immutable |
| `fixture_ingestion_replays` | `dataset_id text!`, `dataset_version text!`, `job_id uuid!`, `canonical_content jsonb!`, `result jsonb!`, `created_at timestamptz!`; `PK(dataset_id,dataset_version,job_id)`, immutable |

### Analytics and Evidence

| Table | Ordered columns and constraints |
| --- | --- |
| `analytics_input_sets` | `input_set_id text! PK`, `input_schema_version text!`, `evaluation_at timestamptz!`, `canonical_content jsonb!`, `input_hash char(64)!`, `portfolio_context_hash char(64)!`; immutable |
| `analytics_evidence_bundles` | `evidence_id text! PK`, `evidence_schema_version text!`, `baseline_version text!`, `input_set_id text!`, `evaluation_at timestamptz!`, `reproducibility_status text!`, `reason text?`, `configuration jsonb!`, `result jsonb!`, `input_hash char(64)!`, `configuration_hash char(64)!`, `result_hash char(64)!`, `bundle_hash char(64)!`; `UQ(evidence_id,bundle_hash)`, FK/value/JSON registries, lowercase hashes, immutable |
| `analytics_manifests` | `manifest_id text! PK`, `manifest_sequence bigint! UQ`, `previous_manifest_hash char(64)?`, `evidence_id text!`, `retention_policy_version text!`, `retention_epoch bigint!`, `canonical_content jsonb!`, `manifest_hash char(64)!`; FK/JSON registries, positive contiguous sequence, first predecessor null and later predecessor required, lowercase hashes, immutable |
| `analytics_lifecycle_references` | `evidence_id text!`, `lifecycle_sequence bigint!`, `state text!`, `event_at timestamptz!`, `event_hash char(64)!`; `PK(evidence_id,lifecycle_sequence)`, owner order, immutable |
| `analytics_deletion_links` | `evidence_id text!`, `deletion_certificate_id text!`, `target_class text!`, `certificate_hash char(64)!`; `PK(evidence_id,deletion_certificate_id)`, immutable |
| `analytics_retention_bindings` | `evidence_id text!`, `retention_epoch bigint!`, `target_class text!`, `retain_through timestamptz!`, `lifecycle_state text!`, `retention_policy_version text!`; `PK(evidence_id,retention_epoch,target_class)`, immutable history |
| `analytics_evidence_replays` | `evidence_id text!`, `evidence_commit_command_id uuid!`, `canonical_content jsonb!`, `result jsonb!`, `created_at timestamptz!`; `PK(evidence_id,evidence_commit_command_id)`, immutable |
| `analytics_publications` | `publication_target_id text! PK`, `publication_version bigint!`, `evidence_id text!`, `published_at timestamptz!`, `bundle_hash char(64)!`; UQ `(evidence_id,bundle_hash)`, FK registry entry to evidence bundle, controlled procedure requires Complete/null-reason/hash-verified/unexpired evidence, non-negative optimistic version, current reference only |
| `analytics_audit` | `audit_id uuid! PK`, `evidence_id text?`, `publication_target_id text?`, `action text!`, `outcome text!`, `error_code text?`, `created_at timestamptz!`, `audit_hash char(64)!`; analytics-audit matrix above, at least one bounded identity required, lowercase hash, immutable |

Fixture market/economic fields are expanded in Candidate.2 Fixture Physical Closure and normatively preserve fixture `1.0.0-candidate.2`; JSON-blob substitution is prohibited.

## Required Indexes and Ordering

Primary/unique constraints create their required indexes. Additional indexes are exactly: jobs `(status,job_id)`; checkpoints `(job_id,attempt,sequence)`; order history `(order_id,resulting_version)`; ledger sequence `(portfolio_id,ledger_sequence)`; FIFO lots `(portfolio_id,instrument_id,acquired_at,ledger_sequence,lot_id)`; fixture market selection on its owner identity plus availability/revision; fixture economic selection on its owner identity plus release/vintage ordering; evidence manifest `(evidence_id,manifest_sequence)`; retention `(evidence_id,retention_epoch)`; and publication `(evidence_id)`. Queries must still state owner ordering; an index or heap order never defines business order.

## Numeric, Time, and JSON Constraints

Quantity/unit-price columns are `numeric(28,10)`, money is `numeric(28,8)`, and rate/ratio/weight is `numeric(28,12)`. Controlled writers receive canonical text and reject before cast: ledger grammar with `LEDGER_INVALID_DECIMAL`, ledger excess scale with `LEDGER_EXCESS_SCALE`, ledger precision/workload overflow with `LEDGER_BOUND_EXCEEDED`, fixture grammar/scale/precision/class with `FIXTURE_DECIMAL_INVALID`, and analytics grammar/scale/precision/class with `ANALYTICS_NUMERIC_CLASS_INVALID`. Fixture negative zero rejects with `FIXTURE_DECIMAL_INVALID`; ledger and analytics negative zero normalize to positive zero. SQL never accepts binary floating point, exponent notation, input rounding, or unchecked cast as owner-valid input.

Every product timestamp is `timestamp(3) with time zone`, UTC, and millisecond-exact. Supplied `createdAt|occurredAt|effectiveAt|simulatedAt|checkedAt` command paths reject malformed text before dispatch with `APPLICATION_REQUEST_INVALID`; fixture `sourceAvailableAt|releaseTimestamp` rejects with `FIXTURE_TEMPORAL_INVALID`; analytics `evaluationAt|eventAt` rejects with `ANALYTICS_INPUT_INCOMPLETE`. `recordedAt|acceptedAt|publishedAt|deniedAt|backendStart` are database-observed/generated and never caller-supplied. Database-generated owner timestamps use `clock_timestamp()` truncated to milliseconds once; replay-stable time uses the injected application value.

Every `jsonb` column has exactly one schema/hash binding:

| Column | Closed owner record | Hash domain or treatment |
| --- | --- | --- |
| `application_replays.canonical_content` | Application canonical command selected by `operation` | RFC 8785 application idempotency bytes; hash is implicit in equality, not a stored digest |
| `application_replays.result_envelope` | Application `ResultEnvelope` | No independent digest; validated result bytes are replayed unchanged |
| `jobs.input_identity` | `FixtureInputIdentity` when FixtureIngestion; `AnalyticsInputIdentity` when Analytics | No independent digest; closed discriminated record |
| `jobs.controlling_error`; `readiness_audit.controlling_error` | Application `Error` | No independent digest; nullable only by status/readiness matrix |
| `readiness_audit.dependencies` | Ordered application `ReadinessDependency[]` | No independent digest; fixed six-entry order |
| `paper_orders.confirmation` | Domain confirmation record for the selected transition | No independent digest; nullable only when that transition requires none |
| `order_transitions.normalized_payload` | Domain `TransitionPayload` selected by `transition` | Included in domain command canonical bytes |
| `order_command_replays.canonical_content`; `order_command_replays.result` | Domain canonical transition command; domain transition result | Domain idempotency bytes; no separate stored digest |
| `ledger_command_replays.canonical_content`; `ledger_command_replays.result` | Ledger canonical command; ledger result | Ledger idempotency bytes; no separate stored digest |
| `portfolio_projections.lots`; `portfolio_projections.positions` | Ledger rebuilt ordered lot array; instrument-keyed position array | Covered by `source_commitment_hash` verification |
| `fixture_packages.manifest` | Fixture `DatasetManifest` | `etf.fixture.dataset.v1` |
| `fixture_ingestion_replays.canonical_content`; `fixture_ingestion_replays.result` | Fixture ingestion command; fixture conformance result | Dataset hash domain for package content; replay equality for command/result |
| `analytics_input_sets.canonical_content` | Analytics immutable input set | `etf.analytics.input.v1` |
| `analytics_evidence_bundles.configuration` | Analytics configuration | `etf.analytics.configuration.v1` |
| `analytics_evidence_bundles.result` | Analytics result | `etf.analytics.result.v1` |
| `analytics_manifests.canonical_content` | Analytics manifest | `etf.analytics.manifest.v1` |
| `analytics_evidence_replays.canonical_content`; `analytics_evidence_replays.result` | Analytics evidence command; evidence result | Command replay equality; result carries bundle domain `etf.analytics.bundle.v1` |

Unknown/duplicate fields, wrong record variants, or malformed domain JSON fail before dispatch with `APPLICATION_REQUEST_INVALID`. Structurally valid domain commands use `ORDER_IDEMPOTENCY_CONFLICT` for changed replay content, `ORDER_VERSION_CONFLICT` for stale version, `ORDER_UNKNOWN_STATE` for unknown state, `ORDER_TERMINAL_STATE` for a terminal source, `ORDER_INVALID_TRANSITION` for an unlisted nonterminal transition, and `ORDER_GUARD_FAILED` for a listed transition whose guard fails. Fixture manifest/replay JSON failures use `FIXTURE_MANIFEST_INVALID`; analytics input/configuration/result/manifest structural or hash mismatch uses `ANALYTICS_INTEGRITY_FAILED`. PostgreSQL `jsonb` rendering is never hashed.

## Role and Grant Matrix

Candidate.2 Authority and Protected Integrity is the only role/membership/grant model. `PUBLIC` has no privilege; login runtimes have no direct base-table mutation, sequence, trigger, DDL, ownership, role-administration, protected-key, or anchor authority. Every `SECURITY DEFINER` function revokes PUBLIC execution, fixes `search_path` to `pg_catalog,etf`, fully qualifies product objects, validates text before cast/DML, and contains no caller-derived dynamic SQL.

## Immutability and Atomicity

Append-only tables are application replay, checkpoints, transitions, owner replay tables, every ledger evidence/anchor table, fixture package/content/observation tables, analytics input/evidence/manifest/retention/replay/audit tables, and readiness audit. Statement-level triggers reject UPDATE, DELETE, and TRUNCATE even by normal writer roles. Migration and anchor authority remain separately governed; corrections use new owner-authorized reversal/lifecycle rows.

Atomic visibility boundaries are:

1. Paper transition: application/domain replay, authoritative order state/version, one transition, and success audit.
2. Fill/ledger: order/fill state, portfolio version, transaction/effects/allocations/reversal links, deduplication, audit, commitment, and protected anchor.
3. Fixture ingestion checkpoint: accepted package/observation batch, counts, replay, and committed checkpoint.
4. Analytics publication: complete input/configuration/result/bundle/manifest/retention/audit, replay, and versioned current publication reference.
5. Job restart: application replay, same job identity/input/checkpoint, incremented attempt, and Pending status.

A failure rolls back the complete boundary. Rejection/audit evidence written after rollback is a separate controlled transaction and cannot claim business commit. No transaction inserts an outbox/event row or delegates completion to a delayed consumer.

## Job Durability and Readiness

Jobs persist the exact application `Job` record and legal transitions. A committed checkpoint references only effects committed in the same transaction. Restart locks the job, verifies `Failed` and `Restartable`, increments attempt once, retains input/original identity and checkpoint, writes application replay, and transitions to `Pending`; duplicate application replay returns the original result.

Database readiness is `Ready` only when connectivity succeeds, server baseline settings match, all six migration identities/hashes are present in order, the latest manifest hash matches live catalog projection, and the closed role/grant matrix matches. Connectivity failure returns `APPLICATION_DATABASE_UNAVAILABLE`; any missing, extra, changed, reordered, partially applied, or incompatible migration/object/role/grant returns `APPLICATION_MIGRATIONS_INCOMPLETE`. Readiness never repairs, downgrades, drops, or rewrites schema.

Because no active populated baseline exists, `CT-DB-002` remains guard-triggered. Any claim of upgrade compatibility, first baseline activation followed by change, or populated migration promotes CT-DB-002 before migration acceptance.

## CT-DB-001 Conformance Plan

`specs/features/PostgreSQL-Contract-Conformance.feature` is the design-time specification:

| Scenario | Contract behavior |
| --- | --- |
| `CT-DB-001A` | Exact empty bootstrap and closed catalog manifest |
| `CT-DB-001B` | Idempotent replay and fail-closed drift detection |
| `CT-DB-001C` | Transactional migration rollback |
| `CT-DB-001D` | Deny-by-default roles and hardened controlled functions |
| `CT-DB-001E` | Exact DEC-014 PostgreSQL numeric types and pre-cast rejection |
| `CT-DB-001F` | Atomic paper state, replay, history, and audit |
| `CT-DB-001G` | Immutable anchored ledger and verified projection publication |
| `CT-DB-001H` | Fixture identity, provenance, order, and DQ preservation |
| `CT-DB-001I` | Complete evidence atomic publication and owner failures |
| `CT-DB-001J` | Durable job/checkpoint restart without duplicate effects |
| `CT-DB-001K` | Connectivity, migration, catalog, and role readiness |
| `CT-DB-001L` | No durable handoff and guarded CT-DB-002 |

Ring 2 must execute these against a newly created PostgreSQL 16 database with fixed clocks/identities and separately inspect `pg_catalog`. It must also execute retained CT-LED PostgreSQL vectors and owner fixture/analytics hash checks. Until then this plan is not passing executable evidence.

## Traceability and Invalidation

| Authority | Binding |
| --- | --- |
| Issue #21 / DEC-022 / REV-017..019 | Expected canonical bounded durable store and empty migration plan |
| O-CST-007 / O-REQ-009 / O-MET-008 | PostgreSQL target, clean bootstrap, migration/connectivity readiness |
| O-REQ-003 / O-REQ-007 / O-MET-006 | Durable jobs, failure visibility, restart, least privilege |
| DEC-014 / ledger candidate.2 | Exact numeric types, immutable/reversing FIFO evidence, reconciliation, anchors |
| Fixture candidate.2 | Package/provenance/business identity/order/DQ preservation |
| Analytics/evidence candidate.2 | Complete evidence, retention, replay, hashes, atomic publication |
| Application candidate.2 | Replay/jobs/readiness records, opaque evidence identity, and unchanged stable errors |

Any migration identity/order/hash rule, PostgreSQL baseline, object manifest, column/type/nullability, key/constraint/index, role/grant, function/trigger, transaction boundary, imported owner version, readiness rule, or event absence change requires candidate classification, Team Lead custody, independent verification, inventory/registry synchronization, and OpenAPI/application impact assessment.

## Candidate Checklist

- [x] Empty bootstrap, replay, drift, and rollback semantics are explicit.
- [x] Physical durable classes and owner imports are inventoried.
- [x] Keys, exact numerics, immutability, ordering, and atomic visibility are explicit.
- [x] Role/grant and controlled-function authority is deny by default.
- [x] Jobs/checkpoints and readiness survive process restart without event scope.
- [x] `CT-DB-001A..L` is a named design-time conformance plan.
- [ ] Six executable migration byte hashes and resulting manifest hashes exist in Ring 2.
- [x] Distinct Team Lead custody review passes.
- [x] Independent alternate-role verification passes with no unresolved Critical or Major finding.

## Boundary

This inactive planning candidate does not create SQL migrations, a database, executable tests, deployment authority, or an active baseline. It does not satisfy aggregate `PT-CONTRACT-001`, unblock STORE/API/PROVIDER/STREAMS guards, define HTTP, authorize implementation/dependencies/events/parallel work, accept Proposed architecture, close #21, or advance Ring 2.
