# Fix request — 2026-09-18 (pre-user-test bug fix / UI pass)

This is a bug-fix and UI/UX correction pass before today's user test with an aphasia participant.
It is NOT a new-feature request. Keep the existing Product OS artifacts and spec intact; make the
minimum change needed to satisfy the items below. Do not do a UI redesign or unrelated refactor.

## Most important constraint

The primary user is a person with aphasia. Primary/high-frequency operable controls must NOT be
placed only at the right edge of the screen. Use one of:

- left-aligned
- left-to-center, wide button
- full width
- bottom-center

Do not mechanically left-align everything either — preserve:
- ease of operation
- mis-tap prevention
- visual hierarchy
- consistency

The bottom 78×78px circular "話す" (Speak) button stays centered as-is. The goal is not "push
everything left" — it is "no primary action that exists only at the right edge."

---

## P0 — real bugs

### 1. Subject/person is dropped from the generated message (critical)

Fragment `娘　明日　病院` (daughter / tomorrow / hospital), run through the clarification flow,
currently produces `明日、病院に行きたいです。` — the message is written in first person even
though the fragment explicitly named a third party (the daughter). This mishandles the exact
canonical worked example in `docs/product.md` §12.4, where the correct final message attributes the
action to the daughter, not the user.

Root cause: the `ambiguities` array (app/app.js) has no person/"who" dimension, and
`buildMessage()` / `contentClause()` never read person words out of the fragment.

**Required fix:**
- Preserve any person reference explicit in the fragment (私/me, 娘/daughter, 息子/son, 家族/family,
  or other explicit third party) and reflect it as the subject of the final message. Do not silently
  convert a third-party subject to "私" (I).
- What matters is not "produce a natural sentence" — it is "never change the meaning the user
  input/selected." Do not let the AI add an unsupported subject.
- It is acceptable to add a "who is this about" ambiguity step if needed, but keep it consistent with
  the existing `time → topic → content` fixed priority order from `docs/product.md` §12.3 — don't
  break that ordering pointlessly. If there's a genuine spec conflict, resolve it and write down how in
  your handoff notes rather than picking silently.
- Acceptance: the final candidate generated from `娘 明日 病院` must not default to the user as
  subject. When the person is ambiguous, ask rather than guess.

### 2. Mode A "back" doesn't actually go back

In Mode A (fragment → 3 complete-sentence candidates → pick one → confirm), pressing "もどる" on the
confirm screen re-renders the same confirm screen instead of returning to the 3-candidate picker.

Root cause: Mode A never pushes onto `clarificationHistory`, but confirm's "もどる" handler depends on
popping `clarificationHistory`.

**Required fix:** In Mode A, "もどる" from confirm must return to the previous 3-candidate screen. No
need to force this through the same `clarificationHistory` structure Mode B uses — keep "もどる"
semantically consistent ("go back to the previous decision screen") without necessarily unifying the
underlying state mechanism.

Acceptance: fragment → 3 candidates → pick one → confirm → もどる → same 3-candidate screen again.

### 3. Don't substitute a fake user utterance on speech-recognition failure

When expressive speech recognition errors out, the code currently calls
`finishExpressive('娘 明日 病院')` — a hardcoded demo sentence — and treats it exactly as if the user
had spoken it. Presenting words the user never said as their own utterance is specifically dangerous
in an aphasia-communication context.

**Required fix:** On recognition failure (`onerror`) or when `SpeechRecognition`/
`webkitSpeechRecognition` isn't available, do NOT auto-fill a demo fragment into the real user flow.
Instead return control to the user: "聞き取れませんでした" / "もう一度話す" / "文字で入力" or
equivalent. If a demo fallback is useful for some other purpose, gate it clearly behind a
researcher-only mode, never the normal participant flow.

### 4. `reset()` doesn't stop `expressiveRecognition`

`reset()` stops `partnerRecognition` but not `expressiveRecognition`. If the user is recording
(CAPTURING_USER) and hits "最初から" (start over), the UI resets to IDLE but recognition may keep
running in the background, and its late callback could then mutate state/UI that has already moved
on.

**Required fix:** `reset()` must stop any in-flight `expressiveRecognition` (and any other active
speech I/O — recognition, `speechSynthesis`) and make sure stale callbacks from a stopped session
can't write into post-reset state/UI.

