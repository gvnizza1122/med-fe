'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Menu, FileWarning } from 'lucide-react';

// Worker di-bundle & disajikan same-origin oleh Next (bukan CDN) — supaya
// tidak melanggar CSP script-src/worker-src 'self' yang sudah diset di app ini.
// Dibungkus try/catch: pernah ditemukan device (PC RS, browser lawas) yang
// crash total & minta reload saat membuka panel PDF, sementara PC lain aman —
// kalau baris ini yang jadi biang keladinya (browser tak dukung import.meta.url/
// Worker API tertentu), kegagalannya sekarang cuma bikin PdfViewer masuk ke
// status error yang bisa di-"Coba Lagi", bukan crash modul yang menjalar ke
// ErrorBoundary di halaman hasil.
try {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
} catch (err) {
  console.error('[PdfViewer] Gagal mengatur workerSrc pdf.js:', err);
}

interface PdfViewerProps {
  fileId: string;
  fileName?: string;
  height?: number;
}

type PdfState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; blob: Blob };

// Cache blob per file (maks 4) selama halaman hidup — PDF besar tidak perlu
// diunduh ulang setiap kali panel dibuka-tutup.
const blobCache = new Map<string, Blob>();
const CACHE_MAX = 4;

function cacheBlob(fileId: string, blob: Blob) {
  if (blobCache.size >= CACHE_MAX && !blobCache.has(fileId)) {
    const oldestKey = blobCache.keys().next().value as string | undefined;
    if (oldestKey) blobCache.delete(oldestKey);
  }
  blobCache.set(fileId, blob);
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.15;
const ZOOM_DEFAULT = 1.15;

/**
 * Penampil PDF asli yang diunggah perawat — bukti primer untuk verifikasi.
 *
 * Dirender manual pakai pdf.js (bukan <iframe> ke viewer bawaan browser) —
 * viewer bawaan browser (Chrome dsb.) punya toolbar & panel thumbnail besar
 * yang tidak bisa dikustomisasi/diperkecil. Dengan render manual, toolbar,
 * strip thumbnail, dan zoom semuanya kita kontrol sendiri agar ruang untuk
 * membaca dokumen lebih besar.
 */
export default function PdfViewer({ fileId, fileName, height = 640 }: PdfViewerProps) {
  const [pdfState, setPdfState] = useState<PdfState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(ZOOM_DEFAULT);
  const [showThumbs, setShowThumbs] = useState(false);

  // Kalau prop fileId berganti, kembalikan ke state loading. Pola resmi React:
  // sesuaikan state saat render, bukan di dalam effect.
  const [prevFileId, setPrevFileId] = useState(fileId);
  if (fileId !== prevFileId) {
    setPrevFileId(fileId);
    setPdfState({ status: 'loading' });
    setNumPages(0);
    setCurrentPage(1);
    setShowThumbs(false);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = blobCache.get(fileId);
      if (cached) {
        setPdfState({ status: 'ready', blob: cached });
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

        cacheBlob(fileId, blob);
        setPdfState({ status: 'ready', blob });
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

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const onDocLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setCurrentPage(1);
  }, []);

  const scrollToPage = (n: number) => {
    const el = pageRefs.current[n];
    if (el) {
      // scrollIntoView menemukan sendiri ancestor yang bisa di-scroll —
      // aman dari perhitungan offsetTop manual yang gampang salah kalau ada
      // ancestor position:sticky/relative di antara page-wrap dan scrollRef.
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(n);
    }
  };

  // Lacak halaman mana yang paling dekat ke tengah viewport saat scroll,
  // supaya indikator "X / Y" & highlight thumbnail sinkron dengan posisi baca.
  // Pakai scroll listener + setTimeout throttle (bukan IntersectionObserver)
  // karena lebih murah untuk dites/diverifikasi dan tidak butuh threshold tuning.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || numPages === 0) return;

    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const computeCurrentPage = () => {
      const containerRect = container.getBoundingClientRect();
      const containerMid = containerRect.top + containerRect.height / 2;
      let closestPage = 1;
      let closestDist = Infinity;
      Object.entries(pageRefs.current).forEach(([pageStr, el]) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        const dist = Math.abs(mid - containerMid);
        if (dist < closestDist) {
          closestDist = dist;
          closestPage = Number(pageStr);
        }
      });
      setCurrentPage(closestPage);
    };

    const handleScroll = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        computeCurrentPage();
      }, 100);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [numPages]);

  const zoomOut = () => setScale(s => Math.max(ZOOM_MIN, +(s - ZOOM_STEP).toFixed(2)));
  const zoomIn = () => setScale(s => Math.min(ZOOM_MAX, +(s + ZOOM_STEP).toFixed(2)));
  const zoomReset = () => setScale(ZOOM_DEFAULT);

  if (pdfState.status === 'loading') {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground"
        style={{ height }}
      >
        Memuat dokumen PDF...
      </div>
    );
  }

  if (pdfState.status === 'error') {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-border bg-card"
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <FileWarning className="h-6 w-6 text-destructive" />
          <div className="text-sm font-semibold text-destructive">
            Dokumen tidak dapat ditampilkan
          </div>
          <div className="max-w-xs text-xs text-muted-foreground">
            {pdfState.message}
          </div>
          <Button size="sm" variant="outline" onClick={handleRetry}>
            Coba Lagi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card" style={{ height }}>
      <Document
        file={pdfState.blob}
        onLoadSuccess={onDocLoadSuccess}
        onLoadError={() => setPdfState({ status: 'error', message: 'Berkas PDF rusak atau tidak valid.' })}
        loading={<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Merender dokumen...</div>}
        error={<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Dokumen tidak dapat dirender.</div>}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
          <Button
            type="button"
            size="icon"
            variant={showThumbs ? 'secondary' : 'ghost'}
            className="h-7 w-7"
            onClick={() => setShowThumbs(v => !v)}
            title="Tampilkan/sembunyikan daftar halaman"
          >
            <Menu className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={currentPage <= 1}
            onClick={() => scrollToPage(currentPage - 1)}
            title="Halaman sebelumnya"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[64px] text-center text-xs font-medium text-foreground">
            {currentPage} / {numPages || '–'}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={currentPage >= numPages}
            onClick={() => scrollToPage(currentPage + 1)}
            title="Halaman berikutnya"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={zoomOut}
            disabled={scale <= ZOOM_MIN}
            title="Perkecil"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <button
            type="button"
            className="min-w-[48px] rounded-md px-1.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
            onClick={zoomReset}
            title="Kembali ke ukuran normal"
          >
            {Math.round(scale * 100)}%
          </button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={zoomIn}
            disabled={scale >= ZOOM_MAX}
            title="Perbesar"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          {fileName && (
            <span className="ml-auto truncate text-xs text-muted-foreground" title={fileName}>
              {fileName}
            </span>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {showThumbs && (
            <div className="flex w-20 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border bg-muted/20 p-2">
              {Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => scrollToPage(n)}
                  title={`Halaman ${n}`}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-md border p-1 text-[10px] text-muted-foreground transition-colors',
                    n === currentPage
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-transparent hover:border-border hover:bg-accent',
                  )}
                >
                  <Page pageNumber={n} width={64} renderTextLayer={false} renderAnnotationLayer={false} />
                  <span>{n}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-y-auto bg-muted/10 p-3" ref={scrollRef}>
            <div className="flex flex-col items-center gap-3">
              {Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
                <div
                  key={n}
                  data-page={n}
                  ref={el => { pageRefs.current[n] = el; }}
                  className="rounded-md shadow-sm"
                >
                  <Page pageNumber={n} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Document>
    </div>
  );
}
