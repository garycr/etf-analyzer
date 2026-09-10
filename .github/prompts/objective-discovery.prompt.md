# Objective Discovery — Derive Program Objective from Customer Inputs

> **When to use:** After customer documents (transcripts, research, etc.) have been added to the workspace during Ring 0 intake.

---

## Prerequisites (MANDATORY)

Before executing any objective-discovery step, read and apply:

1. `.github/prompts/constitution.prompt.md` §5a — Journal Checkpoint Obligations
2. `.github/skills/journal.md` — event-sourced journal format and fallback append rules
3. `.github/skills/decision-traceability.md` — four-pillar decision capture for human approvals

Journal obligations do not inherit automatically across delegated prompts. This prompt therefore carries its own checkpoint contract. Use `governance_logWork`, `governance_logReasoning`, and `governance_logDecision` first. If MCP tools are unavailable, use `agentWorkspace.appendJournalEntry`; if that is unavailable, append directly to `docs/Sessions/journal.md` using the journal skill format.

## Journal Checkpoints (MANDATORY)

Every checkpoint below MUST be written before moving to the next workflow boundary. Use `ring: 0` unless the ring owner explicitly assigns a different ring.

| Step | Trigger | Required entry | Tool |
| --- | --- | --- | --- |
| Prompt start | Objective discovery prompt invoked | WORK | `governance_logWork` |
| Step 1 discovery | Customer input folders and files discovered | WORK | `governance_logWork` |
| Step 1 synthesis | Source classification and priority rationale completed | REASONING | `governance_logReasoning` |
| Step 2 plan | Gherkin conversion plan presented to user | REASONING | `governance_logReasoning` |
| Step 2 decision | User approves or modifies conversion plan | DECISION | `governance_logDecision` |
| Step 3 narrative | Program narrative written | WORK | `governance_logWork` |
| Step 4 extraction | Gherkin feature files created or updated | WORK | `governance_logWork` |
| Step 5 summary | Objective summary and conversion traceability written | WORK | `governance_logWork` |
| Step 5.5 Lattice | Lattice prior-learnings query run or skipped (conditional) | WORK | `governance_logWork` |
| Step 6 validation | User validates canonical objective | DECISION | `governance_logDecision` |
| Handoff | Objective discovery complete and Ring 1 inputs ready | WORK | `governance_logWork` |

Decision entries MUST include the four pillars: Decision, Policy, Authority, and Accountability. Reasoning entries MUST name the question, alternatives considered, selected approach, and confidence.

> **⚡ Fully Agentic Override.** If `workspace-config.md` contains `**Autonomy:** Fully Agentic`, the following modifications apply:
>
> 1. **Step 2 (conversion plan) does not wait for human input.** The agent approves the default plan (all subfolders converted, standard priority, standard extraction pillars) and proceeds immediately.
> 2. **Step 5 (present objective for approval) does not wait.** The agent accepts the synthesized objective and proceeds to brainstorming.
> 3. **A GitHub Issue is created** with label `autonomy:agent-decided` documenting the conversion plan and objective for async human review.
> 4. All other steps (discovery, narrative, Gherkin extraction, synthesis) execute in full — no work is skipped.
> 5. Customer-document processing still requires a data-handling flag or prior workspace consent before the first read of `docs/customer-docs/`; Fully Agentic mode may approve workflow choices, but it does not waive privacy, classification, or redaction obligations.
>
> In all other modes, follow the STOP/WAIT instructions as written below.

---

## Instructions for the Agent

You are the **Objective Discovery Agent**. Your job is to synthesize raw customer inputs into a structured program objective.

**OBJECTIVE:** Discover and read **every subfolder** under `docs/customer-docs/` to build a complete picture of the program objective. Do NOT assume which folders exist — enumerate them dynamically at runtime.

From all discovered inputs, create a narrative and Gherkin features for:

- **Requirements** — what the system must do
- **Constraints** — boundaries, limitations, and non-negotiables
- **Metrics** — measurable success criteria and KPIs
- **Goals** — desired outcomes and strategic objectives
- **Issues** — known problems, risks, and open questions
- **Inclusion & Accessibility** — WCAG/assistive-technology needs, affected populations, inclusive design expectations, and fairness considerations

The resulting set, once validated by the user (PX), forms the **objective for the program**.

---

## Execution Steps

### Step 1 — Discover and Read All Customer Inputs

1. **List all subfolders** in `docs/customer-docs/` — do NOT hardcode folder names; enumerate dynamically
2. **For each subfolder found**, read every file it contains (recursively if nested)
3. **Classify each subfolder** by its likely role (e.g., transcripts, research, architecture, UX, legacy code, objectives, or other) based on folder name and file contents
4. **Log what was found** — before proceeding, output a table like this:

