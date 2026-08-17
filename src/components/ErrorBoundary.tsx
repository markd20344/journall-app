import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Catches render errors anywhere below it so one broken item can't blank the
// whole app — without this, an uncaught error unmounts the entire React tree
// and leaves the screen empty with no way back short of clearing site data.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <span className="app-title">Journall OS</span>
          <p>Something went wrong displaying this screen.</p>
          <p className="settings-hint small">{this.state.error.message}</p>
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
