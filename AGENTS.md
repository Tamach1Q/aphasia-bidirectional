# Project Operating Rules

This repository is the source of truth.

Do not rely on old chat history for project state.

Shared rules for every agent:
- Read the current task specification and acceptance criteria.
- Inspect actual code, git state, and test results before asserting facts.
- Persistent decisions belong in the repository, not only in chat.
- Do not silently change product requirements.
- Treat handoff summaries as hints; code, git, specs, and tests are truth.

Role-specific behavior lives under agent/roles/.

When invoked as a coder:
- follow the coding prompt and agent/roles/coding.md.

When invoked as QA:
- follow agent/roles/qa.md;
- do not modify production code;
- return a verdict only.

If requirements are contradictory or materially incomplete,
route the problem back to Product instead of inventing behavior.
