import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { buildAuditRow, escapeAuditCell, latestAuditHash } from './audit-chain';
import type { TokenProvider } from './auth';
import { deriveUserId } from './auth';
import { assertAllow } from './dlp';
import {
    DlpDecision,
    EvidenceEnvelope,
    FileIngestRequest,
    LatticeConfig,
    LatticeError,
    LatticeReadOptions,
    LatticeResponse,
    ObjectiveLessonsRequest,
    QueryRequest,
    QueryResultsEnvelope,
    SourceCreateEnvelope,
    SourceCreateRequest,
    SourceEvent,
} from './types';

/**
 * Live Lattice HTTP routes. These reflect the deployed Azure Functions app
 * and the generated workspace contract in docs/Operations/lattice/contracts.
 */
export const ROUTES = {
    init: '/api/init',
    ingestFile: '/api/ingest/file',
    sources: '/api/sources',
    sourceEvents: (sourceId: string) => `/api/sources/${encodeURIComponent(sourceId)}/events`,
    query: '/api/query',
    objectiveLessons: '/api/lessons/objective',
    claims: '/api/claims',
    chatSources: '/api/chat/sources',
} as const;

export type FetchImpl = typeof fetch;

/** Appends a one-line audit record for every attempted operation. */
export interface AuditWriter {
    record(entry: AuditEntry): Promise<void>;
}

export interface AuditEntry {
    timestamp: string;
    operation: string;
    route: string;
    status: number | 'error';
    userId: string;
    tenantId: string;
    correlationId?: string;
    detail?: string;
}

export class NoopAuditWriter implements AuditWriter {
    async record(): Promise<void> {
        /* no-op */
    }
}

/** Relative path of the tamper-evident runtime-API audit log. */
export const API_AUDIT_RELATIVE_PATH = 'docs/Operations/lattice/api-audit.md';

const API_AUDIT_HEADER =
    '# Lattice API Audit Log\n\n' +
    '> Append-only, hash-chained record of every Lattice **runtime API call** made by\n' +
    '> this workspace. Machine-written — DO NOT EDIT BY HAND. Each row chains to the previous\n' +
    "> via the `Prev`/`This` SHA-256 columns; any edit, reorder, or deletion breaks the chain\n" +
    '> and is detectable by `verifyAuditChain`. Human/agent narrative belongs in the operating\n' +
    '> guide, not here.\n\n' +
    '| Timestamp | Operation | Route | Status | User | Tenant | Correlation | Detail | Prev | This |\n' +
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';

/** Writes tamper-evident, append-only audit rows to `docs/Operations/lattice/api-audit.md`. */
export class FileAuditWriter implements AuditWriter {
    private readonly filePath: string;
    constructor(workspaceRoot: string) {
        this.filePath = path.join(workspaceRoot, ...API_AUDIT_RELATIVE_PATH.split('/'));
    }
    async record(entry: AuditEntry): Promise<void> {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        let existing = '';
        try {
            existing = await fs.readFile(this.filePath, 'utf8');
        } catch {
            await fs.writeFile(this.filePath, API_AUDIT_HEADER, 'utf8');
        }
        const contentCells = [
            escapeAuditCell(entry.timestamp),
            escapeAuditCell(entry.operation),
            escapeAuditCell(entry.route),
            escapeAuditCell(entry.status),
            escapeAuditCell(entry.userId),
            escapeAuditCell(entry.tenantId),
            escapeAuditCell(entry.correlationId),
            escapeAuditCell(entry.detail),
        ];
        const { row } = buildAuditRow(contentCells, latestAuditHash(existing));
        await fs.appendFile(this.filePath, `${row}\n`, 'utf8');
    }
}

export interface LatticeClientOptions {
    config: LatticeConfig;
    tokenProvider: TokenProvider;
    fetchImpl?: FetchImpl;
    auditWriter?: AuditWriter;
    now?: () => number;
}

/**
 * Runtime client for the Lattice HTTP API. Attaches an Entra bearer to
 * every request, enforces fail-closed DLP on send operations, and emits an
 * audit record per call. Identity is carried by the token; request-body
 * `userId`/`tenantId` satisfy the contract envelope and are validated
 * server-side, never trusted as the source of identity.
 */
