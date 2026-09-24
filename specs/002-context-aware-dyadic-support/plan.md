# Implementation Plan: Context-Aware Dyadic Support (Phase 1)

**Branch**: `main` | **Feature**: `002-context-aware-dyadic-support` | **Date**: 2026-09-24
**Spec**: [spec.md](./spec.md)

> There is no `002-context-aware-dyadic-support` git branch. This feature is being committed to
> `main` directly, in reviewed increments. "002-context-aware-dyadic-support" is the feature
> identifier and directory name only.

**Input**: `specs/002-context-aware-dyadic-support/spec.md`, `docs/product.md`, `docs/architecture.md`

## Summary

Build the Phase 1 prototype: a static, framework-free web app in which a person with aphasia and a
conversation partner reach shared meaning. Partner speech is transcribed and — only when hard to
process — simplified. The person's fragments are turned into hypotheses the **partner** can use to
ask a better question, held without being surfaced until a human asks for them.

The existing implementation is the superseded model (`fragment → clarification → final sentence`).
This plan **replaces its core while keeping the app runnable and testable at every stage**, rather
than rewriting it in one pass.

The decisive technical move is that two product guarantees become structural rather than
disciplinary:

- writing a hypothesis has **no render side effect** (`hintStore` is pure data)
- the person's view **cannot import** the hypothesis store

## Technical Context

**Language/Version**: ES2022 JavaScript, native ES modules (`<script type="module">`). No transpiler.

**Primary Dependencies**: none in the app. Browser `SpeechRecognition` / `webkitSpeechRecognition`.
Cloudflare Worker proxy (existing, `worker/`) fronting a Gemini-family model.

**Storage**: none. No persistence of any kind in Phase 1 (FR-004, NFR-003). Session state is
in-memory and dies with the page.

**Testing**: `node --test` (built into Node, zero dependencies) for pure modules — safety checks,
evidence verification, gate, chunker, context store. A static browser test page driven by the
injected transcript path (FR-043) for pipelines, views, and confirmation. Speech recognition itself
is verified manually on a device.

**Target Platform**: mobile browsers, portrait, iOS Safari and Android Chrome. Served as static
files from GitHub Pages or any static HTTP server.

**Project Type**: static web application + a thin serverless proxy.

**Performance Goals**: receptive simplification sits on the conversational critical path. A concrete
ceiling is **NEEDS CLARIFICATION — OQ-7**, to be set from Stage 0 measurements before the user test.

**Constraints**: no build step; no accounts; no model key in client code; no persistence; one-handed
left-hand operation; Japanese (ja-JP) only.

**Scale/Scope**: one researcher-assisted session at a time, two people, one device. Roughly 9 modules
replacing a single 270-line file.

## Constitution Check

*GATE: checked before Phase 0 and re-checked after Phase 1 design.*

Constitution version required: **≥ 1.2.0**. Current: 1.2.0. ✅

| Principle | Gate | Status |
|---|---|---|
| I Accessibility-First | No stage may increase load on the person for a partner-side benefit | ✅ Stage 6 removes mandatory fragment review; Stage 7 shows one hypothesis, never a list |
| II Bidirectional by Design | Both directions built | ✅ Stage 5 receptive, Stage 6 expressive |
| III Real-World Conversation Fitness | Latency measured, gate keeps ungated speech off the network | ✅ Stage 0 measures; Stage 5 gates locally first. **Ceiling still open (OQ-7)** |
| IV Privacy and Dignity | No PII in repo/URL; no retention; expanded off-device scope disclosed | ⚠️ Structural controls in Stage 1; **OQ-3 consent text open**, blocks the test not the build |
| V Evidence Before Scope Expansion | Phase 2 items excluded | ✅ No memory, no auto-intervention, no TTS |
| VI Spec-and-Repo-Are-Truth | Decisions recorded in repo | ✅ This plan + research.md; Stage 0 writes its result back |
| VII User Decides, AI Proposes | Hypotheses marked as unconfirmed inference; confirmation gates attribution | ✅ Stage 6 labels, Stage 7 confirms. Depends on the 1.2.0 amendment |
| VIII Bounded Inference | One generation attempt, 0–3 candidates, then honest unknown | ✅ Stage 6 |

