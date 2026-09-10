import { DlpDecision, LatticeError } from './types';

export interface BuildDlpOptions {
    status?: 'allow' | 'block';
    decisionId: string;
    correlationId: string;
    /** Time-to-live in milliseconds for the decision. Default 15 minutes. */
    ttlMs?: number;
    now?: () => number;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000;

/**
 * Build a DLP decision. Fail-closed: `status` defaults to `block` unless an
 * explicit `allow` is supplied by the caller.
 */
export function buildDlpDecision(policyId: string, opts: BuildDlpOptions): DlpDecision {
    const trimmedPolicy = (policyId ?? '').trim();
    if (!trimmedPolicy) {
        throw new LatticeError('DLP_INVALID', 'DLP policyId is required.');
    }
    if (!opts.decisionId?.trim() || !opts.correlationId?.trim()) {
        throw new LatticeError('DLP_INVALID', 'DLP decisionId and correlationId are required.');
    }
    const nowMs = (opts.now ?? Date.now)();
    const ttl = opts.ttlMs && opts.ttlMs > 0 ? opts.ttlMs : DEFAULT_TTL_MS;
    return {
        status: opts.status === 'allow' ? 'allow' : 'block',
        policyId: trimmedPolicy,
        checkedAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(nowMs + ttl).toISOString(),
        decisionId: opts.decisionId.trim(),
        correlationId: opts.correlationId.trim(),
    };
}

export function isExpired(decision: DlpDecision, now: number = Date.now()): boolean {
    const expiry = Date.parse(decision.expiresAt);
    return !Number.isFinite(expiry) || expiry <= now;
}

/**
 * Fail-closed guard for send operations. Throws {@link LatticeError}
 * (`DLP_BLOCKED`) unless the decision is a fresh, well-formed `allow`.
 */
export function assertAllow(decision: DlpDecision | undefined, now: number = Date.now()): DlpDecision {
    if (!decision) {
        throw new LatticeError('DLP_BLOCKED', 'A DLP allow decision is required for this operation.');
    }
    const required: Array<keyof DlpDecision> = ['status', 'policyId', 'checkedAt', 'expiresAt', 'decisionId', 'correlationId'];
    for (const field of required) {
        if (!decision[field]) {
            throw new LatticeError('DLP_BLOCKED', `DLP decision is missing required field "${field}".`);
        }
    }
    if (decision.status !== 'allow') {
        throw new LatticeError('DLP_BLOCKED', 'DLP decision status is not "allow".');
    }
    if (isExpired(decision, now)) {
        throw new LatticeError('DLP_BLOCKED', 'DLP decision has expired; obtain a fresh decision.');
    }
    return decision;
}
