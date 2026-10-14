# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npx tsc -p tsconfig.json && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8090 MEDIA_DIR=/data/media PDF_DIR=/data/pdf
RUN apk add --no-cache openssl \
 && mkdir -p /data/media /data/pdf && chown -R node:node /data /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package.json ./
USER node
EXPOSE 8090
# Apply migrations (idempotent) then start. The seed runs on application start (SEED_ON_START).
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && exec node dist/main.js"]
