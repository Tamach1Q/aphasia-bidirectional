# 002-context-aware-dyadic-support — Specification

**Status**: draft
**Created**: 2026-09-24
**Supersedes**: `specs/001-aphasia-conversation-aid/spec.md`

## 0. Authority

This document is derived from `docs/product.md` and `docs/architecture.md` at their current state on
`main`. It is not a revision of the 001 spec and shares no requirement numbering with it.

| Document | Authoritative for |
|---|---|
| `docs/product.md` | product behaviour, scope, rationale |
| `docs/architecture.md` | technical architecture |
| **this file** | testable requirements and acceptance criteria |
| `agent/tasks/002-context-aware-dyadic-support/task.md` | implementation handoff |
| `.specify/memory/constitution.md` | governing principles |

Where this spec and `docs/product.md` disagree, product.md wins and this spec is wrong.

Cross-reference convention: `§n` = `docs/product.md`; `§An` = `docs/architecture.md`.

## 1. Summary

Build the Phase 1 prototype of a bidirectional communication aid that helps a person with aphasia
and their conversation partner understand each other.

Two directions, deliberately asymmetric:

- **Partner → person**: transcribe the partner's speech, and *when it is hard to process*, present a
  simplified, structured form.
- **Person → partner**: take the person's fragment, combine it with conversation context, and
  produce hypotheses **the partner** can use to ask the person a better question.

The product does not complete the person's sentences, does not converse on anyone's behalf, and does
not interrupt.

## 2. Users

- **Primary beneficiary**: the person with aphasia (§4.1). Mild-to-moderate or moderate functional
  communication difficulty; oriented around non-fluent presentations but not gated on diagnosis.
- **Active participant**: the conversation partner (§4.4) — in this prototype, a trained
  communication-support worker, family member, or close friend only (§4.5).
- **Out of scope for this prototype**: first-meeting partners such as shop or station staff (§4.5).

## 3. User scenarios

### US-1 — The partner says something complicated (receptive, P1)

The partner gives multi-part instructions with a condition. The person cannot hold all of it.

**Acceptance scenarios**

1. **Given** a session is active, **when** the partner says a long utterance containing a condition,
   **then** a simplified, structured form appears in the main area within the latency target, and
   the raw text remains visible in the secondary transcript strip.
2. **Given** the same session, **when** the partner says a short simple utterance
   (e.g. 「明日病院行く？」), **then** no simplification is produced and the main area is not
   replaced.
3. **Given** a simplified form is displayed, **when** further speech arrives, **then** the already
   displayed content is not silently rewritten; any revision is marked as a change.
4. **Given** an utterance the gate did not select, **when** the person taps `[短く]`, **then** that
   utterance is simplified on demand.

### US-2 — The partner cannot understand the person (expressive, P1)

The person produces a fragment. The partner does not know what it means.

**Acceptance scenarios**

1. **Given** the partner has just asked a question and the person answers with a fragment,
   **when** the fragment is captured, **then** the person is not required to review or correct it
   before continuing.
2. **Given** hypotheses have been generated, **when** no one has invoked support, **then** nothing
   about them appears on screen — no list, no badge, no banner, no notice.
3. **Given** hypotheses are held, **when** a person invokes `[ことばのヒント]`, **then** the partner
   view shows 0–3 hypotheses, each marked as unconfirmed AI inference, each with verified excerpts
   from the conversation.
4. **Given** the partner picks one hypothesis to check, **when** they ask the person about it,
   **then** the person's screen shows **that one hypothesis only** with `[はい]` / `[ちがう]`, and
   never a list of candidates.
5. **Given** the person answers `[はい]`, **then** that meaning enters the session context and the
   conversation continues.

### US-3 — Meaning cannot be determined (P1)

**Acceptance scenarios**

1. **Given** a fragment with insufficient signal, **when** hypotheses are requested, **then**
   returning zero hypotheses is handled as a normal result, not an error.
2. **Given** zero hypotheses, **when** the partner view is opened, **then** it states plainly that
   the meaning is not yet clear and offers actions that include the partner changing their question.
