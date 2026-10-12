# The worker's image. Build it from the repository root, so the workspace
# packages it depends on are in the context:
#
#   docker build -f apps/worker/Dockerfile -t worker .
#
# It needs DATABASE_URL at runtime, and SIDEQUEST_DASHBOARD_PORT only to serve
# Sidequest's dashboard.

FROM node:26-alpine AS base
# The npm the repository pins in packageManager.
RUN npm install -g npm@12.2.0
WORKDIR /app

# ---
# A partial monorepo with only the worker and the workspaces it depends on,
# and a lockfile pruned to match, so unrelated changes don't bust the cache.
FROM base AS prepare
ARG TURBO_VERSION=2.11.7
RUN npm install -g turbo@$TURBO_VERSION
COPY . .
RUN turbo prune @repo/worker --docker

# ---
FROM base AS builder
# Dependencies first, as they change less often than the source.
COPY --from=prepare /app/out/json/ .
RUN npm ci
COPY --from=prepare /app/out/full/ .
# Builds @repo/core before the worker (build dependsOn ^build).
RUN npx turbo run build --filter=@repo/worker

# ---
FROM base AS runner
ENV NODE_ENV=production
# Only production dependencies. The worker's bundle and core's keep their
# packages external, so they're resolved from node_modules at runtime.
COPY --from=prepare /app/out/json/ .
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

USER node
# Node runs as PID 1 and handles SIGTERM itself: Sidequest stops claiming
# jobs, waits for the running ones and exits.
CMD ["node", "apps/worker/dist/index.cjs"]
