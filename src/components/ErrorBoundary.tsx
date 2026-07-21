'use client';
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: 40,
          background: '#0d1117', color: '#c9d1d9', textAlign: 'center'
        }}>
          <h1 style={{ fontSize: 32, marginBottom: 8 }}>⚠️</h1>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Terjadi Kesalahan</h2>
          <p style={{ color: '#8b949e', marginBottom: 20, maxWidth: 400 }}>
            Aplikasi mengalami error yang tidak terduga. Silakan muat ulang halaman.
          </p>
          <pre style={{
            background: '#161b22', padding: '12px 16px', borderRadius: 8,
            fontSize: 12, color: '#f85149', maxWidth: '90%', overflow: 'auto',
            marginBottom: 20
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', background: '#238636', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14
            }}
          >
            🔄 Muat Ulang Halaman
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
