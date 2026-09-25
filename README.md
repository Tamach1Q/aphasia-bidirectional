# aphasia-bidirectional

Mobile-first validation prototype for bidirectional conversation support for people with aphasia.
The product and architecture are defined in `docs/product.md` and `docs/architecture.md`; the active
implementation task is `specs/002-context-aware-dyadic-support/`.

## Development serving mode

Serve the repository root so both the app and browser test harness are reachable:

```bash
python3 -m http.server 8000
```

- App: `http://localhost:8000/app/`
- Browser tests: `http://localhost:8000/tests/browser/`
- Unit tests: `node --test tests/unit/*.test.js`

There is no build step and no package install requirement for the app.

## Deployment serving mode

Deployment serves `app/` only. The `tests/`, `tools/`, `specs/`, and repository documents are not
part of the published artifact.

To reproduce the deployed shape locally:

```bash
python3 -m http.server 8000 --directory app
```

Do not move the browser test harness under `app/` for convenience; keeping test surfaces out of the
published artifact is intentional.

## Sensitive data rule

`app/context/` and `app/fixtures/` are publicly served assets and contain synthetic data only. Real
participant context is loaded on-device into memory for a research session and must never be committed,
placed in a URL, or persisted by the app.

See `specs/002-context-aware-dyadic-support/quickstart.md` for the complete validation procedure.
