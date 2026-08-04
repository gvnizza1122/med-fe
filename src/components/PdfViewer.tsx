'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { api } from '@/lib/api';

// Worker di-bundle & disajikan same-origin oleh Next (bukan CDN) — supaya
// tidak melanggar CSP script-src/worker-src 'self' yang sudah diset di app ini.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

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
      <div className="pdf-viewer-shell" style={{ height }}>
        <div className="pdf-viewer-message">Memuat dokumen PDF...</div>
      </div>
    );
  }

  if (pdfState.status === 'error') {
    return (
      <div className="pdf-viewer-shell" style={{ height }}>
        <div className="pdf-viewer-message">
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>
            Dokumen tidak dapat ditampilkan
          </div>
          <div style={{ fontSize: 12, color: 'var(--body-mid)', marginBottom: 8 }}>
            {pdfState.message}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleRetry}>
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-shell" style={{ height }}>
      <Document
        file={pdfState.blob}
        onLoadSuccess={onDocLoadSuccess}
        onLoadError={() => setPdfState({ status: 'error', message: 'Berkas PDF rusak atau tidak valid.' })}
        loading={<div className="pdf-viewer-message">Merender dokumen...</div>}
        error={<div className="pdf-viewer-message">Dokumen tidak dapat dirender.</div>}
      >
        <div className="pdf-toolbar">
          <button
            className={`pdf-toolbar-btn ${showThumbs ? 'active' : ''}`}
            onClick={() => setShowThumbs(v => !v)}
            title="Tampilkan/sembunyikan daftar halaman"
          >
            ☰
          </button>
          <span className="pdf-toolbar-sep" />
          <button className="pdf-toolbar-btn" disabled={currentPage <= 1} onClick={() => scrollToPage(currentPage - 1)} title="Halaman sebelumnya">
            ‹
          </button>
          <span className="pdf-toolbar-page">{currentPage} / {numPages || '–'}</span>
          <button className="pdf-toolbar-btn" disabled={currentPage >= numPages} onClick={() => scrollToPage(currentPage + 1)} title="Halaman berikutnya">
            ›
          </button>
          <span className="pdf-toolbar-sep" />
          <button className="pdf-toolbar-btn" onClick={zoomOut} disabled={scale <= ZOOM_MIN} title="Perkecil">
            −
          </button>
          <button className="pdf-toolbar-zoom" onClick={zoomReset} title="Kembali ke ukuran normal">
            {Math.round(scale * 100)}%
          </button>
          <button className="pdf-toolbar-btn" onClick={zoomIn} disabled={scale >= ZOOM_MAX} title="Perbesar">
            +
          </button>
          {fileName && <span className="pdf-toolbar-filename" title={fileName}>{fileName}</span>}
        </div>

        <div className="pdf-viewer-body">
          {showThumbs && (
            <div className="pdf-thumb-strip">
              {Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  className={`pdf-thumb ${n === currentPage ? 'active' : ''}`}
                  onClick={() => scrollToPage(n)}
                  title={`Halaman ${n}`}
                >
                  <Page pageNumber={n} width={64} renderTextLayer={false} renderAnnotationLayer={false} />
                  <span>{n}</span>
                </button>
              ))}
            </div>
          )}
          <div className="pdf-main-scroll" ref={scrollRef}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map(n => (
              <div
                key={n}
                data-page={n}
                ref={el => { pageRefs.current[n] = el; }}
                className="pdf-page-wrap"
              >
                <Page pageNumber={n} scale={scale} renderTextLayer={false} renderAnnotationLayer={false} />
              </div>
            ))}
          </div>
        </div>
      </Document>
    </div>
  );
}