---

## P1 — mobile UI / accessibility

### 5. Move "相手の話を聞く" off the right edge

Currently right-aligned in the partner zone (via `.button { margin-left:auto }`). This is a primary
action and must not live only at the right edge.

Suggested direction: stack the partner zone in two rows —

```
相手のことば　停止中
[ 🎤 相手の話を聞く ]
```

with the button left/left-to-center and reasonably wide (reachable one-handed). Do NOT make this
button the same round shape as the bottom "話す" mic — partner listening is a continuous session,
the bottom mic is a single-utterance action; keep them visually distinct.

### 6. Un-right-align "このことばで進む"

In `renderFragmentForm()`, this primary CTA is right-aligned via `.button { margin-left:auto }`,
inconsistent with primary-action placement elsewhere.

**Required fix:** make it full width (`width:100%; margin-left:0`), with "やめる" as a clearly
secondary action below it with enough spacing to read as a lower-priority action.

### 7. Don't let larger text sizes make the app unusable

`overflow:hidden` is applied at several levels (`html,body`, `.app-shell`, `.main-area`, and
`.partner-zone` with a fixed `max-height`), which can hide content/controls entirely when text is
enlarged (zoom, OS text-size setting, small devices).

**Required fix:** keep the current compact one-screen layout at normal text size, but when content
doesn't fit, allow the main area to scroll vertically rather than clip important controls or text.
Design for roughly 200% text scaling without losing access to the primary flow. Don't solve this by
dropping important actions from the one-screen layout.

### 8. Dark mode (nice-to-have, don't let it complicate P0)

Currently hardcoded to `color-scheme: light`. CSS variables are already reasonably centralized, so
add a `prefers-color-scheme: dark` branch swapping background/card/text/muted/border/accent-soft/
output tokens. If this meaningfully complicates the P0 fixes, defer it and say so in the handoff.

---

## Explicitly leave alone

- The bottom-center 78×78px "話す" circular button — size and centered position are fine as-is.
- Do not make the two mic-style controls (partner listening vs. expressive speak) visually identical —
  they represent different behaviors on purpose.
- Do not enlarge the typed-fragment textarea just to fill empty screen space — fragments are meant to
  be short.

## Principles to preserve while making these fixes

- one primary decision at a time
- 2–3 choices
- primary CTA should not require hunting
- consistent primary-action placement
- preserve user agency; never invent meaning
- never surface anything to the partner before explicit confirmation
- ≥44px tap targets
- keep safe-area handling intact
- no technical jargon shown to the user
- on error, return control to the user rather than guessing
- no participant-facing primary control confined to the right edge

Prioritize left-hand operability specifically, but use left / center / full-width as appropriate —
don't mechanically left-align everything; the actual goal is removing right-edge-only reachability
requirements, not literal left-alignment everywhere.

## Manual verification expected before calling this done

**Expressive Mode B:** `娘 明日 病院` → clarification → final message does not default the subject to
"私" → もどる → None of these → alternative choices → fallback → reset.

**Expressive Mode A:** fragment → 3 candidates → pick one → confirm → もどる → back at the 3-candidate
screen → confirm again → partner-facing output.

**Speech error path:** simulate/verify recognition error or unsupported API → no fabricated
"娘 明日 病院" text appears as if spoken by the user → retry/typing remains reachable.

**Reset:** start recording, then reset mid-recording → recognition does not keep running / mutate
state after reset.

**UI:** ~390px phone width → no primary control confined to the right edge → enlarged text size still
allows reaching the primary flow → safe-area handling intact.

## Report back (required in the handoff / PR follow-up)

1. Which problems were fixed
2. Files changed
3. How each was implemented
4. Manual test results (the flows above)
5. Anything left unresolved
6. What's needed to resume the Product OS pipeline (QA re-run) after this fix

## Note on `qa_fix_attempt`

The 2/2 already spent on this task was consumed by two automated-QA environment failures (couldn't
start a local server / no browser runtime in that sandbox), not by a real fix attempt against a
confirmed bug. Product has reset the counter for this task before requesting this fix — see
`agent/tasks/001-aphasia-conversation-aid/state.json`.
