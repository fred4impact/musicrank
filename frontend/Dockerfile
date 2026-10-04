FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Vite inlines these into the built JS at build time (the browser, not a
# container, makes these requests — see api.ts). Defaults match
# docker-compose's published ports; override with --build-arg if the APIs
# are reachable somewhere else (e.g. a different domain in production).
ARG VITE_VOTE_API_URL=http://localhost:4001
ARG VITE_RANKING_API_URL=http://localhost:4002
ENV VITE_VOTE_API_URL=$VITE_VOTE_API_URL
ENV VITE_RANKING_API_URL=$VITE_RANKING_API_URL

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --spider -q http://127.0.0.1/ || exit 1