3. **Given** the fallback is shown, **then** it does not place the entire burden of retrying on the
   person.

### US-4 — Research conditions (P1)

**Acceptance scenarios**

1. **Given** `?ai=off`, **when** a session runs, **then** no request is made to the Worker or LLM
   API, no transcript is shown, no AI output is shown, and speech recognition is never started.
2. **Given** `?receptive=off`, **then** the transcript is shown but no simplification is produced.
3. **Given** `?ctx=none|session|personal`, **then** hypothesis generation receives exactly the
   corresponding context and no more.

## 4. Functional requirements

### Session and context

- **FR-001**: The application MUST NOT listen without an explicit start action, and MUST provide an
  always-visible stop. There is no background or passive listening. (§10.2)
- **FR-002**: The system MUST maintain a bounded rolling buffer of recent turns from both speakers.
  Only settled text is appended; interim recognition results MUST NOT enter it. (§7.1, §A2.2)
- **FR-003**: The system MUST maintain session context containing **only** meaning the person has
  explicitly confirmed. No pipeline, LLM response, or partner action may write to it. (§7.2, §A2.3)
- **FR-004**: Personal context MUST be read-only and held in memory only. There MUST be no code path
  that writes it, persists it, or retains it across reload. (§7.3, §A2.4)
- **FR-005**: Real participant personal context MUST NOT be committed to the repository, served from
  `app/`, or encoded in a URL. `app/context/` MUST contain synthetic fixtures only; real context is
  loaded on the device at session start. (§A2.4)
- **FR-006**: Full conversation transcripts MUST NOT be retained after a session ends. (§5.4)

### Receptive support (partner → person)

- **FR-007**: The system MUST transcribe partner speech during an active session.
- **FR-008**: The system MUST apply a **local** simplification gate before any network call. An
  utterance failing the gate produces no AI output and does not replace the main area. (§11.2, §A3.1)
- **FR-009**: Simplification MUST be manually invocable via `[短く]` regardless of the gate result.
- **FR-010**: Displayed simplified content MUST settle at semantic chunk boundaries and MUST NOT be
  continuously rewritten. Interim recognition output is confined to the secondary transcript strip.
  A revision to already-settled content MUST be marked as a change, not silently swapped. (§11.3,
  §A3.2)
- **FR-011**: Simplification MUST NOT drop meaning that changes the decision the person faces, in
  order to be shorter. (§11.4)

### Expressive support (person → partner)

- **FR-012**: The system MUST accept both spoken and typed fragments, converging on a single
  internal representation. Typed input MUST NOT require grammatical correctness. (§12.1)
- **FR-013**: The system MUST NOT require the person to review, correct, or approve the captured
  fragment before it is used. Editing MUST be available on demand only. (§12.2)
- **FR-014**: Hypothesis generation MUST receive the fragment together with recent turns, confirmed
  session context, and personal context where enabled. (§7.4, §A5.3)
- **FR-015**: Hypothesis generation MUST be able to return **0 to 3** hypotheses. Returning zero
  MUST be handled as a normal result and MUST NOT be reported as an error. The response schema MUST
  permit an empty set. (§13.3, §15, §A5.3)
- **FR-016**: Each hypothesis MUST carry **evidence as pointers into the input** — a turn,
  a confirmed item, or a personal-context path, each with an excerpt. The model MUST NOT be asked
  to author free-form justification prose. (§A5.3)
- **FR-017**: Every evidence pointer MUST be verified locally against the session before display.
  A pointer that does not resolve, or whose excerpt is not present in the cited source, MUST be
  dropped. Dropping evidence MUST NOT by itself drop the hypothesis. (§A5.3)
- **FR-018**: Hypotheses MUST be marked as unconfirmed AI inference wherever displayed, and MUST NOT
  be rendered as the person's words. (Constitution VII)

### Non-intervention

- **FR-019**: Hypotheses MUST be held without being surfaced. The system MUST NOT automatically
  display them, and MUST NOT display any indicator, badge, banner, or notice that hypotheses are
  available. (§20.1, §20.2, §A2.5)
