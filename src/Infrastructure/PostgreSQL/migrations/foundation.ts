import type { MigrationArtifact } from "../migration-set.js";

export const foundationTableNames = [
  "schema_migrations",
  "anchor_keys",
  "portfolio_anchor_checkpoints",
  "audit_anchor_checkpoints",
] as const;

const sql = `SET LOCAL ROLE schema_owner;
GRANT USAGE, CREATE ON SCHEMA etf TO migration_owner;
GRANT USAGE, CREATE ON SCHEMA etf TO anchor_owner;
SET LOCAL ROLE migration_owner;

CREATE TABLE etf.schema_migrations (
  sequence bigint NOT NULL,
  migration_id text COLLATE "C" NOT NULL,
  content_hash character(64) COLLATE "C" NOT NULL,
  applied_at timestamp(3) with time zone NOT NULL,
  schema_manifest_hash character(64) COLLATE "C" NOT NULL,
  CONSTRAINT pk_schema_migrations PRIMARY KEY (sequence),
  CONSTRAINT uq_schema_migrations__migration_id UNIQUE (migration_id),
  CONSTRAINT ck_schema_migrations__sequence_positive CHECK (sequence > 0),
  CONSTRAINT ck_schema_migrations__content_hash_lower_hex CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_schema_migrations__schema_manifest_hash_lower_hex CHECK (schema_manifest_hash ~ '^[0-9a-f]{64}$')
);

SET LOCAL ROLE anchor_owner;

CREATE TABLE etf.anchor_keys (
  key_identifier text COLLATE "C" NOT NULL,
  key_ciphertext bytea NOT NULL,
  activated_at timestamp(3) with time zone NOT NULL,
  retired_at timestamp(3) with time zone,
  CONSTRAINT pk_anchor_keys PRIMARY KEY (key_identifier),
  CONSTRAINT ck_anchor_keys__retirement_order CHECK (retired_at IS NULL OR retired_at >= activated_at)
);

CREATE TABLE etf.portfolio_anchor_checkpoints (
  portfolio_id uuid NOT NULL,
  ledger_sequence bigint NOT NULL,
  portfolio_commitment character(64) COLLATE "C" NOT NULL,
  audit_sequence bigint NOT NULL,
  audit_commitment character(64) COLLATE "C" NOT NULL,
  key_identifier text COLLATE "C" NOT NULL,
  checkpoint_hmac character(64) COLLATE "C" NOT NULL,
  accepted_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_portfolio_anchor_checkpoints PRIMARY KEY (portfolio_id),
  CONSTRAINT fk_portfolio_anchor_checkpoints__key_identifier__anchor_keys FOREIGN KEY (key_identifier) REFERENCES etf.anchor_keys (key_identifier) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_portfolio_anchor_checkpoints__ledger_sequence_positive CHECK (ledger_sequence > 0),
  CONSTRAINT ck_portfolio_anchor_checkpoints__audit_sequence_positive CHECK (audit_sequence > 0),
  CONSTRAINT ck_portfolio_anchor_checkpoints__portfolio_commitment_lower_hex CHECK (portfolio_commitment ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_portfolio_anchor_checkpoints__audit_commitment_lower_hex CHECK (audit_commitment ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_portfolio_anchor_checkpoints__checkpoint_hmac_lower_hex CHECK (checkpoint_hmac ~ '^[0-9a-f]{64}$')
);

CREATE TABLE etf.audit_anchor_checkpoints (
  audit_sequence bigint NOT NULL,
  audit_commitment character(64) COLLATE "C" NOT NULL,
  key_identifier text COLLATE "C" NOT NULL,
  checkpoint_hmac character(64) COLLATE "C" NOT NULL,
  accepted_at timestamp(3) with time zone NOT NULL,
  CONSTRAINT pk_audit_anchor_checkpoints PRIMARY KEY (audit_sequence),
  CONSTRAINT fk_audit_anchor_checkpoints__key_identifier__anchor_keys FOREIGN KEY (key_identifier) REFERENCES etf.anchor_keys (key_identifier) MATCH SIMPLE ON UPDATE RESTRICT ON DELETE RESTRICT NOT DEFERRABLE,
  CONSTRAINT ck_audit_anchor_checkpoints__audit_sequence_positive CHECK (audit_sequence > 0),
  CONSTRAINT ck_audit_anchor_checkpoints__audit_commitment_lower_hex CHECK (audit_commitment ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_audit_anchor_checkpoints__checkpoint_hmac_lower_hex CHECK (checkpoint_hmac ~ '^[0-9a-f]{64}$')
);

SET LOCAL ROLE schema_owner;
REVOKE USAGE, CREATE ON SCHEMA etf FROM anchor_owner;
SET LOCAL ROLE migration_owner;
`;

export const foundationMigration: MigrationArtifact = {
  migrationId: "0001-foundation",
  sequence: 1,
  sql,
};