export class LatticeClient {
    private readonly config: LatticeConfig;
    private readonly tokenProvider: TokenProvider;
    private readonly fetchImpl: FetchImpl;
    private readonly audit: AuditWriter;
    private readonly now: () => number;

    constructor(options: LatticeClientOptions) {
        if (!options.fetchImpl && typeof fetch === 'undefined') {
            throw new LatticeError('RUNTIME_UNSUPPORTED', 'Global fetch is unavailable. Use Node.js 20+ or pass fetchImpl.');
        }
        this.config = options.config;
        this.tokenProvider = options.tokenProvider;
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.audit = options.auditWriter ?? new NoopAuditWriter();
        this.now = options.now ?? Date.now;
    }

    /** POST /api/init — initialize the signed-in user session. This does not create an ingest source. */
    async init(body: Record<string, unknown> = {}): Promise<LatticeResponse> {
        return this.request('init', 'POST', ROUTES.init, this.envelope(body));
    }

    /** POST /api/sources — create an active one-shot upload source. */
    async createUploadSource(request: Omit<SourceCreateRequest, 'sourceKind' | 'sourceMode'>, dlp: DlpDecision): Promise<LatticeResponse<SourceCreateEnvelope>> {
        assertAllow(dlp, this.now());
        return this.request<SourceCreateEnvelope>('createUploadSource', 'POST', ROUTES.sources, {
            sourceKind: 'file-upload',
            sourceMode: 'once',
            bindingHash: request.bindingHash,
            requestedDisplayLabel: request.requestedDisplayLabel,
        }, dlp);
    }

    /** POST /api/ingest/file — create an upload source when needed, then send actual file bytes as multipart. */
    async ingestFile(request: FileIngestRequest, dlp: DlpDecision): Promise<LatticeResponse> {
        assertAllow(dlp, this.now());
        const sourceId = request.sourceId?.trim() || (await this.createUploadSource({
            bindingHash: request.checksumSha256,
            requestedDisplayLabel: request.sourceLabel?.trim() || request.fileName,
        }, dlp)).body.source.sourceId;
        if (!sourceId) {
            throw new LatticeError('SOURCE_REGISTRATION_FAILED', 'Lattice source registration returned no sourceId.');
        }

        const form = new FormData();
        form.append('sourceId', sourceId);
        form.append('sourceLabel', request.sourceLabel?.trim() || request.fileName);
        if (request.importBatchId?.trim()) form.append('importBatchId', request.importBatchId.trim());
        const bytes = request.content.buffer.slice(request.content.byteOffset, request.content.byteOffset + request.content.byteLength) as ArrayBuffer;
        form.append('file', new Blob([bytes], { type: request.contentType }), request.fileName);
        const uploaded = await this.request<Record<string, unknown>>('ingestFile', 'POST', ROUTES.ingestFile, form, dlp);
        return { status: uploaded.status, body: { sourceId, ...uploaded.body } };
    }

    /** GET /api/sources — verify source-registry access and list caller-visible sources. */
    async listSources(options: LatticeReadOptions = {}): Promise<LatticeResponse> {
        return this.request('listSources', 'GET', ROUTES.sources, undefined, undefined, options);
    }

    /** POST /api/sources/{sourceId}/events — register a source lifecycle event. */
    async registerSourceEvent(sourceId: string, event: SourceEvent, dlp: DlpDecision): Promise<LatticeResponse> {
        if (!sourceId?.trim()) {
            throw new LatticeError('ARG_INVALID', 'sourceId is required.');
        }
        assertAllow(dlp, this.now());
        return this.request(
            'registerSourceEvent',
            'POST',
            ROUTES.sourceEvents(sourceId),
            this.envelope({ ...event, dlpDecision: dlp }),
            dlp,
        );
    }

    /** POST /api/query — retrieve governed claims (receive path). */
    async query(request: QueryRequest, options: LatticeReadOptions = {}): Promise<LatticeResponse<QueryResultsEnvelope>> {
        if (!request?.query?.trim()) {
            throw new LatticeError('ARG_INVALID', 'query text is required.');
        }
        return this.request<QueryResultsEnvelope>('query', 'POST', ROUTES.query, this.envelope({
            query: request.query,
            limit: request.limit,
            lens: request.lens,
        }), undefined, options);
    }

