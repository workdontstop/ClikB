// ErrorBoundary.tsx
import React from 'react';
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: any }> {
    state = { err: null as any };
    static getDerivedStateFromError(err: any) { return { err }; }
    componentDidCatch(err: any, info: any) { console.error('ErrorBoundary', err, info); }
    render() { return this.state.err ? <pre style={{ padding: 16 }}>{String(this.state.err?.message || this.state.err)}</pre> : this.props.children; }
}
