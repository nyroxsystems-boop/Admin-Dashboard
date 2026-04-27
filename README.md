# Partsunion Admin Dashboard

Internes Verwaltungs-Dashboard für Partsunion-Operatoren (Super-Admins, Support).

## Features

- Multi-Tenant-Verwaltung (CRUD, Limits, Devices, Audit-Trail)
- OEM-Datenbank-Management (Registry, Lookup, Batch, Errors, Accuracy)
- Bot-Testing & Monitoring
- Inbox-Aggregation über alle Tenants
- Order-Übersicht
- Bulk-Scraper-Kontrolle
- Wartungsmodus + System-Health
- 7 Sprachen (de, en, fr, es, it, pl, tr)
- Light/Dark-Mode, Keyboard-Shortcuts (Cmd+K Command Palette)
- Sentry Error-Tracking, Audit-Log-CSV-Export

## Stack

- React 18 + TypeScript (strict)
- Vite 5
- Tailwind 3 + Design-Tokens (Industrial Precision Dark-First)
- Radix UI + cmdk
- React Router v6, React Query
- Framer Motion, Sonner Toasts
- Zod für API-Schema-Validation

## Setup

### Voraussetzungen
- Node 20+
- npm 10+
- Backend `wws-service` erreichbar
- Optional: `partslink24-scraper` Microservice

### Installation

```bash
cd Admin-Dashboard
npm install
cp .env.example .env
# .env editieren mit echten URLs
```

### Development

```bash
npm run dev          # Vite Dev-Server auf http://localhost:5174
npm run typecheck    # TS strict check
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run test:e2e     # Playwright E2E (requires running dev server)
```

### Build

```bash
npm run build        # Production build -> dist/
npm run preview      # Lokal Preview auf http://localhost:4173
```

## ENV Variables

| Var | Required | Beschreibung |
|---|---|---|
| `VITE_API_BASE_URL` | yes | Backend WWS-Service URL (z.B. `https://api.partsunion.de`) |
| `VITE_SCRAPER_BASE_URL` | yes | Partslink24-Scraper Microservice URL |
| `VITE_SENTRY_DSN` | no | Sentry Error-Tracking (leer = disabled) |
| `VITE_DEFAULT_LOCALE` | no | Default `de` |
| `VITE_APP_VERSION` | no | Wird im UI angezeigt |

**Wichtig:** Es gibt KEINEN Production-Fallback. Fehlt eine Required-ENV, wirft die App beim Start einen Fehler.

## Architektur

```
src/
├── api/              13 Domain-Files mit Zod-Schemas
├── auth/             RBAC: SUPER_ADMIN | SUPPORT_ADMIN | READ_ONLY
├── components/
│   ├── ui/           Radix Primitives
│   ├── ui-v2/        Premium Custom Components (StatusLED, MonoMetric, OEMNumber)
│   ├── layout/       Sidebar, Topbar, CommandPalette
│   └── feedback/     Skeleton (Shimmer), EmptyState, ErrorState, ConfirmDialog
├── design-system/    tokens.ts + tokens.css
├── hooks/            React Query Hooks (Domain + Foundation)
├── i18n.tsx          Custom i18n (lazy-loaded locales)
├── locales/          7 Sprachen
├── routes/           Lazy-Routes mit Suspense + 404
├── services/         Sentry + errorTracker
├── styles/           premium-tokens.css + animations.css
├── utils/            Validation, Format, Clipboard
└── views/            Modulare Views (max 280 LOC)
```

## Deployment

### Docker

```bash
docker build -t partsunion-admin-dashboard \
  --build-arg VITE_API_BASE_URL=https://api.partsunion.de \
  --build-arg VITE_SCRAPER_BASE_URL=https://scraper.partsunion.de .

docker run -p 8080:80 partsunion-admin-dashboard
```

**Hinweis:** Vite ENV-Vars sind Build-Time. Für Runtime-Config siehe `docker-entrypoint.sh` Pattern.

### Railway

Service: `admin-dashboard`. Build-Command: `npm ci && npm run build`. Start-Command: `npx serve dist -s -l ${PORT}`.

## Keyboard Shortcuts

- `Cmd+K` / `Ctrl+K` — Command Palette öffnen
- `Cmd+\` / `Ctrl+\` — Sidebar collapse/expand
- `?` — Shortcut-Übersicht (geplant)
- `Escape` — Modals/Drawer schließen

## Lizenz

Proprietary — Partsunion (c) 2026
