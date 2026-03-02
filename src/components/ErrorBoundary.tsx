// Phase 24: Error Boundary Component

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    /** Compact mode: show inline card instead of full-page overlay */
    compact?: boolean;
    /** Page/component name for better error messages */
    pageName?: string;
    /** Called when user clicks Reset (optional) */
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        if (import.meta.env.DEV) {
            console.error('Error Boundary caught an error:', error, errorInfo);
        }

        // Send frontend errors to backend Server Status dashboard
        try {
            fetch('http://localhost:3000/api/status/errors/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: error.name,
                    message: error.message,
                    stack: errorInfo.componentStack,
                    route: `FRONTEND_REACT [${this.props.pageName ?? 'Unknown'}]: ${window.location.pathname}`,
                    timestamp: new Date().toISOString(),
                }),
            }).catch(() => { /* silently ignore if server is down */ });
        } catch (_) { /* ignore */ }

        this.setState({ error, errorInfo });
    }

    handleReset = () => {
        this.props.onReset?.();
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleGoHome = () => {
        this.handleReset();
        window.location.href = '/dashboard';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { pageName = 'this page', compact } = this.props;

            // ── Compact inline card ─────────────────────────────────────────
            if (compact) {
                return (
                    <div className="glass border border-danger/30 rounded-xl p-6 text-center space-y-3">
                        <div className="flex justify-center">
                            <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-red-400" />
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold text-dark-text text-sm">Failed to load {pageName}</p>
                            <p className="text-dark-muted text-xs mt-1">
                                {import.meta.env.DEV && this.state.error
                                    ? this.state.error.message
                                    : 'An unexpected error occurred. Please try again.'}
                            </p>
                        </div>
                        <button
                            onClick={this.handleReset}
                            className="inline-flex items-center gap-1.5 text-xs bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 px-4 py-2 rounded-lg transition-all font-medium"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Retry
                        </button>
                    </div>
                );
            }

            // ── Full-page fallback ──────────────────────────────────────────
            return (
                <div className="min-h-[60vh] flex items-center justify-center p-4">
                    <div className="glass max-w-2xl w-full p-8 rounded-2xl border border-dark-border">
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-10 h-10 text-red-500" />
                            </div>
                        </div>

                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-bold text-dark-text mb-2">
                                Failed to load {pageName}
                            </h1>
                            <p className="text-dark-muted">
                                Don't worry — we've logged this error. Try again or go back to Dashboard.
                            </p>
                        </div>

                        {import.meta.env.DEV && this.state.error && (
                            <div className="bg-dark-surface rounded-xl p-4 mb-6 overflow-auto max-h-[250px] border border-danger/20">
                                <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Dev — Error Details:
                                </h3>
                                <pre className="text-xs text-dark-muted whitespace-pre-wrap">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo && '\n\nStack:\n' + this.state.errorInfo.componentStack}
                                </pre>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex-1 bg-dark-surface hover:bg-dark-border/30 text-dark-text px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                            >
                                <Home className="w-4 h-4" />
                                Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// ── Convenience wrapper for route-level use ───────────────────────────────────
interface PageErrorBoundaryProps {
    pageName: string;
    children: ReactNode;
}

export const PageErrorBoundary = ({ pageName, children }: PageErrorBoundaryProps) => (
    <ErrorBoundary pageName={pageName}>
        {children}
    </ErrorBoundary>
);