- **FR-020**: The partner view MUST be reachable only by an explicit human invocation of
  `[ことばのヒント]`. It MUST NOT be a persistent or background panel. (§A7.2)
- **FR-021**: Silence, pause, hesitation, or slow retrieval MUST NOT trigger any system action.
  (§20.3)
- **FR-022**: Code structure MUST make FR-019 enforceable rather than a matter of discipline:
  writing a hypothesis MUST have no render side effect, and the person's view MUST NOT read the
  hypothesis store. (§A2.5, §A7.1)

### Confirmation

- **FR-023**: When a hypothesis is checked with the person, the person's view MUST show **that
  single hypothesis** with `[はい]` / `[ちがう]`. It MUST NOT show a list of candidates. (§A7.3)
- **FR-024**: Only an explicit person-side confirmation may write to session context. (FR-003)
- **FR-025**: Nothing may be presented, sent, or spoken as the person's own statement without their
  explicit confirmation. (§5.5, Constitution VII)

### Meaning safety

- **FR-026**: A safety layer MUST sit between generation and display, on every path that produces
  language. (§17, §A6)
- **FR-027**: The safety layer MUST check: negation/affirmation, person/subject, time,
  number/quantity, action, medication, and consent/refusal. Polarity reversal is the severe case.
  (§17, §17.1)
- **FR-027a**: Each check MUST be applied only where it is semantically valid for what the output
  claims to be. A restatement (`op=simplify`) may not introduce a number or a day that was not
  said; an interpretation (`op=hypotheses`) exists to propose exactly that, so those checks do not
  apply to it. Polarity, action, medication and consent apply to both — inverting an instruction or
  asserting agreement is never legitimate. An unspecified mode MUST default to the stricter one.
  (§A6.1)
- **FR-027b**: For `interpret` mode, the grounding source MUST be everything the model was actually
  given for that request — the fragment, the recent turns, the confirmed session meaning, and the
  personal context when enabled. Checking against a narrower source would report a candidate
  grounded in confirmed context as invented. (§A6.1)
- **FR-028**: A candidate failing a safety check MUST be suppressed, never silently repaired. If all
  candidates are suppressed, the result MUST become the unknown/fallback path. (§17.2)
- **FR-029**: The safety check MUST NOT be performed by another call to the model that generated the
  candidate. Phase 1 checks are local and deterministic. (§A6.1)
- **FR-030**: Generated text MUST NOT add detail absent from the input or from confirmed context.
  (§17.3)

### Support requests and fallback

- **FR-031**: The system MUST provide distinguishable support requests for at least: say it again,
  say it more slowly, show it shorter, and that is not what I mean. These MUST NOT be collapsed into
  a single generic control. (§14, §2.6)
- **FR-032**: No control may state or imply that the person's speech was unintelligible, and
  communication failure MUST NOT be displayed repeatedly as a status. (§2.5, §14, §21.3)
- **FR-033**: When meaning cannot be determined, the fallback MUST be presented as an ordinary state
  and MUST offer an action the partner can take, not only actions requiring further effort from the
  person. (§15.3)

### Presentation and accessibility

- **FR-034**: The person's view MUST NOT display AI reasoning, confidence scores, evidence, or
  multiple simultaneous candidates. (§9.1)
- **FR-035**: The partner's view MAY display recent turns, confirmed context, hypotheses, verified
  evidence, and uncertainty, and MUST be glanceable rather than absorbing. (§9.2, §21.3)
- **FR-036**: Support controls MUST pair an icon with text. Meaning options SHOULD pair text with an
  icon or image **when the visual representation is unambiguous and useful**. The system MUST NOT
  attach a misleading or vague visual merely to avoid text-only presentation. (§22.1, §22.2, §22.3)
- **FR-037**: The prototype MUST be fully usable one-handed with the left hand. No primary action
  may require right-hand reach, and no interaction may require two hands or simultaneous touches.
  (§21.2)
