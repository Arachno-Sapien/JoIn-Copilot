---
name: prompt-template
description: Use when adding or changing an LLM prompt in backend/app/prompts/, adding a backend call to the model through backend/app/llm/, or writing tests for code that calls the model. Covers the versioned template format, declaring untrusted fields, structured output, model tiers, the in-memory cache and mock-mode testing with the fake_llm fixture.
---

# Prompt template

Every model call goes through the wrapper in `backend/app/llm/`, using a versioned template from `backend/app/prompts/`. The model only returns structured data. Code decides what to do with it. Source of truth: `docs/design.md` sections 2.2, 4.3, 7.3, 8.5 and 11.1.

## Template files

- One file per prompt version: `backend/app/prompts/<name>.v<N>.md`, for example `extract_job.v1.md`.
- The front matter lists every input that comes from outside the user under `untrusted:`.
- The placeholder syntax is documented in `backend/app/prompts/README.md`. Follow it rather than inventing another.

Untrusted inputs are job descriptions, page text, form labels, emails and anything else a stranger wrote. The renderer wraps each declared field in an `<untrusted_data>` block under a system preamble saying delimited text is data, never instructions. A field you forget to declare is pasted in raw, which is exactly how prompt injection gets in. When in doubt, declare it.

## Calling the model

The wrapper's entry point is `await acomplete(template, inputs, schema, tier)` (endpoints are async; `complete` is a blocking form for scripts). It returns a validated Pydantic object. The call goes to BharatCode (`POST /responses`, `store: false`, structured output from the schema) through `backend/app/llm/bharatcode.py`, using the user's key from the request.

- Always pass a Pydantic `schema`. Never parse free text or use regex on model output.
- Both tiers run `qwen-3.8-27b`; the tier only separates cache entries. Give a new prompt its output budget and reasoning effort in `TASK_LIMITS` in `backend/app/llm/client.py` (default 2000 tokens, effort `none`). A cut-off answer raises `TruncatedError`; never retry it with the same budget.
- Never add another model id or provider, and never use `deepseek-v4.1-flash`.
- Never pass `tools`, `tool_choice`, `functions` or `function_call`. The model gets no actions. The `non-goals` oracle fails if any of those appear as arguments under `backend/app`.

## Changing a prompt

1. Copy it to the next version (`v2`), edit the copy, and point the caller at it.
2. The in-memory cache keys on the template name and version, so old cached answers stop matching automatically.
3. Delete the old version once nothing references it.
4. Once the evaluation suite exists (`backend/eval/`), run the evaluation for the affected component before merging. Never tune a prompt against the evaluation set itself.

## Personal data

- The LLM cache lives in memory only. Never add a disk, SQLite or Redis cache for model output: drafts and parsed profiles are personal data, and the backend stores none.
- Never log prompts, inputs or model output. Request logging records method, path, status and latency only.

## Testing

Tests and gates run with `JC_LLM_MODE=mock`, and never call a real model. Register the response you expect with the `fake_llm` fixture from `backend/tests/conftest.py`. Its exact API is in that file. A call with no registered fake raises an error, so a missing fake shows up as a test failure, never as a live request.

Test what the code does with the model's output (validation, retries, flags, scoring), not the quality of the model's answer. Answer quality is measured only by the evaluation suite.

The driver-owned audit `backend/tests/acceptance/test_prompt_delimiting.py` renders every template with injection text in each declared field. It fails if that text appears outside an `<untrusted_data>` block.

## Check your work

Run from `backend/`:

```bash
uv run --locked pytest tests -q
```

Run from the repository root:

```bash
node scripts/gates/oracles.mjs non-goals
```
