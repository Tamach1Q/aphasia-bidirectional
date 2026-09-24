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
4. Receptive pipeline: gate → simplify → settle (FR-008 – FR-011).
5. Safety layer (FR-026 – FR-030) — before the expressive pipeline, so hypotheses are never
   displayed unchecked even during development.
6. Expressive pipeline + hint store (FR-012 – FR-018), with the non-intervention invariants
   (FR-019 – FR-022) built in from the start.
7. Views and confirmation (FR-023, FR-034, FR-035).
8. Support requests, fallback, accessibility (FR-031 – FR-033, FR-036, FR-037).
9. Research instrumentation (FR-039 – FR-042).

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

10 open questions are listed in `spec.md` §10, each annotated with the requirement it blocks. The
ones most likely to be hit early:

- **OQ-1 chunk boundary rule** — blocks FR-010, hit as soon as the receptive pipeline is built
- **OQ-2 gate thresholds** — blocks FR-008, same point
- **OQ-6 model and prompt per operation** — blocks FR-014
- **OQ-9 icon and image assets** — blocks FR-036, and affects the no-build-step constraint
- **OQ-10 safety calibration** — blocks FR-027

Two block the user test rather than the build, and must not surface late:

- **OQ-3** participant consent covering the expanded off-device scope (§A5.4)
- **OQ-7** latency ceiling and behaviour when exceeded (NFR-005)

Unlike 001, these are deliberately open at handoff — several cannot be answered well without real
utterance data or a running pipeline. Propose a value with reasoning and get it confirmed; do not
silently pick one and proceed.

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
