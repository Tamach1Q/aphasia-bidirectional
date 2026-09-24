# Quickstart — validation guide

**Feature**: 002-context-aware-dyadic-support

How to run the prototype and prove it behaves as specified. This is a validation guide, not an
implementation guide — implementation detail belongs in `tasks.md`.

## Prerequisites

- Node (for `node --test` only; the app itself has no Node dependency)
- Any static HTTP server
- A mobile device for the manual checks
- For live model calls: the Worker deployed with its key, or `?ai=off` to avoid the model entirely

## Run

```bash
# from repo root — development only
python3 -m http.server 8000
# app:   http://localhost:8000/app/
# tests: http://localhost:8000/tests/browser/
```

Development serves the **repository root** so that `app/` and `tests/` are both reachable.
**Deployment serves `app/` alone** — `tests/` is never part of the published site. Do not merge the
test page into `app/` to make one server suffice; keeping test surfaces out of the deployed artifact
matters more than the convenience.

To check the deployed shape locally:

```bash
python3 -m http.server 8000 --directory app   # app only, as published; /tests/ is absent
```

No build step, no install, no lockfile. If any appears, the delivery constraint has been broken.

### Useful URLs (development server, repo root)

```text
/app/                               normal session, C2 default
/app/?ai=off                        A0 baseline — nothing at all
/app/?receptive=off                 B0 — transcript, no simplification
/app/?ctx=none                      C0 — hypotheses from the fragment alone
/app/?ctx=session                   C1 — plus turns and confirmed
/app/?config=sample-01              load a SYNTHETIC personal-context fixture
/app/?inject=1                      enable the injected transcript path
/tests/browser/                     the test page
```

Under the deployed server the same paths drop the `/app` prefix (`/`, `/?ai=off`, …), and
`/tests/browser/` does not exist.

## Automated checks

```bash
node --test tests/unit/*.test.js   # pure modules: safety, evidence, gate, chunker, session
# NOTE: pass the glob, not the directory. `node --test tests/unit/` fails here, and the
# bare `node --test` form would also pick up tests/browser/*.test.js, which need a document.
# then, with the repo-root dev server running:
#   http://localhost:8000/tests/browser/   — pipeline, view, and confirmation checks
```

Everything below "must hold" is assertable without a microphone, through
[`contracts/injected-transcript.md`](./contracts/injected-transcript.md).

### The checks that matter most

These are the ones whose failure is silent in ordinary use — they will not be noticed by clicking
around, only by a participant.

| # | Must hold | Requirement |
|---|---|---|
| 1 | After hypotheses are generated, **nothing renders**: zero DOM mutation, no badge, no banner, no indicator element exists | FR-019 |
| 2 | `getHintSnapshot` is imported only by `views/partner.js`, and `views/person.js` imports nothing from `hint-store` — a grep over import statements. (The pipeline imports the *writers*; that is intended — see data-model.md §5.1) | FR-022 |
| 3 | `f01-simple-question` produces **zero network calls** | FR-008 |
| 4 | `f06-fragment-unanswerable` yields **zero hypotheses**, handled as normal, not as an error | FR-015 |
| 5 | An evidence pointer to a non-existent turn is dropped; **the hypothesis survives** | FR-017 |
| 6 | `薬 飲まない` → any output asserting `薬を飲む` is **suppressed, not rewritten** | FR-027, FR-028 |
| 7 | All candidates suppressed → `unknown` → fallback, never a blank screen | FR-028 |
| 8 | The person's view shows **one** hypothesis with はい/ちがう, never a list | FR-023 |
| 9 | `?ai=off` constructs **no** `SpeechRecognition` object | FR-039 |
| 10 | `?ctx=none` request body contains `fragment` **and nothing else** | FR-040 |
| 11 | Settled content is never silently replaced; a revision is marked as a change | FR-010 |
| 12 | Only `[はい]` writes to `session.confirmed`, and it commits the partner-side snapshot rather than UI-supplied text | FR-003, FR-024 |

Check 1 is the one most likely to regress later, because every regression of it looks like a
helpful improvement.

## End-to-end scenario — injected, no audio

```text
/?inject=1&config=sample-01

1. Start the session.
2. inject.turn({speaker:'partner', text:'明日の病院、何時？'})
     → short and simple: gate skips, main area unchanged, no network call
3. inject.turn({speaker:'person', text:'…10…'})
     → hypotheses generated
     → NOTHING appears on screen                       ← check 1
4. Invoke [ことばのヒント]
     → partner view shows 1–3 hypotheses
     → each marked as AI inference, with quoted excerpts from the conversation
5. Pick one to check
     → the person's screen shows THAT ONE with [はい] [ちがう]   ← check 8
6. [はい]
     → appended to session.confirmed                   ← check 12
     → conversation continues
```

Step 3 is the whole product thesis in one assertion: the system understood something and did not
interrupt.

## Manual checks — a real device is required

These cannot be automated and must not be skipped on the grounds that the automated suite is green.

| Check | Why it cannot be automated |
|---|---|
| Recognition runs on iOS Safari and Android Chrome, `ja-JP` | The QA environment has no working `SpeechRecognition` (spec.md §6) |
| Continuous mode survives natural pauses without restarting | Timing behaviour of the real API |
| Permission denial degrades to the typed path, without blame wording | Browser permission UI |
| **Every primary action is reachable with the left thumb**, and none sits in right-thumb-only territory | Physical reach (FR-037) |
| Settled text is readable at target size; revision marking is noticeable but not distracting | Perception |
| The partner view is glanceable — using it does not pull attention away from the person | This is a §25.2 research observation, surfaced early because it may invalidate the design |

## Before any participant session

Two open questions gate the **test**, not the build. They must be closed first, and must not be
discovered late:

- **OQ-3** — consent text covering the expanded off-device scope. Contextual inference sends the
  person's fragment, recent turns, confirmed meaning, and personal context to the model, which is
  substantially more than the superseded version sent (§A5.4).
- **OQ-7** — the latency ceiling and what happens when it is exceeded, set from Stage 0
  measurements.

Also confirm before a session:

- the `?ai=off` baseline runs end to end — without it, SC-001, SC-002, and SC-003 are unanswerable
- `app/context/` and `app/fixtures/` contain **no** real participant data (FR-005)
- real personal context is loaded on-device and is gone after reload
