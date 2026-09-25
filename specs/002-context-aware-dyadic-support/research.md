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
| OQ-6 | Model and prompt per op | §2b — **RESOLVED**: `simplify` → `gemini-3.5-flash-lite` (provisional), `hypotheses` → baseline retained |
| OQ-7 | Latency ceiling | §7 — model-call latency measured; **ceiling still open**, needs end-to-end on the test device |
| OQ-8 | Personal context schema depth | §8 — minimal schema decided, revisit after a rehearsal |
| OQ-9 | Icon and image assets | §3 — **resolved** |
| OQ-10 | Safety calibration | §9 — **measured**: 43.6% → 0.0% false positives after three design fixes; small sample, re-measure on Stage 5 output |

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

### Candidate set as enumerated — 2026-09-24 (T017)

`tools/list-models.mjs` against this project's key: 61 models visible, 44 supporting
`generateContent`, **9 stable Flash-tier** after filtering.

```text
gemini-3.8-flash           gemini-3.5-flash        gemini-2.5-flash
gemini-3.7-flash           gemini-3.5-flash-lite   gemini-2.5-flash-lite
gemini-3.6-flash  (baseline)
gemini-3.1-flash-lite      gemini-omni-1.1-flash
```

Excluded, with reasons the script prints rather than hides:

| Excluded | Why |
|---|---|
| 8 ids: `*-preview`, `gemini-flash-latest`, `gemini-flash-lite-latest` | preview, or a **moving alias**. A prototype used in participant sessions must not sit on an id whose meaning can change under it. This repo was already broken once by a retirement (`8571c30`) |
| 5 ids: `*-tts`, `*-image` | wrong modality. Both operations are text-in / JSON-out |

#### Selection, per operation

Three each, chosen as **baseline + newest stable + one contrasting tier**. The contrast differs
because the two operations fail differently.

| | `simplify` | `hypotheses` |
|---|---|---|
| | `gemini-3.6-flash` *(baseline)* | `gemini-3.6-flash` *(baseline)* |
| | `gemini-3.8-flash` *(newest stable)* | `gemini-3.8-flash` *(newest stable)* |
| | `gemini-3.5-flash-lite` *(fastest tier)* | `gemini-3.7-flash` *(second newest)* |

`simplify` sits on the conversational critical path and its failure mode is dropping meaning, so the
third slot tests whether a **lite** tier is fast enough to be worth its risk.

`hypotheses` is held off the critical path and its failure modes are fabricating a reading and
fabricating evidence, so latency buys less and the third slot goes to another full-size model
instead. A lite tier is the least likely to hold f06 restraint and evidence discipline, and
spending a slot confirming that would answer a question nobody asked.

"Newest" is a heuristic for **which to measure**, not a prediction of which wins. The decision rule
below is what decides, and retaining the baseline is a valid outcome.

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

#### Substring matching screens; it does not judge

`mustNotProduce` is a **screen, not a verdict**. 「薬を服用してください」 evades the `f04` list and
「10時の通院予定」 evades `f08`'s, while meaning exactly what those fixtures forbid.

So scoring splits:

- **automated** — schema adherence, `result` correctness, restraint on `f06`, evidence-pointer
  validity, latency. All decidable from structure.
- **rubric, read against raw output** — meaning preservation, polarity reversal, anchoring. The
  harness persists every raw response so these are judged on meaning rather than on wording.

At three candidates × eight fixtures this is a tractable read, and it is the only way the two
fixtures carrying the most weight are scored for what they were built to catch.

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

---

## 2a. Results — 2026-09-24 (T021, T022)

`tools/model-eval.mjs`, free-tier key. Raw responses under `tools/runs/` (gitignored).

### `simplify` — f02, f03, f04

| Model | schema | p50 | max | gave up | rubric |
|---|---|---|---|---|---|
| `gemini-3.6-flash` *(baseline)* | 6/6 | **5244 ms** | 5848 ms | 3 | clean |
| `gemini-3.8-flash` | 1/1 | 4360 ms | 5103 ms | **13** | n/a |
| `gemini-3.5-flash-lite` | 9/9 | **1150 ms** | 1379 ms | **0** | clean |

Rubric pass over raw output:

- **f04 polarity — no reversal in any of 6 observed runs.** Every output kept 「薬を飲まないで
  ください」 as a prohibition, and both models split it out as a separate line.
- **f02 condition — preserved in all 6 runs.** See the screen note below.
- **f03** — both appointment slots and the floor survived every run; no collapse to one slot.

### `hypotheses` — f05, f06, f07, f08

| Model | schema | restraint | evidence valid | p50 | gave up |
|---|---|---|---|---|---|
| `gemini-3.6-flash` *(baseline)* | 4/4 | **4/4** | **6/6** | ~4000 ms | 8 |
| `gemini-3.8-flash` | 0 | — | — | — | **all** |
| `gemini-3.7-flash` | 6/6 | **6/6** | **14/14** | ~11000 ms | 4 |

