"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Yakalanan hata:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 border-2 border-destructive/20 rounded-lg bg-destructive/5">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div className="text-center">
            <h3 className="font-semibold text-destructive">Bir hata oluştu</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {this.state.error?.message || "Beklenmeyen bir hata oluştu"}
            </p>
          </div>
          <Button variant="outline" onClick={this.handleReset}>
            Yeniden Dene
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
