#!/usr/bin/env node
/**
 * Governance MCP Server — CF-1 Part 3
 *
 * Exposes the workspace governance engine as MCP (Model Context Protocol) tools.
 * Instead of agents reading 500-line markdown files, they query structured APIs:
 *
 *   governance_getNextRequiredAction  — What must I do next for this ring?
 *   governance_submitEvidence         — Submit structured proof for a gate criterion
 *   governance_reviewGate             — Run a gate review and get structured results
 *   governance_getActiveConfig        — Read current tier, autonomy mode, ring status
 *   governance_verifyCompliance       — Post-hoc check: did the agent follow governance?
 *
 * Usage in a local .vscode/mcp.json copied from .vscode/mcp.json.example:
 *   {
 *     "mcpServers": {
 *       "governance": {
 *         "type": "stdio",
 *         "command": "node",
 *         "args": [".github/scripts/governance-mcp-server.js"]
 *       }
 *     }
 *   }
 *
 * The server reads workspace files directly (no VS Code API needed).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execFileSync } = require('child_process');

// ── Workspace root detection ────────────────────────────────────────────────

function findWorkspaceRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.github', 'workspace-config.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const WORKSPACE_ROOT = findWorkspaceRoot();
const JOURNAL_REL_PATH = ['docs', 'Sessions', 'journal.md'].join('/');
const GATE_EVIDENCE_DIR = ['docs', 'artifacts', 'gate-evidence'].join('/');
const DECISION_LOG_REL_PATH = ['docs', 'Governance', 'decisions', 'decision-log.md'].join('/');
const MEASURES_DIR = ['docs', 'Quality', 'measures'].join('/');
const THRESHOLDS_REL_PATH = 'governance-thresholds.json';

function gateEvidenceRelPath(ring) {
  return [GATE_EVIDENCE_DIR, `ring-${ring}.json`].join('/');
}

function measuresRelPath(ring) {
  return [MEASURES_DIR, `ring-${ring}.json`].join('/');
}

// ── Measurable validation (mirrors extension/src/measurement.ts) ─────────────

const TIER_THRESHOLD_DEFAULTS = {
  1: { archReviewMinScore: 2.5, specQualityMinScore: 2.5, artifactCompletenessPct: 70, testCoveragePct: 80, ivvCoveragePct: 60, weightedGateMinScore: 60 },
  2: { archReviewMinScore: 3.0, specQualityMinScore: 3.0, artifactCompletenessPct: 80, testCoveragePct: 80, ivvCoveragePct: 75, weightedGateMinScore: 70 },
  3: { archReviewMinScore: 3.5, specQualityMinScore: 3.5, artifactCompletenessPct: 90, testCoveragePct: 80, ivvCoveragePct: 85, weightedGateMinScore: 80 },
  4: { archReviewMinScore: 4.0, specQualityMinScore: 4.0, artifactCompletenessPct: 95, testCoveragePct: 85, ivvCoveragePct: 90, weightedGateMinScore: 85 },
  5: { archReviewMinScore: 3.5, specQualityMinScore: 3.5, artifactCompletenessPct: 90, testCoveragePct: 80, ivvCoveragePct: 85, weightedGateMinScore: 80 },
  6: { archReviewMinScore: 3.0, specQualityMinScore: 3.0, artifactCompletenessPct: 85, testCoveragePct: 80, ivvCoveragePct: 80, weightedGateMinScore: 75 },
};

const MEASURE_WEIGHTS = { architecture: 0.2, spec: 0.15, artifact: 0.2, 'test-coverage': 0.25, ivv: 0.1 };

function defaultThresholdsForTier(tier) {
  return TIER_THRESHOLD_DEFAULTS[tier] || TIER_THRESHOLD_DEFAULTS[3];
}

// ── File helpers ────────────────────────────────────────────────────────────

function resolveWorkspacePath(relPath) {
  const root = path.resolve(WORKSPACE_ROOT);
  const fullPath = path.resolve(root, relPath);
  const relative = path.relative(root, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace root: ${relPath}`);
  }
  return fullPath;
}

function normalizeRing(value) {
  const ring = Number(value);
  if (!Number.isInteger(ring) || ring < 0 || ring > 5) {
    throw new Error(`Invalid ring '${value}'. Expected an integer from 0 through 5.`);
  }
  return ring;
}

function normalizeOptionalRing(value) {
  return value === undefined ? undefined : normalizeRing(value);
}

function readFile(relPath) {
  try {
    return fs.readFileSync(resolveWorkspacePath(relPath), 'utf8');
  } catch {
    return null;
  }
}

function writeFile(relPath, content) {
  const fullPath = resolveWorkspacePath(relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

function withFileLock(lockRelPath, fn) {
  const lockPath = resolveWorkspacePath(lockRelPath);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      fs.mkdirSync(lockPath, { recursive: false });
      try {
        return fn();
      } finally {
        fs.rmSync(lockPath, { recursive: true, force: true });
      }
    } catch (error) {
      if (error && error.code !== 'EEXIST') { throw error; }
      const ownerPath = path.join(lockPath, 'owner.json');
      try {
        const owner = JSON.parse(fs.readFileSync(ownerPath, 'utf8'));
        if (Date.now() - owner.ts > 30000) {
          fs.rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch { /* wait and retry */ }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  throw new Error(`Timed out acquiring file lock: ${lockRelPath}`);
}

