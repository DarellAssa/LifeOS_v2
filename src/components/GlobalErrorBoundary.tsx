import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('GlobalErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      const debugMode = typeof window !== 'undefined' && localStorage.getItem('lifeos-debug') === 'true';

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center space-y-5">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Something went wrong</h2>
                <p className="text-sm text-muted-foreground">
                  We hit an unexpected error. Your data is safe — try refreshing or head back to the dashboard.
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => this.setState({ hasError: false })}
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Try again
                </Button>
                <Button
                  onClick={() => {
                    this.setState({ hasError: false });
                    window.location.href = '/';
                  }}
                >
                  <Home className="h-4 w-4 mr-2" /> Dashboard
                </Button>
              </div>
              {debugMode && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Technical details
                  </summary>
                  <pre className="mt-2 text-[10px] bg-muted p-3 rounded-md overflow-auto max-h-40 text-muted-foreground">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