**No unjustified violations.** Two open questions (OQ-3, OQ-7) are gates on the *user test*, not on
implementation, and are tracked as such.

## Project Structure

### Documentation (this feature)

```text
specs/002-context-aware-dyadic-support/
├── spec.md                      # requirements (already written)
├── plan.md                      # this file
├── research.md                  # Phase 0 — OQ resolutions, model-selection method
├── data-model.md                # Phase 1 — entities and invariants
├── quickstart.md                # Phase 1 — how to run and validate
├── contracts/
│   ├── worker-api.md            # simplify / hypotheses operations
│   └── injected-transcript.md   # FR-043 test-injection interface
├── checklists/requirements.md   # spec quality (already written)
└── tasks.md                     # Phase 2 — /speckit-tasks, NOT created here
```

### Source code (repository root)

```text
app/
├── index.html
├── styles.css
├── manifest.webmanifest
├── app.js                    # entry point: wiring only, no logic
├── core/
│   ├── session.js            # turns ring buffer, confirmed (single writer), config
│   ├── personal-context.js   # load, read-only, in-memory
│   └── hint-store.js         # MEANING_HINT_READY — pure data, no render
├── capture/
│   ├── asr.js                # both recognition modes, generation counters
│   └── inject.js             # FR-043 injected transcript path
├── pipelines/
│   ├── gate.js               # local simplification gate
│   ├── chunker.js            # semantic chunk boundaries
│   ├── receptive.js          # gate → simplify → safety → settle
│   └── expressive.js         # fragment → hypotheses → safety → hintStore
├── safety/
│   ├── index.js              # check(candidate, source, context)
│   └── checks/               # polarity, person, time, number, action, medication, consent
├── evidence/
│   └── verify.js             # FR-017 pointer verification
├── views/
│   ├── person.js             # MUST NOT import hint-store
│   ├── partner.js            # sole reader of hint-store
│   └── dom.js                # shared helpers, carried over
├── icons/                    # OQ-9: local SVG, no CDN
├── context/sample-01.json    # synthetic fixtures ONLY
└── fixtures/                 # synthetic conversation fixtures (Stage 0 + regression)

worker/
├── index.js                  # op dispatch: simplify | hypotheses
├── prompts/                  # one prompt per op
└── README.md

tests/
├── unit/                     # node --test, pure modules
└── browser/                  # static page driven by capture/inject.js
```

**Structure Decision**: native ES modules under `app/`, one directory per architectural component
from `docs/architecture.md` §A1. This preserves the no-build-step constraint while making the two
key invariants (FR-022) checkable by a grep over import statements, rather than by reviewer
attention.

---

## Stage 0 — Model selection (resolves OQ-6)

**Not a coding stage.** A short, bounded evaluation that produces a recorded decision before Stage 5
needs a model. Method, fixtures, and criteria are in [research.md](./research.md) §2.

**Do not assume one model serves both operations.** `simplify` and `hypotheses` are evaluated
separately and may resolve differently.

| | |
|---|---|
| **Files** | `app/fixtures/*.json` (new), `specs/.../research.md` (decision recorded), `worker/prompts/*` (draft prompts) |
| **Delete** | nothing |
| **Reuse** | Worker skeleton — CORS, origin allowlist, 503/429 backoff (`worker/index.js:10-36,49-91`) |
| **Automated acceptance** | Each candidate model is scored on every fixture for both ops; results table written to research.md; a decision (or an explicit "baseline retained") recorded for each op |
| **Manual/device** | none |
| **Open questions** | resolves **OQ-6**; produces measurements that inform **OQ-7** and **OQ-10** |

