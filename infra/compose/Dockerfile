FROM node:24.16.0-bookworm-slim@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203 AS build

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tsconfig.base.json eslint.config.mjs vitest.config.ts ./
RUN --mount=type=cache,id=lumiclaw-presence-npm,target=/root/.npm,sharing=locked npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
RUN npm run build:runtime

FROM node:24.16.0-bookworm-slim@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203 AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /var/lib/lumiclaw/blobs && chown -R node:node /var/lib/lumiclaw
USER node

CMD ["node", "apps/api/dist/server.js"]
