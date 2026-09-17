# Product

## 0. Document purpose

This document defines the product behavior and scope for the current validation prototype.

It is intentionally written so that an implementation agent can make product decisions without
having to infer the intended UX from scattered notes.

This is not a production specification. The immediate goal is to build a mobile-first web
prototype that can be used in a researcher-assisted user test on a smartphone.

---

## 1. Product summary

A mobile-first, bidirectional communication aid for people with aphasia.

The product supports both directions of a real-time conversation:

1. **Partner → person with aphasia**
   - listen to what the conversation partner says
   - transcribe it
   - reduce it to shorter, easier-to-process language
   - surface what the user is being asked or what matters most
   - optionally present simple response choices

2. **Person with aphasia → partner**
   - accept either speech fragments or typed fragments
   - avoid immediately guessing a full sentence when intent is unclear
   - progressively narrow meaning through 2–3 simple choices
   - generate a final message only after enough information is known
   - require explicit confirmation before the message is shown or spoken to the partner

Core principle:

> AI proposes. The user decides. AI helps communicate.

The AI must not autonomously carry the conversation on the user's behalf.

---

## 2. Problem

People with aphasia may know what they want to communicate but have difficulty turning that
intention into fluent language.

Speech may be:

- slow
- fragmented
- limited to a few key words
- missing particles or grammatical structure
- interrupted by word-finding difficulty
- different from the word the person intended to say

Real-time conversation creates a second problem:

- the partner speaks
- the user must process the speech
- understand the intent of the utterance
- decide what to answer
- retrieve words
- formulate a response
- respond before the conversation moves on

This can be especially difficult in phone-like or time-sensitive conversations where visual
cues, gestures, writing, facial expressions, and other natural communication supports are
limited.

The product therefore addresses both:

> "I know what I want to say, but I cannot get the words out."

and:

> "I cannot process what the other person is saying quickly enough to respond."

The product should reduce the number of linguistic and cognitive decisions required at any one
moment.

---

## 3. Target user

### 3.1 Primary user

The primary user is the person with aphasia.

The current prototype is optimized for a person who:

- lives outside the acute hospital setting
- can use a smartphone with assistance if necessary
- can understand and select between a small number of simple choices
- can communicate at least some information through:
  - speech fragments
  - single words
  - yes/no
  - pointing
  - tapping a choice
  - short typed input
- has difficulty expressing a complete thought in real time and/or processing another person's
  speech quickly enough to respond

The prototype is likely to be most useful for **mild-to-moderate or moderate communication
difficulty**.

Very mild users may already communicate without enough difficulty for the tool to add value.

Very severe users may not be able to reliably understand the choices or use the interface without
additional multimodal support that is outside the current prototype.

### 3.2 Aphasia subtype

The prototype is not gated by a diagnostic label.

It is especially designed around communication patterns often associated with
**expressive / non-fluent aphasia, including Broca-like presentations**, but eligibility should be
based on functional communication ability rather than diagnosis name.

Do not assume that all people with Broca's aphasia have intact comprehension.

Individual differences may exist in:

- auditory comprehension
- reading
- attention
- memory
- fatigue
- motor ability
- visual processing
- other higher brain dysfunction

### 3.3 Secondary user

The conversation partner is a secondary user.

Examples:

- family
- friends
- caregivers
- medical staff
- service staff
- administrative staff
- other people encountered in daily life

The partner does not configure the product.

The interface may temporarily face the partner when the person with aphasia chooses to show them
a confirmed message.

---

## 4. Prototype status

This version is a **researcher-assisted validation prototype**.

It is not a production application.

The prototype will be used on a smartphone during an observed user test.

### 4.1 Delivery form

Implement as a:

- mobile-first web application
- portrait-first layout
- installable / home-screen-friendly where practical
- app-like full-screen experience where practical

Native iOS / Android distribution is not required.

### 4.2 Not required for this prototype

Do not spend time on:

- user accounts
- login
- authentication
- production-grade database architecture
- App Store / Play Store distribution
- push notifications
- background services
- offline operation
- long-term persistence
- multi-device sync
- production-grade analytics
- production-grade error recovery
- production-grade permissions management
- complex speaker diarization

The priority is to make the core conversation loop testable on a real smartphone.

---

## 5. Product principles

### 5.1 One decision at a time

