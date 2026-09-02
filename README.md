# TCGen-Buddy

AI-powered test case generation and QA automation platform for enterprise teams, built as a Next.js application with multi-provider AI support (local Ollama plus cloud fallbacks).

## Overview

TCGen-Buddy turns plain-text requirements into structured, enterprise-grade test cases using LLM-driven generation, then helps you manage the full QA lifecycle: it links to Jira stories, exports cases to Excel/CSV/JSON, generates API and Playwright automation, and runs test suites against SauceDemo with AI-assisted self-healing when tests break. Generation runs through a provider orchestrator that prefers local Ollama and automatically falls back to NVIDIA, OpenRouter, Groq, or OpenCode, so work can happen fully offline or leverage cloud models. The project also includes a memory vault (a local learning store) and traceability/quality scoring so generated work stays connected to source requirements.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/Radix UI, Framer Motion, Lucide icons
- **AI providers**: Ollama (local), NVIDIA NIM, OpenRouter, Groq, OpenCode — with automatic provider/model fallback
- **Automation**: Playwright, Allure reporting, CSV data-driven tests
- **Export**: SheetJS (`xlsx`) for Excel/CSV/JSON export
- **Tooling**: ESLint, Turbopack build

## Features

- **AI test case generation** — `POST /api/generate` builds structured test cases from a prompt, using platform-aware prompts (web/mobile/API/automation), test-type rules (functional/negative/boundary/etc.), JSON response validation, requirement chunking for long inputs, and deduplication/renumbering.
- **Multi-provider AI orchestration** — Provider + model fallback chains, per-provider timeouts, health checks, and auto mode that tries NVIDIA → OpenRouter → Groq → OpenCode → Ollama in order.
- **Jira integration** — Story lookup by ID embedded in prompts, create issues/defects, AI-generated defect reports, test-connection verification, save test cases, parent story linking, and a webhook endpoint.
- **Automation dashboard** — Run Playwright suites (smoke/sanity/regression) from the browser with live streaming output, duration tracking, and one-click report viewing.
- **Self-healing automation engine** — Classifies failures (locator, timing, assertion, etc.), collects DOM candidates, applies heuristic and AI-assisted patches to locators/waits/assertions, reruns healed scripts, and writes healing reports.
- **API testing workspace** — Import APIs from Swagger URL, OpenAPI upload, cURL, raw endpoints, Postman, or Jira stories; generate API test cases targeted at Rest Assured, Playwright API, or Newman; execute and export to CSV/Excel/JSON.
- **Playwright script generation** — Generates Playwright spec code from generated test cases.
- **Test Data Manager** — Curated SauceDemo users, products, and checkout data with launch/copy actions (see `app/test-data`).
- **Traceability & quality scoring** — Links generated cases to requirements/Jira stories and scores test-case quality (RAGAS-style metrics when retrieval context is available).
- **Memory Vault** — A local learning store that captures Jira stories, generated test cases, defects, automation summaries, and self-healing events for reuse in later prompts.

## Project Structure

```
TCGen-Buddy/
├── app/
│   ├── page.tsx                  # Main workspace (test case generator)
│   ├── dashboard/                # Automation dashboard
│   ├── test-data/                # SauceDemo test data manager
│   ├── api-testing/              # API testing workspace
│   └── api/                      # Next.js route handlers
│       ├── generate/             # Test case generation
│       ├── automation/           # run + generate (Playwright)
│       ├── api-testing/          # run, generate, parse-swagger, debug
│       ├── jira/                 # create-issue, generate-defect, webhook, etc.
│       ├── models/               # AI model listing
│       └── health/               # Health check
├── src/
│   ├── modules/                  # Feature UI + types (testcase-generator, api-testing,
│   │   │                         #   script-generator, traceability, memory-vault, defect-studio)
│   ├── orchestrators/            # testcase / jira / execution / automation orchestration
│   ├── services/
│   │   ├── ai/                   # provider-orchestrator + providers (ollama, nvidia,
│   │   │                         #   openrouter, groq, opencode), prompt-builder, token-budget
│   │   ├── jira/                 # Jira API client
│   │   ├── export/               # Excel/CSV/JSON export
│   │   ├── memory-vault/         # local knowledge store
│   │   ├── quality/              # test case quality scoring
│   │   └── traceability/         # requirement <-> test case links
│   └── prompts/                  # system, platform, test-type, automation prompts
├── automation/
│   ├── playwright.config.ts      # Playwright config (chromium/firefox/webkit)
│   ├── pages/                    # Page Object Models (login, inventory, cart, checkout)
│   ├── fixtures/                 # shared fixtures
│   ├── data/                     # CSV test data
│   ├── tests/                    # smoke / sanity / regression suites
│   ├── agents/                   # agent workflow docs (test-planner, test-generator, etc.)
│   └── reports/                  # run artifacts (playwright-html, allure, healing, logs)
├── components/ui/                # shadcn-style UI components
├── public/automation-reports/    # published run reports
├── scripts/                      # PowerShell maintenance scripts
├── .env.local.example            # environment variable template
└── package.json
```

