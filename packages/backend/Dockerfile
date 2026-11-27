FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/api-schema/package.json ./packages/api-schema/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

FROM base AS migrate
RUN npm ci --workspace @tier-list-league/backend --workspace @tier-list-league/api-schema --include-workspace-root=false
COPY packages/backend ./packages/backend
COPY packages/api-schema ./packages/api-schema
WORKDIR /app/packages/backend
CMD ["npm", "run", "db:migrate"]

FROM base AS runtime
RUN npm ci --omit=dev --workspace @tier-list-league/backend --workspace @tier-list-league/api-schema --include-workspace-root=false
COPY packages/backend ./packages/backend
COPY packages/api-schema ./packages/api-schema
WORKDIR /app/packages/backend
ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["npm", "run", "start"]
