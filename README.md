# HYDRA FROG OS

**Cloud-native SEO crawler and technical audit platform** — Screaming Frog meets enterprise automation.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.x-black)](https://nextjs.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.x-blueviolet)](https://turbo.build/)

---

## What is HYDRA FROG OS?

HYDRA FROG OS is an **open-source, cloud-native website crawler** designed for SEO professionals, agencies, and enterprises. It provides:

- **Automated technical SEO audits** at scale
- **Crawl diff detection** — track what changed between crawls
- **Template clustering** — group pages by structure and detect template drift
- **JavaScript rendering** — crawl SPAs and JS-heavy sites with Puppeteer
- **Performance auditing** — Core Web Vitals via Lighthouse integration
- **AI-powered fix suggestions** — actionable recommendations for every issue
- **Marketing studio** — content briefs, spec generation, and campaign management
- **Custom SEO tools** — pluggable tool framework with scaffold CLI
- **Scheduled crawls** with cron-based automation
- **Multi-tenant architecture** for agencies managing multiple clients
- **Modern dashboard** with exportable reports and feature flags

Think of it as **Screaming Frog + Sitebulb + automation**, built for the cloud.

---

## Architecture

```
                      ┌─────────────────────────────────┐
                      │         Next.js Dashboard        │
                      │       (App Router, port 3000)    │
                      └──────────────┬──────────────────┘
                                     │ REST
                      ┌──────────────▼──────────────────┐
                      │         NestJS API Server        │
                      │     (Prisma + PostgreSQL, 3001)  │
                      └──┬───────────┬──────────────┬───┘
                         │           │              │
              ┌──────────▼──┐  ┌─────▼─────┐  ┌────▼────────┐
              │   Crawler   │  │  Renderer  │  │ Perf Auditor│
              │   Worker    │  │  (Puppeteer)│  │ (Lighthouse)│
              │  (BullMQ)   │  │            │  │             │
              └──────┬──────┘  └─────┬──────┘  └──────┬──────┘
                     │               │                │
              ┌──────▼───────────────▼────────────────▼──┐
              │              Redis (BullMQ)               │
              └──────────────────────────────────────────┘
```

---

## Features

| Feature | Status |
|---------|--------|
| JWT Authentication | Done |
| Multi-tenant Organizations | Done |
| Projects & Domains | Done |
| Distributed Crawler (BullMQ + Redis) | Done |
| SEO Issue Detection (15+ rules) | Done |
| Dashboard with Data Tables | Done |
| Redirect & Broken Link Tracking | Done |
| Scheduled Crawls (Cron) | Done |
| CSV Export | Done |
| Health Monitoring | Done |
| **Crawl Diff Detection** | Done |
| **Template Clustering & Signatures** | Done |
| **JavaScript Rendering (Puppeteer)** | Done |
| **Performance Auditing (Lighthouse)** | Done |
| **AI-Powered Fix Suggestions** | Done |
| **Marketing Studio** | Done |
| **Custom Tool Framework** | Done |
| **Feature Flags** | Done |
| **SEO Health Dashboard** | Done |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | Turborepo 2.x + pnpm 9.x |
| **API** | NestJS 10.x, Prisma 7.x, PostgreSQL |
| **Dashboard** | Next.js 14.x (App Router), Tailwind CSS |
| **Crawler Worker** | Node.js, Cheerio, BullMQ |
| **Renderer** | Puppeteer (headless Chrome) |
| **Performance** | Lighthouse CI |
| **Queue** | Redis + BullMQ |
| **Infrastructure** | Docker Compose (local), ready for K8s |

---

## Monorepo Structure

```
hydra-frog-os/
├── apps/
│   ├── api/                 # NestJS REST API (port 3001)
│   │   ├── prisma/          #   Schema, migrations, seed
│   │   └── src/
│   │       ├── crawl/       #   Crawl orchestration
│   │       ├── diff/        #   Crawl diff detection
│   │       ├── templates/   #   Template clustering
│   │       ├── fixes/       #   AI fix suggestions
│   │       ├── perf/        #   Performance metrics
│   │       ├── studio/      #   Marketing studio
│   │       ├── tools/       #   Custom tool engine
│   │       ├── auth/        #   JWT authentication
│   │       ├── org/         #   Multi-tenant orgs
│   │       ├── project/     #   Project management
│   │       ├── queue/       #   BullMQ integration
│   │       ├── schedule/    #   Cron scheduling
│   │       └── health/      #   Health checks
│   └── dashboard/           # Next.js frontend (port 3000)
│       └── src/
│           ├── app/
│           │   ├── crawls/      # Crawl run details
│           │   ├── diffs/       # Diff viewer
│           │   ├── templates/   # Template explorer
│           │   ├── fixes/       # Fix suggestions
│           │   ├── studio/      # Marketing studio
│           │   ├── tools/       # SEO tools & health dashboard
│           │   ├── flags/       # Feature flag management
│           │   ├── projects/    # Project views
│           │   └── pages/       # Page details
│           ├── components/      # Shared UI components
│           └── lib/             # Utilities (flags, diff)
├── workers/
│   ├── crawler/             # BullMQ crawler worker
│   │   └── src/
│   │       ├── crawl/       #   Crawl runner
│   │       ├── diff/        #   Diff computation
│   │       ├── templates/   #   Template signatures & clustering
│   │       ├── fixes/       #   Fix generation
│   │       ├── perf/        #   Perf data collection
│   │       └── render/      #   JS rendering integration
│   ├── renderer/            # Puppeteer rendering service
│   └── perf-auditor/        # Lighthouse performance auditor
├── packages/
│   └── shared/              # Shared types, constants, tools
├── tools/                   # Tool scaffolding CLI
├── storage/                 # Local storage (screenshots, Lighthouse reports)
├── infra/
│   └── docker-compose.yml   # PostgreSQL + Redis
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Quick Start

### Prerequisites

- **Node.js** 20.x+
- **pnpm** 9.x (`npm install -g pnpm`)
- **Docker** & Docker Compose

### 1. Clone & Install

```bash
git clone https://github.com/BalaShankar9/hydra-frog-os.git
cd hydra-frog-os
pnpm install
```

### 2. Start Infrastructure

```bash
pnpm dev:infra
```

This starts:
- **PostgreSQL** on port 5432
- **Redis** on port 6379

### 3. Setup Database

```bash
cd apps/api
cp .env.example .env
pnpm prisma migrate deploy
pnpm prisma db seed
```

### 4. Start Everything

```bash
pnpm dev:all
```

This runs API, Dashboard, and Crawler Worker concurrently with color-coded output.

**Or run services individually:**

```bash
pnpm dev:api      # API Server → http://localhost:3001
pnpm dev:dash     # Dashboard  → http://localhost:3000
pnpm dev:crawler  # Crawler Worker
```

### 5. Login

- **URL:** http://localhost:3000/login
- **Email:** `demo@hydra.local`
- **Password:** `password123`

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:all` | Start API + Dashboard + Crawler concurrently |
| `pnpm dev:infra` | Start PostgreSQL + Redis (Docker) |
| `pnpm dev:api` | Start API server only |
| `pnpm dev:dash` | Start Dashboard only |
| `pnpm dev:crawler` | Start Crawler worker only |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm docker:down` | Stop infrastructure |
| `pnpm scaffold:tool` | Scaffold a new custom SEO tool |

---

## API Endpoints

| Resource | URL |
|----------|-----|
| Dashboard | http://localhost:3000 |
| API Swagger Docs | http://localhost:3001/docs |
| API Health | http://localhost:3001/health |
| Queue Health | http://localhost:3001/health/queue |

---

## Testing

```bash
# Run all tests
pnpm test

# Run API tests
pnpm --filter api test

# Run integration tests
pnpm --filter api test -- --testPathPattern=integration

# Type check
pnpm --filter dashboard tsc --noEmit
```

---

## Deployment

### Docker

Build images from the repo root:

```bash
# API
docker build -f infra/docker/Dockerfile.api -t hydra-frog-os/api .

# Dashboard
docker build -f infra/docker/Dockerfile.dashboard -t hydra-frog-os/dashboard .

# Workers (pass WORKER=crawler|renderer|perf-auditor)
docker build -f infra/docker/Dockerfile.worker --build-arg WORKER=crawler -t hydra-frog-os/worker-crawler .
docker build -f infra/docker/Dockerfile.worker --build-arg WORKER=renderer -t hydra-frog-os/worker-renderer .
docker build -f infra/docker/Dockerfile.worker --build-arg WORKER=perf-auditor -t hydra-frog-os/worker-perf-auditor .
```

### Kubernetes

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/config.yaml
kubectl apply -f infra/k8s/api.yaml
kubectl apply -f infra/k8s/dashboard.yaml
kubectl apply -f infra/k8s/workers.yaml
```

Includes Deployments, Services, HPA (auto-scaling), liveness/readiness probes, and resource limits.

### Worker Health Checks

All workers expose HTTP health endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /healthz` | Liveness probe — is the process alive |
| `GET /readyz` | Readiness probe — is the worker accepting jobs |

---

## Roadmap

### Phase 4 (Planned)
- [ ] AI SEO Copilot — natural language queries over crawl data
- [ ] Competitor analysis — side-by-side crawl comparisons
- [ ] Historical trend tracking — SEO health over time
- [ ] White-label support — custom branding per client
- [ ] Slack/Discord integrations — crawl alerts
- [ ] Multi-region crawling
- [ ] Enterprise SSO (SAML/OIDC)
- [ ] Billing & subscriptions

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

Built by [BalaShankar9](https://github.com/BalaShankar9)
