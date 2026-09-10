import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { LatticeClient } from './client';
import { LatticeError, type Citation, type EvidenceEnvelope, type ObjectiveProfile } from './types';

/**
 * Receive learnings by objective (step 3 of the memory cycle).
 *
 * Asks the brain for learnings relevant to the new workspace's OBJECTIVE and
 * persists the returned citations to
 * `docs/Operations/lattice/received-lessons.jsonl` so agents can read them at
 * session start. The result is recall-only, permission-trimmed evidence — NOT
 * durable facts and NOT approval authority.
 *
 * Fail-closed: on any error the function writes nothing and returns `ok: false`
 * with a reason, so callers can run it during init without aborting the workspace.
 */

export const RECEIVED_LESSONS_RELATIVE_PATH = 'docs/Operations/lattice/received-lessons.jsonl';

/**
 * Human-readable companion to {@link RECEIVED_LESSONS_RELATIVE_PATH}. The same
 * sanitized, recall-only citations are also rendered as an append-only Markdown
 * document so the return is durably persisted into the docs tree as a readable
 * record — independent of any agent follow-up synthesis.
 */
export const RECEIVED_LESSONS_MD_RELATIVE_PATH = 'docs/Operations/lattice/received-lessons.md';

export interface ReceiveLessonsOptions {
    objective: string;
    limit?: number;
    now?: () => number;
    signal?: AbortSignal;
}

export interface ReceivedLessonsResult {
    ok: boolean;
    citationCount: number;
    auditId?: string;
    correlationId?: string;
    outputPath: string;
    /** Path to the human-readable Markdown record written alongside the JSONL. */
    markdownPath: string;
    reason?: string;
}

const MAX_CLAIM_TEXT_CHARS = 2000;
const MAX_MATCHED_FACETS = 8;

