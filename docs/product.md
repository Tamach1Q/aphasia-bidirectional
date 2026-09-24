# Product

## 0. Document purpose

This document defines the product behavior and scope for the current validation prototype.

It is intentionally written so that an implementation agent can make product decisions without
having to infer the intended UX from scattered notes.

This is not a production specification. The immediate goal is to build a mobile-first web
prototype that can be used in a researcher-assisted user test on a smartphone.

### 0.1 Revision status

This revision replaces the earlier interaction model, in which the person with aphasia entered a
fragment and then drove an AI clarification flow (`fragment → progressive clarification → final
sentence`) to produce a completed sentence.

That model is not merely extended here. It is demoted. The product's centre of gravity moves from
*completing the person's sentence* to *helping two people understand each other*.

Sections that conflicted with the new thesis have been rewritten rather than annotated. Where an
older behaviour survives, it survives as an optional strategy, not as the main path.

---

## 1. Product thesis

> お互いの「分からない」を減らして、通じ合うのを助けるAI。

In English:

> An AI that reduces *both* people's "I don't understand", and helps them get through to each other.

Concretely:

> The product sits between a person with aphasia and their conversation partner. It reshapes the
> partner's complex speech into a form the person can process, and it uses conversation context to
> offer the partner hypotheses about what the person may be trying to say.

The product does not converse on anyone's behalf.

It also does not treat the person with aphasia as the only side that needs fixing. Communication
breakdown is a property of the pair, not of one person.

### 1.1 Product vision (beyond this prototype)

> The more it is used, the better it understands *this person's* communication.

This vision is retained, but see §18: the long-term memory that would fully deliver it is **not**
a Phase 1 deliverable. Phase 1 tests a smaller, checkable version of the same idea — whether an AI
that knows *this person's context* can help a partner understand them.

---

## 2. Core principles

> AI proposes.
> People communicate.
> The person confirms.

Each line is load-bearing.

### 2.1 Natural conversation remains primary

Human-to-human conversation is the main event. The AI is not a participant.

When the two people are communicating successfully without help, the product stays out of the way.
Success is not measured by how much the AI is used.

### 2.2 Inference and intervention are separate

The AI may hold a hypothesis without showing it.

> The AI understood something
> ≠
> The AI should interrupt.

This separation is explicit in the state model (§19) and the intervention policy (§20).

### 2.3 Waiting is correct behaviour

Slowness, pauses, hesitation, and visible word-finding effort are **not** failure signals and must
not by themselves cause the product to act.

Hearing evidence is direct on this point: interrupting with a guess is unwelcome *even when the
guess is right*, because it takes the turn away from the person.

### 2.4 Use conversation context, not isolated utterances

A fragment is never interpreted alone. The available context (§7) is used wherever possible.

### 2.5 Do not frame difficulty as the person's failure

The interface must never tell the person, in effect, "what you said was unintelligible."

Support controls are named for the *support they provide*, not for the deficit they imply (§14).

### 2.6 Distinguish kinds of not-understanding

Avoiding blame does not mean collapsing all trouble into one undifferentiated "help" button.

"I did not hear it", "it was too fast", "it was too complicated", and "that candidate is wrong" are
different problems requiring different repairs, and the interface must keep them distinguishable
(§14).

### 2.7 One decision at a time, small choice sets

The interface asks for one meaningful decision at a time, and prefers **2–3 options** over long
lists.

### 2.8 Honest uncertainty over manufactured certainty

"I can't tell yet" is a valid, first-class output. The product is not required to produce candidates
when it has no grounds for them (§15).

### 2.9 Confirmed meaning is different from inferred meaning

What the AI guessed and what the person actually confirmed must never be conflated — in the UI, in
logs, or in anything the product stores.

---

## 3. Problem

### 3.1 Expression

> "I know what I want to say, but I cannot get the words out."

Speech may be slow, fragmented, reduced to a few key words, missing particles or grammatical
structure, interrupted by word-finding difficulty, or substituted with a word the person did not
intend.

Word substitution matters for design: the word that comes out may be semantically adjacent rather
than correct (intending *clock*, saying *glasses*). The category is often right while the specific
item is wrong. **A fragment's literal words cannot be fully trusted.**

### 3.2 Reception

> "I cannot process what the other person is saying quickly enough to respond."

Real-time conversation compounds this. The person must process the speech, infer intent, decide an
answer, retrieve words, and produce a response before the conversation moves on.

Complex sentence structures are a specific failure point — embedded conditions, multiple
instructions in one utterance, and exception clauses are understood far less reliably than their
individual words would suggest.

### 3.3 Insufficient shared context

> The conversation partner may not have enough context, experience, or person-specific knowledge to
> understand the person's fragmented expression.

The same fragment succeeds or fails depending on who is listening:

```text
Person with aphasia says a fragment.

Someone who knows them well and knows the topic:
    understands

Someone who does not:
    does not understand
```

This is not a property of the speaker. Understanding depends on how much the listener knows about
the person's usual expressions, the recent conversation, the current topic, the person's daily life,
and the subject area being discussed.