Baseline is the currently pinned `gemini-3.6-flash`. If evaluation is inconclusive, the baseline is
retained and that outcome is recorded as the decision — an unjustified switch is worse than no
switch.

Fixtures created here are **the same fixtures used for regression later** (FR-043), so they are
authored against the injected transcript contract, not as throwaway scripts.

---

## Stage 1 — Context store

| | |
|---|---|
| **Files** | `app/core/session.js`, `app/core/personal-context.js` (new); `app/app.js` (wire) |
| **Delete** | **nothing yet.** The flat `state` object at `app.js:4` is still read in ~100 places by the superseded expressive flow, which is not removed until Stage 6. Run the new store *alongside* it; delete it in Stage 6 |
| **Reuse** | nothing directly; the existing state object is the wrong shape |
| **Automated acceptance** | turns ring buffer bounds at `MAX_TURNS`; interim text never enters `turns` (FR-002); `confirmed` is writable through exactly one exported function (`confirmSelected()`) and rejects writes from any other path (FR-003); that function takes no UI-supplied text, so `session.js` never reads the hint store (data-model.md §8); personal context has no setter and no storage API call anywhere in the module (FR-004); `?config=` loads only from `app/context/` (FR-005) |
| **Manual/device** | none |
| **Open questions** | **OQ-8** (personal context schema depth) — build the minimal schema in data-model.md and revisit |

Build first: FR-003's single-writer invariant is cheap now and expensive to retrofit.

---

## Stage 2 — Injected transcript path (FR-043)

| | |
|---|---|
| **Files** | `app/capture/inject.js` (new); `tests/browser/index.html` (new); `app/fixtures/` (from Stage 0) |
| **Delete** | nothing |
| **Reuse** | nothing |
| **Automated acceptance** | a fixture conversation can be played into the pipelines turn by turn with no microphone; every downstream stage's tests run from this path; injected turns are indistinguishable from ASR turns once inside `session` |
| **Manual/device** | none |
| **Open questions** | none |

**Build early, not last.** This is the only way anything after Stage 3 gets tested at all — see the
known QA constraint in spec.md §6. Treat it as a product requirement, not scaffolding.

---

## Stage 3 — Session and ASR

| | |
|---|---|
| **Files** | `app/capture/asr.js` (new, extracted); `app/app.js`, `app/index.html` (wire) |
| **Delete** | nothing yet — extraction only |
| **Reuse** | **heavily**: session start/stop and state display (`app.js:15,104,118`); both recognition modes, `ja-JP`, continuous vs one-shot (`app.js:104-117,139-152`); pause/resume (`app.js:17,18`); **generation counters** (`app.js:66,93,110,123,142`) — the stale-response guard, carried into `hintStore.generation`; error wording (`app.js:16`) |
| **Automated acceptance** | start/stop transitions; `?ai=off` does not construct a recognition object at all (FR-039); generation counter discards a stale result |
| **Manual/device** | **required** — recognition actually runs on iOS Safari and Android Chrome; continuous mode survives pauses; permission denial degrades to the typed path |
| **Open questions** | none |

---

## Stage 4 — Safety layer skeleton

| | |
|---|---|
| **Files** | `app/safety/index.js`, `app/safety/checks/*.js` (new) |
| **Delete** | nothing |
| **Reuse** | nothing — no equivalent exists today |
| **Automated acceptance** | `check()` returns `{ok, violations[]}` and is a pure function; added negation is a violation (`薬 飲まない` → `薬を飲む`); dropped negation is a violation; invented number, swapped subject, changed time, inverted action, invented medication each violate; a failing candidate is suppressed and never rewritten (FR-028); no check performs a network call (FR-029) |
| **Manual/device** | none |
| **Open questions** | **OQ-10** (false-positive rate). Ship deliberately over-suppressing; suppression degrades to fallback, a missed inversion reaches a person |

