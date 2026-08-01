'use client';
import { useState, useEffect } from 'react';
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

/**
 * Ringkasan audit AI untuk perawat/verifikator.
 *
 * Bukan panel teknis: tanpa istilah "semantik", tanpa blok paragraf panjang.
 * Yang tampil: (1) kode yang TIDAK ada bukti — perlu cek manual, (2) kode yang
 * terbukti — aman, (3) kode tambahan yang disarankan AI — opsional. Satu baris
 * per kode, detail bisa dibuka kalau mau.
 */
export default function AuditSuggestions({ recordId }: AuditSuggestionsProps) {
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<{ type: string; code: string } | null>(null);

  useEffect(() => {
    if (!recordId) return;
    const fetchAuditSuggestions = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getAuditSuggestions(recordId);
        setAuditData(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Gagal memuat saran audit');
      } finally {
        setLoading(false);
      }
    };
    fetchAuditSuggestions();
  }, [recordId]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        <div style={{ marginBottom: 8, fontSize: 18 }}>🔍</div>
        Menganalisis bukti dokumen...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Gagal memuat saran audit</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{error}</div>
      </div>
    );
  }

  // AI gagal total — bedakan dari "sudah dicek, memang tidak ada bukti"
  const aiCallFailed = !!auditData?.errors && auditData.errors.length > 0
    && (auditData?.claimed_evidence?.length || 0) === 0
    && (auditData?.suggested_codes?.length || 0) === 0;

  if (aiCallFailed) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>Analisis belum berhasil</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Sistem belum selesai memeriksa klaim ini. Muat ulang halaman untuk mencoba lagi.
        </div>
      </div>
    );
  }

  if (!auditData?.available) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        {auditData?.message || 'Bukti dokumen belum tersedia untuk diperiksa.'}
      </div>
    );
  }

  const codesWithoutEvidence = auditData?.claimed_evidence?.filter(ce => !ce.found) || [];
  const codesWithEvidence = auditData?.claimed_evidence?.filter(ce => ce.found) || [];
  const suggestedCodes = auditData?.suggested_codes || [];

  const renderCodeRow = (
    type: string,
    code: string,
    label: string,
    badge: string,
    detail: React.ReactNode,
    key: string,
  ) => {
    const isExpanded = expanded?.type === type && expanded?.code === code;
    return (
      <div key={key} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <button
          onClick={() => setExpanded(isExpanded ? null : { type, code })}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', border: 'none', cursor: 'pointer',
            background: 'transparent', fontSize: 12, textAlign: 'left',
          }}
        >
          <span className={`badge ${badge}`} style={{ fontSize: 10, flexShrink: 0 }}>{label}</span>
          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{code}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
            {isExpanded ? '▲' : '▼'}
          </span>
        </button>
        {isExpanded && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {detail}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 1. Kode tanpa bukti — paling penting untuk perawat */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          {codesWithoutEvidence.length > 0 ? (
            <span style={{ color: '#dc2626' }}>
              ⚠️ {codesWithoutEvidence.length} kode klaim tidak ditemukan di dokumen scan — perlu dicek manual
            </span>
          ) : (
            <span style={{ color: '#10b981' }}>✅ Semua kode klaim ditemukan di dokumen</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {codesWithoutEvidence.map(item => renderCodeRow(
            'no-evidence', item.code, 'Perlu Cek', 'badge-error',
            <>Kode ini diklaim tapi tidak ada catatan pendukungnya di dokumen scan. Pastikan kode benar-benar sesuai tindakan/penanganan pasien sebelum dikirim ke vClaim.</>,
            `noev-${item.code}`
          ))}
        </div>
      </div>

      {/* 2. Kode terbukti */}
      {codesWithEvidence.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981', marginBottom: 6 }}>
            {codesWithEvidence.length} kode didukung bukti dokumen
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {codesWithEvidence.map(item => renderCodeRow(
              'proven', item.code, 'Terbukti', 'badge-valid',
              <>
                Bukti ditemukan di halaman {item.page_number}.
                {item.quotation && <div style={{ marginTop: 4, fontStyle: 'italic', fontFamily: 'monospace' }}>&ldquo;{item.quotation}&rdquo;</div>}
              </>,
              `prov-${item.code}`
            ))}
          </div>
        </div>
      )}

      {/* 3. Saran kode tambahan */}
      {suggestedCodes.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>
            💡 {suggestedCodes.length} kode tambahan terdeteksi di dokumen (opsional)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {suggestedCodes.map(item => renderCodeRow(
              'suggested', item.code, 'Usulan', 'badge-info',
              <>
                Terdeteksi di halaman {item.page_number}.
                {item.reasoning && <div style={{ marginTop: 4 }}>{item.reasoning}</div>}
              </>,
              `sug-${item.code}`
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
