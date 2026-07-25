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
# Stage 3 - Install Dependencies & Build
# ==========================================
FROM base AS installer

WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --no-frozen-lockfile

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

# Copy entire built workspace with all node_modules and symlinks
COPY --from=installer --chown=nestjs:nodejs /app ./

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "apps/api/dist/src/main.js"]