The interface should ask the user to make only one meaningful decision at a time.

Avoid presenting multiple layers of information simultaneously when one can be hidden or
de-emphasized.

### 5.2 Small choice sets

Prefer **2–3 choices at a time**.

Do not show long lists of words or sentences.

### 5.3 Progressive clarification

When the user's intent is unclear, do not guess the entire sentence immediately.

Instead:

1. identify the most important ambiguity
2. ask one simple clarification
3. incorporate the answer
4. clarify once more if necessary
5. generate the final message

### 5.4 Use the simplest sufficient language

Represent information using the simplest level that preserves the needed meaning:

1. single words
2. short phrases
3. short sentences

Do not use a full sentence when a word or short phrase is enough.

### 5.5 Preserve user agency

Never automatically send or speak an inferred message.

The user must explicitly confirm a final message.

### 5.6 Natural communication remains primary

If the user can answer normally, the product should not force an AI interaction.

The product assists when needed.

### 5.7 Clear failure is better than repeated guessing

If the system cannot infer the user's intent after the bounded clarification process, it should
return control to the user.

Do not enter an open-ended AI interrogation loop.

---

## 6. Core interaction model

The product has two logical directions:

```text
Conversation partner
        ↓
Partner speech
        ↓
Speech recognition
        ↓
Simplify / structure meaning
        ↓
Person with aphasia
        ↓
Natural response if possible
        ↓
If support is needed:
speech fragment or typed fragment
        ↓
Intent clarification
        ↓
User confirmation
        ↓
Final message
        ↓
Show / speak to partner
```

The two directions live in the same interface.

---

## 7. Physical / spatial UI concept

The phone is assumed to be physically placed between two people.

Default orientation is optimized for the person with aphasia.

Conceptually:

```text
        Conversation partner side
                 ↑

┌─────────────────────────────┐
│  listening state       ↻    │
│                             │
│  partner transcript         │
│  (small / secondary)        │
│                             │
├─────────────────────────────┤
│                             │
│  main assistance area       │
│                             │
│  "What are they asking?"    │
│  simplified meaning         │
│                             │
│  [ Choice A ]               │
│  [ Choice B ]               │
│  [ Choice C ]               │
│                             │
│  [ I don't understand ]     │
│                             │
├─────────────────────────────┤
│                             │
│         🎤 Speak            │
│                             │
│      ⌨ Type instead         │
│                             │
└─────────────────────────────┘

                 ↓
        Person with aphasia side
```

The exact visual style is not important for the prototype.

Clarity, touch size, and information hierarchy are important.

---

## 8. Information hierarchy

### 8.1 Partner transcript

The raw or lightly cleaned partner transcript is **secondary information**.

It should be visible for reference but visually smaller than the simplified meaning.

Example:

```text
Partner said:
"Friday afternoon is available, or Monday morning if that is easier..."
```

### 8.2 Main assistance area

The main assistance area is the largest visual element.

It should answer one of these questions:

- What did they say?
- What are they asking me?
- What do I need to decide?
- What should I choose next?
- What message am I about to send?

Example:

```text
When do you want to go?

[ Friday afternoon ]
[ Monday morning ]
[ Neither ]
```

Do not label this area "AI".

The user should see the communication task, not the internal technology.

---

## 9. Microphone behavior

There are two microphone concepts:

1. **conversation listening**
2. **user expressive input**

They must be visually and behaviorally distinguishable.

### 9.1 Conversation listening

The application must not start listening automatically.

The user or researcher explicitly starts a listening session.

Once started:

- the microphone remains active until explicitly stopped
- the user should not need to restart listening after every partner utterance
- the UI must clearly indicate that listening is active
- provide an obvious stop control

Example states:

```text
[ 🎤 Start listening ]
```

then:

```text
🔴 Listening
[ ■ Stop ]
```

### 9.2 No diarization requirement

Do not rely on automatic speaker diarization for this prototype.

When the person with aphasia starts expressive speech input, partner listening may be
temporarily paused or deprioritized.

After expressive input is complete, partner listening may resume.

### 9.3 Expressive microphone

Provide a large, prominent microphone control near the bottom of the screen.

Example:

```text
┌──────────────────────┐
│                      │
│      🎤 Speak         │
│                      │
└──────────────────────┘

      ⌨ Type instead
```

When recording:

```text
🔴 Listening to you
[ ■ Finish ]
```

The expressive microphone should feel like a primary action, not a small utility icon.

---

## 10. Expressive input

The expressive side supports both:

- speech
- smartphone text input

### 10.1 Speech input

Speech input is converted to editable text.

Example:

```text
Speech:
"daughter ... tomorrow ... hospital"

↓ ASR

Editable fragment:
娘　明日　病院
```

The transcript is then passed into the same clarification flow as typed input.

### 10.2 Typed input

The user may type:

- one word
- several words
- a short phrase
- a partial sentence

Typing should not require grammatical correctness.

Example:

```text
娘 明日 病院
```

### 10.3 Unified representation

Speech and typing should converge into one internal concept:

```text
fragment text
```

The downstream clarification logic should not care whether the fragment came from speech or
typing.

---

## 11. Receptive support

The receptive side helps the person with aphasia understand the conversation partner.

### 11.1 Goal

Do not merely display verbatim captions.

Transform the partner's speech into a smaller, decision-oriented representation.

Possible outputs include:

- a short summary
- key words
- the question being asked
- response type
- simple choices

### 11.2 Example

Partner says:

> "We have an opening on Friday afternoon, but if that does not work we could also do Monday
> morning. Which would you prefer?"

Secondary transcript:

```text
Friday afternoon or Monday morning is available.
```

Primary assistance:

```text
When do you want?

[ Friday afternoon ]
[ Monday morning ]
[ Neither ]
```

### 11.3 Response-type awareness

When useful, classify the partner utterance into a response type such as:

- yes / no
- choose one
- confirm
- give information
- no response required

Use this only to simplify the user's next action.

Do not expose technical classification labels.

### 11.4 "I don't understand"

"I don't understand" is different from "None of these."

Use:

- **I don't understand** when the user does not understand the partner / prompt
- **None of these** when the user understands the question but the presented answer choices do
  not match their intended answer

---

## 12. Expressive clarification flow

### 12.1 Goal

Turn fragmented user input into a confirmed message without forcing the AI to make an unsafe
one-shot guess.

### 12.2 State machine

```text
CAPTURE_FRAGMENT
      ↓
ANALYZE_INTENT
      ↓
Is intent sufficiently clear?
   ↙ yes          ↘ no
FINAL_CANDIDATE   CLARIFY_1
                     ↓
               user chooses
                     ↓
              ANALYZE_INTENT
                     ↓
            sufficiently clear?
              ↙ yes       ↘ no
     FINAL_CANDIDATE     CLARIFY_2
                              ↓
                        user chooses
                              ↓
                      FINAL_CANDIDATE
                              ↓
                         CONFIRM
```

Maximum clarification depth:

> **2 clarification rounds**

### 12.3 Fixed ambiguity priority order: time → topic → content

**Resolved 2026-09-17** (supersedes an earlier draft of this section, which proposed letting the AI
freely choose which ambiguity to clarify next). Based on SLP feedback gathered during hearings, the
product now uses a **fixed priority order** for which ambiguity to resolve first:

1. **time** (e.g. today / yesterday / tomorrow)
2. **topic** (e.g. hospital, school, appointment)
3. **content** (the specific thing being said about that topic)

If a step is already known with confidence — from the fragment itself or from conversation context —
it is skipped. The AI's role is not to pick which ambiguity to resolve next; it is to generate the
2–3 choices presented at whichever step is currently active. This still runs within the same 2-round
maximum clarification depth (§12.2).

This ordering was chosen because meaning-based guessing directly from the fragment risks latching onto
an unrelated concept (an SLP interviewed for this project gave the example of a fragment about a train
time being mistaken for an unrelated topic), while narrowing by time and topic first is more reliably
answerable for this population before attempting content-level detail.

### 12.4 Example

Input:

```text
娘　明日　病院
```

Possible analysis:

```text
known:
- person: daughter
- time: tomorrow
- context/location: hospital

uncertain:
- who is going
- why they are going
- relationship between daughter and hospital
```

Clarification 1:

```text
Who is going to the hospital?

[ Me ]
[ My daughter ]
[ Someone else ]

[ None of these ]
```

If the user selects "My daughter":

Clarification 2:

```text
What is your daughter doing?

[ Seeing a doctor ]
[ Visiting someone ]
[ Something else ]

[ None of these ]
```

