FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-contracts/package.json packages/api-contracts/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV DATABASE_URL=postgresql://bakimos:bakimos@postgres:5432/bakimos
RUN pnpm --filter @bakimos/api-contracts build \
  && pnpm --filter @bakimos/api exec prisma generate \
  && pnpm --filter @bakimos/api build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
