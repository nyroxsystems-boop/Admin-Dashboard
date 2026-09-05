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
#   docker run -p 8080:8080 partsunion-admin-dashboard

# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:22.23.2-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --no-progress

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
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Use a template so $PORT (set by Railway / fallback to 8080) is interpolated at container start.
# nginx:alpine runs /docker-entrypoint.d/20-envsubst-on-templates.sh automatically.
COPY nginx.conf /etc/nginx/templates/default.conf.template

ENV PORT=8080
EXPOSE 8080
# Probe 127.0.0.1, NOT "localhost": in the container, localhost resolves to
# IPv6 ::1 first, but nginx's configured listener binds IPv4 only, and BusyBox wget
# does not fall back across address families — so a "localhost" probe gets
# "Connection refused" and the container falsely reports unhealthy.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider "http://127.0.0.1:${PORT}/" || exit 1

USER 101
CMD ["nginx", "-g", "daemon off;"]
