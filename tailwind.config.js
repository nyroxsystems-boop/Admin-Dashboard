/** @type {import('tailwindcss').Config} */

/**
 * Tailwind Config — Admin Dashboard
 *
 * Aligned with User-Dashboard design system. Uses CSS variables from index.css
 * for full light/dark mode support via next-themes class strategy.
 *
 * Brand: Partsunion Blue (#2563eb / HSL 221 83% 53%)
 */
export default {
    darkMode: ["class", '[data-theme="dark"]'],
    content: ["./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
                display: ['DM Sans', 'Inter Display', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'IBM Plex Mono', 'SF Mono', 'monospace'],
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
                // Adaptive design tokens (CSS vars from index.css)
                canvas: 'var(--bg-canvas)',
                surface: 'var(--bg-surface)',
                elevated: 'var(--bg-elevated)',
                'border-subtle': 'var(--border)',
                'border-strong': 'var(--border-strong)',
                'text-primary': 'var(--text-primary)',
                'text-secondary': 'var(--text-secondary)',
                'text-muted': 'var(--text-muted)',

                // Semantic status
                'status-success': 'var(--success)',
                'status-success-muted': 'var(--success-muted)',
                'status-warning': 'var(--warning)',
                'status-warning-muted': 'var(--warning-muted)',
                'status-danger': 'var(--danger)',
                'status-danger-muted': 'var(--danger-muted)',
                'status-info': 'var(--info)',
                'status-info-muted': 'var(--info-muted)',

                // Accent scale (Partsunion Blue)
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                    50: 'var(--accent-50)',
                    200: 'var(--accent-200)',
                    400: 'var(--accent-400)',
                    500: 'var(--accent-500)',
                    600: 'var(--accent-600)',
                    700: 'var(--accent-700)',
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
                    DEFAULT: 'hsl(var(--success))',
                    foreground: 'hsl(var(--success-foreground))',
                    muted: 'hsl(var(--success-muted))',
                },
                warning: {
                    DEFAULT: 'hsl(var(--warning))',
                    foreground: 'hsl(var(--warning-foreground))',
                    muted: 'hsl(var(--warning-muted))',
                },
                info: {
                    DEFAULT: 'hsl(var(--info))',
                    foreground: 'hsl(var(--info-foreground))',
                    muted: 'hsl(var(--info-muted))',
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
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
                    '0%, 100%': { boxShadow: '0 0 8px rgba(37, 99, 235, 0.2)' },
                    '50%': { boxShadow: '0 0 20px rgba(37, 99, 235, 0.4)' },
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
    plugins: [require("tailwindcss-animate")],
}
