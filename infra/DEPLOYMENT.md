# Deployment Guide

## Quick Start with Supabase + Railway

### 1. Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy the **Connection string** from Settings → Database → Connection string (URI)
3. Set it as `DATABASE_URL` in your environment:
   ```
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
   ```
4. Run migrations:
   ```bash
   cd apps/api
   DATABASE_URL="your-supabase-url" pnpm prisma migrate deploy
   DATABASE_URL="your-supabase-url" pnpm prisma db seed
   ```

### 2. Railway (API + Workers)

#### API Service
1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repo (`BalaShankar9/hydra-frog-os`)
3. Add a **Redis** service from the Railway marketplace
4. Set environment variables:
   ```
   DATABASE_URL=<supabase-connection-string>
   JWT_SECRET=<generate-a-strong-secret>
   REDIS_HOST=${{Redis.REDIS_HOST}}
   REDIS_PORT=${{Redis.REDIS_PORT}}
   REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
   CORS_ORIGINS=https://your-dashboard-url.netlify.app
   NODE_ENV=production
   GROQ_API_KEY=<your-groq-api-key>
   ```
5. Set start command: `pnpm --filter api run start:prod`
6. Set health check path: `/health`

#### Crawler Worker
1. Add another service in the same Railway project
2. Set start command: `cd workers/crawler && node dist/index.js`
3. Same env vars as API (DATABASE_URL, REDIS_*)

#### Renderer Worker (optional)
1. Add another service
2. Set start command: `cd workers/renderer && node dist/index.js`
3. Needs Chromium — use the Docker deployment instead:
   ```
   docker build -f infra/docker/Dockerfile.worker --build-arg WORKER=renderer .
   ```

### 3. Netlify (Dashboard)

1. Go to [netlify.com](https://netlify.com) and import the repo
2. Set build settings:
   - **Base directory**: `apps/dashboard`
   - **Build command**: `pnpm build`
   - **Publish directory**: `apps/dashboard/.next`
3. Set environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
   ```

### 4. Groq (AI Copilot)

1. Go to [console.groq.com](https://console.groq.com) and create an API key
2. Set `GROQ_API_KEY` in your Railway API service environment variables
3. Default model: `llama-3.3-70b-versatile` (change with `AI_MODEL` env var)

### 5. Local Development with Ollama

For local AI development without Groq costs:
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.2

# Set in .env
OLLAMA_HOST=http://localhost:11434
AI_MODEL=llama3.2
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase) |
| `JWT_SECRET` | Yes | Secret for JWT token signing |
| `REDIS_HOST` | Yes | Redis host (Railway provides this) |
| `REDIS_PORT` | Yes | Redis port |
| `REDIS_PASSWORD` | No | Redis password |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `GROQ_API_KEY` | No | Groq API key for AI Copilot |
| `AI_MODEL` | No | AI model name (default: llama-3.3-70b-versatile) |
| `NODE_ENV` | Yes | production |
| `API_PORT` | No | API port (default: 3001) |
| `HEALTH_PORT` | No | Worker health port (default: 8080) |
| `WORKER_CONCURRENCY` | No | Worker concurrency (default: 1-5) |
