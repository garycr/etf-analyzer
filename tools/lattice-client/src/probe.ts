import { LatticeClient } from './client';
import { LatticeError } from './types';

/**
 * Connectivity probe (step 2 of the memory cycle).
 *
 * Confirms a generated workspace can access the source registry and RECEIVE
 * from Lattice before any real work is delegated:
 *   - source leg:  GET /api/sources (proves auth + source-registry access without mutation)
 *   - receive leg: POST /api/query (returns governed query results; proves read path)
 *
 * Never throws: each leg is captured independently so the caller gets a complete
 * report even when one direction fails (e.g. 401 auth vs 403 scope vs network).
 */

export interface ProbeLeg {
    ok: boolean;
    status: number | 'error';
    detail?: string;
}

export interface ProbeReport {
    ok: boolean;
    checkedAt: string;
    send: ProbeLeg;
    receive: ProbeLeg;
}

export interface ProbeOptions {
    /** Benign query used to exercise the receive path. */
    query?: string;
    now?: () => number;
    signal?: AbortSignal;
}

const DEFAULT_PROBE_QUERY = 'connectivity probe: list recent lessons';

export async function probeConnectivity(client: LatticeClient, options: ProbeOptions = {}): Promise<ProbeReport> {
    const now = options.now ?? Date.now;
    if (options.signal?.aborted) {
        return cancelledReport(now);
    }
    const send = await runLeg(() => client.listSources({ signal: options.signal }));
    if (options.signal?.aborted) {
        return {
            ok: false,
            checkedAt: new Date(now()).toISOString(),
            send,
            receive: cancelledLeg(),
        };
    }
    const receive = await runLeg(() => client.query(
        { query: options.query?.trim() || DEFAULT_PROBE_QUERY, limit: 1, lens: 'shared' },
        { signal: options.signal },
    ));
    return {
        ok: send.ok && receive.ok,
        checkedAt: new Date(now()).toISOString(),
        send,
        receive,
    };
}

function cancelledReport(now: () => number): ProbeReport {
    return {
        ok: false,
        checkedAt: new Date(now()).toISOString(),
        send: cancelledLeg(),
        receive: cancelledLeg(),
    };
}

function cancelledLeg(): ProbeLeg {
    return { ok: false, status: 'error', detail: '[CANCELLED] Lattice operation was cancelled.' };
}

async function runLeg(op: () => Promise<{ status: number }>): Promise<ProbeLeg> {
    try {
        const res = await op();
        return { ok: res.status >= 200 && res.status < 300, status: res.status };
    } catch (err) {
        if (err instanceof LatticeError) {
            return { ok: false, status: err.status ?? 'error', detail: `[${err.code}] ${err.message}` };
        }
        return { ok: false, status: 'error', detail: err instanceof Error ? err.message : String(err) };
    }
}
