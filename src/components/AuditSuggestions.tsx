'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import { api } from '@/lib/api';

interface ClaimedEvidence {
  code: string;
  found: boolean;
  page_number?: number;
  quotation?: string;
}

interface SuggestedCode {
  code: string;
  page_number: number;
  quotation: string;
  reasoning: string;
}

interface AuditResponse {
  available: boolean;
  claimed_evidence: ClaimedEvidence[];
  suggested_codes: SuggestedCode[];
  message?: string;
  errors?: string[];
}

interface AuditSuggestionsProps {
  recordId?: string;
  recordData?: {
    DIAGLIST?: string[];
    PROCLIST?: string[];
  };
}

function AuditSuggestions({ recordId, recordData = {} }: AuditSuggestionsProps) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) return;

    const fetchAuditSuggestions = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getAuditSuggestions(recordId);
        setAuditData(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Gagal memuat saran audit';
        setError(message);
        console.error('[Audit] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditSuggestions();
  }, [recordId]);

  const codesWithEvidence = useMemo(
    () => auditData?.claimed_evidence?.filter((ce) => ce.found) || [],
    [auditData]
  );

  const codesWithoutEvidence = useMemo(
    () => auditData?.claimed_evidence?.filter((ce) => !ce.found) || [],
    [auditData]
  );

  const suggestedCodes = useMemo(() => auditData?.suggested_codes || [], [auditData]);

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
          🔍
        </motion.div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Menganalisis bukti audit...</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 400, lineHeight: 1.5, color: 'var(--text-muted)' }}>
          Sistem sedang melakukan analisis semantik terhadap kode dengan bukti dokumen. Proses ini melibatkan pemeriksaan AI dan bisa memakan waktu beberapa detik.
        </div>
      </motion.div>
    );
  }

  if (error) {
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
        <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>Gagal memuat saran audit</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>
          {error}
        </div>
      </motion.div>
    );
  }

  // AI gagal total setelah semua percobaan (backend tetap kirim available:true supaya
  // FE tahu harus retry — lihat auditSuggestionsService.js) — HARUS dibedakan dari
  // "sudah dicek, memang tidak ada bukti", jangan sampai verifikator kira ini hasil
  // analisis asli padahal AI-nya belum pernah benar-benar jalan.
  const aiCallFailed = !!auditData?.errors && auditData.errors.length > 0
    && (auditData?.claimed_evidence?.length || 0) === 0
    && (auditData?.suggested_codes?.length || 0) === 0;

  if (aiCallFailed) {
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
        <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>Analisis AI gagal diproses</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>
          Sistem belum berhasil menganalisis bukti untuk klaim ini setelah beberapa percobaan.
          Ini BUKAN hasil audit — coba muat ulang halaman untuk mencoba lagi.
        </div>
      </motion.div>
    );
  }

  if (!auditData?.available) {
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
        <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Belum ada bukti tersedia untuk diperiksa</div>
        <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>
          {auditData?.message || 'Halaman scan dokumen belum tersedia atau proses OCR masih berjalan. Audit kode akan tersedia setelah halaman scan berhasil diproses.'}
        </div>
      </motion.div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
          🔍 Audit & Validasi Kode
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Analisis semantik kode dengan bukti dokumen scan
        </p>
      </motion.div>

      {/* Section 1: Kode Terbukti (With Evidence) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div
          style={{
            paddingBottom: 12,
            marginBottom: 16,
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>
            ✅ Kode Terbukti ({codesWithEvidence.length})
          </div>
          {codesWithEvidence.length === 0 ? (
            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                background: '#f0fdf4',
                border: '1px solid #dcfce7',
                fontSize: 12,
                color: '#166534',
              }}
            >
              Tidak ada kode yang ditemukan bukti semantiknya dalam dokumen scan.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatePresence>
                {codesWithEvidence.map((item) => {
                  const isExpanded = expandedCode === `proven-${item.code}`;

                  return (
                    <motion.div
                      key={`proven-${item.code}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      onClick={() => setExpandedCode(isExpanded ? null : `proven-${item.code}`)}
                      style={{
                        padding: 12,
                        borderRadius: 'var(--radius-sm)',
                        background: '#f0fdf4',
                        border: '1px solid #dcfce7',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      whileHover={{
                        backgroundColor: '#e6fcf0',
                        borderColor: '#10b981',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: isExpanded ? 12 : 0,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
                          {item.code}
                        </div>
                        <motion.span
                          style={{
                            fontSize: 12,
                            color: '#10b981',
                          }}
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                        >
                          ▼
                        </motion.span>
                      </div>

                      <AnimatePresence>
                        {isExpanded && item.quotation && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{
                              padding: 10,
                              borderRadius: 'var(--radius-xs)',
                              background: 'rgba(255,255,255,0.5)',
                              border: '1px solid #d1fae5',
                            }}
                          >
                            <div
                              style={{
                                fontFamily: 'monospace',
                                color: '#065f46',
                                marginBottom: 6,
                                fontStyle: 'italic',
                                fontSize: 11,
                                lineHeight: '1.5',
                              }}
                            >
                              "{item.quotation}"
                            </div>
                            {item.page_number && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: '#10b981',
                                  fontWeight: 600,
                                }}
                              >
                                📄 Halaman {item.page_number}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      {/* Section 2: Peringatan (Without Evidence) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div
          style={{
            paddingBottom: 12,
            marginBottom: 16,
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 12 }}>
            ⚠️ Peringatan: Kode Tanpa Bukti ({codesWithoutEvidence.length})
          </div>
          {codesWithoutEvidence.length === 0 ? (
            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                fontSize: 12,
                color: '#991b1b',
              }}
            >
              Semua kode yang diklaim telah ditemukan buktinya.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatePresence>
                {codesWithoutEvidence.map((item) => (
                  <motion.div
                    key={`warning-${item.code}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      background: '#fef2f2',
                      border: '1px solid #fee2e2',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b' }}>
                      {item.code}
                    </div>
                    <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 4 }}>
                      Kode ini tidak ditemukan bukti semantiknya dalam dokumen scan. Verifikator perlu mengevaluasi klaim tanpa bukti tertulis.
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      {/* Section 3: Saran Audit (Suggested Codes) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', marginBottom: 12 }}>
            💡 Saran Audit ({suggestedCodes.length})
          </div>
          {suggestedCodes.length === 0 ? (
            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                fontSize: 12,
                color: '#0c4a6e',
              }}
            >
              Tidak ada kode tambahan yang disarankan dengan bukti dalam dokumen scan.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatePresence>
                {suggestedCodes.map((item) => {
                  const isExpanded = expandedCode === `suggested-${item.code}`;

                  return (
                    <motion.div
                      key={`suggested-${item.code}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      onClick={() => setExpandedCode(isExpanded ? null : `suggested-${item.code}`)}
                      style={{
                        padding: 12,
                        borderRadius: 'var(--radius-sm)',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      whileHover={{
                        backgroundColor: '#dbeafe',
                        borderColor: '#2563eb',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: isExpanded ? 12 : 0,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af' }}>
                          {item.code}
                        </div>
                        <motion.span
                          style={{
                            fontSize: 12,
                            color: '#2563eb',
                          }}
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                        >
                          ▼
                        </motion.span>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                          >
                            {/* Quotation */}
                            <div
                              style={{
                                padding: 10,
                                borderRadius: 'var(--radius-xs)',
                                background: 'rgba(255,255,255,0.5)',
                                border: '1px solid #dbeafe',
                              }}
                            >
                              <div
                                style={{
                                  fontFamily: 'monospace',
                                  color: '#0c4a6e',
                                  marginBottom: 6,
                                  fontStyle: 'italic',
                                  fontSize: 11,
                                  lineHeight: '1.5',
                                }}
                              >
                                "{item.quotation}"
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: '#2563eb',
                                  fontWeight: 600,
                                  marginBottom: 6,
                                }}
                              >
                                📄 Halaman {item.page_number}
                              </div>
                              {item.reasoning && (
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: '#0c4a6e',
                                    lineHeight: '1.4',
                                  }}
                                >
                                  <strong>Alasan:</strong> {item.reasoning}
                                </div>
                              )}
                            </div>

                            {/* Recommendation */}
                            <div
                              style={{
                                padding: 8,
                                borderRadius: 'var(--radius-xs)',
                                background: '#dbeafe',
                                border: '1px solid #93c5fd',
                                fontSize: 11,
                                color: '#0c4a6e',
                                fontWeight: 500,
                              }}
                            >
                              💡 Pertimbangkan untuk menambahkan kode ini jika verifikator setuju dengan bukti di atas.
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      {/* Footer: Anti-Upcoding Disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{
          padding: 12,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface)',
          border: '1px solid var(--border-color)',
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: '1.5',
        }}
      >
        <strong>📋 Catatan Anti-Upcoding:</strong> Semua saran audit didasarkan pada analisis semantik bukti dokumen. Setiap kode harus didukung oleh bukti tertulis yang jelas dari halaman scan. Jangan menambahkan kode berdasarkan asumsi atau pertimbangan finansial — hanya berdasarkan bukti medis yang terverifikasi.
      </motion.div>
    </div>
  );
}

export default AuditSuggestions;
