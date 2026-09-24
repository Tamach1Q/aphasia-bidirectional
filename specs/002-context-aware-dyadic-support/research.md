# Phase 0 — Research

**Feature**: 002-context-aware-dyadic-support
**Date**: 2026-09-24

Resolves the `NEEDS CLARIFICATION` items in [plan.md](./plan.md) Technical Context, and closes the
open questions that block implementation rather than the user test.

## 1. Status of the ten open questions

| OQ | Topic | Status after Phase 0 |
|---|---|---|
| OQ-1 | Chunk boundary rule | §4 — **provisional decision**, confirm from fixtures in Stage 5 |
| OQ-2 | Gate thresholds | §5 — **provisional decision**, calibrate in Stage 5 |
| OQ-3 | Consent text for expanded off-device scope | **open** — blocks the user test, not the build |
| OQ-4 | Partner view presentation and handover | **open** — Stage 7 |
| OQ-5 | Uncertainty display | §6 — **provisional decision: do not display** |
| OQ-6 | Model and prompt per op | §2 — **method decided, value produced by Stage 0** |
| OQ-7 | Latency ceiling | §7 — **measured in Stage 0, set before the test** |
| OQ-8 | Personal context schema depth | §8 — minimal schema decided, revisit after a rehearsal |
| OQ-9 | Icon and image assets | §3 — **resolved** |
| OQ-10 | Safety calibration | §9 — direction decided, rate measured in Stage 4 |

---

## 2. Model selection (OQ-6)

### Decision

**Not a pinned model — a decided procedure with a defined default.**

`simplify` and `hypotheses` are **evaluated separately** and may resolve to different models. The
currently pinned `gemini-3.6-flash` is the **baseline**, not the presumed answer. If the evaluation
does not produce a clear improvement for an operation, the baseline is retained **and that outcome
is recorded as the decision**, because an unjustified switch is worse than no switch.

### Why not decide now

Choosing a model without measuring it on this task would be exactly the "無根拠な選択" this plan is
meant to avoid. The two operations also have different shapes:

| | `simplify` | `hypotheses` |
|---|---|---|
| Position | conversational critical path | off the critical path (held, not surfaced) |
| Input | one utterance | fragment + turns + confirmed + personal context |
| Output | short structured text | 0–3 candidates with input pointers |
| Dominant risk | dropping meaning; latency | fabricating a reading; fabricating evidence |

A model that is best for one is not automatically best for the other, and latency matters far more
for the first. **No assumption that one model serves both.**

### Candidate set

Determined at execution time, not guessed here:

1. Query the API's model-listing endpoint for **stable** Flash-tier models available to this key.
2. Include the baseline `gemini-3.6-flash`.
3. Include a smaller/faster tier if one is offered, since `simplify` is latency-dominated.
4. Exclude preview, experimental, and deprecated models — the project has already been broken once
   by a model retirement (`8571c30`, `gemini-2.0-flash`), and a prototype used in participant
   sessions must not sit on an unstable identifier.

Cap the evaluation at **three candidates per operation**. This is a selection step, not a study.

### Fixtures

A small fixed set of synthetic Japanese conversation fixtures, authored against the **injected
transcript contract** (FR-043) so they serve as regression fixtures afterwards rather than being
thrown away.

Location: `app/fixtures/`. Synthetic only — the same prohibition as `app/context/` applies
(FR-005). No real participant utterances.

| Fixture | Purpose |
|---|---|
| `f01-simple-question` | must be **gated out** — proves no model is called |
| `f02-conditional-instruction` | condition + two actions (the newspaper / medication shape) |
| `f03-multi-entity` | several times, numbers, and a place in one utterance |
| `f04-negation` | contains a negated instruction — polarity must survive |
| `f05-fragment-answerable` | fragment answerable from the preceding turn |
| `f06-fragment-unanswerable` | fragment with genuinely insufficient signal — **correct answer is zero hypotheses** |
| `f07-fragment-with-personal-context` | resolvable only with personal context |
| `f08-anchoring-trap` | personal context that is **plausible but wrong** for this fragment |

