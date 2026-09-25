# Architecture

## A0. Status

This document describes the technical architecture for the Phase 1 prototype defined in
`docs/product.md`.

`docs/product.md` is the single product specification. Where this document and product.md disagree,
product.md wins and this document is wrong.

This revision replaces the previous architecture, which implemented the older
`fragment → progressive clarification → final sentence` model. Backward compatibility with that
model is **not** preserved. Components that existed only to serve it are removed rather than kept
behind a flag.

**Cross-reference convention.** `§n` refers to a section of `docs/product.md`. `§An` refers to a
section of **this** document. Both files number their sections from 1, so the `A` prefix is what
distinguishes them.

---

## A1. Shape of the system

```text
                    ┌──────────────┐
      ASR / typing ─▶│   capture    │
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │context store │  turns · confirmed · personalContext
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │  pipelines   │  receptive · expressive
                    └──────┬───────┘
                           │  (1) request   { op, … }
═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═│═ ═ ═ ═ ═ ═ ═ ═  device boundary
                           ▼
                    ┌──────────────┐
                    │worker/ proxy │  holds the model key
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │   LLM API    │
                    └──────┬───────┘
                           │  (2) generated response
═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═ ═│═ ═ ═ ═ ═ ═ ═ ═
                           ▼
                    ┌──────────────┐
                    │ safety layer │  local · deterministic
                    └──────┬───────┘  suppress on violation (§A6)
                           ▼
            ┌──────────────┴──────────────┐
            ▼                             ▼
     ┌─────────────┐              ┌──────────────┐
     │ hint store  │              │  personView  │
     │ held, NOT   │              │  (receptive  │
     │  rendered   │              │   output)    │
     └──────┬──────┘              └──────────────┘
            │  only when [ことばのヒント] is invoked
            ▼
     ┌─────────────┐
     │ partnerView │
     └─────────────┘
```

Read the ordering carefully: **generation happens off-device, and the safety layer runs on what
comes back.** The safety layer is never between the pipelines and the Worker, and is never part of
the request. See §A6.

Delivery remains a framework-free static app served by any static HTTP server, with no build step
and no account.

`app/app.js` is deliberately a two-statement bootstrap: import `boot` from `app/runtime.js`, then
invoke it. `runtime.js` is the composition/orchestration boundary that wires capture, pipelines,
views, session/configuration, and telemetry together. Keeping the entry file logic-free makes the
remaining architecture visible by module ownership instead of allowing a second monolith to grow
back into `app.js`. The Worker exists only so the static app never holds a model key, and remains
demo-scoped, disposable infrastructure.

**Phase 1 has no persistence.** Nothing survives a page reload except what the researcher supplies
as configuration (§A8). There is no database, no `localStorage` memory, and no write path for
personal context. This is a deliberate constraint from §5.4 / §18.

---

## A2. Data structures

### A2.1 Session

One conversation session. Created on explicit start, discarded on stop or reload.

```js
session = {
  id,                 // string, for research logs only
  startedAt,          // epoch ms
  turns: [],          // §A2.2 — short-term context, bounded
  confirmed: [],      // §A2.3 — confirmed session context ONLY
  config,             // §A8 — researcher configuration, read-only
}
```

`session` holds no hypotheses. Unconfirmed inference lives in the hint store (§A2.5) and never
touches `session.confirmed`.

### A2.2 `turns` — short-term conversational context (§7.1)

```js
turn = {
  id,
  speaker: 'partner' | 'person',
  text,                        // settled text only; never interim
  source: 'asr' | 'typed',
  at,                          // epoch ms
}
```

Bounded ring buffer. **Default `MAX_TURNS = 6`**, chosen to match the window size used by the
closest published work on reconstructing aphasic utterances from conversational context. Tunable;
see §A11.

Only settled text is appended. Interim ASR results never enter `turns` (§A3.2).

### A2.3 `confirmed` — confirmed session context (§7.2)

```js
confirmedItem = {
  id,
  text,              // the meaning, as confirmed
  basis: [turnId],   // which turns it came from
  at,
}
```

