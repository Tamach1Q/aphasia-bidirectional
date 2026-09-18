# Architecture

## 2026-09-17 — validation prototype stack

- **Delivery**: framework-free static web app in `app/`, so a researcher can serve it with any static HTTP server and no account or build step is required.
- **Speech input**: browser `SpeechRecognition` / `webkitSpeechRecognition` with `ja-JP`, continuous mode for the partner session and a separate one-utterance capture for the expressive microphone. Typed fragments are always available as the fallback.
- **Receptive simplification and expressive clarification**: deterministic in-browser demo adapter for Friday's validation. It exposes the intended state machine and fixed `time → topic → content` ordering without requiring API keys or sending conversation data off-device. The adapter boundary is in `app/app.js` so a researcher can later replace it with an ASR/LLM endpoint.
- **Speech output**: browser `speechSynthesis` only after explicit confirmation.
- **Latency**: `performance.now()` measures speech recognition and each clarification/candidate generation call; values are written to the status line and `console.info` with `asr`/`llm` labels.
- **Research comparison**: `?mode=a` enables direct three-candidate mode; the default is progressive clarification (Mode B).

This is intentionally not a production backend: no persistence, accounts, background audio, diarization, offline guarantee, or external analytics are included.

## 2026-09-18 — LLM assist for open-ended partner questions

The deterministic adapter above cannot generate contextually plausible answer candidates for an
arbitrary open-ended ("5W1H") partner question (e.g. "どんな仕事をされていたんですか" →
[営業/エンジニア/経営者]) — that needs real language understanding, not keyword matching. Added a
narrow LLM call for exactly that one step:

- **Scope**: only the receptive open-question branch of `simplifyPartner()` in `app/app.js` calls
  out to an LLM (Gemini `generateContent`, JSON-schema-constrained output of 2–3 short candidate
  answers). Every other classification (schedule, yes/no, topic fallback) and all of the expressive
  clarification flow stay fully local/deterministic, unchanged.
- **Key handling — proxied, always on**: `app/app.js` is static and served from GitHub Pages, so it
  has nowhere to hold a secret client-side; embedding the Gemini key directly (or asking a
  researcher to paste one in each session) either leaks it publicly or requires manual setup every
  time. Instead `app/app.js` calls a small Cloudflare Worker (`worker/`, see `worker/README.md`)
  which holds the real Gemini key as a Worker secret and proxies the request. The Worker is
  **explicitly demo-scoped, disposable infrastructure** — meant to be swapped for a real backend
  during a future handoff, not built on top of — and `app/app.js` only depends on its small
  `{ text } -> { choices } | { error }` HTTP contract, nothing Cloudflare- or Gemini-specific, so
  swapping it out later touches one constant (`AI_PROXY_URL`) and nothing else in the frontend.
  CORS on the Worker is restricted to this app's origin.
- **Privacy consequence**: the partner's utterance for an open-ended question is sent to the proxy
  (and from there to Google's Gemini API) to generate answer candidates — a deliberate, narrow
  exception to "no conversation data leaves the device," scoped to only this one question type.
- **Failure handling**: any network/proxy/API/parse failure shows the actual error inline (not a
  silent no-op) and falls back to letting the user answer via mic/typing — never blocks the flow or
  fabricates an answer.
