# tools/ — development utilities, never deployed

Standalone Node scripts used during development. **Nothing here is part of the published site** —
deployment serves `app/` alone.

## Rules

- **Never import from `app/`.** These are evaluation and inspection tools, not application code.
  A tool that needs application logic is a sign the logic belongs in `app/` and should be tested
  there instead.
- **Read secrets from the environment only.** The model API key comes from `GEMINI_API_KEY` and
  from nowhere else. It is never written into a fixture, a prompt file, `research.md`, an evaluation
  result, `wrangler.toml`, or any other file in this repository, and never printed to a log.
  This key is separate from the deployed Worker secret.
- **No dependencies.** Node's standard library only, consistent with the project's no-build-step,
  no-lockfile constraint.

## Contents

| Script | Purpose |
|---|---|
| `list-models.mjs` | Enumerate stable Flash-tier candidate models for Stage 0 (T017) |
| `model-eval.mjs` | Score candidate models for `simplify` and `hypotheses` against `app/fixtures/` (T018–T022) |

## Usage

```bash
export GEMINI_API_KEY=…            # never committed, never echoed
env -u NODE_OPTIONS node tools/list-models.mjs
env -u NODE_OPTIONS node tools/model-eval.mjs --op simplify
env -u NODE_OPTIONS node tools/model-eval.mjs --op hypotheses
```

Results are written to `specs/002-context-aware-dyadic-support/research.md` §2 by hand, so the
decision and its evidence live in the repository rather than in a terminal scrollback
(Constitution VI).
