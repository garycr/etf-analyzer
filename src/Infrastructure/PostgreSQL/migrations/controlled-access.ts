import type { MigrationArtifact } from "../migration-set.js";

export const controlledAccessFunctionNames = [
  "reject_immutable_change",
  "application_replay_get",
  "job_get",
  "paper_order_command_get",
  "paper_order_get",
  "portfolio_get",
] as const;

export const controlledAccessViewNames = [
  "current_watchlist",
  "current_jobs",
  "current_paper_orders",
  "current_portfolios",
  "current_analytics_publications",
] as const;

export const controlledAccessImmutableTableNames = [
  "anchor_keys",
  "audit_anchor_checkpoints",
  "application_replays",
  "job_checkpoints",
  "readiness_audit",
  "order_transitions",
  "order_command_replays",
  "fills",
  "order_audit",
  "access_denial_audit",
  "ledger_transactions",
  "ledger_effects",
  "ledger_lots",
  "ledger_allocations",
  "ledger_reversal_links",
  "ledger_command_replays",
  "ledger_audit",
  "ledger_commitments",
  "audit_commitments",
  "ledger_anchors",
  "fixture_packages",
  "fixture_descriptors",
  "fixture_raw_sources",
  "market_observations",
  "economic_observations",
  "fixture_ingestion_replays",
  "analytics_provider_policy_admission",
  "analytics_input_sets",
  "analytics_evidence_bundles",
  "analytics_manifests",
  "analytics_lifecycle_references",
  "analytics_deletion_links",
  "analytics_retention_bindings",
  "analytics_evidence_replays",
  "analytics_audit",
] as const;

type ImmutableOwner =
  | "anchor_owner"
  | "application_writer_owner"
  | "audit_writer_owner"
  | "evidence_writer_owner"
  | "ledger_writer_owner";

const immutableOwners: Readonly<Record<ImmutableOwner, readonly string[]>> = {
  anchor_owner: [
    "anchor_keys",
    "audit_anchor_checkpoints",
    "ledger_anchors",
  ],
  application_writer_owner: [
    "application_replays",
    "job_checkpoints",
    "readiness_audit",
    "order_transitions",
    "order_command_replays",
    "fixture_packages",
    "fixture_descriptors",
    "fixture_raw_sources",
    "market_observations",
    "economic_observations",
    "fixture_ingestion_replays",
  ],
  audit_writer_owner: [
    "order_audit",
    "access_denial_audit",
    "ledger_audit",
    "audit_commitments",
  ],
  evidence_writer_owner: [
    "analytics_provider_policy_admission",
    "analytics_input_sets",
    "analytics_evidence_bundles",
    "analytics_manifests",
    "analytics_lifecycle_references",
    "analytics_deletion_links",
    "analytics_retention_bindings",
    "analytics_evidence_replays",
    "analytics_audit",
  ],
  ledger_writer_owner: [
    "fills",
    "ledger_transactions",
    "ledger_effects",
    "ledger_lots",
    "ledger_allocations",
    "ledger_reversal_links",
    "ledger_command_replays",
    "ledger_commitments",
  ],
};

function immutableTriggerSql(owner: ImmutableOwner, tableName: string): string {
  return `SET LOCAL ROLE ${owner};
CREATE TRIGGER trg_${tableName}__reject_update
BEFORE UPDATE ON etf.${tableName}
FOR EACH STATEMENT EXECUTE FUNCTION etf.reject_immutable_change();
CREATE TRIGGER trg_${tableName}__reject_delete
BEFORE DELETE ON etf.${tableName}
FOR EACH STATEMENT EXECUTE FUNCTION etf.reject_immutable_change();
CREATE TRIGGER trg_${tableName}__reject_truncate
BEFORE TRUNCATE ON etf.${tableName}
FOR EACH STATEMENT EXECUTE FUNCTION etf.reject_immutable_change();`;
}

const immutableTriggersSql = Object.entries(immutableOwners)
  .flatMap(([owner, tableNames]) =>
    tableNames.map((tableName) => immutableTriggerSql(owner as ImmutableOwner, tableName)))
  .join("\n");

