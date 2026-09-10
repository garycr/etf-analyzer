#!/usr/bin/env node
import * as crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { createTokenProvider } from './auth';
import { FileAuditWriter, LatticeClient } from './client';
import { loadConfig } from './config';
import { buildDlpDecision } from './dlp';
import { probeConnectivity } from './probe';
import { receiveObjectiveLessons } from './receive';
import { LatticeError, type LatticeConfig } from './types';

interface ParsedArgs {
    command: string;
    flags: Record<string, string>;
    positionals: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
    const [command = 'help', ...rest] = argv;
    const flags: Record<string, string> = {};
    const positionals: string[] = [];
    for (let i = 0; i < rest.length; i++) {
        const token = rest[i];
        if (token.startsWith('--')) {
            const key = token.slice(2);
            const next = rest[i + 1];
            if (next !== undefined && !next.startsWith('--')) {
                flags[key] = next;
                i++;
            } else {
                flags[key] = 'true';
            }
        } else {
            positionals.push(token);
        }
    }
    return { command, flags, positionals };
}

const USAGE = `lattice <command> [options]

Commands:
    init                       Initialize the signed-in Lattice user session
    probe                      Confirm source-registry + receive connectivity (sources + query)
  query <text> [--limit n]   Retrieve governed claims (receive path)
  receive-lessons <objective> [--limit n]
                             Fetch objective-relevant learnings; writes
                             docs/Operations/lattice/received-lessons.jsonl
  claims [--limit n]         List claims visible to this workspace
  sources                    List sources available for chat grounding
    ingest --file <path> --content-type <ct> [--source-id <id>]
                                                         Create an upload source when needed, then upload file bytes as multipart
  register-source-event --source-id <id> --event-type <type>
                             Register a source lifecycle event (send path)

Global options:
  --workspace <path>         Workspace root (default: current directory)
  --dlp-decision-id <id>     DLP decision id (required for send operations)
  --dlp-correlation-id <id>  DLP correlation id (default: generated)
  --dlp-allow                Assert a fresh DLP allow decision (fail-closed without it)
`;

function makeDlp(policyId: string, flags: Record<string, string>) {
    return buildDlpDecision(policyId, {
        status: flags['dlp-allow'] === 'true' ? 'allow' : 'block',
        decisionId: flags['dlp-decision-id'] ?? crypto.randomUUID(),
        correlationId: flags['dlp-correlation-id'] ?? crypto.randomUUID(),
    });
}

/**
 * Injectable dependencies so the CLI's argument parsing and exit-code contract
 * can be exercised hermetically (no real config file, token acquisition, or
 * network). Production callers pass nothing and the real implementations run.
 */
export interface CliDependencies {
    argv?: string[];
    cwd?: string;
    loadConfigFn?: (workspaceRoot: string) => Promise<LatticeConfig>;
    createClient?: (config: LatticeConfig, workspaceRoot: string) => LatticeClient;
}

function defaultCreateClient(config: LatticeConfig, workspaceRoot: string): LatticeClient {
    return new LatticeClient({
        config,
        tokenProvider: createTokenProvider(config),
        auditWriter: new FileAuditWriter(workspaceRoot),
    });
}

export async function main(deps: CliDependencies = {}): Promise<number> {
    const { command, flags, positionals } = parseArgs(deps.argv ?? process.argv.slice(2));
    if (command === 'help' || flags.help === 'true') {
        process.stdout.write(USAGE);
        return 0;
    }

    const workspaceRoot = flags.workspace ?? deps.cwd ?? process.cwd();
    const config = await (deps.loadConfigFn ?? loadConfig)(workspaceRoot);
    const client = (deps.createClient ?? defaultCreateClient)(config, workspaceRoot);

    let result: unknown;
    switch (command) {
        case 'init':
            result = await client.init();
            break;
        case 'probe': {
            const report = await probeConnectivity(client);
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
            return report.ok ? 0 : 1;
        }
        case 'query': {
            const text = positionals[0] ?? flags.query;
            if (!text) {
                throw new LatticeError('ARG_INVALID', 'query requires text: lattice query "<text>"');
            }
            result = await client.query({
                query: text,
                limit: flags.limit ? Number(flags.limit) : undefined,
                lens: flags.lens === 'personal' ? 'personal' : flags.lens === 'shared' ? 'shared' : undefined,
            });
            break;
        }
        case 'claims':
            result = await client.listClaims(flags.limit ? Number(flags.limit) : undefined);
            break;
        case 'receive-lessons': {
            const objective = positionals[0] ?? flags.objective;
            if (!objective) {
                throw new LatticeError('ARG_INVALID', 'receive-lessons requires an objective: lattice receive-lessons "<objective>"');
            }
            const received = await receiveObjectiveLessons(client, workspaceRoot, {
                objective,
                limit: flags.limit ? Number(flags.limit) : undefined,
            });
            process.stdout.write(`${JSON.stringify(received, null, 2)}\n`);
            return received.ok ? 0 : 1;
        }
        case 'sources':
            result = await client.getChatSources();
            break;
        case 'ingest': {
            const dlp = makeDlp(config.dlpPolicyId, flags);
            const suppliedPath = required(flags, 'file');
            const filePath = path.isAbsolute(suppliedPath) ? suppliedPath : path.resolve(workspaceRoot, suppliedPath);
            const content = await fs.readFile(filePath);
            const checksumSha256 = flags.checksum && flags.checksum !== 'true'
                ? flags.checksum
                : crypto.createHash('sha256').update(content).digest('hex');
            result = await client.ingestFile(
                {
                    fileName: path.basename(filePath),
                    contentType: required(flags, 'content-type'),
                    checksumSha256,
                    content,
                    sizeBytes: content.byteLength,
                    sourceId: optional(flags, 'source-id'),
                    sourceLabel: optional(flags, 'source-label'),
                    importBatchId: optional(flags, 'import-batch-id'),
                },
                dlp,
            );
            break;
        }
        case 'register-source-event': {
            const dlp = makeDlp(config.dlpPolicyId, flags);
            result = await client.registerSourceEvent(
                required(flags, 'source-id'),
                { eventType: required(flags, 'event-type') },
                dlp,
            );
            break;
        }
        default:
            process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
            return 2;
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
}

function required(flags: Record<string, string>, key: string): string {
    const value = flags[key];
    if (!value || value === 'true') {
        throw new LatticeError('ARG_INVALID', `Missing required option --${key}.`);
    }
    return value;
}

function optional(flags: Record<string, string>, key: string): string | undefined {
    const value = flags[key];
    return value && value !== 'true' ? value : undefined;
}

// Auto-run only when invoked directly as the CLI entry (node dist/cli.js), not
// when imported by tests. Module format is CommonJS (see tsconfig).
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    main()
        .then((code) => { process.exitCode = code; })
        .catch((err: unknown) => {
            if (err instanceof LatticeError) {
                process.stderr.write(`[${err.code}] ${err.message}\n`);
            } else {
                process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
            }
            process.exitCode = 1;
        });
}
