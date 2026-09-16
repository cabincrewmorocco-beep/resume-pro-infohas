import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled UI render exception:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetAndReload = () => {
    try {
      if (typeof window !== "undefined") {
        // Clear volatile and potentially corrupted session state while keeping critical lists
        const preserveKeys = ["resumeai_users_list"];
        const preserved: Record<string, string | null> = {};
        preserveKeys.forEach((k) => {
          preserved[k] = localStorage.getItem(k);
        });

        sessionStorage.clear();
        localStorage.removeItem("resumeai_active_resume");
        localStorage.removeItem("resumeai_current_draft");

        preserveKeys.forEach((k) => {
          if (preserved[k]) localStorage.setItem(k, preserved[k]!);
        });

        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  private handleSoftRecover = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || "An unexpected rendering error occurred.";
      const errorStack = this.state.error?.stack || this.state.errorInfo?.componentStack || "No stack trace available.";

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
          <div className="w-full max-w-xl bg-card border border-border/80 rounded-2xl shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The application caught an unexpected error during rendering. Your saved data is protected.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 border border-border p-3.5 text-xs text-foreground/90 font-mono break-words">
              {errorMessage}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleSoftRecover}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <RotateCcw className="w-4 h-4" />
                Try Recovering View
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 font-medium text-sm transition-colors text-foreground"
              >
                <RefreshCw className="w-4 h-4" />
                Reset State & Reload App
              </button>
            </div>

            <div className="pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
              >
                {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {this.state.showDetails ? "Hide technical stack trace" : "View technical stack trace for debugging"}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 p-3 rounded-lg bg-black/90 text-emerald-400 font-mono text-[11px] leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap border border-border/40">
                  {errorStack}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