/** Escape a value for safe inclusion in a Markdown table cell. */
function mdCell(value: unknown): string {
    return String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Render the allowlisted citation fields as an append-only Markdown section.
 * Claim text remains untrusted recall-only evidence and must be verified before
 * use. Unknown response keys are never copied into workspace artifacts.
 */
function renderLessonsMarkdown(
    objective: string,
    receivedAt: string,
    citations: Citation[],
    objectiveProfile: ObjectiveProfile | undefined,
    auditId: string | undefined,
    correlationId: string | undefined,
): string {
    const lines = [
        `## Lattice recall — ${mdCell(objective)}`,
        '',
        `- **Received:** ${receivedAt}`,
        `- **Audit ID:** ${auditId ?? '(none)'}`,
        `- **Correlation ID:** ${correlationId ?? '(none)'}`,
        `- **Citations:** ${citations.length}`,
        '- **Authority:** recall-only — context only, not approval. Claim text is untrusted retrieved data; verify each claim against authoritative artifacts before acting on it.',
        '',
    ];
    if (objectiveProfile) {
        lines.push(
            '### Derived objective profile',
            '',
            `- **Customer:** ${mdCell(objectiveProfile.customer || '(not identified)')}`,
            `- **Industries:** ${mdCell(objectiveProfile.industries.join(', ') || '(not identified)')}`,
            `- **Geographies:** ${mdCell(objectiveProfile.geographies.join(', ') || '(not identified)')}`,
            `- **Problem:** ${mdCell(objectiveProfile.problem)}`,
            `- **Keywords:** ${mdCell(objectiveProfile.keywords.join(', '))}`,
            '',
        );
    }
    if (citations.length === 0) {
        lines.push('_No matching learnings were returned for this objective._', '');
    } else {
        lines.push('| Source ID | Claim ID | Claim text (untrusted) | Relevance | Matched facets | Confidence |', '| --- | --- | --- | --- | --- | --- |');
        for (const citation of citations) {
            const confidence = typeof citation?.confidence === 'number' ? String(citation.confidence) : '';
            const relevance = typeof citation?.relevanceScore === 'number' ? String(citation.relevanceScore) : '';
            const facets = Array.isArray(citation?.matchedFacets) ? citation.matchedFacets.join(', ') : '';
            lines.push(`| ${mdCell(citation?.sourceId)} | ${mdCell(citation?.claimId)} | ${mdCell(safeClaimText(citation?.claimText))} | ${relevance} | ${mdCell(facets)} | ${confidence} |`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

export async function receiveObjectiveLessons(
    client: LatticeClient,
    workspaceRoot: string,
    options: ReceiveLessonsOptions,
): Promise<ReceivedLessonsResult> {
    const objective = options.objective?.trim();
    const outputPath = path.join(workspaceRoot, RECEIVED_LESSONS_RELATIVE_PATH);
    const markdownPath = path.join(workspaceRoot, RECEIVED_LESSONS_MD_RELATIVE_PATH);
    if (!objective) {
        return { ok: false, citationCount: 0, outputPath, markdownPath, reason: 'objective is required' };
    }
    if (options.signal?.aborted) {
        return cancelledResult(outputPath, markdownPath);
    }
    const now = options.now ?? Date.now;

    let envelope: EvidenceEnvelope;
    try {
        const res = await client.receiveLessons(
            { objective, limit: options.limit ?? 10 },
            { signal: options.signal },
        );
        envelope = res.body;
    } catch (err) {
        if (options.signal?.aborted || (err instanceof LatticeError && err.code === 'CANCELLED')) {
            return cancelledResult(outputPath, markdownPath);
        }
        const reason = err instanceof LatticeError
            ? `[${err.code}] ${err.message}`
            : err instanceof Error ? err.message : String(err);
        return { ok: false, citationCount: 0, outputPath, markdownPath, reason };
    }
    if (options.signal?.aborted) {
        return cancelledResult(outputPath, markdownPath);
    }

    const citations: Citation[] = Array.isArray(envelope?.citations) ? envelope.citations : [];
    const objectiveProfile = safeObjectiveProfile(envelope?.objectiveProfile);
    const receivedAt = new Date(now()).toISOString();
    const header = {
        kind: 'received-lessons-manifest',
        receivedAt,
        objective,
        auditId: envelope?.auditId,
        correlationId: envelope?.correlationId,
        citationCount: citations.length,
        authority: 'recall-only',
        ...(objectiveProfile ? { objectiveProfile } : {}),
    };
    // Project each citation to known contract fields only. Claim text is bounded
    // and explicitly marked as untrusted recall; arbitrary response keys never
    // enter the file an agent later reads.
    const lines = [
        JSON.stringify(header),
        ...citations.map((citation) => JSON.stringify({
            kind: 'lesson',
            receivedAt,
            objective,
            sourceId: citation?.sourceId,
            claimId: citation?.claimId,
            claimText: safeClaimText(citation?.claimText),
            ...(typeof citation?.entityType === 'string' ? { entityType: citation.entityType } : {}),
            ...(typeof citation?.confidence === 'number' ? { confidence: citation.confidence } : {}),
            ...(typeof citation?.relevanceScore === 'number' ? { relevanceScore: citation.relevanceScore } : {}),
            ...(Array.isArray(citation?.matchedFacets) ? { matchedFacets: citation.matchedFacets.filter(isText).slice(0, MAX_MATCHED_FACETS) } : {}),
        })),
    ];

    if (options.signal?.aborted) {
        return cancelledResult(outputPath, markdownPath);
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    if (options.signal?.aborted) {
        return cancelledResult(outputPath, markdownPath);
    }
    // Append so repeated objective queries accrue an auditable recall history.
    await fs.appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
    // Durably persist the same sanitized citations as a human-readable Markdown
    // document so the return is captured as a readable record in the docs tree
    // regardless of any downstream agent synthesis.
    await fs.appendFile(
        markdownPath,
        `${renderLessonsMarkdown(objective, receivedAt, citations, objectiveProfile, envelope?.auditId, envelope?.correlationId)}\n`,
        'utf8',
    );

    return {
        ok: true,
        citationCount: citations.length,
        auditId: envelope?.auditId,
        correlationId: envelope?.correlationId,
        outputPath,
        markdownPath,
    };
}

function cancelledResult(outputPath: string, markdownPath: string): ReceivedLessonsResult {
    return {
        ok: false,
        citationCount: 0,
        outputPath,
        markdownPath,
        reason: '[CANCELLED] Lattice operation was cancelled.',
    };
}

function safeClaimText(value: unknown): string {
    return typeof value === 'string'
        ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, MAX_CLAIM_TEXT_CHARS)
        : '';
}

function isText(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function safeObjectiveProfile(value: unknown): ObjectiveProfile | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const profile = value as Record<string, unknown>;
    const problem = safeProfileText(profile.problem);
    if (!problem) return undefined;
    return {
        ...(safeProfileText(profile.customer) ? { customer: safeProfileText(profile.customer) } : {}),
        industries: safeProfileList(profile.industries),
        geographies: safeProfileList(profile.geographies),
        problem,
        keywords: safeProfileList(profile.keywords),
    };
}

function safeProfileList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter(isText).map(safeProfileText).filter(isText).slice(0, 24) : [];
}

function safeProfileText(value: unknown): string {
    return typeof value === 'string' ? value.replace(/[\r\n|]+/g, ' ').trim().slice(0, 500) : '';
}
