import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

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
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl max-w-lg shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-500/10 rounded-full">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 mb-6">
              The application encountered an unexpected error.
            </p>
            
            {this.state.error && (
              <div className="bg-black/50 p-4 rounded-lg text-left mb-6 overflow-auto max-h-48 border border-slate-800">
                <p className="font-mono text-xs text-red-400 whitespace-pre-wrap">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                   <p className="font-mono text-[10px] text-slate-500 mt-2 whitespace-pre-wrap">
                     {this.state.errorInfo.componentStack}
                   </p>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
                <button
                onClick={() => {
                    localStorage.removeItem('neurotrade_active_signal');
                    window.location.reload();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                <RefreshCw className="w-4 h-4" />
                Clear Cache & Reload
                </button>
                <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                >
                Reload Page
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
