# GEPA Prompt Optimization

This folder contains a local harness for improving Cabinet's `content-manager` system prompt with GEPA.

The current setup optimizes the body text in:

- `data/.agents/content-manager/persona.md`

It does not modify production prompt-building behavior unless you choose to copy the optimized prompt back into that file.

## What It Does

1. Loads a small train/validation dataset of stable content-manager questions.
2. Runs each candidate prompt against a disposable copy of `data/`.
3. Scores the result on:
   - whether it produced a usable `cabinet` block
   - whether it gave a plain-English answer before the block
   - whether it mentioned the expected planning recommendation
   - whether reported `ARTIFACT` paths match the KB markdown files it actually changed
4. Optionally asks a second ACP-backed model run to act as an LLM judge and blend that score with the hard artifact/file-consistency checks.
5. Uses GEPA's lower-level `optimize(...)` API with a custom adapter so proposal/reflection can come either from:
   - `codex-cli` through your ChatGPT/Codex subscription
   - a direct API-backed reflection model

## Files

- `content-manager-cases.jsonl`: train/validation cases
- `run-content-manager-case.ts`: evaluates one prompt candidate on one case
- `gepa_optimize_content_manager.py`: runs the GEPA optimization loop and writes reports

## Install

GEPA is a Python package:

```bash
UV_CACHE_DIR=/tmp/uv-cache uv venv --python /opt/homebrew/bin/python3.14 .venv-promptopt
UV_CACHE_DIR=/tmp/uv-cache uv pip install --python .venv-promptopt/bin/python gepa
```

If `.venv-promptopt` exists, the npm GEPA command will use it automatically. Otherwise it falls back to `python3`, but that interpreter must be Python 3.10+.

The evaluator and optional LLM judge use Cabinet's existing ACP provider stack through:

```bash
npx tsx scripts/prompt-optimization/run-content-manager-case.ts --help
```

So you also need the usual Cabinet provider auth/config already working locally. For subscription-backed Codex runs, keep Cabinet's default provider on `codex-cli` and make sure `codex` is logged in.

## Baseline Only

This measures the current prompt without running GEPA mutation steps:

```bash
npm run promptopt:content-manager:gepa -- \
  --baseline-only
```

By default, baseline runs use:

- the Cabinet ACP evaluator
- the ACP LLM judge (`--judge-mode llm-acp`)
- the current provider/model settings, with runtime fallback if the configured model is unsupported by the adapter

Use heuristics only if you want to disable the judge:

```bash
npm run promptopt:content-manager:gepa -- \
  --baseline-only \
  --judge-mode heuristic
```

## Run Optimization

Subscription-backed Codex proposer:

```bash
npm run promptopt:content-manager:gepa -- \
  --proposer codex-cli \
  --max-metric-calls 8
```

Direct API reflection model:

```bash
npm run promptopt:content-manager:gepa -- \
  --proposer api \
  --reflection-lm openai/gpt-5 \
  --max-metric-calls 8
```

Outputs are written under:

```text
scripts/prompt-optimization/out/content-manager/
```

Key artifacts:

- `baseline.json`
- `best-persona-body.md`
- `result.json`

## Useful Flags

- `--provider-id` / `--provider-model`: override the provider used to run the candidate prompt
- `--judge-provider-id` / `--judge-provider-model`: override the provider used for the ACP judge
- `--judge-weight`: blend weight for the LLM judge score; default `0.4`
- `--codex-model`: optionally force a Codex model for proposer runs
- `--baseline-only`: skip GEPA mutation and only score the seed candidate

## Safety

- The TypeScript evaluator refuses to run against the live `data/` directory unless you pass `--allow-live-data`.
- The Python GEPA runner always copies `data/` to a temporary directory per case before evaluation.
- The Codex CLI proposer runs in an ephemeral, read-only sandbox and returns only rewritten prompt text.

## Extending It

If this works well, the next step is to optimize more than the persona body:

- shared prompt instructions from `src/lib/agents/conversation-runner.ts`
- the `cabinet` epilogue instructions
- other personas besides `content-manager`
