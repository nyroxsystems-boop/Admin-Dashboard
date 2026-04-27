# Changelog

Alle relevanten Änderungen am Admin-Dashboard sind hier dokumentiert.
Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [1.0.0] — 2026-04-27

### Added
- Komplette Migration auf modulare Architektur (User-Dashboard-Niveau)
- 22 Radix UI Primitives + 18 Premium V2 Components
- 14+ Custom Hooks mit React Query
- 7 Sprachen via Custom i18n (de/en/fr/es/it/pl/tr)
- Sentry Error-Tracking + errorTracker Service
- Auth mit Pre-Expiry-Refresh, Cross-Tab-Logout
- 3 Admin-Rollen (SUPER_ADMIN | SUPPORT_ADMIN | READ_ONLY)
- Cmd+K Command Palette mit Recent-Items
- Dark/Light-Mode mit next-themes
- Tenant-Wizard mit Auto-Save
- Audit-Log mit CSV-Export
- 18 modulare Views (max 280 LOC, vorher 1385 LOC monolith)
- Multi-Stage Dockerfile + nginx-Konfiguration mit Security-Headers
- Playwright E2E + Vitest Smoke-Tests
- GitHub Actions CI (Lint + Typecheck + Test + Build)

### Removed
- AdminDashboardView.tsx 1385-LOC God-Module
- 12 weitere monolithische Views
- Hardcoded Production-API-URL Fallback
- localStorage-only OEM-Errors-System
- _stubs.ts Mock-Layer (komplett auf echte API)

### Changed
- TypeScript strict mode (noUnusedLocals, noUnusedParameters)
- ESLint v9 Flat Config
- Vite 6 → 5 (stable)
- Tailwind 4 → 3 (stable)
- Skeleton-Loaders: animate-pulse → echtes Shimmer
- Empty-States: opacity-40 Icons → mit CTA + Illustration-ready
