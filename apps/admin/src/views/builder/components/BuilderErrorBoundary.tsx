import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

interface BuilderErrorBoundaryProps {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors in the builder workspace and offers recovery. */
export class BuilderErrorBoundary extends React.Component<BuilderErrorBoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[builder]", error, info.componentStack);
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-600" aria-hidden />
          <h1 className="text-lg font-semibold">Something went wrong in the builder</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error.message || "An unexpected error occurred. Try reloading — your draft may be recoverable from local backup."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
