import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

export default class GameBoundary extends Component<
  { children: ReactNode; onExit: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workshop rendering error', error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <main className="game-error">
        <h1>The workshop needs a fresh start.</h1>
        <p>Your saved notebook and designs are still in this browser.</p>
        <button type="button" className="button-primary" onClick={this.props.onExit}>
          Back to the workshops
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