**Before Stage 5, not after.** Safety applies to every path that produces language, simplification
included. Building a display path first creates an interval where model output reaches the screen
unchecked — and that interval persists, because it works. Stand the skeleton up with stubbed checks
if necessary, so no display path is ever wired around it.

---

## Stage 5 — Receptive pipeline

| | |
|---|---|
| **Files** | `app/pipelines/gate.js`, `chunker.js`, `receptive.js` (new); `worker/index.js`, `worker/prompts/simplify.*` (op added); `app/views/person.js` (settled region) |
| **Delete** | `app.js:56-65` `simplifyPartner()` regex classifier; `app.js:67-83` `renderPartnerMeaning`/`showPartnerResult`; `app.js:113` interim→main-area coupling; the open-question answer-candidate branch in its current form (folded into `op=simplify` output) |
| **Reuse** | transcript strip rendering (`app.js:24`); `showChoices` (`app.js:21`); latency logging (`app.js:14`) |
| **Automated acceptance** | a short utterance (`明日病院行く？`) produces **no** network call and does not replace the main area (FR-008); a long/conditional utterance does; `[短く]` forces simplification of an ungated turn (FR-009); settled content is never silently replaced, and a revision is marked (FR-010); the gate runs before any fetch — assert fetch call count is zero for gated-out fixtures |
| **Manual/device** | readability of settled chunks at target text size; that revision marking is noticeable but not distracting |
| **Open questions** | **OQ-1** (chunk boundary rule) and **OQ-2** (gate thresholds) — both hit here. Propose values from fixtures, get confirmation, record in research.md |

---

## Stage 6 — Expressive pipeline and hint store

| | |
|---|---|
| **Files** | `app/core/hint-store.js`, `app/pipelines/expressive.js`, `app/evidence/verify.js` (new); `worker/index.js`, `worker/prompts/hypotheses.*` |
| **Delete** | the flat `state` object (`app.js:4`), now that its last readers go; `app.js:5-9` `ambiguities`; `183-186` `nextClarification`/`showClarification`/`noneOfThese`/`choicesFor`; `198-228` `contentChoicesFor`/`contentClause`/`buildMessage`/`timeWord`/`topicWord`/`personMention`; `229-239` `directCandidates`/`showDirectCandidates`; `app.js:3` `modeA`; `163-170` mandatory `renderFragmentForm` on capture |
| **Reuse** | generation counters → `hintStore.generation`; fragment capture (`app.js:139-160`) minus the forced review; Worker retry/backoff |
| **Automated acceptance** | hypotheses are 0–3 and an empty set is a normal result, not an error (FR-015); schema permits `minItems: 0`; after generation **nothing renders** — assert zero DOM mutation and no indicator element exists (FR-019); `grep` shows `getHintSnapshot` imported only by `views/partner.js`, and `views/person.js` importing nothing from `hint-store` (FR-022, data-model.md §5.1); an evidence pointer to a non-existent turn is dropped while the hypothesis survives (FR-017); an excerpt not present in the cited turn is dropped; a capture does **not** require review before proceeding (FR-013); silence produces no call (FR-021) |
| **Manual/device** | that nothing visibly changes during a real conversation while hypotheses are being produced |
| **Open questions** | **OQ-6** must be closed (Stage 0) before the prompt is finalized |

---

## Stage 7 — Views and confirmation

| | |
|---|---|
| **Files** | `app/views/person.js`, `app/views/partner.js`, `app/views/dom.js` |
| **Delete** | `app.js:240` `showConfirm` (sentence-approval form); `app.js:244-246` `showOutput`/`speakConfirmed` and the rotation CSS (`styles.css:49-50`) — Phase 2 |
| **Reuse** | `setMain`, `showChoices`, `addAction`, `escapeHtml`, `renderFlowView` (`app.js:20-23,173-180`); shell layout and `.choice` sizing |
| **Automated acceptance** | partner view is reachable **only** via explicit invocation (FR-020); person view renders exactly one hypothesis with はい/ちがう and never a list (FR-023); person view never displays evidence, confidence or reasoning (FR-034); `confirmationRequest` carries only `{hypothesisId, text}` while `selectedConfirmation` (internal to `partner.js`) carries `basis` as well; はい is the only path that writes `session.confirmed` (FR-024, data-model.md §8) |
| **Manual/device** | **required** — glanceability of the partner view; whether looking at the screen breaks eye contact (this is a §25.2 research observation, surfaced early) |
| **Open questions** | **OQ-4** (full swap vs peek, device handover), **OQ-5** (whether uncertainty is shown at all) |

