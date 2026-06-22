'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { io } from 'socket.io-client';

interface FileInfo {
  id: string; file_name: string; period: string; status: string;
  total_records: number; valid_count: number; error_count: number; pending_count: number;
  error_summary: { rule_id: string; rule_name: string; count: number; severity: string }[];
  uploaded_by_name: string; created_at: string; column_count: number;
  ai_prompt_tokens?: number; ai_completion_tokens?: number; ai_total_tokens?: number;
}
interface ValidationError {
  rule_id: string; rule_name: string; field_name: string;
  error_message: string; expected_value: string; actual_value: string; severity: string;
}
interface ClaimRecord {
  id: string; row_number: number; sep: string; nokartu: string; nama_pasien: string;
  mrn: string; admission_date: string; discharge_date: string; kelas_rawat: number;
  los: number; diagnosa_list: string; prosedur_list: string;
  inacbg_code: string; deskripsi_inacbg: string;
  tarif_inacbg: number; tarif_rs: number; total_tarif: number;
  icu_indikator: number; vent_hour: number; dpjp_name: string;
  validation_status: string; error_count: number; errors: ValidationError[];
  ai_status?: string; ai_notes?: string; ai_suggestions?: string;
}
interface ComparisonChange {
  row_number: number; nama_pasien: string; mrn: string;
  field_name: string; before: string; after: string;
}
interface ComparisonData {
  file_id: string; file_name: string; total_changes: number;
  changes: ComparisonChange[];
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.fileId as string;
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [records, setRecords] = useState<ClaimRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [errorType, setErrorType] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFixing, setIsFixing] = useState(false);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    try {
      const p: Record<string, string> = { page: String(page), limit: '30' };
      if (filter !== 'all') p.status = filter;
      if (search) p.search = search;
      if (errorType) p.error_type = errorType;
      const d = await api.getRecords(fileId, p);
      setRecords(d.records); setTotal(d.total);
      if (d.records && d.records.length > 0) {
        const firstErrorRecord = d.records.find((r: any) => r.error_count > 0);
        setSelectedRecordId(prev => {
          if (prev && d.records.some((r: any) => r.id === prev)) return prev;
          return firstErrorRecord ? firstErrorRecord.id : d.records[0].id;
        });
      }
    } catch { /* ignore */ }
  }, [fileId, page, filter, search, errorType]);

  const loadFileInfo = useCallback(async () => {
    try {
      const f = await api.getFile(fileId);
      setFileInfo(f);
    } catch { /* ignore */ }
  }, [fileId]);

  const loadComparison = useCallback(async () => {
    try {
      const c = await api.getComparison(fileId);
      setComparison(c);
    } catch { /* ignore */ }
  }, [fileId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadFileInfo();
      await loadComparison();
      setLoading(false);
    })();
  }, [fileId, loadFileInfo, loadComparison]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleExport = async () => {
    try {
      const res = await api.exportFile(fileId, filter === 'all' ? 'all' : filter);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `validasi_${fileInfo?.file_name || 'klaim'}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch { alert('Export gagal'); }
  };

  const handleApprove = async () => {
    if (!confirm('Yakin ingin menyetujui file ini? File yang disetujui siap dikirim ke vClaim.')) return;
    try {
      await api.approveFile(fileId);
      await loadFileInfo();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal menyetujui');
    }
  };

  const handleAutoFix = async () => {
    if (!confirm(`Sistem HANYA akan memperbaiki berkas "${fileInfo?.file_name}" ini saja.
SEP (lowercase) dan nomor kartu BPJS akan otomatis dikapitalisasi & dibersihkan. Lanjutkan?`)) return;
    setIsFixing(true);
    try {
      const res = await api.autoFixFile(fileId);
      alert(`Sukses! ${res.message}`);
      await loadFileInfo();
      await loadRecords();
      await loadComparison();
      setShowComparison(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal memperbaiki file');
    } finally {
      setIsFixing(false);
    }
  };

  const handleDownloadFixed = async () => {
    try {
      const res = await api.downloadFixedFile(fileId);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `PERBAIKAN_${fileInfo?.file_name.replace(/\.[^/.]+$/, "")}.TXT`;
      a.click(); URL.revokeObjectURL(url);
    } catch { alert('Download file gagal'); }
  };

  const handleAiAudit = async () => {
    setIsAuditing(true);
    setAuditProgress(0);
    try {
      await api.runAiAudit(fileId);
      await loadRecords();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Audit AI gagal');
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000');
    socket.on('ai-audit:status', (data) => {
      if (data.fileId === fileId) {
        setAuditProgress(data.progress);
        setIsAuditing(true);
      }
    });
    socket.on('ai-audit:complete', (data) => {
      if (data.fileId === fileId) {
        setIsAuditing(false);
        loadRecords();
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [fileId, loadRecords]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!fileInfo) return <div className="empty-state"><h3>File tidak ditemukan</h3></div>;

  const totalPages = Math.ceil(total / 30);
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
  const canApprove = ['supervisor', 'admin'].includes(user.role) && fileInfo.status === 'completed';
  const validPct = fileInfo.total_records > 0 ? ((fileInfo.valid_count / fileInfo.total_records) * 100).toFixed(1) : '0';

  const formatCurrency = (val: number) => {
    if (!val) return '-';
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  return (
    <div className="fade-in results-page-container">
      <div className="page-header" style={{ marginBottom: 20, alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Hasil Validasi</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            ID Batch: #VAL-{fileInfo.period?.replace('-', '') || '20231027'}-{fileInfo.id.substring(0, 3).toUpperCase()}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          {/* AI Progress */}
          <div className="header-progress-container">
            <span className="header-progress-label">Progres AI Audit</span>
            <div className="header-progress-track">
              <div className="header-progress-fill" style={{ width: `${validPct}%` }} />
            </div>
            <span className="header-progress-percent">{validPct}%</span>
          </div>

          {/* Bell Icon Notification */}
          <button className={`bell-btn ${fileInfo.error_count > 0 ? 'has-notifications' : ''}`} title="Notifikasi">
            🔔
          </button>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {comparison && comparison.total_changes > 0 && (
              <button className="btn-glass" onClick={() => setShowComparison(!showComparison)}>
                📄 {showComparison ? 'Sembunyikan' : 'Bandingkan File'}
              </button>
            )}
            {canApprove && (
              <button className="btn btn-success" onClick={handleApprove} style={{ padding: '8px 16px', fontSize: 12 }}>
                ✅ Setujui
              </button>
            )}
            <button className="btn btn-primary" onClick={handleAiAudit} disabled={isAuditing} style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              padding: '8px 16px',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span>🪄</span> {isAuditing ? `Auditing ${auditProgress}%` : 'Jalankan AI Audit'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16, borderLeft: '4px solid var(--accent-blue)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📄</span> Total Data
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{fileInfo.total_records}</div>
        </div>
        
        <div className="card" style={{ padding: 16, borderLeft: '4px solid var(--accent-green)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✅</span> Data Valid
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-green)' }}>{fileInfo.valid_count}</div>
        </div>
        
        <div className="card" style={{ padding: 16, borderLeft: '4px solid var(--accent-red)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>❌</span> Data Error
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-red)' }}>{fileInfo.error_count}</div>
        </div>
        
        <div className="card" style={{ padding: 16, borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⏳</span> Data Pending
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{fileInfo.pending_count}</div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: '4px solid var(--accent-purple)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🤖</span> Pemakaian Token AI
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#a78bfa' }}>
            {fileInfo.ai_total_tokens ? `${fileInfo.ai_total_tokens.toLocaleString('id-ID')} tok` : '-'}
          </div>
          {fileInfo.ai_total_tokens ? (
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {fileInfo.ai_prompt_tokens?.toLocaleString('id-ID')} prompt + {fileInfo.ai_completion_tokens?.toLocaleString('id-ID')} completion
            </div>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>AI belum digunakan</div>
          )}
        </div>
      </div>

      <div className="results-toolbar">
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Cari Nama, SEP, atau No. Kartu..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        
        <div className="filter-group">
          <span className="filter-label">Status:</span>
          <select className="filter-select" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>
            <option value="all">Semua Rekam</option>
            <option value="valid">Valid</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Rule Type:</span>
          <select className="filter-select" value={errorType} onChange={e => { setErrorType(e.target.value); setPage(1); }}>
            <option value="">Semua Aturan</option>
            {fileInfo.error_summary?.map(e => (
              <option key={e.rule_id} value={e.rule_id}>{e.rule_id} - {e.rule_name}</option>
            ))}
          </select>
        </div>
      </div>

      {showComparison && comparison && comparison.changes.length > 0 && (
        <div className="card fade-in" style={{
          marginBottom: 20,
          border: '1px solid rgba(16, 185, 129, 0.3)',
          background: 'rgba(16, 185, 129, 0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
              ✨ Perbandingan Perubahan Hasil Auto-Fix (Melihat Perbedaan File Asli vs Hasil Perbaikan)
            </h3>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowComparison(false)}>✕ Close</button>
          </div>
          <div className="table-container" style={{ maxHeight: 250, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Baris #</th>
                  <th>Nama Pasien</th>
                  <th>Nomor Rekam Medis (MRN)</th>
                  <th>Kolom Data</th>
                  <th>Sebelum (Original SIMRS)</th>
                  <th>Sesudah (Hasil Auto-Fix)</th>
                </tr>
              </thead>
              <tbody>
                {comparison.changes.map((chg, idx) => (
                  <tr key={idx}>
                    <td><strong>{chg.row_number}</strong></td>
                    <td>{chg.nama_pasien}</td>
                    <td><span className="badge badge-secondary">{chg.mrn || '-'}</span></td>
                    <td><span className="badge badge-info">{chg.field_name}</span></td>
                    <td style={{ color: '#ef4444', textDecoration: 'line-through', fontFamily: 'monospace', fontSize: 11 }}>{chg.before}</td>
                    <td style={{ color: '#10b981', fontWeight: 700, fontFamily: 'monospace', fontSize: 11 }}>
                      {chg.after} <span style={{ fontSize: 9, fontStyle: 'italic', fontWeight: 'normal' }}>✓ OK</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="split-layout">
        <div className="panel-left">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Data Validasi</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-glass" onClick={handleExport}>
                  📥 Export Excel
                </button>
                <button className="btn-glass" onClick={handleDownloadFixed}>
                  💾 TXT Fix
                </button>
              </div>
            </div>
            
            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Nama Pasien</th>
                    <th>No. SEP</th>
                    <th>Diagnosis (ICD-10)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        Tidak ada data ditemukan
                      </td>
                    </tr>
                  ) : (
                    records.map(rec => {
                      const isSelected = selectedRecordId === rec.id;
                      return (
                        <tr
                          key={rec.id}
                          className={isSelected ? 'selected-row' : ''}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedRecordId(rec.id)}
                        >
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13, color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                              {rec.nama_pasien || <span style={{ color: 'var(--accent-red)' }}>(kosong)</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              MRN: {rec.mrn || '-'}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12, color: isSelected ? '#a78bfa' : 'var(--accent-blue)', fontWeight: 500 }}>
                            {rec.sep}
                          </td>
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {rec.inacbg_code || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {rec.deskripsi_inacbg || '—'}
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-${rec.validation_status}`} style={{ fontSize: 10, padding: '3px 8px', fontWeight: 600 }}>
                              {rec.validation_status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: 0 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>← Sebelumnya</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) pageNum = i + 1;
                else if (page <= 4) pageNum = i + 1;
                else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                else pageNum = page - 3 + i;
                return (
                  <button key={pageNum} className={page === pageNum ? 'active' : ''}
                    onClick={() => setPage(pageNum)}>{pageNum}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Selanjutnya →</button>
            </div>
          )}
        </div>

        <div className={`panel-right ${!selectedRecordId ? 'collapsed' : ''}`}>
          {selectedRecordId && (() => {
            const selectedRecord = records.find(r => r.id === selectedRecordId);
            if (!selectedRecord) return null;
            
            const hasErrors = selectedRecord.errors && selectedRecord.errors.length > 0;
            const hasAiAudit = selectedRecord.ai_status && selectedRecord.ai_status !== 'pending';

            return (
              <div className="error-details-panel">
                <div className="error-details-header">
                  <div>
                    <h3>Detail Error</h3>
                    <div className="sep-sub">SEP: {selectedRecord.sep}</div>
                  </div>
                  <button className="error-details-close" onClick={() => setSelectedRecordId(null)}>
                    ✕
                  </button>
                </div>

                <div className="error-details-body">
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Nama Pasien:</span>
                      <span style={{ fontWeight: 600 }}>{selectedRecord.nama_pasien}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>No. Kartu:</span>
                      <span style={{ fontWeight: 600 }}>{selectedRecord.nokartu}</span>
                    </div>
                  </div>

                  {hasErrors ? (
                    selectedRecord.errors.map((err, idx) => (
                      <div key={idx} className={`error-card-item ${err.severity || 'major'}`}>
                        <div className="error-card-header">
                          <span className={`badge badge-${err.severity || 'major'}`}>
                            Severitas: {(err.severity || 'MAJOR').toUpperCase()}
                          </span>
                          <span className="error-card-title">ID Aturan: {err.rule_id}</span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                          {err.rule_name}
                        </div>
                        <div className="error-card-desc">
                          {err.error_message}
                        </div>

                        <div className="data-box-container">
                          <div className="data-box-wrapper">
                            <span className="data-box-title">Data Seharusnya</span>
                            <div className="data-box expected">
                              {err.expected_value || 'Nilai valid'}
                            </div>
                          </div>
                          <div className="data-box-wrapper">
                            <span className="data-box-title">Data Aktual</span>
                            <div className="data-box actual">
                              {err.actual_value || 'NULL'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>✅</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)' }}>Rekam Valid</span>
                      <p style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>Tidak ditemukan masalah untuk data ini.</p>
                    </div>
                  )}

                  {selectedRecord.ai_suggestions || (hasErrors && selectedRecord.errors[0]?.rule_id === 'RV-01') || (hasErrors && selectedRecord.errors[0]?.rule_id === 'RV-02') ? (
                    <div className="ai-fix-box">
                      <div className="ai-fix-header">
                        <span>💡</span> Saran AI
                      </div>
                      <div className="ai-fix-body">
                        {selectedRecord.ai_suggestions ? (
                          selectedRecord.ai_suggestions
                        ) : selectedRecord.errors[0]?.rule_id === 'RV-01' ? (
                          <span>Ditemukan huruf kecil pada nomor SEP. Klik <strong style={{ color: '#c084fc' }}>Auto-Fix</strong> di bawah untuk mengkapitalisasi seluruh huruf SEP secara otomatis.</span>
                        ) : (
                          <span>Format nomor kartu BPJS tidak standar (mengandung spasi/karakter strip). Klik <strong style={{ color: '#c084fc' }}>Auto-Fix</strong> untuk merapikan menjadi 13 digit angka murni.</span>
                        )}
                      </div>
                    </div>
                  ) : hasAiAudit ? (
                    <div className="ai-fix-box">
                      <div className="ai-fix-header" style={{ color: '#10b981' }}>
                        <span>🤖</span> Catatan AI Auditor
                      </div>
                      <div className="ai-fix-body">
                        {selectedRecord.ai_notes || 'Validasi dokumen medis sesuai kriteria INACBG.'}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSelectedRecordId(null)}>
                    Abaikan
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={isFixing || !records.some(r => r.errors.some(e => ['RV-01', 'RV-02'].includes(e.rule_id)))}
                    onClick={handleAutoFix}
                    style={{
                      flex: 2,
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                      border: 'none'
                    }}
                  >
                    ✨ Auto-Fix
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