const sql = `SET LOCAL ROLE schema_owner;
GRANT CREATE ON SCHEMA etf TO application_writer_owner, projection_owner;
CREATE FUNCTION etf.reject_immutable_change() RETURNS trigger
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_RELATION_CHANGE_REJECTED' USING ERRCODE = '55000';
END;
$function$;
REVOKE ALL ON FUNCTION etf.reject_immutable_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION etf.reject_immutable_change() TO anchor_owner, application_writer_owner, audit_writer_owner, evidence_writer_owner, ledger_writer_owner;

${immutableTriggersSql}

SET LOCAL ROLE schema_owner;
REVOKE EXECUTE ON FUNCTION etf.reject_immutable_change() FROM anchor_owner, application_writer_owner, audit_writer_owner, evidence_writer_owner, ledger_writer_owner;

SET LOCAL ROLE application_writer_owner;
CREATE FUNCTION etf.application_replay_get(
  requested_operation text,
  requested_command_id uuid,
  requested_canonical_content text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  canonical_content jsonb;
  stored_content jsonb;
  stored_result jsonb;
BEGIN
  IF session_user <> 'app_runtime'
     OR requested_operation IS NULL
     OR length(requested_operation) = 0
     OR requested_command_id IS NULL
     OR requested_canonical_content IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  BEGIN
    canonical_content := requested_canonical_content::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE = '22023';
  END;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    requested_operation || ':' || requested_command_id::text,
    0
  ));
  SELECT replay.canonical_content, replay.result_envelope
    INTO stored_content, stored_result
    FROM etf.application_replays AS replay
   WHERE replay.operation = requested_operation
     AND replay.command_id = requested_command_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF stored_content <> canonical_content THEN
    RAISE EXCEPTION 'APPLICATION_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  RETURN stored_result;
END;
$function$;
REVOKE ALL ON FUNCTION etf.application_replay_get(text, uuid, text) FROM PUBLIC;

CREATE FUNCTION etf.job_get(requested_job_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  job_row etf.jobs%ROWTYPE;
  checkpoint_value jsonb;
BEGIN
  IF session_user <> 'app_runtime' OR requested_job_id IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO job_row FROM etf.jobs WHERE job_id = requested_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_JOB_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT jsonb_build_object(
           'checkpointId', checkpoint.checkpoint_id,
           'attempt', checkpoint.attempt,
           'sequence', checkpoint.sequence,
           'committedAt', to_char(checkpoint.committed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'contentHash', checkpoint.content_hash
         )
    INTO checkpoint_value
    FROM etf.job_checkpoints AS checkpoint
   WHERE checkpoint.job_id = requested_job_id
     AND checkpoint.attempt <= job_row.attempt
   ORDER BY checkpoint.attempt DESC, checkpoint.sequence DESC
   LIMIT 1;
  RETURN jsonb_build_object('job', jsonb_build_object(
    'jobId', job_row.job_id,
    'jobType', job_row.job_type,
    'status', job_row.status,
    'restartability', job_row.restartability,
    'attempt', job_row.attempt,
    'operation', job_row.operation,
    'originalCommandId', job_row.original_command_id,
    'inputIdentity', job_row.input_identity,
    'createdAt', to_char(job_row.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'startedAt', CASE WHEN job_row.started_at IS NULL THEN NULL ELSE to_jsonb(to_char(job_row.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) END,
    'completedAt', CASE WHEN job_row.completed_at IS NULL THEN NULL ELSE to_jsonb(to_char(job_row.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) END,
    'checkpoint', checkpoint_value,
    'acceptedCount', job_row.accepted_count,
    'rejectedCount', job_row.rejected_count,
    'controllingError', job_row.controlling_error
  ));
END;
$function$;
REVOKE ALL ON FUNCTION etf.job_get(uuid) FROM PUBLIC;

CREATE FUNCTION etf.paper_order_get(requested_order_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  order_row etf.paper_orders%ROWTYPE;
  transition_history jsonb;
BEGIN
  IF session_user <> 'app_runtime' OR requested_order_id IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO order_row FROM etf.paper_orders WHERE order_id = requested_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'transitionCommandId', transition.transition_command_id,
           'transition', transition.transition,
           'sourceState', transition.source_state,
           'targetState', transition.target_state,
           'trigger', transition.trigger,
           'occurredAt', to_char(transition.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'actorId', transition.actor_id,
           'correlationId', transition.correlation_id,
           'priorVersion', transition.prior_version::text,
           'resultingVersion', transition.resulting_version::text,
           'baselineVersion', transition.baseline_version
         ) ORDER BY transition.resulting_version, transition.transition_command_id), '[]'::jsonb)
    INTO transition_history
    FROM etf.order_transitions AS transition
   WHERE transition.order_id = requested_order_id;
  RETURN jsonb_build_object('order', jsonb_build_object(
    'orderId', order_row.order_id,
    'instrumentId', order_row.instrument_id,
    'state', order_row.state,
    'aggregateVersion', order_row.aggregate_version::text,
    'researchEvidenceId', order_row.research_evidence_id,
    'side', order_row.side,
    'requestedQuantity', to_char(order_row.requested_quantity, 'FM99999999999999990.0000000000'),
    'filledQuantity', to_char(order_row.filled_quantity, 'FM99999999999999990.0000000000'),
    'openQuantity', to_char(order_row.open_quantity, 'FM99999999999999990.0000000000'),
    'unitPrice', to_char(order_row.unit_price, 'FM99999999999999990.0000000000'),
    'tradeDate', to_char(order_row.trade_date, 'YYYY-MM-DD'),
    'confirmation', order_row.confirmation,
    'transitionHistory', transition_history
  ));
END;
$function$;
REVOKE ALL ON FUNCTION etf.paper_order_get(uuid) FROM PUBLIC;

CREATE FUNCTION etf.paper_order_command_get(requested_order_id uuid, requested_transition_command_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  replay_result jsonb;
  replay_version bigint;
  transition_history jsonb;
BEGIN
  IF session_user <> 'app_runtime' OR requested_order_id IS NULL OR requested_transition_command_id IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT replay.result, (replay.result ->> 'aggregateVersion')::bigint
    INTO replay_result, replay_version
    FROM etf.order_command_replays AS replay
   WHERE replay.order_id = requested_order_id
     AND replay.transition_command_id = requested_transition_command_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'transitionCommandId', transition.transition_command_id,
           'transition', transition.transition,
           'sourceState', transition.source_state,
           'targetState', transition.target_state,
           'trigger', transition.trigger,
           'occurredAt', to_char(transition.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'actorId', transition.actor_id,
           'correlationId', transition.correlation_id,
           'priorVersion', transition.prior_version::text,
           'resultingVersion', transition.resulting_version::text,
           'baselineVersion', transition.baseline_version
         ) ORDER BY transition.resulting_version, transition.transition_command_id), '[]'::jsonb)
    INTO transition_history
    FROM etf.order_transitions AS transition
   WHERE transition.order_id = requested_order_id
     AND transition.resulting_version <= replay_version;
  RETURN jsonb_build_object('order', replay_result || jsonb_build_object(
    'aggregateVersion', replay_version::text,
    'transitionHistory', transition_history
  ));
END;
$function$;
REVOKE ALL ON FUNCTION etf.paper_order_command_get(uuid, uuid) FROM PUBLIC;

SET LOCAL ROLE ledger_writer_owner;
GRANT SELECT (portfolio_id, portfolio_version, baseline_version, precision_policy_version) ON etf.portfolios TO projection_owner;
GRANT SELECT (portfolio_id, ledger_sequence, commitment_hash) ON etf.ledger_commitments TO projection_owner;
SET LOCAL ROLE anchor_owner;
GRANT SELECT (portfolio_id, ledger_sequence, commitment_hash) ON etf.ledger_anchors TO projection_owner;
SET LOCAL ROLE projection_owner;
CREATE FUNCTION etf.portfolio_get(requested_portfolio_id uuid, requested_as_of timestamp with time zone) RETURNS jsonb
LANGUAGE plpgsql STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  portfolio_row etf.portfolios%ROWTYPE;
  projection_row etf.portfolio_projections%ROWTYPE;
BEGIN
  IF session_user <> 'app_runtime' OR requested_portfolio_id IS NULL OR requested_as_of IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO portfolio_row FROM etf.portfolios WHERE portfolio_id = requested_portfolio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEDGER_PORTFOLIO_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  SELECT projection.* INTO projection_row
    FROM etf.portfolio_projections AS projection
    JOIN etf.ledger_commitments AS commitment
      ON commitment.portfolio_id = projection.portfolio_id
     AND commitment.commitment_hash = projection.source_commitment_hash
    JOIN etf.ledger_anchors AS anchor_record
      ON anchor_record.portfolio_id = commitment.portfolio_id
     AND anchor_record.ledger_sequence = commitment.ledger_sequence
     AND anchor_record.commitment_hash = commitment.commitment_hash
   WHERE projection.portfolio_id = requested_portfolio_id
     AND projection.as_of <= requested_as_of
     AND projection.reconciliation_state = 'Reconciled'
   ORDER BY projection.as_of DESC, projection.portfolio_version DESC, projection.valuation_snapshot_id
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEDGER_PORTFOLIO_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('portfolio', jsonb_build_object(
    'portfolioId', portfolio_row.portfolio_id,
    'portfolioVersion', projection_row.portfolio_version::text,
    'asOf', to_char(projection_row.as_of AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'valuationSnapshotId', projection_row.valuation_snapshot_id,
    'precisionPolicyVersion', portfolio_row.precision_policy_version,
    'baselineVersion', portfolio_row.baseline_version,
    'cash', to_char(projection_row.cash, 'FM99999999999999990.00000000'),
    'lots', projection_row.lots,
    'positions', projection_row.positions,
    'realizedPnL', to_char(projection_row.realized_pnl, 'FM99999999999999990.00000000'),
    'totalEquity', to_char(projection_row.total_equity, 'FM99999999999999990.00000000'),
    'reconciliationState', projection_row.reconciliation_state
  ));
END;
$function$;
REVOKE ALL ON FUNCTION etf.portfolio_get(uuid, timestamp with time zone) FROM PUBLIC;

SET LOCAL ROLE application_writer_owner;
GRANT SELECT (instrument_id, display_name, validation_state, position, version) ON etf.watchlist_items TO schema_owner;
GRANT SELECT (job_id, job_type, status, restartability, attempt, created_at, started_at, completed_at, accepted_count, rejected_count) ON etf.jobs TO schema_owner;
GRANT SELECT (order_id, instrument_id, state, aggregate_version, research_evidence_id, side, requested_quantity, filled_quantity, open_quantity, unit_price, trade_date) ON etf.paper_orders TO schema_owner;
SET LOCAL ROLE ledger_writer_owner;
GRANT SELECT (portfolio_id, portfolio_version, baseline_version, precision_policy_version) ON etf.portfolios TO schema_owner;
SET LOCAL ROLE evidence_writer_owner;
GRANT SELECT (publication_target_id, publication_version, evidence_id, published_at, bundle_hash) ON etf.analytics_publications TO schema_owner;

SET LOCAL ROLE schema_owner;
GRANT USAGE ON SCHEMA etf TO app_runtime, projection_runtime, audit_runtime, key_injector;
CREATE VIEW etf.current_watchlist WITH (security_barrier = true) AS
SELECT instrument_id, display_name, validation_state, position, version FROM etf.watchlist_items;
CREATE VIEW etf.current_jobs WITH (security_barrier = true) AS
SELECT job_id, job_type, status, restartability, attempt, created_at, started_at, completed_at, accepted_count, rejected_count FROM etf.jobs;
CREATE VIEW etf.current_paper_orders WITH (security_barrier = true) AS
SELECT order_id, instrument_id, state, aggregate_version, research_evidence_id, side, requested_quantity, filled_quantity, open_quantity, unit_price, trade_date FROM etf.paper_orders;
CREATE VIEW etf.current_portfolios WITH (security_barrier = true) AS
SELECT portfolio_id, portfolio_version, baseline_version, precision_policy_version FROM etf.portfolios;
CREATE VIEW etf.current_analytics_publications WITH (security_barrier = true) AS
SELECT publication_target_id, publication_version, evidence_id, published_at, bundle_hash FROM etf.analytics_publications;

GRANT SELECT ON etf.current_watchlist, etf.current_jobs, etf.current_paper_orders, etf.current_portfolios, etf.current_analytics_publications TO app_runtime;
SET LOCAL ROLE application_writer_owner;
GRANT EXECUTE ON FUNCTION etf.paper_order_transition(jsonb) TO app_runtime;
GRANT EXECUTE ON FUNCTION etf.application_replay_get(text, uuid, text), etf.application_replay_get_or_put(text, uuid, text, text) TO app_runtime;
GRANT EXECUTE ON FUNCTION etf.job_start(jsonb), etf.job_succeed(jsonb), etf.job_restart(jsonb), etf.job_get(uuid), etf.paper_order_get(uuid), etf.paper_order_command_get(uuid, uuid) TO app_runtime;
SET LOCAL ROLE ledger_writer_owner;
GRANT EXECUTE ON FUNCTION etf.ledger_append(jsonb) TO app_runtime;
SET LOCAL ROLE projection_owner;
GRANT EXECUTE ON FUNCTION etf.portfolio_get(uuid, timestamp with time zone) TO app_runtime;
GRANT EXECUTE ON FUNCTION etf.projection_publish(jsonb) TO projection_runtime;

SET LOCAL ROLE schema_owner;
REVOKE CREATE ON SCHEMA etf FROM application_writer_owner, projection_owner;
SET LOCAL ROLE migration_owner;
`;

export const controlledAccessMigration: MigrationArtifact = {
  migrationId: "0006-controlled-access",
  sequence: 6,
  sql,
};
