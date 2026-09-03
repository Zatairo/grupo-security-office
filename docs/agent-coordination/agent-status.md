# Agent Status

> This file is the persistent coordination state for Kilo Code and OpenCode.
> Update it before work starts, after validation, and immediately after committing.
> Do not remove historical task entries; mark completed work as `COMMITTED`.

## Active agents

| Executor | Agent | Status | Task ID | Task title | Branch | Files reserved | Dependencies | Last commit | Blockers | Next action | Updated at |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Kilo Code | NONE | IDLE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | Await Perplexity assignment | YYYY-MM-DDTHH:MM:SSZ |
| OpenCode | NONE | IDLE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | Await Perplexity assignment | YYYY-MM-DDTHH:MM:SSZ |

## Allowed status values

- `IDLE`
- `PLANNING`
- `WORKING`
- `BLOCKED`
- `VALIDATING`
- `DOCUMENTING`
- `COMMITTED`
- `WAITING`

## Current coordination decision

- `Coordinator`: Perplexity
- `Default branch`: `main`
- `Parallel work allowed`: only with non-overlapping file ownership
- `OpenRouter fallback`: forbidden unless explicitly approved by the user