### 3.4 Restated product problem

The product therefore addresses more than an impaired speaker. It addresses **insufficient shared
context between two people**, from both ends.

---

## 4. Users

### 4.1 Primary beneficiary

The person with aphasia.

Product success is judged by whether *they* communicate with others more successfully — not by
whether the partner finds the tool clever.

The current prototype is optimized for a person who:

- lives outside the acute hospital setting
- can use a smartphone, with assistance if necessary
- can understand and select between a small number of simple choices
- can communicate at least some information through speech fragments, single words, yes/no,
  pointing, tapping, or short typed input
- has difficulty expressing a complete thought in real time and/or processing another person's
  speech quickly enough to respond

Most useful for **mild-to-moderate or moderate** communication difficulty. Very mild users may not
need it; very severe users may need multimodal support beyond this prototype.

### 4.2 Aphasia subtype

Eligibility is functional, not diagnostic.

The design is oriented around **expressive / non-fluent presentations**, but must not assume that
comprehension is intact. Individual variation in auditory comprehension, reading, attention,
memory, fatigue, motor ability, and visual processing is expected.

### 4.3 Executive function

Language symptoms alone do not determine whether this product helps.

Choosing between options, sequencing steps, noticing one's own errors, and holding an option in
mind all draw on executive function. Prior AAC research found that non-linguistic executive
function, rather than language severity, largely separated the users who benefited from those who
did not.

Executive load is therefore a **design constraint** (fewer required choices) and a **validation
variable** (§25.4), not an eligibility filter.

### 4.4 Conversation partner — active participant

The partner is not a passive bystander in this revision. They may:

- view the simplified conversation record
- view the AI's meaning hypotheses
- see what has already been confirmed in this session
- use a hypothesis to ask the person a natural question
- ignore the AI entirely and keep talking

The partner is **not** the primary beneficiary. Their view exists so the pair reaches shared
meaning.

### 4.5 Which partners this prototype is for

Partner types differ enough that one UX cannot serve all of them.

**In scope for this prototype:**

- trained communication-support workers (意思疎通支援者)
- family members
- close friends and regular caregivers

These partners are willing to look at a screen, already have some person-specific knowledge, and
are motivated to repair breakdowns.

**Out of scope for this prototype (future, separate UX):**

- shop staff, station staff, taxi drivers, receptionists
- any first-meeting partner in a time-pressured or unexpected situation

This exclusion is deliberate and should not be read as low priority. Unexpected situations with
strangers are among the hardest and most valuable problems, but a partner-facing hint screen is the
wrong instrument for someone with no time and no motivation to read it. That case needs its own
design.

---

## 5. Prototype status and phases

This is a **researcher-assisted validation prototype**, not a production application. It will be
used on a smartphone during an observed user test.

### 5.1 Delivery form

- mobile-first web application
- portrait-first layout
- installable / home-screen-friendly where practical
- app-like full-screen experience where practical

Native iOS / Android distribution is not required.

### 5.2 Phase 1 — this prototype

Phase 1 delivers and tests:

- conversation session with rolling recent context
- partner speech transcription
- conditional receptive simplification
- person's speech / typed fragment capture
- contextual meaning hypotheses for the partner
- human-invoked support (no automatic intervention)
- meaning confirmation
- meaning safety checks
- non-verbal presentation for the person's view
- dyadic evaluation, including an AI-off baseline

### 5.3 Phase 2 — after Phase 1 validates

Phase 2 explores:

- Personal Context Memory persisted across sessions
- personalization that improves with continued use
- adjustable simplification level as a user-facing setting

Phase 2 is gated on a Phase 1 result: if a partner cannot make use of a meaning hypothesis inside a
single session, remembering things across sessions has nothing to improve.

### 5.4 Not required in either phase of this prototype

- user accounts, login, authentication
- production-grade database architecture
- App Store / Play Store distribution
- push notifications, background services
- offline operation
- multi-device sync
- production-grade analytics, error recovery, permissions management
- speaker diarization
- permanent storage of full conversation transcripts

---

## 6. Core interaction model

```text
Conversation session starts (explicit)
        ↓
AI maintains recent conversation context
        ↓
┌─────────────────────────────────────────────┐
│  Partner → person                           │
│                                             │
│  partner speaks                             │
│        ↓                                    │
│  transcribed                                │
│        ↓                                    │
│  is this hard to process?  ── no ──┐        │
│        ↓ yes                       │        │
│  simplify / structure              │        │
│        ↓                           ↓        │
│  person understands and responds naturally  │
└─────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────┐
│  Person → partner                           │
│                                             │
│  speech or typed fragment                   │
│        ↓                                    │
│  AI combines:                               │
│    - the fragment                           │
│    - the partner's preceding utterance      │
│    - recent turns                           │
│    - meaning confirmed earlier this session │
│    - personal context (Phase 2)             │
│    - general world knowledge                │
│        ↓                                    │
│  meaning hypotheses (0–3)                   │
│        ↓                                    │
│  HELD, NOT SHOWN                            │
│        ↓                                    │
│  a person asks for support                  │
│        ↓                                    │
│  partner sees hypotheses                    │
│        ↓                                    │
│  partner asks the person naturally          │
│        ↓                                    │
│  person confirms or rejects                 │
│        ↓                                    │
│  confirmed meaning enters session context   │
└─────────────────────────────────────────────┘
        ↓
conversation continues
```

