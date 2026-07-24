# API server container (roadmap Phase 4.4).
#
# Build from the REPO ROOT (the workspace is needed to build libs + install
# externalized runtime deps):
#   docker build -f artifacts/api-server/Dockerfile -t nigeria-security-api .
#
# Run:
#   docker run -p 8081:8081 \
#     -e NODE_ENV=production -e PORT=8081 \
#     -e AUTH_SECRET=... -e DATABASE_URL=... -e REDIS_URL=... \
#     -e EVIDENCE_S3_BUCKET=... -e CORS_ALLOWED_ORIGINS=... \
#     nigeria-security-api
#
# The bundle externalizes a few packages (Sentry/otel, AWS SDK, Google GenAI),
# so the runtime image keeps the pnpm workspace layout (root store + package
# symlinks) — copying it wholesale preserves pnpm's symlink topology.

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /workspace

# Install with the full workspace context so workspace:* and catalog: resolve.
# .npmrc carries auto-install-peers=false, which the lockfile was built with.
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY lib ./lib
COPY scripts ./scripts
COPY artifacts/api-server ./artifacts/api-server
RUN pnpm install --frozen-lockfile --filter @workspace/api-server... --filter .

# Build workspace lib declarations, then the server bundle.
RUN pnpm run typecheck:libs && pnpm --filter @workspace/api-server run build

# Re-resolve to production-only dependencies for the runtime layer.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter @workspace/api-server... --filter .

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -S api && adduser -S api -G api
WORKDIR /workspace

# Preserve the pnpm workspace layout so externalized imports resolve.
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/lib ./lib
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY --from=build /workspace/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY --from=build /workspace/artifacts/api-server/dist ./artifacts/api-server/dist

USER api
WORKDIR /workspace/artifacts/api-server
EXPOSE 8081

# The LB should use /api/healthz; this container-level check backs it up.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8081)+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
