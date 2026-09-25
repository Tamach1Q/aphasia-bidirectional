# 002-context-aware-dyadic-support

**Created**: 2026-09-24
**Supersedes**: `001-aphasia-conversation-aid` (see `agent/tasks/001-aphasia-conversation-aid/SUPERSEDED.md`)

## Goal

Build the Phase 1 prototype defined in `docs/product.md` §29.1: a researcher-assisted, mobile-first
web application that helps a person with aphasia and their conversation partner understand each
other.

Two directions, deliberately asymmetric:

- **Partner → person**: transcribe, and *when the utterance is hard to process*, present a
  simplified structured form.
- **Person → partner**: take the person's fragment, combine it with conversation context, and offer
  the **partner** hypotheses to ask the person about.

The product does not complete the person's sentences, does not interrupt, and does not converse on
anyone's behalf.

## Read before starting, in this order

1. `docs/product.md` — product behaviour, scope, rationale (authoritative)
2. `docs/architecture.md` — technical architecture (authoritative)
3. `specs/002-context-aware-dyadic-support/spec.md` — testable requirements FR-001–FR-043
4. `.specify/memory/constitution.md` — governing principles, **version 1.2.0 or later required**

Cross-reference convention: `§n` = product.md, `§An` = architecture.md.

> **Implementation-location note (2026-09-25):** line-number references to `app.js` below are
> historical migration references. Since T114, `app/app.js` is bootstrap-only and current runtime
> orchestration lives in `app/runtime.js`.

> **Do not read `specs/001-aphasia-conversation-aid/` or
> `agent/tasks/001-aphasia-conversation-aid/task.md` as a source of requirements.** They describe a
> product model this project no longer builds. They are retained as history only.

## What changed from 001, and why it matters to implementation

The centre of the product moved from *completing the person's sentence* to *helping two people
understand each other*. Consequences that will bite if missed:

| Removed | Replaced by |
|---|---|
| fixed `time → topic → content` ordering | contextual hypothesis generation (§13, FR-014) |
| mandatory two-round clarification | one generation attempt, 0–3 hypotheses (FR-015) |
| "None of these" regenerates exactly once | candidate misses are a normal path (§15, FR-033) |
| every fragment becomes a final sentence | shared meaning is the goal (§16, FR-023) |
| Mode A / Mode B | A0 baseline + B/C conditions (§24, FR-039, FR-040) |
| text-only meaning choices | icon/image **required** alongside text (FR-036) |
| `[わかりません]` | four distinguishable support requests (FR-031) |
| 180° rotated partner output, TTS | Phase 2 — not built now |

## Build order

Follow `docs/product.md` §29.1. Suggested sequencing, since some items gate others:

1. **Context store first** (FR-002, FR-003, FR-004) — everything downstream reads it, and FR-003's
   single-writer invariant is far cheaper to build in than to retrofit.
2. **Injected transcript path** (FR-043) — build this *early, not last*. It is how anything gets
   tested at all (see Known QA constraint below).
3. Session start/stop, partner transcription (FR-001, FR-007) — largely reusable, see below.
4. **Safety layer skeleton** (FR-026 – FR-030) — **before any pipeline that displays model output.**
5. Receptive pipeline: gate → simplify → **safety** → settle (FR-008 – FR-011).
6. Expressive pipeline: fragment → hypotheses → **safety** → hint store (FR-012 – FR-018), with the
   non-intervention invariants (FR-019 – FR-022) built in from the start.
7. Views and confirmation (FR-023, FR-034, FR-035).
8. Support requests, fallback, accessibility (FR-031 – FR-033, FR-036, FR-037).
9. Research instrumentation (FR-039 – FR-042).

> **Why safety comes before the receptive pipeline.** The safety layer applies to *every* path that
> produces language, simplification included (§A6). Building the receptive pipeline first would
> create an intermediate state in which model output reaches the screen unchecked. That state tends
> to persist — it works, so it ships — and it is exactly the state FR-026 exists to prevent. Stand up
> the skeleton first, even if individual checks are stubs, so no display path is ever wired without
> passing through it.

## Reuse from the existing implementation

Catalogued in `docs/architecture.md` §A9. The genuinely valuable pieces:

- **generation counters** (`app.js:66,93,110,123,142`) — the mechanism that stops a stale async
  response from overwriting a newer screen. Carry this into `hintStore.generation`.
