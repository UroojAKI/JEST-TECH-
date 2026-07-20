# ==========================================
# 1. Base Stage - Setup OS & pnpm
# ==========================================
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ==========================================
# 2. Dependencies Stage
# ==========================================
FROM base AS dependencies
WORKDIR /app
COPY . .
# We use turbo to prune the workspace to only what is needed for the api
RUN npx turbo prune --scope=api --docker

# Install dependencies based on the pruned lockfile
FROM base AS installer
WORKDIR /app

# First install the dependencies (as they change less often)
COPY --from=dependencies /app/out/json/ .
COPY --from=dependencies /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Then copy the source code of the pruned project
COPY --from=dependencies /app/out/full/ .
COPY turbo.json turbo.json

# Generate Prisma client
RUN pnpm --filter api run prisma:generate

# Build the project
RUN pnpm turbo run build --filter=api...

# ==========================================
# 3. Production Image Stage
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs

# Copy built artifacts and production dependencies
COPY --from=installer /app/apps/api/dist ./dist
COPY --from=installer /app/apps/api/package.json ./package.json
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/api/node_modules ./apps/api/node_modules
# Prisma engines are heavy but required
COPY --from=installer /app/apps/api/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
