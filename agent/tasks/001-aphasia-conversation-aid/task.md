# 001-aphasia-conversation-aid

## Goal

Build a researcher-assisted, mobile-first web validation prototype (not a production app) of a
bidirectional aphasia conversation aid, for a user test targeting **Friday, 2026-09-18**. The
prototype must let a person with aphasia (a) understand a simplified version of what a conversation
partner is asking them, and (b) turn their own fragmented speech/typed input into a confirmed message
for the partner, via progressive 2–3-choice clarification rather than one-shot sentence generation.

## Required behavior

See `specs/001-aphasia-conversation-aid/spec.md` (FR-001 through FR-020) for the authoritative,
testable requirements, and `docs/product.md` for the full UX design (wireframe sketches, exact wording,
state machine) that the spec derives from. Summary, in build-priority order per `docs/product.md` §26:

**Priority 1 — must work for Friday's test:**
1. Mobile-first, portrait-first web UI.
2. Conversation listening: explicit start/stop, continuous while active (not per-utterance).
3. Partner speech transcription.
4. Simplified partner meaning ("what are they asking me?") as the primary on-screen element.
5. Large, prominent expressive microphone.
6. Typed fragment input (converges with speech into one "fragment" concept).
7. Clarification choices: one question, 2–3 choices, "None of these" every time.
8. Max-2-round clarification logic.
9. "None of these" regenerates once, then falls back (say more / add text / start over).
10. Final message confirmation gate — nothing shown/spoken to the partner without it.
11. Partner-facing 180°-rotated message view.

**Priority 2 — useful if time allows:** TTS for confirmed output; editable ASR fragment before
clarification; researcher-only Mode A (direct 3-candidate) vs. Mode B (progressive clarification)
switch; home-screen/PWA polish.

**Priority 3 — explicitly deferred:** accounts, persistence, offline support, production analytics,
background audio, speaker diarization, long-term memory, native app distribution.

## Acceptance criteria

See `specs/001-aphasia-conversation-aid/spec.md` Success Criteria (SC-001–SC-010) and each User
Story's Acceptance Scenarios. Note these are framed as *research questions the session should be able
to answer*, not adoption/conversion metrics — this is a validation prototype, not a shipped product
(`docs/product.md` §23). Before this task is considered done for Friday:

- Both User Story 1 (receptive) and User Story 2 (expressive) flows are implemented and
  independently exercisable.
- The clarification bound (max 2 rounds, "None of these" regenerates once then falls back) is
  enforced — no open-ended guessing loop.
- No message is ever shown to the partner or spoken aloud without explicit user confirmation
  (FR-006) — this is non-negotiable per Constitution Principle VII (User Decides, AI Proposes) and
  `docs/product.md` §5.5.
- The app requires no account/login (FR-015) and is a web app, not native (FR-016).
- User Story 3's fallback behavior is reachable and does not dead-end the user.
- The clarification order follows the fixed time → topic → content priority (FR-002), skipping steps
  already known, with the AI generating only the choices at each step.
- ASR and LLM call latency is measured/logged (FR-018) so the ~1s/3s target can be checked.
- The app is Japanese-only, with no meaning-representing icons on choices (FR-019, FR-020).

## Non-goals

See `specs/001-aphasia-conversation-aid/spec.md` "Out of Scope" section (mirrors `docs/product.md`
§24). In short: no therapy/rehab features, no clinician dashboard, no diagnosis/severity assessment,
no autonomous conversation or autonomous send/speak, no guaranteed support for all severities/subtypes,
no complex picture/gesture/camera/eye-tracking input, no production phone integration, no diarization,
no accounts, no offline support, no long-term persistence or multi-device sync.

## Resolved decisions (2026-09-17, closed by Product — implement as specified, do not re-litigate)

- **Clarification ordering (FR-002)**: fixed priority order **time → topic → content**. Skip any step
  already known with confidence from the fragment/context. The AI's job at each step is to generate the
  2–3 choices to present, not to choose which ambiguity to resolve next.