## Getting Started

### Prerequisites

- **Node.js** 20+ and npm
- At least one AI provider configured:
  - **Ollama** (free, fully local) — install from [ollama.ai](https://ollama.ai) and pull a model, or
  - a cloud provider API key (NVIDIA, OpenRouter, Groq, or OpenCode)
- Playwright browsers for the automation features
- Java (required for full Allure report generation)

### Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers (for automation features)
npm run playwright:install
```

### Environment variables

Copy the template and fill in the providers you want to use:

```bash
cp .env.local.example .env.local
```

The supported variables (see `.env.local.example`):

```
# Cloud providers (optional — set whichever you use)
NVIDIA_API_KEY=...
OPENROUTER_API_KEY=...
GROQ_API_KEY=...
OPENCODE_API_KEY=...

# Local Ollama (optional but recommended — enables fully offline generation)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=
OLLAMA_KEEP_ALIVE=10m
OLLAMA_CHUNK_TIMEOUT_MS=45000

# Jira integration (optional)
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=...
JIRA_PROJECT_KEY=TCGB
```

Note: Jira credentials can also be entered in the UI and are stored in browser `localStorage`; the `.env` values are the server-side default. Check `.gitignore` — `local.env` values should never be committed.

### Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run the automation suites

```bash
npm run test:automation                # all suites
npm run test:automation:smoke          # smoke only
npm run test:automation:sanity         # sanity only
npm run test:automation:regression     # regression only
```

Suites are data-driven from the CSVs in `automation/data` and target `https://www.saucedemo.com` (override with `SAUCEDEMO_BASE_URL`). Reports are written to `public/automation-reports/<run-id>/`.

## Usage

1. **Generate test cases** — open the app, enter a requirement such as `TCGB-123` (a Jira story ID is resolved to story details automatically) or a plain prompt, pick a provider/model, and generate. Results appear as structured cases that can be exported to Excel/CSV/JSON or converted into a Playwright script.
2. **Generate from a spec** — use the API testing workspace to paste a Swagger URL, upload an OpenAPI file, or drop in a cURL/Postman request to produce API test cases.
3. **Run automation** — use the dashboard (`/dashboard`) to execute smoke/sanity/regression suites with live streaming, then open the Playwright/Allure reports. If a test fails, the self-healing engine attempts to fix locators/waits/assertions and records the outcome in a healing report and the memory vault.
4. **File defects** — send failing scenarios to Jira from the defect studio, with AI-generated descriptions and parent-story linking.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run test:automation*` | Run Playwright suites |
| `npm run playwright:install` | Install Playwright browsers |

## Status

The project is under active development (53 commits, latest on 2026-06-18 — self-healing engine, memory vault, Jira traceability, and RAG V1 are recent additions). It appears feature-complete for local single-user use but is not published to npm or containerized. A few caveats:

- No `LICENSE` file is present in the repository despite the previous README referencing an MIT license — clarify before distributing.
- Ollama-based generation is fully local, but the cloud provider options (NVIDIA/OpenRouter/Groq/OpenCode) transmit prompts to external APIs.
- The automation layer is purpose-built around SauceDemo; suites use hardcoded `data-test` selectors for that site.
- Allure report generation requires a local Java runtime.
