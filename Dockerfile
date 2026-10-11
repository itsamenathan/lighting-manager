# syntax=docker/dockerfile:1

# ---- build: install everything, build the React client, then drop dev deps ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Toolchain in case better-sqlite3 has no prebuilt binary for this platform.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    DATABASE_PATH=/data/lightning.db
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/auth/me').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/index.ts"]
