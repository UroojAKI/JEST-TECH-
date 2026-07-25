# ==========================================
# Stage 1 - Base
# ==========================================
FROM node:20-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

# ==========================================
# Stage 2 - Prune Workspace
# ==========================================
FROM base AS pruner

COPY . .

RUN pnpm dlx turbo prune --scope=api --docker

# ==========================================
# Stage 3 - Install Dependencies
# ==========================================
FROM base AS installer

WORKDIR /app

# Install dependencies first (better caching)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile

# Copy remaining source
COPY --from=pruner /app/out/full/ .

COPY turbo.json .

# Generate Prisma Client
RUN pnpm --filter api prisma:generate

# Build API
RUN pnpm exec turbo run build --filter=api...

# ==========================================
# Stage 4 - Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup -S nodejs && \
    adduser -S nestjs -G nodejs

# Copy application
COPY --from=installer /app/apps/api/dist ./dist
COPY --from=installer /app/apps/api/package.json ./package.json
COPY --from=installer /app/apps/api/prisma ./prisma
COPY --from=installer /app/node_modules ./node_modules

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/src/main.js"]