const SECRET_PATTERNS = [
  /InstrumentationKey=[^;\s]+/gi,
  /(?:AccountKey|SharedAccessKey|Secret|Password|Token|ApiKey|ClientSecret)\s*=\s*[^;\s]+/gi,
  /(?:password|passwd|pwd|token|secret|api[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s,;]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /gh[pousr]_[A-Za-z0-9_]{20,}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
];

function redactText(value) {
  return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, '[REDACTED]'), String(value));
}

function safeJournalValue(value) {
  return redactText(value).replace(/[\r\n]+/g, ' ').replace(/\*\*/g, '\\*\\*');
}

function fileExists(relPath) {
  return fs.existsSync(resolveWorkspacePath(relPath));
}

// ── Config parsing ──────────────────────────────────────────────────────────

function parseWorkspaceConfig() {
  const content = readFile('.github/workspace-config.md');
  if (!content) return { tier: null, autonomy: 'human-in-the-loop', topRole: null };

  const tierMatch = content.match(/\*\*Tier:\*\*\s*(\d+)/);
  const autonomyMatch = content.match(/\*\*Autonomy:\*\*\s*(.*)/);
  const roleMatch = content.match(/\*\*Top Role:\*\*\s*(.*)/);

  return {
    tier: tierMatch ? parseInt(tierMatch[1], 10) : null,
    autonomy: autonomyMatch ? autonomyMatch[1].trim().toLowerCase() : 'human-in-the-loop',
    topRole: roleMatch ? roleMatch[1].trim() : null,
  };
}

function parseRingStatus() {
  const content = readFile('docs/Planning/ring-status.md');
  if (!content) return [];

  const rings = [];
  const rows = content.match(/\|\s*Ring-(\d)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/g) || [];
  for (const row of rows) {
    const match = row.match(/\|\s*Ring-(\d)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (match) {
      rings.push({
        ring: parseInt(match[1], 10),
        name: match[2].trim(),
        phase: match[3].trim(),
        status: match[4].trim(),
      });
    }
  }
  return rings;
}

// ── Evidence helpers ────────────────────────────────────────────────────────

function readEvidence(ring) {
  ring = normalizeRing(ring);
  const content = readFile(gateEvidenceRelPath(ring));
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}

function writeEvidence(ring, evidence) {
  ring = normalizeRing(ring);
  return brokerWrite('gate-evidence', {
    ring,
    tier: evidence.tier || parseWorkspaceConfig().tier || 1,
    collectedAt: evidence.collectedAt || new Date().toISOString(),
    entries: evidence.entries || [],
    algorithmDisclosure: evidence.algorithmDisclosure,
  }, 'reviewer-lead', 'authoritative', 'governance-mcp-server');
}

function findBrokerCli() {
  const candidates = [
    process.env.BROKER_CLI_PATH,
    path.join(WORKSPACE_ROOT, 'extension', 'out', 'broker', 'cli.js'),
    path.resolve(__dirname, '..', '..', 'extension', 'out', 'broker', 'cli.js'),
    path.resolve(__dirname, '..', '..', 'out', 'broker', 'cli.js'),
  ].filter(Boolean);
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) {
    throw new Error('Broker CLI not found. Run extension compile or set BROKER_CLI_PATH.');
  }
  return found;
}

