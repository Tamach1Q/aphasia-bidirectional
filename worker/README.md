# AI proxy (demo-scoped)

A minimal Cloudflare Worker that holds the Gemini API key server-side, so the static app never
embeds a model secret. The current app calls it from `app/runtime.js` through one URL and an
operation-discriminated JSON contract.

This is demo-scoped infrastructure, not a production backend. The app depends on the contract in
`specs/002-context-aware-dyadic-support/contracts/worker-api.md`, not on Cloudflare or Gemini.

## Current app contract

`POST <worker-url>` with JSON from an allowed Origin.

### `op: "simplify"`

Request:

```json
{ "op": "simplify", "text": "…", "level": "standard" }
```

Response:

```json
{
  "op": "simplify",
  "meaning": "…",
  "structure": ["…"],
  "options": ["…"]
}
```

`structure` and `options` may be empty. `options` is capped at three items.

### `op: "hypotheses"`

Request contains a fragment with its turn id and, according to the research condition, may also
contain short-term turns, confirmed meanings, and personal context.

Response:

```json
{
  "op": "hypotheses",
  "result": "ok",
  "hypotheses": [
    {
      "text": "…",
      "evidence": [
        { "source": "turn", "id": "t1", "excerpt": "…" }
      ]
    }
  ]
}
```

`result: "unknown"` with an empty `hypotheses` array is a valid normal result.

## Legacy compatibility path

A body without `op` still reaches the older `{ "text": "…" } -> { "choices": [...] }` handler.
That path is retained for backward compatibility only. The current app no longer sends it; its
active calls are `op=simplify` and `op=hypotheses`.

Do not describe the legacy path as the current app contract, and do not remove it merely as
documentation cleanup while compatibility is still intentionally retained in `worker/index.js`.

## Deploy

Requires a Cloudflare account and a configured `GEMINI_API_KEY` Worker secret.

```sh
cd worker
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

The Worker name is `aphasia-ai-proxy` (`wrangler.toml`). The app's endpoint is configured as
`WORKER_URL` in `app/runtime.js`.

Deployment/version status is operational state rather than architecture; record a verified manual
deploy in `agent/tasks/002-context-aware-dyadic-support/state.json`.

## Local dev

`npx wrangler dev` runs it locally; pass `--var GEMINI_API_KEY:<key>` or use `.dev.vars`
(gitignored) instead of `wrangler secret put` while iterating.

## Origin allowlist

`ALLOWED_ORIGINS` in `index.js` restricts browser cross-origin access. Local development accepts
only an `http:` origin whose parsed hostname is exactly `localhost` (any port); hostname-prefix
matching is intentionally not used.

**CORS is not authentication.** A non-browser HTTP client can supply its own `Origin` header, so
the allowlist does not protect model quota from a determined caller who knows the Worker URL. That
is acceptable only for this researcher-assisted Phase 1/demo-scoped backend. A longer-lived public
deployment needs server-side abuse controls such as rate limiting and/or authentication; those are
not added to this prototype merely as a CORS cleanup.
