# Paperclip Commerce Edition

Agentic workflow platform for e-commerce operations. Two things were the focus of
the current iteration:

1. **The AI provider layer is now configuration, not code** — eleven providers are
   supported through four protocol drivers, resolved from the Settings UI or `.env`,
   with retries and automatic fail-over.
2. **Content production is a real pipeline** — product research → multi-platform
   captions → marketplace SEO → visual direction → posting schedule, persisted as
   reviewable work products.

---

## 1. Quick start

```bash
pnpm install          # installs every workspace package
cp .env.example .env  # optional - the app runs without it (MOCK provider)
pnpm dev              # builds packages/, then starts API :4000 and Web :3000
```

Open <http://localhost:3000>. With no API key configured the platform boots into
**MOCK mode**: every pipeline stage still runs end to end and returns correctly
shaped output, clearly labelled as offline sample data.

Individual services:

```bash
pnpm dev:api    # NestJS only      -> http://localhost:4000/health
pnpm dev:web    # Next.js only     -> http://localhost:3000
pnpm build      # production build of every package
pnpm -r typecheck
```

> The web app proxies `/api/*` to the API server through a Next.js rewrite, so the
> browser only ever makes same-origin requests. That is what makes it work behind a
> tunnel/preview host. Set `API_URL` if the API runs somewhere other than
> `http://127.0.0.1:4000`.

---

## 2. Swapping the AI provider

There are **three** ways, in increasing order of persistence. All of them are
configuration-only — no application code changes.

### a. `.env` (fastest)

```dotenv
AI_DEFAULT_PROVIDER=GEMINI
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-pro          # optional, catalog default applies
AI_FALLBACK_PROVIDERS=OPENAI,MOCK    # optional fail-over chain
```

Every provider type reads the same variable pattern, so switching vendors means
editing two lines:

| Variable              | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `<TYPE>_API_KEY`      | Credential (aliases per vendor supported) |
| `<TYPE>_MODEL`        | Model id                                  |
| `<TYPE>_ENDPOINT`     | Base URL (self-host / proxy)              |
| `<TYPE>_TEMPERATURE`  | Per-provider sampling temperature         |
| `<TYPE>_MAX_TOKENS`   | Per-provider output cap                   |
| `<TYPE>_ENABLED`      | Opt a configured provider in or out       |

`<TYPE>` is one of `GEMINI`, `OPENAI`, `CLAUDE`, `DEEPSEEK`, `GROK`, `OPENROUTER`,
`OLLAMA`, `LM_STUDIO`, `OPENCLAW`, `CUSTOM`, `MOCK`.

### b. Settings UI (persisted, overrides `.env`)

`Settings → AI Providers → + Tambah / ganti provider`. Pick a type (endpoint and
suggested models are pre-filled from the catalog), paste a key, mark it default,
then hit **Tes** to fire a real 1-token completion and confirm auth, model name and
endpoint all work. Saved rows live in the data store and take precedence over env.

### c. REST

```bash
curl -X POST localhost:4000/ai/providers \
  -H 'content-type: application/json' \
  -d '{"type":"OPENROUTER","model":"google/gemini-2.5-flash","apiKey":"sk-or-...","isDefault":true}'

curl -X POST localhost:4000/ai/providers/<id>/test
curl localhost:4000/ai/status        # default provider + resolved fail-over chain
curl localhost:4000/ai/providers/catalog
```

### Resolution order

```
STORE (Settings UI / DB)  →  ENV (.env)  →  CATALOG (built-in defaults)
```

A store row does not have to repeat everything: any field it leaves empty is filled
from env, then from the catalog. A provider type only counts as *enabled* when it is
actually configured somewhere, so a fresh clone cannot accidentally pick Ollama and
fail on every call.

### Reliability behaviour

- **Retries** — 429/5xx/timeout are retried with exponential back-off
  (`AI_MAX_RETRIES`, default 2).
- **Fail-over** — when a provider exhausts its retries, the next one in the chain is
  tried. The response carries `viaFallback`, the stage records it, and the UI shows a
  `fail-over → MOCK` badge so placeholder output is never mistaken for real output.
- **Mock safety net** — `AI_ALLOW_MOCK_FALLBACK=true` (default) keeps the pipeline
  usable with zero credentials. Set it to `false` in production to fail loudly.

### Adding a genuinely new vendor

| Situation                              | What to do                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Vendor speaks OpenAI chat-completions  | Add one entry to `PROVIDER_CATALOG` (`apps/api/src/ai/provider-catalog.ts`) and its type to `AI_PROVIDER_TYPES`. **No driver code.** |
| Vendor has its own protocol            | Implement `AIDriver` (`generate` + optional `ping`) and register it in `DriverRegistry`. |

Four drivers currently cover all eleven types:
`openai-compatible` (OpenAI, OpenRouter, DeepSeek, Grok, Ollama, LM Studio,
OpenClaw, Custom), `gemini`, `anthropic`, `mock`.

All calls use the global `fetch` — **no vendor SDK is installed**, which is what
keeps swapping cheap.

---

## 3. Content production pipeline

```
Product ─► RESEARCH ─► CAPTIONS (per platform) ─► SEO ─► VISUAL ─► SCHEDULE
                │            │                     │        │          │
                └────────────┴── WorkProduct rows (DRAFT → APPROVED / REJECTED)
```

- **RESEARCH** — target audience, pain points, USPs, content angles, market
  keywords. Its output is injected into every later prompt.
- **CAPTIONS** — one call per selected platform (Instagram, TikTok, Facebook,
  WhatsApp, X, Marketplace), each with platform-specific character limits, hashtag
  counts and emoji rules. Returns structured `{hook, body, cta, hashtags}` plus a
  ready-to-paste `fullText`.
