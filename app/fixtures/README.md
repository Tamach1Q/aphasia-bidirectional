# app/fixtures/ — SYNTHETIC CONVERSATION FIXTURES ONLY

> **This directory is published.** Everything under `app/` is served as a static file from public
> hosting and is fetchable by anyone who knows the URL.

## What these are

Invented conversation fixtures, played into the application through the injected transcript path
(`app/capture/inject.js`, FR-043). They serve two purposes at once:

1. **model selection** — scoring candidate models in Stage 0
2. **regression** — the same files remain the automated suite afterwards

They are authored against
[`specs/002-context-aware-dyadic-support/contracts/injected-transcript.md`](../../specs/002-context-aware-dyadic-support/contracts/injected-transcript.md)
so that (2) works without rewriting them.

## What must never go here

**No real participant data.** No real utterance, transcript, fragment, name, place, appointment, or
anything recorded from a real conversation. The same prohibition as `app/context/` applies — see
that directory's README for why.

**Committing a real participant's speech here is a review-blocking error.**

Hearing transcripts live in `docs/sources/`, which is **gitignored** precisely because it contains
personal information. Nothing from there may be copied into a fixture.

## Format

```jsonc
{ "name": "f02-conditional-instruction",
  "description": "…what this fixture exercises…",
  "turns": [
    { "speaker": "partner", "text": "…" },
    { "speaker": "person",  "text": "…" }
  ],
  "personalContext": { },          // optional, synthetic
  "expect": {                      // written BEFORE any model is run
    "gate": "pass" | "skip",
    "preserve": ["negation", "number"],
    "hypotheses": { "min": 0, "max": 3 }
  }
}
```

`expect` is the scoring key. It is authored in advance so that Stage 0 compares model output against
a prior annotation, rather than against a judgement formed after seeing the output.
