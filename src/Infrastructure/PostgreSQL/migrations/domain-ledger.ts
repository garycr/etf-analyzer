import type { MigrationArtifact } from "../migration-set.js";

export const domainLedgerTableNames = [
  "paper_orders",
  "order_transitions",
  "order_command_replays",
  "portfolios",
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
  "portfolio_projections",
] as const;

export const domainLedgerFunctionNames = [
  "paper_order_transition",
  "ledger_append",
  "projection_publish",
  "audit_append",
  "anchor_append",
  "anchor_key_inject",
] as const;

const sql = `SET LOCAL ROLE schema_owner;
GRANT USAGE, CREATE ON SCHEMA etf TO application_writer_owner, ledger_writer_owner, projection_owner, audit_writer_owner, anchor_owner;

SET LOCAL ROLE application_writer_owner;
CREATE TABLE etf.paper_orders (
  order_id uuid NOT NULL,
  instrument_id text COLLATE "C" NOT NULL,
  state text COLLATE "C" NOT NULL,
  aggregate_version bigint NOT NULL,
  research_evidence_id uuid NOT NULL,
  side text COLLATE "C" NOT NULL,
  requested_quantity numeric(28,10) NOT NULL,
  filled_quantity numeric(28,10) NOT NULL,
  open_quantity numeric(28,10) NOT NULL,
  unit_price numeric(28,10) NOT NULL,
  trade_date date NOT NULL,
  confirmation jsonb,
  CONSTRAINT pk_paper_orders PRIMARY KEY (order_id),
  CONSTRAINT ck_paper_orders__instrument_id_nonempty CHECK (length(instrument_id) > 0),
  CONSTRAINT ck_paper_orders__state CHECK (state IN ('Draft','Submitted','Accepted','Partial','Filled','Rejected','Canceled','Expired')),
  CONSTRAINT ck_paper_orders__aggregate_version_nonnegative CHECK (aggregate_version >= 0),
  CONSTRAINT ck_paper_orders__side CHECK (side IN ('Buy','Sell')),
  CONSTRAINT ck_paper_orders__quantities CHECK (
    requested_quantity > 0 AND filled_quantity >= 0 AND open_quantity >= 0 AND
    CASE
      WHEN state IN ('Draft','Submitted','Accepted') THEN filled_quantity = 0 AND open_quantity = requested_quantity
      WHEN state = 'Partial' THEN filled_quantity > 0 AND open_quantity > 0 AND requested_quantity = filled_quantity + open_quantity
      WHEN state = 'Filled' THEN filled_quantity = requested_quantity AND open_quantity = 0
      WHEN state IN ('Rejected','Expired') THEN filled_quantity = 0 AND open_quantity = 0
      WHEN state = 'Canceled' THEN filled_quantity < requested_quantity AND open_quantity = 0
      ELSE false
    END
  ),
  CONSTRAINT ck_paper_orders__unit_price_positive CHECK (unit_price > 0)
);

CREATE TABLE etf.order_transitions (
  order_id uuid NOT NULL,
  transition_command_id uuid NOT NULL,
  transition text COLLATE "C" NOT NULL,
  source_state text COLLATE "C" NOT NULL,
  target_state text COLLATE "C" NOT NULL,
  trigger text COLLATE "C" NOT NULL,
  normalized_payload jsonb NOT NULL,
  occurred_at timestamp(3) with time zone NOT NULL,
  actor_id text COLLATE "C" NOT NULL,
  correlation_id uuid NOT NULL,
  prior_version bigint NOT NULL,
  resulting_version bigint NOT NULL,
  baseline_version text COLLATE "C" NOT NULL,
  CONSTRAINT pk_order_transitions PRIMARY KEY (order_id, transition_command_id),
  CONSTRAINT uq_order_transitions__order_id_resulting_version UNIQUE (order_id, resulting_version),
  CONSTRAINT fk_order_transitions__order_id__paper_orders FOREIGN KEY (order_id) REFERENCES etf.paper_orders (order_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_order_transitions__transition CHECK (transition IN ('OT-01','OT-02','OT-03','OT-04','OT-05','OT-06','OT-07','OT-08','OT-09','OT-10')),
  CONSTRAINT ck_order_transitions__versions CHECK (prior_version >= 0 AND resulting_version = prior_version + 1),
  CONSTRAINT ck_order_transitions__baseline_version CHECK (baseline_version = 'v1.0.0')
);
CREATE INDEX ix_order_transitions__order_id_resulting_version ON etf.order_transitions (order_id, resulting_version);

CREATE TABLE etf.order_command_replays (
  order_id uuid NOT NULL,
  transition_command_id uuid NOT NULL,
  canonical_content jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_order_command_replays PRIMARY KEY (order_id, transition_command_id),
  CONSTRAINT fk_order_command_replays__order_id__paper_orders FOREIGN KEY (order_id) REFERENCES etf.paper_orders (order_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE
);
GRANT REFERENCES ON etf.order_transitions TO ledger_writer_owner;

SET LOCAL ROLE ledger_writer_owner;
CREATE TABLE etf.portfolios (
  portfolio_id uuid NOT NULL,
  portfolio_version bigint NOT NULL,
  baseline_version text COLLATE "C" NOT NULL,
  precision_policy_version text COLLATE "C" NOT NULL,
  CONSTRAINT pk_portfolios PRIMARY KEY (portfolio_id),
  CONSTRAINT ck_portfolios__portfolio_version_nonnegative CHECK (portfolio_version >= 0),
  CONSTRAINT ck_portfolios__baseline_version CHECK (baseline_version = 'v1.0.0'),
  CONSTRAINT ck_portfolios__precision_policy_version CHECK (precision_policy_version = 'DEC-014')
);

CREATE TABLE etf.fills (
  portfolio_id uuid NOT NULL,
  fill_id uuid NOT NULL,
  order_id uuid NOT NULL,
  transition_command_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  quantity numeric(28,10) NOT NULL,
  unit_price numeric(28,10) NOT NULL,
  fee numeric(28,8) NOT NULL,
  simulated_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_fills PRIMARY KEY (portfolio_id, fill_id),
  CONSTRAINT uq_fills__portfolio_id_transaction_id UNIQUE (portfolio_id, transaction_id),
  CONSTRAINT uq_fills__portfolio_id_fill_id_transaction_id UNIQUE (portfolio_id, fill_id, transaction_id),
  CONSTRAINT fk_fills__order_id_transition_command_id__order_transitions FOREIGN KEY (order_id, transition_command_id) REFERENCES etf.order_transitions (order_id, transition_command_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_fills__values CHECK (quantity > 0 AND unit_price > 0 AND fee >= 0)
);

SET LOCAL ROLE audit_writer_owner;
CREATE TABLE etf.order_audit (
  audit_id uuid NOT NULL,
  attempt_intent_id uuid NOT NULL,
  order_id uuid NOT NULL,
  transition_command_id uuid,
  action text COLLATE "C" NOT NULL,
  outcome text COLLATE "C" NOT NULL,
  error_code text COLLATE "C",
  correlation_id uuid NOT NULL,
  old_order_version bigint,
  new_order_version bigint,
  actor_subject text COLLATE "C",
  workload_identity text COLLATE "C" NOT NULL,
  authentication_context_digest character(64) COLLATE "C" NOT NULL,
  recorded_at timestamp(3) with time zone NOT NULL,
  evidence_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_order_audit PRIMARY KEY (audit_id),
  CONSTRAINT ck_order_audit__outcome CHECK (outcome IN ('IntentRecorded','Committed','Rejected')),
  CONSTRAINT ck_order_audit__outcome_fields CHECK ((outcome = 'IntentRecorded' AND transition_command_id IS NULL AND new_order_version IS NULL AND error_code IS NULL) OR (outcome = 'Committed' AND transition_command_id IS NOT NULL AND old_order_version IS NOT NULL AND new_order_version IS NOT NULL AND error_code IS NULL) OR (outcome = 'Rejected' AND error_code IS NOT NULL AND old_order_version IS NOT NULL AND new_order_version IS NULL)),
  CONSTRAINT ck_order_audit__digests_lower_hex CHECK (authentication_context_digest ~ '^[0-9a-f]{64}$' AND evidence_hash ~ '^[0-9a-f]{64}$')
);

CREATE TABLE etf.access_denial_audit (
  audit_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  original_backend_pid integer NOT NULL,
  backend_start timestamp(3) with time zone NOT NULL,
  original_session_user text COLLATE "C" NOT NULL,
  denial_nonce character(32) COLLATE "C" NOT NULL,
  actor_subject text COLLATE "C",
  workload_identity text COLLATE "C" NOT NULL,
  authentication_context_digest character(64) COLLATE "C" NOT NULL,
  object_class text COLLATE "C" NOT NULL,
  object_name text COLLATE "C" NOT NULL,
  denial_code text COLLATE "C" NOT NULL,
  denied_at timestamp(3) with time zone NOT NULL,
  content_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_access_denial_audit PRIMARY KEY (audit_id),
  CONSTRAINT uq_access_denial_audit__deduplication UNIQUE (correlation_id, original_backend_pid, backend_start, denial_nonce, workload_identity, object_class, object_name, denial_code),
  CONSTRAINT ck_access_denial_audit__session_user CHECK (original_session_user IN ('app_runtime','projection_runtime','audit_runtime','key_injector')),
  CONSTRAINT ck_access_denial_audit__denial_nonce_lower_hex CHECK (denial_nonce ~ '^[0-9a-f]{32}$'),
  CONSTRAINT ck_access_denial_audit__object_class CHECK (object_class IN ('table','function','schema','role')),
  CONSTRAINT ck_access_denial_audit__denial_code CHECK (denial_code = 'PermissionDenied'),
  CONSTRAINT ck_access_denial_audit__digests_lower_hex CHECK (authentication_context_digest ~ '^[0-9a-f]{64}$' AND content_hash ~ '^[0-9a-f]{64}$')
);

SET LOCAL ROLE ledger_writer_owner;
CREATE TABLE etf.ledger_transactions (
  portfolio_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  ledger_sequence bigint NOT NULL,
  type text COLLATE "C" NOT NULL,
  effective_at timestamp(3) with time zone NOT NULL,
  recorded_at timestamp(3) with time zone NOT NULL,
  order_id uuid,
  fill_id uuid,
  correlation_id uuid NOT NULL,
  transition_command_id uuid,
  precision_policy_version text COLLATE "C" NOT NULL,
  baseline_version text COLLATE "C" NOT NULL,
  reverses_transaction_id uuid,
  evidence_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_ledger_transactions PRIMARY KEY (portfolio_id, transaction_id),
  CONSTRAINT uq_ledger_transactions__portfolio_id_ledger_sequence UNIQUE (portfolio_id, ledger_sequence),
  CONSTRAINT fk_ledger_transactions__portfolio_id__portfolios FOREIGN KEY (portfolio_id) REFERENCES etf.portfolios (portfolio_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_ledger_transactions__order_id_transition_command_id__order_transitions FOREIGN KEY (order_id, transition_command_id) REFERENCES etf.order_transitions (order_id, transition_command_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_ledger_transactions__portfolio_id_fill_id_transaction_id__fills FOREIGN KEY (portfolio_id, fill_id, transaction_id) REFERENCES etf.fills (portfolio_id, fill_id, transaction_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_ledger_transactions__ledger_sequence_positive CHECK (ledger_sequence > 0),
  CONSTRAINT ck_ledger_transactions__type_links CHECK ((type IN ('CashDeposit','CashWithdrawal') AND order_id IS NULL AND fill_id IS NULL AND transition_command_id IS NULL AND reverses_transaction_id IS NULL) OR (type IN ('BuyFill','SellFill') AND order_id IS NOT NULL AND fill_id IS NOT NULL AND transition_command_id IS NOT NULL AND reverses_transaction_id IS NULL) OR (type = 'Reversal' AND reverses_transaction_id IS NOT NULL AND reverses_transaction_id <> transaction_id AND fill_id IS NULL)),
  CONSTRAINT ck_ledger_transactions__versions CHECK (precision_policy_version = 'DEC-014' AND baseline_version = 'v1.0.0'),
  CONSTRAINT ck_ledger_transactions__evidence_hash_lower_hex CHECK (evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX ix_ledger_transactions__portfolio_id_ledger_sequence ON etf.ledger_transactions (portfolio_id, ledger_sequence);

CREATE TABLE etf.ledger_effects (
  portfolio_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  effect_ordinal bigint NOT NULL,
  effect_type text COLLATE "C" NOT NULL,
  instrument_id text COLLATE "C",
  lot_id uuid,
  source_effect_id uuid,
  quantity numeric(28,10),
  money numeric(28,8),
  rate numeric(28,12),
  CONSTRAINT pk_ledger_effects PRIMARY KEY (portfolio_id, transaction_id, effect_ordinal),
  CONSTRAINT fk_ledger_effects__portfolio_id_transaction_id__ledger_transactions FOREIGN KEY (portfolio_id, transaction_id) REFERENCES etf.ledger_transactions (portfolio_id, transaction_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_ledger_effects__effect_ordinal_nonnegative CHECK (effect_ordinal >= 0),
  CONSTRAINT ck_ledger_effects__effect_type_nonempty CHECK (length(effect_type) > 0)
);

CREATE TABLE etf.ledger_lots (
  portfolio_id uuid NOT NULL,
  lot_id uuid NOT NULL,
  instrument_id text COLLATE "C" NOT NULL,
  acquired_at timestamp(3) with time zone NOT NULL,
  ledger_sequence bigint NOT NULL,
  original_quantity numeric(28,10) NOT NULL,
  original_basis numeric(28,8) NOT NULL,
  CONSTRAINT pk_ledger_lots PRIMARY KEY (portfolio_id, lot_id),
  CONSTRAINT fk_ledger_lots__portfolio_id_ledger_sequence__ledger_transactions FOREIGN KEY (portfolio_id, ledger_sequence) REFERENCES etf.ledger_transactions (portfolio_id, ledger_sequence) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_ledger_lots__values CHECK (length(instrument_id) > 0 AND original_quantity > 0 AND original_basis >= 0)
);
CREATE INDEX ix_ledger_lots__portfolio_id_instrument_id_acquired_at_ledger_sequence_lot_id ON etf.ledger_lots (portfolio_id, instrument_id, acquired_at, ledger_sequence, lot_id);

CREATE TABLE etf.ledger_allocations (
  portfolio_id uuid NOT NULL,
  sell_transaction_id uuid NOT NULL,
  effect_ordinal bigint NOT NULL,
  lot_id uuid NOT NULL,
  consumed_quantity numeric(28,10) NOT NULL,
  allocated_basis numeric(28,8) NOT NULL,
  CONSTRAINT pk_ledger_allocations PRIMARY KEY (portfolio_id, sell_transaction_id, effect_ordinal, lot_id),
  CONSTRAINT fk_ledger_allocations__portfolio_id_sell_transaction_id_effect_ordinal__ledger_effects FOREIGN KEY (portfolio_id, sell_transaction_id, effect_ordinal) REFERENCES etf.ledger_effects (portfolio_id, transaction_id, effect_ordinal) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_ledger_allocations__portfolio_id_lot_id__ledger_lots FOREIGN KEY (portfolio_id, lot_id) REFERENCES etf.ledger_lots (portfolio_id, lot_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_ledger_allocations__values CHECK (consumed_quantity > 0 AND allocated_basis >= 0)
);

CREATE TABLE etf.ledger_reversal_links (
  portfolio_id uuid NOT NULL,
  reversal_transaction_id uuid NOT NULL,
  target_transaction_id uuid NOT NULL,
  CONSTRAINT pk_ledger_reversal_links PRIMARY KEY (portfolio_id, reversal_transaction_id),
  CONSTRAINT uq_ledger_reversal_links__portfolio_id_target_transaction_id_reversal_transaction_id UNIQUE (portfolio_id, target_transaction_id, reversal_transaction_id),
  CONSTRAINT fk_ledger_reversal_links__portfolio_id_reversal_transaction_id__ledger_transactions FOREIGN KEY (portfolio_id, reversal_transaction_id) REFERENCES etf.ledger_transactions (portfolio_id, transaction_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_ledger_reversal_links__portfolio_id_target_transaction_id__ledger_transactions FOREIGN KEY (portfolio_id, target_transaction_id) REFERENCES etf.ledger_transactions (portfolio_id, transaction_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_ledger_reversal_links__different_transactions CHECK (reversal_transaction_id <> target_transaction_id)
);

CREATE TABLE etf.ledger_command_replays (
  portfolio_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  canonical_content jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_ledger_command_replays PRIMARY KEY (portfolio_id, transaction_id),
  CONSTRAINT fk_ledger_command_replays__portfolio_id__portfolios FOREIGN KEY (portfolio_id) REFERENCES etf.portfolios (portfolio_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_ledger_command_replays__portfolio_id_transaction_id__ledger_transactions FOREIGN KEY (portfolio_id, transaction_id) REFERENCES etf.ledger_transactions (portfolio_id, transaction_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE
);
GRANT REFERENCES ON etf.portfolios, etf.ledger_transactions TO audit_writer_owner;

SET LOCAL ROLE audit_writer_owner;
CREATE TABLE etf.ledger_audit (
  audit_id uuid NOT NULL,
  attempt_intent_id uuid NOT NULL,
  portfolio_id uuid NOT NULL,
  transaction_id uuid,
  ledger_sequence bigint,
  action text COLLATE "C" NOT NULL,
  outcome text COLLATE "C" NOT NULL,
  error_code text COLLATE "C",
  replay_classification text COLLATE "C" NOT NULL,
  correlation_id uuid NOT NULL,
  transition_command_id uuid,
  old_order_version bigint,
  new_order_version bigint,
  old_portfolio_version bigint,
  new_portfolio_version bigint,
  reverses_transaction_id uuid,
  reversed_by_transaction_id uuid,
  actor_subject text COLLATE "C",
  workload_identity text COLLATE "C" NOT NULL,
  authentication_context_digest character(64) COLLATE "C" NOT NULL,
  recorded_at timestamp(3) with time zone NOT NULL,
  transaction_evidence_hash character(64) COLLATE "C",
  allocation_evidence_hash character(64) COLLATE "C",
  audit_evidence_hash character(64) COLLATE "C",
  CONSTRAINT pk_ledger_audit PRIMARY KEY (audit_id),
  CONSTRAINT fk_ledger_audit__portfolio_id__portfolios FOREIGN KEY (portfolio_id) REFERENCES etf.portfolios (portfolio_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_ledger_audit__portfolio_id_transaction_id__ledger_transactions FOREIGN KEY (portfolio_id, transaction_id) REFERENCES etf.ledger_transactions (portfolio_id, transaction_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_ledger_audit__outcome CHECK (outcome IN ('IntentRecorded','Committed','Rejected','IntegrityFailed','BlockedPublication','PublicationCompleted','TimeoutRecovery','RecoveryCompleted')),
  CONSTRAINT ck_ledger_audit__error_code CHECK ((outcome IN ('IntentRecorded','Committed','PublicationCompleted','RecoveryCompleted') AND error_code IS NULL) OR (outcome NOT IN ('IntentRecorded','Committed','PublicationCompleted','RecoveryCompleted') AND error_code IS NOT NULL)),
  CONSTRAINT ck_ledger_audit__committed_fields CHECK ((outcome = 'Committed' AND transaction_id IS NOT NULL AND ledger_sequence IS NOT NULL AND new_portfolio_version IS NOT NULL AND transaction_evidence_hash IS NOT NULL AND allocation_evidence_hash IS NOT NULL AND audit_evidence_hash IS NOT NULL) OR (outcome <> 'Committed' AND transaction_id IS NULL AND ledger_sequence IS NULL AND new_order_version IS NULL AND new_portfolio_version IS NULL AND transaction_evidence_hash IS NULL AND allocation_evidence_hash IS NULL)),
  CONSTRAINT ck_ledger_audit__authentication_digest_lower_hex CHECK (authentication_context_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_ledger_audit__evidence_hashes_lower_hex CHECK ((transaction_evidence_hash IS NULL OR transaction_evidence_hash ~ '^[0-9a-f]{64}$') AND (allocation_evidence_hash IS NULL OR allocation_evidence_hash ~ '^[0-9a-f]{64}$') AND (audit_evidence_hash IS NULL OR audit_evidence_hash ~ '^[0-9a-f]{64}$'))
);

SET LOCAL ROLE ledger_writer_owner;
CREATE TABLE etf.ledger_commitments (
  portfolio_id uuid NOT NULL,
  ledger_sequence bigint NOT NULL,
  transaction_evidence_hash character(64) COLLATE "C" NOT NULL,
  allocation_evidence_hash character(64) COLLATE "C" NOT NULL,
  audit_evidence_hash character(64) COLLATE "C" NOT NULL,
  previous_portfolio_commitment character(64) COLLATE "C",
  commitment_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_ledger_commitments PRIMARY KEY (portfolio_id, ledger_sequence),
  CONSTRAINT uq_ledger_commitments__portfolio_id_commitment_hash UNIQUE (portfolio_id, commitment_hash),
  CONSTRAINT fk_ledger_commitments__portfolio_id__portfolios FOREIGN KEY (portfolio_id) REFERENCES etf.portfolios (portfolio_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_ledger_commitments__portfolio_id_ledger_sequence__ledger_transactions FOREIGN KEY (portfolio_id, ledger_sequence) REFERENCES etf.ledger_transactions (portfolio_id, ledger_sequence) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_ledger_commitments__hashes_lower_hex CHECK (transaction_evidence_hash ~ '^[0-9a-f]{64}$' AND allocation_evidence_hash ~ '^[0-9a-f]{64}$' AND audit_evidence_hash ~ '^[0-9a-f]{64}$' AND (previous_portfolio_commitment IS NULL OR previous_portfolio_commitment ~ '^[0-9a-f]{64}$') AND commitment_hash ~ '^[0-9a-f]{64}$')
);
GRANT REFERENCES ON etf.portfolios, etf.ledger_commitments TO anchor_owner, projection_owner;

SET LOCAL ROLE anchor_owner;
GRANT REFERENCES ON etf.anchor_keys TO audit_writer_owner;
SET LOCAL ROLE audit_writer_owner;
CREATE TABLE etf.audit_commitments (
  audit_sequence bigint NOT NULL,
  audit_segment_hash character(64) COLLATE "C" NOT NULL,
  previous_audit_commitment character(64) COLLATE "C",
  key_identifier text COLLATE "C" NOT NULL,
  audit_commitment character(64) COLLATE "C" NOT NULL,
  anchor_hmac character(64) COLLATE "C" NOT NULL,
  committed_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_audit_commitments PRIMARY KEY (audit_sequence),
  CONSTRAINT fk_audit_commitments__key_identifier__anchor_keys FOREIGN KEY (key_identifier) REFERENCES etf.anchor_keys (key_identifier) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_audit_commitments__hashes_lower_hex CHECK (audit_sequence > 0 AND audit_segment_hash ~ '^[0-9a-f]{64}$' AND (previous_audit_commitment IS NULL OR previous_audit_commitment ~ '^[0-9a-f]{64}$') AND audit_commitment ~ '^[0-9a-f]{64}$' AND anchor_hmac ~ '^[0-9a-f]{64}$')
);
GRANT REFERENCES ON etf.audit_commitments TO anchor_owner;

SET LOCAL ROLE anchor_owner;
REVOKE REFERENCES ON etf.anchor_keys FROM audit_writer_owner;
CREATE TABLE etf.ledger_anchors (
  portfolio_id uuid NOT NULL,
  ledger_sequence bigint NOT NULL,
  key_identifier text COLLATE "C" NOT NULL,
  commitment_hash character(64) COLLATE "C" NOT NULL,
  anchor_hmac character(64) COLLATE "C" NOT NULL,
  accepted_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_ledger_anchors PRIMARY KEY (portfolio_id, ledger_sequence),
  CONSTRAINT fk_ledger_anchors__portfolio_id__portfolios FOREIGN KEY (portfolio_id) REFERENCES etf.portfolios (portfolio_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_ledger_anchors__portfolio_id_ledger_sequence__ledger_commitments FOREIGN KEY (portfolio_id, ledger_sequence) REFERENCES etf.ledger_commitments (portfolio_id, ledger_sequence) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_ledger_anchors__key_identifier__anchor_keys FOREIGN KEY (key_identifier) REFERENCES etf.anchor_keys (key_identifier) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_ledger_anchors__hashes_lower_hex CHECK (commitment_hash ~ '^[0-9a-f]{64}$' AND anchor_hmac ~ '^[0-9a-f]{64}$')
);

SET LOCAL ROLE projection_owner;
CREATE TABLE etf.portfolio_projections (
  portfolio_id uuid NOT NULL,
  valuation_snapshot_id uuid NOT NULL,
  portfolio_version bigint NOT NULL,
  as_of timestamp(3) with time zone NOT NULL,
  cash numeric(28,8) NOT NULL,
  lots jsonb NOT NULL,
  positions jsonb NOT NULL,
  realized_pnl numeric(28,8) NOT NULL,
  total_equity numeric(28,8) NOT NULL,
  reconciliation_state text COLLATE "C" NOT NULL,
  source_commitment_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_portfolio_projections PRIMARY KEY (portfolio_id, valuation_snapshot_id),
  CONSTRAINT fk_portfolio_projections__portfolio_id__portfolios FOREIGN KEY (portfolio_id) REFERENCES etf.portfolios (portfolio_id) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT fk_portfolio_projections__portfolio_id_source_commitment_hash__ledger_commitments FOREIGN KEY (portfolio_id, source_commitment_hash) REFERENCES etf.ledger_commitments (portfolio_id, commitment_hash) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_portfolio_projections__state CHECK (portfolio_version >= 0 AND reconciliation_state IN ('Reconciled','IntegrityBlocked') AND source_commitment_hash ~ '^[0-9a-f]{64}$')
);

SET LOCAL ROLE anchor_owner;
ALTER TABLE etf.portfolio_anchor_checkpoints ADD CONSTRAINT fk_portfolio_anchor_checkpoints__portfolio_id_ledger_sequence__ledger_commitments FOREIGN KEY (portfolio_id, ledger_sequence) REFERENCES etf.ledger_commitments (portfolio_id, ledger_sequence) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE;
ALTER TABLE etf.portfolio_anchor_checkpoints ADD CONSTRAINT fk_portfolio_anchor_checkpoints__audit_sequence__audit_commitments FOREIGN KEY (audit_sequence) REFERENCES etf.audit_commitments (audit_sequence) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE;
ALTER TABLE etf.audit_anchor_checkpoints ADD CONSTRAINT fk_audit_anchor_checkpoints__audit_sequence__audit_commitments FOREIGN KEY (audit_sequence) REFERENCES etf.audit_commitments (audit_sequence) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE;

SET LOCAL ROLE audit_writer_owner;
REVOKE REFERENCES ON etf.audit_commitments FROM anchor_owner;
GRANT SELECT (audit_sequence, audit_commitment), INSERT ON etf.audit_commitments TO anchor_owner;
SET LOCAL ROLE anchor_owner;
CREATE FUNCTION etf.anchor_key_inject(requested_key_identifier text, requested_key_ciphertext bytea, requested_activated_at timestamp with time zone) RETURNS void
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
BEGIN
  IF session_user <> 'key_injector' OR requested_key_identifier IS NULL OR length(requested_key_identifier) = 0 OR requested_key_ciphertext IS NULL OR octet_length(requested_key_ciphertext) = 0 OR requested_activated_at IS NULL OR date_trunc('milliseconds', requested_activated_at) <> requested_activated_at THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;
  INSERT INTO etf.anchor_keys (key_identifier, key_ciphertext, activated_at, retired_at) VALUES (requested_key_identifier, requested_key_ciphertext, requested_activated_at, NULL);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'ANCHOR_KEY_REPLACEMENT_FORBIDDEN' USING ERRCODE = '55000';
END;
$function$;
REVOKE ALL ON FUNCTION etf.anchor_key_inject(text, bytea, timestamp with time zone) FROM PUBLIC;

CREATE FUNCTION etf.anchor_append(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  variant text; key_bytes bytea; accepted timestamp(3) with time zone; prior_hash text; next_sequence bigint; content text; commitment text; signature text; checkpoint etf.portfolio_anchor_checkpoints%ROWTYPE;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' OR NOT payload ? 'domain' THEN RAISE EXCEPTION 'LEDGER_INTEGRITY_FAILED' USING ERRCODE = '22023'; END IF;
  variant := payload ->> 'domain';
  IF variant = 'Verify' THEN
    IF session_user <> 'projection_runtime' OR NOT payload ?& ARRAY['domain','portfolioId','sourceCommitmentHash'] OR payload - ARRAY['domain','portfolioId','sourceCommitmentHash']::text[] <> '{}'::jsonb OR payload ->> 'sourceCommitmentHash' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
    SELECT * INTO checkpoint FROM etf.portfolio_anchor_checkpoints WHERE portfolio_id = (payload ->> 'portfolioId')::uuid;
    RETURN jsonb_build_object('verified', FOUND AND checkpoint.portfolio_commitment = payload ->> 'sourceCommitmentHash');
  END IF;
  IF variant = 'Audit' THEN
    IF session_user NOT IN ('app_runtime','projection_runtime','audit_runtime') OR NOT payload ?& ARRAY['domain','keyIdentifier','auditSegmentHash'] OR payload - ARRAY['domain','keyIdentifier','auditSegmentHash']::text[] <> '{}'::jsonb OR payload ->> 'auditSegmentHash' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
    SELECT key_ciphertext INTO key_bytes FROM etf.anchor_keys WHERE key_identifier = payload ->> 'keyIdentifier' AND activated_at <= clock_timestamp() AND retired_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_INTEGRITY_FAILED' USING ERRCODE = '55000'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('etf:audit-commitment', 0));
    SELECT audit_sequence, audit_commitment INTO next_sequence, prior_hash FROM etf.audit_commitments ORDER BY audit_sequence DESC LIMIT 1;
    next_sequence := COALESCE(next_sequence, 0) + 1; accepted := date_trunc('milliseconds', clock_timestamp());
    content := format('{"auditSegmentHash":%s,"auditSequence":%s,"domain":"etf.audit.commitment.v1","keyIdentifier":%s,"previousAuditCommitment":%s}', pg_catalog.to_json(payload ->> 'auditSegmentHash')::text, next_sequence, pg_catalog.to_json(payload ->> 'keyIdentifier')::text, CASE WHEN prior_hash IS NULL THEN 'null' ELSE pg_catalog.to_json(prior_hash)::text END);
    commitment := encode(public.digest(convert_to(content, 'UTF8'), 'sha256'), 'hex');
    signature := encode(public.hmac(convert_to(content, 'UTF8'), key_bytes, 'sha256'), 'hex');
    INSERT INTO etf.audit_commitments VALUES (next_sequence, payload ->> 'auditSegmentHash', prior_hash, payload ->> 'keyIdentifier', commitment, signature, accepted);
    INSERT INTO etf.audit_anchor_checkpoints VALUES (next_sequence, commitment, payload ->> 'keyIdentifier', signature, accepted);
    RETURN jsonb_build_object('auditSequence', next_sequence, 'auditCommitment', commitment);
  END IF;
  IF variant <> 'Portfolio' OR session_user <> 'app_runtime' OR NOT payload ?& ARRAY['domain','keyIdentifier','portfolioId','ledgerSequence','transactionEvidenceHash','allocationEvidenceHash','auditEvidenceHash'] OR payload - ARRAY['domain','keyIdentifier','portfolioId','ledgerSequence','transactionEvidenceHash','allocationEvidenceHash','auditEvidenceHash']::text[] <> '{}'::jsonb OR payload ->> 'ledgerSequence' !~ '^[1-9][0-9]*$' OR payload ->> 'transactionEvidenceHash' !~ '^[0-9a-f]{64}$' OR payload ->> 'allocationEvidenceHash' !~ '^[0-9a-f]{64}$' OR payload ->> 'auditEvidenceHash' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  SELECT key_ciphertext INTO key_bytes FROM etf.anchor_keys WHERE key_identifier = payload ->> 'keyIdentifier' AND activated_at <= clock_timestamp() AND retired_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_INTEGRITY_FAILED' USING ERRCODE = '55000'; END IF;
  SELECT portfolio_commitment INTO prior_hash FROM etf.portfolio_anchor_checkpoints WHERE portfolio_id = (payload ->> 'portfolioId')::uuid FOR UPDATE;
  content := format('{"allocationEvidenceHash":"%s","auditEvidenceHash":"%s","domain":"etf.ledger.commitment.v1","ledgerSequence":%s,"portfolioId":"%s","previousPortfolioCommitment":%s,"transactionEvidenceHash":"%s"}', payload ->> 'allocationEvidenceHash', payload ->> 'auditEvidenceHash', payload ->> 'ledgerSequence', payload ->> 'portfolioId', CASE WHEN prior_hash IS NULL THEN 'null' ELSE '"' || prior_hash || '"' END, payload ->> 'transactionEvidenceHash');
  commitment := encode(public.digest(convert_to(content, 'UTF8'), 'sha256'), 'hex'); signature := encode(public.hmac(convert_to(content, 'UTF8'), key_bytes, 'sha256'), 'hex'); accepted := date_trunc('milliseconds', clock_timestamp());
  INSERT INTO etf.ledger_anchors VALUES ((payload ->> 'portfolioId')::uuid, (payload ->> 'ledgerSequence')::bigint, payload ->> 'keyIdentifier', commitment, signature, accepted);
  SELECT * INTO checkpoint FROM etf.portfolio_anchor_checkpoints WHERE portfolio_id = (payload ->> 'portfolioId')::uuid FOR UPDATE;
  INSERT INTO etf.portfolio_anchor_checkpoints (portfolio_id,ledger_sequence,portfolio_commitment,audit_sequence,audit_commitment,key_identifier,checkpoint_hmac,accepted_at)
  SELECT (payload ->> 'portfolioId')::uuid,(payload ->> 'ledgerSequence')::bigint,commitment,audit_sequence,audit_commitment,payload ->> 'keyIdentifier',signature,accepted FROM etf.audit_anchor_checkpoints ORDER BY audit_sequence DESC LIMIT 1
  ON CONFLICT (portfolio_id) DO UPDATE SET ledger_sequence=EXCLUDED.ledger_sequence,portfolio_commitment=EXCLUDED.portfolio_commitment,audit_sequence=EXCLUDED.audit_sequence,audit_commitment=EXCLUDED.audit_commitment,key_identifier=EXCLUDED.key_identifier,checkpoint_hmac=EXCLUDED.checkpoint_hmac,accepted_at=EXCLUDED.accepted_at;
  RETURN jsonb_build_object('commitmentHash', commitment, 'anchorHmac', signature);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'LEDGER_INTEGRITY_FAILED' USING ERRCODE = '22023';
END;
$function$;
REVOKE ALL ON FUNCTION etf.anchor_append(jsonb) FROM PUBLIC;

SET LOCAL ROLE audit_writer_owner;
CREATE FUNCTION etf.audit_append(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  domain_name text; outcome_name text; subject jsonb; recorded timestamp(3) with time zone; workload text; actor text; auth_hash text; audit_content text; evidence text; anchor_result jsonb;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' OR NOT payload ?& ARRAY['action','attemptIntentId','correlationId','domain','keyIdentifier','outcome','subject'] OR payload - ARRAY['action','attemptIntentId','correlationId','domain','keyIdentifier','outcome','subject']::text[] <> '{}'::jsonb OR jsonb_typeof(payload -> 'subject') <> 'object' THEN RAISE EXCEPTION 'AUDIT_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  domain_name := payload ->> 'domain'; outcome_name := payload ->> 'outcome'; subject := payload -> 'subject'; workload := session_user; actor := CASE WHEN session_user = 'app_runtime' THEN 'local-user' ELSE NULL END;
  IF NOT ((session_user = 'app_runtime' AND ((domain_name = 'Order' AND outcome_name = 'Committed') OR (domain_name = 'Ledger' AND outcome_name = 'Committed'))) OR (session_user = 'projection_runtime' AND domain_name = 'Ledger' AND outcome_name IN ('BlockedPublication','PublicationCompleted')) OR (session_user = 'audit_runtime' AND ((domain_name = 'Order' AND outcome_name IN ('IntentRecorded','Rejected')) OR (domain_name = 'Ledger' AND outcome_name IN ('IntentRecorded','Rejected','IntegrityFailed','TimeoutRecovery','RecoveryCompleted')) OR (domain_name = 'Denial' AND outcome_name = 'PermissionDenied')))) THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  recorded := date_trunc('milliseconds', clock_timestamp());
  auth_hash := encode(public.digest(convert_to(format('{"actorSubject":%s,"correlationId":"%s","sessionUser":"%s","workloadIdentity":"%s"}', CASE WHEN actor IS NULL THEN 'null' ELSE '"' || actor || '"' END, payload ->> 'correlationId', session_user, workload), 'UTF8'), 'sha256'), 'hex');
  IF domain_name = 'Order' THEN
    IF NOT subject ? 'auditId' OR subject - ARRAY['auditId','orderId','transitionCommandId','errorCode','oldOrderVersion','newOrderVersion']::text[] <> '{}'::jsonb THEN RAISE EXCEPTION 'AUDIT_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
    audit_content:=format('{"action":%s,"actorSubject":%s,"attemptIntentId":%s,"auditId":%s,"authenticationContextDigest":%s,"correlationId":%s,"errorCode":%s,"newOrderVersion":%s,"oldOrderVersion":%s,"orderId":%s,"outcome":%s,"recordedAt":%s,"transitionCommandId":%s,"workloadIdentity":%s}',pg_catalog.to_json(payload ->> 'action')::text,CASE WHEN actor IS NULL THEN 'null' ELSE pg_catalog.to_json(actor)::text END,pg_catalog.to_json((payload ->> 'attemptIntentId')::uuid::text)::text,pg_catalog.to_json((subject ->> 'auditId')::uuid::text)::text,pg_catalog.to_json(auth_hash)::text,pg_catalog.to_json((payload ->> 'correlationId')::uuid::text)::text,CASE WHEN subject ->> 'errorCode' IS NULL THEN 'null' ELSE pg_catalog.to_json(subject ->> 'errorCode')::text END,COALESCE((subject ->> 'newOrderVersion')::bigint::text,'null'),COALESCE((subject ->> 'oldOrderVersion')::bigint::text,'null'),pg_catalog.to_json((subject ->> 'orderId')::uuid::text)::text,pg_catalog.to_json(outcome_name)::text,pg_catalog.to_json(to_char(recorded AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text,CASE WHEN subject ->> 'transitionCommandId' IS NULL THEN 'null' ELSE pg_catalog.to_json((subject ->> 'transitionCommandId')::uuid::text)::text END,pg_catalog.to_json(workload)::text);
    evidence:=encode(public.digest(convert_to(audit_content,'UTF8'),'sha256'),'hex');
    INSERT INTO etf.order_audit VALUES ((subject ->> 'auditId')::uuid,(payload ->> 'attemptIntentId')::uuid,(subject ->> 'orderId')::uuid,(subject ->> 'transitionCommandId')::uuid,payload ->> 'action',outcome_name,subject ->> 'errorCode',(payload ->> 'correlationId')::uuid,(subject ->> 'oldOrderVersion')::bigint,(subject ->> 'newOrderVersion')::bigint,actor,workload,auth_hash,recorded,evidence);
  ELSIF domain_name = 'Ledger' THEN
    IF NOT subject ?& ARRAY['auditId','portfolioId','replayClassification'] OR subject - ARRAY['auditId','portfolioId','transactionId','ledgerSequence','errorCode','replayClassification','transitionCommandId','oldOrderVersion','newOrderVersion','oldPortfolioVersion','newPortfolioVersion','reversesTransactionId','reversedByTransactionId','transactionEvidenceHash','allocationEvidenceHash']::text[] <> '{}'::jsonb THEN RAISE EXCEPTION 'AUDIT_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
    audit_content:=format('{"action":%s,"actorSubject":%s,"allocationEvidenceHash":%s,"attemptIntentId":%s,"auditId":%s,"authenticationContextDigest":%s,"correlationId":%s,"errorCode":%s,"ledgerSequence":%s,"newOrderVersion":%s,"newPortfolioVersion":%s,"oldOrderVersion":%s,"oldPortfolioVersion":%s,"outcome":%s,"portfolioId":%s,"recordedAt":%s,"replayClassification":%s,"reversedByTransactionId":%s,"reversesTransactionId":%s,"transactionEvidenceHash":%s,"transactionId":%s,"transitionCommandId":%s,"workloadIdentity":%s}',pg_catalog.to_json(payload ->> 'action')::text,CASE WHEN actor IS NULL THEN 'null' ELSE pg_catalog.to_json(actor)::text END,CASE WHEN subject ->> 'allocationEvidenceHash' IS NULL THEN 'null' ELSE pg_catalog.to_json(subject ->> 'allocationEvidenceHash')::text END,pg_catalog.to_json((payload ->> 'attemptIntentId')::uuid::text)::text,pg_catalog.to_json((subject ->> 'auditId')::uuid::text)::text,pg_catalog.to_json(auth_hash)::text,pg_catalog.to_json((payload ->> 'correlationId')::uuid::text)::text,CASE WHEN subject ->> 'errorCode' IS NULL THEN 'null' ELSE pg_catalog.to_json(subject ->> 'errorCode')::text END,COALESCE((subject ->> 'ledgerSequence')::bigint::text,'null'),COALESCE((subject ->> 'newOrderVersion')::bigint::text,'null'),COALESCE((subject ->> 'newPortfolioVersion')::bigint::text,'null'),COALESCE((subject ->> 'oldOrderVersion')::bigint::text,'null'),COALESCE((subject ->> 'oldPortfolioVersion')::bigint::text,'null'),pg_catalog.to_json(outcome_name)::text,pg_catalog.to_json((subject ->> 'portfolioId')::uuid::text)::text,pg_catalog.to_json(to_char(recorded AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text,pg_catalog.to_json(subject ->> 'replayClassification')::text,CASE WHEN subject ->> 'reversedByTransactionId' IS NULL THEN 'null' ELSE pg_catalog.to_json((subject ->> 'reversedByTransactionId')::uuid::text)::text END,CASE WHEN subject ->> 'reversesTransactionId' IS NULL THEN 'null' ELSE pg_catalog.to_json((subject ->> 'reversesTransactionId')::uuid::text)::text END,CASE WHEN subject ->> 'transactionEvidenceHash' IS NULL THEN 'null' ELSE pg_catalog.to_json(subject ->> 'transactionEvidenceHash')::text END,CASE WHEN subject ->> 'transactionId' IS NULL THEN 'null' ELSE pg_catalog.to_json((subject ->> 'transactionId')::uuid::text)::text END,CASE WHEN subject ->> 'transitionCommandId' IS NULL THEN 'null' ELSE pg_catalog.to_json((subject ->> 'transitionCommandId')::uuid::text)::text END,pg_catalog.to_json(workload)::text);
    evidence:=encode(public.digest(convert_to(audit_content,'UTF8'),'sha256'),'hex');
    INSERT INTO etf.ledger_audit VALUES ((subject ->> 'auditId')::uuid,(payload ->> 'attemptIntentId')::uuid,(subject ->> 'portfolioId')::uuid,(subject ->> 'transactionId')::uuid,(subject ->> 'ledgerSequence')::bigint,payload ->> 'action',outcome_name,subject ->> 'errorCode',subject ->> 'replayClassification',(payload ->> 'correlationId')::uuid,(subject ->> 'transitionCommandId')::uuid,(subject ->> 'oldOrderVersion')::bigint,(subject ->> 'newOrderVersion')::bigint,(subject ->> 'oldPortfolioVersion')::bigint,(subject ->> 'newPortfolioVersion')::bigint,(subject ->> 'reversesTransactionId')::uuid,(subject ->> 'reversedByTransactionId')::uuid,actor,workload,auth_hash,recorded,subject ->> 'transactionEvidenceHash',subject ->> 'allocationEvidenceHash',evidence);
  ELSE
    IF domain_name <> 'Denial' OR subject - ARRAY['auditId','originalBackendPid','backendStart','originalSessionUser','denialNonce','objectClass','objectName','denialCode','deniedAt']::text[] <> '{}'::jsonb OR NOT subject ?& ARRAY['auditId','originalBackendPid','backendStart','originalSessionUser','denialNonce','objectClass','objectName','denialCode','deniedAt'] THEN RAISE EXCEPTION 'AUDIT_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid = (subject ->> 'originalBackendPid')::integer AND backend_start = (subject ->> 'backendStart')::timestamp with time zone AND usename = subject ->> 'originalSessionUser' AND application_name = 'etf-denial:' || (subject ->> 'denialNonce')) THEN RAISE EXCEPTION 'ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED' USING ERRCODE = '55000'; END IF;
    audit_content:=format('{"actorSubject":null,"authenticationContextDigest":%s,"backendPid":%s,"backendStart":%s,"correlationId":%s,"denialCode":%s,"denialNonce":%s,"deniedAt":%s,"domain":"etf.audit.denial.v1","objectClass":%s,"objectName":%s,"sessionUser":%s,"workloadIdentity":%s}',pg_catalog.to_json(auth_hash)::text,(subject ->> 'originalBackendPid')::integer,pg_catalog.to_json(to_char((subject ->> 'backendStart')::timestamp with time zone AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text,pg_catalog.to_json((payload ->> 'correlationId')::uuid::text)::text,pg_catalog.to_json(subject ->> 'denialCode')::text,pg_catalog.to_json(subject ->> 'denialNonce')::text,pg_catalog.to_json(to_char((subject ->> 'deniedAt')::timestamp with time zone AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text,pg_catalog.to_json(subject ->> 'objectClass')::text,pg_catalog.to_json(subject ->> 'objectName')::text,pg_catalog.to_json(subject ->> 'originalSessionUser')::text,pg_catalog.to_json(workload)::text);
    evidence:=encode(public.digest(convert_to(audit_content,'UTF8'),'sha256'),'hex');
    INSERT INTO etf.access_denial_audit VALUES ((subject ->> 'auditId')::uuid,(payload ->> 'correlationId')::uuid,(subject ->> 'originalBackendPid')::integer,(subject ->> 'backendStart')::timestamp with time zone,subject ->> 'originalSessionUser',subject ->> 'denialNonce',NULL,workload,auth_hash,subject ->> 'objectClass',subject ->> 'objectName',subject ->> 'denialCode',(subject ->> 'deniedAt')::timestamp with time zone,evidence) ON CONFLICT ON CONSTRAINT uq_access_denial_audit__deduplication DO NOTHING;
  END IF;
  anchor_result := etf.anchor_append(jsonb_build_object('domain','Audit','keyIdentifier',payload ->> 'keyIdentifier','auditSegmentHash',evidence));
  RETURN jsonb_build_object('auditId', subject ->> 'auditId', 'evidenceHash', evidence, 'auditSequence', anchor_result -> 'auditSequence');
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN RAISE EXCEPTION 'AUDIT_REQUEST_INVALID' USING ERRCODE = '22023';
END;
$function$;
REVOKE ALL ON FUNCTION etf.audit_append(jsonb) FROM PUBLIC;

SET LOCAL ROLE ledger_writer_owner;
CREATE FUNCTION etf.ledger_append(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  command jsonb; canonical_command text; stored jsonb; intended_effects jsonb := '[]'::jsonb; intended_allocations jsonb := '[]'::jsonb; kind text; portfolio uuid; transaction_identity uuid; current_version bigint; sequence_number bigint; recorded timestamp(3) with time zone; transaction_content text; effects_content text; allocation_content text; transaction_hash text; allocation_hash text; audit_result jsonb; anchor_result jsonb; result_value jsonb; cash_delta numeric(28,8); quantity_value numeric(28,10); price_value numeric(28,10); fee_value numeric(28,8); remaining numeric(28,10); allocated numeric(28,8); allocated_total numeric(28,8) := 0; ordinal bigint; lot_record record; order_record record; target_record etf.ledger_transactions%ROWTYPE; prior_commitment text; commitment_content text; commitment_hash text;
BEGIN
  IF session_user <> 'app_runtime' OR payload IS NULL OR jsonb_typeof(payload) <> 'object' OR NOT payload ?& ARRAY['canonicalContent','correlationId','effectiveAt','expectedPortfolioVersion','keyIdentifier','portfolioId','transactionId','type'] THEN RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501'; END IF;
  kind := payload ->> 'type'; command := (payload ->> 'canonicalContent')::jsonb;
  IF kind IN ('CashDeposit','CashWithdrawal') THEN
    canonical_command:=format('{"amount":%s,"correlationId":%s,"effectiveAt":%s,"expectedPortfolioVersion":%s,"keyIdentifier":%s,"portfolioId":%s,"transactionId":%s,"type":%s}',pg_catalog.to_json(payload ->> 'amount')::text,pg_catalog.to_json(payload ->> 'correlationId')::text,pg_catalog.to_json(payload ->> 'effectiveAt')::text,payload ->> 'expectedPortfolioVersion',pg_catalog.to_json(payload ->> 'keyIdentifier')::text,pg_catalog.to_json(payload ->> 'portfolioId')::text,pg_catalog.to_json(payload ->> 'transactionId')::text,pg_catalog.to_json(kind)::text);
  ELSIF kind IN ('BuyFill','SellFill') THEN
    canonical_command:=format('{"correlationId":%s,"effectiveAt":%s,"expectedOrderVersion":%s,"expectedPortfolioVersion":%s,"fee":%s,"fillId":%s,"instrumentId":%s,"keyIdentifier":%s,"orderId":%s,"orderSide":%s,"portfolioId":%s,"quantity":%s,"simulatedAt":%s,"transactionId":%s,"transitionCommandId":%s,"type":%s,"unitPrice":%s}',pg_catalog.to_json(payload ->> 'correlationId')::text,pg_catalog.to_json(payload ->> 'effectiveAt')::text,payload ->> 'expectedOrderVersion',payload ->> 'expectedPortfolioVersion',pg_catalog.to_json(payload ->> 'fee')::text,pg_catalog.to_json(payload ->> 'fillId')::text,pg_catalog.to_json(payload ->> 'instrumentId')::text,pg_catalog.to_json(payload ->> 'keyIdentifier')::text,pg_catalog.to_json(payload ->> 'orderId')::text,pg_catalog.to_json(payload ->> 'orderSide')::text,pg_catalog.to_json(payload ->> 'portfolioId')::text,pg_catalog.to_json(payload ->> 'quantity')::text,pg_catalog.to_json(payload ->> 'simulatedAt')::text,pg_catalog.to_json(payload ->> 'transactionId')::text,pg_catalog.to_json(payload ->> 'transitionCommandId')::text,pg_catalog.to_json(kind)::text,pg_catalog.to_json(payload ->> 'unitPrice')::text);
  ELSIF kind='Reversal' THEN
    canonical_command:=format('{"correlationId":%s,"effectiveAt":%s,"expectedPortfolioVersion":%s,"keyIdentifier":%s,"portfolioId":%s,"reversesTransactionId":%s,"transactionId":%s,"type":%s}',pg_catalog.to_json(payload ->> 'correlationId')::text,pg_catalog.to_json(payload ->> 'effectiveAt')::text,payload ->> 'expectedPortfolioVersion',pg_catalog.to_json(payload ->> 'keyIdentifier')::text,pg_catalog.to_json(payload ->> 'portfolioId')::text,pg_catalog.to_json(payload ->> 'reversesTransactionId')::text,pg_catalog.to_json(payload ->> 'transactionId')::text,pg_catalog.to_json(kind)::text);
  END IF;
  IF canonical_command IS DISTINCT FROM payload ->> 'canonicalContent' OR command <> payload - 'canonicalContent' OR payload ->> 'effectiveAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' OR payload ->> 'expectedPortfolioVersion' !~ '^(0|[1-9][0-9]*)$' THEN RAISE EXCEPTION 'LEDGER_REQUEST_INVALID' USING ERRCODE = '22023'; END IF;
  portfolio := (payload ->> 'portfolioId')::uuid; transaction_identity := (payload ->> 'transactionId')::uuid;
  SELECT replay.canonical_content,replay.result INTO command,stored FROM etf.ledger_command_replays replay WHERE replay.portfolio_id=portfolio AND replay.transaction_id=transaction_identity FOR UPDATE;
  IF FOUND THEN IF command <> (payload ->> 'canonicalContent')::jsonb THEN RAISE EXCEPTION 'LEDGER_IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF; RETURN stored; END IF;
  SELECT portfolio_version INTO current_version FROM etf.portfolios WHERE portfolio_id=portfolio FOR UPDATE;
  IF NOT FOUND THEN IF kind <> 'CashDeposit' OR (payload ->> 'expectedPortfolioVersion')::bigint <> 0 THEN RAISE EXCEPTION 'LEDGER_PORTFOLIO_NOT_FOUND' USING ERRCODE='P0002'; END IF; INSERT INTO etf.portfolios VALUES (portfolio,0,'v1.0.0','DEC-014'); current_version:=0; END IF;
  IF current_version <> (payload ->> 'expectedPortfolioVersion')::bigint THEN RAISE EXCEPTION 'LEDGER_VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
  SELECT COALESCE(max(ledger_sequence),0)+1 INTO sequence_number FROM etf.ledger_transactions WHERE portfolio_id=portfolio; recorded:=date_trunc('milliseconds',clock_timestamp());
  IF kind IN ('CashDeposit','CashWithdrawal') THEN
    IF payload - ARRAY['canonicalContent','correlationId','effectiveAt','expectedPortfolioVersion','keyIdentifier','portfolioId','transactionId','type','amount']::text[] <> '{}'::jsonb OR payload ->> 'amount' !~ '^(0|[1-9][0-9]*)\.[0-9]{8}$' OR (payload ->> 'amount')::numeric <= 0 THEN RAISE EXCEPTION 'LEDGER_INVALID_DECIMAL' USING ERRCODE='22023'; END IF;
    cash_delta := (payload ->> 'amount')::numeric * CASE WHEN kind='CashDeposit' THEN 1 ELSE -1 END;
    IF COALESCE((SELECT sum(money) FROM etf.ledger_effects WHERE portfolio_id=portfolio AND effect_type='Cash'),0)+cash_delta < 0 THEN RAISE EXCEPTION 'LEDGER_INSUFFICIENT_CASH' USING ERRCODE='P0001'; END IF;
  ELSIF kind IN ('BuyFill','SellFill') THEN
    IF payload - ARRAY['canonicalContent','correlationId','effectiveAt','expectedOrderVersion','expectedPortfolioVersion','fee','fillId','instrumentId','keyIdentifier','orderId','orderSide','portfolioId','quantity','simulatedAt','transactionId','transitionCommandId','type','unitPrice']::text[] <> '{}'::jsonb OR payload ->> 'quantity' !~ '^(0|[1-9][0-9]*)\.[0-9]{10}$' OR payload ->> 'unitPrice' !~ '^(0|[1-9][0-9]*)\.[0-9]{10}$' OR payload ->> 'fee' !~ '^(0|[1-9][0-9]*)\.[0-9]{8}$' THEN RAISE EXCEPTION 'LEDGER_INVALID_DECIMAL' USING ERRCODE='22023'; END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('etf:paper-order:' || (payload ->> 'orderId'),0));
    SELECT order_id,instrument_id,side,aggregate_version INTO order_record FROM etf.paper_orders WHERE order_id=(payload ->> 'orderId')::uuid;
    IF NOT FOUND OR order_record.instrument_id <> payload ->> 'instrumentId' OR order_record.side <> payload ->> 'orderSide' OR order_record.aggregate_version <> (payload ->> 'expectedOrderVersion')::bigint OR (order_record.side='Buy') <> (kind='BuyFill') THEN RAISE EXCEPTION 'LEDGER_ORDER_MISMATCH' USING ERRCODE='P0001'; END IF;
    quantity_value:=(payload ->> 'quantity')::numeric; price_value:=(payload ->> 'unitPrice')::numeric; fee_value:=(payload ->> 'fee')::numeric;
    cash_delta:=round(quantity_value*price_value,8)*CASE WHEN kind='BuyFill' THEN -1 ELSE 1 END-fee_value;
    IF COALESCE((SELECT sum(money) FROM etf.ledger_effects WHERE portfolio_id=portfolio AND effect_type='Cash'),0)+cash_delta < 0 THEN RAISE EXCEPTION 'LEDGER_INSUFFICIENT_CASH' USING ERRCODE='P0001'; END IF;
    INSERT INTO etf.fills VALUES (portfolio,(payload ->> 'fillId')::uuid,order_record.order_id,(payload ->> 'transitionCommandId')::uuid,transaction_identity,quantity_value,price_value,fee_value,(payload ->> 'simulatedAt')::timestamp with time zone);
  ELSIF kind = 'Reversal' THEN
    IF payload - ARRAY['canonicalContent','correlationId','effectiveAt','expectedPortfolioVersion','keyIdentifier','portfolioId','reversesTransactionId','transactionId','type']::text[] <> '{}'::jsonb THEN RAISE EXCEPTION 'LEDGER_REQUEST_INVALID' USING ERRCODE='22023'; END IF;
    SELECT * INTO target_record FROM etf.ledger_transactions WHERE portfolio_id=portfolio AND transaction_id=(payload ->> 'reversesTransactionId')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_TRANSACTION_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    IF EXISTS (SELECT 1 FROM etf.ledger_reversal_links WHERE portfolio_id=portfolio AND target_transaction_id=target_record.transaction_id) THEN RAISE EXCEPTION 'LEDGER_ALREADY_REVERSED' USING ERRCODE='P0001'; END IF;
    IF EXISTS (
      SELECT 1
        FROM etf.ledger_effects target_effect
       WHERE target_effect.portfolio_id=portfolio
         AND target_effect.transaction_id=target_record.transaction_id
         AND (
           (pg_catalog.right(target_effect.effect_type,4)='Cash' AND COALESCE((SELECT sum(current_effect.money) FROM etf.ledger_effects current_effect WHERE current_effect.portfolio_id=portfolio AND pg_catalog.right(current_effect.effect_type,4)='Cash'),0)-target_effect.money<0)
           OR (pg_catalog.right(target_effect.effect_type,8)='Position' AND COALESCE((SELECT sum(current_effect.quantity) FROM etf.ledger_effects current_effect WHERE current_effect.portfolio_id=portfolio AND current_effect.instrument_id=target_effect.instrument_id AND current_effect.lot_id IS NOT DISTINCT FROM target_effect.lot_id AND pg_catalog.right(current_effect.effect_type,8)='Position'),0)-target_effect.quantity<0)
           OR (pg_catalog.right(target_effect.effect_type,5)='Basis' AND COALESCE((SELECT sum(current_effect.money) FROM etf.ledger_effects current_effect WHERE current_effect.portfolio_id=portfolio AND current_effect.instrument_id=target_effect.instrument_id AND current_effect.lot_id IS NOT DISTINCT FROM target_effect.lot_id AND pg_catalog.right(current_effect.effect_type,5)='Basis'),0)-target_effect.money<0)
         )
    ) THEN RAISE EXCEPTION 'LEDGER_REVERSAL_DEPENDENCY' USING ERRCODE='P0001'; END IF;
  ELSE RAISE EXCEPTION 'LEDGER_REQUEST_INVALID' USING ERRCODE='22023'; END IF;
  IF kind IN ('CashDeposit','CashWithdrawal','BuyFill','SellFill') THEN
    intended_effects := intended_effects || jsonb_build_array(jsonb_build_object('effect_ordinal',0,'effect_type','Cash','instrument_id',NULL,'lot_id',NULL,'source_effect_id',NULL,'quantity',NULL,'money',cash_delta,'rate',NULL));
  END IF;
  IF kind='BuyFill' THEN
    intended_effects := intended_effects || jsonb_build_array(
      jsonb_build_object('effect_ordinal',1,'effect_type','Position','instrument_id',payload ->> 'instrumentId','lot_id',(payload ->> 'fillId')::uuid,'source_effect_id',NULL,'quantity',quantity_value,'money',NULL,'rate',NULL),
      jsonb_build_object('effect_ordinal',2,'effect_type','Basis','instrument_id',payload ->> 'instrumentId','lot_id',(payload ->> 'fillId')::uuid,'source_effect_id',NULL,'quantity',NULL,'money',round(quantity_value*price_value,8)+fee_value,'rate',NULL));
  ELSIF kind='SellFill' THEN
    remaining:=quantity_value; ordinal:=1;
    FOR lot_record IN SELECT lot.*,COALESCE((SELECT sum(effect.quantity) FROM etf.ledger_effects effect WHERE effect.portfolio_id=lot.portfolio_id AND effect.lot_id=lot.lot_id AND pg_catalog.right(effect.effect_type,8)='Position'),0) AS available,COALESCE((SELECT sum(effect.money) FROM etf.ledger_effects effect WHERE effect.portfolio_id=lot.portfolio_id AND effect.lot_id=lot.lot_id AND pg_catalog.right(effect.effect_type,5)='Basis'),0) AS remaining_basis FROM etf.ledger_lots lot WHERE lot.portfolio_id=portfolio AND lot.instrument_id=payload ->> 'instrumentId' ORDER BY acquired_at,ledger_sequence,lot_id FOR SHARE LOOP
      EXIT WHEN remaining=0; IF lot_record.available<=0 THEN CONTINUE; END IF; allocated:=CASE WHEN least(remaining,lot_record.available)=lot_record.available THEN lot_record.remaining_basis ELSE round(lot_record.original_basis*(least(remaining,lot_record.available)/lot_record.original_quantity),8) END;
      intended_effects := intended_effects || jsonb_build_array(jsonb_build_object('effect_ordinal',ordinal,'effect_type','Position','instrument_id',payload ->> 'instrumentId','lot_id',lot_record.lot_id,'source_effect_id',NULL,'quantity',-least(remaining,lot_record.available),'money',NULL,'rate',NULL));
      intended_allocations := intended_allocations || jsonb_build_array(jsonb_build_object('effect_ordinal',ordinal,'lot_id',lot_record.lot_id,'consumed_quantity',least(remaining,lot_record.available),'allocated_basis',allocated));
      intended_effects := intended_effects || jsonb_build_array(jsonb_build_object('effect_ordinal',ordinal+1,'effect_type','Basis','instrument_id',payload ->> 'instrumentId','lot_id',lot_record.lot_id,'source_effect_id',NULL,'quantity',NULL,'money',-allocated,'rate',NULL));
      allocated_total:=allocated_total+allocated; remaining:=remaining-least(remaining,lot_record.available); ordinal:=ordinal+2;
    END LOOP;
    IF remaining<>0 THEN RAISE EXCEPTION 'LEDGER_INSUFFICIENT_POSITION' USING ERRCODE='P0001'; END IF;
    intended_effects := intended_effects || jsonb_build_array(jsonb_build_object('effect_ordinal',ordinal,'effect_type','RealizedPnL','instrument_id',payload ->> 'instrumentId','lot_id',NULL,'source_effect_id',NULL,'quantity',NULL,'money',cash_delta-allocated_total,'rate',NULL));
  ELSIF kind='Reversal' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('effect_ordinal',effect.effect_ordinal,'effect_type','Reversal:'||effect.effect_type,'instrument_id',effect.instrument_id,'lot_id',effect.lot_id,'source_effect_id',NULL,'quantity',-effect.quantity,'money',-effect.money,'rate',-effect.rate) ORDER BY effect.effect_ordinal),'[]'::jsonb)
      INTO intended_effects
      FROM etf.ledger_effects effect
     WHERE effect.portfolio_id=portfolio AND effect.transaction_id=target_record.transaction_id;
  END IF;
  SELECT '[' || COALESCE(pg_catalog.string_agg(
    format('{"effectOrdinal":%s,"effectType":%s,"instrumentId":%s,"lotId":%s,"money":%s,"quantity":%s,"rate":%s,"sourceEffectId":%s}',
      effect.effect_ordinal,
      pg_catalog.to_json(effect.effect_type)::text,
      CASE WHEN effect.instrument_id IS NULL THEN 'null' ELSE pg_catalog.to_json(effect.instrument_id)::text END,
      CASE WHEN effect.lot_id IS NULL THEN 'null' ELSE pg_catalog.to_json(effect.lot_id::text)::text END,
      CASE WHEN effect.money IS NULL THEN 'null' ELSE pg_catalog.to_json(effect.money::text)::text END,
      CASE WHEN effect.quantity IS NULL THEN 'null' ELSE pg_catalog.to_json(effect.quantity::text)::text END,
      CASE WHEN effect.rate IS NULL THEN 'null' ELSE pg_catalog.to_json(effect.rate::text)::text END,
      CASE WHEN effect.source_effect_id IS NULL THEN 'null' ELSE pg_catalog.to_json(effect.source_effect_id::text)::text END),
    ',' ORDER BY effect.effect_ordinal), '') || ']'
    INTO effects_content
    FROM jsonb_to_recordset(intended_effects) AS effect(effect_ordinal bigint,effect_type text,instrument_id text,lot_id uuid,source_effect_id uuid,quantity numeric(28,10),money numeric(28,8),rate numeric(28,12));
  SELECT '[' || COALESCE(pg_catalog.string_agg(
    format('{"allocatedBasis":%s,"consumedQuantity":%s,"effectOrdinal":%s,"lotId":%s,"sellTransactionId":%s}',
      pg_catalog.to_json(allocation.allocated_basis::text)::text,
      pg_catalog.to_json(allocation.consumed_quantity::text)::text,
      allocation.effect_ordinal,
      pg_catalog.to_json(allocation.lot_id::text)::text,
      pg_catalog.to_json(transaction_identity::text)::text),
    ',' ORDER BY allocation.effect_ordinal, allocation.lot_id), '') || ']'
    INTO allocation_content
    FROM jsonb_to_recordset(intended_allocations) AS allocation(effect_ordinal bigint,lot_id uuid,consumed_quantity numeric(28,10),allocated_basis numeric(28,8));
  allocation_hash:=encode(public.digest(convert_to(allocation_content,'UTF8'),'sha256'),'hex');
  transaction_content:=format('{"baselineVersion":"v1.0.0","correlationId":%s,"effectiveAt":%s,"effects":%s,"fillId":%s,"ledgerSequence":%s,"orderId":%s,"portfolioId":%s,"precisionPolicyVersion":"DEC-014","recordedAt":%s,"reversesTransactionId":%s,"transactionId":%s,"type":%s}',
    pg_catalog.to_json((payload ->> 'correlationId')::uuid::text)::text,
    pg_catalog.to_json(to_char((payload ->> 'effectiveAt')::timestamp with time zone AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text,
    effects_content,
    CASE WHEN kind IN ('BuyFill','SellFill') THEN pg_catalog.to_json((payload ->> 'fillId')::uuid::text)::text ELSE 'null' END,
    sequence_number,
    CASE WHEN kind IN ('BuyFill','SellFill') THEN pg_catalog.to_json((payload ->> 'orderId')::uuid::text)::text WHEN kind='Reversal' AND target_record.order_id IS NOT NULL THEN pg_catalog.to_json(target_record.order_id::text)::text ELSE 'null' END,
    pg_catalog.to_json(portfolio::text)::text,
    pg_catalog.to_json(to_char(recorded AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text,
    CASE WHEN kind='Reversal' THEN pg_catalog.to_json(target_record.transaction_id::text)::text ELSE 'null' END,
    pg_catalog.to_json(transaction_identity::text)::text,
    pg_catalog.to_json(kind)::text);
  transaction_hash:=encode(public.digest(convert_to(transaction_content,'UTF8'),'sha256'),'hex');
  INSERT INTO etf.ledger_transactions VALUES (portfolio,transaction_identity,sequence_number,kind,(payload ->> 'effectiveAt')::timestamp with time zone,recorded,CASE WHEN kind IN ('BuyFill','SellFill') THEN (payload ->> 'orderId')::uuid ELSE CASE WHEN kind='Reversal' THEN target_record.order_id ELSE NULL END END,CASE WHEN kind IN ('BuyFill','SellFill') THEN (payload ->> 'fillId')::uuid ELSE NULL END,(payload ->> 'correlationId')::uuid,CASE WHEN kind IN ('BuyFill','SellFill') THEN (payload ->> 'transitionCommandId')::uuid ELSE NULL END,'DEC-014','v1.0.0',CASE WHEN kind='Reversal' THEN target_record.transaction_id ELSE NULL END,transaction_hash);
  INSERT INTO etf.ledger_effects (portfolio_id,transaction_id,effect_ordinal,effect_type,instrument_id,lot_id,source_effect_id,quantity,money,rate)
    SELECT portfolio,transaction_identity,effect.effect_ordinal,effect.effect_type,effect.instrument_id,effect.lot_id,effect.source_effect_id,effect.quantity,effect.money,effect.rate
      FROM jsonb_to_recordset(intended_effects) AS effect(effect_ordinal bigint,effect_type text,instrument_id text,lot_id uuid,source_effect_id uuid,quantity numeric(28,10),money numeric(28,8),rate numeric(28,12))
     ORDER BY effect.effect_ordinal;
  IF kind='BuyFill' THEN
    INSERT INTO etf.ledger_lots VALUES (portfolio,(payload ->> 'fillId')::uuid,payload ->> 'instrumentId',(payload ->> 'simulatedAt')::timestamp with time zone,sequence_number,quantity_value,round(quantity_value*price_value,8)+fee_value);
  END IF;
  INSERT INTO etf.ledger_allocations (portfolio_id,sell_transaction_id,effect_ordinal,lot_id,consumed_quantity,allocated_basis)
    SELECT portfolio,transaction_identity,allocation.effect_ordinal,allocation.lot_id,allocation.consumed_quantity,allocation.allocated_basis
      FROM jsonb_to_recordset(intended_allocations) AS allocation(effect_ordinal bigint,lot_id uuid,consumed_quantity numeric(28,10),allocated_basis numeric(28,8))
     ORDER BY allocation.effect_ordinal,allocation.lot_id;
  IF kind='Reversal' THEN INSERT INTO etf.ledger_reversal_links VALUES (portfolio,transaction_identity,target_record.transaction_id); END IF;
  UPDATE etf.portfolios SET portfolio_version=current_version+1 WHERE portfolio_id=portfolio;
  audit_result:=etf.audit_append(jsonb_build_object('action','LedgerAppend','attemptIntentId',transaction_identity,'correlationId',payload ->> 'correlationId','domain','Ledger','keyIdentifier',payload ->> 'keyIdentifier','outcome','Committed','subject',jsonb_build_object('auditId',gen_random_uuid(),'portfolioId',portfolio,'transactionId',transaction_identity,'ledgerSequence',sequence_number,'errorCode',NULL,'replayClassification','New','transitionCommandId',payload ->> 'transitionCommandId','oldOrderVersion',payload ->> 'expectedOrderVersion','newOrderVersion',CASE WHEN payload ? 'expectedOrderVersion' THEN (payload ->> 'expectedOrderVersion')::bigint+1 ELSE NULL END,'oldPortfolioVersion',current_version,'newPortfolioVersion',current_version+1,'reversesTransactionId',payload ->> 'reversesTransactionId','reversedByTransactionId',NULL,'transactionEvidenceHash',transaction_hash,'allocationEvidenceHash',allocation_hash)));
  SELECT existing.commitment_hash INTO prior_commitment FROM etf.ledger_commitments existing WHERE existing.portfolio_id=portfolio ORDER BY existing.ledger_sequence DESC LIMIT 1 FOR UPDATE;
  commitment_content:=format('{"allocationEvidenceHash":"%s","auditEvidenceHash":"%s","domain":"etf.ledger.commitment.v1","ledgerSequence":%s,"portfolioId":"%s","previousPortfolioCommitment":%s,"transactionEvidenceHash":"%s"}',allocation_hash,audit_result ->> 'evidenceHash',sequence_number,portfolio,CASE WHEN prior_commitment IS NULL THEN 'null' ELSE '"'||prior_commitment||'"' END,transaction_hash);
  commitment_hash:=encode(public.digest(convert_to(commitment_content,'UTF8'),'sha256'),'hex');
  INSERT INTO etf.ledger_commitments VALUES (portfolio,sequence_number,transaction_hash,allocation_hash,audit_result ->> 'evidenceHash',prior_commitment,commitment_hash);
  anchor_result:=etf.anchor_append(jsonb_build_object('domain','Portfolio','keyIdentifier',payload ->> 'keyIdentifier','portfolioId',portfolio,'ledgerSequence',sequence_number,'transactionEvidenceHash',transaction_hash,'allocationEvidenceHash',allocation_hash,'auditEvidenceHash',audit_result ->> 'evidenceHash'));
  IF anchor_result ->> 'commitmentHash' <> commitment_hash THEN RAISE EXCEPTION 'LEDGER_INTEGRITY_FAILED' USING ERRCODE='55000'; END IF;
  result_value:=jsonb_build_object('portfolioId',portfolio,'portfolioVersion',current_version+1,'transactionId',transaction_identity,'ledgerSequence',sequence_number,'transactionEvidenceHash',transaction_hash,'allocationEvidenceHash',allocation_hash,'commitmentHash',anchor_result ->> 'commitmentHash');
  INSERT INTO etf.ledger_command_replays VALUES (portfolio,transaction_identity,(payload ->> 'canonicalContent')::jsonb,result_value,recorded); RETURN result_value;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN RAISE EXCEPTION 'LEDGER_REQUEST_INVALID' USING ERRCODE='22023';
END;
$function$;
REVOKE ALL ON FUNCTION etf.ledger_append(jsonb) FROM PUBLIC;

SET LOCAL ROLE application_writer_owner;
CREATE FUNCTION etf.paper_order_transition(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE
  canonical jsonb; canonical_command text; idempotency_content jsonb; transition_content text; replay etf.order_command_replays%ROWTYPE; current_order etf.paper_orders%ROWTYPE; transition_name text; source_name text; target_name text; trigger_name text; next_version bigint; fill_quantity numeric(28,10); result_value jsonb; ledger_payload jsonb;
BEGIN
  IF session_user <> 'app_runtime' OR payload IS NULL OR jsonb_typeof(payload)<>'object' OR NOT payload ?& ARRAY['canonicalContent','correlationId','occurredAt','operation','orderId','transitionCommandId','expectedVersion','transition','transitionPayload'] OR payload - ARRAY['canonicalContent','correlationId','occurredAt','operation','orderId','transitionCommandId','expectedVersion','transition','transitionPayload']::text[] <> '{}'::jsonb THEN RAISE EXCEPTION 'permission denied' USING ERRCODE='42501'; END IF;
  transition_name:=payload ->> 'transition';
  IF transition_name='OT-01' THEN
    transition_content:=format('{"instrumentId":%s,"quantity":%s,"researchEvidenceId":%s,"side":%s,"tradeDate":%s,"unitPrice":%s}',pg_catalog.to_json(payload #>> '{transitionPayload,instrumentId}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,quantity}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,researchEvidenceId}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,side}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,tradeDate}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,unitPrice}')::text);
  ELSIF transition_name='OT-02' THEN
    transition_content:=format('{"confirmation":{"actorId":%s,"confirmationText":%s,"confirmedAt":%s}}',pg_catalog.to_json(payload #>> '{transitionPayload,confirmation,actorId}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,confirmation,confirmationText}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,confirmation,confirmedAt}')::text);
  ELSIF transition_name='OT-03' THEN
    transition_content:=format('{"expectedPortfolioVersion":%s,"portfolioId":%s,"validationSnapshotId":%s}',payload #>> '{transitionPayload,expectedPortfolioVersion}',pg_catalog.to_json(payload #>> '{transitionPayload,portfolioId}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,validationSnapshotId}')::text);
  ELSIF transition_name='OT-04' THEN
    transition_content:=format('{"rejectionCode":%s}',pg_catalog.to_json(payload #>> '{transitionPayload,rejectionCode}')::text);
  ELSIF transition_name IN ('OT-05','OT-06','OT-09') THEN
    transition_content:=format('{"expectedPortfolioVersion":%s,"fee":%s,"fillId":%s,"portfolioId":%s,"quantity":%s,"transactionId":%s,"unitPrice":%s}',payload #>> '{transitionPayload,expectedPortfolioVersion}',pg_catalog.to_json(payload #>> '{transitionPayload,fee}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,fillId}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,portfolioId}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,quantity}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,transactionId}')::text,pg_catalog.to_json(payload #>> '{transitionPayload,unitPrice}')::text);
  ELSIF transition_name IN ('OT-07','OT-10') THEN
    transition_content:=format('{"reasonCode":%s}',pg_catalog.to_json(payload #>> '{transitionPayload,reasonCode}')::text);
  ELSIF transition_name='OT-08' THEN
    transition_content:=format('{"expiresAt":%s}',pg_catalog.to_json(payload #>> '{transitionPayload,expiresAt}')::text);
  END IF;
  canonical_command:=format('{"correlationId":%s,"expectedVersion":%s,"occurredAt":%s,"operation":%s,"orderId":%s,"transition":%s,"transitionCommandId":%s,"transitionPayload":%s}',pg_catalog.to_json(payload ->> 'correlationId')::text,payload ->> 'expectedVersion',pg_catalog.to_json(payload ->> 'occurredAt')::text,pg_catalog.to_json(payload ->> 'operation')::text,pg_catalog.to_json(payload ->> 'orderId')::text,pg_catalog.to_json(transition_name)::text,pg_catalog.to_json(payload ->> 'transitionCommandId')::text,transition_content);
  canonical:=(payload ->> 'canonicalContent')::jsonb; IF canonical_command IS DISTINCT FROM payload ->> 'canonicalContent' OR canonical<>payload-'canonicalContent' OR payload ->> 'occurredAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' OR payload ->> 'expectedVersion' !~ '^(0|[1-9][0-9]*)$' OR jsonb_typeof(payload -> 'transitionPayload')<>'object' THEN RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE='22023'; END IF;
  idempotency_content:=canonical-'correlationId';
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('etf:paper-order:' || (payload ->> 'orderId'),0));
  SELECT * INTO replay FROM etf.order_command_replays WHERE order_id=(payload ->> 'orderId')::uuid AND transition_command_id=(payload ->> 'transitionCommandId')::uuid FOR UPDATE;
  IF FOUND THEN IF replay.canonical_content<>idempotency_content THEN RAISE EXCEPTION 'ORDER_IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001'; END IF; RETURN replay.result; END IF;
  IF payload ->> 'operation'='DraftCreate' THEN
    IF transition_name<>'OT-01' OR (payload ->> 'expectedVersion')::bigint<>0 OR (payload -> 'transitionPayload') - ARRAY['instrumentId','researchEvidenceId','side','quantity','unitPrice','tradeDate']::text[]<>'{}'::jsonb OR NOT ((payload -> 'transitionPayload') ?& ARRAY['instrumentId','researchEvidenceId','side','quantity','unitPrice','tradeDate']) THEN RAISE EXCEPTION 'ORDER_INVALID_TRANSITION' USING ERRCODE='P0001'; END IF;
    INSERT INTO etf.paper_orders VALUES ((payload ->> 'orderId')::uuid,payload #>> '{transitionPayload,instrumentId}','Draft',1,(payload #>> '{transitionPayload,researchEvidenceId}')::uuid,payload #>> '{transitionPayload,side}',(payload #>> '{transitionPayload,quantity}')::numeric,0,(payload #>> '{transitionPayload,quantity}')::numeric,(payload #>> '{transitionPayload,unitPrice}')::numeric,(payload #>> '{transitionPayload,tradeDate}')::date,NULL) RETURNING * INTO current_order;
    source_name:='Initial';target_name:='Draft';trigger_name:='UserCreatedFromResearch';next_version:=1;
  ELSE
    IF payload ->> 'operation'<>'Transition' OR transition_name='OT-01' THEN RAISE EXCEPTION 'ORDER_INVALID_TRANSITION' USING ERRCODE='P0001'; END IF;
    SELECT * INTO current_order FROM etf.paper_orders WHERE order_id=(payload ->> 'orderId')::uuid FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    IF current_order.aggregate_version<>(payload ->> 'expectedVersion')::bigint THEN RAISE EXCEPTION 'ORDER_VERSION_CONFLICT' USING ERRCODE='40001'; END IF; source_name:=current_order.state; next_version:=current_order.aggregate_version+1;
    SELECT target_state,transition_trigger INTO target_name,trigger_name FROM (VALUES ('OT-02','Draft','Submitted','UserConfirmedPaperAction'),('OT-03','Submitted','Accepted','PortfolioValidationPassed'),('OT-04','Submitted','Rejected','PortfolioValidationFailed'),('OT-05','Accepted','Partial','LocalPartialFillSimulated'),('OT-06','Accepted','Filled','LocalCompleteFillSimulated'),('OT-07','Accepted','Canceled','UserCanceledOpenQuantity'),('OT-08','Accepted','Expired','DeterministicExpiryReached'),('OT-09','Partial','Filled','LocalRemainderFillSimulated'),('OT-10','Partial','Canceled','UserCanceledRemainingQuantity')) allowed(name,source_state,target_state,transition_trigger) WHERE name=transition_name AND source_state=current_order.state;
    IF NOT FOUND THEN IF current_order.state IN ('Filled','Rejected','Canceled','Expired') THEN RAISE EXCEPTION 'ORDER_TERMINAL_STATE' USING ERRCODE='P0001'; ELSE RAISE EXCEPTION 'ORDER_INVALID_TRANSITION' USING ERRCODE='P0001'; END IF; END IF;
    IF transition_name IN ('OT-05','OT-06','OT-09') THEN
      IF (payload -> 'transitionPayload') - ARRAY['portfolioId','transactionId','fillId','expectedPortfolioVersion','quantity','unitPrice','fee']::text[]<>'{}'::jsonb OR NOT ((payload -> 'transitionPayload') ?& ARRAY['portfolioId','transactionId','fillId','expectedPortfolioVersion','quantity','unitPrice','fee']) THEN RAISE EXCEPTION 'ORDER_GUARD_FAILED' USING ERRCODE='P0001'; END IF;
      fill_quantity:=(payload #>> '{transitionPayload,quantity}')::numeric; IF fill_quantity<=0 OR (transition_name='OT-05' AND fill_quantity>=current_order.open_quantity) OR (transition_name IN ('OT-06','OT-09') AND fill_quantity<>current_order.open_quantity) THEN RAISE EXCEPTION 'ORDER_GUARD_FAILED' USING ERRCODE='P0001'; END IF;
    END IF;
    UPDATE etf.paper_orders SET state=target_name,aggregate_version=next_version,filled_quantity=filled_quantity+COALESCE(fill_quantity,0),open_quantity=CASE WHEN transition_name IN ('OT-04','OT-07','OT-08','OT-10') THEN 0 ELSE open_quantity-COALESCE(fill_quantity,0) END,confirmation=CASE WHEN transition_name='OT-02' THEN payload #> '{transitionPayload,confirmation}' ELSE confirmation END WHERE order_id=current_order.order_id RETURNING * INTO current_order;
  END IF;
  INSERT INTO etf.order_transitions VALUES (current_order.order_id,(payload ->> 'transitionCommandId')::uuid,transition_name,source_name,target_name,trigger_name,payload -> 'transitionPayload',(payload ->> 'occurredAt')::timestamp with time zone,'local-user',(payload ->> 'correlationId')::uuid,next_version-1,next_version,'v1.0.0');
  IF transition_name IN ('OT-05','OT-06','OT-09') THEN
    ledger_payload:=jsonb_build_object('correlationId',payload ->> 'correlationId','effectiveAt',payload ->> 'occurredAt','expectedOrderVersion',next_version,'expectedPortfolioVersion',(payload #>> '{transitionPayload,expectedPortfolioVersion}')::bigint,'fee',payload #>> '{transitionPayload,fee}','fillId',payload #>> '{transitionPayload,fillId}','instrumentId',current_order.instrument_id,'keyIdentifier','primary','orderId',current_order.order_id,'orderSide',current_order.side,'portfolioId',payload #>> '{transitionPayload,portfolioId}','quantity',payload #>> '{transitionPayload,quantity}','simulatedAt',payload ->> 'occurredAt','transactionId',payload #>> '{transitionPayload,transactionId}','transitionCommandId',payload ->> 'transitionCommandId','type',CASE WHEN current_order.side='Buy' THEN 'BuyFill' ELSE 'SellFill' END,'unitPrice',payload #>> '{transitionPayload,unitPrice}');
    ledger_payload:=ledger_payload||jsonb_build_object('canonicalContent',format('{"correlationId":%s,"effectiveAt":%s,"expectedOrderVersion":%s,"expectedPortfolioVersion":%s,"fee":%s,"fillId":%s,"instrumentId":%s,"keyIdentifier":"primary","orderId":%s,"orderSide":%s,"portfolioId":%s,"quantity":%s,"simulatedAt":%s,"transactionId":%s,"transitionCommandId":%s,"type":%s,"unitPrice":%s}',pg_catalog.to_json(ledger_payload ->> 'correlationId')::text,pg_catalog.to_json(ledger_payload ->> 'effectiveAt')::text,ledger_payload ->> 'expectedOrderVersion',ledger_payload ->> 'expectedPortfolioVersion',pg_catalog.to_json(ledger_payload ->> 'fee')::text,pg_catalog.to_json(ledger_payload ->> 'fillId')::text,pg_catalog.to_json(ledger_payload ->> 'instrumentId')::text,pg_catalog.to_json(ledger_payload ->> 'orderId')::text,pg_catalog.to_json(ledger_payload ->> 'orderSide')::text,pg_catalog.to_json(ledger_payload ->> 'portfolioId')::text,pg_catalog.to_json(ledger_payload ->> 'quantity')::text,pg_catalog.to_json(ledger_payload ->> 'simulatedAt')::text,pg_catalog.to_json(ledger_payload ->> 'transactionId')::text,pg_catalog.to_json(ledger_payload ->> 'transitionCommandId')::text,pg_catalog.to_json(ledger_payload ->> 'type')::text,pg_catalog.to_json(ledger_payload ->> 'unitPrice')::text)); PERFORM etf.ledger_append(ledger_payload);
  END IF;
  result_value:=jsonb_build_object('orderId',current_order.order_id,'instrumentId',current_order.instrument_id,'state',current_order.state,'aggregateVersion',current_order.aggregate_version,'researchEvidenceId',current_order.research_evidence_id,'side',current_order.side,'requestedQuantity',to_char(current_order.requested_quantity,'FM99999999999999990.0000000000'),'filledQuantity',to_char(current_order.filled_quantity,'FM99999999999999990.0000000000'),'openQuantity',to_char(current_order.open_quantity,'FM99999999999999990.0000000000'),'unitPrice',to_char(current_order.unit_price,'FM99999999999999990.0000000000'),'tradeDate',to_char(current_order.trade_date,'YYYY-MM-DD'),'confirmation',current_order.confirmation);
  INSERT INTO etf.order_command_replays VALUES (current_order.order_id,(payload ->> 'transitionCommandId')::uuid,idempotency_content,result_value,date_trunc('milliseconds',clock_timestamp()));
  PERFORM etf.audit_append(jsonb_build_object('action','PaperOrderTransition','attemptIntentId',payload ->> 'transitionCommandId','correlationId',payload ->> 'correlationId','domain','Order','keyIdentifier','primary','outcome','Committed','subject',jsonb_build_object('auditId',gen_random_uuid(),'orderId',current_order.order_id,'transitionCommandId',payload ->> 'transitionCommandId','errorCode',NULL,'oldOrderVersion',next_version-1,'newOrderVersion',next_version)));
  RETURN result_value;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN RAISE EXCEPTION 'APPLICATION_REQUEST_INVALID' USING ERRCODE='22023';
END;
$function$;
REVOKE ALL ON FUNCTION etf.paper_order_transition(jsonb) FROM PUBLIC;

SET LOCAL ROLE projection_owner;
CREATE FUNCTION etf.projection_publish(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE PARALLEL UNSAFE SECURITY DEFINER
SET search_path = pg_catalog, etf
AS $function$
DECLARE verified boolean; audit_outcome text; audit_error text; audit_result jsonb;
BEGIN
  IF session_user<>'projection_runtime' OR payload IS NULL OR jsonb_typeof(payload)<>'object' OR NOT payload ?& ARRAY['asOf','cash','keyIdentifier','lots','portfolioId','portfolioVersion','positions','realizedPnL','reconciliationState','sourceCommitmentHash','totalEquity','valuationSnapshotId'] OR payload-ARRAY['asOf','cash','keyIdentifier','lots','portfolioId','portfolioVersion','positions','realizedPnL','reconciliationState','sourceCommitmentHash','totalEquity','valuationSnapshotId']::text[]<>'{}'::jsonb THEN RAISE EXCEPTION 'permission denied' USING ERRCODE='42501'; END IF;
  verified:=(etf.anchor_append(jsonb_build_object('domain','Verify','portfolioId',payload ->> 'portfolioId','sourceCommitmentHash',payload ->> 'sourceCommitmentHash'))->>'verified')::boolean;
  IF payload ->> 'reconciliationState'='Reconciled' AND verified THEN
    INSERT INTO etf.portfolio_projections VALUES ((payload ->> 'portfolioId')::uuid,(payload ->> 'valuationSnapshotId')::uuid,(payload ->> 'portfolioVersion')::bigint,(payload ->> 'asOf')::timestamp with time zone,(payload ->> 'cash')::numeric,payload -> 'lots',payload -> 'positions',(payload ->> 'realizedPnL')::numeric,(payload ->> 'totalEquity')::numeric,'Reconciled',payload ->> 'sourceCommitmentHash') ON CONFLICT (portfolio_id,valuation_snapshot_id) DO UPDATE SET portfolio_version=EXCLUDED.portfolio_version,as_of=EXCLUDED.as_of,cash=EXCLUDED.cash,lots=EXCLUDED.lots,positions=EXCLUDED.positions,realized_pnl=EXCLUDED.realized_pnl,total_equity=EXCLUDED.total_equity,reconciliation_state=EXCLUDED.reconciliation_state,source_commitment_hash=EXCLUDED.source_commitment_hash;
    audit_outcome:='PublicationCompleted';audit_error:=NULL;
  ELSE audit_outcome:='BlockedPublication';audit_error:='LEDGER_INTEGRITY_FAILED'; END IF;
  audit_result:=etf.audit_append(jsonb_build_object('action','ProjectionPublish','attemptIntentId',payload ->> 'valuationSnapshotId','correlationId',payload ->> 'valuationSnapshotId','domain','Ledger','keyIdentifier',payload ->> 'keyIdentifier','outcome',audit_outcome,'subject',jsonb_build_object('auditId',gen_random_uuid(),'portfolioId',payload ->> 'portfolioId','transactionId',NULL,'ledgerSequence',NULL,'errorCode',audit_error,'replayClassification','NotApplicable','transitionCommandId',NULL,'oldOrderVersion',NULL,'newOrderVersion',NULL,'oldPortfolioVersion',payload ->> 'portfolioVersion','newPortfolioVersion',NULL,'reversesTransactionId',NULL,'reversedByTransactionId',NULL,'transactionEvidenceHash',NULL,'allocationEvidenceHash',NULL)));
  RETURN jsonb_build_object('published',audit_outcome='PublicationCompleted','auditId',audit_result ->> 'auditId');
END;
$function$;
REVOKE ALL ON FUNCTION etf.projection_publish(jsonb) FROM PUBLIC;

SET LOCAL ROLE application_writer_owner;
GRANT SELECT (order_id, instrument_id, side, aggregate_version) ON etf.paper_orders TO ledger_writer_owner;
REVOKE REFERENCES ON etf.order_transitions FROM ledger_writer_owner;
SET LOCAL ROLE ledger_writer_owner;
REVOKE REFERENCES ON etf.portfolios, etf.ledger_transactions FROM audit_writer_owner;
REVOKE REFERENCES ON etf.portfolios, etf.ledger_commitments FROM anchor_owner, projection_owner;
GRANT EXECUTE ON FUNCTION etf.ledger_append(jsonb) TO application_writer_owner;
SET LOCAL ROLE audit_writer_owner;
GRANT EXECUTE ON FUNCTION etf.audit_append(jsonb) TO application_writer_owner, ledger_writer_owner, projection_owner;
SET LOCAL ROLE anchor_owner;
GRANT EXECUTE ON FUNCTION etf.anchor_append(jsonb) TO ledger_writer_owner, audit_writer_owner, projection_owner;

SET LOCAL ROLE schema_owner;
REVOKE CREATE ON SCHEMA etf FROM application_writer_owner;
REVOKE CREATE ON SCHEMA etf FROM ledger_writer_owner;
REVOKE CREATE ON SCHEMA etf FROM projection_owner;
REVOKE CREATE ON SCHEMA etf FROM audit_writer_owner;
REVOKE CREATE ON SCHEMA etf FROM anchor_owner;
SET LOCAL ROLE migration_owner;
`;

export const domainLedgerMigration: MigrationArtifact = {
  migrationId: "0003-domain-ledger",
  sequence: 3,
  sql,
};