**Invariant: an item enters `confirmed` only through an explicit person-side confirmation action
(§16.1).** No pipeline, no LLM response, and no partner action may write to it. This invariant is
the code-level expression of §2.9 and §18.4 path B, and should be enforced by making `confirmed`
writable through exactly one function.

### A2.4 `personalContext` — researcher-prefilled (§7.3)

**Read-only and in-memory only in Phase 1.** There is no code path that writes it, and no code path
that persists it.

```js
personalContext = {
  people:    [{ name, relation }],
  places:    [{ name, note }],
  schedule:  [{ what, when }],
  interests: [String],
  topics:    [String],
}
```

This is §18.4 **path A** data (deliberately provided context), which is why it needs no
conversational confirmation. It is **not** `expression → meaning` data; Expression Memory is
deferred (§18.3) and has no representation in this architecture.

#### How it is loaded — and where it must never go

A real participant's personal context is exactly the kind of data this project has committed not to
retain: family names, the hospital they attend, their appointments, their interests.

> **Real participant personal context is never committed to the repository, never placed under
> `app/`, and never encoded in a URL.**

The app is a static site served from public hosting. Anything under `app/` is publicly fetchable,
and a query parameter is visible in the URL bar, in browser history, and in any referrer. Writing
real personal context there would persist participant PII in the repository and the deployment —
defeating the no-persistence decision (§5.4, §18) in the one place it matters most.

Two distinct loading paths, with different data:

| Path | Data | Location | Lifetime |
|---|---|---|---|
| `?config=<id>` | **synthetic fixtures only** | `app/context/<id>.json`, committed | static asset |
| researcher load | **real participant context** | chosen at session start on the device | memory only |

- **`?config=<id>`** exists for development, demos, and rehearsal. The files under `app/context/`
  are invented sample data (e.g. `sample-01.json`) and must contain no real person's information.
  Committing a real participant file here is a review-blocking error.
- **Researcher load** is how a real session is set up: the researcher selects a local JSON file
  (File API) or fills a researcher-only form on the device immediately before the session. The
  result is held in the `session` object in memory only.

In both cases the context is discarded on session stop or page reload. Nothing is written to
`localStorage`, IndexedDB, cookies, or the server.

### A2.5 `hintStore` — the materialization of `MEANING_HINT_READY`

```js
hintStore = {
  state: 'empty' | 'ready' | 'unknown',
  fragmentTurnId,
  hypotheses: [{ text, evidence: [EvidenceRef] }],   // 0–3; evidence verified (§A5.3)
  producedAt,
  generation,        // for cancellation, §A9
}
```

`hintStore` is a plain data module with **no render side effect**. Writing to it never draws
anything. This is the architectural mechanism that separates inference from intervention (§2.2,
§20.2): the only way hypotheses reach a screen is `partnerView.render()` reading this store, and the
only thing that calls it is the `[ことばのヒント]` handler.

A code review rule follows from this: **no module other than `partnerView` may import `hintStore`
for reading.**

---

## A3. Receptive pipeline — Partner → Person (§11)

```text
partner speaks
      ↓
ASR interim ─────────────▶ transcript strip (secondary, live, may rewrite)
      ↓
ASR final
      ↓
chunker ── not a chunk boundary yet ──▶ buffer, wait
      ↓ chunk boundary
append turn (speaker:'partner')
      ↓
simplification gate  ── no ──▶ render nothing in the main area
      ↓ yes
Worker: op='simplify'
      ↓
safety layer (§6)
      ↓ pass
settle chunk → main area (never rewritten)
```

### A3.1 Simplification gate (§11.2)

The gate runs **locally, before any network call**, so ungated utterances cost nothing and add no
latency.

Signals (all local, deterministic):

- utterance length over a threshold
- more than one imperative or instruction
- a conditional or exception marker (もし / 〜たら / 〜場合 / ただし / でなければ)
- a question embedded inside other material
- multiple distinct entities (times, numbers, places) in one utterance

Passing none of these means the utterance is shown as-is in the transcript strip and the main area
is left alone. A short, simple utterance produces no AI output at all.

The gate is also **manually invocable**: `[短く]` (§14) forces simplification of the most recent
partner turn regardless of the gate result.

