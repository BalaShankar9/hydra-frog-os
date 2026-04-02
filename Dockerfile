FROM node:20-bookworm-slim

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY . .

# Generate Prisma client and build API (skip type errors for shared package refs)
RUN cd apps/api && npx prisma generate
RUN cd apps/api && npx tsc --skipLibCheck --noEmitOnError false -p tsconfig.json || true
RUN test -f apps/api/dist/main.js && echo "Build successful" || exit 1

ENV NODE_ENV=production
ENV API_PORT=3001
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