Then generate the final message.

---

## 13. "None of these" behavior

Each clarification screen must include:

```text
[ None of these ]
```

If selected:

1. generate **one alternative set** of choices for the same ambiguity
2. if none of those match either, stop clarifying
3. move to fallback

Do not repeatedly regenerate choices indefinitely.

---

## 14. Fallback

When clarification fails, show:

```text
I couldn't narrow it down.

[ 🎤 Say a little more ]
[ ⌨ Add text ]
[ ↺ Start over ]
```

The system should prefer asking the user for more information over continuing to guess.

---

## 15. Final message confirmation

After enough meaning is known, show a final message.

Example:

```text
娘は明日、病院で診察を受けます。
```

Required actions:

```text
[ ✓ This is right ]
[ ← Back ]
[ ↺ Start over ]
```

Optionally, if useful for the validation:

```text
[ Edit ]
```

The message must not be shown to the partner or spoken aloud until the user confirms it.

---

## 16. Partner-facing output

After confirmation, provide two ways to communicate:

1. show the message to the partner
2. speak the message aloud using TTS

### 16.1 Show to partner

Primary action:

```text
[ ↻ Show to partner ]
```

When activated:

- rotate the message 180° toward the conversation partner
- temporarily use a large, high-contrast full-screen message view
- hide nonessential controls
- make the message easy to read from the opposite side of the phone

Example:

```text
┌──────────────────────────┐
│                          │
│  金曜日の午後で          │
│  お願いします            │
│                          │
└──────────────────────────┘
```

Provide a clear action to return to the aphasia-user view.

### 16.2 TTS

Optional partner output:

```text
[ 🔊 Speak aloud ]
```

Only confirmed text may be spoken.

---

## 17. Rotation

A visible rotate control may remain available in the main interface.

Example:

```text
↻
```

Its purpose is to let the user or researcher intentionally face content toward the opposite
person.

Do not rotate automatically based on sensors or speaker detection.

---

## 18. Main UI states

The prototype should have a small number of explicit states.

Recommended states:

```text
IDLE
LISTENING_TO_PARTNER
PARTNER_MEANING_READY
CAPTURING_USER
USER_FRAGMENT_READY
CLARIFYING
CONFIRMING
PARTNER_OUTPUT
FALLBACK
```

### 18.1 IDLE

Show:

- start listening
- expressive "Speak" action
- type instead

### 18.2 LISTENING_TO_PARTNER

Show:

- strong listening indicator
- stop button
- live transcript region
- main assistance region updates as usable meaning becomes available

### 18.3 PARTNER_MEANING_READY

Show:

- small partner transcript
- large simplified meaning / question
- answer choices if appropriate
- "I don't understand"
- expressive microphone

### 18.4 CAPTURING_USER

Show:

- clear recording state
- finish button
- live partial transcript if feasible

### 18.5 USER_FRAGMENT_READY

Show:

- editable fragment text
- continue action

### 18.6 CLARIFYING

Show:

- one clarification question
- 2–3 large choices
- "None of these"
- back

### 18.7 CONFIRMING

Show:

- one final message
- confirm
- back
- restart
- optional edit

### 18.8 PARTNER_OUTPUT

Show:

- large partner-facing message
- optional TTS action
- return control

### 18.9 FALLBACK

Show:

- say more
- add text
- start over

---

## 19. Touch and accessibility rules

For the validation prototype:

- use large touch targets
- avoid dense UI
- avoid small icon-only actions for primary behavior
- pair important icons with text where possible
- minimize scrolling
- prefer one-screen completion for the core interaction
- use high contrast
- use large readable text
- keep wording short
- avoid technical language
- avoid animation that distracts from the current decision
- preserve the same location for primary actions when possible

The large expressive microphone should be one of the most visually prominent controls.

---

## 20. Content rules

### 20.1 Clarification wording

Use:

- short words
- short questions
- concrete language

Avoid:

- long explanations
- abstract labels
- multiple questions in one sentence

### 20.2 Choice wording

Choices should differ in meaning, not merely phrasing.

Bad:

```text
[ I will go to the hospital ]
[ I'm going to the hospital ]
[ I plan to visit the hospital ]
```

Better:

```text
[ I am going ]
[ My daughter is going ]
[ I am visiting someone ]
```