> Note on §20 scoping: gated receptive simplification renders automatically, and this is not a
> violation of the non-intervention rule. §20 governs *hypothesis availability* (the expressive
> direction). Receptive support is the direct, requested response to the partner speaking; without
> it the product has no receptive function at all.

### A3.2 Settled display and the interim/settled split (§11.3)

Two display surfaces with different rules:

| Surface | Content | May rewrite? |
|---|---|---|
| transcript strip | raw ASR, including interim | **yes** — it is the live, secondary record |
| main area | settled semantic chunks | **no** |

This split is what makes §11.3 implementable. Live ASR churn is confined to the small secondary
strip the person is not expected to read closely; the large main area only ever receives settled
content.

When a later chunk revises something already settled, the change is **marked as a change**, not
silently swapped.

#### As built (Stage 5, `app/views/person.js`)

Three decisions the section above left implicit, recorded because each was a fork in the road:

1. **A revision adds a block; it does not replace one.** The revised chunk stays where the person
   left off reading, dimmed and labelled 「あとで なおしました」, and the corrected wording arrives
   below it labelled 「なおしたことば」. Replacing the text and calling the replacement "marked"
   would remove the thing being marked. Its options are disabled rather than deleted — acting on
   superseded wording is a mistake, but removing controls shifts everything below them mid-read.
2. **Painting is incremental.** A settled block's element is created once and afterwards only ever
   gains a marker. Re-rendering the region would return identical text while discarding scroll
   position, focus, and any option already tapped — FR-010 satisfied on paper and broken in the
   hand. The one exception is reconstruction from state after the superseded expressive flow
   replaces the whole main area, which is why the view keeps its entries as data.
3. **The view subscribes to `capture/intake.js` directly**, rather than being handed text by
   `app.js`. The view owns both surfaces, so the surface each kind of text reaches is its decision
   and is assertable in a document (`tests/browser/receptive.test.js`). Wired through `app.js`, the
   interim/settled split had no test that did not assert against its own wiring.

### A3.3 Response options (§11.1, §11.5)

`op='simplify'` may return optional tappable options alongside the simplified meaning — this
subsumes the old open-ended-question answer-candidate feature. Response-type classification stays
internal and is never labelled in the UI.

---

## A4. Expressive pipeline — Person → Partner (§13)

```text
person speaks or types
      ↓
fragment captured  ── NO mandatory review step (§12.2)
      ↓
append turn (speaker:'person')
      ↓
Worker: op='hypotheses'
   input: fragment{id,text} + turns[{id,…}] + confirmed[{id,…}] + personalContext
      ↓
safety layer (§A6), mode='interpret'
   suppresses a candidate; all suppressed ──▶ unknown
      ↓
evidence verification (§A5.3)
   each pointer resolved against the live session;
   an unverifiable pointer is DROPPED, the hypothesis SURVIVES
      ↓
setHypotheses(...) / setUnknown(...)   ◀── HELD. Nothing renders. (§20.2)
      ↓
          … conversation continues normally …
      ↓
[ことばのヒント] invoked by a person
      ↓
partnerView renders from hintStore
      ↓
partner asks the person, in speech
      ↓
person: [はい] / [ちがう]
      ↓ はい
session.confirmed ← the item   (the ONLY writer, §A2.3)
```

### A4.1 No mandatory fragment review (§12.2)

The captured fragment goes straight into the pipeline. The editable form is reachable on demand
(`[ちがう]`, or the typing entry point), never imposed.

### A4.2 Zero candidates is a normal outcome (§15)

`hintStore.state === 'unknown'` is an ordinary result, not an error path. It renders §15.3 fallback
in the partner view, whose actions are weighted toward the partner changing the question rather than
the person trying again.

### A4.3 What is *not* in this pipeline

No ambiguity ordering, no clarification rounds, no sentence assembly. Optional final-sentence
rendering is Phase 2 (§16.3) and, when built, sits after confirmation and after the safety layer —
never before.

---

## A5. Worker API

### A5.1 Change from the previous contract

The old contract was `{ text } → { choices }` with a response schema of `minItems: 2, maxItems: 3`.
It is replaced, not extended, for two reasons:

