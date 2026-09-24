# Phase 1 — Data Model

**Feature**: 002-context-aware-dyadic-support
**Source of truth**: `docs/architecture.md` §A2. This file adds field-level detail, validation, and
state transitions; where the two differ, architecture.md wins.

All state is in-memory and dies with the page. There is no persistence in Phase 1 (FR-004,
NFR-003).

---

## 1. Session

The root object. Created on explicit start, discarded on stop or reload.

```js
Session {
  id          : string      // research logs only; not identifying
  startedAt   : number      // epoch ms
  turns       : Turn[]      // bounded, see §2
  confirmed   : Confirmed[] // see §3 — single writer
  config      : Config      // see §6 — read-only after start
}
```

**Invariants**

- `session` holds **no hypotheses**. Unconfirmed inference lives only in `HintStore` (§5).
- `config` is frozen after session start; research conditions cannot change mid-session.

---

## 2. Turn — short-term context (FR-002)

```js
Turn {
  id        : string                  // 't' + monotonic counter
  speaker   : 'partner' | 'person'
  text      : string                  // settled only
  source    : 'asr' | 'typed' | 'injected'
  at        : number                  // epoch ms
}
```

**Validation**

- `text` MUST be non-empty after trim; empty results are discarded, not appended.
- Interim recognition results MUST NOT produce a `Turn`. They go only to the transcript strip.
- `source: 'injected'` is the FR-043 path. Once inside `session`, an injected turn is
  indistinguishable from an ASR turn to every downstream consumer — this is what makes the test path
  meaningful rather than a parallel code path.

**Bounding**

- Ring buffer, `MAX_TURNS = 6` (§A2.2, matching the window used by the closest published work on
  reconstructing aphasic utterances from context).
- Eviction is oldest-first. An evicted turn's `id` may still be referenced by evidence produced
  earlier; verification (§7) MUST treat a reference to an evicted turn as **unverifiable**, not as
  an error.

---

## 3. Confirmed — session context (FR-003)

```js
Confirmed {
  id        : string      // 'c' + monotonic counter
  text      : string      // the meaning, as confirmed
  basis     : string[]    // Turn ids it was derived from
  at        : number
}
```

**Invariant — single writer**

> An entry is appended **only** by the person-side confirmation action.

Enforced structurally: `core/session.js` exports exactly one mutator for this collection
(`confirmSelected()`, see §8), and no pipeline, view, worker response, or partner action has
access to any other path that appends.

`confirmSelected()` takes no arguments from the UI — it commits the trusted snapshot the partner
view already holds (§8), so `session.js` never needs to read the hint store in order to build
`text` and `basis`.

This is the code-level form of product §2.9 and §18.4 path B. Not bounded — a session's confirmed
set is small by nature.

---

## 4. PersonalContext (FR-004, FR-005)

```js
PersonalContext {
  people    : { name: string, relation: string }[]
  places    : { name: string, note?: string }[]
  schedule  : { what: string, when: string }[]
  interests : string[]
  topics    : string[]
}
```

**Invariants**

- **Read-only.** No setter, no mutation path, no storage API call in the module.
- **In-memory only.** Discarded on stop or reload. No `localStorage`, IndexedDB, cookie, or server
  write anywhere in its lifecycle.
- Two loading paths with different data (§A2.4):

| Path | Data | Origin |
|---|---|---|
| `?config=<id>` | **synthetic fixtures only** | `app/context/<id>.json`, committed |
| researcher load | **real participant context** | local file or on-device form at session start |

- Real participant context MUST NOT be committed, served from `app/`, or encoded in a URL.
- This is §18.4 **path A** data, which is why it needs no conversational confirmation. It is **not**
  `expression → meaning` data; Expression Memory is deferred (§18.3) and has no representation here.

**Addressing**

Evidence may cite personal context by path (§7), e.g. `schedule[0]`, `people[2].name`. Paths are
resolved against the loaded object; an unresolvable path is unverifiable.

---

## 5. HintStore — `MEANING_HINT_READY` (FR-019, FR-022)

```js
HintStore {
  state          : 'empty' | 'ready' | 'unknown'
  fragmentTurnId : string | null
  hypotheses     : Hypothesis[]   // 0–3, safety-passed, evidence-verified
  producedAt     : number | null
  generation     : number         // stale-response guard
}

Hypothesis {
  id       : string          // 'h' + counter
  text     : string
  evidence : EvidenceRef[]   // verified only; may be empty
}
```

