'use client';
import { useState, useMemo, useEffect } from 'react';

interface OcrPage {
  page_number: number;
  ocr_text: string;
  confidence: number;
}

interface OcrViewerProps {
  recordId: string;
  pages?: OcrPage[];
  isLoading?: boolean;
  onLoadPages?: () => Promise<OcrPage[]>;
}

/**
 * OCR viewer — versi ringkas untuk perawat/verifikator.
 *
 * Hanya tampilkan ringkasan: berapa halaman scan, berapa yang kualitas rendah,
 * dan halaman mana saja. Raw OCR text disembunyikan di belakang "Lihat Teks"
 * karena output OCR dari scan buruk TIDAK berguna bagi non-teknis — cuma
 * membingungkan. ponetly: tambah image preview kalau backend store scan pages.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- recordId kept for parent prop contract
export default function OcrViewer({ recordId: _recordId, pages = [], isLoading = false, onLoadPages }: OcrViewerProps) {
  const [ocrPages, setOcrPages] = useState<OcrPage[]>(pages);
  const [loading, setLoading] = useState(isLoading);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);

  useEffect(() => {
    if (pages.length > 0 && ocrPages.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync prop→state on first mount
      setOcrPages(pages);
    }
  }, [pages, ocrPages.length]);

  const loadOcr = async () => {
    if (!onLoadPages || ocrPages.length > 0) return;
    setLoading(true);
    setLoadError(null);
    try {
      const loaded = await onLoadPages();
      setOcrPages(loaded);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat hasil OCR.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOcr();
  }, [onLoadPages, ocrPages.length]);

  const summary = useMemo(() => {
    const total = ocrPages.length;
    const lowQuality = ocrPages.filter(p => p.confidence < 80).length;
    const mediumQuality = ocrPages.filter(p => p.confidence >= 80 && p.confidence < 90).length;
    const avgConfidence = total > 0 ? ocrPages.reduce((s, p) => s + p.confidence, 0) / total : 0;
    return { total, lowQuality, mediumQuality, avgConfidence };
  }, [ocrPages]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        <div style={{ marginBottom: 8, fontSize: 18 }}>📄</div>
        Membaca halaman scan dokumen...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Gagal memuat OCR</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{loadError}</div>
        <button className="btn btn-secondary btn-sm" onClick={loadOcr}>Coba Lagi</button>
      </div>
    );
  }

  if (ocrPages.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Tidak ada halaman scan dalam berkas ini.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Ringkasan — ini yang dilihat perawat */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '10px 14px', borderRadius: 'var(--radius-sm)',
        background: summary.lowQuality > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)',
        border: `1px solid ${summary.lowQuality > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`,
        fontSize: 12,
      }}>
        <span style={{ fontSize: 18 }}>📄</span>
        <div style={{ flex: 1 }}>
          <strong>{summary.total} halaman scan</strong>
          {summary.lowQuality > 0 && (
            <span style={{ color: '#dc2626', marginLeft: 8 }}>
              · {summary.lowQuality} halaman kualitas rendah — perlu verifikasi manual
            </span>
          )}
          {summary.lowQuality === 0 && summary.mediumQuality > 0 && (
            <span style={{ color: '#f59e0b', marginLeft: 8 }}>
              · {summary.mediumQuality} halaman kualitas sedang
            </span>
          )}
          {summary.lowQuality === 0 && summary.mediumQuality === 0 && (
            <span style={{ color: '#10b981', marginLeft: 8 }}>· kualitas baik</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Akurasi rata-rata: {summary.avgConfidence.toFixed(0)}%
        </span>
      </div>

      {/* Daftar halaman — compact, click to expand */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ocrPages.map(page => {
          const isExpanded = expandedPage === page.page_number;
          const isLow = page.confidence < 80;
          const isMed = page.confidence >= 80 && page.confidence < 90;
          const dotColor = isLow ? '#dc2626' : isMed ? '#f59e0b' : '#10b981';

          return (
            <div key={page.page_number} style={{
              border: `1px solid ${isExpanded ? dotColor : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setExpandedPage(isExpanded ? null : page.page_number)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', border: 'none', cursor: 'pointer',
                  background: isExpanded ? `${dotColor}08` : 'transparent',
                  fontSize: 12, textAlign: 'left',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>Halaman {page.page_number}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  · {page.confidence.toFixed(0)}% akurasi
                </span>
                {isLow && <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 600 }}>⚠ perlu cek</span>}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
                  {isExpanded ? '▲ Sembunyikan' : '▼ Lihat Teks'}
                </span>
              </button>
              {isExpanded && (
                <div style={{
                  padding: '10px 12px', borderTop: `1px solid ${dotColor}30`,
                  background: 'var(--surface)', fontFamily: 'monospace', fontSize: 11,
                  color: 'var(--text-primary)', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: 250, overflowY: 'auto',
                }}>
                  {page.ocr_text || '(tidak ada teks terdeteksi)'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