The critical difference from the previous model: the product supports **repair inside an existing
human conversation**. It does not run its own clarification dialogue with the person.

---

## 7. Conversation context model

The AI never interprets an utterance in isolation. Three layers, kept distinct:

### 7.1 Short-term conversational context

The last few turns, both directions.

```text
Partner: "What time is the hospital tomorrow?"
Person:  "…ten…"
```

### 7.2 Session context

Meaning confirmed during *this* conversation.

```text
topic = hospital appointment
date  = tomorrow
```

Session context is built only from confirmed meaning (§2.9), never from unconfirmed inference.

### 7.3 Personal context — Phase 2

Longer-term, person-specific knowledge: people, places, routines, appointments, interests,
frequently discussed topics. See §18.

In Phase 1 this layer may be **pre-filled by the researcher before the session** rather than learned
during it. That is sufficient to test the hypothesis that person-specific context helps a partner
understand, without building persistence.

### 7.4 Inference input

```text
current fragment
+ short-term context
+ session context
+ personal context (Phase 2, or researcher-prefilled in Phase 1)
+ general world knowledge
```

---

## 8. Physical / spatial UI concept

The phone sits between two people. The default orientation favours the person with aphasia.

```text
        Conversation partner side
                 ↑

┌─────────────────────────────┐
│  session state         ↻    │
│                             │
│  partner's words            │
│  (small / secondary)        │
│                             │
├─────────────────────────────┤
│                             │
│  main area                  │
│                             │
│  simplified meaning         │
│  or the current question    │
│                             │
│  [ option A ]               │
│  [ option B ]               │
│                             │
├─────────────────────────────┤
│  [短く] [もう一回] [ゆっくり] │
│                             │
│         🎤 はなす            │
│      ⌨ もじで入力            │
└─────────────────────────────┘

                 ↓
        Person with aphasia side
```

Exact visual style is not important. Clarity, touch size, information hierarchy, and reachability
(§21.2) are.

The interface must read as **optional support**, never as a communication-failure screen.

---

## 9. Information hierarchy

Information density is **deliberately asymmetric** between the two views.

### 9.1 Person's view

Prefer:

- short expressions
- large text
- icons or images alongside words
- yes / no
- a simplified version of what the partner said
- one meaning at a time

Avoid:

- explanations of the AI's reasoning
- confidence scores
- long conversation history
- many simultaneous candidates

The raw partner transcript remains available but stays visually secondary to the simplified meaning.

### 9.2 Partner's view

May show:

- what the person said, as captured
- the preceding turns
- the current topic
- meaning hypotheses, explicitly marked as hypotheses
- the grounds for each hypothesis
- what has been confirmed this session
- uncertainty, including "cannot tell"

Rationale: the AI's complexity is pushed to the side that can absorb it.

---

## 10. Conversation session and microphone behaviour

### 10.1 Session, not dictation

Listening is a **session** that maintains shared conversation context, not just a transcription
service. Within a session, both partner turns and the person's turns accumulate into context as far
as is feasible.

### 10.2 Explicit start and stop

The application never starts listening on its own. A person (user or researcher) starts the
session, and it runs until explicitly stopped.

```text
[ 🎤 かいわを はじめる ]
```

then:

```text
🔴 かいわ中
[ ■ おわる ]
```

There is no always-on background listening. Full transcripts are not retained after the session
(§5.4).

### 10.3 No diarization requirement

Automatic speaker separation is not required. When the person begins expressive input, partner
listening may be paused or deprioritized, and resumed afterward.

### 10.4 Expressive input control

A large, prominent control near the bottom of the screen, reachable one-handed (§21.2):

```text
┌──────────────────────┐
│      🎤 はなす        │
└──────────────────────┘
      ⌨ もじで入力
```

While capturing:

```text
🔴 きいています
[ ■ おわり ]
```

This control is a primary action, not a small utility icon.

---

## 11. Receptive support (partner → person)

### 11.1 Goal

Not verbatim captions. Turn the partner's speech into something smaller and decision-oriented.

Possible outputs: a short summary, key words, the question being asked, the required response type,
or simple options.

### 11.2 Simplification gate

**Do not automatically simplify every utterance.** Simplification is considered when the utterance:

- is long
- contains several instructions
- contains a condition or exception
- embeds a question inside other material
- carries a lot of information at once

A short, simple utterance is left alone:

```text
"Are you going to the hospital tomorrow?"
```

A complex one is restructured:

```text
"Take the medicine in the morning, and if you feel unsteady,
stop taking it and call us."
```

becomes:

```text
あさ：くすりを のむ

ふらついたら：
  くすりを やめる
  でんわする
```

### 11.3 Chunked, settled display

