# Feature Specification: Aphasia Bidirectional Conversation Aid — Validation Prototype (v1)

**Feature Branch**: `001-aphasia-conversation-aid`

**Created**: 2026-09-16
**Updated**: 2026-09-17 — rewritten to align with the expanded `docs/product.md`; Open Questions
resolved and closed by Product the same day (clarification ordering, latency target, US1/US2 build
order, icon scope, reading-ability screening, language scope)

**Status**: Draft

**Input**: User description: "Researcher-assisted, mobile-first web validation prototype for a bidirectional
aphasia conversation aid. Rewrite the spec so it fully aligns with the current docs/product.md, dropping
typing-only expressive input, one-shot sentence generation, mandatory offline support, production
non-functional requirements, and per-turn explicit mic activation for the receptive direction. Reflect:
speech+typing expressive input; continuous partner listening during a user-started session; partner
speech → transcript → simplified 'what am I being asked'; progressive 2–3-choice narrowing of the user's
own fragmented intent (max 2 clarification rounds, 'None of these' regenerates once then falls back);
no autonomous AI speech/send; confirmation-gated final message with optional TTS; one decision per screen
with 2–3 large choices; 180°-rotated partner-facing display; diarization/accounts/offline/long-term
storage out of scope."

This spec derives its behavior from `docs/product.md`, which is the authoritative UX/product design
document for this prototype (see especially §§4–21 there for exact wording, wireframe sketches, and
state-machine detail). This spec restates that design in testable requirement form and does not
duplicate every example; consult `docs/product.md` directly for UI text and layout detail.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand what the conversation partner is asking (Priority: P1)

The person with aphasia starts a listening session before a conversation (e.g. at a clinic desk, on a
call, in a shop). The conversation partner speaks normally. Instead of a wall of verbatim text, the
person sees a short, large, decision-oriented summary of what they're being asked, with 2–3 simple
response choices when applicable.

**Why this priority**: This is one of the two conversation directions this prototype exists to validate,
and `docs/product.md` §26 lists conversation listening, transcription, and simplified partner meaning
among the "must work for the user test" (Priority 1) build items. Both User Story 1 and User Story 2 are
equally P1 in importance; **US1 is built first**, with US2 next, so that Friday's session has as much of
both directions working as possible if time is short.

**Independent Test**: Can be fully tested by starting a listening session, having a "partner" speak a
multi-part utterance (e.g. an appointment-scheduling question), and confirming the app surfaces a short
simplified prompt and, where applicable, 2–3 response choices — independent of whether the expressive
flow is exercised at all.

**Acceptance Scenarios**:

1. **Given** the app is idle, **When** the user explicitly starts a listening session, **Then** the
   microphone stays active and transcribing until the user explicitly stops it, without needing to be
   restarted after each partner utterance.
2. **Given** a listening session is active and the partner speaks, **When** transcription completes for
   an utterance, **Then** the app shows the lightly-cleaned transcript as small/secondary text and a
   short, decision-oriented simplification ("what are they asking me?") as the large, primary element.
3. **Given** a simplified prompt implies a small set of possible answers, **When** it is displayed,
   **Then** the app offers 2–3 large response choices plus an "I don't understand" option.
4. **Given** the user does not understand the simplified prompt itself, **When** they select "I don't
   understand," **Then** the app treats this differently from "None of these" (Requirement FR-011).

---

### User Story 2 - Turn a fragmented thought into a confirmed message for the partner (Priority: P1)

The person with aphasia wants to say something but can only produce a fragmented attempt — by speaking a
few words/sounds, or by typing a few words. The app does not guess a full sentence outright; it narrows
the intended meaning through one or two rounds of simple 2–3-choice questions, then produces one final
message that the user must explicitly confirm before it is shown or spoken to the partner.

**Why this priority**: This is the other core conversation direction, and matches `docs/product.md`'s
central design principle ("AI proposes. The user decides. AI helps communicate.") and its Priority-1
build list (expressive microphone, typed fragment input, clarification choices, max-2-round logic,
"None of these"/fallback, confirmation, partner-facing output). Equally P1 with User Story 1, but
**built second** — see User Story 1's "Why this priority" note.

**Independent Test**: Can be fully tested by providing a sparse fragment (speech or typed) with a
plausible but non-obvious intended meaning, working through the clarification prompts, and confirming
that a final message requires explicit user confirmation before any partner-facing output occurs —
independent of the receptive flow.

**Acceptance Scenarios**:

