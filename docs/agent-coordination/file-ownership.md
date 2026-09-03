# File Ownership

> This file prevents concurrent edits and merge conflicts.
> An agent must reserve files before modifying them and release them after committing.
> Perplexity must inspect this file before every new delegation.

## Active reservations

| Task ID | Executor | Agent | Branch | Reserved file or directory | Purpose | Status | Reserved at | Expected release |
|---|---|---|---|---|---|---|---|---|
| NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE |

## Reservation rules

1. Reserve every code, configuration, documentation, test, migration, or infrastructure file before editing it.
2. Do not reserve broad directories when exact files are known.
3. A reservation conflicts when it targets the same file or a shared logical resource:
   - API endpoint
   - DTO or shared type
   - Prisma schema or migration
   - package manifest or lock file
   - deployment configuration
   - shared UI component
4. A conflicting task remains `WAITING` until Perplexity resolves ownership.
5. Release reservations only after documentation, validation, and commit are complete.
6. Historical released reservations remain below for traceability.

## Released reservations

| Task ID | Executor | Agent | Files | Commit | Released at |
|---|---|---|---|---|---|
| COORD-RECONCILE-001 | OpenCode | tech-lead-orchestrator | AGENTS.md, docs/AGENT_TEAM.md, docs/WORKFLOW.md, docs/PROJECT_STATUS.md, docs/agent-coordination/*, opencode.json, .opencode/agents/*.md, .opencode/agent/excel-*.md, data/import/README.md, requirements.txt | (see work-log) | 2026-09-03T00:00:00Z |