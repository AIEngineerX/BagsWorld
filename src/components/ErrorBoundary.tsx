"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic error boundary for wrapping dynamic components (modals, chats, etc.)
 * that might crash without taking down the entire page.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center p-6 bg-gray-900/95 rounded-lg border border-red-500/30 text-white min-h-[120px]">
          <div className="text-center max-w-sm">
            <p className="font-pixel text-sm text-red-400 mb-2">Something went wrong</p>
            <p className="text-xs text-gray-400 mb-3 break-words">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={this.handleReset}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-pixel rounded transition-colors"
            >
              {this.props.resetLabel || "Try Again"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
