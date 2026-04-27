# syntax=docker/dockerfile:1.6
#
# Partsunion Admin Dashboard — Multi-stage production image.
#
# Build:
#   docker build \
#     --build-arg VITE_API_BASE_URL=https://api.partsunion.de \
#     --build-arg VITE_SCRAPER_BASE_URL=https://scraper.partsunion.de \
#     -t partsunion-admin-dashboard .
#
# Run:
#   docker run -p 8080:80 partsunion-admin-dashboard

# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps with deterministic lockfile resolution.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source last to maximize layer cache.
COPY . .

# VITE_* are inlined at build time.
ARG VITE_API_BASE_URL
ARG VITE_SCRAPER_BASE_URL
ARG VITE_SENTRY_DSN
ARG VITE_DEFAULT_LOCALE=de
ARG VITE_APP_VERSION=1.0.0
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SCRAPER_BASE_URL=$VITE_SCRAPER_BASE_URL \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_DEFAULT_LOCALE=$VITE_DEFAULT_LOCALE \
    VITE_APP_VERSION=$VITE_APP_VERSION

RUN npm run build

# ─── Stage 2: Serve ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
