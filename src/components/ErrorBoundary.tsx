import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 text-white p-6">
                    <div className="max-w-2xl w-full bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-8">
                        <h1 className="text-2xl font-bold text-red-500 mb-4">
                            Something went wrong
                        </h1>
                        <p className="text-gray-300 mb-6">
                            The application encountered an unexpected error and could not render.
                        </p>

                        {this.state.error && (
                            <div className="bg-black/50 rounded p-4 mb-6 overflow-auto max-h-60">
                                <p className="font-mono text-sm text-red-400">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <pre className="font-mono text-xs text-gray-500 mt-2">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