Simplified output is **not** continuously rewritten while ASR is still arriving.

Display settles at **semantic chunk** boundaries.

Rationale: adaptive segmentation outperformed fixed-interval segmentation in real-time
summarization research, but the cost of *rewriting already-displayed text* has not been evaluated
with any user population, let alone this one. Text changing while the person is still reading it is
a plausible and avoidable source of load.

When a later chunk changes something already shown, the change is marked rather than silently
swapped.

### 11.4 Information preservation

Shortest is not automatically best. Simplification trades information for speed and simplicity, and
that trade has a measurable cost.

Phase 1 rule:

> Do not drop meaning that changes the decision, in order to be shorter.

Phase 2 exposes this as an adjustable level:

```text
すくなく  /  ふつう  /  くわしく
```

### 11.5 Response-type awareness

Where useful, the partner's utterance may be internally classified (yes/no, choose one, confirm,
give information, no response needed) to simplify the person's next action.

Never expose the classification label itself.

---

## 12. Expressive input capture

### 12.1 Speech and typing converge

```text
speech  ─┐
         ├─→  fragment text  →  §13
typing  ─┘
```

Downstream logic does not care which was used. Typed input need not be grammatical.

### 12.2 No mandatory correction step

The person is **not** required to review, correct, or clean the captured fragment before it is used.

Rationale: this product is not therapy. Making a person repeatedly fix their own recognised speech
is both a burden and a rehearsal of failure. Correction is available, never demanded.

### 12.3 No mandatory sentence completion

Turning a fragment into a complete sentence is **not** the goal (§16.3). A fragment that leads to
shared meaning has already succeeded.

---

## 13. Partner understanding support (person → partner)

This section replaces the previous progressive-clarification flow as the main expressive path.

### 13.1 Goal

Convert the person's fragment into hypotheses the **partner** can use to understand them.

### 13.2 Input

As specified in §7.4.

### 13.3 Output

Zero to three hypotheses. Each carries its grounds.

```text
Partner (just before): "What time is the hospital tomorrow?"
Person:                "…ten…"
```

Partner view:

```text
かもしれない意味

10時
  ・直前に時間を聞かれている
  ・「10」と言っている

10日
  ・日付の可能性もある

[ どれも ちがいそう ]   [ 会話を つづける ]
```

### 13.4 Rules

- 0–3 hypotheses; producing none is valid
- always visibly marked as hypotheses, never as the person's words
- never auto-sent as the person's message
- never auto-spoken
- the partner uses a hypothesis to *ask the person*, not to conclude
- only the person's explicit confirmation makes a hypothesis a meaning (§16)

### 13.5 Fragments are not literal

Because a produced word may be a substitution for an adjacent one (§3.1), hypothesis generation
must consider semantically neighbouring interpretations, not only the literal token.

### 13.6 Progressive clarification — demoted

Step-by-step narrowing (including the previous fixed `time → topic → content` ordering and the
two-round maximum) is **no longer the main flow**.

It is retained as **one optional repair strategy**, available when:

- the partner explicitly asks for it, and
- narrowing is likely to resolve the ambiguity quickly

Rationale for demotion:

- multi-step selection loads exactly the executive functions that vary most in this population
  (§4.3)
- offering more candidate control did not increase a speaker's sense of agency in the closest
  comparable study, and the condition with *less* speaker involvement produced *better* mutual
  understanding
- a fixed ordering assumes the fragment's words are reliable, which §3.1 says they are not
- hearing evidence favours a partner holding a hypothesis and checking it conversationally

---

## 14. Support request controls

The control labelled `[ I don't understand ]` is removed.

It is replaced by a small set of controls named for the support requested. These are available to
the person, and may also be raised by the partner.

```text
[ もう一回 ]    say that again
[ ゆっくり ]    say it more slowly
[ 短く ]        show me a shorter version
[ ちがう ]      that is not what I mean
```

Two requirements are held simultaneously:

1. **No blame.** No control says or implies that the person's speech was unintelligible, and
   communication failure is never repeatedly displayed as a status.
2. **Kind is preserved.** These four requests are different problems with different repairs.
   Collapsing them into one generic "help" control destroys the signal the partner needs.

`[ ちがう ]` (a rejected candidate) is specifically distinct from `[ もう一回 ]` (not received).
Conflating them is a known route to confidently wrong repair.

Support hypotheses may also be invoked neutrally:

```text
[ ことばのヒント ]
```

---

## 15. Uncertainty is a normal path

### 15.1 Assumption

The product does **not** assume the AI will usually identify the intended meaning.

Grounds, from published evaluations of intent recovery from aphasic speech:

- best reported first-candidate exact match was roughly half of cases
- accuracy was **lower** for non-fluent and more severe speakers — the population this product
  targets
- trained human raters, with audio and video, agreed on the intended target in about three quarters
  of resolvable cases, and about a fifth of cases could not be resolved at all

A realistic expectation is therefore that a 2–3 candidate set contains the intended meaning
**well under three quarters of the time**, and that some intentions are not recoverable by anyone.

### 15.2 Consequence