`f06` and `f08` are the two that matter most and are the easiest to omit. `f06` catches a model that
always guesses; `f08` catches a model that lets personal context override the conversation.

### Scoring — `simplify`

| Axis | Measurement |
|---|---|
| Latency | wall-clock per call, median and worst of N runs per fixture |
| Meaning preservation | condition, negation, number, person, action each present/absent vs. the fixture's annotated expected set |
| Over-reduction | any annotated decision-relevant element dropped = failure, regardless of brevity |
| Structured-output stability | schema-valid response rate across repeated runs |

Meaning preservation is scored against an **annotation written into the fixture in advance**, not
judged after seeing output.

### Scoring — `hypotheses`

| Axis | Measurement |
|---|---|
| Context use | does the hypothesis reflect the preceding turn and confirmed context (f05, f07) |
| Restraint | on `f06`, **does it return zero** — guessing here is a failure, not a near-miss |
| Schema adherence | 0–3 items respected across repeated runs; `result: "unknown"` used correctly |
| Evidence validity | every pointer resolves and every excerpt actually appears in the cited source (FR-017); rate of unverifiable pointers |
| Anchoring resistance | on `f08`, does personal context wrongly dominate the conversation |
| Latency | wall-clock, recorded but weighted lower than for `simplify` |

### Decision rule

Per operation, in priority order:

1. Reject any candidate whose evidence-validity rate is poor — fabricated citations defeat the
   purpose of the evidence mechanism (§A5.3).
2. Reject any candidate that guesses on `f06` more often than the baseline.
3. Among survivors, prefer meaning preservation (`simplify`) or anchoring resistance
   (`hypotheses`).
4. Break ties on latency, weighted heavily for `simplify`.
5. If no candidate clearly beats the baseline, **retain the baseline and record why**.

### Output

A results table and a one-line decision per operation appended to this file, plus a `wrangler`
configuration that allows the two operations to name **different** models.

### Alternatives considered

- *Pin `gemini-3.6-flash` for both now.* Rejected: it is an inherited default that was never
  evaluated for either task, and `hypotheses` did not exist when it was chosen.
- *Full benchmark.* Rejected: disproportionate. Eight fixtures and three candidates answer the
  question that blocks Stage 5.
- *Let the coding agent pick during implementation.* Rejected: that is the unjustified choice this
  step exists to prevent.

---

## 3. Icon and image assets (OQ-9) — RESOLVED

**Decision for Phase 1:**

- Support-control icons are **local, simple SVG files committed in `app/icons/`**.
- **No external CDN and no runtime external asset dependency** is added. This preserves the
  no-build-step, static-hosting, and offline-of-third-parties properties, and avoids a third party
  observing participant sessions by request logs.
- Meaning options carry an image or icon **only when the visual representation is unambiguous and
  useful** (FR-036).
- A vague or misleading visual is **never** attached merely to avoid text-only presentation.
- **No large meaning-image library is built in Phase 1.**

Rationale: clinical hearing evidence is that text candidates may be unreadable for part of this
population while picture comprehension is typically preserved — but the same design research found
image support is not universally helpful and can be a burden (§22.3). The asymmetry is deliberate:
mandatory where the referent is fixed and operational (a microphone, a keyboard), optional where the
referent is a meaning and a bad pictogram would mislead.

Starting set: the operational icons already in `app.js:12` (mic, keyboard, volume, reset), extracted
to files and extended with the four support requests.

---

## 4. Chunk boundary rule (OQ-1) — provisional

**Provisional decision**: treat one ASR `isFinal` result as one chunk.

Rationale: it is what the recognition API already yields, it requires no heuristic, and it is the
cheapest thing that satisfies "never rewrite settled content" (FR-010).

