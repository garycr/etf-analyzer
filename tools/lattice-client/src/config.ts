import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { LatticeAuthMode, LatticeConfig, LatticeError } from './types';

export const CONFIG_RELATIVE_PATH = 'docs/Operations/lattice/config.json';

const AUTH_MODES: LatticeAuthMode[] = ['entra-bearer', 'easy-auth', 'mcp-auth', 'customer-override'];
const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Normalize an HTTPS endpoint to its bare origin, or return null when unsafe. */
export function normalizeEndpoint(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim().replace(/\/+$/, '');
    try {
        const url = new URL(trimmed);
        if (url.protocol !== 'https:' || url.username || url.password || !url.hostname || url.search || url.hash) {
            return null;
        }
        if (isBlockedEndpointHost(url.hostname)) {
            return null;
        }
        return url.origin;
    } catch {
        return null;
    }
}

/**
 * Reject loopback, private, and link-local IP literals (incl. the cloud metadata
 * address 169.254.169.254) plus `localhost` to reduce SSRF blast radius. Only IP
 * literals and localhost are blocked; ordinary hostnames pass so operator-approved
 * endpoints are unaffected.
 */
export function isBlockedEndpointHost(hostname: string): boolean {
    let h = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
    if (h === 'localhost' || h.endsWith('.localhost')) {
        return true;
    }
    // IPv4-mapped IPv6 (e.g. `::ffff:127.0.0.1`) is a common SSRF bypass: unwrap
    // the mapped prefix so the embedded IPv4 is evaluated by the checks below,
    // and block any mapped form we cannot decode to a dotted quad.
    if (h.startsWith('::ffff:')) {
        const mapped = h.slice(7);
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(mapped)) {
            h = mapped;
        } else {
            return true;
        }
    }
    if (h === '::1' || h === '::' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) {
        return true;
    }
    const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
        const a = Number(m[1]);
        const b = Number(m[2]);
        if (a === 0 || a === 127 || a === 10) {
            return true;
        }
        if (a === 169 && b === 254) {
            return true;
        }
        if (a === 172 && b >= 16 && b <= 31) {
            return true;
        }
        if (a === 192 && b === 168) {
            return true;
        }
    }
    return false;
}

export function isValidGuid(value: unknown): value is string {
    return typeof value === 'string' && GUID_RE.test(value.trim());
}

/**
 * Validate a raw config object fail-closed. Throws {@link LatticeError}
 * with code `CONFIG_INVALID` on the first violation.
 */
export function validateConfig(raw: unknown): LatticeConfig {
    if (!raw || typeof raw !== 'object') {
        throw new LatticeError('CONFIG_INVALID', 'Lattice config must be a JSON object.');
    }
    const c = raw as Record<string, unknown>;

    const endpoint = normalizeEndpoint(c.endpoint);
    if (!endpoint) {
        throw new LatticeError('CONFIG_INVALID', 'Config endpoint must be an HTTPS URL without embedded credentials, query, or fragment.');
    }
    if (!isValidGuid(c.tenantId)) {
        throw new LatticeError('CONFIG_INVALID', 'Config tenantId must be a GUID.');
    }
    const authMode = c.authMode as LatticeAuthMode;
    if (!AUTH_MODES.includes(authMode)) {
        throw new LatticeError('CONFIG_INVALID', `Config authMode must be one of: ${AUTH_MODES.join(', ')}.`);
    }
    const dlpPolicyId = typeof c.dlpPolicyId === 'string' ? c.dlpPolicyId.trim() : '';
    if (!dlpPolicyId || /^(placeholder|todo|tbd)/i.test(dlpPolicyId)) {
        throw new LatticeError('CONFIG_INVALID', 'Config dlpPolicyId is required and must not be a placeholder.');
    }
    if (c.subscriptionId !== undefined && c.subscriptionId !== null && c.subscriptionId !== '' && !isValidGuid(c.subscriptionId)) {
        throw new LatticeError('CONFIG_INVALID', 'Config subscriptionId must be a GUID when provided.');
    }
    if (c.audience !== undefined && (typeof c.audience !== 'string' || !c.audience.trim())) {
        throw new LatticeError('CONFIG_INVALID', 'Config audience must be a non-empty string when provided.');
    }
    if (c.scope !== undefined && (typeof c.scope !== 'string' || !c.scope.trim())) {
        throw new LatticeError('CONFIG_INVALID', 'Config scope must be a non-empty string when provided.');
    }

    return {
        endpoint,
        tenantId: (c.tenantId as string).trim(),
        subscriptionId: isValidGuid(c.subscriptionId) ? (c.subscriptionId as string).trim() : undefined,
        authMode,
        dlpPolicyId,
        audience: typeof c.audience === 'string' ? c.audience.trim() : undefined,
        scope: typeof c.scope === 'string' ? c.scope.trim() : undefined,
        allowedSendModes: Array.isArray(c.allowedSendModes) ? (c.allowedSendModes as string[]) : undefined,
        allowedReceiveModes: Array.isArray(c.allowedReceiveModes) ? (c.allowedReceiveModes as string[]) : undefined,
    };
}

/** Load and validate the workspace Lattice config from disk. */
export async function loadConfig(workspaceRoot: string): Promise<LatticeConfig> {
    const configPath = path.join(workspaceRoot, CONFIG_RELATIVE_PATH);
    let text: string;
    try {
        text = await fs.readFile(configPath, 'utf8');
    } catch {
        throw new LatticeError(
            'CONFIG_MISSING',
            `Lattice config not found at ${CONFIG_RELATIVE_PATH}. Run "Agent Workspace: Lattice Configure Live Connection" first.`,
        );
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new LatticeError('CONFIG_INVALID', `Lattice config at ${CONFIG_RELATIVE_PATH} is not valid JSON.`);
    }
    return validateConfig(parsed);
}

/**
 * Resolve the Entra token scope. Prefers explicit `scope`, then `${audience}/.default`.
 * Throws for token-acquiring modes when neither is present (fail-closed).
 */
export function resolveScope(config: LatticeConfig): string {
    if (config.scope) {
        return config.scope;
    }
    if (config.audience) {
        const base = config.audience.replace(/\/+$/, '');
        return `${base}/.default`;
    }
    throw new LatticeError(
        'CONFIG_INVALID',
        'Config must provide "scope" or "audience" to acquire an Entra token in entra-bearer mode.',
    );
}