`wrong` / `unknown` / `none` are **not** exceptions. They are ordinary interaction paths and must
be designed with the same care as the success path.

The AI's role is:

> a hypothesis generator that helps two people keep communicating

not:

> a correct-answer generator.

### 15.3 Fallback

```text
まだ わかりません

[ 会話を つづける ]
[ 聞き方の ヒント ]
[ もう少し 教えてもらう ]
```

Fallback must not put the entire burden of retry on the person. "Ask differently" is often the
better move, and the partner is the one who can make it.

---

## 16. Meaning confirmation

### 16.1 Confirmation, not message approval

The success condition is **shared meaning**, not a generated sentence.

```text
AI hypothesis (shown to partner):
  明日の病院は10時

Partner asks the person.

Person:
  [ はい ]   [ ちがう ]
```

If `はい`, the pair has succeeded. Nothing further is required.

### 16.2 Confirmation is weak evidence

A single `はい` is **not** strong evidence of agreement. Hearing evidence is explicit that people
with aphasia may answer affirmatively out of politeness, fatigue, or to end an exchange they cannot
follow.

Therefore:

- a single yes is sufficient to proceed **within** the conversation
- a single yes is **not** sufficient to store an inferred meaning durably (§18.4 path B)
- where a confirmation matters (medication, appointments, consent), prefer a check that can fail:
  show the alternative, ask which, or restate differently

### 16.3 Optional sentence rendering

When a full sentence is actually useful — to show or speak to a third party — it can be produced
from confirmed meaning:

```text
明日の病院は10時です。
```

This is an **output format**, not the goal, and it is produced only after §16.1 confirmation and
after passing §17.

---

## 17. Meaning safety

Any generated text is checked before display or output. This is a dedicated check, not a general
instruction to "be accurate."

Checked dimensions:

| Dimension | Failure example |
|---|---|
| negation / affirmation | 「薬 飲まない」 → 「薬を飲む」 |
| person / subject | the person going vs their daughter going |
| time | tomorrow vs today |
| number / quantity | 10時 vs 10日 |
| medication | a drug name or dose not present in the input |
| action | stop vs continue |
| consent / refusal | agreeing vs declining |

### 17.1 Polarity reversal is a severe error

Two independent studies of AI reconstruction of aphasic speech observed polarity errors: a negated
utterance rendered as its affirmative, and a model inserting negation at a measurable rate.

Overall semantic similarity can be high while the practical meaning is inverted. Similarity scores
therefore do not detect this class of error, and a dedicated check is required.

In medical, medication, and consent contexts this is the most dangerous failure mode the product
has.

### 17.2 Behaviour on failure

A candidate failing a safety check is not silently repaired. It is suppressed, and the system
degrades to §15.3 fallback.

### 17.3 No unsupported detail

Generated text preserves confirmed meaning and adds nothing that was not in the input or in
confirmed context.

---

## 18. Personalization

### 18.1 Vision retained, implementation staged

The vision in §1.1 stands. What is staged is *how* it is implemented and *when* it is validated.

### 18.2 Personal Context Memory — the Phase 2 primary

The personalization target is **this person's context**:

```text
people        family, friends, regular staff, names that recur
places        home, hospital, frequent destinations
schedule      appointments, routines, weekly patterns
interests     hobbies, subjects the person cares about
topics        subjects that recur in their conversations
```

Rationale: the evidence supports *topic and context knowledge* as the thing that separates a
listener who understands from one who does not. A supporter who knows about mobile-phone plans can
interpret fragments about a mobile-phone plan; one who does not, cannot. A partner who knows the
person worked for a railway can interpret a great deal that is otherwise opaque.

In Phase 1 this context may be **researcher-prefilled** before a session (§7.3), which tests the
same hypothesis without building persistence.

### 18.3 Expression Memory — experimental, deferred

A dictionary mapping a person's idiosyncratic productions to meanings:

```json
{ "expression": "...", "meaning": "...", "confirmedCount": 3 }
```

This is **explicitly experimental and deferred**, because its central assumption is unverified:

> that a given person reproduces the *same* erroneous expression for the *same* intended meaning,
> stably, across occasions.

**Available evidence does not establish that such mappings are stable within a person.**

The interview evidence describes semantic substitutions (intending one word, producing a
semantically adjacent one) and interpretation that relies heavily on situation, gesture, and shared
history. It does not tell us whether the *same* erroneous form reliably recurs for the *same*
intended target, because no source observed the same target across repeated occasions and reported
the result either way.

So the honest position is absence of evidence, not evidence of absence. The product must therefore
not assume stable `expression → meaning` mappings without direct validation for the target user.

**Required before this is built:** direct confirmation from clinicians or family that stable,
recurring idiosyncratic expressions exist for a target user — specifically, whether a given person
produces the same form for the same intended target on separate occasions. This is a single
question to sources already engaged with this project, and it should be asked before any
implementation effort.

### 18.4 Memory provenance and save rules

Durable personal memory can enter the system through two different paths, and they do **not** carry
the same risk. The save bar differs accordingly.

#### A. Deliberately provided context

