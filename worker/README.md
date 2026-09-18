# AI proxy (demo-scoped)

A minimal Cloudflare Worker that holds the Gemini API key server-side, so `app/app.js` (a
static, no-backend site on GitHub Pages) never has to embed a secret to get AI-assisted answer
candidates for open-ended partner questions.

**This is throwaway demo infrastructure, not a production backend.** Whoever inherits this
project should feel free to replace it with their own backend/model choice — `app/app.js` only
depends on the contract below, nothing Cloudflare- or Gemini-specific.

## Contract

`POST <worker-url>` with `{ "text": "<partner's utterance>" }` (from an allowed Origin) returns
either `{ "choices": ["...", "...", "..."] }` (2–3 short Japanese answer candidates) or
`{ "error": "<message>" }`.

## Deploy

Requires a free Cloudflare account (no credit card needed for the free tier).

```sh
cd worker
npx wrangler login              # opens a browser to authorize the CLI
npx wrangler secret put GEMINI_API_KEY   # paste your Gemini API key when prompted
npx wrangler deploy
```

`wrangler deploy` prints the live URL, something like
`https://aphasia-ai-proxy.<your-subdomain>.workers.dev`. Put that URL into
`AI_PROXY_URL` near the top of `app/app.js`.

## Local dev

`npx wrangler dev` runs it locally; pass `--var GEMINI_API_KEY:<key>` or use `.dev.vars`
(gitignored) instead of `wrangler secret put` while iterating.

## Origin allowlist

`ALLOWED_ORIGINS` in `index.js` restricts which sites can call this Worker via CORS. Update it if
the app's Pages URL changes (custom domain, fork, etc).