### 20.3 Generated final message

The final message should:

- preserve the user's confirmed meaning
- avoid adding unsupported details
- be short
- be natural enough to show or speak to the partner

---

## 21. Research comparison mode

The immediate user test should be able to compare two expressive assistance strategies.

This may be implemented through a simple researcher-only setting, query parameter, or hidden
configuration.

It does not need to be exposed in the participant-facing UI.

### Mode A: direct candidates

```text
fragment
↓
three complete sentence candidates
↓
user chooses
```

### Mode B: progressive clarification

```text
fragment
↓
2–3 simple meaning choices
↓
possibly one more clarification
↓
final message
↓
confirmation
```

The purpose is to learn which interaction is easier to understand and use.

Do not build a complex experiment framework.

A minimal implementation switch is sufficient.

---

## 22. User validation focus

The user test should primarily investigate:

### Receptive support

Compare:

A. verbatim / lightly cleaned transcript

vs.

B. simplified meaning / "what am I being asked?"

Observe:

- which is easier to understand
- whether the simplified version removes important meaning
- whether response choices help or confuse

### Expressive support

Compare:

A. three completed sentence candidates

vs.

B. progressive clarification

Observe:

- whether the user can find their intended meaning
- whether the choices are understandable
- whether the process feels tiring
- where the user gets stuck
- whether the AI inserts meaning the user did not intend

---

## 23. Success criteria for this prototype

This prototype is successful if the test helps answer product questions, not if it behaves like a
finished app.

Primary questions:

1. Can the user understand what to do without repeated explanation?
2. Can the user understand the simplified representation of partner speech?
3. Can the user identify their intended meaning from 2–3 choices?
4. Does progressive clarification feel easier than choosing from full sentence candidates?
5. Does the user prefer speech input, typing, or a mixture?
6. Is the partner-facing rotation / output understandable?
7. Does the product reduce communication effort, or add more steps than it removes?
8. Where does the user become confused?
9. Which direction is more valuable:
   - understanding the partner
   - expressing their own message
10. What should be removed before adding anything else?

---

## 24. Non-goals

For the current prototype:

- not a speech-language therapy platform
- not a rehabilitation exercise app
- not a clinician dashboard
- not a diagnostic tool
- not a severity assessment tool
- not autonomous conversation
- not automatic sending of inferred messages
- not automatic speaking of inferred messages
- not intended to support all severities
- not intended to support every aphasia subtype equally
- no complex picture / gesture recognition
- no camera-based understanding
- no eye tracking
- no production phone-call integration
- no automatic speaker diarization
- no long-term personalization system yet
- no background passive monitoring
- no production medical-data infrastructure

---

## 25. Later opportunities

Do not implement these unless the core prototype already works.

Potential future directions:

- personal context:
  - family members
  - routines
  - appointments
  - frequent contacts
  - common topics
- learning from previously confirmed choices
- picture-based choices
- communication profile / difficulty level
- personalized simplification level
- automatic support-level adaptation
- phone-call integration
- better turn-taking detection
- automatic detection of when assistance is needed
- richer multimodal communication
- clinician-assisted setup
- local / private processing where needed

---

## 26. Implementation priority

Build in this order.

### Priority 1 — must work for the user test

1. mobile-first web UI
2. conversation listening start / stop
3. partner speech transcription
4. simplified partner meaning
5. large expressive microphone
6. typed fragment input
7. clarification choices
8. max-2-round clarification logic
9. "None of these" and fallback
10. final confirmation
11. partner-facing rotated message

### Priority 2 — useful if time allows

12. TTS for confirmed output
13. editable ASR fragment before clarification
14. researcher-only mode switch for direct-candidate vs progressive-clarification testing
15. home-screen / PWA polish

### Priority 3 — explicitly defer

- accounts
- persistence
- offline
- production analytics
- background audio
- diarization
- long-term memory
- native app distribution

---

## 27. Final product definition

The prototype is not:

> an AI that talks instead of a person with aphasia.

It is:

> a communication interface that reduces the amount of language the user must process at once,
> helps narrow ambiguous meaning through small choices, and lets the user remain the person making
> and communicating the final decision.

The most important product behavior is therefore not sentence generation.

It is:

> turning a difficult real-time conversation into a sequence of small, understandable decisions
> that the person with aphasia can control.
