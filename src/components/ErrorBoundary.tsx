/**
 * ErrorBoundary for the Admin Dashboard.
 *
 * Improvements over the legacy version:
 *  - Pipes errors through `errorTracker` (Sentry-aware).
 *  - Bilingual fallback (de/en) chosen via `document.documentElement.lang`,
 *    so it renders even if I18nProvider hasn't mounted yet.
 *  - Soft retry button (resets error state) instead of `window.location.reload()`.
 *  - Toggleable "technical details" disclosure for advanced users.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { errorTracker } from '../services/errorTracker';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    showDetails: boolean;
}

interface FallbackStrings {
    title: string;
    description: string;
    retry: string;
    reload: string;
    showDetails: string;
    hideDetails: string;
}

const STRINGS: Record<'de' | 'en', FallbackStrings> = {
    de: {
        title: 'Unerwarteter Fehler',
        description:
            'Wir wurden informiert. Du kannst es erneut versuchen oder die Seite neu laden.',
        retry: 'Erneut versuchen',
        reload: 'Seite neu laden',
        showDetails: 'Technische Details anzeigen',
        hideDetails: 'Details ausblenden',
    },
    en: {
        title: 'Unexpected error',
        description: "We've been notified. You can retry or reload the page.",
        retry: 'Try again',
        reload: 'Reload page',
        showDetails: 'Show technical details',
        hideDetails: 'Hide details',
    },
};

function pickStrings(): FallbackStrings {
    if (typeof document !== 'undefined') {
        const lang = (document.documentElement.lang || 'de').slice(0, 2).toLowerCase();
        if (lang === 'en') return STRINGS.en;
    }
    return STRINGS.de;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, showDetails: false };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        errorTracker.captureException(error, {
            componentStack: info.componentStack,
            source: 'ErrorBoundary',
        });
    }

    private handleRetry = (): void => {
        this.setState({ hasError: false, error: null, showDetails: false });
    };

    private handleReload = (): void => {
        window.location.reload();
    };

    private toggleDetails = (): void => {
        this.setState((s) => ({ showDetails: !s.showDetails }));
    };

    render(): ReactNode {
        if (!this.state.hasError) return this.props.children;
        if (this.props.fallback) return this.props.fallback;

        const t = pickStrings();
        const { error, showDetails } = this.state;

        return (
            <div
                role="alert"
                className="min-h-screen flex items-center justify-center px-6"
                style={{ background: 'hsl(var(--bg-canvas))', color: 'hsl(var(--text-primary))' }}
            >
                <div
                    className="max-w-lg w-full text-center px-8 py-10"
                    style={{
                        background: 'hsl(var(--bg-surface))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 16,
                    }}
                >
                    <div
                        aria-hidden="true"
                        className="text-xs uppercase tracking-widest font-mono mb-3"
                        style={{ color: 'hsl(var(--text-muted))' }}
                    >
                        runtime / unhandled
                    </div>
                    <h1 className="text-xl font-semibold mb-3">{t.title}</h1>
                    <p
                        className="text-sm leading-relaxed mb-6"
                        style={{ color: 'hsl(var(--text-secondary))' }}
                    >
                        {t.description}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <button
                            type="button"
                            onClick={this.handleRetry}
                            className="px-5 py-2.5 rounded-md text-sm font-medium"
                            style={{ background: 'hsl(var(--accent-500))', color: 'hsl(0 0% 100%)' }}
                        >
                            {t.retry}
                        </button>
                        <button
                            type="button"
                            onClick={this.handleReload}
                            className="px-5 py-2.5 rounded-md text-sm font-medium"
                            style={{
                                background: 'transparent',
                                color: 'hsl(var(--text-secondary))',
                                border: '1px solid hsl(var(--border))',
                            }}
                        >
                            {t.reload}
                        </button>
                    </div>

                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={this.toggleDetails}
                            className="text-xs underline-offset-2 hover:underline"
                            style={{ color: 'hsl(var(--text-muted))' }}
                            aria-expanded={showDetails}
                        >
                            {showDetails ? t.hideDetails : t.showDetails}
                        </button>

                        {showDetails && error && (
                            <pre
                                className="text-left text-xs mt-3 p-3 rounded overflow-auto max-h-48"
                                style={{
                                    background: 'hsl(0 0% 100% / 0.04)',
                                    color: 'hsl(var(--text-secondary))',
                                }}
                            >
                                {error.name}: {error.message}
                                {error.stack ? `\n\n${error.stack}` : ''}
                            </pre>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}
