# 001-aphasia-conversation-aid — superseded 2026-09-24

Superseded by **`002-context-aware-dyadic-support`**.

`task.md`, `fix-request-2026-09-18.md`, and `specs/001-aphasia-conversation-aid/` are left
**unmodified** as history. They describe the product model this project no longer builds, and must
not be used as a source of requirements.

## Why it was closed rather than continued

`docs/product.md` was re-centred on 2026-09-24 (commit `0c54869`), moving the product from
*completing the person's sentence* to *helping two people understand each other*.
`docs/architecture.md` followed (`8f6e879`, `3acd59e`).

001's goal statement, its spec (FR-001–FR-020), and its resolved decisions are all built on the
superseded model. Rewriting them in place would have destroyed the record of what was decided and
why it changed. A new task derived from the current `docs/product.md` and `docs/architecture.md` is
cleaner and leaves the history intact.

Specifically, these 001 requirements are now contradicted by the product spec:

| 001 | Now |
|---|---|
| FR-002 fixed `time → topic → content`, no one-step generation | demoted to an optional repair strategy (product §13.6) |
| mandatory two-round clarification bound | replaced by one generation attempt yielding 0–3 hypotheses (product §15) |
| FR-004 "None of these" regenerates exactly once | no longer the primary flow |
| FR-020 meaning choices are text-only, no icons/images | non-verbal presentation raised to Priority 1 (product §22) |
| Mode A / Mode B as the research comparison | replaced by A0 / B / C conditions (product §24) |
| partner-facing rotated final message as Priority 1 | demoted to Phase 2 (product §29.2) |
| every fragment becomes a final sentence | no longer required (product §12.3, §16) |

## State at close

```text
stage before close   qa
status before close  needs_human
qa_fix_attempt       2
pr_number            1
```

001 never reached a completed user test. Automated QA returned `environment_issue` twice: the QA
browser could not run `SpeechRecognition`, so speech input and continuous listening were never
black-box verified. Everything else in the manual pass did run — Mode B generation, the
"None of these" regeneration bound, and Mode A back-navigation were all exercised.

That QA limitation is **not** specific to 001 and is carried forward as a known constraint in
`specs/002-context-aware-dyadic-support/spec.md` and `agent/tasks/002-context-aware-dyadic-support/task.md`.

The original `qa-failure.md` was intentionally not committed; its durable content is the constraint
above, which now lives in 002.

## What carried forward

- the QA environment constraint (above)
- reusable implementation, catalogued in `docs/architecture.md` §A9 — session start/stop, the two
  ASR modes, the generation-counter cancellation mechanism, the Worker skeleton, DOM helpers, layout
- PR #1 remains open history; it implements the superseded model and should not be merged
