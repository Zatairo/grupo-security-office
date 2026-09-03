# Kilo Code and OpenCode Coordination Protocol

## Purpose

Kilo Code and OpenCode are peer technical executors working on the same repository.
Perplexity is the sole coordinator and assigns closed, non-overlapping tasks.

This protocol preserves task state, file ownership, validation evidence, and commit history when chat memory or agent session memory is unavailable.

## Mandatory files

- `agent-status.md`: current assignment and status of each executor.
- `file-ownership.md`: active and released file reservations.
- `work-log.md`: append-only completed-task and handoff evidence.

## Required preflight

Before starting any task, the assigned agent must:

1. Read this file.
2. Read `agent-status.md`.
3. Read `file-ownership.md`.
4. Read only the files explicitly authorized in the task.
5. Confirm that no reservation conflict exists.
6. Register the task as `PLANNING`.
7. Reserve the exact files it will modify.

## Parallel execution

Parallel work is allowed only when tasks:
- Modify different files.
- Do not modify the same endpoint, API contract, shared type, schema, migration, package manifest, lock file, or infrastructure configuration.
- Have no unresolved dependency on the other task.
- Can be validated independently.

If a conflict exists, the task status must be `WAITING` or `BLOCKED`. Do not proceed until Perplexity resolves the conflict.

## Required closure

A task is complete only after the agent:

1. Runs allowed validation commands.
2. Appends a result to `work-log.md`.
3. Updates `agent-status.md`.
4. Releases reservations in `file-ownership.md`.
5. Creates one atomic commit containing code, documentation, and validation outcome.
6. Reports the commit hash.

## Git rules

- Use one task branch per task: `agent/<executor>/<task-id>-<short-slug>`.
- Use one atomic commit per closed task.
- Commit format: `<type>(<scope>): <imperative English summary> [<TASK_ID>]`.
- Do not force-push.
- Do not amend or rewrite another agent's commit.
- Do not merge into `main` without an explicit Perplexity order and required user approval.
- Do not include secrets, `.env` files, keys, tokens, generated build artifacts, or unrelated files.

## Model policy

- Use only the configured NVIDIA Build model.
- Do not use OpenRouter automatically.
- If the configured NVIDIA model is unavailable, set status to `BLOCKED` and report `BLOCKED_MODEL`.
- OpenRouter requires explicit user approval for the exact task.