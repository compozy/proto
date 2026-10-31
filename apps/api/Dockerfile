# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM oven/bun:1.4.4-alpine AS dependencies
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/app/package.json apps/app/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN bun install --frozen-lockfile --production --ignore-scripts --filter @proto/api --filter @proto/db

FROM oven/bun:1.4.4-alpine
WORKDIR /app
COPY --from=dependencies /app /app
COPY apps/api/src apps/api/src
COPY packages/db/src packages/db/src
COPY packages/db/drizzle packages/db/drizzle
ENV NODE_ENV=production
USER bun
EXPOSE 3001
CMD ["bun", "apps/api/src/server.ts"]