1. **Given** the user provides a fragment via speech or typing, **When** the fragment is ambiguous,
   **Then** the app asks at most one clarification question at a time, with 2–3 choices plus
   "None of these," for at most 2 rounds, before producing a final candidate message.
2. **Given** a clarification screen is shown and the user selects "None of these," **When** they do so,
   **Then** the app generates exactly one alternative set of choices for that same ambiguity; if none of
   those match either, the app moves to the fallback flow (FR-012) instead of regenerating again.
3. **Given** enough information is known (or, in the researcher-only comparison mode, three direct
   candidates have been generated), **When** the final message is shown, **Then** the user must explicitly
   confirm it ("This is right") before it can be shown to the partner or spoken aloud; the app never
   shows or speaks an inferred message on its own.
4. **Given** a confirmed message, **When** the user chooses to communicate it, **Then** they can either
   rotate it 180° into a full-screen, high-contrast partner-facing view, or have it read aloud via TTS.
5. **Given** the user can respond to the partner normally without needing assistance, **When** they do
   so, **Then** the app does not force them into the clarification flow.

---

### User Story 3 - Recover gracefully when the system can't help (Priority: P2)

Either direction can fail to converge: the partner's utterance may not simplify into anything useful, or
the user's fragment may not narrow to a confident final message within the bounded clarification
process. In both cases the app must say so clearly and hand control back to the user, rather than keep
guessing or leave the user stuck.

