# app/context/ — SYNTHETIC FIXTURES ONLY

> **This directory is published.** Everything under `app/` is served as a static file from public
> hosting and is fetchable by anyone who knows the URL.

## What may go here

Invented sample personal-context files, used for development, demos, and rehearsal. Loaded with
`?config=<id>`.

## What must never go here

**No real participant data.** Specifically, no real person's:

- name, or the name of their family member, supporter, or clinician
- hospital, clinic, home area, or any place they actually go
- appointment, routine, or schedule
- interests or recurring conversation topics, if they are a real person's
- utterance, transcript, or fragment

Placing a real participant's personal context here would persist their information in the
repository **and** in the deployment — defeating the "no persistence" decision (`docs/product.md`
§5.4, §18) in the one place it matters most.

**Committing a real participant file here is a review-blocking error.**

## How real context is loaded instead

On the device, at session start, by the researcher — via a local file or an on-device form. It is
held in memory only and is gone on reload. Nothing is written to `localStorage`, IndexedDB, cookies,
or any server.

See `docs/architecture.md` §A2.4 and `specs/002-context-aware-dyadic-support/spec.md` FR-004/FR-005.

## Note on the `_note` key

`sample-01.json` carries a `_note` field because JSON cannot hold comments. It is ignored by the
loader. Keep it in any fixture added here.