1. it has no way to express the expressive direction at all
2. **`minItems: 2` makes "no candidates" unrepresentable**, and §15 requires zero candidates to be a
   normal output

A single endpoint with an `op` discriminator keeps the Worker minimal. (Alternative: two endpoints.
Either is fine; the discriminator is chosen to preserve the one-URL, one-CORS-rule shape.)

### A5.2 `op: "simplify"`

```jsonc
// request
{ "op": "simplify",
  "text": "…partner utterance…",
  "level": "short" | "standard" | "detailed" }   // §11.4; Phase 1 sends "standard"

// response
{ "op": "simplify",
  "meaning": "…",                 // simplified form
  "structure": [ "…", "…" ],      // optional: broken-out steps/conditions
  "options":   [ "…", "…" ] }     // optional, 0–3 (§A3.3)
// or
{ "error": "…" }
```

### A5.3 `op: "hypotheses"`

```jsonc
// request
{ "op": "hypotheses",
  "fragment": "…",
  "shortTerm": [ { "speaker": "partner", "text": "…" } ],   // §A2.2
  "confirmed": [ "…" ],                                      // §A2.3
  "personalContext": { … } }                                 // §A2.4, may be omitted

// response
{ "op": "hypotheses",
  "result": "ok" | "unknown",
  "hypotheses": [
    { "text": "10時",
      "evidence": [
        { "source": "turn", "id": "t11", "excerpt": "何時？" },
        { "source": "turn", "id": "t12", "excerpt": "10" }
      ] }
  ] }                              // 0–3 items; [] is valid and expected
// or
{ "error": "…" }
```

Schema constraints: `minItems: 0`, `maxItems: 3`. `result: "unknown"` is returned when the model has
no defensible hypothesis, and the app treats it as §15.3, not as a failure.

#### Evidence, not justification

Each hypothesis carries `evidence`: **pointers into the input**, not prose about the model's
reasoning.

```jsonc
{ "source": "turn",            "id": "t12",          "excerpt": "10" }
{ "source": "confirmed",       "id": "c3",           "excerpt": "明日" }
{ "source": "personalContext", "path": "schedule[0]", "excerpt": "明日 ○○病院" }
```

The model is not asked *why it thinks so*. It is asked **which parts of the input it used**.

Rationale: a model that produces a wrong hypothesis will also produce fluent, plausible reasons for
it. Plausible reasons for a wrong reading are worse than no reasons, because they are exactly what
anchors a partner to it (§26 q6). Free-form justification is therefore excluded from the contract
rather than left as a choice at implementation time.

#### Verification

`evidence` is **verified locally before display**, because a pointer that can be checked is only
useful if it is checked:

| `source` | Check |
|---|---|
| `turn` | `id` exists in `session.turns`, and `excerpt` is a substring of that turn's `text` |
| `confirmed` | `id` exists in `session.confirmed`, and `excerpt` is a substring of its `text` |
| `personalContext` | `path` resolves in the loaded `personalContext`, and `excerpt` matches the value there |

An evidence item that fails verification is **dropped**. The hypothesis itself survives — it simply
loses that supporting pointer, and may end up with none.

Dropping evidence is deliberately **not** the same decision as dropping the hypothesis. An
unverifiable pointer means the model cited something that is not in the input; whether the
hypothesis is safe to show is a separate judgement made by the safety layer (§A6) on the hypothesis
text. Conflating the two would let a citation error silently suppress a correct hypothesis, or let a
verified citation vouch for an unsafe one.

Verification failures are logged for research: a high rate is a signal that the prompt or the model
is wrong for this task.

### A5.4 Privacy consequence — expanded scope

Under the old architecture, only open-ended partner questions left the device. Under this one, the
`hypotheses` op sends **the person's fragment, recent turns, confirmed session meaning, and personal
context** to the proxy and from there to the model API.

This is a substantial widening of what leaves the device and must be stated in participant consent
for the user test. It is a direct consequence of §7.4 — contextual inference requires the context —
and cannot be avoided while the model runs off-device.

Mitigations in Phase 1: explicit session start/stop only (§10.2), no transcript retention (§5.4),
bounded context window (§2.2), and the `?ai=off` baseline (§A8), under which **no request is sent to
this project's Worker or to the LLM API**.

