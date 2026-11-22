import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected application error.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('ParkPool ErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed.error && parsed.operationType) {
          friendly = `Database ${parsed.operationType} error on "${parsed.path || 'unknown'}": ${parsed.error}`;
        }
      } catch {
        // plain text error message
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8F7F4] p-6 text-[#111827]">
          <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-700">
              <ShieldAlert className="h-6 w-6 shrink-0" />
              <h1 className="font-display text-lg font-bold">Application Recovery Required</h1>
            </div>
            <p className="mt-3 rounded-xl bg-rose-50 p-3 font-mono text-xs text-rose-900 break-words">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-[#111827] px-4 py-2 text-xs font-bold text-white hover:bg-black"
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