Examples:

- family member names
- regular places
- routines
- interests
- appointments
- recurring topics

This information may be stored when it is deliberately entered or approved by the person, or by an
authorized supporter in the research setting.

It does **not** require repeated conversational confirmation.

#### B. Inferred communication meaning

Anything inferred from what the person *may have intended to communicate* requires a higher bar:

```text
AI proposes a meaning
        ↓
the two people discuss it
        ↓
the person explicitly confirms
        ↓
the same interpretation is confirmed again on a separate occasion
        ↓
store
```

Never store durable inferred meaning from:

- AI inference alone
- partner inference alone
- a single confirmation
- an interpretation the person has rejected

A stored inferred meaning is **demoted immediately** if later contradicted.

Rationale for the asymmetry: a wrong name or a wrong appointment is visible and correctable, and
the person or supporter chose to enter it. A wrong inferred meaning is neither — it was produced by
the system, it may be confirmed by a compliant yes (§16.2), and once stored it anchors future
partners to an incorrect reading. That is the exact failure §26 question 6 is meant to detect.

### 18.5 Later requirements for memory

These must be resolved before any memory feature ships beyond a research setting:

- **Confirmation reliability.** How many confirmations, over what spacing, before storing? How is a
  compliant yes distinguished from an agreeing yes?
- **Wrong-memory recovery.** How is a bad entry detected, demoted, and removed? What happens to
  decisions already made on it?
- **Review and deletion.** The person must be able to see everything stored about them and delete
  any of it, in a form they can actually read.
- **Privacy and dignity.** A record of how a person misspeaks is a record of their disability. Its
  portability across partners is the feature *and* the risk: it exposes error patterns to people who
  would not otherwise see them. Who may view it, for how long, and under whose control must be
  answered explicitly.
- **Consent.** Who consents to its creation, and can that consent be withdrawn?

---

## 19. Main UI states

```text
IDLE
    Session not started.

CONVERSATION_ACTIVE
    Session running. Context accumulating.
    Natural conversation is primary. No AI display.

RECEPTIVE_SUPPORT_READY
    A simplified form of the partner's speech is available.

MEANING_HINT_READY
    The AI holds one or more hypotheses
    and has NOT surfaced them.
    Internal state only — nothing is shown (§20.2).

PARTNER_HINT_VIEW
    A person chose to view the hypotheses.

MEANING_CONFIRMATION
    The person confirms or rejects a meaning.

CONVERSATION_CONTINUES
    Confirmed meaning folded into session context.

FALLBACK
    Meaning remains unclear. Normal path (§15).
```

`MEANING_HINT_READY` is the structurally important state: **the AI has something and is not showing
it.** Without this state, inference and intervention cannot be separated.

---

## 20. Intervention policy

### 20.1 Phase 1 stance

Phase 1 does **not** attempt to solve when the AI should intervene.

Default: natural conversation first. A held hypothesis does not take over the screen.

> **Phase 1 does not automatically surface hypothesis availability.**
>
> The AI may prepare hypotheses in the background, but the UI exposes them only when a person
> explicitly invokes `[ ことばのヒント ]`.
>
> Whether and when the system should proactively indicate that help is available is a Phase 2 /
> later research question.

### 20.2 No availability indicator in Phase 1

There is no badge, no banner, no "ヒントがあります" notice, and no peripheral signal that the AI has
something to offer.

Rationale: any such signal, however quiet, is an intervention. Giving it a trigger condition —
however conservative — reintroduces the automatic-intervention problem that Phase 1 explicitly
declines to solve. Support is pulled by a person, never pushed by the system.

`MEANING_HINT_READY` remains as an **internal** state (§19). Its value is precisely that it is not
visible.

### 20.3 Silence is never a trigger

The product must not treat a pause, hesitation, or slow retrieval as a request for help.

Grounds:

- hearing evidence states that waiting is the core skill of good support, and that pre-empting the
  person is unwelcome even when correct
- turn-taking research shows that fixed silence thresholds cause unnecessary interruptions; a model
  using richer cues cut interruptions from roughly one in six to roughly one in fifteen
- automatic detection of communication trouble is known to miss the non-repetition cases — silence,
  no response, topic abandonment — precisely the cases silence-triggering would claim to catch

### 20.4 Future automatic triggers

Candidates for later evaluation, none enabled in Phase 1:

- explicit request for repetition
- the same word repeated across turns
- repeated failed repair attempts
- repeated rejection by the person
- an explicit request from the partner

Excluded permanently as a sole trigger: silence.

---

## 21. Accessibility and interaction safety

### 21.1 General

- large touch targets
- low density; minimal scrolling
- no icon-only controls for primary actions
- pair icons with text
- one-screen completion for the core interaction
- high contrast, large readable text
- short wording, no technical language
- no distracting animation
- primary actions keep a stable position

### 21.2 One-handed, left-handed operation

> **The prototype must be fully usable one-handed with the left hand.**
>
> Left-hand reachability is a primary test case, not an assumption about every user. Do not design
> any primary action that requires right-hand reach.

