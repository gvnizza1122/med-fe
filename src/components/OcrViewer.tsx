'use client';
import { motion, AnimatePresence } from 'framer-motion';
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

function OcrViewer({ recordId, pages = [], isLoading = false, onLoadPages }: OcrViewerProps) {
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [ocrPages, setOcrPages] = useState<OcrPage[]>(pages);
  const [loading, setLoading] = useState(isLoading);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (pages.length > 0 && ocrPages.length === 0) {
      setOcrPages(pages);
      if (pages.length > 0 && selectedPage === null) {
        setSelectedPage(pages[0].page_number);
      }
    }
  }, [pages, ocrPages.length, selectedPage]);

  const loadOcr = async () => {
    if (!onLoadPages || ocrPages.length > 0) return;
    setLoading(true);
    setLoadError(null);
    try {
      const loaded = await onLoadPages();
      setOcrPages(loaded);
      if (loaded.length > 0 && selectedPage === null) {
        setSelectedPage(loaded[0].page_number);
      }
    } catch (err) {
      // Sebelumnya error di sini cuma di-console.error dan disembunyikan —
      // tampilan jatuh ke state "tidak ada halaman bukti" seolah dokumennya
      // memang tidak punya halaman scan, padahal OCR-nya gagal/timeout.
      // Verifikator jadi salah kira sudah aman padahal belum sempat dicek.
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat hasil OCR.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOcr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLoadPages, ocrPages.length, selectedPage]);

  const selectedPageData = useMemo(() => {
    return ocrPages.find(p => p.page_number === selectedPage);
  }, [selectedPage, ocrPages]);

  const highlightedText = useMemo(() => {
    if (!selectedPageData || !searchTerm.trim()) {
      return selectedPageData?.ocr_text || '';
    }

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = selectedPageData.ocr_text.split(regex);

    return parts.map((part, idx) => {
      if (regex.test(part)) {
        return `<mark style="background:#fbbf24;color:#000;padding:2px 4px;border-radius:2px;font-weight:600;">${part}</mark>`;
      }
      return part;
    }).join('');
  }, [selectedPageData, searchTerm]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return '#10b981';
    if (confidence >= 80) return '#f59e0b';
    return '#dc2626';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90) return '✅';
    if (confidence >= 80) return '⚠️';
    return '❌';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 90) return 'Tinggi';
    if (confidence >= 80) return 'Sedang';
    return 'Rendah (mungkin kurang akurat)';
  };

  if (loading) {
    return (
      <motion.div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
          color: 'var(--text-muted)',
          gap: 16,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          style={{ fontSize: 32 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' as const }}
        >
          📄
        </motion.div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Memproses hasil OCR...</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>
          Sistem sedang membaca teks dari halaman scan dokumen. Proses ini bisa memakan waktu beberapa detik hingga puluhan detik, terutama untuk berkas besar atau dokumen berkualitas rendah. Mohon tunggu dan jangan menutup halaman ini.
        </div>
        <div style={{ fontSize: 11, color: 'var(--accent-blue)', marginTop: 8 }}>
          💡 Tip: Hasil OCR akan disimpan, jadi pemuatan berikutnya akan lebih cepat
        </div>
      </motion.div>
    );
  }

  if (loadError) {
    return (
      <motion.div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
          color: 'var(--text-muted)',
          gap: 12,
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>Gagal memuat hasil OCR</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>
          {loadError} Ini BUKAN berarti dokumennya tidak punya halaman bukti — sistem belum sempat selesai membacanya.
        </div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={loadOcr}>
          Coba Lagi
        </button>
      </motion.div>
    );
  }

  if (ocrPages.length === 0) {
    return (
      <motion.div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
          color: 'var(--text-muted)',
          gap: 12,
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Tidak ada halaman bukti tambahan</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 300 }}>
          Berkas klaim ini tidak memiliki halaman scan (dokumen klinis) yang perlu diaudit. Semua halaman adalah dokumen native dari sistem.
        </div>
      </motion.div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          paddingBottom: 16,
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 4 }}>
          📄 Bukti Pendukung
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          {ocrPages.length} halaman dokumen scan tersedia
        </p>
      </motion.div>

      {/* Page List & Search */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 12px',
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>🔍</span>
          <input
            type="text"
            placeholder="Cari kode diagnosis/prosedur dalam teks OCR (contoh: 90.59, O42.1)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 13,
              color: 'var(--text-primary)',
            }}
          />
          {searchTerm && (
            <motion.button
              onClick={() => setSearchTerm('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                color: 'var(--text-muted)',
                padding: '4px 8px',
              }}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            >
              ✕
            </motion.button>
          )}
        </div>

        {/* Page Buttons */}
        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <AnimatePresence>
            {ocrPages.map((page, idx) => (
              <motion.button
                key={page.page_number}
                onClick={() => setSelectedPage(page.page_number)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: selectedPage === page.page_number
                    ? `2px solid ${getConfidenceColor(page.confidence)}`
                    : `1px solid var(--border-color)`,
                  background: selectedPage === page.page_number
                    ? `${getConfidenceColor(page.confidence)}15`
                    : 'var(--surface)',
                  fontSize: 12,
                  fontWeight: selectedPage === page.page_number ? 700 : 600,
                  cursor: 'pointer',
                  color: selectedPage === page.page_number
                    ? getConfidenceColor(page.confidence)
                    : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                }}
                whileHover={{
                  borderColor: getConfidenceColor(page.confidence),
                  y: -2,
                }}
              >
                <span>{getConfidenceIcon(page.confidence)}</span>
                <span>Halaman {page.page_number}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>({page.confidence.toFixed(0)}%)</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* OCR Text Display */}
      <AnimatePresence mode="wait">
        {selectedPageData && (
          <motion.div
            key={selectedPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              padding: 16,
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${getConfidenceColor(selectedPageData.confidence)}40`,
              background: `${getConfidenceColor(selectedPageData.confidence)}08`,
            }}
          >
            {/* Confidence Info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid var(--border-color)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{ fontSize: 20 }}>{getConfidenceIcon(selectedPageData.confidence)}</span>
                <div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: getConfidenceColor(selectedPageData.confidence),
                  }}>
                    Tingkat Akurasi: {selectedPageData.confidence.toFixed(1)}%
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    marginTop: 2,
                  }}>
                    {getConfidenceLabel(selectedPageData.confidence)}
                  </div>
                </div>
              </div>

              {selectedPageData.confidence < 85 && (
                <div style={{
                  marginLeft: 'auto',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-xs)',
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  fontSize: 11,
                  color: '#92400e',
                  fontWeight: 600,
                }}>
                  💡 Teks mungkin kurang akurat (halaman tulisan tangan atau kualitas rendah)
                </div>
              )}
            </div>

            {/* OCR Text */}
            <div style={{
              background: 'var(--surface)',
              border: `1px solid ${getConfidenceColor(selectedPageData.confidence)}20`,
              borderRadius: 'var(--radius-xs)',
              padding: 12,
              fontFamily: 'monospace',
              fontSize: 12,
              color: 'var(--text-primary)',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 400,
              overflowY: 'auto',
            }}>
              {searchTerm ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: highlightedText,
                  }}
                />
              ) : (
                selectedPageData.ocr_text
              )}
            </div>

            {/* Search Info */}
            {searchTerm && (
              <div style={{
                marginTop: 12,
                padding: '8px 12px',
                borderRadius: 'var(--radius-xs)',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                fontSize: 11,
                color: '#0c4a6e',
              }}>
                🔍 Kata kunci <strong>"{searchTerm}"</strong> telah di-highlight dalam teks
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <motion.div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          padding: 12,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          fontSize: 12,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Tinggi (≥90%)</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Teks sangat akurat</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Sedang (80-90%)</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Akurasi cukup</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>❌</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Rendah (&lt;80%)</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Verifikasi manual diperlukan</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default OcrViewer;
