import { createHash } from 'node:crypto';

/**
 * Tamper-evident append-only audit chain for the workspace Lattice audit
 * logs. Every data row carries the previous row's hash (`Prev`) and its own hash
 * (`This`), where `This = sha256(escapedContentCells + Prev)`. Because each hash
 * folds in the prior hash, no earlier row can be altered, reordered, or removed
 * without breaking every subsequent `This` — making hand edits detectable by
 * {@link verifyAuditChain}. The genesis row's `Prev` is the {@link AUDIT_GENESIS}
 * sentinel.
 *
 * This is the local, workspace-side integrity mechanism. True write-once storage
 * remains a server-side responsibility; the markdown log is the tamper-evident
 * workspace index of it.
 */

export const AUDIT_GENESIS = 'GENESIS';

/** Field separator used only for hashing; stripped from cell content so it can never collide. */
const HASH_SEP = '\u241F';

/** Escape a value for a single markdown table cell: no separator char, no newlines, escaped pipes. */
export function escapeAuditCell(value: string | number | undefined): string {
    return String(value ?? '')
        .replace(/\u241F/g, ' ')
        .replace(/\r?\n/g, ' ')
        .replace(/\|/g, '\\|')
        .trim();
}

/** Compute the chained hash for a row from its escaped content cells and the previous hash. */
export function hashAuditRow(contentCells: string[], prevHash: string): string {
    return createHash('sha256').update(contentCells.join(HASH_SEP) + HASH_SEP + prevHash).digest('hex');
}

/** Build a full markdown data row (content cells + `Prev` + `This`) and return it with its hash. */
export function buildAuditRow(contentCells: string[], prevHash: string): { row: string; thisHash: string } {
    const thisHash = hashAuditRow(contentCells, prevHash);
    return { row: `| ${contentCells.join(' | ')} | ${prevHash} | ${thisHash} |`, thisHash };
}

/** Return the last data row's `This` hash from existing content, or the genesis sentinel. */
export function latestAuditHash(content: string | null | undefined): string {
    const rows = extractDataRows(content ?? '');
    if (rows.length === 0) {
        return AUDIT_GENESIS;
    }
    const cells = splitAuditRow(rows[rows.length - 1]);
    return cells.length >= 2 ? cells[cells.length - 1] : AUDIT_GENESIS;
}

export interface AuditChainVerification {
    valid: boolean;
    rows: number;
    brokenAt?: number;
    reason?: string;
}

/** Verify the append-only hash chain over every data row. Any tamper breaks it. */
export function verifyAuditChain(content: string): AuditChainVerification {
    const rows = extractDataRows(content);
    let prev = AUDIT_GENESIS;
    for (let i = 0; i < rows.length; i++) {
        const cells = splitAuditRow(rows[i]);
        if (cells.length < 3) {
            return { valid: false, rows: rows.length, brokenAt: i, reason: 'row has too few columns' };
        }
        const stored = cells[cells.length - 1];
        const storedPrev = cells[cells.length - 2];
        const contentCells = cells.slice(0, cells.length - 2);
        if (storedPrev !== prev) {
            return { valid: false, rows: rows.length, brokenAt: i, reason: 'prev-hash mismatch (row removed or reordered)' };
        }
        if (hashAuditRow(contentCells, storedPrev) !== stored) {
            return { valid: false, rows: rows.length, brokenAt: i, reason: 'row-hash mismatch (row content tampered)' };
        }
        prev = stored;
    }
    return { valid: true, rows: rows.length };
}

/** Data rows are the pipe-rows that follow the table separator row. Header + separator are skipped. */
function extractDataRows(content: string): string[] {
    const rows: string[] = [];
    let sawSeparator = false;
    for (const line of content.split(/\r?\n/)) {
        const t = line.trim();
        if (!t.startsWith('|')) {
            continue;
        }
        if (!sawSeparator) {
            if (t.includes('-') && /^\|[\s:|-]+\|$/.test(t)) {
                sawSeparator = true;
            }
            continue;
        }
        rows.push(t);
    }
    return rows;
}

/** Split a data row into its cells. Content cells were escaped so no bare ' | ' appears inside them. */
function splitAuditRow(row: string): string[] {
    return row.trim().replace(/^\|\s?/, '').replace(/\s?\|$/, '').split(' | ');
}
