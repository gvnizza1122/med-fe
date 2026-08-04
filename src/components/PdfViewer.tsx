'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface PdfViewerProps {
  fileId: string;
  fileName?: string;
  height?: number;
}

type PdfState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; url: string };

// Cache blob per file (maks 4) selama halaman hidup — PDF besar tidak perlu
// diunduh ulang setiap kali panel dibuka-tutup.
const blobCache = new Map<string, string>();
const CACHE_MAX = 4;

function cacheBlobUrl(fileId: string, url: string) {
  if (blobCache.size >= CACHE_MAX) {
    const oldestKey = blobCache.keys().next().value as string | undefined;
    if (oldestKey) {
      const oldestUrl = blobCache.get(oldestKey);
      blobCache.delete(oldestKey);
      if (oldestUrl) URL.revokeObjectURL(oldestUrl);
    }
  }
  blobCache.set(fileId, url);
}

/**
 * Penampil PDF asli yang diunggah perawat — bukti primer untuk verifikasi.
 *
 * PDF diambil dari backend sebagai blob lalu ditampilkan lewat <iframe>
 * (memanfaatkan viewer PDF bawaan browser), jadi tidak butuh library tambahan.
 * Dipajang berdampingan dengan tabel data klaim agar perawat bisa mencocokkan
 * langsung isi dokumen asli dengan hasil ekstraksi.
 */
export default function PdfViewer({ fileId, fileName, height = 640 }: PdfViewerProps) {
  const [pdfState, setPdfState] = useState<PdfState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // Kalau prop fileId berganti, kembalikan ke state loading. Pola resmi React:
  // sesuaikan state saat render, bukan di dalam effect.
  const [prevFileId, setPrevFileId] = useState(fileId);
  if (fileId !== prevFileId) {
    setPrevFileId(fileId);
    setPdfState({ status: 'loading' });
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = blobCache.get(fileId);
      if (cached) {
        setPdfState({ status: 'ready', url: cached });
        return;
      }

      try {
        const res = await api.getPdfFile(fileId);
        if (cancelled) return;

        if (!res.ok) {
          setPdfState({ status: 'error', message: 'Gagal memuat dokumen. Coba lagi.' });
          return;
        }

        const blob = await res.blob();
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        cacheBlobUrl(fileId, url);
        setPdfState({ status: 'ready', url });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error && err.message
          ? err.message
          : 'Gagal memuat dokumen. Coba lagi.';
        setPdfState({ status: 'error', message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId, attempt]);

  const handleRetry = () => {
    setPdfState({ status: 'loading' });
    setAttempt(a => a + 1);
  };

  if (pdfState.status === 'loading') {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Memuat dokumen PDF...
      </div>
    );
  }

  if (pdfState.status === 'error') {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
          Dokumen tidak dapat ditampilkan
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {pdfState.message}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleRetry}>
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      background: 'var(--surface)',
    }}>
      <iframe
        src={pdfState.url}
        style={{ width: '100%', height, border: 'none', display: 'block' }}
        title={fileName || 'Dokumen PDF'}
      />
    </div>
  );
}
