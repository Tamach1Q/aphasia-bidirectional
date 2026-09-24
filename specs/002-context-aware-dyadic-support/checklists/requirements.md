# Specification Quality Checklist: Context-Aware Dyadic Support (Phase 1)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-24
**Feature**: [spec.md](../spec.md)
**Supersedes**: `specs/001-aphasia-conversation-aid/checklists/requirements.md`

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) in requirement statements
- [x] Focused on user value
- [x] Written so a non-implementer can judge whether a requirement was met
- [x] All mandatory sections completed
- [~] **Partial**: FR-016/FR-017 (evidence pointers), FR-022 (store/view separation) and FR-029
      (no self-checking by the generating model) name structural constraints rather than pure
      behaviour. Retained deliberately — each encodes a safety property that is unenforceable if
      left to implementation discretion, and each is stated as a constraint, not a design.

## Requirement Completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are observable outcomes, appropriate for a validation prototype
- [x] Success criteria are technology-agnostic
- [x] Acceptance scenarios defined for every user story
- [x] Scope is clearly bounded (§8)
- [x] Dependencies and assumptions identified
- [x] Negative requirements are explicit where the risk is doing too much — FR-019 (no availability
      indicator), FR-021 (silence never triggers), FR-023 (never a candidate list), FR-028 (suppress,
      never repair), FR-032 (never blame the person)

## Constitution Compliance

- [x] Every principle assessed (§9)
- [x] Principle VII dependency **stated explicitly**: this spec requires constitution ≥ 1.2.0.
      Under 1.1.0 wording, showing a hypothesis to the partner before confirmation would have been
      non-compliant.
- [x] Principle VIII satisfied by a different bound than 001 used — one generation attempt yielding
      0–3 candidates (FR-015), then an honest "not determined" (FR-033)
- [x] Principle IV tension recorded rather than hidden — contextual inference sends more off-device
      than 001 did (OQ-3)

## Feature Readiness

- [x] Functional requirements trace to `docs/product.md` / `docs/architecture.md` sections
- [x] User scenarios cover the primary flows in both directions
- [x] Open questions enumerated with the requirement each one blocks (§10)
- [x] Known QA constraint carried forward with a mitigation, not just a warning (§6, FR-043)

## Anti-regression: old model must not return

Checked that the superseded 001 model is absent from this spec.

- [x] No fixed `time → topic → content` ordering
- [x] No mandatory two-round clarification
- [x] No Mode A / Mode B comparison
- [x] No final-sentence-first flow; no requirement that a fragment become a sentence
- [x] No "None of these regenerates exactly once" rule
- [x] No text-only restriction on meaning choices (FR-036 requires the opposite)
- [x] No rule that the partner may not see a hypothesis before confirmation (FR-020 permits it;
      FR-018 constrains how)

## Notes

- 10 open questions (§10) are unresolved at the time of writing. Unlike 001 — where all open
  questions were closed before handoff — these are deliberately carried into implementation, because
  several (gate thresholds, chunk boundaries, safety calibration) cannot be answered well without
  either real utterance data or a running pipeline to measure. Each is annotated with the specific
  requirement it blocks so none can be silently skipped.
- **OQ-3 and OQ-7 block the user test rather than the build.** They must be closed before a
  participant session, and should not be allowed to surface late.
- Success criteria are comparative against the `?ai=off` baseline (FR-039). A test run without that
  baseline cannot evaluate SC-001, SC-002, or SC-003.