function currentPrincipal() {
  return String(process.env.USERNAME || process.env.USER || 'unknown-principal');
}

function brokerWrite(ledger, record, role, authority, agentName) {
  const config = parseWorkspaceConfig();
  const request = {
    ledger,
    schemaVersion: '1.0',
    canonicalVersion: 'v1-sorted-keys',
    record,
    agent: {
      name: agentName || 'governance-mcp-server',
      role,
      tier: config.tier || 1,
      sessionId: process.env.VSCODE_AGENT_SESSION || process.env.GITHUB_COPILOT_SESSION_ID || 'mcp-stdio',
      principalId: currentPrincipal(),
    },
    authority,
    clientGuid: `${ledger}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  const stdout = execFileSync(process.execPath, [findBrokerCli()], {
    cwd: WORKSPACE_ROOT,
    env: { ...process.env, BROKER_WORKSPACE_ROOT: WORKSPACE_ROOT },
    input: JSON.stringify(request),
    encoding: 'utf8',
  });
  return JSON.parse(stdout.trim());
}

// ── Evidence required criteria (mirrors gate-evidence.ts) ───────────────────

const EVIDENCE_REQUIRED = {
  0: ['Feature files in specs/features/'],
  1: ['WBS/plan document populated'],
  2: ['Source code exists in src/', 'Unit tests exist in tests/'],
  3: ['Code review conducted'],
  4: [],
  5: [],
};

// ── Tool implementations ────────────────────────────────────────────────────

function getNextRequiredAction(args) {
  const config = parseWorkspaceConfig();
  const ringStatus = parseRingStatus();

  // Find the current active ring
  let activeRing = 0;
  for (const rs of ringStatus) {
    if (rs.phase === 'ACTIVE' || rs.phase === 'INITIATION') {
      activeRing = rs.ring;
      break;
    }
  }

  const required = EVIDENCE_REQUIRED[activeRing] || [];
  const evidence = readEvidence(activeRing);
  const submittedCriteria = new Set((evidence?.entries || []).map(e => e.criterion));
  const missing = required.filter(c => !submittedCriteria.has(c));

  return {
    tier: config.tier,
    autonomy: config.autonomy,
    activeRing,
    requiredEvidence: required,
    missingEvidence: missing,
    nextAction: missing.length > 0
      ? `Submit evidence for: ${missing.join(', ')}`
      : `All evidence submitted for Ring ${activeRing}. Run gate review to advance.`,
    isFullyAgentic: config.autonomy.includes('fully agentic'),
  };
}

function submitEvidence(args) {
  const { ring, criterion, agent, authority, proof, reasoning } = args;

  if (ring === undefined || !criterion || !agent) {
    return { success: false, error: 'Required: ring (number), criterion (string), agent (string)' };
  }

  let normalizedRing;
  try {
    normalizedRing = normalizeRing(ring);
  } catch (error) {
    return { success: false, error: error.message };
  }

  let evidence = readEvidence(normalizedRing);
  if (!evidence) {
    const config = parseWorkspaceConfig();
    evidence = { ring: normalizedRing, tier: config.tier || 1, collectedAt: new Date().toISOString(), entries: [] };
  }

  const entry = {
    criterion,
    timestamp: new Date().toISOString(),
    agent,
    authority: authority || 'agent',
    proof: proof || {},
  };
  // Layer 4: capture reasoning alongside evidence
  if (reasoning) { entry.reasoning = reasoning; }

  evidence.entries.push(entry);
  evidence.collectedAt = new Date().toISOString();

  writeEvidence(normalizedRing, evidence);

  // Layer 4: Auto-log reasoning to journal when provided with evidence
  if (reasoning) {
    appendToJournal({
      tag: 'RSN', type: 'REASONING', ring: normalizedRing, agent,
      fields: {
        Question: `Evidence for: ${criterion}`,
        Rationale: reasoning,
        'Evidence-Ref': `ring-${normalizedRing}.json`,
      },
    });
  }

  return {
    success: true,
    ring: normalizedRing,
    criterion,
    totalEntries: evidence.entries.length,
    reasoningCaptured: !!reasoning,
    message: `Evidence submitted for "${criterion}" at Ring ${normalizedRing}${reasoning ? ' (with reasoning)' : ''}`,
  };
}

function reviewGate(args) {
  const ring = normalizeRing(args.ring ?? 0);
  const evidence = readEvidence(ring);
  const required = EVIDENCE_REQUIRED[ring] || [];
  const submittedCriteria = new Set((evidence?.entries || []).map(e => e.criterion));

  const checks = required.map(criterion => ({
    criterion,
    hasEvidence: submittedCriteria.has(criterion),
    status: submittedCriteria.has(criterion) ? 'PASS' : 'FAIL',
  }));

  const passed = checks.filter(c => c.status === 'PASS').length;
  const failed = checks.filter(c => c.status === 'FAIL').length;

  // Also check for key files
  const fileChecks = [];
  if (ring === 0) {
    fileChecks.push({ check: 'specs/features/ has .feature files', exists: fs.readdirSync(path.join(WORKSPACE_ROOT, 'specs', 'features')).some(f => f.endsWith('.feature')) });
  }

  return {
    ring,
    evidenceChecks: checks,
    fileChecks,
    passed,
    failed,
    total: checks.length,
    recommendation: failed === 0 ? 'PASS' : passed > failed ? 'CONDITIONAL' : 'FAIL',
    missingEvidence: checks.filter(c => c.status === 'FAIL').map(c => c.criterion),
  };
}

function getActiveConfig() {
  const config = parseWorkspaceConfig();
  const ringStatus = parseRingStatus();

  return {
    ...config,
    rings: ringStatus,
    evidenceDir: GATE_EVIDENCE_DIR + '/',
    journalFile: JOURNAL_REL_PATH,
    workspace: path.basename(WORKSPACE_ROOT),
  };
}

function verifyCompliance(args) {
  const ring = normalizeRing(args.ring ?? 0);
  const findings = [];

  // Check 1: Journal entries exist for this ring
  const journal = readFile(JOURNAL_REL_PATH);
  const hasJournalEntries = journal && new RegExp(`Ring-${ring}`, 'i').test(journal);
  findings.push({
    check: `Journal entries exist for Ring ${ring}`,
    passed: hasJournalEntries,
    detail: hasJournalEntries ? 'Journal contains Ring entries' : 'No journal entries found for this ring',
  });

  // Check 2: Git commits exist (check git log)
  try {
    const { execSync } = require('child_process');
    const log = execSync('git log --oneline -20', { cwd: WORKSPACE_ROOT, encoding: 'utf8' });
    const hasCommits = log.trim().length > 0;
    findings.push({
      check: 'Git commits exist',
      passed: hasCommits,
      detail: hasCommits ? `${log.trim().split('\n').length} recent commits found` : 'No git commits',
    });
  } catch {
    findings.push({ check: 'Git commits exist', passed: false, detail: 'Git not available' });
  }

  // Check 3: Evidence file exists for this ring
  const evidence = readEvidence(ring);
  findings.push({
    check: `Structured evidence exists for Ring ${ring}`,
    passed: evidence !== null && evidence.entries.length > 0,
    detail: evidence ? `${evidence.entries.length} evidence entries` : 'No evidence file',
  });

  // Check 4: Decision log has entries
  const decisionLog = readFile(DECISION_LOG_REL_PATH);
  const hasDecisions = decisionLog && /DEC-\d{3}/.test(decisionLog);
  findings.push({
    check: 'Decision log has entries',
    passed: hasDecisions,
    detail: hasDecisions ? 'Decision log contains DEC entries' : 'No DEC entries in decision log',
  });

  // Check 5: Ring status file tracks this ring
  const ringStatus = parseRingStatus();
  const thisRing = ringStatus.find(r => r.ring === ring);
  findings.push({
    check: `Ring ${ring} tracked in ring-status.md`,
    passed: thisRing !== undefined && thisRing.phase !== '—',
    detail: thisRing ? `Phase: ${thisRing.phase}, Status: ${thisRing.status}` : 'Ring not tracked',
  });

  const passed = findings.filter(f => f.passed).length;
  return {
    ring,
    findings,
    passed,
    failed: findings.length - passed,
    total: findings.length,
    compliant: findings.every(f => f.passed),
  };
}

// ── Journal helpers (Layer 1) ───────────────────────────────────────────────

function appendToJournal(entry) {
  const fields = {};
  for (const [key, value] of Object.entries(entry.fields || {})) {
    if (value && String(value).trim()) {
      fields[safeJournalValue(key)] = safeJournalValue(value);
    }
  }
  const result = brokerWrite('journal', {
    type: entry.type,
    ring: entry.ring,
    agent: entry.agent,
    fields,
  }, 'mcp', entry.type === 'DECISION' ? 'authoritative' : 'telemetry', entry.agent || 'governance-mcp-server');
  return result.id;
}

function logWork(args) {
  const { task, outcome, ring, agent, duration, artifacts, reasoning } = args;
  if (!task) return { success: false, error: 'Required: task (string)' };
  const normalizedRing = normalizeOptionalRing(ring);

  const fields = { Task: task };
  if (outcome) fields.Outcome = outcome;
  if (duration) fields.Duration = duration;
  if (artifacts) fields.Artifacts = artifacts;
  if (reasoning) fields.Reasoning = reasoning;

  const id = appendToJournal({
    tag: 'WORK', type: 'WORK', ring: normalizedRing, agent,
    fields,
  });

  return { success: true, id, message: `Logged work: "${task}"` };
}

function logReasoning(args) {
  const { question, alternatives, selected, rationale, ring, agent, constraints, assumptions } = args;
  if (!question) return { success: false, error: 'Required: question (string)' };
  const normalizedRing = normalizeOptionalRing(ring);

  const fields = { Question: question };
  if (alternatives) fields.Alternatives = alternatives;
  if (selected) fields.Selected = selected;
  if (rationale) fields.Rationale = rationale;
  if (constraints) fields.Constraints = constraints;
  if (assumptions) fields.Assumptions = assumptions;

  const id = appendToJournal({
    tag: 'RSN', type: 'REASONING', ring: normalizedRing, agent,
    fields,
  });

  return { success: true, id, message: `Logged reasoning: "${question}"` };
}

function logDecision(args) {
  const { decision, policy, authority, accountable, reasoning, ring, agent } = args;
  if (!decision) return { success: false, error: 'Required: decision (string)' };
  const normalizedRing = normalizeOptionalRing(ring);

  const fields = { Decision: decision };
  if (policy) fields.Policy = policy;
  if (authority) fields.Authority = authority;
  if (accountable) fields.Accountable = accountable;
  if (reasoning) fields.Reasoning = reasoning;

  const id = appendToJournal({
    tag: 'DEC', type: 'DECISION', ring: normalizedRing, agent,
    fields,
  });

  return { success: true, id, message: `Logged decision: "${decision}"` };
}

// ── MCP Protocol Handler ────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'governance_getNextRequiredAction',
    description: 'Get the next required governance action for the current ring. Returns missing evidence, active ring, autonomy mode, and what to do next.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'governance_submitEvidence',
    description: 'Submit structured proof that a gate criterion has been satisfied. Include reasoning to capture WHY this approach was taken. Required for enforced criteria.',
    inputSchema: {
      type: 'object',
      properties: {
        ring: { type: 'number', description: 'Ring number (0-5)' },
        criterion: { type: 'string', description: 'The exact gate check criterion name' },
        agent: { type: 'string', description: 'Which agent is submitting this evidence' },
        authority: { type: 'string', enum: ['human', 'agent'], description: 'Who approved this evidence' },
        proof: { type: 'object', description: 'Structured proof (files created, checksums, etc.)' },
        reasoning: { type: 'string', description: 'WHY this approach was taken — captures the thinking behind the evidence' },
      },
      required: ['ring', 'criterion', 'agent'],
    },
  },
  {
    name: 'governance_reviewGate',
    description: 'Run a gate review for a specific ring. Returns pass/fail status for each criterion based on evidence.',
    inputSchema: {
      type: 'object',
      properties: {
        ring: { type: 'number', description: 'Ring number to review (0-5)' },
      },
      required: ['ring'],
    },
  },
  {
    name: 'governance_getActiveConfig',
    description: 'Get the current workspace configuration: tier, autonomy mode, ring statuses, and key file paths.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'governance_verifyCompliance',
    description: 'Post-hoc verification: check journal entries, git history, evidence, and decision log to verify an agent actually followed governance for a ring.',
    inputSchema: {
      type: 'object',
      properties: {
        ring: { type: 'number', description: 'Ring number to verify compliance for (0-5)' },
      },
      required: ['ring'],
    },
  },
  {
    name: 'governance_getDashboard',
    description: 'Get a governance compliance dashboard with aggregate metrics: journal activity, evidence coverage, compliance rates, artifact completeness, and git stats across all rings.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'governance_logWork',
    description: 'Log a WORK journal entry. Call this after completing any task, delegation, or work package. Low friction — just provide task and outcome.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'What was done (required)' },
        outcome: { type: 'string', description: 'Result or deliverable produced' },
        ring: { type: 'number', description: 'Ring number (0-5)' },
        agent: { type: 'string', description: 'Agent that did the work' },
        duration: { type: 'string', description: 'How long it took (e.g., "15m")' },
        artifacts: { type: 'string', description: 'Files created or modified' },
        reasoning: { type: 'string', description: 'Brief reasoning for approach taken' },
      },
      required: ['task'],
    },
  },
  {
    name: 'governance_logReasoning',
    description: 'Log a REASONING journal entry. Call this when evaluating alternatives, making trade-offs, or choosing between options. Captures the thinking process.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'What question or decision was being evaluated (required)' },
        alternatives: { type: 'string', description: 'What options were considered' },
        selected: { type: 'string', description: 'Which option was chosen' },
        rationale: { type: 'string', description: 'Why this option was selected' },
        ring: { type: 'number', description: 'Ring number (0-5)' },
        agent: { type: 'string', description: 'Agent that made the evaluation' },
        constraints: { type: 'string', description: 'Constraints that influenced the decision' },
        assumptions: { type: 'string', description: 'Assumptions the reasoning depends on' },
      },
      required: ['question'],
    },
  },
  {
    name: 'governance_logDecision',
    description: 'Log a DECISION journal entry with four-pillar traceability. Call this for every consequential decision (architecture, scope, risk, technology).',
    inputSchema: {
      type: 'object',
      properties: {
        decision: { type: 'string', description: 'What was decided (required)' },
        policy: { type: 'string', description: 'Policy or ADR governing this decision' },
        authority: { type: 'string', description: 'Who approved (human or agent)' },
        accountable: { type: 'string', description: 'Who is accountable for the outcome' },
        reasoning: { type: 'string', description: 'Why this decision was made' },
        ring: { type: 'number', description: 'Ring number (0-5)' },
        agent: { type: 'string', description: 'Agent that made the decision' },
      },
      required: ['decision'],
    },
  },
  {
    name: 'governance_recordMeasure',
    description: 'Record a measurable validation data point for a ring (advisory KPI). Optionally tag a dimension (architecture, spec, artifact, test-coverage, ivv) so it feeds the weighted scorecard.',
    inputSchema: {
      type: 'object',
      properties: {
        measureId: { type: 'string', description: 'Measure identifier, e.g. MV-GATE-test-coverage (required)' },
        value: { type: 'number', description: 'Numeric measured value (required)' },
        ring: { type: 'number', description: 'Ring number (0-5)' },
        unit: { type: 'string', description: 'Unit, e.g. percent, score, count' },
        dimension: { type: 'string', description: 'Scorecard dimension: architecture | spec | artifact | test-coverage | ivv' },
        evidenceRef: { type: 'string', description: 'Path or link to the supporting evidence' },
      },
      required: ['measureId', 'value'],
    },
  },
  {
    name: 'governance_getScorecard',
    description: 'Compute the advisory measurable scorecard for a ring: completeness %, per-dimension scores, weighted composite, and threshold breaches (only when thresholds are configured).',
    inputSchema: {
      type: 'object',
      properties: {
        ring: { type: 'number', description: 'Ring number (0-5)' },
      },
      required: [],
    },
  },
];

function readThresholdsFile() {
  const content = readFile(THRESHOLDS_REL_PATH);
  if (!content) return null;
  try {
    const json = JSON.parse(content);
    return json && typeof json === 'object' ? json : null;
  } catch {
    return null;
  }
}

function resolveThresholds(tier) {
  const defaults = defaultThresholdsForTier(tier);
  const fileOverrides = readThresholdsFile() || {};
  const merged = { ...defaults };
  let configured = false;
  for (const key of Object.keys(defaults)) {
    const value = fileOverrides[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      merged[key] = value;
      configured = true;
    }
  }
  return { thresholds: merged, thresholdsConfigured: configured };
}

function readMeasures(ring) {
  const content = readFile(measuresRelPath(ring));
  if (!content) return [];
  try {
    const json = JSON.parse(content);
    return Array.isArray(json.measures) ? json.measures : [];
  } catch {
    return [];
  }
}

/** Append a measurement record for a ring. */
function recordMeasure(args) {
  const ring = normalizeRing(args.ring ?? 0);
  if (!args.measureId || typeof args.measureId !== 'string') {
    throw new Error('recordMeasure requires a string measureId.');
  }
  const value = Number(args.value);
  if (!Number.isFinite(value)) {
    throw new Error('recordMeasure requires a finite numeric value.');
  }
  const record = {
    measureId: args.measureId,
    value,
    unit: typeof args.unit === 'string' ? args.unit : undefined,
    dimension: typeof args.dimension === 'string' ? args.dimension : undefined,
    evidenceRef: typeof args.evidenceRef === 'string' ? args.evidenceRef : undefined,
    recordedAt: new Date().toISOString(),
  };

  return withFileLock(measuresRelPath(ring) + '.lock', () => {
    const existing = readMeasures(ring);
    existing.push(record);
    writeFile(measuresRelPath(ring), JSON.stringify({ ring, measures: existing }, null, 2) + '\n');
    return { ring, recorded: record, totalMeasures: existing.length };
  });
}

/** Compute an advisory scorecard for a ring from evidence coverage + recorded measures. */
function getScorecard(args) {
  const ring = normalizeRing(args.ring ?? 0);
  const tier = parseWorkspaceConfig().tier || 1;
  const { thresholds, thresholdsConfigured } = resolveThresholds(tier);

  const evidence = readEvidence(ring);
  const required = EVIDENCE_REQUIRED[ring] || [];
  const submittedSet = new Set((evidence?.entries || []).map(e => e.criterion));
  const passedChecks = required.filter(c => submittedSet.has(c)).length;
  const totalChecks = required.length;
  const completenessPct = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  // Latest value per dimension from recorded measures.
  const measures = readMeasures(ring);
  const dimensionScores = {};
  for (const m of measures) {
    if (m && typeof m.dimension === 'string' && typeof m.value === 'number' && Number.isFinite(m.value)) {
      dimensionScores[m.dimension] = Math.min(100, Math.max(0, m.value));
    }
  }

  const entries = Object.entries(dimensionScores);
  let weightedScore;
  if (entries.length > 0) {
    let weightSum = 0;
    let acc = 0;
    for (const [key, val] of entries) {
      const weight = MEASURE_WEIGHTS[key] || 0;
      weightSum += weight;
      acc += val * weight;
    }
    weightedScore = weightSum > 0 ? Math.round(acc / weightSum) : completenessPct;
  } else {
    weightedScore = completenessPct;
  }

  const breaches = [];
  if (thresholdsConfigured) {
    const checkDim = (key, min, label, unit) => {
      const score = dimensionScores[key];
      if (score !== undefined && score < min) {
        breaches.push(`${label} ${score}${unit} below threshold ${min}${unit}`);
      }
    };
    checkDim('architecture', thresholds.archReviewMinScore * 20, 'Architecture review', '');
    checkDim('spec', thresholds.specQualityMinScore * 20, 'Spec quality', '');
    checkDim('artifact', thresholds.artifactCompletenessPct, 'Artifact completeness', '%');
    checkDim('test-coverage', thresholds.testCoveragePct, 'Test coverage', '%');
    checkDim('ivv', thresholds.ivvCoveragePct, 'IV&V coverage', '%');
    if (weightedScore < thresholds.weightedGateMinScore) {
      breaches.push(`Weighted gate score ${weightedScore} below threshold ${thresholds.weightedGateMinScore}`);
    }
  }

  return {
    ring,
    tier,
    completenessPct,
    dimensionScores,
    weightedScore,
    thresholdsConfigured,
    thresholds,
    breaches,
    measureCount: measures.length,
  };
}

function getDashboard() {
  const config = parseWorkspaceConfig();
  const rings = [];

  for (let ring = 0; ring <= 5; ring++) {
    const evidence = readEvidence(ring);
    const required = EVIDENCE_REQUIRED[ring] || [];
    const submittedSet = new Set((evidence?.entries || []).map(e => e.criterion));
    const submitted = required.filter(c => submittedSet.has(c)).length;

    // Count journal entries for this ring
    const journal = readFile(JOURNAL_REL_PATH) || '';
    const ringPattern = new RegExp(`Ring-${ring}`, 'g');
    const journalMatches = (journal.match(ringPattern) || []).length;

    rings.push({
      ring,
      journalEntries: journalMatches,
      evidenceRequired: required.length,
      evidenceSubmitted: submitted,
      evidenceCoverage: required.length > 0 ? Math.round((submitted / required.length) * 100) : 100,
    });
  }

  // Git metrics
  let gitCommits = 0;
  let hasUncommitted = false;
  try {
    const { execSync } = require('child_process');
    const log = execSync('git log --oneline -100', { cwd: WORKSPACE_ROOT, encoding: 'utf8' });
    gitCommits = log.trim().split('\n').filter(l => l.trim()).length;
    const status = execSync('git status --porcelain', { cwd: WORKSPACE_ROOT, encoding: 'utf8' });
    hasUncommitted = status.trim().length > 0;
  } catch { /* git not available */ }

  // Decision log count
  const decisionLog = readFile(DECISION_LOG_REL_PATH) || '';
  const decisionCount = (decisionLog.match(/DEC-\d{3}/g) || []).length;

  return {
    tier: config.tier,
    autonomy: config.autonomy,
    rings,
    aggregates: {
      totalEvidenceCoverage: rings.filter(r => r.evidenceRequired > 0).length > 0
        ? Math.round(rings.filter(r => r.evidenceRequired > 0).reduce((s, r) => s + r.evidenceCoverage, 0) / rings.filter(r => r.evidenceRequired > 0).length)
        : 100,
      decisions: decisionCount,
      gitCommits,
      hasUncommitted,
    },
  };
}

const TOOL_HANDLERS = {
  governance_getNextRequiredAction: getNextRequiredAction,
  governance_submitEvidence: submitEvidence,
  governance_reviewGate: reviewGate,
  governance_getActiveConfig: getActiveConfig,
  governance_verifyCompliance: verifyCompliance,
  governance_getDashboard: getDashboard,
  governance_logWork: logWork,
  governance_logReasoning: logReasoning,
  governance_logDecision: logDecision,
  governance_recordMeasure: recordMeasure,
  governance_getScorecard: getScorecard,
};

// ── JSON-RPC over stdio ─────────────────────────────────────────────────────

function sendResponse(id, result) {
  const response = { jsonrpc: '2.0', id, result };
  const body = JSON.stringify(response);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function sendError(id, code, message) {
  const response = { jsonrpc: '2.0', id, error: { code, message } };
  const body = JSON.stringify(response);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'governance-mcp-server', version: '1.0.0' },
      });
      break;

    case 'initialized':
      // No response needed for notification
      break;

    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const handler = TOOL_HANDLERS[toolName];
      if (!handler) {
        sendError(id, -32601, `Unknown tool: ${toolName}`);
        return;
      }
      try {
        const result = handler(toolArgs);
        sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (err) {
        sendError(id, -32603, `Tool error: ${err.message}`);
      }
      break;
    }

    default:
      if (id !== undefined) {
        sendError(id, -32601, `Method not found: ${method}`);
      }
  }
}

// ── Message framing (Content-Length header) ──────────────────────────────────

let buffer = '';

function startStdioServer() {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;

    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = buffer.substring(0, headerEnd);
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        buffer = buffer.substring(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(lengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + contentLength) break;

      const body = buffer.substring(bodyStart, bodyStart + contentLength);
      buffer = buffer.substring(bodyStart + contentLength);

      try {
        handleMessage(JSON.parse(body));
      } catch (err) {
        process.stderr.write(`Parse error: ${err.message}\n`);
      }
    }
  });

  process.stderr.write('Governance MCP Server started\n');
}

module.exports = {
  TOOLS,
  TOOL_HANDLERS,
  getScorecard,
  recordMeasure,
  getDashboard,
  resolveThresholds,
  defaultThresholdsForTier,
  TIER_THRESHOLD_DEFAULTS,
  MEASURE_WEIGHTS,
};

if (require.main === module) {
  startStdioServer();
}
