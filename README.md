<div align="center">

# HYDRA FROG OS

### The Open-Source SEO Crawler That Fights Back

**Screaming Frog + Sitebulb + AI — built for the cloud, designed for agencies.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.x-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Dashboard-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Groq](https://img.shields.io/badge/Groq-AI_Copilot-F55036?logo=groq&logoColor=white)](https://groq.com/)

[Live Demo](https://hydra-frog-os.vercel.app) | [Features](#features) | [Quick Start](#quick-start) | [Architecture](#architecture) | [AI Copilot](#ai-seo-copilot) | [Deploy](#deployment)

</div>

---

## Why HYDRA FROG?

Every SEO tool today is either **expensive** (Screaming Frog Pro: $259/yr), **desktop-only** (Sitebulb), or **missing AI** (all of them).

HYDRA FROG OS is different:

- **Free & open-source** — MIT licensed, no per-seat pricing
- **Cloud-native** — crawl from anywhere, not your laptop
- **AI-powered** — ask questions about your crawl data in plain English
- **Multi-tenant** — built for agencies managing dozens of clients
- **White-label ready** — custom branding per organization

---

## Features

<table>
<tr><td>

**Crawling**
- Distributed BFS crawler (BullMQ + Redis)
- JavaScript rendering (Puppeteer)
- 15+ SEO issue detection rules
- Redirect & broken link tracking
- Scheduled crawls (cron)
- Template clustering & signatures

</td><td>

**Analysis**
- AI SEO Copilot (Groq/Ollama)
- Competitor domain comparison
- Crawl diff detection
- Performance auditing (Lighthouse)
- AI-powered fix suggestions
- SEO health scoring

</td></tr>
<tr><td>

**Dashboard**
- Dark mode
- Sortable tables with CSV export
- Real-time crawl progress
- Feature flags
- Breadcrumb navigation
- Error boundaries

</td><td>

**Enterprise**
- Multi-tenant organizations
- White-label branding
- JWT authentication + RBAC
- Rate limiting
- Request tracing (x-request-id)
- Docker + Kubernetes ready

</td></tr>
</table>

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Vercel                                 │
│                   Next.js Dashboard                           │
│          (Dark mode, AI Chat, Competitor Analysis)             │
└────────────────────────┬─────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼─────────────────────────────────────┐
│                     NestJS API Server                         │
│  Auth │ Crawl │ Diff │ Templates │ Fixes │ Perf │ AI │ Studio │
│                   Prisma ORM + Rate Limiting                  │
└──┬──────────┬──────────┬──────────────────────┬──────────────┘
   │          │          │                      │
   ▼          ▼          ▼                      ▼
┌──────┐ ┌────────┐ ┌──────────┐         ┌──────────┐
│Crawl │ │Renderer│ │  Perf    │         │  Groq    │
│Worker│ │Puppeteer│ │Lighthouse│         │ AI API   │
│BullMQ│ │        │ │         │         │Llama 3.3 │
└──┬───┘ └───┬────┘ └────┬────┘         └──────────┘
   │         │           │
   ▼         ▼           ▼
┌─────────────────────────────┐    ┌────────────────┐
│        Redis (BullMQ)        │    │   Supabase     │
│     Job Queue + Caching      │    │  PostgreSQL    │
└─────────────────────────────┘    └────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Monorepo** | Turborepo + pnpm | Build orchestration, caching |
| **API** | NestJS, Prisma, TypeScript | REST API with Swagger docs |
| **Dashboard** | Next.js 14 (App Router), Tailwind | Dark mode, responsive UI |
| **Database** | Supabase (PostgreSQL) | Hosted, scalable, free tier |
| **Queue** | Redis + BullMQ | Distributed job processing |
| **Crawler** | Cheerio + Puppeteer | HTML parsing + JS rendering |
| **Performance** | Lighthouse | Core Web Vitals auditing |
| **AI** | Groq (Llama 3.3 70B) | Natural language SEO analysis |
| **Hosting** | Vercel + Docker | Dashboard + API/workers |

---

## AI SEO Copilot

Ask questions about your crawl data in plain English:

```
You: "What are my worst SEO issues?"

AI: Based on the crawl of example.com (1,247 pages):

## Critical Issues (23 pages affected)
1. **Missing title tags** — 12 pages have no <title> element
   - /products/widget-pro, /blog/draft-post, ...
2. **Duplicate meta descriptions** — 8 pages share identical descriptions
3. **Broken internal links** — 3 pages return 404

## Recommended Priority
1. Fix missing titles first (highest impact, ~15min work)
2. Then deduplicate meta descriptions
3. Fix broken links last (lowest traffic pages)
```

Powered by **Groq** (cloud, blazing fast) or **Ollama** (local, free).

---

## Quick Start

### Prerequisites

- **Node.js** 20+ | **pnpm** 9+ | **Docker**

### 1. Clone & Install

```bash
git clone https://github.com/BalaShankar9/hydra-frog-os.git
cd hydra-frog-os
pnpm install
```

### 2. Start Infrastructure

```bash
pnpm dev:infra          # Starts PostgreSQL + Redis via Docker
```

### 3. Setup Database

```bash
cd apps/api
cp .env.example .env    # Edit with your credentials
pnpm prisma migrate deploy
pnpm prisma db seed
```

### 4. Launch

```bash
pnpm dev:all            # Starts API + Dashboard + Crawler
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| API Docs (Swagger) | http://localhost:3001/docs |
| API Health | http://localhost:3001/health |

**Demo login:** `demo@hydra.local` / `password123`

---

## Deployment

### Recommended Stack

| Service | Platform | Cost |
|---------|----------|------|
| Database | **Supabase** (PostgreSQL) | Free tier: 500MB |
| Dashboard | **Vercel** (Next.js) | Free tier: unlimited |
| API + Workers | **Docker** (self-hosted or any cloud) | Varies |
| AI | **Groq** (Llama 3.3 70B) | Free tier: 14.4K tokens/min |

See [infra/DEPLOYMENT.md](infra/DEPLOYMENT.md) for step-by-step deployment instructions.

### Docker

```bash
# Build all images
docker build -f infra/docker/Dockerfile.api -t hydra-frog/api .
docker build -f infra/docker/Dockerfile.worker --build-arg WORKER=crawler -t hydra-frog/crawler .
```

### Kubernetes

```bash
kubectl apply -f infra/k8s/    # Deploys everything with HPA + health probes
```

---

## Project Structure

```
hydra-frog-os/
├── apps/
│   ├── api/                    # NestJS REST API (15 modules)
│   │   └── src/
│   │       ├── ai/             #   AI SEO Copilot (Groq)
│   │       ├── competitor/     #   Competitor analysis
│   │       ├── crawl/          #   Crawl orchestration
│   │       ├── diff/           #   Crawl diff detection
│   │       ├── fixes/          #   AI fix suggestions
│   │       ├── perf/           #   Performance metrics
│   │       ├── studio/         #   Marketing studio
│   │       ├── templates/      #   Template clustering
│   │       ├── tools/          #   Custom tool engine
│   │       └── ...             #   auth, org, project, cache, health
│   └── dashboard/              # Next.js frontend (14 pages)
│       └── src/app/
│           ├── ai/             #   AI Copilot chat interface
│           ├── competitors/    #   Competitor comparison
│           ├── dashboard/      #   Home overview + health score
│           ├── crawls/         #   Crawl run details
│           ├── tools/          #   SEO tool registry
│           └── ...             #   diffs, templates, fixes, studio, etc.
├── workers/
│   ├── crawler/                # BFS crawler (BullMQ)
│   ├── renderer/               # Puppeteer JS rendering
│   └── perf-auditor/           # Lighthouse auditing
├── packages/shared/            # Shared types, logger, health checks
├── infra/
│   ├── docker/                 # Production Dockerfiles
│   ├── k8s/                    # Kubernetes manifests (HPA, probes)
│   └── docker-compose.yml      # Local dev (Postgres + Redis)
└── tools/                      # Tool scaffolding CLI
```

---

## API Reference

Full Swagger documentation available at `/docs` when running the API.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | JWT authentication |
| `/crawl/runs` | GET/POST | Manage crawl runs |
| `/ai/query` | POST | AI Copilot natural language query |
| `/ai/suggestions` | GET | Auto-generated SEO improvements |
| `/competitor/compare` | GET | Side-by-side domain comparison |
| `/templates/:id` | GET | Template cluster details |
| `/diff/:id` | GET | Crawl diff results |
| `/fixes/:id` | GET | Fix suggestions with priority scores |
| `/health` | GET | API + queue health status |

---

## Roadmap

- [x] Core crawler, auth, multi-tenant, dashboard
- [x] Crawl diffs, templates, JS rendering, perf auditing
- [x] AI fix suggestions, marketing studio, custom tools
- [x] Dark mode, sortable tables, CSV export, accessibility
- [x] Docker, Kubernetes, health probes, caching, observability
- [x] AI SEO Copilot, competitor analysis, white-label
- [ ] Historical trend tracking
- [ ] Slack/Discord crawl alerts
- [ ] PDF report generation
- [ ] Enterprise SSO (SAML/OIDC)
- [ ] Billing & subscriptions

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built by [Bala Shankar](https://github.com/BalaShankar9) at Bala Labs**

If you find this useful, give it a star!

</div>
