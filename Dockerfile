FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY api ./api
COPY realtime-core-service ./realtime-core-service

ENV NODE_ENV=production
ENV REALTIME_CORE_PORT=8787
ENV REALTIME_CORE_HOST=0.0.0.0

EXPOSE 8787

CMD ["node", "realtime-core-service/server.mjs"]
