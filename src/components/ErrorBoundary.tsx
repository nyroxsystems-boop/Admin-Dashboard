/**
 * ErrorBoundary for Admin Dashboard
 * Catches unhandled React errors and shows a recovery UI.
 */
import React, { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary] Unhandled error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '2rem',
                    fontFamily: 'system-ui, sans-serif',
                    background: '#0a0a0a',
                    color: '#e5e5e5',
                }}>
                    <div style={{
                        maxWidth: '480px',
                        textAlign: 'center',
                        padding: '2.5rem',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.03)',
                    }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                            Unerwarteter Fehler
                        </h2>
                        <p style={{ color: '#888', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                            Etwas ist schiefgelaufen. Bitte laden Sie die Seite neu.
                        </p>
                        <pre style={{
                            fontSize: '0.75rem',
                            color: '#666',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '1rem',
                            borderRadius: '8px',
                            overflow: 'auto',
                            maxHeight: '120px',
                            textAlign: 'left',
                            marginBottom: '1.5rem',
                        }}>
                            {this.state.error?.message || 'Unknown error'}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '0.75rem 2rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#3b82f6',
                                color: '#fff',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                            }}
                        >
                            Seite neu laden
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