> That last claim is deliberately scoped to this project's own network calls. It is not a claim that
> the device sends nothing: browser `SpeechRecognition` may itself be implemented as a remote
> service, so any condition that leaves ASR running can still transmit audio to the browser vendor,
> outside this application's control. This is why `?ai=off` does not start speech recognition at all
> (§A8.1).

---

## A6. Safety layer (§17)

Position: **between generation and display**, on every path that produces language.

```text
Worker response ──▶ safety.check(candidate, source) ──▶ pass ──▶ view
                                    │
                                    └── fail ──▶ suppress candidate
                                                     │
                                          all suppressed ──▶ 'unknown' (§15.3)
```

Applies to: receptive simplification output, expressive hypotheses, and (Phase 2) final-sentence
rendering.

### A6.1 Two modes — what the output CLAIMS decides which checks apply

```js
safety.check(candidateText, sourceText, { mode, confirmed, personalContext })
  → { ok, violations: [{ check, detail }] }
```

The two pipelines make different claims about their output, so they cannot be checked by the same
rules.

| Mode | Used by | The claim | Consequence |
|---|---|---|---|
| `restate` | `op=simplify` | *this says the same thing, more simply* | introducing a number or a day is fabrication |
| `interpret` | `op=hypotheses` | *this is a possible reading of a fragment* | proposing one is the product working |

This is not an implementation detail; it is the safety model. A hypothesis exists to propose what
the source does not state literally — resolving 「じゅう」 to 10時, or 「さくら」 to さくら台病院. A
layer that treats that as fabrication suppresses the feature itself.

| Check | Applies in | Method |
|---|---|---|
| polarity | **both** | negation PRESENT in source vs candidate. Any appearance or disappearance is a violation |
| person | **both** | a person in neither the source nor personal context has been invented |
| person — subject swap | `restate` only | when both texts mark a doer with が/は and the candidate's doer was a non-subject in the source |
| action | **both** | stop↔continue, go↔cancel and similar inversions expressed *without* negation |
| medication | **both** | a dose, or medication itself, not present in the source |
| consent | **both** | agreement or refusal asserted where the source asserted none, or reversed |
| time | `restate` only | a day or part-of-day not in the source or in confirmed context |
| number | `restate` only | a numeral not in the source, after clock and list-marker canonicalisation |

An unspecified mode defaults to `restate` — the stricter one, which is the safe direction to be
wrong in.

Why the subject-swap rule is `restate`-only: a hypothesis is the *person's* meaning answering the
partner, so a subject differing from the question's subject is normal
(「娘さんが行くんですか？」 → 「私が行きます」).

#### Interpret grounding — OQ-11 resolved 2026-09-25

For `mode: 'interpret'`, `sourceText` is a deterministic projection of the **exact hypotheses
request body that was sent to the model**. It concatenates textual values from the fields that are
present in that request: `fragment.text`, each `shortTerm[].text`, each `confirmed[].text`, and
the string/primitive leaf values of `personalContext` when that field is enabled.

It does **not** read extra live-session context that was omitted by `config.ctx`, and it does not
serialize ids, object keys, or JSON punctuation into the grounding text. The safety layer therefore
tests a hypothesis only against information the model could actually have used, without lexical
checks accidentally matching schema names or ids.

Verified evidence is deliberately **not** the grounding source. Safety runs before evidence
verification and answers “is this candidate unsafe relative to what the model was given?” Evidence
verification answers “did this model-authored pointer honestly resolve to the live input?” Making
Safety depend on verified pointers would conflate those responsibilities and would cause a malformed
citation to suppress a hypothesis that may still be grounded in the request. Verified evidence is
still used downstream for partner-visible excerpts and confirmation `basis`.

The expressive pipeline owns this request → grounding projection and passes:
`safety.filter(candidates, groundingText, { mode: 'interpret', confirmed, personalContext })`.
This closes OQ-11 without weakening any check: polarity, action, medication, consent and person
still apply; they simply see the complete input domain they are supposed to judge.