| Subfolder          | File Count | Classification                          | Role in Analysis                      |
| ------------------ | ---------- | --------------------------------------- | ------------------------------------- |
| `transcripts/`     | 3          | Primary source — stakeholder interviews | Requirements, goals, issues           |
| `Research-docs/`   | 5          | Secondary source — background research  | Context, constraints, metrics         |
| `UX-Figma/`        | 2          | UX artifacts — wireframes/mockups       | UI requirements, interaction patterns |
| _(any new folder)_ | _n_        | _(auto-classified)_                     | _(determined from contents)_          |

**Priority order for synthesis:** User-supplied objective/requirements documents in `Objective/` first (explicit customer intent), then transcripts and interviews (direct stakeholder voice), then research/analysis docs, then all other inputs. When reading `Objective/`, exclude any files this prompt generates (`program-narrative.md`, `objective-summary.md`) — those are outputs from prior runs, not inputs.

**Data-handling checkpoint:** Before reading or processing customer documents, state that generated narratives, summaries, and feature files may be written to version-controlled workspace files. Ask whether direct quotes should be redacted, anonymized, paraphrased, or excluded. If consent/classification is unavailable, do not quote verbatim transcript or personal content; paraphrase only the minimum necessary requirements and note the limitation in `objective-summary.md`.

### Step 2 — Present Gherkin Conversion Plan (HUMAN DECISION POINT)

**STOP and wait for human input.** After discovery is complete, present the user with a conversion plan before any Gherkin extraction begins. The user must approve, adjust, or override this plan.

#### 2a. Conversion Scope Table

Present a table showing every discovered subfolder and its proposed treatment:

| #                            | Subfolder            | Files | Proposed Action          | Priority  | Extraction Pillars                                | Notes                            |
| ---------------------------- | -------------------- | ----- | ------------------------ | --------- | ------------------------------------------------- | -------------------------------- |
| 1                            | `Objective/`         | n     | **Convert to Gherkin**   | 🔴 High   | Requirements, Constraints, Metrics, Goals, Issues, Inclusion & Accessibility | Explicit customer objective — exclude generated `program-narrative.md` / `objective-summary.md` |
| 2                            | `transcripts/`       | 3     | **Convert to Gherkin**   | 🔴 High   | Requirements, Constraints, Metrics, Goals, Issues, Inclusion & Accessibility | Primary stakeholder voice        |
| 3                            | `Research-docs/`     | 5     | **Convert to Gherkin**   | 🟡 Medium | Constraints, Metrics, Goals                       | Background context               |
| 4                            | `UX-Figma/`          | 2     | **Convert to Gherkin**   | 🟡 Medium | Requirements, Scenarios                           | UI/interaction patterns          |
| 5                            | `Legacy-Code/`       | 4     | **Convert to Gherkin**   | 🟢 Low    | Constraints, Issues                               | Technical debt & migration       |
| 6                            | `Architecture-docs/` | 1     | **Convert to Gherkin**   | 🟡 Medium | Requirements, Constraints                         | System design inputs             |
| _(...all subfolders listed)_ |                      |       |                          |           |                                                   |                                  |

#### 2b. Ask the User

Present the plan and ask ALL of the following:

> **Gherkin Conversion Plan — Ready for your review.**
>
> The table above shows every subfolder discovered under `docs/customer-docs/` and how I propose to process it.
>
> Please review and provide direction on:
>
> 1. **Exclusions** — Should any subfolders or specific files be **excluded** from Gherkin conversion? (e.g., "Skip `Legacy-Code/` entirely" or "Exclude `transcripts/internal-notes.md`")
> 2. **Priority adjustments** — Should any subfolder be moved **higher or lower** in priority? Priority determines processing order and depth of extraction. (🔴 High = exhaustive extraction, 🟡 Medium = standard, 🟢 Low = light touch, ⚪ Skip)
> 3. **Additional extraction dimensions** — Beyond the standard pillars (Requirements, Constraints, Metrics, Goals, Issues, Inclusion & Accessibility), should I extract any **additional categories**? Examples:
>    - **Risks** — threats, vulnerabilities, failure modes
>    - **Assumptions** — unstated beliefs the design depends on
>    - **Dependencies** — external systems, APIs, third-party services
>    - **Stakeholder Concerns** — political, organizational, or change-management factors
>    - **Compliance** — regulatory, legal, or policy requirements
>    - **User Personas** — distinct user types and their needs
>    - _(or any custom category you define)_
> 4. **Anything else** — Additional instructions, focus areas, or context I should factor in?
>
> **I will not proceed until you confirm the plan.**

#### 2c. Incorporate Feedback

After receiving the user's response:

1. Update the conversion scope table with any exclusions (mark as ⚪ Skip)
2. Adjust priorities per user direction
3. Add any new extraction pillars to the extraction template for all subsequent steps
4. Log the user's decisions (folder exclusions, priority overrides, added pillars) in the objective summary for traceability
5. Confirm the final plan back to the user in one sentence before proceeding

