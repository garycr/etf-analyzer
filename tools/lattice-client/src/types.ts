/**
 * Lattice runtime connector — public types.
 *
 * These mirror the governed contract in
 * `docs/Operations/lattice/contracts/agent-contract.openapi.yaml`
 * and the live Lattice HTTP routes.
 */

export type LatticeAuthMode = 'entra-bearer' | 'easy-auth' | 'mcp-auth' | 'customer-override';

export interface LatticeConfig {
    /** HTTPS origin of the Lattice deployment, e.g. https://brain.contoso.example */
    endpoint: string;
    /** Entra tenant GUID the workspace is authorized against. */
    tenantId: string;
    /** Optional Azure subscription GUID (recorded for evidence only). */
    subscriptionId?: string;
    /** How the connector obtains an Entra bearer token. */
    authMode: LatticeAuthMode;
    /** DLP/content-safety policy identifier required before send modes run. */
    dlpPolicyId: string;
    /**
     * Entra application audience for token acquisition, e.g. `api://governance-brain`.
     * Used to derive the token scope `${audience}/.default` when `scope` is absent.
     */
    audience?: string;
    /** Explicit token scope; overrides `audience` when provided. */
    scope?: string;
    allowedSendModes?: string[];
    allowedReceiveModes?: string[];
}

export type DlpStatus = 'allow' | 'block';

export interface DlpDecision {
    status: DlpStatus;
    policyId: string;
    checkedAt: string;
    expiresAt: string;
    decisionId: string;
    correlationId: string;
}

export interface QueryRequest {
    query: string;
    limit?: number;
    lens?: 'shared' | 'personal';
}

export interface LatticeReadOptions {
    signal?: AbortSignal;
}

export interface QueryResult {
    id?: string;
    claimId?: string;
    sourceId?: string;
    claimText?: string;
    entityType?: string;
    confidence?: number;
    tier?: string;
    sourceType?: string;
    [key: string]: unknown;
}

export interface QueryResultsEnvelope {
    query: string;
    lens?: 'shared' | 'personal';
    results: QueryResult[];
    count: number;
    timestamp?: string;
    [key: string]: unknown;
}

export interface ObjectiveLessonsRequest {
    objective: string;
    limit?: number;
}

export interface FileIngestRequest {
    fileName: string;
    contentType: string;
    checksumSha256: string;
    content: Uint8Array;
    sizeBytes?: number;
    sourceId?: string;
    sourceLabel?: string;
    importBatchId?: string;
}

export interface SourceCreateRequest {
    sourceKind: 'file-upload';
    sourceMode: 'once';
    bindingHash: string;
    requestedDisplayLabel: string;
}

export interface SourceSummary {
    sourceId: string;
    sourceKind: string;
    sourceMode: string;
    sourceState: string;
    captureEligible: boolean;
}

export interface SourceCreateEnvelope {
    source: SourceSummary;
}

export interface SourceEvent {
    eventType: string;
    payload?: Record<string, unknown>;
}

export interface Citation {
    sourceId: string;
    claimId: string;
    claimText: string;
    entityType?: string;
    confidence?: number;
    relevanceScore?: number;
    matchedFacets?: string[];
}

export interface ObjectiveProfile {
    customer?: string;
    industries: string[];
    geographies: string[];
    problem: string;
    keywords: string[];
}

export interface EvidenceEnvelope {
    citations: Citation[];
    objectiveProfile?: ObjectiveProfile;
    auditId?: string;
    correlationId?: string;
    [key: string]: unknown;
}

export interface LatticeResponse<T = unknown> {
    status: number;
    body: T;
}

/** Structured error thrown for any non-2xx response or fail-closed guard. */
export class LatticeError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status?: number,
        public readonly detail?: unknown,
    ) {
        super(message);
        this.name = 'LatticeError';
        // Preserve the prototype chain so `instanceof` works when this class is
        // transpiled/down-levelled (extending built-in Error otherwise breaks it).
        Object.setPrototypeOf(this, LatticeError.prototype);
    }
}
