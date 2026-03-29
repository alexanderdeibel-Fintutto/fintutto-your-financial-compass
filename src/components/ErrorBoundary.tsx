/**
 * ErrorBoundary – Globale Fehlergrenze für alle Seiten
 * Verhindert komplette App-Abstürze bei unerwarteten Fehlern
 */
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-6 w-6" />
                Ein Fehler ist aufgetreten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Diese Seite konnte nicht geladen werden. Bitte versuchen Sie es erneut.
              </p>
              {this.state.error && (
                <details className="text-xs bg-muted p-3 rounded-lg">
                  <summary className="cursor-pointer font-medium mb-1">Technische Details</summary>
                  <pre className="whitespace-pre-wrap break-all">{this.state.error.message}</pre>
                </details>
              )}
              <div className="flex gap-2">
                <Button onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}>
                  <RefreshCw className="h-4 w-4 mr-2" />Erneut versuchen
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/'}>
                  <Home className="h-4 w-4 mr-2" />Zum Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional wrapper for easy use with lazy-loaded pages
 */
export function withErrorBoundary<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: T) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
