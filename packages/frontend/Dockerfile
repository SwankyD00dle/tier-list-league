FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/api-schema/package.json ./packages/api-schema/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json
RUN npm ci
COPY packages/frontend ./packages/frontend
COPY packages/api-schema ./packages/api-schema
ARG APP_PUBLIC_URL=http://localhost:3000
ARG BACKEND_URL=http://backend:3001
ENV APP_PUBLIC_URL=$APP_PUBLIC_URL
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @tier-list-league/frontend

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Retain TypeScript: Next loads next.config.ts at startup.
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@tier-list-league/frontend", "--", "--hostname", "0.0.0.0"]