### 5.1 Module API — read and write are separate exports

The store is not a single opaque object. Reading and writing are **separate exported surfaces**, so
the access rule can be enforced mechanically:

```js
// writers — imported by pipelines/expressive.js
setHypotheses(fragmentTurnId, hypotheses, generation)
setUnknown(fragmentTurnId, generation)
clearHints()

// reader — imported by views/partner.js ONLY
getHintSnapshot() → { state, hypotheses, fragmentTurnId, producedAt } | null
```

**Invariants**

- **Writing to this store has no render side effect.** It is plain data.
- **Only `views/partner.js` may import `getHintSnapshot`.** `pipelines/expressive.js` imports the
  writers and nothing else. `views/person.js` imports **nothing** from this module.
- `hypotheses` contains only candidates that passed safety (§A6) and whose evidence was verified
  (§7). Raw model output never lands here.

> The rule is about **who may read**, not who may import the file. The pipeline must obviously be
> able to write, or the store could never be filled. Stating the rule as "only the partner view may
> import this module" would make it unsatisfiable alongside the expressive pipeline — splitting the
> exports is what makes it both true and checkable (FR-022).

Test form: assert that `views/person.js` imports nothing from `core/hint-store.js`, and that
`getHintSnapshot` appears in no import list except `views/partner.js`'s.

**State transitions**

```text
empty ──fragment captured──▶ (generation++) ──response──▶ ready   (1–3 hypotheses)
                                             └──────────▶ unknown (0 hypotheses,
                                                                   or all suppressed)
ready|unknown ──new fragment──▶ empty ──▶ …
any ──session stop / reset──▶ empty
```

**Generation counter**

Carried over from the existing implementation (`app.js:66,93,110,123,142`), where it prevents a
stale async response from overwriting a newer screen. A response whose `generation` does not match
the current one is discarded silently.

---

## 6. Config — research conditions (FR-039, FR-040)

```js
Config {
  ai        : 'on' | 'off'                      // ?ai=off  → A0 baseline
  receptive : 'on' | 'off'                      // ?receptive=off → B0
  ctx       : 'none' | 'session' | 'personal'   // C0 / C1 / C2, default 'personal'
  configId  : string | null                     // ?config=<id>, synthetic fixtures only
}
```

**Invariant — what `ai: 'off'` means**

```text
ai === 'off'  ⇒  no Worker request
              ∧  no transcript rendered
              ∧  no AI output rendered
              ∧  no SpeechRecognition object is ever constructed
```

The last conjunct is not an optimisation. Browser recognition may be implemented as a remote
service, so leaving it running would transmit participant audio during a condition that claims to be
assistance-free (§A8.1).

**Invariant — what `ctx` controls**

`ctx` determines exactly which fields are included in the `hypotheses` request body. It MUST be
enforced at request construction, not by ignoring extra data downstream, so the request body itself
is assertable in tests.

| `ctx` | Request includes |
|---|---|
| `none` | `fragment` |
| `session` | `fragment`, `shortTerm`, `confirmed` |
| `personal` | `fragment`, `shortTerm`, `confirmed`, `personalContext` |

---

## 7. EvidenceRef (FR-016, FR-017)

```js
EvidenceRef {
  source  : 'turn' | 'confirmed' | 'personalContext'
  id?     : string    // for 'turn' | 'confirmed'
  path?   : string    // for 'personalContext', e.g. 'schedule[0]'
  excerpt : string    // must appear in the cited source
}
```

Pointers into the input — **not** model-authored prose about its reasoning. The model is asked which
parts of the input it used, never why it thinks so (§A5.3).

**Verification, before display**

| `source` | Passes when |
|---|---|
| `turn` | `id` exists in `session.turns` **and** `excerpt` is a substring of that turn's `text` |
| `confirmed` | `id` exists in `session.confirmed` **and** `excerpt` is a substring of its `text` |
| `personalContext` | `path` resolves in the loaded object **and** `excerpt` matches the value there |

**On failure**: drop the evidence item. **Keep the hypothesis.**

