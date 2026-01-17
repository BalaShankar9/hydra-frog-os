# 🐸 HYDRA FROG OS

**Cloud-native SEO crawler and technical audit platform** — Screaming Frog meets enterprise automation.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.x-black)](https://nextjs.org/)

---

## 🚀 What is HYDRA FROG OS?

HYDRA FROG OS is an **open-source, cloud-native website crawler** designed for SEO professionals, agencies, and enterprises. It provides:

- **Automated technical SEO audits** at scale
- **Scheduled crawls** with cron-based automation
- **Real-time issue detection** (missing titles, broken links, redirect chains, etc.)
- **Multi-tenant architecture** for agencies managing multiple clients
- **Modern dashboard** with exportable reports

Think of it as **Screaming Frog + Sitebulb + automation**, built for the cloud.

---

## ✨ Core Features (Phase 1 Complete)

| Feature | Status |
|---------|--------|
| 🔐 JWT Authentication | ✅ |
| 🏢 Multi-tenant Organizations | ✅ |
| 📁 Projects & Domains | ✅ |
| 🕷️ Distributed Crawler (BullMQ + Redis) | ✅ |
| 📊 SEO Issue Detection (15+ rules) | ✅ |
| 📈 Dashboard with Data Tables | ✅ |
| 🔗 Redirect & Broken Link Tracking | ✅ |
| ⏰ Scheduled Crawls (Cron) | ✅ |
| 📤 CSV Export | ✅ |
| 🩺 Health Monitoring | ✅ |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | Turborepo 2.x + pnpm 9.x |
| **API** | NestJS 10.x, Prisma 7.x, PostgreSQL |
| **Dashboard** | Next.js 14.x (App Router), Tailwind CSS |
| **Crawler Worker** | Node.js, Cheerio, BullMQ |
| **Queue** | Redis + BullMQ |
| **Infrastructure** | Docker Compose (local), ready for K8s |

---

## 📁 Monorepo Structure

\`\`\`
hydra-frog-os/
├── apps/
│   ├── api/              # NestJS REST API (port 3001)
│   └── dashboard/        # Next.js frontend (port 3000)
├── workers/
│   └── crawler/          # BullMQ crawler worker
├── packages/
│   └── shared/           # Shared types, constants, issue rules
├── infra/
│   └── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
\`\`\`

---

## 🏃 Quick Start

### Prerequisites

- **Node.js** 20.x+
- **pnpm** 9.x (\`npm install -g pnpm\`)
- **Docker** & Docker Compose

### 1. Clone & Install

\`\`\`bash
git clone https://github.com/BalaShankar9/hydra-frog-os.git
cd hydra-frog-os
pnpm install
\`\`\`

### 2. Start Infrastructure

\`\`\`bash
cd infra
docker compose up -d
\`\`\`

This starts:
- **PostgreSQL** on port 5432
- **Redis** on port 6379

### 3. Setup Database

\`\`\`bash
cd apps/api
cp .env.example .env
pnpm prisma migrate deploy
pnpm prisma db seed
\`\`\`

### 4. Run Services

Open 3 terminals:

\`\`\`bash
# Terminal 1: API Server
pnpm --filter api dev
# → http://localhost:3001

# Terminal 2: Dashboard
pnpm --filter dashboard dev
# → http://localhost:3000

# Terminal 3: Crawler Worker
pnpm --filter crawler dev
\`\`\`

### 5. Login

- **URL:** http://localhost:3000/login
- **Email:** \`demo@hydra.local\`
- **Password:** \`password123\`

---

## 🔗 Useful Links

| Resource | URL |
|----------|-----|
| Dashboard | http://localhost:3000 |
| API Swagger Docs | http://localhost:3001/docs |
| API Health | http://localhost:3001/health |
| Queue Health | http://localhost:3001/health/queue |

---

## 🧪 Testing

\`\`\`bash
# Run all tests
pnpm test

# Run API tests
pnpm --filter api test

# Type check
pnpm --filter dashboard tsc --noEmit
\`\`\`

---

## 📋 Roadmap

### Phase 2 (In Progress)
- [ ] Real-time crawl progress via WebSockets
- [ ] Page speed metrics (Core Web Vitals)
- [ ] JavaScript rendering support (Puppeteer)
- [ ] Sitemap.xml generation
- [ ] PDF report exports

### Phase 3 (Planned)
- [ ] AI-powered SEO recommendations
- [ ] Competitor analysis
- [ ] Historical trend tracking
- [ ] White-label support
- [ ] Slack/Discord integrations

### Phase 4 (Future)
- [ ] Kubernetes deployment (Helm charts)
- [ ] Multi-region crawling
- [ ] Enterprise SSO (SAML/OIDC)
- [ ] Billing & subscriptions

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

Built with ❤️ by the HYDRA FROG team.

Inspired by:
- [Screaming Frog](https://www.screamingfrog.co.uk/)
- [Sitebulb](https://sitebulb.com/)
- [Ahrefs](https://ahrefs.com/)

---

**Star ⭐ this repo if you find it useful!**
