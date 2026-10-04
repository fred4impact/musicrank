FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

RUN addgroup -S app && adduser -S app -G app
USER app

# No HTTP server here — nothing to HEALTHCHECK over HTTP. Process liveness
# (is it running at all) is what Docker/Kubernetes can observe for this one.
CMD ["node", "dist/index.js"]
