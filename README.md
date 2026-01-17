# Hydra Frog OS

A production-grade TypeScript monorepo using Turborepo + pnpm, designed for SaaS applications with workers.

## Structure

```
hydra-frog-os/
  apps/
    api/              # NestJS REST API
    dashboard/        # Next.js + Tailwind dashboard
  workers/
    crawler/          # Node.js TypeScript worker
  packages/
    shared/           # Shared types, helpers, constants
  infra/
    docker-compose.yml  # Postgres + Redis
```

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker and Docker Compose

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

### 3. Start infrastructure

```bash
pnpm docker:up
```

### 4. Build all packages

```bash
pnpm build
```

### 5. Start development servers

```bash
pnpm dev
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run tests across all packages |
| `pnpm lint` | Lint all packages |
| `pnpm lint:fix` | Fix lint issues |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check code formatting |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm clean` | Clean all build outputs |
| `pnpm docker:up` | Start Postgres + Redis |
| `pnpm docker:down` | Stop Postgres + Redis |
| `pnpm docker:logs` | View Docker logs |

## Apps

### API (NestJS)

- **Port**: 3001
- **Path**: `apps/api`
- **Endpoints**:
  - `GET /` - Welcome message
  - `GET /health` - Health check

```bash
# Run API only
pnpm --filter @hydra-frog-os/api dev
```

### Dashboard (Next.js)

- **Port**: 3000
- **Path**: `apps/dashboard`

```bash
# Run dashboard only
pnpm --filter @hydra-frog-os/dashboard dev
```

## Workers

### Crawler

- **Path**: `workers/crawler`
- **Description**: Background worker for crawling tasks

```bash
# Run crawler worker
pnpm --filter @hydra-frog-os/crawler dev
```

## Packages

### Shared

- **Path**: `packages/shared`
- **Exports**:
  - `@hydra-frog-os/shared` - All exports
  - `@hydra-frog-os/shared/types` - Type definitions
  - `@hydra-frog-os/shared/helpers` - Utility functions
  - `@hydra-frog-os/shared/constants` - Constants

## Infrastructure

### Docker Services

| Service | Port | Image |
|---------|------|-------|
| PostgreSQL | 5432 | postgres:15-alpine |
| Redis | 6379 | redis:7-alpine |

Both services include health checks and persistent volumes.

## TypeScript Path Aliases

All packages support the following path aliases:

- `@/*` - Source directory
- `@hydra-frog-os/shared` - Shared package

## Development Workflow

1. Make changes to shared package
2. Turborepo automatically rebuilds dependencies
3. Dependent apps hot-reload with changes

## Adding New Packages

1. Create directory in `apps/`, `workers/`, or `packages/`
2. Add `package.json` with workspace dependency:
   ```json
   {
     "dependencies": {
       "@hydra-frog-os/shared": "workspace:*"
     }
   }
   ```
3. Run `pnpm install`

## License

Private - All rights reserved
