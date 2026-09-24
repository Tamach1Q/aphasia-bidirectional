# Contract — Worker API

**Endpoint**: single URL, `POST`, JSON in / JSON out.
**Replaces**: the `{ text } → { choices }` contract used by the superseded model.
**Source of truth**: `docs/architecture.md` §A5.

The app depends on this contract only — not on Cloudflare, and not on any particular model vendor.
Swapping the backend touches one constant in the client.

## Why the old contract was replaced, not extended

1. It had no way to express the expressive direction at all.
2. Its response schema was `minItems: 2`, which makes **"no candidates" unrepresentable**. Spec
   FR-015 requires zero candidates to be a normal result.

## Common

### Request envelope

```jsonc
{ "op": "simplify" | "hypotheses", … }
```

### Error response

```jsonc
{ "error": "human-readable detail" }
```

HTTP 502 for upstream failures after retries; 400 for a malformed body; 403 for a disallowed origin;
405 for a non-POST.

### Carried over from the existing Worker

Unchanged from `worker/index.js`: CORS with an origin allowlist, 503/429 retry with short backoff,
the JSON error shape, and holding the model key as a Worker secret so the static client never has
one.

### Model selection

The Worker MUST allow the two operations to name **different models** (research.md §2). Model ids
are configuration, not constants in the request.

---

## `op: "simplify"`

Receptive direction. Called **only after the local gate has passed** (FR-008) — an utterance that
fails the gate never reaches the network.

### Request

```jsonc
{ "op": "simplify",
  "text": "…the partner's utterance…",
  "level": "short" | "standard" | "detailed" }   // Phase 1 always sends "standard"
```

`level` exists for §11.4's adjustable simplification, which is Phase 2. Phase 1 sends `"standard"`
so the contract does not need to change later.

### Response

```jsonc
{ "op": "simplify",
  "meaning": "…",                 // the simplified form
  "structure": [ "…", "…" ],      // optional: broken-out steps or conditions
  "options":   [ "…", "…" ] }     // optional, 0–3 tappable replies
```

`options` subsumes the old open-ended-question answer-candidate feature. Response-type
classification stays internal and is never surfaced as a label (§11.5).

### Constraints

- MUST NOT drop meaning that changes the decision the person faces, in order to be shorter
  (FR-011).
- Output passes through the safety layer before display (FR-026). Simplification is **not** exempt.

---

## `op: "hypotheses"`

Expressive direction. Produces what the **partner** may later look at — never displayed
automatically (FR-019).

### Request

```jsonc
{ "op": "hypotheses",
  "fragment": "…",
  "shortTerm": [ { "speaker": "partner", "text": "…" } ],
  "confirmed": [ "…" ],
  "personalContext": { … } }
```

Which fields are present is determined by `config.ctx` **at request construction** (data-model.md
§6), so the body itself is assertable:

| `ctx` | Fields sent |
|---|---|
| `none` | `fragment` |
| `session` | `fragment`, `shortTerm`, `confirmed` |
| `personal` | all four |

### Response

```jsonc
{ "op": "hypotheses",
  "result": "ok" | "unknown",
  "hypotheses": [
    { "text": "10時",
      "evidence": [
        { "source": "turn", "id": "t11", "excerpt": "何時？" },
        { "source": "turn", "id": "t12", "excerpt": "10" }
      ] }
  ] }
```

### Schema constraints

- `hypotheses`: **`minItems: 0`, `maxItems: 3`**. An empty array is valid and expected.
- `result: "unknown"` when the model has no defensible hypothesis. The app treats this as §15.3
  fallback, **not** as an error (FR-015).

### Evidence, not justification

Each hypothesis carries pointers **into the input**:

```jsonc
{ "source": "turn",            "id": "t12",           "excerpt": "10" }
{ "source": "confirmed",       "id": "c3",            "excerpt": "明日" }
{ "source": "personalContext", "path": "schedule[0]", "excerpt": "明日 ○○病院" }
```

The model is asked **which parts of the input it used**, never *why it thinks so*.

Free-form justification is excluded from the contract rather than left to implementation taste. A
model that produces a wrong hypothesis also produces fluent reasons for it, and fluent reasons for a
wrong reading are worse than none — they are what anchors a partner to it (§26 q6).

### Client-side verification (FR-017)

Before display, every pointer is checked against the live session (data-model.md §7). Unverifiable
pointers are **dropped**; the hypothesis survives without them. Failures are logged (FR-042).

The server is not trusted to have cited honestly. That is the point of using pointers rather than
prose.

---

## Prompt requirements

Prompts live in `worker/prompts/`, one per operation, so they are reviewable and diffable rather
than embedded in control flow.

**`simplify`** must preserve condition, negation, number, person, and action; must not add
information absent from the input; must prefer dropping decorative wording over dropping a
decision-relevant element.

**`hypotheses`** must be instructed that:

- returning **zero** hypotheses is a correct and expected outcome when the fragment is genuinely
  underdetermined — this is the single most important instruction in the prompt
- every hypothesis must cite input it actually used
- personal context is background, **not** an answer key; the conversation takes precedence when they
  conflict
- the fragment's literal words may be substitutions for semantically adjacent ones (product §3.1),
  so neighbouring readings are legitimate candidates

Fixtures `f06-fragment-unanswerable` and `f08-anchoring-trap` (research.md §2) exist to test the
first and third of these.