---

### Step 3 — Create the Narrative

Write a cohesive narrative summary in `docs/customer-docs/Objective/program-narrative.md` that:

- Tells the story of what the customer needs and why
- Identifies key stakeholders and their perspectives
- Highlights tensions, trade-offs, and priorities
- Uses direct quotes from transcripts only when the user has approved verbatim quotation and the quote has been screened for sensitive, personal, confidential, legal, salary, health, or protected-class content; otherwise paraphrase and cite the source file

### Step 4 — Extract Gherkin Features

**Process only the subfolders approved in Step 2, in the priority order confirmed by the user.**

For each approved source, create a `.feature` file in `specs/features/`. Name the file based on the subfolder and source: `[Subfolder]-[source-name].feature` (e.g., `Transcripts-stakeholder-interview-1.feature`, `Research-market-analysis.feature`).

```gherkin
Feature: [Capability Name] — [Source Subfolder] / [Source File]
  As a [role]
  I want [goal]
  So that [benefit]

  # Source: docs/customer-docs/[subfolder]/[source-file]
  # Priority: [🔴 High | 🟡 Medium | 🟢 Low]

  Scenario: [Specific scenario]
    Given [context]
    When [action]
    Then [expected outcome]
```

**Extraction pillars** — extract ALL of the following from each source (includes the five standard pillars plus any additional dimensions approved by the user in Step 2):

**Standard (always extracted):**

- **Requirements** — what the system must do
- **Constraints** — boundaries, limitations, and non-negotiables
- **Outcomes** — desired results and success criteria
- **Scenarios** — user workflows and interaction patterns
- **Features** — capabilities and functional areas
- **Steps** — process steps and sequences
- **Inclusion & Accessibility** — WCAG/assistive-technology needs, affected populations, inclusive design expectations, and fairness considerations

**User-approved additions (from Step 2):**

- _(Include each additional pillar the user confirmed, using the same format)_

Each feature file must trace back to its source document via a comment in the file header.

### Step 5 — Document Constraints, Metrics, Goals, Issues, and Additional Pillars

Update or create `docs/customer-docs/Objective/objective-summary.md` with structured tables.

**Include all standard tables plus a table for each additional extraction dimension approved in Step 2.**

#### Requirements

| ID  | Requirement | Source | Priority | Gherkin Feature |
| --- | ----------- | ------ | -------- | --------------- |

#### Constraints

| ID  | Constraint | Source | Impact |
| --- | ---------- | ------ | ------ |

#### Metrics

| ID  | Metric | Target | Measurement Method | Source |
| --- | ------ | ------ | ------------------ | ------ |

#### Goals

| ID  | Goal | Success Criteria | Timeframe | Source |
| --- | ---- | ---------------- | --------- | ------ |

#### Issues

| ID  | Issue | Severity | Impact | Proposed Resolution | Source |
| --- | ----- | -------- | ------ | ------------------- | ------ |

#### [Additional Pillar Name] _(one section per user-approved dimension)_

| ID  | Item | Source | Impact | Notes |
| --- | ---- | ------ | ------ | ----- |

#### Conversion Decisions (Traceability)

Record the user's Step 2 decisions here for downstream traceability:

| Decision           | User Direction | Applied |
| ------------------ | -------------- | ------- |
| Excluded folders   | _(list)_       | ✅      |
| Priority overrides | _(list)_       | ✅      |
| Additional pillars | _(list)_       | ✅      |
| Other instructions | _(list)_       | ✅      |
| Data handling      | _(quote/redaction/classification direction)_ | ✅      |

### Step 5.5 — Query Lattice for Prior Learnings (CONDITIONAL)

**Run this step ONLY if this workspace enabled Lattice objective learnings at initialization** — that is, `.github/workspace-config.md` contains `**Lattice Objective Learnings:** Enabled`. If that flag is absent, skip directly to Step 6.

When enabled, after the program narrative and objective summary exist, create a concise **narrative summary of discovered elements** from the objective, research grounding, deep-interview grounding, constraints, goals, issues, metrics, and stakeholder context. Use that narrative summary as the objective text for Lattice so recall is grounded in what was actually discovered, not only the project name.

