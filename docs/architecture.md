# Architecture

## 2026-09-17 — validation prototype stack

- **Delivery**: framework-free static web app in `app/`, so a researcher can serve it with any static HTTP server and no account or build step is required.
- **Speech input**: browser `SpeechRecognition` / `webkitSpeechRecognition` with `ja-JP`, continuous mode for the partner session and a separate one-utterance capture for the expressive microphone. Typed fragments are always available as the fallback.
- **Receptive simplification and expressive clarification**: deterministic in-browser demo adapter for Friday's validation. It exposes the intended state machine and fixed `time → topic → content` ordering without requiring API keys or sending conversation data off-device. The adapter boundary is in `app/app.js` so a researcher can later replace it with an ASR/LLM endpoint.
- **Speech output**: browser `speechSynthesis` only after explicit confirmation.
- **Latency**: `performance.now()` measures speech recognition and each clarification/candidate generation call; values are written to the status line and `console.info` with `asr`/`llm` labels.
- **Research comparison**: `?mode=a` enables direct three-candidate mode; the default is progressive clarification (Mode B).

This is intentionally not a production backend: no persistence, accounts, background audio, diarization, offline guarantee, or external analytics are included.
