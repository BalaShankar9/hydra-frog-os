FROM node:20-bookworm-slim

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY . .

# Build shared package first, then API
RUN cd packages/shared && npx tsc --skipLibCheck
RUN cd apps/api && npx prisma generate
RUN cd apps/api && npx tsc --skipLibCheck -p tsconfig.json

ENV NODE_ENV=production
ENV API_PORT=3001
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