    /** POST /api/lessons/objective — retrieve recall-only lessons for a workspace objective. */
    async receiveLessons(request: ObjectiveLessonsRequest, options: LatticeReadOptions = {}): Promise<LatticeResponse<EvidenceEnvelope>> {
        if (!request?.objective?.trim()) {
            throw new LatticeError('ARG_INVALID', 'objective is required.');
        }
        return this.request<EvidenceEnvelope>('receiveLessons', 'POST', ROUTES.objectiveLessons, this.envelope({
            objective: request.objective,
            limit: request.limit,
        }), undefined, options);
    }

    /** GET /api/claims — list claims visible to this workspace. */
    async listClaims(limit?: number, options: LatticeReadOptions = {}): Promise<LatticeResponse> {
        const suffix = typeof limit === 'number' && limit > 0 ? `?limit=${encodeURIComponent(String(limit))}` : '';
        return this.request('listClaims', 'GET', `${ROUTES.claims}${suffix}`, undefined, undefined, options);
    }

    /** GET /api/chat/sources — list sources available for chat grounding. */
    async getChatSources(options: LatticeReadOptions = {}): Promise<LatticeResponse> {
        return this.request('getChatSources', 'GET', ROUTES.chatSources, undefined, undefined, options);
    }

    private envelope(body: Record<string, unknown>): Record<string, unknown> {
        return { tenantId: this.config.tenantId, subscriptionId: this.config.subscriptionId, ...body };
    }

    private async request<T = unknown>(
        operation: string,
        method: 'GET' | 'POST',
        route: string,
        body?: Record<string, unknown> | FormData,
        dlp?: DlpDecision,
        options: LatticeReadOptions = {},
    ): Promise<LatticeResponse<T>> {
        throwIfAborted(options.signal);
        const token = await this.tokenProvider.getToken();
        throwIfAborted(options.signal);
        const userId = deriveUserId(token);
        const correlationId = dlp?.correlationId;
        const url = `${this.config.endpoint}${route}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
        };
        const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;
        if (body !== undefined && !isMultipart) {
            headers['Content-Type'] = 'application/json';
        }
        if (correlationId) {
            headers['x-correlation-id'] = correlationId;
        }

        let response: Response;
        try {
            response = await this.fetchImpl(url, {
                method,
                headers,
                body: body === undefined ? undefined : isMultipart ? body : JSON.stringify(body),
                signal: options.signal,
            });
        } catch (err) {
            await this.safeAudit({
                timestamp: new Date(this.now()).toISOString(),
                operation,
                route,
                status: 'error',
                userId,
                tenantId: this.config.tenantId,
                correlationId,
                detail: err instanceof Error ? err.message : String(err),
            });
            if (options.signal?.aborted || isAbortError(err)) {
                throw new LatticeError('CANCELLED', 'Lattice operation was cancelled.');
            }
            throw new LatticeError('NETWORK_ERROR', `Request to ${route} failed: ${err instanceof Error ? err.message : String(err)}`);
        }

        const text = await response.text();
        let parsed: unknown = undefined;
        if (text) {
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = text;
            }
        }

        await this.safeAudit({
            timestamp: new Date(this.now()).toISOString(),
            operation,
            route,
            status: response.status,
            userId,
            tenantId: this.config.tenantId,
            correlationId,
        });

        if (!response.ok) {
            const detail = parsed && typeof parsed === 'object' ? parsed : text;
            throw new LatticeError(
                `HTTP_${response.status}`,
                `Lattice returned ${response.status} for ${operation}.`,
                response.status,
                detail,
            );
        }

        return { status: response.status, body: parsed as T };
    }

    private async safeAudit(entry: AuditEntry): Promise<void> {
        try {
            await this.audit.record(entry);
        } catch {
            /* audit failures must not break the operation */
        }
    }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted) {
        throw new LatticeError('CANCELLED', 'Lattice operation was cancelled.');
    }
}

function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
}
