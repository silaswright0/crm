FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgres://busyns:busyns@localhost:5432/busyns
ENV AUTH_SECRET=build-only-secret-not-used-at-runtime

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "node scripts/migrate.mjs && npm start"]