Rationale: aphasia frequently co-occurs with right hemiparesis, so a substantial share of users will
operate the phone with the left hand only. This is a capability the prototype must have, not a
prediction about who any given participant is.

Requirements:

- all primary actions within left-thumb reach in portrait
- equally, no primary action placed where only a right thumb reaches it
- no interaction requiring two hands
- no gesture requiring simultaneous touches
- avoid placing destructive and primary actions adjacent within the thumb arc
- verify reachability on a real device, not only in a desktop browser

### 21.3 Psychological and interaction safety

- never label the person's speech as incomprehensible
- never repeatedly display communication failure as a status
- never require the person to continuously correct the AI
- never interrupt a pause
- never rapidly replace text the person may still be reading (§11.3)
- preserve natural eye contact — the partner view must be glanceable, not absorbing
- keep the AI visually secondary unless support is actively in use

---

## 22. Non-verbal presentation

### 22.1 Priority 1 for the person's view

Text-only presentation is a Phase 1 risk, not a Phase 2 refinement.

Grounds: clinical hearing evidence states plainly that candidates presented as text may not be
readable by a substantial part of this population, while **picture comprehension is typically
preserved** — written words are language and are impaired; pictures are not. Design research with
people with aphasia likewise found that images helped people notice when a system had misunderstood
them.

### 22.2 Scope

- icons paired with every support control (§14)
- icons or images alongside meaning options where an image is unambiguous
- text and image together by default, not either alone

### 22.3 Individual variation

Image support is not universally helpful — the same research found picture-based summaries were
valued by some users and burdensome to others.

Phase 1 therefore treats text/image balance as an **observed variable** (§25.4), and Phase 2 exposes
it as a setting alongside §11.4.

### 22.4 Out of scope

Image *recognition*, camera understanding, and complex picture-based composition remain out of scope
(§27). This section is about **presentation**.

---

## 23. Content rules

### 23.1 Wording

Short words, short questions, concrete language. No long explanations, no abstract labels, no
multiple questions in one sentence.

### 23.2 Options differ in meaning

Options must differ in meaning, not phrasing.

Bad:

```text
[ I will go to the hospital ]
[ I'm going to the hospital ]
[ I plan to visit the hospital ]
```

Better:

```text
[ わたしが 行く ]
[ 娘が 行く ]
[ お見舞いに 行く ]
```

### 23.3 Hypotheses are labelled as such

Partner-facing hypotheses are always visibly the AI's guess, never presented as the person's words.

### 23.4 No AI branding in the main area

The person sees the communication task, not the technology. Do not label the main area "AI".

---

## 24. Research comparison conditions

Minimal switches — a researcher setting or query parameter — not an experiment framework. Not all
conditions need to run in one test.

### 24.1 Baseline

```text
A0. No assistance — ordinary human-to-human conversation.
    The system may record / log for research,
    but shows no AI output and no transcript.
```

**This condition is required.** Without it, dyadic measures are uninterpretable.

A0 is distinct from B0 below: A0 shows the pair *nothing*, B0 shows a transcript. Collapsing them
would make it impossible to tell whether a transcript alone already accounts for any observed
effect.

The baseline also guards against a specific risk. The closest comparable study found that the
condition giving the speaker *less* control produced *better* mutual understanding — a result that
is only visible against a no-assistance comparison.

### 24.2 Receptive support

```text
B0. transcript only
B1. conditional simplification
```

### 24.3 Partner understanding support

```text
C0. fragment only
C1. fragment + conversation context
C2. fragment + conversation context + personal context
```

C2 uses researcher-prefilled personal context in Phase 1 (§7.3).

---

## 25. Validation focus

Evaluation is **dyadic**. Measuring the person's experience alone cannot answer whether meaning
actually arrived.

### 25.1 Person with aphasia — observe

- is the AI's presence unwelcome?
- any sense of being interpreted without consent?
- do they still feel they are the one communicating?
- does simplification help comprehension?
- is too much information lost?
- is confirmation burdensome?
- is text alone readable, or are icons/images needed?

### 25.2 Conversation partner — observe

- do they understand the person's intent more accurately?
- are hypotheses useful as conversational openings?
- **are they anchored by wrong hypotheses?**
- can they repair more naturally than without AI?
- does looking at the screen damage eye contact and conversational flow?
- **when do they choose to invoke `[ ことばのヒント ]`, and when do they not?** (this is the
  observation that informs whether proactive indication is worth exploring in Phase 2 — §20.2)

### 25.3 The dyad — measure

- was shared meaning reached?
- time to shared meaning
- number of clarification exchanges
- number of repair attempts
- conversation breakdown rate
- did conversation continue naturally?

All against the §24.1 baseline.

### 25.4 Observed variables

Not eligibility criteria; recorded to interpret results:

- executive load — is selection burdensome? can the person sequence steps? can they follow an AI
  correction? (§4.3)
- modality preference — text, icon, image, speech (§22.3)
- fatigue over the session
- one-handed operation in practice (§21.2)

---

## 26. Success criteria

This prototype succeeds if it answers product questions, not if it behaves like a finished app.

