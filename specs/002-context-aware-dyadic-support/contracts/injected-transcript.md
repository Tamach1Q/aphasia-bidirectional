# Contract — Injected transcript path (FR-043)

**Module**: `app/capture/inject.js`
**Status**: product requirement, **not** test scaffolding.

## Why this is a contract

The automated QA environment cannot reliably run browser `SpeechRecognition`. Task 001 stalled at
`needs_human` twice for exactly this reason and never got speech input verified (spec.md §6).

Rather than restating that as a warning, this interface makes everything downstream of recognition
deterministically testable without audio. Verification splits:

| Layer | Verified by |
|---|---|
| speech recognition itself | a human, manually, on a real device |
| everything after recognition | automated, through this interface |

A QA result of "could not test — no speech recognition" is acceptable **only** for FR-007 and the
speech half of FR-012. Anywhere else it means this interface is inadequate and should be reported
as a defect against FR-043.

## Interface

```js
inject.turn({ speaker, text, source })   // → appends one settled Turn
inject.interim(text)                     // → transcript strip only; MUST NOT create a Turn
inject.fixture(name)                     // → loads app/fixtures/<name>.json and plays it
inject.reset()                           // → clears session state
```

### `inject.turn(...)`

```jsonc
{ "speaker": "partner" | "person",
  "text": "…",
  "source": "injected" }
```

Produces a `Turn` (data-model.md §2) that is **indistinguishable from an ASR turn** to every
downstream consumer once inside `session`.

That indistinguishability is the whole value of the interface. If injection took a different route
into the pipelines than recognition does, tests would pass against a path no participant ever
exercises.

`source: 'injected'` is retained for research logs only; no pipeline, view, or safety check may
branch on it.

### `inject.interim(...)`

Feeds interim text to the transcript strip. Exists so FR-010 is testable: interim content must reach
the strip and **never** the settled main area, and must never create a `Turn`.

### `inject.fixture(name)`

Plays a fixture file turn by turn. Fixture format:

```jsonc
{ "name": "f02-conditional-instruction",
  "description": "condition plus two actions",
  "turns": [
    { "speaker": "partner", "text": "…" },
    { "speaker": "person",  "text": "…" }
  ],
  "personalContext": { … },        // optional; synthetic only
  "expect": {                       // annotations, written in advance
    "gate": "pass" | "skip",
    "preserve": ["negation", "number", "condition", "time", "place", "action"],
    "networkCalls": 0,              // optional; asserts the gate kept it off the wire
    "hypotheses": { "min": 0, "max": 3 },
    "mustCite": "turn" | "confirmed" | "personalContext",
    "mustNotProduce": ["…"],        // substrings that must appear in NO hypothesis
    "notes": "why this fixture exists and what counts as failure"
  }
}
```

`expect` is authored **before** any model is run, so scoring in Stage 0 compares against a
prior annotation rather than a judgement made after seeing output (research.md §2).

### The `expect` fields

| Field | Applies to | Meaning |
|---|---|---|
| `gate` | receptive | `"skip"` means the local gate must NOT fire — an ordinary utterance must cost nothing |
| `preserve` | `op=simplify` | elements that must survive simplification. A missing one is an **over-reduction failure**, however fluent the output |
| `networkCalls` | receptive | expected number of model calls; `0` asserts the gate held |
| `hypotheses` | `op=hypotheses` | permitted count. `{min: 0, max: 0}` means **zero is the only correct answer** |
| `mustCite` | `op=hypotheses` | the evidence source at least one hypothesis must point at |
| `mustNotProduce` | either | substrings that must appear in **no** output. Present in a wrong hypothesis even alongside a right one counts as failure — the partner sees the whole list |
| `notes` | — | prose for a human reader; never parsed |

`mustNotProduce` is how the two hardest fixtures are scored. `f04` uses it for polarity
reversal (`薬を飲む` when the source said `飲まないで`), and `f08` uses it for anchoring
(a hospital reading when the conversation was about bedtime).

## Availability

Enabled only when a researcher flag is present (e.g. `?inject=1`) or when served from the test page.
It MUST NOT be reachable in a participant session — an injected turn appearing mid-conversation
would corrupt both the conversation and the research record.

## Fixture location and constraints

`app/fixtures/`. **Synthetic only.** The same prohibition as `app/context/` applies (FR-005): no
real participant utterance, name, place, or appointment may be committed here.

Fixtures created for model selection (research.md §2) are the same files used for regression
afterwards. They are authored against this contract from the start rather than written as
throwaway scripts.

## What must be reachable through this path

Everything the stage plan lists as automated acceptance, specifically:

- context store invariants — ring bounding, interim exclusion, single-writer `confirmed`
- the simplification gate, including asserting **zero network calls** for gated-out utterances
- chunk settling and revision marking
- hypothesis generation, including the 0-candidate case
- evidence verification, including dropping an unverifiable pointer while keeping the hypothesis
- safety suppression, including all-suppressed → `unknown`
- the non-intervention invariants — no DOM mutation and no indicator element after generation
- both views, confirmation, and the single write path into `session.confirmed`
- research conditions, including asserting the exact `hypotheses` request body per `ctx`
