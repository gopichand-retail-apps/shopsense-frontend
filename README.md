# ShopSense Workspace

[Architecture guide](docs/architecture.md) — source map, workflows, contracts, data, security, and checks.

## Repository layout and Windows workflow

This is the ShopSense AI Next.js frontend repository. It keeps its own Git history, origin, package manifest, and lockfile; the API is the independent [shopsense-backend](https://github.com/gopichand-retail-apps/shopsense-backend) repository. Place the pair under one ShopSenseAI folder to use the supplied single-folder VS Code workspace.

Use Node **24.15.0** and npm with the committed lockfile. From this repository in PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

The client is at http://127.0.0.1:5801; start the API separately. For both services in the complete Retail Apps workspace, use `./scripts/Start-Apps.ps1 -App ShopSenseAI` from the workspace root. Use `-EnvironmentName IT` only for the independent IT copies.

See the [app overview](docs/architecture.md#1-scope-users-and-repository-boundary) and [canonical architecture](docs/architecture.md). The architecture guide is included in this repository. No cross-app backend integration is added by this organization change.

This repository contains the ShopSense AI shopper-facing product discovery workspace. It owns localized presentation, catalog filtering, product comparison, device-local saved items, and appearance preference. The separate API owns catalog reads, grounded ranking, and feedback persistence.

## Run Locally

Use Node.js 22.13 or later.

```sh
npm ci
npm run dev
```

The frontend binds to `127.0.0.1:5801`. Same-origin `/api/v1/*` requests are rewritten to the selected API origin. Mock mode (`NEXT_PUBLIC_IS_MOCK=true`, the default) uses `SHOPSENSE_MOCK_API_URL`; during development it falls back to `SHOPSENSE_API_URL` and then `http://127.0.0.1:5802`. Live mode (`NEXT_PUBLIC_IS_MOCK=false`) requires `SHOPSENSE_REAL_API_URL`. Start the local API separately from `../shopsense-backend`; it listens on `127.0.0.1:5802`. Mode and rewrite settings are read at start/build time.

## Checks

For a clean checkout, configure the selected API and run the build before type checking so Next.js can generate its route types:

```powershell
$env:NEXT_PUBLIC_IS_MOCK = 'true'
$env:SHOPSENSE_MOCK_API_URL = 'http://127.0.0.1:5802'
npm.cmd run build
npm.cmd run typecheck
```

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

See the [canonical architecture and workflow diagrams](docs/architecture.md), [threat model](docs/architecture.md#8-security-privacy-and-egress), [quality status](docs/architecture.md#13-dated-verification-and-limitations), and [API setup and contract](https://github.com/gopichand-retail-apps/shopsense-backend/blob/main/README.md). Identity, catalog-editor authorization, and remote exposure are not currently implemented.

## Vercel frontend configuration

Import this frontend's GitHub repository as its own Vercel project. Set **Root Directory** to the repository root (`./`), **Node.js Version** to **24.x**, and keep the checked-in [vercel.json](vercel.json). It selects Next.js, with native Next output/routing with `npm ci` and `npm run build`. Do not set a static dist output or add an SPA rewrite over Next routes.

Set `NEXT_PUBLIC_IS_MOCK=true` and `SHOPSENSE_MOCK_API_URL` to an approved isolated HTTPS API **origin without /api/v1**. For the other selector, set `NEXT_PUBLIC_IS_MOCK=false` and `SHOPSENSE_REAL_API_URL`. The [environment template](.env.vercel.example) lists exact names; it is documentation, not an automatically loaded production configuration. Replace its reserved .invalid host. Changing mode or endpoints requires a new build/deployment. Both selectors still call an API; neither creates a browser-only backend or real provider integration.

The existing Next rewrite forwards /api/* to the selected API. A hosted API needs independently verified identity, persistence, exact origin/CORS and session/CSRF settings. Existing APIs remain local-only; localhost in a deployed bundle would point at the visitor or build machine.

The configuration adds noindex, frame/content-type/referrer/permission protections and no-store for the active UI model. Headers and noindex do not provide access control. Keep preview deployment protection enabled and use synthetic data. Hosted routing, cookies, headers, and user workflows have **not** been verified; no deployment is performed.

Known release gaps: Shopper/catalog-editor identity and authorization are not established. Remote Unsplash images, formatting, generated-type ordering, and dialog-focus work remain. IT image smoke failed; do not label all checks passing.
