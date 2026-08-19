'use client';
import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      // Detail teknis (pesan asli, komponen mana yang error) TIDAK ditampilkan
      // ke user — staf RS bukan orang teknis, pesan bahasa Inggris/istilah
      // React cuma bikin bingung. Detail lengkapnya tetap ada di console
      // browser lewat componentDidCatch() di atas, jadi IT/developer masih
      // bisa lacak kalau diminta screenshot console.
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center w-full py-16 px-6 bg-background text-center">
          <img src="/logo.png" alt="RS Lestari Raharja" className="h-12 w-12 object-contain mb-4 opacity-90" />
          <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Terjadi Kesalahan</h2>
          <p className="text-muted-foreground mb-1 max-w-md text-sm">
            Bagian ini mengalami gangguan yang tidak terduga.
          </p>
          <p className="text-muted-foreground mb-6 max-w-md text-sm">
            Silakan muat ulang halaman. Kalau terus berulang, hubungi petugas IT rumah sakit.
          </p>
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RotateCw className="w-4 h-4" />
            Muat Ulang Halaman
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