Rubric pass over raw output:

- **f06 restraint — both models returned `result: "unknown"` with zero candidates.** Neither
  invented a reading for 「…あれ…」. This is the behaviour the fixture exists to demand.
- **f08 anchoring — neither model took the bait.** The baseline answered 「10時ごろ」 citing the
  bedtime question; 3.7-flash gave two bedtime readings (10時, and 11時/12時 — a sensible reading of
  a possibly-truncated 「じゅう」). No hospital reading appeared despite a prominent 10時 hospital
  appointment in the personal context.
- **f07 context use** — 3.7-flash resolved 「さくら」 to さくら台病院 and cited **both** the turn and
  the `personalContext` path. The baseline was never measured here (quota) — see gaps.
- **Evidence validity was 100% (20/20).** Every pointer resolved and every excerpt was really
  present in the cited source. This is the id-bearing request shape working; under the previous
  contract none of these could have verified.

### Quota is a selection criterion, not noise

`gemini-3.8-flash` returned `429 "You exceeded your current quota"` on essentially every call and
produced **one** usable response across both operations. That is not a transient capacity blip the
harness can retry through — it is exhausted quota on this key.

A model this project cannot call reliably is not a candidate for a prototype used in participant
sessions, whatever it would have scored. Excluded on availability.

### The screen produced a false negative — as predicted

On `f02`, the automated `condition` probe marked the condition **absent** from
「ふらつくときは飲むのをやめる」 because the probe lacked 〜ときは. The condition was in fact
preserved.

This is exactly why `mustNotProduce` and the preserve probes are documented as a **screen, not a
verdict**. A red cell means "read this one", and a green cell is equally not a pass. The probe has
been widened, but the rubric pass remains the thing that decides.

---

## 2b. Decision (T023)

### `simplify` → **`gemini-3.5-flash-lite`** *(switch from baseline)*

**4.5× faster at the median** (1150 ms vs 5244 ms), zero quota failures across 9 calls, and the
rubric pass found no meaning loss on any of the three receptive fixtures — including the polarity
one.

`simplify` sits on the conversational critical path, where Constitution III makes latency a
first-class constraint rather than a nicety. The baseline was never evaluated for this task; it was
inherited from a feature that no longer exists.

> **Provisional.** 9 calls on 3 fixtures is thin evidence. Re-confirm in Stage 5 with the gate
> calibration runs, which will exercise it far more. If meaning loss appears there, revert to
> `gemini-3.6-flash` and accept the latency.

### `hypotheses` → **`gemini-3.6-flash` retained** *(no switch)*

Decision rule step 5: **no candidate clearly beat the baseline, so the baseline is retained and the
reason recorded.**

`gemini-3.7-flash` is not better on any axis that decides this operation — both models pass f06
restraint, both resist f08 anchoring, both produce 100% valid evidence — and it is roughly **2.7×
slower**. `gemini-3.8-flash` is unmeasurable on this key.

Switching on "it is newer" would be precisely the unjustified choice this step exists to prevent.

### Gaps in this evidence, stated rather than smoothed over

- **The baseline was never measured on `f07`** (personal-context use). Both attempts hit quota. So
  the retention rests on f05, f06 and f08. Re-check when Stage 6 wires the real op.
- `gemini-3.8-flash` is untested rather than rejected on quality.
- Run counts are small — 9 calls for the winning `simplify` model, 4 for the retained
  `hypotheses` one. Enough to choose between candidates, not enough to characterise either.

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

#### Stage 5 check (T069, 2026-09-25) — value RETAINED, question still OPEN

Confirmed against the fixtures and the rendered surface
(`tests/unit/chunker.test.js`, `tests/browser/receptive.test.js`):

| | |
|---|---|
| Rule in force | one ASR `isFinal` = one chunk |
| `f02`, `f03` | each fixture's partner utterance arrives as one final and settles as one chunk; no mid-thought split observed |
| Growing re-emission | a second final that extends the first is marked `revises`, and the view keeps the earlier chunk on screen with a visible label rather than swapping it |

What the mitigation actually is: the weakness above was addressed in the **view**, not the rule. A
chunk that settles mid-thought is no longer a dead end, because its continuation arrives as a marked
revision and both remain visible (`app/views/person.js`). That removes the cost the rule risked
imposing without introducing the latency trade-off that accumulating finals would.

**OQ-1 is NOT closed.** Everything above was produced by injected fixtures, where one fixture turn
is one final by construction — the test path cannot generate the fragmented-finals behaviour that
made the rule doubtful in the first place. Only real recognition on a device can, so the question
stays open pending T110. If fragmentation turns out to be common, the revision marking is what makes
it survivable, not a reason to leave the rule unexamined.

