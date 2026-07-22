FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/backend/package.json ./packages/backend/package.json

RUN npm ci --omit=dev

COPY packages/backend ./packages/backend

WORKDIR /app/packages/backend

ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "run", "start"]
