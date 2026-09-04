const plugin = require("tailwindcss/plugin");
/** @type {import('tailwindcss').Config} */

/**
 * Tailwind Config — Admin Dashboard
 *
 * Aligned with User-Dashboard design system (Phase 0). Alle Farb-Tokens sind
 * HSL-Tripel in design-system/tokens.css (Single Source) und werden hier als
 * hsl(var(--x) / <alpha-value>) gemappt — Opacity-Modifier (bg-canvas/50)
 * funktionieren dadurch überall. Admin ist bewusst dark-only.
 *
 * Brand: Partsunion Blue (accent-500 in tokens.css = 216 82% 51%)
 */
export default {
    darkMode: ["class", '[data-theme="dark"]'],
    content: ["./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                // Aus dem Redesign vom 2026-07-30. Alle drei via @fontsource in
                // main.tsx geladen — selbst gehostet, kein CDN (DSGVO).
                //
                // Die Aufteilung ist Absicht: Space Grotesk hat auffaellige
                // Ziffern und eine engere Laufweite, das traegt Ueberschriften.
                // Als Textschrift waere sie unruhig — dafuer Manrope.
                sans: ['Manrope Variable', 'Manrope', 'system-ui', 'sans-serif'],
                display: ['Space Grotesk Variable', 'Space Grotesk', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'SF Mono', 'monospace'],
            },
            fontSize: {
                'label': ['0.75rem', { letterSpacing: '0.08em', fontWeight: '500' }],
                'kpi-sm': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '500' }],
                'kpi': ['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '500' }],
                'kpi-lg': ['3rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '600' }],
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            colors: {
                // v2 — Partsunion Industrial Precision. Alle Tokens sind
                // HSL-Tripel (tokens.css, Single Source) → <alpha-value>
                // macht Opacity-Modifier (bg-canvas/50) überall nutzbar.
                // Auflage: Grundfarbe kippt zwischen Hell und Dunkel, die
                // Deckung steht an der Verwendungsstelle (bg-overlay/[0.045]).
                // Siehe den Kommentar in tokens.css.
                overlay: 'rgb(var(--overlay) / <alpha-value>)',
                // Schrift auf vollflächiger Statusfarbe — kippt mit dem Modus.
                // Siehe tokens.css, dort steht die Rechnung dahinter.
                'auf-ton': 'hsl(var(--auf-ton) / <alpha-value>)',
                canvas: 'hsl(var(--bg-canvas) / <alpha-value>)',
                surface: 'hsl(var(--bg-surface) / <alpha-value>)',
                elevated: {
                    DEFAULT: 'hsl(var(--bg-elevated) / <alpha-value>)',
                    hover: 'hsl(var(--bg-elevated-hover) / <alpha-value>)',
                },
                'border-subtle': 'hsl(var(--border) / <alpha-value>)',
                'border-strong': 'hsl(var(--border-strong) / <alpha-value>)',
                'text-primary': 'hsl(var(--text-primary) / <alpha-value>)',
                'text-secondary': 'hsl(var(--text-secondary) / <alpha-value>)',
                // Neue Stufen aus dem Redesign. tertiary fuer Beschriftungen,
                // faint fuer die kleinen Mono-Versalien der Gruppenmarken.
                'text-tertiary': 'hsl(var(--text-tertiary) / <alpha-value>)',
                'text-muted': 'hsl(var(--text-muted) / <alpha-value>)',
                'text-faint': 'hsl(var(--text-faint) / <alpha-value>)',
                'status-success': 'hsl(var(--success) / <alpha-value>)',
                'status-success-muted': 'hsl(var(--success) / 0.12)',
                'status-warning': 'hsl(var(--warning) / <alpha-value>)',
                'status-warning-muted': 'hsl(var(--warning) / 0.12)',
                'status-danger': 'hsl(var(--danger) / <alpha-value>)',
                'status-danger-muted': 'hsl(var(--danger) / 0.12)',
                'status-info': 'hsl(var(--info) / <alpha-value>)',
                'status-info-muted': 'hsl(var(--info) / 0.12)',

                // v2-Accent: Deep Signal Blue (scale 50/200/400/500/600/700)
                // Legacy `accent` (DEFAULT/foreground) koexistiert bis Phase 2.
                accent: {
                    DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
                    foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
                    50: 'hsl(var(--accent-50) / <alpha-value>)',
                    200: 'hsl(var(--accent-200) / <alpha-value>)',
                    400: 'hsl(var(--accent-400) / <alpha-value>)',
                    500: 'hsl(var(--accent-500) / <alpha-value>)',
                    600: 'hsl(var(--accent-600) / <alpha-value>)',
                    700: 'hsl(var(--accent-700) / <alpha-value>)',
                },

                // Core semantic (shadcn/Radix compatible)
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                    // P0.7: backs `bg-primary-hover` used by the default button.
                    hover: 'hsl(var(--primary-hover))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                success: {
                    DEFAULT: 'hsl(var(--success) / <alpha-value>)',
                    foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
                    muted: 'hsl(var(--success) / 0.12)',
                },
                warning: {
                    DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
                    foreground: 'hsl(var(--warning-foreground) / <alpha-value>)',
                    muted: 'hsl(var(--warning) / 0.12)',
                },
                info: {
                    DEFAULT: 'hsl(var(--info) / <alpha-value>)',
                    foreground: 'hsl(var(--info-foreground) / <alpha-value>)',
                    muted: 'hsl(var(--info) / 0.12)',
                },
                danger: {
                    DEFAULT: 'hsl(var(--danger) / <alpha-value>)',
                    muted: 'hsl(var(--danger) / 0.12)',
                },
                border: 'hsl(var(--border) / <alpha-value>)',
                input: 'hsl(var(--input) / <alpha-value>)',
                ring: 'hsl(var(--ring) / <alpha-value>)',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))',
                },
                sidebar: {
                    DEFAULT: 'hsl(var(--sidebar-background))',
                    foreground: 'hsl(var(--sidebar-foreground))',
                    primary: 'hsl(var(--sidebar-primary))',
                    'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
                    accent: 'hsl(var(--sidebar-accent))',
                    'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
                    border: 'hsl(var(--sidebar-border))',
                    ring: 'hsl(var(--sidebar-ring))',
                },
            },
            spacing: {
                'sidebar': '240px',
                'sidebar-collapsed': '56px',
                'topbar': '56px',
            },
            maxWidth: {
                'content': '1680px',
            },
            boxShadow: {
                'xs': 'var(--shadow-xs)',
                'card': 'var(--shadow-card)',
                'card-hover': 'var(--shadow-card-hover)',
                'modal': 'var(--shadow-modal)',
                'glow-primary': 'var(--shadow-glow-primary)',
                'glow-success': 'var(--shadow-glow-success)',
                'glow-warning': 'var(--shadow-glow-warning)',
                'glow-danger': 'var(--shadow-glow-danger)',
                'glow-accent': 'var(--shadow-glow-accent)',
            },
            animation: {
                'fade-in': 'fade-in 0.4s ease-out forwards',
                'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
                'fade-in-down': 'fade-in-down 0.4s ease-out forwards',
                'scale-in': 'scale-in 0.3s ease-out forwards',
                'slide-in-left': 'slide-in-left 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
                'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
                'shimmer': 'shimmer 2s infinite',
                'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
            },
            keyframes: {
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
                'fade-in-up': {
                    from: { opacity: '0', transform: 'translateY(12px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in-down': {
                    from: { opacity: '0', transform: 'translateY(-12px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'scale-in': {
                    from: { opacity: '0', transform: 'scale(0.96)' },
                    to: { opacity: '1', transform: 'scale(1)' },
                },
                'slide-in-left': {
                    from: { opacity: '0', transform: 'translateX(-16px)' },
                    to: { opacity: '1', transform: 'translateX(0)' },
                },
                'pulse-soft': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
                'glow-pulse': {
                    // P5.2: tokenisiert auf den Accent (war hardcodiert 221 83% 53%).
                    '0%, 100%': { boxShadow: '0 0 8px hsl(var(--accent-500) / 0.2)' },
                    '50%': { boxShadow: '0 0 20px hsl(var(--accent-500) / 0.4)' },
                },
                shimmer: {
                    from: { transform: 'translateX(-100%)' },
                    to: { transform: 'translateX(100%)' },
                },
                'bounce-subtle': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-4px)' },
                },
            },
            transitionDuration: {
                'fast': '150ms',
                'base': '200ms',
                'medium': '280ms',
                'slow': '400ms',
            },
            transitionTimingFunction: {
                'out': 'cubic-bezier(0.16, 1, 0.3, 1)',
                'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
                'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            },
            zIndex: {
                'dropdown': '10',
                'sticky': '20',
                'topbar': '30',
                'drawer': '40',
                'modal': '50',
                'toast': '60',
                'tooltip': '70',
            },
        },
    },
    plugins: [
        require("tailwindcss-animate"),
        /**
         * `hell:` — greift NUR im Hellmodus.
         *
         * Gebraucht fuer die wenigen Stellen, die feste Tailwind-Farben nutzen
         * statt unserer Token: Kalender-Terminarten, Statusfelder im Kalender.
         * Deren Toene (violet-300, emerald-300 …) sind konstant und kippen
         * nicht mit dem Modus. Auf dunklem Grund sind sie hell und lesbar, auf
         * hellem Grund liegen sie als blasse Schrift auf einer blassen Toenung
         * DERSELBEN Farbe — praktisch unsichtbar.
         *
         * Mit dieser Variante bleibt der dunkle Modus unveraendert und nur der
         * helle bekommt einen dunkleren Ton. Das ist weniger eingreifend, als
         * die Farbigkeit ueberall auf Token umzustellen — die Terminarten
         * SOLLEN sich in der Farbe unterscheiden, und dafuer reichen unsere
         * vier Statusfarben nicht.
         */
        plugin(({ addVariant }) => {
            addVariant('hell', ['&:is(.light *)', '&:is([data-theme="light"] *)']);
        }),
    ],
}
