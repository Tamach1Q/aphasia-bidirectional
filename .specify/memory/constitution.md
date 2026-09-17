<!--
Sync Impact Report (1.1.0)
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
Any AI-generated candidate message, response, or inferred meaning MUST be presented
as a proposal only, and MUST require the user's own explicit confirmation before it
reaches anyone else or is treated as the user's statement.
Rationale: the person with aphasia's authority over their own words is the point of
the product; an AI that decides or speaks for them, even with good intentions,
replaces the person it exists to support.

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

**Version**: 1.1.0 | **Ratified**: 2026-09-16 | **Last Amended**: 2026-09-17