Dropping evidence is a different decision from dropping a hypothesis. An unverifiable pointer means
the model cited something absent from the input; whether the hypothesis itself is safe to show is
judged separately by the safety layer on the hypothesis text. Conflating them would let a citation
error suppress a correct hypothesis, or let a verified citation vouch for an unsafe one.

Verification failures are counted and logged (FR-042); a high rate indicates the prompt or model is
wrong for the task.

---

## 8. Confirmation flow (FR-023, FR-024)

Two structures, deliberately separate: an **internal snapshot** the partner view holds, and a
**minimal request** the person's view sees.

```js
// INTERNAL — held by views/partner.js, never rendered to the person
SelectedConfirmation {
  hypothesisId : string
  text         : string
  basis        : string[]   // Turn ids, derived from the hypothesis's verified evidence
} | null

// UI — what crosses to the person's side
ConfirmationRequest {
  hypothesisId : string
  text         : string
} | null
```

### Why two

`Confirmed` (§3) needs `text` **and** `basis`. If the person's side only carried
`{text, hypothesisId}` and the session mutator had to reconstruct `basis` from `hypothesisId`, then
`core/session.js` would have to read the hint store — which breaks the rule that only the partner
view reads it (§5.1).

Keeping a trusted snapshot on the partner side, where the hypothesis was already in hand, avoids
that entirely.

### Flow

```text
partnerView: partner picks one hypothesis to check
        ↓
selectedConfirmation = { hypothesisId, text, basis }      ← internal, from the hypothesis
        ↓
confirmationRequest  = { hypothesisId, text }             ← the only thing personView sees
        ↓
personView renders that single sentence + [はい] [ちがう]
        ↓
[はい] → confirmSelected()
        ↓
core/session.js appends Confirmed { text, basis } from the trusted snapshot
```

`confirmSelected()` takes **no arguments from the UI**. It commits the snapshot the partner view
already holds, so the person's tap cannot smuggle in text that was never on screen, and
`session.js` never needs access to hypotheses.

`[ちがう]` clears both structures; the hypothesis is marked rejected for this fragment.

### Invariants

- `ConfirmationRequest` carries no evidence, no alternatives, no confidence, no reasoning — only the
  one sentence being asked about (§A7.3).
- `basis` is derived from the hypothesis's **verified** evidence (§7). Unverifiable pointers were
  already dropped, so `basis` never cites a turn that does not exist.
- `confirmSelected()` is the single writer into `Confirmed` (§3).
- `views/person.js` reads `ConfirmationRequest` only, and still imports nothing from the hint store.

---

## 9. SafetyResult (FR-026–FR-029)

```js
SafetyResult {
  ok         : boolean
  violations : { check: string, detail: string }[]
}
```

Produced by a **pure, local, deterministic** function
`check(candidateText, sourceText, context) → SafetyResult`.

Checks: `polarity`, `person`, `time`, `number`, `action`, `medication`, `consent`.

**Invariants**

- Never a network call. Never a second call to the model that generated the candidate (FR-029) — a
  model that inverted a polarity will not reliably notice that it did.
- A failing candidate is **suppressed, never repaired** (FR-028). Repair means regenerating, which
  reintroduces the same error class.
- If every candidate is suppressed, the result is `unknown` (§5), which is an ordinary path.
- Applies to **every** path producing language: simplification output and hypotheses alike.

---

## 10. Entity relationships

```text
Session
 ├── turns[]        Turn            (bounded ring, settled text only)
 ├── confirmed[]    Confirmed       (single writer: person confirmation)
 └── config         Config          (frozen at start)

PersonalContext     (read-only, in-memory, loaded separately from Session)

HintStore           (separate from Session — unconfirmed inference never
 └── hypotheses[]    Hypothesis      touches session.confirmed)
      └── evidence[] EvidenceRef ──▶ cites Turn.id / Confirmed.id /
                                     PersonalContext path

SelectedConfirmation ─▶ internal to views/partner.js
 │                       { hypothesisId, text, basis[] }
 ▼
ConfirmationRequest ──▶ { hypothesisId, text }
                        (the only hypothesis data the person's view may see)
```

The separation of `Session.confirmed` from `HintStore.hypotheses` is the data-model expression of
product §2.9: what the AI guessed and what the person confirmed are different things, and the
structure does not allow them to be conflated.