- **FR-038**: The UI MUST be Japanese (ja-JP). No localization work is in scope.

### Research instrumentation

- **FR-039**: `?ai=off` MUST make no request to the project's Worker or LLM API, show no transcript,
  show no AI output, **and not start speech recognition at all**. (§24.1, §A8.1)
- **FR-040**: The receptive condition (`transcript only` vs `simplification`) and the context
  condition (`none` / `session` / `personal`) MUST be switchable without a rebuild. (§24.2, §24.3)
- **FR-041**: Speech-recognition and model-call latency MUST be measured and logged so it can be
  reviewed after a session.
- **FR-042**: Safety suppressions and evidence-verification failures MUST be logged for research.
  (§A5.3, §A6.2)

### Testability

- **FR-043**: The system MUST provide an **injected transcript path** that feeds text into the
  pipelines as though it came from recognition, so that context handling, gating, hypothesis
  generation, safety, views, and confirmation can be exercised deterministically without audio.
  See §6.

## 5. Non-functional requirements

- **NFR-001**: Static web application, no build step, no account, no login, servable by any static
  HTTP server.
- **NFR-002**: Mobile-first, portrait-first.
- **NFR-003**: No persistence of any kind in Phase 1 — no database, no `localStorage` memory, no
  cross-session state. (§5.4, §A1)
- **NFR-004**: The model API key MUST NOT be present in client code; calls are proxied. (§A1)
- **NFR-005**: Latency target for receptive simplification and hypothesis generation is a usability
  target for live conversation, not a production SLA. A concrete ceiling is undecided (§A11 item 6)
  and must be set before the user test.

## 6. Known QA constraint (carried over from 001)

The automated QA environment **cannot reliably exercise browser `SpeechRecognition`**. Task 001
returned `environment_issue` twice for this reason, and speech input was never black-box verified.

This is a standing constraint, not a one-off. Verification is therefore split:

| Layer | How it is verified |
|---|---|
| speech recognition itself | manual, on a real device, by a human |
| everything downstream of recognition | automated, via the injected transcript path (FR-043) |

FR-043 exists to make the second row possible. Context handling, the gate, chunk settling,
hypothesis generation, evidence verification, safety suppression, the non-intervention invariants,
both views, and confirmation MUST all be reachable and assertable without audio input.

A QA result of "could not test because the browser has no speech recognition" is **not** an
acceptable outcome for any requirement other than FR-007 and the recognition half of FR-012.

## 7. Success criteria

Framed as research questions the user test should be able to answer (§26), not adoption metrics.

- **SC-001**: The partner can state what the person meant more accurately with the product than in
  the `?ai=off` baseline.
- **SC-002**: The person can act on a complex partner utterance more successfully with
  simplification than with transcript alone.
- **SC-003**: When a breakdown occurs, the pair recovers — and does so at least as quickly as in the
  baseline.
- **SC-004**: The person reports that they, not the AI, were the one communicating.
- **SC-005**: Sessions contain stretches where the product produces nothing, and the pair does not
  experience this as a failure.
- **SC-006**: Wrong hypotheses are detected and discarded by the partner rather than adopted. Any
  observed instance of a partner acting on a wrong hypothesis is recorded as a finding.
- **SC-007**: Knowing the person's context (condition C2) helps the partner more than context-free
  hypotheses (C0).
- **SC-008**: Simplification does not remove information the person needed.
- **SC-009**: One-handed left-hand operation works on a real device without assistance.
- **SC-010**: The test yields a defensible list of what should be **removed** before anything is
  added.

**Primary metric is not candidate accuracy.** It is whether the two people reached shared meaning.

## 8. Out of scope

Per §27. Not in this prototype:

- accounts, login, persistence, cross-session memory, multi-device sync
- Personal Context Memory persisted across sessions (Phase 2, §18.2)
- Expression Memory (`expression → meaning`) — deferred pending validation that such mappings are
  stable within a person (§18.3)
