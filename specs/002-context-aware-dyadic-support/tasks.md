---

description: "Task list for 002-context-aware-dyadic-support Phase 1"
---

# Tasks: Context-Aware Dyadic Support (Phase 1)

**Input**: Design documents from `specs/002-context-aware-dyadic-support/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Test tasks ARE included. Testability is a specified requirement here, not a preference —
FR-043 and spec.md §6 exist because the QA environment cannot run browser speech recognition, so
the injected transcript path is a product deliverable.

**Organization**: Grouped by user story. Note the honest exception in "Story independence" below:
US-3 is the failure path of US-2 and is not independently deliverable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable — different files, no dependency on an incomplete task
- **[Story]**: US1–US4 from spec.md §3
- Paths are repository-relative

## Path Conventions

Static web app, no build step. `app/` is the published artifact; `tests/` and `tools/` are never
deployed. Development serves the repository root; deployment serves `app/` alone (quickstart.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: module skeleton and test scaffolding. No behaviour yet.

- [x] T001 Create the module directory skeleton per plan.md: `app/core/`, `app/capture/`, `app/pipelines/`, `app/safety/checks/`, `app/evidence/`, `app/views/`, `app/icons/`, `app/context/`, `app/fixtures/`
- [x] T002 [P] Convert `app/index.html` to load `app/app.js` with `type="module"` and verify the page still renders
- [x] T003 [P] Create `tests/unit/` with a trivial passing `node --test` file to confirm the runner works with zero dependencies
- [x] T004 [P] Create `tests/browser/index.html` as an empty harness page that loads modules from `../../app/`
- [x] T005 [P] Create `app/context/sample-01.json` — a SYNTHETIC personal-context fixture per data-model.md §4 (strict JSON, no comments possible)
- [x] T005a [P] Create `app/context/README.md` warning that this directory is publicly served and may hold synthetic fixtures ONLY — no real participant name, place, appointment or utterance (FR-005). Mirror the same warning in `app/fixtures/README.md`
- [x] T006 [P] Add `tools/` to the repository with a README stating it is never deployed

**Checkpoint**: page loads as modules, `node --test` runs, directories exist.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ No user story work may begin until Stage 4 (safety skeleton) is complete.** Stage 4 precedes
every pipeline so that `main` never carries a display path that bypasses safety (plan.md Stage 4).

### Stage 0 — Model selection (resolves OQ-6)

**Do not execute these during task generation.** They are the first executable work items.

**API key handling**: `tools/` reads the key from the `GEMINI_API_KEY` environment variable **only**.
It is never written into a fixture, a prompt file, `research.md`, an evaluation result, `wrangler.toml`,
or any other file in the repository, and never printed to a log. This is separate from the deployed
Worker secret.

Fixtures are authored against [contracts/injected-transcript.md](./contracts/injected-transcript.md)
so they become the regression suite, not throwaway scripts.

- [x] T007 [P] Author `app/fixtures/f01-simple-question.json` — short simple utterance; `expect.gate: "skip"` (proves zero network calls)
- [x] T008 [P] Author `app/fixtures/f02-conditional-instruction.json` — condition plus two actions; annotate `expect.preserve: ["condition","action"]`
- [x] T009 [P] Author `app/fixtures/f03-multi-entity.json` — several times, numbers and a place in one utterance; annotate `expect.preserve: ["number","time"]`
- [x] T010 [P] Author `app/fixtures/f04-negation.json` — contains a negated instruction; annotate `expect.preserve: ["negation"]`
- [x] T011 [P] Author `app/fixtures/f05-fragment-answerable.json` — fragment answerable from the preceding turn
- [x] T012 [P] Author `app/fixtures/f06-fragment-unanswerable.json` — genuinely underdetermined fragment; `expect.hypotheses: {min: 0, max: 0}`. **The correct answer is zero**
- [x] T013 [P] Author `app/fixtures/f07-fragment-with-personal-context.json` — resolvable only with personal context
- [x] T014 [P] Author `app/fixtures/f08-anchoring-trap.json` — personal context that is plausible but WRONG for this fragment; annotate the reading that must NOT be produced
- [x] T015 [P] Draft `worker/prompts/simplify.txt` per contracts/worker-api.md "Prompt requirements" — preserve condition, negation, number, person, action; never add absent information; prefer dropping decorative wording over a decision-relevant element
- [x] T016 [P] Draft `worker/prompts/hypotheses.txt` — must state that returning ZERO hypotheses is a correct outcome when underdetermined (the single most important instruction), that every hypothesis must cite input actually used, that personal context is background and not an answer key, and that the fragment's literal words may be substitutions for adjacent ones
- [x] T017 Enumerate candidate models in `tools/list-models.mjs`: query the API's model-listing endpoint, filter to STABLE Flash-tier only, exclude preview/experimental/deprecated ids, cap at 3 per operation; write the resulting list into `specs/002-context-aware-dyadic-support/research.md` §2
- [x] T018 Build `tools/model-eval.mjs` — a standalone harness that reads `app/fixtures/*.json` and `worker/prompts/*`, calls each candidate model directly, and scores against the fixtures' pre-written `expect` annotations. It MUST NOT import from `app/`; it is an evaluation tool, not app code
- [x] T018a Assign fixture turn ids deterministically in `tools/model-eval.mjs` (`turns[0] → t1`, `turns[1] → t2`, …) and build the request in the id-bearing shape from contracts/worker-api.md, so evidence pointers are resolvable and a rerun produces byte-identical requests
- [x] T018b Persist every raw model response under a gitignored run directory, keyed by model × fixture × attempt, so the rubric pass in T020 reads actual output rather than a summary
- [x] T019 Implement simplify scoring in `tools/model-eval.mjs`: latency (median and worst of N), meaning preservation against `expect.preserve`, over-reduction (any annotated decision-relevant element dropped = failure), schema-valid response rate
- [x] T020 Implement hypotheses scoring in `tools/model-eval.mjs`, **split by what can be judged mechanically**:
  - **automated**: 0–3 schema adherence, `result` correctness, restraint on f06 (any hypothesis = failure, never a near-miss), evidence-pointer validity against the deterministic fixture ids, latency
  - **rubric, over raw output**: meaning preservation, polarity reversal, and anchoring on f08. `mustNotProduce` substring matching is a *screen*, not a verdict — 「薬を服用してください」 evades the f04 list and 「10時の通院予定」 evades f08's while meaning exactly what the fixture forbids. The harness MUST therefore persist every raw response for review against a written rubric. At 3 candidates × 8 fixtures this is a tractable read, and it is the only way the two fixtures that carry the most weight are scored on meaning rather than on wording
- [x] T021 Run the simplify evaluation and write the results table to `research.md` §2
- [x] T022 Run the hypotheses evaluation and write the results table to `research.md` §2
- [x] T023 Apply the decision rule from research.md §2 and record a one-line decision PER OPERATION in `research.md` §2 — including "baseline retained" as a valid, recorded outcome
- [x] T024 Add per-operation model configuration to `worker/wrangler.toml` (e.g. `SIMPLIFY_MODEL`, `HYPOTHESES_MODEL`) **without touching the live legacy path**. The deployed Worker still serves the old `{text} → {choices}` contract until T063/T078 land, so `GEMINI_MODEL` and the existing handler MUST keep working; removal of the constant belongs in T063/T078
- [x] T025 Record the measured latencies in `research.md` §7 as the input to setting the OQ-7 ceiling

**Checkpoint**: OQ-6 closed with evidence. Stage 5 unblocked.

### Stage 1 — Context store

- [x] T026 [P] Implement `app/core/session.js` — `Session`, `Turn` ring buffer with `MAX_TURNS = 6`, per data-model.md §1–§2
- [x] T027 [P] Implement `app/core/personal-context.js` — read-only loader, in-memory only, no setter and no storage API call anywhere in the module (data-model.md §4)
- [x] T028 Implement the single-writer `confirmSelected()` mutator in `app/core/session.js` as the ONLY path that appends to `confirmed`. It accepts no UI-supplied text and builds `Confirmed {text, basis}` from the trusted snapshot passed by `app/views/partner.js`, so `session.js` never imports the hint store (FR-003, data-model.md §3, §8)
- [x] T029 Implement `Config` parsing and freezing in `app/core/session.js` per data-model.md §6
- [x] T030 [P] Write `tests/unit/session.test.js` — ring buffer bounds at MAX_TURNS; eviction is oldest-first; interim text never creates a Turn; `confirmed` is unwritable except through `confirmSelected`; `session.js` imports nothing from `core/hint-store.js`; `config` is frozen after start
- [x] T031 [P] Write `tests/unit/personal-context.test.js` — no mutation path exists; grep-level assertion that the module references no `localStorage`/`indexedDB`/`document.cookie`; `?config=` resolves only under `app/context/`
- [x] T032 Wire `app/app.js` to `app/core/session.js` **alongside** the existing flat `state` object. **Do NOT delete `app/app.js:4` yet** — ~100 references to `state.*` remain in the superseded expressive flow, which is not removed until T086/T087. Deleting it here would break the running app and contradict plan.md's "app stays runnable throughout"

### Stage 2 — Injected transcript path (FR-043)

- [x] T033 Implement `app/capture/inject.js` with `turn()`, `interim()`, `fixture()`, `reset()` per contracts/injected-transcript.md
- [x] T034 Gate `inject.js` behind `?inject=1` or the test page so it is unreachable in a participant session (contracts/injected-transcript.md "Availability")
- [x] T035 Build the fixture player in `app/capture/inject.js` — load `app/fixtures/<name>.json` and play turns in order
- [x] T036 [P] Write `tests/unit/inject.test.js` — an injected turn is indistinguishable from an ASR turn once inside `session`; no pipeline branches on `source: 'injected'`
- [x] T037 Wire `tests/browser/index.html` to drive `app/capture/inject.js` so downstream stages become testable without a microphone

**Checkpoint**: fixtures can be played into the system with no audio. Everything after this is testable.

### Stage 3 — Session and ASR

- [x] T038 Extract both recognition modes into `app/capture/asr.js` from `app/app.js:104-117,139-152` — continuous partner mode and one-shot expressive mode, `ja-JP`
- [x] T039 Carry the generation counters (`app/app.js:66,93,110,123,142`) into `app/capture/asr.js` as the stale-response guard, preserving the existing cancellation semantics
- [x] T040 Move session start/stop and state display from `app/app.js:15,104,118` into `app/capture/asr.js` + `app/core/session.js`
- [x] T041 Carry pause/resume partner listening (`app/app.js:17,18`) into `app/capture/asr.js`
- [x] T042 [P] Carry the non-blaming ASR error wording (`app/app.js:16`) into `app/capture/asr.js` unchanged
- [x] T043 [P] Write `tests/unit/asr-state.test.js` — start/stop transitions; a stale generation result is discarded; **`?ai=off` never constructs a recognition object** (FR-039)

### Stage 4 — Safety layer skeleton

**Built before any pipeline that displays model output.** Stub individual checks if needed, but the
skeleton must exist so no display path is ever wired around it.

- [x] T044 Implement `app/safety/index.js` exporting the pure function `check(candidateText, sourceText, context) → {ok, violations[]}` per data-model.md §9
- [x] T045 [P] Implement `app/safety/checks/polarity.js` — added or dropped negation is a violation
- [x] T046 [P] Implement `app/safety/checks/person.js` — invented or swapped subject
- [x] T047 [P] Implement `app/safety/checks/time.js` — changed or invented temporal expression
- [x] T048 [P] Implement `app/safety/checks/number.js` — changed or invented numeral/counter
- [x] T049 [P] Implement `app/safety/checks/action.js` — inverted action class (stop↔continue, go↔cancel)
- [x] T050 [P] Implement `app/safety/checks/medication.js` — drug name or dose absent from source
- [x] T051 [P] Implement `app/safety/checks/consent.js` — agreement vs declination inversion
- [x] T052 Implement suppression semantics in `app/safety/index.js` — a failing candidate is suppressed and NEVER rewritten; if all candidates fail the result becomes `unknown` (FR-028)
- [x] T053 [P] Write `tests/unit/safety-polarity.test.js` — `薬 飲まない` → any output asserting `薬を飲む` is a violation; dropped negation is a violation
- [x] T054 [P] Write `tests/unit/safety-checks.test.js` — invented number, swapped subject, changed time, inverted action, invented medication each violate
- [x] T055 [P] Write `tests/unit/safety-contract.test.js` — `check()` is pure, makes no network call (FR-029), and never returns a modified candidate
- [x] T056 Record the measured false-positive rate against the fixtures in `research.md` §9 (OQ-10)

**Checkpoint**: Foundation complete. User story work may begin.

---

## Phase 3: User Story 1 — Partner says something complicated (P1) 🎯 MVP

**Goal**: partner speech is transcribed, and *only when hard to process* presented in a simplified,
structured form that never rewrites itself.

**Independent Test**: play `f01` (must gate out, zero network calls) and `f02`/`f03` (must gate in,
settle, never silently rewrite) through `app/capture/inject.js` with no microphone.

### Tests for User Story 1

- [x] T057 [P] [US1] Write `tests/unit/gate.test.js` — `f01` gates out; `f02` and `f03` gate in; each gate signal is independently triggerable
- [x] T058 [P] [US1] Write `tests/unit/chunker.test.js` — chunk boundary rule per research.md §4; a chunk once settled is never re-emitted
- [x] T059 [US1] Write `tests/unit/receptive.test.js` — gated-out utterance produces **zero fetch calls** (asserts the call COUNT via an injectable transport, not merely the absence of output); a re-emitted growing turn is marked as revising its predecessor (FR-010)
  - **Changed from the planned `tests/browser/receptive.test.html`.** `app/pipelines/receptive.js` turned out DOM-free — it takes a turn and returns a result — so the pipeline half needs no document and is cheaper and more precise to assert in node. What genuinely needs a browser is the *rendered* behaviour, which did not exist when this was written; that half is now T059a, after the renderer that owns it.
- [x] T059a [US1] Write `tests/browser/receptive.test.html` — the RENDERED half of FR-010: settled content in the main area is never silently replaced, a revision is visibly marked, and interim text reaches only the transcript strip. Depends on T064/T065; drive it through `app/capture/inject.js`
  - **Written as `tests/browser/receptive.test.js`, not `.test.html`.** The harness from T037 runs suites as ES modules listed in `tests/browser/runner.js` and exporting `register(test, inject)`, from the single page `tests/browser/index.html`. A standalone `.test.html` would be a second harness with its own runner and its own ways to fail. Running in a real document was the requirement; the extension was not.
  - **10/10 passing**, verified in Chrome against the repo-root dev server. Two failures found real defects while it was being written, both now fixed: `render()` was rebuilding every settled block (identical text, but discarding scroll position and any tapped option), and the `consent` safety check suppressed 「いつがいいですか」 on the `いいです` inside it (research.md §9).

### Implementation for User Story 1

- [x] T060 [P] [US1] Implement `app/pipelines/gate.js` — length, multiple instructions, conditional **and contrastive** markers, embedded question, and **≥2 entities of the SAME KIND**
  - Two departures from the planned thresholds, both forced by the fixtures. Counting entities of *any* kind gated in 「明日、病院行く？」 (a day and a place), an ordinary question: what is hard is holding ALTERNATIVES, so the signal now counts the largest same-kind group. Contrastive markers (〜ですが / ただし / 一方で) were added because `f04` is short, has no conditional, and carries one instruction pair — what makes it hard is a permission and a prohibition in one utterance, the shape where dropping half inverts a medication decision. This resolves the question left open in research.md §5.
- [x] T061 [P] [US1] Implement `app/pipelines/chunker.js` per research.md §4 (one ASR `isFinal` = one chunk, provisional)
- [x] T062 [US1] Implement `app/pipelines/receptive.js` — gate → simplify → safety → settle; **the gate MUST run before any fetch** (FR-008)
- [x] T063 [US1] Add `op: "simplify"` to `worker/index.js` per contracts/worker-api.md §"simplify", using `worker/prompts/simplify.txt` and the model chosen in T023
- [x] T064 [US1] Implement the settled-region renderer in `app/views/person.js` — settled chunks only; interim text goes exclusively to the transcript strip (FR-010, §A3.2)
  - The view subscribes to `capture/intake.js` itself rather than being fed by `app.js`, so which surface each kind of text reaches is the view's decision and is assertable in a document. `tests/unit/single-intake.test.js` was updated to pin the painter in `views/person.js`; the single-door invariant is unchanged.
  - Painting is incremental: a settled block's element is created once and afterwards only ever gains a marker. See §A3.2 "As built" for why a rebuild is not equivalent.
- [x] T065 [US1] Implement revision marking in `app/views/person.js` — when a later chunk revises settled content, mark the change rather than swapping silently
  - A revision **adds** a block. The revised chunk stays on screen, dimmed and labelled 「あとで なおしました」; the correction arrives below it as 「なおしたことば」. Replacing the text would remove the thing the requirement says to mark.
- [x] T066 [US1] Wire `[短く]` in `app/views/person.js` to force simplification of the most recent partner turn via `app/pipelines/receptive.js`, bypassing the gate result (FR-009)
  - Rendered in a new `#supportRow` in `app/index.html`, deliberately OUTSIDE the main area so the superseded expressive flow cannot wipe it out. The other three support requests (もう一回 / ゆっくり / ちがう) remain T095.
- [x] T067 [US1] Delete `simplifyPartner()` (`app/app.js:56-65`), `renderPartnerMeaning`/`showPartnerResult` (`app/app.js:67-83`), and the interim→main-area coupling at `app/app.js:113`
  - `showChoices` and `setPartnerTranscript` went with them — both had no callers left, and `views/person.js` builds options with the DOM API rather than an `innerHTML` string because it must also mark the chosen one and must never inject model output as markup. `showDontUnderstand` is now unreachable and is left for T097, which owns it.
- [x] T068 [US1] Fold the old open-question answer-candidate branch into `op=simplify`'s optional `options` field in `worker/prompts/simplify.txt` and `app/pipelines/receptive.js`; delete the separate path from `app/app.js`
  - `worker/prompts/simplify.txt` now states explicitly that an open (5W1H) question must get concrete options rather than being forced into はい／いいえ — the one thing the deleted path did that the prompt did not already say.
  - ⚠️ **The deployed Worker still predates T063**: it answers `{op:"simplify"}` with the legacy `{choices}` shape (verified 2026-09-25 from the running app). The pipeline therefore returns `skipped: 'no-result'` and the person keeps the raw transcript — correct behaviour, but the receptive direction does not work against production until the Worker is redeployed. Not a code task; needs `wrangler deploy` with the account that holds the secret.
- [x] T069 [US1] Confirm OQ-1 and OQ-2 against the fixtures and record the confirmed values in `research.md` §4 and §5
  - Both values **retained**; both questions **still open**, recorded as such in research.md §4 and §5. Fixture agreement cannot close either: injected fixtures make one turn one final by construction, so OQ-1's doubt (fragmented finals) is unreachable from the test path, and the gate thresholds were tuned against these same fixtures. Both need a rehearsal with real recognition (T110, T111).

**Checkpoint**: US-1 works end to end from injected fixtures. Receptive direction is demonstrable.

---

## Phase 4: User Story 2 — Partner cannot understand the person (P1)

**Goal**: the person's fragment becomes hypotheses the partner can use — held silently until a human
asks, marked as AI inference, evidenced by verified quotes, and confirmed one at a time.

**Independent Test**: play `f05` and `f07`; assert that after generation **nothing renders**, then
invoke `[ことばのヒント]` and assert the partner view appears with verified evidence.

### Tests for User Story 2

- [ ] T070 [P] [US2] Write `tests/unit/hint-store.test.js` — writing a hypothesis has no render side effect; state transitions per data-model.md §5; generation counter discards stale responses
- [ ] T071 [P] [US2] Write `tests/unit/evidence-verify.test.js` — a pointer to a non-existent turn is dropped while the hypothesis SURVIVES; an excerpt absent from the cited turn is dropped; a reference to an evicted turn is unverifiable, not an error
- [ ] T072 [P] [US2] Write `tests/unit/import-invariant.test.js` — grep over import statements asserting that `getHintSnapshot` is imported **only** by `app/views/partner.js`, and that `app/views/person.js` imports **nothing** from `app/core/hint-store.js`. `app/pipelines/expressive.js` importing the writers is expected and must NOT fail the test (FR-022, data-model.md §5.1)
- [ ] T073 [US2] Write `tests/browser/non-intervention.test.html` — after hypotheses are generated, assert **zero DOM mutation** and that no indicator/badge/banner element exists anywhere in the document (FR-019)
- [ ] T074 [US2] Write `tests/browser/confirmation.test.html` — the person's view shows exactly ONE hypothesis with はい/ちがう and never a list (FR-023); only はい writes to `session.confirmed` (FR-024)

### Implementation for User Story 2

- [ ] T075 [P] [US2] Implement `app/core/hint-store.js` as pure data with no render side effect, exporting writers (`setHypotheses`, `setUnknown`, `clearHints`) and the reader (`getHintSnapshot`) as **separate surfaces** per data-model.md §5.1
- [ ] T076 [P] [US2] Implement `app/evidence/verify.js` — verify `turn`/`confirmed`/`personalContext` pointers against the live session; drop the pointer, keep the hypothesis (FR-017, data-model.md §7)
- [ ] T077 [US2] Implement `app/pipelines/expressive.js` — fragment → hypotheses request → safety → evidence verification → `setHypotheses()` / `setUnknown()`. It imports the writers only, never `getHintSnapshot`. **Nothing renders at any step**
- [ ] T078 [US2] Add `op: "hypotheses"` to `worker/index.js` per contracts/worker-api.md §"hypotheses", using `worker/prompts/hypotheses.txt` and the model chosen in T023
- [ ] T079 [US2] Set the `hypotheses` response schema in `worker/index.js` to `minItems: 0, maxItems: 3` and support `result: "unknown"` — the old `minItems: 2` made zero candidates unrepresentable (FR-015)
- [ ] T080 [US2] Implement fragment capture in `app/capture/asr.js` WITHOUT a mandatory review step; make editing reachable on demand only (FR-013)
- [ ] T081 [US2] Implement `app/views/partner.js` — the sole caller of `getHintSnapshot`; renders 0–3 hypotheses, each marked as unconfirmed AI inference, each with verified excerpts quoted from the conversation (FR-018, §A7.2)
- [ ] T082 [US2] Implement `[ことばのヒント]` in `app/views/person.js` as the ONLY entry point to `app/views/partner.js`, with no persistent panel and no availability indicator (FR-019, FR-020)
- [ ] T083 [US2] Implement the two-structure confirmation flow per data-model.md §8: `SelectedConfirmation {hypothesisId, text, basis[]}` held **internally** by `app/views/partner.js` (basis derived from the hypothesis's verified evidence), and `ConfirmationRequest {hypothesisId, text}` as the only thing `app/views/person.js` sees
- [ ] T084 [US2] Implement the single-hypothesis confirmation surface in `app/views/person.js` with `[はい]`/`[ちがう]` (FR-023, §A7.3)
- [ ] T085 [US2] Wire `[はい]` in `app/views/person.js` to `confirmSelected()` in `app/core/session.js` as the only write path into `session.confirmed`. `confirmSelected()` takes **no arguments from the UI** — it commits the partner-side snapshot, so `session.js` never reads the hint store and `basis` is not lost (FR-024, data-model.md §8)
- [ ] T086 [US2] Delete the clarification machinery from `app/app.js`: `ambiguities` (5-9), `nextClarification`/`showClarification`/`noneOfThese`/`choicesFor` (183-186), `contentChoicesFor`/`contentClause`/`buildMessage`/`timeWord`/`topicWord`/`personMention` (198-228), `directCandidates`/`showDirectCandidates` (229-239)
- [ ] T087 [US2] Delete `modeA` (`app/app.js:3`), the mandatory `renderFragmentForm` on capture (`app/app.js:163-170`), and — now that T086 removed its last readers — the flat `state` object at `app/app.js:4` (deferred here from T032)
- [ ] T088 [US2] Delete `showConfirm` (`app/app.js:240`), `showOutput`/`speakConfirmed` (`app/app.js:244-246`) and the rotation CSS (`app/styles.css:49-50`) — Phase 2 features
- [ ] T089 [US2] Migrate shared DOM helpers from `app/app.js:20-23,173-180` into `app/views/dom.js`

**Checkpoint**: US-1 and US-2 both work. The product thesis is demonstrable — the system understands
something and does not interrupt.

---

## Phase 5: User Story 3 — Meaning cannot be determined (P1)

**Goal**: zero hypotheses is an ordinary outcome, and recovery does not put the whole burden on the
person.

**Independent Test**: play `f06`; assert zero hypotheses handled as a normal result, the partner view
states the meaning is not yet clear, and a partner-side action is offered.

> **Story independence — honest note**: US-3 is the failure path of US-2, not a separate feature. It
> cannot be delivered before US-2 and shares `expressive.js`, `hint-store.js` and `partner.js`.
> It is a separate phase because its acceptance conditions are separately assertable and are the
> ones most likely to be skipped.

### Tests for User Story 3

- [ ] T090 [P] [US3] Write `tests/browser/unknown-path.test.html` — `f06` yields zero hypotheses, `hintStore.state === 'unknown'`, no error is surfaced (FR-015)
- [ ] T091 [P] [US3] Write `tests/browser/all-suppressed.test.html` — when safety suppresses every candidate the result becomes `unknown` and the fallback renders, never a blank screen (FR-028)
- [ ] T092 [P] [US3] Write `tests/unit/support-requests.test.js` — the four support requests are independently dispatchable and distinguishable (FR-031)

### Implementation for User Story 3

- [ ] T093 [US3] Implement the `unknown` rendering in `app/views/partner.js` — state plainly that meaning is not yet clear (FR-015)
- [ ] T094 [US3] Implement the fallback in `app/views/partner.js` offering at least one PARTNER-side action (change the question), not only person-side retry (FR-033)
- [ ] T095 [P] [US3] Implement the four support requests in `app/views/person.js` — もう一回 / ゆっくり / 短く / ちがう, kept distinguishable and never collapsed into one generic control (FR-031, §14)
- [ ] T096 [US3] Audit every UI string in `app/views/person.js`, `app/views/partner.js` and `app/index.html`; remove any that states or implies the person's speech was not understood, and ensure failure is not displayed as a persistent status (FR-032)
- [ ] T097 [US3] Delete `showDontUnderstand` and the 「わかりません」 control (`app/app.js:70,84-90`), 「どれも違います」 in its old role (`app/app.js:177,185`), and the old `showFallback` wording (`app/app.js:241`)

**Checkpoint**: the uncertainty path is as well built as the success path.

---

## Phase 6: User Story 4 — Research conditions (P1)

**Goal**: the conditions the user test depends on actually work, especially the baseline.

**Independent Test**: run each condition and assert the request body and rendered surface directly.

### Tests for User Story 4

- [ ] T098 [P] [US4] Write `tests/browser/baseline.test.html` — `?ai=off` makes zero Worker calls, renders no transcript, renders no AI output, and **constructs no recognition object** (FR-039)
- [ ] T099 [P] [US4] Write `tests/browser/context-conditions.test.html` — assert the exact `hypotheses` request body for `ctx=none|session|personal`; `none` contains `fragment` and nothing else (FR-040)

### Implementation for User Story 4

- [ ] T100 [US4] Implement `?ai=off` in `app/app.js` + `app/core/session.js` covering all four conjuncts of the A0 invariant (data-model.md §6)
- [ ] T101 [US4] Implement `?receptive=off` in `app/pipelines/receptive.js` — transcript shown, simplification skipped
- [ ] T102 [US4] Enforce `ctx` at REQUEST CONSTRUCTION in `app/pipelines/expressive.js`, not by ignoring extra data downstream, so the body is assertable (data-model.md §6)
- [ ] T103 [US4] Implement `?config=<id>` loading from `app/context/` (synthetic only) and the on-device researcher load path for real context (FR-005, §A2.4)
- [ ] T104 [P] [US4] Carry `logLatency` (`app/app.js:14`) into a shared helper and instrument both Worker operations (FR-041)
- [ ] T105 [P] [US4] Log safety suppressions from `app/safety/index.js` and evidence-verification failures from `app/evidence/verify.js` (FR-042)

**Checkpoint**: the user test can be run, pending OQ-3 and OQ-7.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T106 [P] Extract the existing operational icons (`app/app.js:12`) into individual SVG files under `app/icons/` — local only, no CDN, no runtime external asset (research.md §3)
- [ ] T107 [P] Author the four support-request icons in `app/icons/` and pair each with text (FR-036)
- [ ] T108 Audit meaning options rendered by `app/views/person.js`: attach an icon from `app/icons/` ONLY where the representation is unambiguous and useful; attach none elsewhere (FR-036). Do not build a meaning-image library
- [ ] T109 Verify one-handed left-thumb reach for every primary action on a real device; ensure no primary action sits in right-thumb-only territory (FR-037) — **manual, device required**
- [ ] T110 Manual device check: recognition runs on iOS Safari and Android Chrome; continuous mode survives natural pauses; permission denial degrades to the typed path — **manual, device required**
- [ ] T111 Manual device check: the partner view is glanceable and does not pull attention from the person (§25.2 observation, surfaced early because it may invalidate the design) — **manual, device required**
- [ ] T112 [P] Update `docs/architecture.md` with any architectural decision made during implementation that it does not already record (Constitution VI)
- [ ] T113 [P] Update `README` (or create one) documenting the two serving modes — repo root for development, `app/` for deployment
- [ ] T114 Delete any remaining dead code from `app/app.js`; confirm `app.js` contains wiring only, no logic
- [ ] T115 Verify `app/context/` and `app/fixtures/` contain no real participant data (FR-005)
- [ ] T116 Run the full quickstart.md validation, including all twelve "checks that matter most"
- [ ] T117 Close OQ-3 (participant consent text covering the expanded off-device scope) — **blocks the user test, not the build**
- [ ] T118 Close OQ-7 (latency ceiling and over-ceiling behaviour) using the T025 measurements — **blocks the user test, not the build**
- [ ] T119 Resolve OQ-4 (partner view presentation and device handover) and OQ-5 (whether uncertainty is displayed at all) from Stage 7 observations; record in `research.md`
- [ ] T120 Revisit OQ-8 (personal context schema) after a researcher attempts to author one on-device before a rehearsal; record in `research.md` §8

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup**: no dependencies
- **Phase 2 Foundational**: blocks all user stories. Internally:
  - **Stage 0 (T007–T025)** runs in parallel with Stages 1–3; it blocks only T063 and T078 (the Worker ops)
  - **Stage 1 (T026–T032)** blocks everything downstream — the context store is read by all pipelines
  - **Stage 2 (T033–T037)** blocks all automated testing from Phase 3 onward
  - **Stage 3 (T038–T043)** depends on Stage 1
  - **Stage 4 (T044–T056)** depends on nothing but MUST precede Phase 3
- **Phase 3 (US1)**: after Stage 4. Needs T023 (model decision) for T063
- **Phase 4 (US2)**: after Stage 4. Needs T023 for T078
- **Phase 5 (US3)**: **after Phase 4** — not independent, see the note in Phase 5
- **Phase 6 (US4)**: after Phase 4 (needs a request body to assert)
- **Phase 7 Polish**: after the stories it touches

### Story independence

| Story | Independent? |
|---|---|
| US-1 receptive | **Yes** — deliverable and demonstrable alone after Phase 2 |
| US-2 expressive | **Yes** — deliverable alone after Phase 2 |
| US-3 uncertainty | **No** — the failure path of US-2; shares its modules |
| US-4 research conditions | **Partly** — the A0 baseline is independent; the `ctx` conditions need US-2 |

Stating this rather than claiming four independent stories: US-3 has no meaning without US-2, and
pretending otherwise would produce a plan that cannot be executed as written.

### Parallel opportunities

- T007–T016 (all eight fixtures and both prompts) are fully parallel — the largest parallel block
- T045–T051 (seven safety checks) are fully parallel, different files
- T026/T027, T030/T031 pairs
- Stage 0 runs alongside Stages 1–3 entirely
- Once Phase 2 completes, US-1 and US-2 can proceed in parallel by different people

---

## Parallel Example: Stage 0 fixtures and prompts

```bash
# Ten independent files, no shared state:
Task: "Author app/fixtures/f01-simple-question.json"
Task: "Author app/fixtures/f02-conditional-instruction.json"
Task: "Author app/fixtures/f03-multi-entity.json"
Task: "Author app/fixtures/f04-negation.json"
Task: "Author app/fixtures/f05-fragment-answerable.json"
Task: "Author app/fixtures/f06-fragment-unanswerable.json"
Task: "Author app/fixtures/f07-fragment-with-personal-context.json"
Task: "Author app/fixtures/f08-anchoring-trap.json"
Task: "Draft worker/prompts/simplify.txt"
Task: "Draft worker/prompts/hypotheses.txt"
```

## Parallel Example: Stage 4 safety checks

```bash
Task: "Implement app/safety/checks/polarity.js"
Task: "Implement app/safety/checks/person.js"
Task: "Implement app/safety/checks/time.js"
Task: "Implement app/safety/checks/number.js"
Task: "Implement app/safety/checks/action.js"
Task: "Implement app/safety/checks/medication.js"
Task: "Implement app/safety/checks/consent.js"
```

---

## Implementation Strategy

### MVP scope

**Phase 1 + Phase 2 + Phase 3 (US-1).** That yields a working receptive aid: partner speech
transcribed, simplified only when it needs to be, settled and never rewritten, safety-checked.

It is a defensible stopping point — it exercises one full direction of the product and answers
SC-002 and SC-008 on its own.

### Incremental delivery

1. Phases 1–2 → foundation, model decision recorded, everything testable without audio
2. + Phase 3 → receptive direction (**MVP**) → demo
3. + Phase 4 → expressive direction; the non-intervention thesis becomes demonstrable
4. + Phase 5 → the uncertainty path is as good as the success path
5. + Phase 6 → the user test becomes runnable
6. + Phase 7 → device verification, icons, open questions closed

The app stays runnable throughout. The superseded flow is removed stage by stage as its replacement
lands (plan.md "Migration approach"), never up front.

### Order constraints that are not negotiable

- **Stage 4 before Phase 3.** Building a display path first creates an interval where model output
  reaches the screen unchecked, and that interval persists because it works.
- **Stage 2 before Phase 3.** Without the injected path nothing after Stage 3 is testable at all.
- **T023 before T063 and T078.** Writing the Worker ops before the model decision means the decision
  gets retrofitted to justify whatever was built.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task
- Deletion tasks are deliberately interleaved with their replacements, not batched at the end — the
  app must stay runnable at every commit
- Three tasks are **manual and device-bound** (T109, T110, T111) and cannot be satisfied by the
  automated suite being green
- Two tasks (T117, T118) block the **user test**, not the build, and must not surface late
- Stage 0 is the first executable work; it has not been run