1. Can the partner understand the person's intended meaning more accurately than without the
   product?
2. Can the person understand complex partner speech more easily?
3. Does the product help the pair recover from breakdowns?
4. Does the person still feel that *they* are communicating?
5. Does the AI stay out of the way when natural communication is working?
6. Do hypotheses help, rather than anchor the partner to a wrong reading?
7. Does knowing the person's context measurably help the partner understand them?
8. Does simplification preserve enough information?
9. Is one-handed, left-handed operation actually workable?
10. What support should be removed before any automation is added?

The primary success metric is **not** candidate accuracy. It is:

> whether the two people reach shared meaning.

---

## 27. Non-goals

For this prototype:

- not a speech-language therapy platform
- not a rehabilitation exercise app
- not a clinician dashboard
- not a diagnostic or severity-assessment tool
- not an autonomous conversational agent
- no automatic sending of inferred messages
- no automatic speaking of inferred messages
- no requirement that every fragment become a complete sentence
- no automatic learning from unconfirmed interpretations
- no large-scale learned personal language model
- no permanent storage of conversation transcripts
- no requirement to detect every communication breakdown automatically
- no requirement to intervene at the perfect moment automatically
- no background passive monitoring
- no speaker diarization
- no image recognition, camera understanding, or eye tracking
- no phone-call integration
- no first-meeting / stranger partner UX (§4.5)
- not intended to support all severities or all subtypes equally
- no production medical-data infrastructure

---

## 28. Later opportunities

Not to be implemented unless the Phase 1 core works.

- Personal Context Memory persisted across sessions (Phase 2, §18.2)
- adjustable simplification level as a user setting (§11.4)
- adjustable text/image balance (§22.3)
- Expression Memory, if and only if §18.3 is verified first
- proactive indication that help is available, and its trigger condition (§20.2)
- automatic intervention timing (§20.4)
- automatic support-level adaptation
- map / location-based expression — independently raised by multiple clinical sources as effective
  for destinations and appointments
- picture-based confirmation
- richer multimodal communication
- clinician-assisted profile setup
- phone-call integration — prior AAC work found the largest gains in telephone situations, where
  gesture and pointing are unavailable
- a separate UX for first-meeting partners and unexpected situations (§4.5)
- local / private processing where required

---

## 29. Implementation priority

### 29.1 Phase 1 — must work for the user test

1. mobile-first conversation-session UI
2. explicit session start / stop
3. rolling recent conversation context (§7.1, §7.2)
4. partner speech transcription
5. conditional receptive simplification with a gate (§11.2)
6. chunk-settled display, no continuous rewriting (§11.3)
7. speech and typed fragment capture (§12)
8. contextual meaning-hypothesis generation, 0–3 (§13)
9. `MEANING_HINT_READY` — hypotheses held, not shown (§19)
10. human-invoked support only; no automatic intervention (§20)
11. support request controls: もう一回 / ゆっくり / 短く / ちがう (§14)
12. non-verbal presentation — icons and images in the person's view (§22)
13. meaning confirmation (§16)
14. meaning safety checks, polarity first (§17)
15. clear fallback as a normal path (§15.3)
16. one-handed left-hand layout (§21.2)
17. researcher-prefilled personal context for condition C2 (§7.3)
18. AI-off baseline switch (§24.1)

### 29.2 Phase 2 — after Phase 1 validates

19. Personal Context Memory persisted across sessions (§18.2)
20. adjustable simplification level (§11.4)
21. adjustable text/image balance (§22.3)
22. optional final-sentence rendering (§16.3)
23. TTS for confirmed output
24. rotated partner-facing display for third parties
25. home-screen / PWA polish

### 29.3 Removed from the core

These were central in the previous revision and are no longer:

- fixed `time → topic → content` clarification ordering
- mandatory two-round clarification depth
- three complete sentence candidates as the primary expressive flow
- the requirement that every fragment become a final sentence
- `[ I don't understand ]` as a labelled control
- the rotate-to-partner final message as a core deliverable
- Mode A vs Mode B as the primary research comparison
- optimizing automatic AI intervention

### 29.4 Deferred indefinitely

- accounts, persistence beyond §18, offline, production analytics
- background audio, diarization, native distribution
- Expression Memory, pending §18.3

---

## 30. Final product definition

The product is **not** an AI that speaks instead of a person with aphasia, and **not** an AI that
continuously corrects their communication.

It is a communication aid that helps two people understand each other.

For the person with aphasia, it can reduce complex partner speech into a form that is easier to
process.

For the conversation partner, it can use conversation context and knowledge of the person to suggest
what the person may be trying to communicate.

Natural conversation remains primary. The AI supports communication when it is useful, and replaces
neither person.

Over time, the product should become better at understanding *this person's* communication, through
person-specific context that is either deliberately provided or safely learned.

Any inferred meaning about what the person intended to say must never become durable memory from AI
inference alone.

The single design test to apply to any proposed change:

> Does this increase conversation between the two people,
> or does it increase interaction with the AI?

Prefer the first.