---

## Stage 8 — Support requests, fallback, accessibility

| | |
|---|---|
| **Files** | `app/views/person.js`, `app/icons/*.svg` (new), `app/styles.css` |
| **Delete** | `app.js:70,84-90` `showDontUnderstand` and the 「わかりません」 control; `app.js:177,185` 「どれも違います」 in its old role; `app.js:241` `showFallback` wording and its person-only actions |
| **Reuse** | existing operational icons (`app.js:12`) as the starting SVG set |
| **Automated acceptance** | four support requests exist and are independently dispatchable — もう一回 / ゆっくり / 短く / ちがう (FR-031); no string in the UI states that the person's speech was not understood (FR-032); fallback offers at least one partner-side action (FR-033); every support control has an icon **and** text; no meaning option carries an image unless flagged unambiguous (FR-036) |
| **Manual/device** | **required** — one-handed left-thumb reach for every primary action on a real device, and that no primary action sits in right-thumb-only territory (FR-037) |
| **Open questions** | **OQ-9 — resolved by this plan**, see research.md §3 |

---

## Stage 9 — Research conditions and instrumentation

| | |
|---|---|
| **Files** | `app/app.js` (config parsing), `app/core/session.js` (config), logging helpers |
| **Delete** | `app.js:3` `modeA` (if not already removed in Stage 6) |
| **Reuse** | `logLatency` (`app.js:14`) |
| **Automated acceptance** | `?ai=off` makes zero calls to the Worker, renders no transcript, renders no AI output, **and never constructs a recognition object** (FR-039); `?receptive=off` shows transcript without simplification; `?ctx=none\|session\|personal` passes exactly the corresponding context and no more — assert the request body; latency logged per op (FR-041); safety suppressions and evidence-verification failures logged (FR-042) |
| **Manual/device** | a full A0 session runs end to end and the pair can converse with the device present but silent |
| **Open questions** | **OQ-3** (consent text) and **OQ-7** (latency ceiling) must be closed before any participant session |

---

## Testability invariant

Every stage from 2 onward must be exercisable through `app/capture/inject.js` with no microphone.
A stage is not complete if its acceptance conditions can only be checked by speaking at a device.

The only exceptions are the explicitly manual rows above, which concern recognition itself, physical
reach, and readability.

## Migration approach

The app stays runnable throughout. The superseded flow is removed **stage by stage as its
replacement lands**, not up front:

- Stages 1–4 add modules without removing behaviour; the old flow keeps working
- Stage 5 replaces the receptive half; the old expressive flow still runs
- Stage 6 removes the clarification machinery, the largest single deletion
- Stages 7–8 replace the views
- Stage 9 removes `modeA`

At no point is `main` left with a model-output path that does not pass through safety (Stage 4
precedes Stage 5 for exactly this reason).

## Complexity Tracking

No constitution violations requiring justification.

Two structural constraints are stricter than ordinary design preference and are recorded here so
they are not "simplified" away later:

| Constraint | Why | Simpler alternative rejected because |
|---|---|---|
| `getHintSnapshot` importable only by `views/partner.js`; `views/person.js` imports nothing from the store | Makes FR-019 structural. Writers stay available to the pipeline, so the rule is satisfiable | A convention plus review; the failure mode is silent and only visible to a participant |
| Safety is a separate module, never the generating model | Makes FR-029 structural | Asking the model to self-check inherits the error class it is meant to catch |
