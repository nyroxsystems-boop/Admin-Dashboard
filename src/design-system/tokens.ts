/**
 * Partsunion Design Tokens — Source of Truth (Admin Dashboard)
 *
 * Alle Farben, Spacings, Typografie-Werte und Motion-Konstanten.
 * Diese Datei wird von tokens.css (CSS-Variables) gespiegelt.
 *
 * REGEL: Verwende Tailwind-Klassen wann immer möglich. Diese TS-Tokens sind
 * NUR für Fälle außerhalb Tailwind (Canvas-Rendering, JS-Animations,
 * dynamische Inline-Styles).
 *
 * Portiert 1:1 aus User-Dashboard (Goldstandard).
 */

// ──────────────────────────────────────────────────────────────
// COLORS
// ──────────────────────────────────────────────────────────────

/**
 * Dark-First Neutral-Stack.
 * Canvas → Surface → Elevated (Modal, Hover-States).
 */
export const neutrals = {
  canvas: '#0A0B0D',
  surface: '#111418',
  elevated: '#1A1E24',
  border: '#252A31',
  borderStrong: '#3A4049',
  textPrimary: '#E8ECF1',
  textSecondary: '#9AA3AD',
  textMuted: '#5E6670',
} as const;

/**
 * Partsunion Deep Signal Blue.
 * REGEL: accent-500 (#1D6FE8) ist PRIMARY — verwende genau einmal pro Screen
 * als Primary-Action. Knappheit macht Bedeutung.
 */
export const accent = {
  50: '#EFF6FF',
  200: '#BFDBFE',
  400: '#3B82F6',
  500: '#1D6FE8', // PRIMARY
  600: '#1554B8', // Hover
  700: '#0E3F8F',
  glow: 'rgba(29, 111, 232, 0.18)',
} as const;

/**
 * Semantic-Farben für Status-Indikatoren.
 */
export const semantic = {
  success: {
    base: '#4ADE80',
    muted: 'rgba(74, 222, 128, 0.12)',
    text: '#86EFAC',
  },
  warning: {
    base: '#F5A524',
    muted: 'rgba(245, 165, 36, 0.12)',
    text: '#FCD34D',
  },
  danger: {
    base: '#F87171',
    muted: 'rgba(248, 113, 113, 0.12)',
    text: '#FCA5A5',
  },
  info: {
    base: '#60A5FA',
    muted: 'rgba(96, 165, 250, 0.12)',
    text: '#93C5FD',
  },
} as const;

/**
 * Chart-Farben — bewusst gedämpft.
 */
export const chart = {
  1: '#1D6FE8',
  2: '#4ADE80',
  3: '#F5A524',
  4: '#A78BFA',
  5: '#6B7280',
} as const;

// ──────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ──────────────────────────────────────────────────────────────

export const fonts = {
  mono: '"IBM Plex Mono", "JetBrains Mono", "SF Mono", monospace',
  display: '"Inter Display", "Inter", system-ui, sans-serif',
  body: '"Inter Text", "Inter", system-ui, sans-serif',
} as const;

export const fontSizes = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2rem',
  '5xl': '3rem',
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const letterSpacing = {
  tight: '-0.02em',
  normal: '0',
  wide: '0.04em',
  widest: '0.08em',
} as const;

// ──────────────────────────────────────────────────────────────
// SPACING (4px base)
// ──────────────────────────────────────────────────────────────

export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

// ──────────────────────────────────────────────────────────────
// LAYOUT
// ──────────────────────────────────────────────────────────────

export const layout = {
  maxWidth: '1680px',
  sidebarWidth: '240px',
  sidebarCollapsed: '56px',
  contextPaneWidth: '320px',
  inboxPaneWidth: '360px',
  topbarHeight: '56px',
} as const;

// ──────────────────────────────────────────────────────────────
// RADIUS
// ──────────────────────────────────────────────────────────────

export const radius = {
  none: '0',
  sm: '4px',
  base: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

// ──────────────────────────────────────────────────────────────
// SHADOWS
// ──────────────────────────────────────────────────────────────

export const shadows = {
  xs: '0 1px 2px rgba(0, 0, 0, 0.4)',
  card: '0 2px 8px rgba(0, 0, 0, 0.3)',
  cardHover: '0 4px 16px rgba(0, 0, 0, 0.4)',
  modal: '0 16px 48px rgba(0, 0, 0, 0.6)',
  glowSuccess: '0 0 8px rgba(74, 222, 128, 0.6)',
  glowWarning: '0 0 8px rgba(245, 165, 36, 0.6)',
  glowDanger: '0 0 8px rgba(248, 113, 113, 0.6)',
  glowAccent: '0 0 12px rgba(29, 111, 232, 0.4)',
} as const;

// ──────────────────────────────────────────────────────────────
// MOTION
// ──────────────────────────────────────────────────────────────

export const motion = {
  fast: '120ms',
  base: '180ms',
  medium: '280ms',
  slow: '400ms',
  easing: {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// ──────────────────────────────────────────────────────────────
// Z-INDEX
// ──────────────────────────────────────────────────────────────

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  topbar: 30,
  drawer: 40,
  modal: 50,
  toast: 60,
  tooltip: 70,
} as const;

// ──────────────────────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────────────────────

export const tokens = {
  neutrals,
  accent,
  semantic,
  chart,
  fonts,
  fontSizes,
  fontWeights,
  letterSpacing,
  spacing,
  layout,
  radius,
  shadows,
  motion,
  zIndex,
} as const;

export type Tokens = typeof tokens;