---

## 5. Gate thresholds (OQ-2) — provisional

**Provisional decision**: gate on the presence of any signal, not on a tuned score.

| Signal | Rule as implemented (`app/pipelines/gate.js`) |
|---|---|
| Length | over 40 Japanese characters |
| Instructions | two or more imperatives or requests |
| Condition | もし / 〜たら / 〜れば / 〜なら / 〜場合 / ただし / でなければ / ときは **and the contrastive 〜ですが / 〜ますが / けれど / 一方で** |
| Embedded question | a question mark with more than 12 characters of other material |
| Entities | **two or more of the SAME KIND** — two times, two numbers, or two places |

#### Two departures from the first draft, both forced by the fixtures

**Entities are counted per kind, not in total.** Counting any two entities gated in
「明日、病院行く？」 — a day and a place — which is an ordinary question nobody needs help
with. What is actually hard is holding **alternatives**: two candidate appointments, two
amounts, where the person has to keep both and choose. One time plus one place is a single
fact. The signal now takes the largest same-kind group.

**Contrastive markers are treated as conditions.** See the resolved note below.

Deliberately biased toward **not** simplifying: an unnecessary simplification replaces the main area
and competes for attention, while a missed one is recoverable with `[短く]` (FR-009).

**Status: the gate agrees with all four fixture annotations** (`tests/unit/gate.test.js`), and was
verified end to end against the live model — `f01` gates out in 1 ms with zero requests, `f02` and
`f04` reach the model and return in ~1.2–1.7 s.

**OQ-2 is not closed by that.** Four synthetic fixtures are what the thresholds were tuned
*against*, so agreement with them is close to circular. What OQ-2 actually asks for is calibration
against **recorded partner utterances**, which the project does not yet have. T069 remains open.

#### Stage 5 check (T069, 2026-09-25) — values RETAINED, question still OPEN

The five signals and their thresholds are unchanged. What Stage 5 added is the check the table above
could not make: that the gate's decision is what the person actually experiences.

| Assertion | Where |
|---|---|
| a gated-out utterance produces **zero** requests — asserted as a call count | `tests/unit/receptive.test.js`, `tests/browser/receptive.test.js` |
| a gated-out utterance leaves the main area untouched and the person keeps the raw strip | `tests/browser/receptive.test.js` |
| `[短く]` reaches the model for that same utterance | both suites |

The recovery path FR-009 promises is therefore real: a miss costs one tap, which is the asymmetry the
thresholds were biased for.

**OQ-2 stays open, and for the same reason as before** — the fixtures are still the material the
thresholds were tuned against. One correction to how the question should be settled: the missing
input is not a larger fixture set, since more synthetic material authored by the same hand reproduces
the same circularity. It is recorded partner utterances from a rehearsal (T110, T111). The false-miss
rate against real speech is the number OQ-2 wants, and it cannot be produced from this repository
as it stands.

#### RESOLVED 2026-09-25: contrastive and exception markers are gate signals

`f04` ("お風呂は入っていただいて大丈夫ですが、今日は薬を飲まないでください") is annotated
`gate: "pass"`, but the provisional signals above may not fire on it: it is not especially long, has
no もし-conditional, and carries only one number-free instruction pair. What makes it hard is the
**contrast** — a permission and a prohibition joined by 〜ですが.

The fixture was not weakened to match the gate. Contrastive and exception markers
(〜ですが / 〜ますが / けれど / ただし / 一方で) were **added to the signal set** instead, and `f04`
now gates in on exactly that signal.

The stake is concrete: an utterance whose two halves point opposite ways is exactly the kind a
person may take as a single instruction, and it is the case where dropping half inverts a
medication decision.

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

### Measured — 2026-09-24 (T025)

Model call only. Excludes speech recognition, the local gate, and rendering, all of which sit on top
of these figures in a real turn.

| Operation | Model | p50 | max |
|---|---|---|---|
| `simplify` | `gemini-3.5-flash-lite` *(chosen)* | **1150 ms** | 1379 ms |
| `simplify` | `gemini-3.6-flash` *(baseline)* | 5244 ms | 5848 ms |
| `hypotheses` | `gemini-3.6-flash` *(retained)* | ~4000 ms | 5147 ms |
| `hypotheses` | `gemini-3.7-flash` | ~11000 ms | 16153 ms |

What this settles and what it does not:

- **A sub-2-second `simplify` is achievable**, but only with the lite tier. The baseline could not
  have met any ceiling worth setting for the critical path — around 5 s, the partner has already
  moved on.
- `hypotheses` at ~4 s is tolerable **because it is held, not shown** (§20.2). Nobody is waiting on
  it; it is ready before anyone asks. Had it been on the critical path, 4 s would be a problem.
