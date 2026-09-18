# Architecture

## 2026-09-17 — validation prototype stack

- **Delivery**: framework-free static web app in `app/`, so a researcher can serve it with any static HTTP server and no account or build step is required.
- **Speech input**: browser `SpeechRecognition` / `webkitSpeechRecognition` with `ja-JP`, continuous mode for the partner session and a separate one-utterance capture for the expressive microphone. Typed fragments are always available as the fallback.
- **Receptive simplification and expressive clarification**: deterministic in-browser demo adapter for Friday's validation. It exposes the intended state machine and fixed `time → topic → content` ordering without requiring API keys or sending conversation data off-device. The adapter boundary is in `app/app.js` so a researcher can later replace it with an ASR/LLM endpoint.
- **Speech output**: browser `speechSynthesis` only after explicit confirmation.
- **Latency**: `performance.now()` measures speech recognition and each clarification/candidate generation call; values are written to the status line and `console.info` with `asr`/`llm` labels.
- **Research comparison**: `?mode=a` enables direct three-candidate mode; the default is progressive clarification (Mode B).

This is intentionally not a production backend: no persistence, accounts, background audio, diarization, offline guarantee, or external analytics are included.

## 2026-09-18 — optional LLM assist for open-ended partner questions

The deterministic adapter above cannot generate contextually plausible answer candidates for an
arbitrary open-ended ("5W1H") partner question (e.g. "どんな仕事をされていたんですか" →
[営業/エンジニア/経営者]) — that needs real language understanding, not keyword matching. Added a
narrow, optional LLM call for exactly that one step:

- **Scope**: only the receptive open-question branch of `simplifyPartner()` in `app/app.js` calls
  out to an LLM (Gemini `generateContent`, `gemini-2.0-flash`, JSON-schema-constrained output of
  2–3 short candidate answers). Every other classification (schedule, yes/no, topic fallback) and
  all of the expressive clarification flow stay fully local/deterministic, unchanged.
- **Key handling**: the app is a static, no-build, no-backend site served from GitHub Pages, so
  there is nowhere to hold a secret server-side — a `.env`/build-time-embedded key would ship
  inside the public JS bundle and leak immediately (the repo is public). Instead the researcher
  enters their own Gemini API key at runtime via the "AI" button in the topbar. It's kept in that
  tab's `sessionStorage` (not `localStorage`, never written to the repo or any server) so it
  survives a reload — mobile browsers routinely discard/reload a backgrounded tab, and a bare JS
  variable didn't survive that — but is cleared when the tab is actually closed. Without a key, the
  receptive flow behaves exactly as before (neutral "answer freely" message, no forced yes/no, no
  network call).
- **Privacy consequence**: when a key is set, the partner's utterance for an open-ended question is
  sent to Google's Gemini API to generate answer candidates — this is a deliberate, narrow exception
  to "no conversation data leaves the device," gated behind an explicit researcher action (entering
  a key), not something a participant can trigger unknowingly.
- **Failure handling**: any network/API/parse failure falls back to the same local neutral message
  used when no key is configured — never blocks the flow or fabricates an answer.