- **Latency (FR-018)**: target ~1s, practical upper bound ~3s, for ASR and LLM-based
  clarification/candidate generation. This is a user-validation target, not a production SLA — but the
  app MUST measure/log latency for these calls so it can be checked during and after Friday's session.
- **US1/US2 priority (spec User Stories 1 & 2)**: both P1. Build receptive (US1) first, expressive (US2)
  second, aiming to have both directions testable on Friday.
- **Icons (FR-020)**: operational icons (mic, keyboard, rotate, speak-aloud, back) are used. Icons/images
  attached to the *meaning* of a clarification/candidate choice are out of scope — choices are text-only.
- **Reading-ability check**: not an app feature. The researcher does a brief out-of-band check before
  the session (can the participant understand short words/sentences, make a 3-choice selection, indicate
  yes/no) as a recruiting/facilitation step, not something Coding needs to build.
- **Language (FR-019)**: Japanese (ja-JP) only for v1. No i18n/localization work.

## Relevant files/specs

- `docs/product.md` — **primary, authoritative UX/product design document** for this prototype (27
  sections: principles, interaction model, wireframe sketches, state machine, content rules, research
  comparison mode, implementation priority). Read this before `spec.md` for behavioral/UI detail.
- `docs/architecture.md` — currently undecided; Coding agent should propose and record stack choices
  here (web framework, ASR/TTS provider, LLM/model approach) as part of implementation.
- `.specify/memory/constitution.md` — governing principles. Principle IV (privacy/dignity), Principle
  VII (User Decides, AI Proposes — the "no autonomous speak/send" rule behind FR-006), and Principle
  VIII (Bounded Inference — the max-2-round/fallback rule behind FR-002/FR-004/FR-012) are
  non-negotiable; flag any conflict back to Product.
- `specs/001-aphasia-conversation-aid/spec.md` — full, rewritten testable specification (authoritative
  for acceptance criteria; all Open Questions closed as of 2026-09-17, see "Resolved decisions" above).
- `specs/001-aphasia-conversation-aid/checklists/requirements.md` — spec quality checklist.
- `docs/sources/` — raw hearing-transcript primary source material (interviews with aphasia
  self-advocates and speech-language pathologists). **Gitignored — contains personal information, do
  not commit or push.** Useful context for *why* the design looks the way it does, not a source of
  additional requirements beyond what's in `spec.md`/`product.md`.

## Active fix request (2026-09-18, pre-user-test)

**Required reading for this coding pass:**
`agent/tasks/001-aphasia-conversation-aid/fix-request-2026-09-18.md`.

Product (human-in-the-loop review, since automated QA hit an environment error twice) did manual
black-box QA against PR #1 and found a confirmed implementation bug plus several UI/accessibility
issues to fix before today's user test. This is a bug-fix/UI-correction pass on the existing
implementation, not new scope — see that file for the full, itemized list (P0 bugs: dropped
person/subject in generated messages, broken Mode A back-navigation, fake ASR fallback text on
recognition failure, `reset()` not stopping expressive recognition; P1: primary controls must not be
confined to the right edge, un-right-align the fragment-submit CTA, don't let larger text sizes hide
controls, optional dark mode) and the manual test plan and report-back format to follow.

## Open items for Coding to flag back to Product (not to decide unilaterally)

All items previously listed here (clarification ordering, latency target, US1/US2 priority, icon
scope, reading screening, language scope) were resolved 2026-09-17 — see "Resolved decisions" above.

Remaining open item: the specific mobile/web framework and ASR/TTS/LLM provider choices are
architecture decisions, not yet made, and belong in `docs/architecture.md`. If any of those choices
force a tradeoff against a Resolved decision above (e.g. a provider that can't hit the ~1s/3s latency
target), flag that back to Product rather than silently relaxing the target.