**Architectural constraint: the safety check must not be another call to the model that produced the
candidate.** A model that inverted a polarity will not reliably notice that it did. Phase 1 uses
local rule-based checks only, with no second network call. This also keeps the check on the critical
path without adding latency.

#### Known gaps, recorded rather than implied

- **Negation relocation is not caught.** 「薬を飲まないで、電話して」 → 「薬を飲んで、電話しないで」
  keeps one negation and passes. Counting instead of detecting does not help — the count is also 1
  — and it suppresses correct structured output that restates the same prohibition twice. Catching
  relocation needs clause alignment, which Phase 1 does not attempt.
- **An omitted subject cannot be compared.** The swap rule fires only when both texts mark a doer
  explicitly. Guessing at an implied one would suppress correct output.

### A6.2 Failure behaviour (§17.2)

A failing candidate is **suppressed, never silently repaired**. Repairing would mean generating
again, which reintroduces the same risk class. Violations are logged for research.

### A6.3 Known limitation

Rule-based Japanese polarity and subject detection will have both false positives and false
negatives. Phase 1 accepts this deliberately: suppression is the safe direction of error, because
suppression degrades to §15.3 while a missed inversion reaches a person. Tuning is a research output
of the user test, not a prerequisite for it.

---

## A7. Views

Two views, one device, explicit switch. No automatic rotation (§21 demoted).

### A7.1 `personView` (§9.1)

Renders from: settled receptive chunks, support controls, confirmation prompts.

```text
┌─────────────────────────────┐
│ session state               │
│ transcript strip (small)    │  ← live, secondary
├─────────────────────────────┤
│                             │
│  settled simplified meaning │  ← large, never rewritten
│  [ option ] [ option ]      │
│                             │
├─────────────────────────────┤
│ [もう一回][ゆっくり][短く][ちがう] │
│        🎤 はなす   ⌨ もじ     │
└─────────────────────────────┘
```

> **Invariant: `personView` never reads `hintStore`.**

That single rule implements §9.1's prohibitions — no AI reasoning, no confidence, no candidate lists
on the person's side — structurally rather than by discipline.

### A7.2 `partnerView` (§9.2)

Renders from: `turns`, `confirmed`, `hintStore`, uncertainty state.

Reached **only** by invoking `[ことばのヒント]`. It is not a background panel and has no persistent
presence, because a persistent presence is an availability indicator by another name (§20.2).

```text
┌─────────────────────────────┐
│ person said:  「…10…」       │
│ before that:  「何時？」      │
│ confirmed:    明日・病院      │
├─────────────────────────────┤
│ かもしれない意味             │
│                             │
│  10時                       │
│    ←「何時？」               │
│    ←「10」                   │
│                             │
│  10日                       │
│    ←「10」                   │
│                             │
│ (or: まだ わかりません)       │
├─────────────────────────────┤
│ [どれも ちがいそう]          │
│ [会話を つづける]            │
└─────────────────────────────┘
```

Evidence is displayed as **quoted excerpts from the conversation**, not as sentences about the AI's
reasoning (§A5.3). A partner reading 「何時？」「10」 can judge the inference themselves; a partner
reading 「直前に時間を聞かれているため」 is being told a conclusion.

Only verified evidence is rendered. A hypothesis whose evidence all failed verification is shown
without any, which is itself informative.

Must be glanceable rather than absorbing (§21.3), since time spent reading it is time not spent
looking at the person.

### A7.3 Confirmation surface — decided

`[はい] / [ちがう]` is rendered on the **person** side, together with **the single hypothesis
currently under discussion, and never a list.**

```text
┌─────────────────────────────┐
│                             │
│   明日の病院は10時           │
│                             │
│   [ はい ]                   │
│   [ ちがう ]                 │
│                             │
└─────────────────────────────┘
```

Not this:

```text
① 10時   ② 10日   ③ 時計      ← never shown to the person
```

Three reasons:

1. the person can see what they are agreeing to, which matters because a yes is weak evidence
   (§16.2) and a yes to something unseen is worthless
2. it does not reintroduce candidate selection, which is the executive load §13.6 demoted the old
   flow to avoid
3. one meaning at a time is what §9.1 asks for

#### How this preserves the `hintStore` invariant