**Why this priority**: This is a safety/quality net over User Stories 1 and 2 rather than an independent
capability — `docs/product.md` §5.7 and §14 treat it as core to trustworthiness ("clear failure is
better than repeated guessing"), but it has no value without the two primary flows already working, so
it is sequenced after them.

**Independent Test**: Can be tested by forcing a low-confidence input (e.g. a fragment unrelated to any
plausible topic, or two consecutive "None of these" selections) and confirming the app presents an
explicit fallback (say more / add text / start over) instead of continuing to guess or freezing.

**Acceptance Scenarios**:

1. **Given** the clarification process has exhausted its bound (2 rounds, or a second unresolved
   "None of these") without converging, **When** this happens, **Then** the app shows a fallback screen
   offering to say more, add text, or start over — not another guess.
2. **Given** a partner utterance cannot be meaningfully simplified (e.g. too short, unclear audio),
   **When** this happens, **Then** the app indicates it could not process that input rather than showing
   a misleading simplification.

### Edge Cases

- What happens when the user's fragment is a single, ambiguous word with no usable context? The
  clarification flow (US2) should still bound at 2 rounds and reach fallback (US3) rather than loop.
- What happens if the user starts expressive input while a partner-listening session is active? Per
  `docs/product.md` §9.2, partner listening may be paused/deprioritized during expressive capture and
  resume afterward; no automatic speaker diarization is required.
- What happens if the confirmed message needs correction after the user already sees it in the
  partner-facing rotated view? The user must be able to return to the aphasia-user view without the
  partner-facing view having auto-spoken or persisted anything beyond what was confirmed.
- What happens if TTS playback is triggered accidentally in a quiet/private moment? Per FR-006, only
  explicit, confirmed text may be spoken, and playback is a distinct user action, never automatic.
- What happens if the user's fragment or the partner's utterance is in a dialect or register the system
  handles poorly? Out of scope for v1 correctness guarantees; not a blocking failure mode for the
  researcher-assisted test, but worth logging if observed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST accept expressive input as either speech (converted to editable text via
  ASR) or typed text (a word, several words, or a short phrase); both input paths MUST converge into a
  single internal "fragment" representation before further processing. *(docs/product.md §10)*
- **FR-002**: By default, the app MUST NOT generate a complete message from a fragment in one step.
  Instead it MUST run a bounded progressive-clarification flow with a **fixed ambiguity priority order:
  time → topic → content**. For each step in that order, if the item is not already known with
  confidence from the fragment or conversation context, the app asks one clarification question for it;
  if it is already known (e.g. the fragment already specifies "tomorrow," or context makes the topic
  clear), that step is skipped. The app (AI) chooses only the **2–3 choices to present at the current
  step**, not the order of ambiguities to resolve. This process runs for at most 2 clarification rounds
  total, then produces one final candidate message. *(Resolves prior Open Question 1; supersedes
  docs/product.md §12.3's "AI freely chooses the ambiguity" framing for this ordering decision — see
  docs/product.md §5.3, §12 for the surrounding flow.)*
- **FR-003**: Each clarification screen MUST show exactly one question, 2–3 choices, and a
  "None of these" option. *(docs/product.md §5.2, §13)*
- **FR-004**: If the user selects "None of these," the app MUST generate exactly one alternative set of
  choices for that same ambiguity. If the user still finds no match, the app MUST stop clarifying that
  ambiguity and move to the fallback flow (FR-012) instead of regenerating again.
  *(docs/product.md §13)*
- **FR-005**: The app MUST provide a researcher-only mode switch (e.g. a query parameter or hidden
  setting; no participant-facing UI required) to compare the default progressive-clarification flow
  (Mode B) against a direct three-candidate-sentence flow (Mode A) for the same fragment, to support the
  planned A/B comparison. *(docs/product.md §21)*
- **FR-006**: Once a final candidate message is ready, the app MUST require explicit user confirmation
  ("This is right" / edit / start over) before the message can be shown to the partner or spoken aloud.
  The app MUST NOT autonomously show or speak an inferred message without this confirmation.
  *(docs/product.md §5.5, §15)*
- **FR-007**: After confirmation, the app MUST offer two partner-facing output actions: (a) a
  full-screen, high-contrast view of the message rotated 180° for reading from the opposite side of the
  phone, and (b) text-to-speech playback. Only confirmed text may ever be spoken or shown this way.
  *(docs/product.md §16)*
- **FR-008**: The app MUST let the user explicitly start a "conversation listening" session (never
  automatically on app open). Once started, the microphone MUST remain active and continuously
  transcribing the partner's speech until the user explicitly stops it — the session MUST NOT require
  restarting after each partner utterance. *(docs/product.md §9.1)*
- **FR-009**: "Conversation listening" (partner speech) and "expressive input" (the user's own
  speech/typed fragment) MUST be two visually and behaviorally distinct controls. The app is not
  required to perform automatic speaker diarization, and MAY pause/deprioritize partner listening while
  the user is actively providing expressive input, resuming afterward. *(docs/product.md §9.2, §9.3)*
- **FR-010**: The app MUST transform the partner's transcribed speech into a short, decision-oriented
  representation (e.g. a short summary, the question being asked, or simple response choices) and
  display this as the large, primary on-screen element, while the fuller/lightly-cleaned transcript
  remains visible but visually secondary. A verbatim transcript alone MUST NOT be the primary output.
  *(docs/product.md §8, §11.1–§11.3)*
- **FR-011**: The app MUST offer "I don't understand" (the user does not understand the partner's
  utterance or the simplified prompt) as a control distinct from "None of these" (the user understands
  the question but the given choices don't match their intended answer). *(docs/product.md §11.4)*
- **FR-012**: When the bounded clarification process (FR-002/FR-004) does not converge, the app MUST
  return control to the user via an explicit fallback screen offering to say more (speech), add text, or
  start over — not another automatic guess, and not an open-ended loop. *(docs/product.md §5.7, §14)*
- **FR-013**: Every screen MUST present only one meaningful decision at a time, using large touch
  targets, high contrast, minimal wording, and avoiding technical/internal labels such as "AI" for the
  assistance area — the user should see the communication task, not the underlying technology.
  *(docs/product.md §5.1, §8.2, §19)*
- **FR-014**: If the user is able to respond to the partner normally without assistance, the app MUST
  NOT force an AI-mediated interaction; assistance is invoked by the user's own action (starting
  listening, or providing a fragment), never imposed automatically. *(docs/product.md §5.6)*
- **FR-015**: The app MUST NOT require account creation, login, or authentication in this prototype.
  *(docs/product.md §4.2)*
- **FR-016**: The app MUST be delivered as a mobile-first, portrait-first web application (not a native
  iOS/Android app) for this prototype, installable/home-screen-friendly and full-screen-like where
  practical, suitable for a researcher-observed session on a smartphone. *(docs/product.md §4.1)*
- **FR-017**: The app is not required to work offline, persist data beyond the current session, sync
  across devices, or provide production-grade analytics, error recovery, or permissions handling in this
  prototype. *(docs/product.md §4.2)*
- **FR-018**: Response time for ASR transcription and for LLM-based clarification/candidate generation
  SHOULD target roughly 1 second and MUST NOT practically exceed about 3 seconds during the user test.
  This is a user-validation target, not a production SLA. The app MUST measure and make visible (e.g. via
  logs/console) the latency of its main ASR and LLM calls, so this target can be checked during and after
  Friday's session. *(Resolves prior Open Question 2.)*
- **FR-019**: The prototype targets Japanese (ja-JP) only. No other language or localization/i18n
  support is in scope for v1. *(Resolves prior Open Question 6.)*
- **FR-020**: Operational icons (microphone, keyboard/type-instead, rotate, speak-aloud/TTS, back) MAY be
  used for controls. Icons or images representing the *meaning* of a clarification/candidate choice
  (e.g. an icon next to a choice's text) are out of scope for v1 — choices are text-only.
  *(Resolves prior Open Question 4.)*

### Key Entities

- **Fragment**: The unified internal representation of the user's expressive input for one turn,
  regardless of whether it originated from speech or typing. Exists only for the current interaction;
  not persisted beyond the session.
- **Clarification round**: One question, its 2–3 choices (plus "None of these"), and the user's
  selected answer. At most 2 occur per fragment before a final message is produced.
- **Partner utterance**: One captured/transcribed turn of the conversation partner's speech during an
  active listening session, together with its simplified, decision-oriented representation.
- **Final message**: The confirmed text the user has explicitly approved for the partner, either shown
  in the rotated partner-facing view or spoken via TTS. Exists only for the current session; this
  prototype has no save/persist step (see FR-017 and Non-Goals).

## Success Criteria *(mandatory)*

`docs/product.md` §23 frames success for this prototype as *"the test helps answer product questions,
not... behaves like a finished app."* The following restate its ten primary research questions as
observable outcomes the researcher-assisted session should be able to answer:

### Observable Outcomes

- **SC-001**: The session yields a clear answer to whether the user can operate each screen without
  repeated verbal explanation from the researcher.
- **SC-002**: The session yields a clear answer to whether the user understands the simplified
  representation of the partner's speech (Requirement FR-010).
- **SC-003**: The session yields a clear answer to whether the user can identify their intended meaning
  from a 2–3-choice clarification screen (Requirement FR-003).
- **SC-004**: The session yields a comparative answer (via the Mode A/B switch, FR-005) to whether
  progressive clarification feels easier than choosing from full-sentence candidates.
- **SC-005**: The session yields a clear answer to whether the user prefers speech input, typing, or a
  mixture (Requirement FR-001).
- **SC-006**: The session yields a clear answer to whether the partner-facing rotated output
  (Requirement FR-007) is understandable to the conversation partner without further explanation.
- **SC-007**: The session yields a clear answer to whether the tool reduces communication effort overall,
  or adds more steps than it removes, relative to the user's unassisted baseline.
- **SC-008**: Every point in the session where the user becomes confused or stuck is identifiable from
  observation or recording.
- **SC-009**: The session yields a clear answer to which direction — understanding the partner, or
  expressing their own message — the user finds more valuable.
- **SC-010**: The session produces a concrete, prioritized list of what should be removed before
  anything else is added.

## Out of Scope *(this prototype)*

Per `docs/product.md` §24, the following are explicitly not part of this validation prototype:

- Speech-language therapy, rehabilitation exercises, or clinical training features.
- A clinician dashboard, diagnostic tooling, or severity assessment.
- Autonomous conversation, or autonomous sending/speaking of inferred messages (see FR-006).
- Guaranteed support for all severities or all aphasia subtypes (see `docs/product.md` §3 for the
  targeted profile).
- Complex picture/gesture recognition, camera-based understanding, or eye tracking.
- Production phone-call integration, automatic speaker diarization, or background passive monitoring.
- Long-term personalization, accounts, offline operation, multi-device sync, or production-grade
  medical-data infrastructure (see FR-015–FR-017).
- Localization/i18n beyond Japanese (see FR-019).
- Meaning-representing icons/images on clarification/candidate choices (see FR-020) — operational icons
  for controls are in scope.
- Formal, in-app reading/comprehension screening. A short out-of-band check (does the participant
  understand short words/sentences, can they make a 3-choice selection, can they indicate yes/no) is
  done by the researcher before the session starts, as a recruiting/facilitation step — it is not an
  app feature (see `agent/tasks/001-aphasia-conversation-aid/task.md`).

## Assumptions

- Sessions are one participant at a time, researcher-assisted, not unsupervised/unattended deployment.
  *(docs/product.md §4)*
- ASR engine, TTS engine, and the underlying language-model approach for simplification/clarification
  are implementation/architecture decisions out of this spec's scope — see `docs/architecture.md`
  (currently undecided).