- 3.7-flash at 11 s p50 would be unusable even off the critical path — a hint invoked right after a
  fragment would arrive after the moment passed.

**The ceiling is still not set.** These are single-call figures on an unloaded free-tier key, taken
from a laptop rather than a phone on mobile data. The number that matters is end-to-end on the test
device, which Stage 5 measures. OQ-7 stays open, but it is now bounded by evidence rather than by
guesswork.

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

### Measured — 2026-09-24 (T056)

`tools/safety-calibrate.mjs` runs the layer over the real Stage 0 model output. Those responses
were read by hand and judged correct, so anything suppressed here is a **false positive** — a
correct candidate the product would have thrown away.

| | False-positive rate |
|---|---|
| First implementation | **43.6%** (34 of 78) |
| After the corrections below | **0.0%** (0 of 27) |

The first number was not a tuning problem. It exposed three design errors that only running the
checks against real output could surface.

#### 1. The checks were mode-blind — the largest error

`number` and `time` were applied to **hypotheses**, where they are simply wrong. A hypothesis
exists to propose a reading the source does not state literally: resolving 「じゅう」 to 10時, or
「さくら」 to さくら台病院, is the product working. The layer was suppressing **every f08 answer** —
the fixture built to prove the model resists anchoring.

`check()` now takes a mode:

| Mode | Used by | Claim being made | Restatement checks |
|---|---|---|---|
| `restate` | `simplify` | says the same thing more simply | `number`, `time` apply |
| `interpret` | `hypotheses` | a possible reading of a fragment | they do not |

`polarity`, `action`, `medication` and `consent` apply in **both**. Inverting an instruction or
asserting agreement is never legitimate, whatever the output claims to be. An unspecified mode
defaults to `restate` — the stricter one, which is the safe direction to be wrong in.

#### 2. Structured output was judged line by line

「お風呂：入って大丈夫です」 was suppressed for dropping a negation that was sitting in the very
next line. The person sees the whole block, so the layer judges the whole block.

#### 3. Counting negations instead of detecting them

A structured simplification restates the same prohibition twice — once in the summary, once in the
breakdown — which counting read as `1 → 2`. Presence-based detection has **the same detection
power**: a negation that *moves* to a different clause (「薬を飲まないで、電話して」 →
「薬を飲んで、電話しないで」) keeps the count at 1 and slips past either rule.

> **Known gap, recorded rather than papered over.** Negation *relocation* is not caught. Detecting
> it needs clause alignment, which a rule-based check in Phase 1 does not attempt.

Two smaller fixes fell out of the same run: list markers (「1. 朝ごはん…」) were being read as
quantities, and clock rewordings (`10時半` → `10:30`) as invented numbers.

#### What the figure does and does not mean

0% on 27 candidates from 8 fixtures is **not** evidence the layer is correctly calibrated. It is
evidence it no longer suppresses the specific correct outputs observed so far. The set is small,
drawn from one evaluation run, and contains no adversarial cases.

What it does establish is that the layer is no longer useless — at 43.6%, nearly half of all
correct output would have degraded to fallback, and the product would have looked rigorous while
failing to work. Re-measure whenever the checks change, and again on Stage 5 output.

### Stage 5 finding — 2026-09-25 (T064): `consent` could not tell a question from an assertion

Building the rendered receptive surface surfaced a fourth error of the same family as the three
above, and it was found the same way — by running the layer over output the product would really
display.

**What happened.** A partner offering two appointment times
(「金曜の午後か月曜の午前、どちらがご都合よろしいですか。」) simplifies correctly to
「いつがいいですか」 plus the two times as tappable options. The layer suppressed it. The `consent`
check tests for agreement phrases by substring, and `いいです` is inside 「いいですか」.

**Why it mattered more than its size suggests.** This is not an exotic case; a question offering a
choice is the single most ordinary thing the receptive direction exists to simplify (§11.5), and
`options` is the field that carries it (§A3.3). The failure was also invisible in the only place
anyone would have looked: suppression degrades to the raw transcript, so the product would have
appeared to be working — just never simplifying questions.

**Fix.** An occurrence followed by か is not counted. A question asks; this check exists to catch
assertion, which is what its own header says. Applied to the source as well as the candidate, which
is deliberately the **stricter** reading: a partner asking 「大丈夫ですか」 gives no grounds for a
candidate that answers 「大丈夫です」 for the person. Four cases added to
`tests/unit/safety-checks.test.js`, including the inverse (an assertion followed by an unrelated
question must still be caught).

**What this says about the 0.0% figure.** It was measured over Stage 0 `simplify` and `hypotheses`
output, none of which happened to be interrogative. The rate is a property of the sample, not of the
layer, and one new output shape was enough to produce a fresh false-positive class. OQ-10 stays open,
and the re-measurement it needs is over output from a rehearsal rather than a larger fixture run.

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