`personView` still never reads `hintStore`. The partner's act of choosing a hypothesis to check
pushes **one** item into a separate, minimal structure:

```js
confirmationRequest = {
  text,               // the single hypothesis under discussion
  hypothesisId,       // for the writer in §A2.3 and for research logs
} | null
```

`partnerView` writes it, `personView` reads it. It carries no evidence, no alternatives, no
confidence, and no reasoning — only the one sentence being asked about. The invariant holds because
what crosses to the person's side is a question, not the AI's working.

---

## A8. Researcher configuration (§24)

All configuration is read-only, set before a session, and never exposed in the participant UI.

```text
?config=<id>     load app/context/<id>.json — SYNTHETIC FIXTURES ONLY (§A2.4)
?ai=off          A0 baseline — no AI output, no transcript, no ASR
?receptive=off   B0 — transcript only, no simplification
?ctx=none        C0 — hypotheses from the fragment alone
?ctx=session     C1 — fragment + turns + confirmed
?ctx=personal    C2 — fragment + turns + confirmed + personalContext  (default)
```

Real participant personal context is **not** set through a query parameter. It is loaded on the
device at session start and held in memory only (§A2.4).

### A8.1 What `?ai=off` turns off

A0 must show the pair *nothing* (§24.1), and is distinguished from B0 precisely on the transcript.
Implementing A0 as "skip the LLM call" while leaving the transcript visible would silently make it
B0.

```text
?ai=off
  ├─ no Worker / LLM request
  ├─ no transcript strip
  ├─ no main-area output
  └─ speech recognition is not started at all
```

Speech recognition is included in that list deliberately. Browser `SpeechRecognition`
implementations may perform recognition as a remote service, so leaving ASR running in A0 would
still send participant audio to a third party while the condition claims to be assistance-free. Not
starting it removes the ambiguity.

If the user test needs audio for research purposes, that recording is arranged separately from the
application and consented to separately. It is not a side effect of an application condition.

---

### A8.2 Research telemetry (FR-041, FR-042)

Phase 1 telemetry is ephemeral diagnostic output only. `app/core/telemetry.js` records:

- Worker operation name plus elapsed milliseconds
- Safety suppression count, mode, and violated check names
- Evidence-verification failure count and reason categories

It MUST NOT log utterance text, hypothesis text, evidence excerpts, personal-context values, or a
participant identifier. The default sink is the browser console; there is no persistence or upload
path in Phase 1. This keeps the latency/safety measurements needed for the user test without turning
research diagnostics into a second store of sensitive conversation data.

## A9. Reuse from the current implementation

Directly reusable, with little or no change:

| Component | Location | Note |
|---|---|---|
| session start/stop + state display | `app.js:15,104,118` | matches §10.2 as-is |
| dual ASR setup (`ja-JP`, continuous vs one-shot) | `app.js:104-117,139-152` | the two capture modes stay |
| **generation counters for cancellation** | `app.js:66,93,110,123,142` | `partnerGeneration` / `expressiveGeneration` / `meaningGeneration` — the mechanism preventing a stale async response from overwriting a newer screen. Carries over directly to `hintStore.generation` |
| pause/resume partner listening | `app.js:17,18` | still needed when the person speaks (§10.3) |
| ASR error messages | `app.js:16` | wording already non-blaming |
| latency instrumentation | `app.js:14` | now covers two LLM ops instead of one |
| DOM helpers | `app.js:20-23,173-180` | `setMain`, `showChoices`, `addAction`, `escapeHtml`, `renderFlowView` |
| Worker skeleton | `worker/index.js:10-36,49-91` | CORS + origin allowlist + 503/429 backoff + JSON error shape all carry over; only the prompt and schema change |
| layout and control sizing | `styles.css` | shell, safe-area insets, `.choice` sizing, 78px mic |

Carried over unchanged in spirit: no build step, no accounts, no framework, static hosting.

---

## A10. Removed from the architecture

Deleted, not flagged off:

| Component | Location | Replaced by |
|---|---|---|
| `ambiguities` fixed `time → topic → content` | `app.js:5-9` | §13 hypothesis pipeline |
| `nextClarification` / `showClarification` | `app.js:183,184` | — |
| 2-round clarification limit | `app.js:183,184` | — |
| `noneOfThese` / `choicesFor` / `contentChoicesFor` | `app.js:185,186,198` | — |
| `buildMessage` / `contentClause` / `timeWord` / `topicWord` / `personMention` | `app.js:187-228` | optional Phase 2 rendering (§16.3) |
| `directCandidates` / `showDirectCandidates` | `app.js:182,229-239` | — |
| `modeA` query param (Mode A/B) | `app.js:3` | §A8 research conditions |
| `showDontUnderstand` / 「わかりません」 | `app.js:70,84-90` | §14 four support requests |
| `showConfirm` (sentence approval form) | `app.js:240` | §16.1 meaning confirmation |
| `showOutput` 180° overlay | `app.js:244`, `styles.css:49-50` | Phase 2 |
| `speakConfirmed` TTS | `app.js:246` | Phase 2 |
| `simplifyPartner` regex classifier | `app.js:56-65` | gate (§A3.1) + `op=simplify` — **removed T067** |
| `renderPartnerMeaning` / `showPartnerResult` | `app.js:67-83` | `app/views/person.js` — **removed T067** |
| open-question answer-candidate call (`{text} → {choices}`) | `app.js:66,71-89` | `op=simplify`'s `options` (§A3.3) — **removed T068**; the Worker handler survives until T078, see below |
| `showChoices` / `setPartnerTranscript` helpers | `app.js:21,24` | `app/views/person.js` — **removed T067** |
| Worker prompt + `minItems: 2` schema | `worker/index.js:43-47,65` | §A5.2 / §A5.3 |

Demoted to **optional, not built in Phase 1**: progressive clarification as one repair strategy
(§13.6), final-sentence rendering (§16.3), TTS, rotated partner output.

> **The legacy Worker handler is still deployed, and the repository no longer calls it.** As of T068
> nothing in `app/` sends a body without `op`. The `{text} → {choices}` handler stays in
> `worker/index.js` because the **published site** is still the pre-T068 build and would lose its
> only AI feature the moment the handler goes; the Worker deploys independently of the static app.
> T078 removes it. Verified 2026-09-25: the deployed Worker answers `{op:"simplify"}` with the legacy
> `{choices}` shape, i.e. it predates T063 — **`op=simplify` is in the repository but not in
> production**, and the receptive direction cannot work against the live endpoint until the Worker is
> redeployed.

---

## A11. Open architectural questions

Not blockers for starting Phase 1, but each needs an answer before the component it affects is
built.

1. **Chunk boundary rule (§A3.2).** Is one ASR `isFinal` one semantic chunk, or do finals accumulate
   until a sentence-end cue or pause threshold? Treating each final as a chunk is the cheapest
   Phase 1 default and is what the current ASR already yields, but it will sometimes settle a
   fragment of a sentence.
2. **Gate thresholds (§A3.1).** Concrete values for length and entity count. Should be calibrated
   against recorded partner utterances rather than guessed.
3. **Partner view presentation.** Full-screen swap vs. a peek panel, and the physical handover —
   who holds the phone, and how the view returns to the person.
4. **Uncertainty display.** Whether `partnerView` shows a coarse confidence band, and whether the
   model is asked for one at all. LLM self-reported confidence is weak evidence and may anchor the
   partner (§26 q6). Note that verified `evidence` (§A5.3) already gives the partner something
   better to judge by, which may make a confidence band unnecessary.
5. **Model and prompt per op.** `simplify` and `hypotheses` are different tasks with different
   latency budgets; whether they share a model is open. Current Worker pins `gemini-3.6-flash`.
6. **Latency budget.** Receptive simplification is now on the conversational critical path. An
   acceptable ceiling, and behaviour when exceeded, are undefined.
7. **Personal context schema depth (§A2.4).** The sketch above is minimal; what the researcher can
   realistically author on the device immediately before a session determines the real shape.
8. **Icon and image assets (§22).** Source (existing pictogram set / generated / photographed) and
   licensing. Affects bundle size and the no-build-step constraint.
9. **Safety rule calibration (§A6.3).** Acceptable false-positive rate for suppression, and how
   violations are reviewed after the test.