- automatic intervention and its timing (§20.4)
- final-sentence rendering, TTS, rotated partner-facing output (Phase 2, §29.2)
- progressive clarification as the main flow — optional repair strategy only (§13.6)
- speaker diarization, background monitoring, offline operation
- image recognition, camera understanding, eye tracking
- phone-call integration
- a first-meeting / stranger partner UX (§4.5)
- localization beyond Japanese
- therapy, rehabilitation, clinician dashboard, diagnosis or severity assessment

## 9. Constitution compliance

| Principle | Assessment |
|---|---|
| I Accessibility-First | FR-013 removes a mandatory correction step; FR-023 removes candidate selection; FR-036 adds non-verbal presentation; FR-037 one-handed operation. Load on the person is reduced relative to 001. |
| II Bidirectional by Design | Both directions specified: US-1 receptive, US-2 expressive. |
| III Real-World Conversation Fitness | FR-008 keeps ungated utterances off the network path; FR-021 forbids interrupting pauses; NFR-005 flags the undecided latency ceiling as a blocker for the test. |
| IV Privacy and Dignity | FR-004–FR-006 and FR-039. Note §A5.4: contextual inference necessarily sends more off-device than 001 did — see open question OQ-3. |
| V Evidence Before Scope Expansion | Phase 2 items are excluded in §8, and Expression Memory is gated on external validation (§18.3). |
| VI Spec-and-Repo-Are-Truth | This spec derives from `main`; §0 states the authority order. |
| VII User Decides, AI Proposes | Satisfied under constitution 1.2.0: FR-018 marks hypotheses as unconfirmed inference, FR-025 gates anything presented as the person's statement. This spec depends on the 1.2.0 amendment; under 1.1.0 wording, FR-019/FR-020 would have been non-compliant. |
| VIII Bounded Inference | FR-015 bounds inference at one generation attempt yielding 0–3 candidates; FR-033 hands control back with an honest statement. |

## 10. Open questions

This is the question registry carried from `docs/architecture.md` §A11 plus spec-level items.
Current open questions are OQ-1, OQ-2, OQ-3, OQ-4, OQ-5, OQ-7, OQ-8, and OQ-10.
OQ-6, OQ-9, and OQ-11 are resolved; their decisions remain listed here for traceability.

- **OQ-1** Chunk boundary rule (§A3.2) — blocks FR-010.
- **OQ-2** Simplification gate thresholds (§A3.1) — blocks FR-008.
- **OQ-3** Participant consent text covering the expanded off-device scope (§A5.4) — blocks the user
  test, not the build.
- **OQ-4** Partner view presentation and physical handover of the device — blocks FR-020, FR-035.
- **OQ-5** Whether uncertainty is displayed at all, given verified evidence may serve better
  (§A11 item 4) — blocks FR-035.
- **OQ-6 RESOLVED 2026-09-24** Model and prompt per operation — `simplify` uses
  `gemini-3.5-flash-lite`; `hypotheses` retains `gemini-3.6-flash`. See research.md §2b.
- **OQ-7** Latency ceiling and behaviour on exceeding it (NFR-005) — blocks the user test.
- **OQ-8** Personal context schema depth and how a researcher authors it on-device (§A2.4) — blocks
  FR-005.
- **OQ-9 RESOLVED 2026-09-24** Icon and image asset source and licensing — local SVG assets,
  with no generic pictogram attached to arbitrary model-authored meaning options. See research.md §3.
- **OQ-10** Safety rule calibration and acceptable false-positive rate (§A6.3) — blocks FR-027.
  *Measured 2026-09-24: 43.6% → 0.0% after three design fixes (research.md §9). Small sample;
  re-measure on Stage 5 output.*
- **OQ-11 RESOLVED 2026-09-25** Exact grounding source for `interpret` safety (FR-027b):
  use a deterministic text projection of the exact `op=hypotheses` request fields actually sent —
  fragment, enabled short-term turns, enabled confirmed context, and enabled personal-context leaf
  values. Do not ground Safety on verified evidence; citation verification remains a separate later
  step. See research.md §9a and architecture.md §A6.1.