**Known weakness**: a single `isFinal` sometimes covers only part of a sentence, so a chunk can
settle mid-thought. Confirm or replace in Stage 5 using `f02` and `f03`. If replacement is needed,
the next option is accumulating finals until a sentence-ending cue or a pause threshold — which
introduces a latency/completeness trade-off that must then be measured, not assumed.

---

## 5. Gate thresholds (OQ-2) — provisional

**Provisional decision**: gate on the presence of any signal, not on a tuned score.

| Signal | Provisional rule |
|---|---|
| Length | over ~40 Japanese characters |
| Instructions | more than one imperative or request |
| Condition | contains もし / 〜たら / 〜ば / 〜場合 / ただし / でなければ |
| Embedded question | a question inside other material |
| Entities | two or more distinct times, numbers, or places |

Deliberately biased toward **not** simplifying: an unnecessary simplification replaces the main area
and competes for attention, while a missed one is recoverable with `[短く]` (FR-009).

Calibrate in Stage 5 against the fixtures. `f01` must gate out; `f02` and `f03` must gate in.

---

## 6. Uncertainty display (OQ-5) — provisional

**Provisional decision**: do **not** display a confidence band, and do not ask the model for one.

Rationale: LLM self-reported confidence is weak evidence, and a number next to a hypothesis is
precisely the kind of unearned authority that anchors a partner (§26 q6). Verified evidence pointers
already give the partner something better and checkable to judge by (§A5.3).

Revisit only if Stage 7 observation shows partners cannot tell strong from weak hypotheses.

---

## 7. Latency (OQ-7) — measured in Stage 0

No ceiling is invented here. Stage 0 measures actual per-op latency for the candidate models; the
ceiling and the over-ceiling behaviour are set from those numbers **before** any participant session.

Constraint that already holds regardless of the number: the gate (§5) keeps ungated utterances off
the network entirely, so the latency budget applies only to utterances that genuinely need help.

Over-ceiling behaviour options to decide with the number: show the raw transcript and abandon the
simplification for that turn, or show a settled partial. The first is preferred a priori because it
never leaves incomplete meaning on screen.

---

## 8. Personal context schema (OQ-8)

**Decision**: build the minimal schema in [data-model.md](./data-model.md) — `people`, `places`,
`schedule`, `interests`, `topics`. Revisit after a researcher attempts to author one on-device
before a rehearsal session; what can realistically be entered in a few minutes determines the real
shape, and that cannot be learned from a document.

Constraint that does not depend on the schema: real participant context is loaded on-device into
memory only, never committed, never served from `app/`, never in a URL (FR-005).

---

## 9. Safety calibration (OQ-10)

**Direction decided**: bias toward over-suppression.

A suppressed candidate degrades to the fallback path, which the product treats as ordinary
(§15). A missed polarity inversion reaches a person and may concern medication or consent. The two
errors are not symmetric, so the threshold should not be.

The actual false-positive rate is measured in Stage 4 against the fixtures and recorded. If it is
high enough to make the product useless, that is a finding worth having before a participant sees
it.

Rule-based Japanese polarity and subject detection will be imperfect; Phase 1 accepts this
explicitly (§A6.3) rather than deferring safety until it can be done well.

---

## 10. Testing approach

**Decision**: `node --test` for pure modules, plus a static browser page driven by the injected
transcript path.

Rationale: `node --test` is built into Node with zero dependencies, so it adds no package manager,
no lockfile, and no build step to a project whose delivery constraint is "static files, no build".
The genuinely testable logic — safety checks, evidence verification, the gate, the chunker, the
context store invariants — is all pure and DOM-free.

Views, pipelines, and confirmation need a document, so they are driven from a static test page
through `app/capture/inject.js`, which is a product requirement (FR-043) rather than test-only code.

**Alternatives considered**: a headless browser runner (adds a dependency and a install step for
marginal gain at this scale); testing only in the browser (pure logic would lose fast feedback, and
the safety checks are the part most worth testing exhaustively).
