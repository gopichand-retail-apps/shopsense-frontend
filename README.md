# ShopSense Workspace

This repository contains the ShopSense AI shopper-facing product discovery workspace. It owns localized presentation, catalog filtering, product comparison, device-local saved items, and appearance preference. The separate API owns catalog reads, grounded ranking, and feedback persistence.

## Run Locally

Use Node.js 22.13 or later.

```sh
npm install
npm run dev
```

The frontend binds to `127.0.0.1:5801`. Same-origin `/api/v1/*` requests are rewritten to the selected API origin. Mock mode (`NEXT_PUBLIC_IS_MOCK=true`, the default) uses `SHOPSENSE_MOCK_API_URL`; during development it falls back to `SHOPSENSE_API_URL` and then `http://127.0.0.1:5802`. Live mode (`NEXT_PUBLIC_IS_MOCK=false`) requires `SHOPSENSE_REAL_API_URL`. Start the local API separately from `../shopsense-backend`; it listens on `127.0.0.1:5802`. Mode and rewrite settings are read at start/build time.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:cov
npm run test:e2e
NEXT_PUBLIC_IS_MOCK=false npm run test:e2e
```

`npm run test:cov` enforces at least 90% statements, branches, functions, and
lines. Each E2E command builds into a dedicated test directory and runs
Playwright against isolated production servers on ports `5881/5882` with
in-memory SQLite. It does not overwrite the local app build or reuse the UI/API
on `5801/5802`. Install Chromium once with
`npx playwright install chromium` if needed.

For a standalone production build, select and configure the API origin:

```sh
NEXT_PUBLIC_IS_MOCK=true \
SHOPSENSE_MOCK_API_URL=http://127.0.0.1:5802 \
npm run build
```

For isolated custom ports in mock development, set the API rewrite before the build, then set the Playwright ports:

```sh
SHOPSENSE_MOCK_API_URL=http://127.0.0.1:5804 npm run build
SHOPSENSE_FRONTEND_PORT=5803 SHOPSENSE_API_PORT=5804 npx playwright test
```

For live-mode local verification, set `NEXT_PUBLIC_IS_MOCK=false` and
`SHOPSENSE_REAL_API_URL=http://127.0.0.1:5802` before running the frontend.
The E2E runner starts its own local API with synthetic data; the "live" E2E
mode verifies routing to the selected API origin, not a third-party production
integration.

## Content and Integration

[`public/shopsense-ai-model.json`](public/shopsense-ai-model.json) supplies user-facing copy, category labels, filters, theme preferences, and synthetic catalog records using the strict `version`/`appId`/`locale`/`messages`/`data` contract. `src/lib/api.ts` validates model and API response shapes before rendering. Saved product IDs and appearance preference are device-local and are not an account or cross-device sync feature.

API failures map stable error codes to model copy; backend-provided message text is not rendered directly.

See the [canonical architecture and workflow diagrams](../docs/architecture.md), [threat model](../docs/security/README.md), [quality status](../docs/quality.md), and [API setup and contract](../shopsense-backend/README.md). Identity, catalog-editor authorization, and remote exposure are not currently implemented.
