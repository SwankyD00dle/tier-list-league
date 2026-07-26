FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/api-schema/package.json ./packages/api-schema/package.json
COPY packages/backend/package.json ./packages/backend/package.json

RUN npm ci --omit=dev

COPY packages/api-schema ./packages/api-schema
COPY packages/backend ./packages/backend

WORKDIR /app/packages/backend

ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "run", "start"]
