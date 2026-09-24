<!--
Sync Impact Report (1.2.0)
- Version change: 1.1.0 → 1.2.0 (minor: Principle VII materially expanded)
- Modified principles: VII (User Decides, AI Proposes) — made explicit what the
  principle always intended but did not state, namely the difference between (a)
  showing an AI hypothesis to a conversation partner in order to repair a
  conversation and (b) presenting something as the person's own statement. The
  prior wording ("before it reaches anyone else or is treated as the user's
  statement") could be read as prohibiting (a) outright, which would forbid the
  central mechanism of the revised product design (docs/product.md §13,
  docs/architecture.md §A7.2). The purpose of the principle is unchanged: the AI
  must not put words in the person's mouth.
- Added normative content within VII: a partner-facing hypothesis MUST be marked
  as unconfirmed AI inference, and MUST NOT be rendered as the person's words.
  This requirement did not exist before.
- Version rationale: classified MINOR rather than PATCH because a new MUST was
  added, not only wording clarified. Product may downgrade to 1.1.1 if it judges
  this purely editorial.
- Principle VIII: unchanged. The revised design satisfies it — the bound is now
  one hypothesis-generation attempt yielding 0–3 candidates, after which the
  product reports that it could not tell (docs/product.md §15). What is obsolete
  is the old task-level mapping of VIII onto "max two clarification rounds", not
  VIII itself.
- Added sections: none
- Removed sections: none
- Follow-up TODOs: none
-->

<!--
Sync Impact Report (1.1.0, historical)
- Version change: 1.0.1 → 1.1.0 (minor: new principles added)
- Modified sections: removed "Additional Constraints" — it held temporary,
  implementation-specific conditions (target platform, current user-profile scoping)
  that belong in docs/product.md / specs/ / agent/tasks/, not the constitution, per
  explicit product direction to keep this document to durable, long-term principles
  only. Those facts remain recorded in docs/product.md §3–§4 and
  specs/001-aphasia-conversation-aid/spec.md.
- Added sections: Principle VII (User Decides, AI Proposes) and Principle VIII
  (Bounded Inference) — durable rules (AI must not decide/act/speak for the user;
  AI must not guess without a bound) that were previously only stated at the
  product/spec level (docs/product.md §5.5/§5.7, spec.md FR-006/FR-012) and are
  promoted here as long-term constitutional principles.
- Removed sections: Additional Constraints
- Follow-up TODOs: none
-->

<!--
Sync Impact Report (1.0.1, historical)
- Version change: 1.0.0 → 1.0.1 (patch: factual update to Additional Constraints, no
  principle wording changed)
- Modified sections: Additional Constraints — primary user profile and target platform
  bullets updated to reflect decisions now recorded in docs/product.md (mild-to-moderate
  Broca-like profile; mobile-first web app, not native), replacing "undecided" language
- Added sections: none
- Removed sections: none
- Follow-up TODOs: none
- Note: this Additional Constraints content was itself removed in 1.1.0 — see above.
-->

<!--
Sync Impact Report (1.0.0, historical)
- Version change: (none) → 1.0.0 (initial ratification)
- Modified principles: n/a (first version)
- Added sections: Core Principles (I-VI), Additional Constraints, Development Workflow, Governance
- Removed sections: n/a
- Templates requiring updates: none pending (no dependent templates reference prior placeholders)
- Follow-up TODOs: RATIFICATION_DATE set to today (2026-09-16), the date this constitution was
  first adopted; no other deferred placeholders remain.
-->

# aphasia-bidirectional Constitution

## Core Principles

### I. Accessibility-First (NON-NEGOTIABLE)
The primary user is a person with aphasia. Every feature MUST minimize cognitive and
language load: minimal required typing, tolerance for fragmented/partial/misspelled
input, large and simple UI, and no reliance on fluent language production or
comprehension to operate the product itself. Any feature that increases the burden on
the primary user to gain a secondary benefit (e.g. for caregivers, clinicians, or
analytics) MUST be rejected or redesigned.
Rationale: this is the population the product exists to serve; convenience for anyone
else is subordinate.

### II. Bidirectional by Design
Every release MUST consider both conversation directions: expressive (helping the
person produce a clear thought) and receptive (helping the person understand what
others say). Support across the two directions MAY be asymmetric or lightweight, but
neither direction may be silently dropped from scope without an explicit product
decision recorded in docs/product.md.
Rationale: the product's reason for existing is the bidirectional gap in real
conversations; a one-directional tool is a different, lesser product.

### III. Real-World Conversation Fitness
The product MUST be usable during a live, real-time conversation, not only as an
offline drafting or journaling tool. Latency and interaction simplicity take priority
over feature richness. Any feature whose response time or interaction cost makes it
impractical mid-conversation MUST be deferred or redesigned before release.
Rationale: a tool too slow or cumbersome for live use fails the core use case even if
it works well asynchronously.

### IV. Privacy and Dignity
Conversation content and any inferred health/disability information are sensitive.
The product MUST avoid unnecessary data retention, MUST avoid design choices that
infantilize or stigmatize the user, and MUST keep the person with aphasia in control
of what is captured, stored, or shared with others. Data collection beyond what a
feature requires to function MUST be justified explicitly, not assumed.
Rationale: this product handles health-adjacent personal data for a population
vulnerable to being spoken over or about; trust and dignity are part of the product,
not an add-on.

### V. Evidence Before Scope Expansion (YAGNI)
Clinical/therapy features, deep personalization, and new input/output modalities MUST
NOT be added until real usage of the lightweight v1 (as scoped in docs/product.md)
justifies the need. Scope beyond docs/product.md requires an explicit product
decision, not inference from chat or assumption during implementation.
Rationale: this is a new, unvalidated product; premature scope expansion burns effort
on unvalidated assumptions and adds accessibility risk (Principle I) with every added
surface.

### VI. Spec-and-Repo-Are-Truth
Product decisions MUST live in docs/ and specs/, not only in conversation history.
When a requirement or behavior is ambiguous, implementers MUST escalate to the
Product agent rather than invent requirements. Chat history is not a durable source
of project state.
Rationale: durable, inspectable artifacts keep the team (and future agents) aligned
without re-deriving decisions each session; codified in CLAUDE.md as an operating
rule for this repository.

### VII. User Decides, AI Proposes
The AI MUST NOT autonomously communicate, send, speak, or act on behalf of the user.
Any AI-generated candidate message, response, or inferred meaning is a proposal only.

This principle governs **whose statement something is**. It does not prohibit anyone
other than the person from seeing an AI proposal. The distinction is as follows.

**Partner-facing hypotheses are permitted.** An AI-generated hypothesis about what the
person may be trying to communicate MAY be shown to the conversation partner, for the
purpose of repairing the conversation, before the person has confirmed it. This is
support addressed to the partner — a suggestion of what to ask the person about — not
speech attributed to the person.

**Such a hypothesis MUST be marked as unconfirmed AI inference** wherever it appears. It
MUST NOT be rendered as the person's words, quoted as their utterance, or presented in a
way that invites the partner to treat it as settled rather than as something to check
with the person.

**The person's explicit confirmation is required before anything is presented, sent,
spoken, or stored as the person's own statement, intent, or decision.** This includes a
message shown to a third party as the person's words, text-to-speech output, and any
meaning carried forward as something the person meant.

Rationale: the person with aphasia's authority over their own words is the point of the
product; an AI that decides or speaks for them, even with good intentions, replaces the
person it exists to support. But a partner who cannot understand the person is the
failure this product exists to address, and helping that partner form a better question
is not the same as speaking for the person. The danger is misattribution, not visibility.

### VIII. Bounded Inference
The AI MUST NOT continue guessing indefinitely when it cannot determine the user's
intent or meaning. Every inference/clarification process MUST have an explicit
bound, and on reaching that bound the product MUST hand control back to the user
with a clear acknowledgment that it could not resolve the ambiguity, rather than
keep producing new guesses.
Rationale: unbounded guessing wastes the user's limited time and energy in a live
conversation (Principle III), and an incorrect but confident-looking guess is more
harmful than an honest "I couldn't tell."

## Development Workflow

- Features are scoped and defined by the Product agent per agent/roles/product.md
  before implementation begins; handoff occurs via agent/tasks/<TASK-ID>/task.md.
- Every feature spec and plan MUST be checked against these principles before the
  Coding agent begins implementation; violations MUST be justified in writing in the
  spec/plan or the feature MUST be redesigned.
- QA and review agents MUST verify accessibility (Principle I) and real-time
  usability (Principle III) as first-class acceptance criteria, not optional
  polish.

## Governance

This constitution supersedes conflicting practices described elsewhere in the
repository, except CLAUDE.md's repository-as-source-of-truth rule, which this
constitution reinforces rather than overrides.

Amendments require: (1) the change proposed and recorded in this file, (2) a Sync
Impact Report prepended as an HTML comment describing what changed and why, (3) a
version bump per semantic versioning (MAJOR for incompatible principle
removal/redefinition, MINOR for new/materially expanded principles or sections,
PATCH for clarifications/wording), and (4) update of the Last Amended date.

All specs, plans, and task handoffs MUST be checked for compliance with these
principles before implementation is marked ready. Complexity or scope that conflicts
with a principle MUST be justified explicitly in the relevant spec/plan rather than
silently overridden.

**Version**: 1.2.0 | **Ratified**: 2026-09-16 | **Last Amended**: 2026-09-24
