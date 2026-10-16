# Multi-target image for the Kanso monorepo: api, worker, web.
#   docker build -f infra/docker/Dockerfile --target api .
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_APP_URL=http://localhost:3001
# Inlined at build time: without these, cross-site links stay relative and 404 on per-site domains.
ARG NEXT_PUBLIC_SITES_MODE=
ARG NEXT_PUBLIC_URL_SOLUTIONS=
ARG NEXT_PUBLIC_URL_ASSISTANT=
ARG NEXT_PUBLIC_URL_SITE=
ARG NEXT_PUBLIC_URL_PORTAIL=
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITES_MODE=$NEXT_PUBLIC_SITES_MODE NEXT_PUBLIC_URL_SOLUTIONS=$NEXT_PUBLIC_URL_SOLUTIONS \
    NEXT_PUBLIC_URL_ASSISTANT=$NEXT_PUBLIC_URL_ASSISTANT NEXT_PUBLIC_URL_SITE=$NEXT_PUBLIC_URL_SITE \
    NEXT_PUBLIC_URL_PORTAIL=$NEXT_PUBLIC_URL_PORTAIL
RUN pnpm build
# Production-only node_modules for the Node services.
RUN pnpm deploy --filter @kanso/inbound-api --prod --legacy /out/api \
 && pnpm deploy --filter @kanso/document-worker --prod --legacy /out/worker

FROM base AS api
ENV NODE_ENV=production
COPY --from=build /out/api ./apps/inbound-api
COPY --from=build /app/apps/inbound-widget/dist ./apps/inbound-widget/dist
WORKDIR /app/apps/inbound-api
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]

FROM base AS worker
ENV NODE_ENV=production
COPY --from=build /out/worker ./apps/document-worker
WORKDIR /app/apps/document-worker
USER node
CMD ["node", "dist/index.js"]

FROM base AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3001
CMD ["node", "apps/web/server.js"]
