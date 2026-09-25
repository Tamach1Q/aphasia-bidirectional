# Contract — Worker API

**Endpoint**: single URL, `POST`, JSON in / JSON out.
**Current app contract**: the `op=simplify` / `op=hypotheses` envelope below replaces the
superseded `{ text } → { choices }` contract for all calls made by the current app.
**Source of truth**: `docs/architecture.md` §A5.

The app depends on this contract only — not on Cloudflare, and not on any particular model vendor.
Swapping the backend touches one constant in the client.

The Worker implementation still accepts a body without `op` through a legacy
`{ text } → { choices }` compatibility handler. The current app does not call that path, so it is
not part of the current app contract.

## Why the current app moved off the old contract

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

**Everything citable carries its id.** The model cannot return an evidence pointer to `t11` unless
it was given `t11`.

```jsonc
{ "op": "hypotheses",
  "fragment":  { "id": "t12", "text": "…10…" },
  "shortTerm": [ { "id": "t11", "speaker": "partner", "text": "明日の病院、何時だった？" } ],
  "confirmed": [ { "id": "c3", "text": "明日病院に行く" } ],
  "personalContext": { … } }
```

Which fields are present is determined by `config.ctx` **at request construction** (data-model.md
§6), so the body itself is assertable:

| `ctx` | Fields sent |
|---|---|
| `none` | `fragment` |
| `session` | `fragment`, `shortTerm`, `confirmed` |
| `personal` | all four |

#### Why the fragment is an object, not a string

The fragment is itself a `Turn` in the session and carries a turn id. Sending it as
`{ id, text }` means evidence can point **at the fragment itself** with the ordinary
`{ "source": "turn", "id": "t12", … }` form.

Without this, `ctx=none` is unsatisfiable: only the fragment is sent, but there would be no way to
cite it, so every hypothesis would either carry no evidence or carry an invented pointer. That is a
defect in the contract, not a failure of the model — and scoring a model against it would measure
the wrong thing.

There is no separate `"source": "fragment"`. The fragment's id is a turn id, so verification against
`session.turns` works uniformly for all three context conditions.

#### Id assignment

Ids come from `session` (`t1`, `t2`, … `c1`, `c2`, …) and are **stable within a session**.

A caller that has no session — the Stage 0 evaluation harness reading a fixture — MUST assign ids
deterministically before building the request:

```text
fixture turns[0] → t1
fixture turns[1] → t2
…
```

so that a rerun produces byte-identical requests and a scored result can be reproduced.

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