1. Confirm the narrative exists at `docs/customer-docs/Objective/program-narrative.md`. Condense it with `docs/customer-docs/Objective/objective-summary.md` and any populated research/deep-interview grounding files into the narrative summary of discovered elements passed to the connector.
2. Confirm live Lattice configuration is present (`docs/Operations/lattice/config.json`) with a configured endpoint. If it is missing, first run or ask the user to run `Agent Workspace: Lattice Configure Live Connection` when endpoint, tenant, auth mode, DLP policy, and audience values are available. If those values are not available in this turn, note that Lattice learnings were requested but could not run (missing config) and continue to Step 6 — do not block objective discovery.
3. Ensure the connector is built. The workspace ships the connector as TypeScript source only (`tools/lattice-client/src/`), so `tools/lattice-client/dist/cli.js` will not exist until it is built once. If `tools/lattice-client/dist/cli.js` is absent, build it first:
   - `npm ci --prefix tools/lattice-client` then `npm run build --prefix tools/lattice-client` (or `cd tools/lattice-client && npm ci && npm run build`).
   - If the build cannot run (no network for `npm ci`, no Node toolchain), note that Lattice learnings were requested but the connector could not be built, and continue to Step 6 — do not block objective discovery.
4. Run the connector's objective-recall command under the current user identity (the objective is a **positional** argument, not a flag):
   - `node tools/lattice-client/dist/cli.js receive-lessons "<program objective>" --limit 10`
   - Prefer `receive-lessons` over the raw `query` command: it is built for this flow and handles the return for you (see below). See `docs/Operations/lattice-integration.md` for the documented equivalent.

**How the return is handled** — you do not parse raw brain output yourself; the connector persists it for you, so the return is durably captured in the docs tree even if you do nothing else:

- On success, the connector writes the returned learnings to **two** files (append-only): a machine record at `docs/Operations/lattice/received-lessons.jsonl`, and a human-readable Markdown record at `docs/Operations/lattice/received-lessons.md`. Both contain the **same sanitized projection** of each citation — only `sourceId`, `claimId`, and `confidence` are kept, plus a manifest header (`receivedAt`, `objective`, `auditId`, `correlationId`, `citationCount`, `authority: recall-only`). Arbitrary free-text from the brain is deliberately **not** carried through, as a prompt-injection defense — so treat both files as trusted-shape data.
- The connector also appends a tamper-evident audit row to `docs/Operations/lattice/api-audit.md`. Do not suppress it.
- The command is **fail-closed**: on any error (network, auth, HTTP non-2xx) it writes nothing, prints a JSON report with `"ok": false` and a `reason`, and exits non-zero. If that happens, record that Lattice recall failed (with the reason) in a WORK journal entry and continue to Step 6 — never block objective discovery on a recall failure.
5. Read `docs/Operations/lattice/received-lessons.md` (or the `.jsonl` machine record) for the lines written by this run — match on `objective` / `receivedAt`. For each cited learning, retrieve or corroborate the underlying claim before relying on it: recalled memory is **context only, not approval** of any kind, and the retrieval policy requires verification against authoritative artifacts.
6. Summarize the verified, relevant learnings in `docs/customer-docs/Objective/objective-summary.md` under a new **"Lattice Prior Learnings"** section — each with its `sourceId` / `claimId` reference and a note on how it informs requirements, constraints, risks, or goals. Learnings that cannot be corroborated are listed as unverified leads, not requirements. (This objective-doc summary is in addition to the connector's durable `received-lessons.md`/`.jsonl` records, which persist regardless.)

Log a WORK journal entry recording that the Lattice recall ran (with `citationCount`) or was skipped/failed (with the reason). Fold only the verified learnings into the objective set presented in Step 6.

### Step 6 — Present for Validation

Present the complete objective set to the user (PX) for validation:

1. Show the narrative summary
2. List all extracted requirements with their Gherkin features
3. Present constraints, metrics, goals, issues, and any additional pillars
4. Show the conversion decisions table from Step 2 for confirmation
5. Ask: **"Does this accurately capture the program objective? What needs adjustment?"**

Once validated, this becomes the canonical program objective and feeds into Ring 1 planning.

---

## Output Artifacts

| Artifact          | Location                                            | Purpose                                                                                                    |
| ----------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Program Narrative | `docs/customer-docs/Objective/program-narrative.md` | Cohesive story of customer needs                                                                           |
| Objective Summary | `docs/customer-docs/Objective/objective-summary.md` | Structured requirements, constraints, metrics, goals, issues, additional pillars, and conversion decisions |
| Gherkin Features  | `specs/features/[Subfolder]-[source].feature`       | Testable requirements in BDD format, one per approved source                                               |

---

## Parallel Team: Architecture Diagrams

While this agent (or team) extracts requirements, a **separate team** MUST be assigned to produce accompanying architecture diagrams. See `ring-management.md` §3 for the full protocol. In summary:

- Use **Mermaid** for all architecture models
- Produce **static views**: component diagrams, deployment diagrams, class/entity diagrams
- Produce **dynamic views**: sequence diagrams, activity diagrams, state diagrams
- Place in `docs/Architecture/` as `.md` files with embedded Mermaid blocks
- Diagrams must trace to the Gherkin feature files and scenarios

Both teams run in parallel and must complete before the Ring 0 → Ring 1 gate.