- session start/stop and state display (`app.js:15,104,118`)
- the two ASR modes, `ja-JP` (`app.js:104-117,139-152`)
- pause/resume partner listening (`app.js:17,18`)
- Worker skeleton — CORS, origin allowlist, 503/429 backoff, JSON error shape
  (`worker/index.js:10-36,49-91`). Only the prompt and schema change.
- DOM helpers and layout (`app.js:20-23,173-180`, `styles.css`)

Deletions are listed in `docs/architecture.md` §A10. Delete rather than flag off.

## Known QA constraint — carried forward from 001

**The automated QA environment cannot reliably exercise browser `SpeechRecognition`.** 001 returned
`environment_issue` twice for this reason and never got speech input verified. Treat this as a
standing condition of the environment, not bad luck.

Verification is split:

- **speech recognition itself** → manual, on a real device, by a human
- **everything downstream of recognition** → automated, via the injected transcript path (FR-043)

**FR-043 is therefore a first-class requirement, not test scaffolding.** Design a path that feeds
text into the pipelines exactly as recognition would, so that context handling, the gate, chunk
settling, hypothesis generation, evidence verification, safety suppression, the non-intervention
invariants, both views, and confirmation are all deterministically assertable without audio.

"Could not test — no speech recognition in this browser" is an acceptable QA outcome **only** for
FR-007 and the speech half of FR-012. For every other requirement it indicates FR-043 is inadequate
and should be reported as such.

## Non-negotiable behaviours

These are constitution-level or safety-level. If any of them appears to conflict with something
else, stop and escalate to Product rather than resolving it in code.

- **No autonomous send or speak.** Nothing is presented as the person's statement without their
  explicit confirmation (FR-025, Constitution VII).
- **A hypothesis is always marked as unconfirmed AI inference** and never rendered as the person's
  words (FR-018, Constitution VII). This is the condition under which partner-facing hypotheses are
  permitted at all.
- **No automatic surfacing of hypotheses, and no availability indicator of any kind** (FR-019).
  A quiet badge is still an intervention.
- **`personView` must not read the hint store**, and writing a hypothesis must have no render side
  effect (FR-022). Enforce structurally.
- **Silence never triggers anything** (FR-021).
- **Safety suppresses, never repairs** (FR-028), and is never delegated to the model that produced
  the candidate (FR-029).
- **Session context accepts only person-confirmed meaning** (FR-003).
- **No real participant personal context in the repository, in `app/`, or in a URL** (FR-005).
- **`?ai=off` does not start speech recognition** (FR-039).

## Open questions — flag to Product, do not decide unilaterally

`spec.md` §10 now contains eleven question records because OQ-11 was added during implementation.
The current open set is **OQ-1, OQ-2, OQ-3, OQ-4, OQ-5, OQ-7, OQ-8, and OQ-10**.
OQ-6 (model selection), OQ-9 (icon/assets), and OQ-11 (interpret-mode Safety grounding) are
resolved and documented in `research.md`.

The remaining questions are deliberately not closed by automated green tests:

- **OQ-1** chunk boundary rule — retained provisionally; real recognition rehearsal needed
- **OQ-2** gate thresholds — retained provisionally; real partner speech needed
- **OQ-3** participant consent covering the expanded off-device scope — blocks the user test
- **OQ-4 / OQ-5** partner-view handover and uncertainty presentation — require device observation
- **OQ-7** latency ceiling and over-ceiling behaviour — blocks the user test; requires end-to-end device measurement
- **OQ-8** personal-context schema depth — revisit after a researcher authors one on-device
- **OQ-10** safety calibration — fixture results are not enough; re-measure on rehearsal output

Do not infer closure from implemented code or passing tests. Record a decision in `research.md`
before removing an item from the open set.

## Definition of done for this task

- All Priority 1 items in `docs/product.md` §29.1 implemented
- FR-001 – FR-043 satisfied, or an unmet requirement explicitly escalated with reasoning
- The full pipeline is exercisable end-to-end without audio (FR-043)
- The `?ai=off` baseline runs and genuinely makes no project network call and starts no recognition
- Old-model code from `docs/architecture.md` §A10 is deleted, not disabled
- `docs/architecture.md` updated if an architectural decision is made that the document does not
  already record (Constitution VI)

## Out of scope

`spec.md` §8. In particular, not now: persisted memory of any kind, Expression Memory, automatic
intervention, final-sentence rendering, TTS, rotated partner output, stranger-partner UX,
localization.