- **SEO** — marketplace title (60–100 chars), meta description, primary/long-tail
  keywords, listing bullet points.
- **VISUAL** — English image-generation prompt, video shot list, style notes.
- **SCHEDULE** — 7-day posting calendar referencing the generated assets.

Behaviour worth knowing:

- Stages are **registered handlers**, not a hard-coded call sequence. Adding a stage
  (e.g. `ADS_COPY`) means pushing one object into `PIPELINE_STAGES_REGISTRY`; the
  orchestrator, REST API and UI pick it up automatically.
- Dependencies are resolved for you: requesting only `CAPTIONS` still schedules
  `RESEARCH`.
- Runs execute **asynchronously**. `POST /content/runs` returns immediately with
  `QUEUED`; the UI polls `GET /content/runs/:id` and renders live per-stage progress.
- One failing stage never kills the run — it is marked `FAILED`, its dependents
  `SKIPPED`, and the run finishes as `PARTIAL`.
- Model output is parsed defensively (`extractJson`): markdown fences, preambles and
  trailing commas are stripped, and one repair round-trip is attempted before the
  stage is failed.

```bash
curl -X POST localhost:4000/content/runs -H 'content-type: application/json' -d '{
  "product": {"name": "Premium Wireless Earbuds Pro", "description": "ANC hybrid, 40h battery", "price": 499000},
  "platforms": ["INSTAGRAM", "TIKTOK", "WHATSAPP"],
  "tone": "hype", "locale": "id-ID",
  "providerType": "GEMINI"
}'
```

---

## 4. Architecture

```
apps/
  api/    NestJS 11 (CommonJS, NodeNext)
    src/ai/           provider catalog, driver registry, 4 drivers, config resolver
    src/commerce/     content pipeline, stage registry, products, marketplace hub
    src/agents/       role-based commerce agents (CMO sub-roles from the docs)
    src/storage/      data store abstraction: memory | file | prisma
    src/integrations/ Google Workspace OAuth + Sheets
  web/    Next.js 15 App Router, React 19, Tailwind v4
packages/
  shared/     domain types + constants consumed by both apps
  database/   Prisma 7 schema, config and connection factory
```

### Persistence

One interface, three interchangeable drivers, selected by `DATA_DRIVER`:

| Driver   | Where data lives                 | Use                        |
| -------- | -------------------------------- | -------------------------- |
| `memory` | process memory                   | tests                      |
| `file`   | `.data/*.json` (**default**)     | local dev, zero setup      |
| `prisma` | PostgreSQL                       | production                 |

Switching backends does not touch a single service: everything goes through
`DataStoreService`.

### Prisma 7 notes

Prisma 7 **removed `url` from the `datasource` block** — the previous schema in this
repo did not validate. The connection URL now lives in `packages/database/prisma.config.ts`,
and the runtime client is built with a driver adapter (`@prisma/adapter-pg`) in
`packages/database/src/client.ts`.

`prisma.config.ts` falls back to a placeholder URL with a warning when
`DATABASE_URL` is unset, because `env()` throws and would otherwise break
`prisma generate` / `format` on a fresh clone.

```bash
pnpm db:generate && pnpm db:push && pnpm db:seed   # requires DATABASE_URL
```

---

## 5. Organization hierarchy

- **Core roles**: CEO, COO, CTO, CMO
- **Commerce sub-roles** (each backed by a built-in agent with its own system
  prompt): Marketplace Manager, Product Research Manager, Content Manager,
  SEO Manager, Ads Manager, Reporting Manager

Workflow model:
`Company → Goal → Project → Issue → Agent Assignment → Approval → Execution →
Work Product → Review → Close`

The Content Studio already implements the `Agent → Execution → Work Product →
Review` segment for real (DRAFT/APPROVED/REJECTED); Goal/Project/Issue management
is still scaffolding.

---

## 6. API surface

| Area        | Endpoints                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Health      | `GET /health`, `GET /`                                                                          |
| AI          | `GET /ai/providers`, `GET /ai/providers/catalog`, `GET /ai/status`, `POST /ai/providers`, `PATCH /ai/providers/:id`, `DELETE /ai/providers/:id`, `POST /ai/providers/:id/test`, `POST /ai/generate` |
| Content     | `GET /content/meta`, `GET|POST /content/products`, `PATCH|DELETE /content/products/:id`, `POST /content/runs`, `GET /content/runs`, `GET|DELETE /content/runs/:id`, `POST /content/runs/:id/retry`, `PATCH /content/work-products/:id/status`, `GET /content/work-products` |
| Marketplace | `GET /marketplace/channels`, `POST /marketplace/import`, `POST /marketplace/import/save`        |
| Sheets      | `GET /integrations/google/status`, `POST /integrations/google/connect`, `POST /integrations/google/sheets`, `POST /integrations/google/sheets/:id/sync` |
| Config      | `GET|PUT /config/infrastructure`                                                                |

---

## 7. Known limitations

- **Marketplace publish** (Shopee/Tokopedia/TikTok Shop/Lazada) is an adapter stub;
  each channel needs its own OAuth + request signing. Product *import* from a URL is
  implemented (Open Graph + AI enrichment) but does not render JavaScript.
- **Goal/Project/Issue** screens on the dashboard are illustrative; there is no CRUD
  API for them yet.
- Agent → provider binding is supported in code (`Agent.providerType`) but there is
  no agent management UI yet.
- API keys are stored as-is in the data store. The docs describe encryption at rest;
  wire that into `AiConfigService.upsert` before exposing the app publicly.
- No Redis/BullMQ queue yet: runs execute in-process. That is fine for single-node
  deployments but will not survive a restart mid-run.
