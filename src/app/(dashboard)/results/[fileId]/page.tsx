'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { api } from '@/lib/api';
import { io } from 'socket.io-client';
import DetailedValidationResults from '@/components/DetailedValidationResults';
import VerificationForm from '@/components/VerificationForm';
import OcrViewer from '@/components/OcrViewer';
import AuditSuggestions from '@/components/AuditSuggestions';
import SimrsIngestionModal from '@/components/SimrsIngestionModal';
import { ToastContainer, useToast } from '@/components/Toast';

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

// ─── Animation Variants ────────────────────────────────────────────────────────

const pageVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const statCardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
};

const panelSlideVariants = {
  hidden: { opacity: 0, x: 60, scale: 0.97 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: {
    opacity: 0,
    x: 60,
    scale: 0.97,
    transition: { duration: 0.3, ease: 'easeIn' as const },
  },
};

const errorCardVariants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
};

const comparisonVariants = {
  hidden: { opacity: 0, height: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    height: 'auto',
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: {
    opacity: 0,
    height: 0,
    scale: 0.98,
    transition: { duration: 0.3, ease: 'easeIn' as const },
  },
};

const buttonHover = { scale: 1.03 };
const buttonTap = { scale: 0.97 };

// ─── Animated Counter Component ────────────────────────────────────────────────

function AnimatedCounter({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString('id-ID'));
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    const controls = animate(count, value, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
      onUpdate: (v) => setDisplay(Math.round(v).toLocaleString('id-ID')),
    });
    return () => controls.stop();
  }, [value, duration, count]);

  return <>{display}</>;
}

// ─── Animated Token Counter ────────────────────────────────────────────────────

function AnimatedTokenDisplay({ value }: { value: number }) {
  const [display, setDisplay] = useState('0');
  const count = useMotionValue(0);

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 1.5,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
      onUpdate: (v) => setDisplay(Math.round(v).toLocaleString('id-ID')),
    });
    return () => controls.stop();
  }, [value, count]);

  return <>{display} tok</>;
}

// ─── AI Field Audit Panel (Phase 1) ───────────────────────────────────────────

interface FieldAudit {
  audit_id?: string;
  field: string;
  status?: 'failed' | 'passed';
  error_description?: string;
  suggestion?: string | null;
  confidence_score?: number;
  style?: string;
  tokens_used?: { input: number; output: number; total: number };
  error?: string;
}

function AiFieldAuditPanel({ recordId }: { recordId: string }) {
  const [audits, setAudits] = useState<FieldAudit[]>([]);
  const [running, setRunning] = useState(false);
  const [style, setStyle] = useState('ponytail');
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  // reset saat ganti record
  useEffect(() => { setAudits([]); setFeedback({}); }, [recordId]);

  const run = async () => {
    setRunning(true);
    try {
      const res = await api.auditRecordFields(recordId, [], style);
      setAudits(res.audits || []);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'AI audit gagal');
    } finally {
      setRunning(false);
    }
  };

  const giveFeedback = async (auditId: string, action: 'accepted' | 'rejected' | 'unsure') => {
    try {
      await api.sendAuditFeedback(auditId, action);
      setFeedback(prev => ({ ...prev, [auditId]: action }));
    } catch { alert('Gagal menyimpan feedback'); }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <motion.button
          className="btn btn-primary"
          onClick={run}
          disabled={running}
          style={{ flex: 1, justifyContent: 'center', fontSize: 12, background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
          whileHover={!running ? buttonHover : {}}
          whileTap={!running ? buttonTap : {}}
        >
          🪄 {running ? 'Mengaudit...' : 'Jalankan AI Audit'}
        </motion.button>
        <select className="filter-select" value={style} onChange={e => setStyle(e.target.value)} style={{ fontSize: 11 }}>
          <option value="ponytail">Gaya: Ringkas</option>
          <option value="caveman">Gaya: Ultra-singkat</option>
          <option value="neutral">Gaya: Formal</option>
        </select>
      </div>

      {audits.map((a, idx) => (
        <motion.div
          key={a.audit_id || idx}
          className="ai-fix-box"
          style={{ marginTop: 10 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
        >
          <div className="ai-fix-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>💡 {a.field.toUpperCase()}</span>
            {a.confidence_score !== undefined && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Keyakinan {(a.confidence_score * 100).toFixed(0)}% · {a.tokens_used?.total ?? 0} tok
              </span>
            )}
          </div>
          <div className="ai-fix-body">
            {a.error ? (
              <span style={{ color: '#ef4444' }}>Gagal: {a.error}</span>
            ) : a.status === 'passed' ? (
              <span style={{ color: '#10b981' }}>✓ AI menilai field ini valid. {a.error_description}</span>
            ) : (
              <>
                {a.error_description && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
                    <strong>Masalah:</strong> {a.error_description}
                  </div>
                )}
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  <strong>Saran:</strong> {a.suggestion}
                </div>
              </>
            )}
          </div>
          {a.audit_id && !a.error && (
            feedback[a.audit_id] ? (
              <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)' }}>
                Feedback tersimpan: <strong>{feedback[a.audit_id]}</strong>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button className="btn btn-success" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => giveFeedback(a.audit_id!, 'accepted')}>✓ Accept</button>
                <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => giveFeedback(a.audit_id!, 'rejected')}>✗ Reject</button>
                <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => giveFeedback(a.audit_id!, 'unsure')}>? Unsure</button>
              </div>
            )
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Loading Spinner ───────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="loading">
      <motion.div
        className="spinner"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' as const }}
      />
    </div>
  );
}

// ─── Results Summary Section (NEW) ────────────────────────────────────────────

function ResultsSummary({ fileInfo }: { fileInfo: FileInfo }) {
  const getStatusColor = () => {
    if (fileInfo.error_count === 0) return '#10b981';
    if (fileInfo.error_count > fileInfo.total_records * 0.5) return '#dc2626';
    return '#f59e0b';
  };

  const getStatusLabel = () => {
    if (fileInfo.error_count === 0) return 'VALID';
    if (fileInfo.error_count > fileInfo.total_records * 0.5) return 'ERROR';
    return 'PENDING';
  };

  const getStatusIcon = () => {
    if (fileInfo.error_count === 0) return '✅';
    if (fileInfo.error_count > fileInfo.total_records * 0.5) return '❌';
    return '⚠️';
  };

  const criticalCount = fileInfo.error_summary?.filter(e => e.severity === 'critical').reduce((sum, e) => sum + e.count, 0) || 0;
  const majorCount = fileInfo.error_summary?.filter(e => e.severity === 'major').reduce((sum, e) => sum + e.count, 0) || 0;
  const minorCount = fileInfo.error_summary?.filter(e => e.severity === 'minor').reduce((sum, e) => sum + e.count, 0) || 0;

  return (
    <motion.div
      className="card"
      style={{ padding: 24, marginBottom: 24, background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-low) 100%)' }}
      variants={statCardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(0,0,0,0.1)' }}
    >
      {/* Status Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>Ringkasan Validasi</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.div
              style={{
                fontSize: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {getStatusIcon()}
            </motion.div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: getStatusColor() }}>
                {getStatusLabel()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Status validasi file {fileInfo.file_name}
              </div>
            </div>
          </div>
        </div>

        {/* Severity breakdown */}
        <div style={{ display: 'flex', gap: 20 }}>
          {criticalCount > 0 && (
            <motion.div
              style={{
                textAlign: 'center',
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(220, 38, 38, 0.1)',
              }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0 }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{criticalCount}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Critical</div>
            </motion.div>
          )}
          {majorCount > 0 && (
            <motion.div
              style={{
                textAlign: 'center',
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(234, 88, 12, 0.1)',
              }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: '#ea580c' }}>{majorCount}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Major</div>
            </motion.div>
          )}
          {minorCount > 0 && (
            <motion.div
              style={{
                textAlign: 'center',
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(202, 138, 4, 0.1)',
              }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: '#ca8a04' }}>{minorCount}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Minor</div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Error Summary Rules */}
      {fileInfo.error_summary && fileInfo.error_summary.length > 0 && (
        <motion.div
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: 16,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>
            Daftar Error Rules
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {fileInfo.error_summary.map((rule, idx) => (
              <motion.div
                key={idx}
                style={{
                  padding: 10,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
                whileHover={{ scale: 1.02, borderColor: 'var(--primary)' }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                  {rule.rule_id}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {rule.rule_name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span className={`badge badge-${rule.severity}`} style={{ fontSize: 9 }}>
                    {(rule.severity || 'unknown').toUpperCase()}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-blue)' }}>
                    {rule.count}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.fileId as string;
  const { toasts, addToast, removeToast } = useToast();
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
  const [searchFocused, setSearchFocused] = useState(false);
  const [showDetailedValidation, setShowDetailedValidation] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'verification' | 'evidence' | 'audit'>('summary');
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [ocrPages, setOcrPages] = useState<any[]>([]);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [batchAuditStyle, setBatchAuditStyle] = useState<'ponytail' | 'caveman' | 'neutral'>('ponytail');
  const [isBatchAuditing, setIsBatchAuditing] = useState(false);
  const [showSimrsModal, setShowSimrsModal] = useState(false);
  const [batchAuditProgress, setBatchAuditProgress] = useState(0);
  const [batchAuditCurrent, setBatchAuditCurrent] = useState(0);
  const [batchAuditTotal, setBatchAuditTotal] = useState(0);

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
    } catch (err) { console.error('[Results] Gagal memuat records:', err); }
  }, [fileId, page, filter, search, errorType]);

  const loadFileInfo = useCallback(async () => {
    try {
      const f = await api.getFile(fileId);
      setFileInfo(f);
    } catch (err) { console.error('[Results] Gagal memuat info file:', err); }
  }, [fileId]);

  const loadComparison = useCallback(async () => {
    try {
      const c = await api.getComparison(fileId);
      setComparison(c);
    } catch (err) { console.error('[Results] Gagal memuat perbandingan:', err); }
  }, [fileId]);

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) newSet.delete(recordId);
      else newSet.add(recordId);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRecords.size === records.length) setSelectedRecords(new Set());
    else setSelectedRecords(new Set(records.map(r => r.id)));
  };

  const handleBatchAudit = async () => {
    if (selectedRecords.size === 0) {
      addToast('Pilih minimal 1 rekam untuk di-audit', 'error');
      return;
    }
    if (!confirm(`Audit ${selectedRecords.size} rekam dengan style "${batchAuditStyle}"?`)) return;

    setIsBatchAuditing(true);
    setBatchAuditProgress(0);
    setBatchAuditCurrent(0);
    setBatchAuditTotal(selectedRecords.size);
    addToast(`Memulai audit ${selectedRecords.size} rekam...`, 'info');

    try {
      await api.batchAuditRecords(Array.from(selectedRecords), batchAuditStyle);
      setSelectedRecords(new Set());
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Batch audit gagal', 'error');
    } finally {
      setIsBatchAuditing(false);
    }
  };

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

  const handleSaveRecordValues = async (updates: Record<string, any>) => {
    if (!selectedRecordId) return;
    setIsSavingRecord(true);
    try {
      await api.updateRecordValues(selectedRecordId, updates);
      addToast('✅ Perubahan berhasil disimpan!', 'success');
      await loadRecords();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan perubahan', 'error');
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleLoadOcrPages = async () => {
    if (!selectedRecordId) return [];
    setLoadingOcr(true);
    try {
      const pages = await api.getOcrPages(selectedRecordId);
      setOcrPages(pages?.pages || []);
      return pages?.pages || [];
    } catch (err: unknown) {
      console.error('Gagal memuat OCR pages:', err);
      return [];
    } finally {
      setLoadingOcr(false);
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

    // Existing AI audit listeners
    socket.on('ai-audit:status', (data) => {
      if (data.fileId === fileId) {
        setAuditProgress(data.progress);
        setIsAuditing(true);
      }
    });

    socket.on('ai-audit:complete', (data) => {
      if (data.fileId === fileId) {
        setIsAuditing(false);
        addToast('✨ AI Audit selesai!', 'success');
        loadRecords();
      }
    });

    // Batch audit progress listeners
    socket.on('batch-audit:progress', (data) => {
      if (data.fileId === fileId) {
        setBatchAuditCurrent(data.current);
        setBatchAuditTotal(data.total);
        const pct = Math.round((data.current / data.total) * 100);
        setBatchAuditProgress(pct);
      }
    });

    socket.on('batch-audit:complete', (data) => {
      if (data.fileId === fileId) {
        setBatchAuditProgress(100);
        setIsBatchAuditing(false);
        addToast(`🎉 Batch Audit selesai! ${data.audited} rekam diaudit`, 'success');
        setTimeout(() => loadRecords(), 500);
      }
    });

    socket.on('batch-audit:error', (data) => {
      if (data.fileId === fileId) {
        setIsBatchAuditing(false);
        addToast(`❌ Batch audit error: ${data.message}`, 'error');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [fileId, loadRecords, addToast]);

  if (loading) return <LoadingSpinner />;
  if (!fileInfo) return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <h3>File tidak ditemukan</h3>
    </motion.div>
  );

  const totalPages = Math.ceil(total / 30);
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
  const canApprove = ['supervisor', 'admin'].includes(user.role) && fileInfo.status === 'completed';
  const validPct = fileInfo.total_records > 0 ? ((fileInfo.valid_count / fileInfo.total_records) * 100).toFixed(1) : '0';

  const formatCurrency = (val: number) => {
    if (!val) return '-';
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const selectedRecord = selectedRecordId ? records.find(r => r.id === selectedRecordId) : null;
  const hasErrors = selectedRecord ? selectedRecord.errors && selectedRecord.errors.length > 0 : false;
  const hasAiAudit = selectedRecord ? selectedRecord.ai_status && selectedRecord.ai_status !== 'pending' : false;

  return (
    <motion.div
      className="fade-in results-page-container"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ─── Page Header ──────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 20, alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Hasil Validasi</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            ID Batch: #VAL-{fileInfo.period?.replace('-', '') || '20231027'}-{fileInfo.id.substring(0, 3).toUpperCase()}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          {/* Import SIMRS */}
          <motion.button
            className="btn-glass"
            onClick={() => setShowSimrsModal(true)}
            whileHover={buttonHover}
            whileTap={buttonTap}
            style={{ fontSize: 12, padding: '8px 12px' }}
          >
            ⬆️ Import SIMRS
          </motion.button>

          {/* Progress Indicator */}
          <div className="header-progress-container">
            {isBatchAuditing ? (
              <>
                <span className="header-progress-label">
                  Batch Audit: {batchAuditCurrent}/{batchAuditTotal}
                </span>
                <div className="header-progress-track">
                  <motion.div
                    className="header-progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${batchAuditProgress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' as const }}
                  />
                </div>
                <span className="header-progress-percent">{batchAuditProgress}%</span>
              </>
            ) : isAuditing ? (
              <>
                <span className="header-progress-label">Progres AI Audit</span>
                <div className="header-progress-track">
                  <motion.div
                    className="header-progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${auditProgress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' as const }}
                  />
                </div>
                <span className="header-progress-percent">{auditProgress}%</span>
              </>
            ) : (
              <>
                <span className="header-progress-label">Tingkat Valid</span>
                <div className="header-progress-track">
                  <motion.div
                    className="header-progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${validPct}%` }}
                    transition={{ duration: 1, ease: 'easeOut' as const, delay: 0.3 }}
                  />
                </div>
                <span className="header-progress-percent">{validPct}%</span>
              </>
            )}
          </div>

          {/* Bell Icon Notification */}
          <motion.button
            className={`bell-btn ${fileInfo.error_count > 0 ? 'has-notifications' : ''}`}
            title="Notifikasi"
            whileHover={buttonHover}
            whileTap={buttonTap}
          >
            🔔
          </motion.button>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {comparison && comparison.total_changes > 0 && (
              <motion.button
                className="btn-glass"
                onClick={() => setShowComparison(!showComparison)}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                📄 {showComparison ? 'Sembunyikan' : 'Bandingkan File'}
              </motion.button>
            )}
            {canApprove && (
              <motion.button
                className="btn btn-success"
                onClick={handleApprove}
                style={{ padding: '8px 16px', fontSize: 12 }}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                ✅ Setujui
              </motion.button>
            )}
            <motion.button
              className="btn btn-primary"
              onClick={handleAiAudit}
              disabled={isAuditing}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                padding: '8px 16px',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              whileHover={!isAuditing ? buttonHover : {}}
              whileTap={!isAuditing ? buttonTap : {}}
            >
              <span>🪄</span> {isAuditing ? `Auditing ${auditProgress}%` : 'Jalankan AI Audit'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ─── RESULTS SUMMARY SECTION (NEW) ────────────────────────────── */}
      <ResultsSummary fileInfo={fileInfo} />

      {/* ─── Stat Cards ───────────────────────────────────────────────── */}
      <motion.div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="card"
          style={{ padding: 16, borderLeft: '4px solid var(--accent-blue)', display: 'flex', flexDirection: 'column', gap: 4 }}
          variants={statCardVariants}
          whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📄</span> Total Data
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>
            <AnimatedCounter value={fileInfo.total_records} />
          </div>
        </motion.div>

        <motion.div
          className="card"
          style={{ padding: 16, borderLeft: '4px solid var(--accent-green)', display: 'flex', flexDirection: 'column', gap: 4 }}
          variants={statCardVariants}
          whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>✅</span> Data Valid
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-green)' }}>
            <AnimatedCounter value={fileInfo.valid_count} />
          </div>
        </motion.div>

        <motion.div
          className="card"
          style={{ padding: 16, borderLeft: '4px solid var(--accent-red)', display: 'flex', flexDirection: 'column', gap: 4 }}
          variants={statCardVariants}
          whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>❌</span> Data Error
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-red)' }}>
            <AnimatedCounter value={fileInfo.error_count} />
          </div>
        </motion.div>

        <motion.div
          className="card"
          style={{ padding: 16, borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: 4 }}
          variants={statCardVariants}
          whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⏳</span> Data Pending
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>
            <AnimatedCounter value={fileInfo.pending_count} />
          </div>
        </motion.div>

        <motion.div
          className="card"
          style={{ padding: 16, borderLeft: '4px solid var(--accent-purple)', display: 'flex', flexDirection: 'column', gap: 4 }}
          variants={statCardVariants}
          whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
          transition={{ duration: 0.2 }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🤖</span> Pemakaian Token AI
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#a78bfa' }}>
            {fileInfo.ai_total_tokens ? (
              <AnimatedTokenDisplay value={fileInfo.ai_total_tokens} />
            ) : '-'}
          </div>
          {fileInfo.ai_total_tokens ? (
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {fileInfo.ai_prompt_tokens?.toLocaleString('id-ID')} prompt + {fileInfo.ai_completion_tokens?.toLocaleString('id-ID')} completion
            </div>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>AI belum digunakan</div>
          )}
        </motion.div>
      </motion.div>

      {/* ─── View Mode Tabs ───────────────────────────────────────────────────── */}
      <motion.div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          padding: 8,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          width: 'fit-content',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {['summary', 'detailed', 'verification', 'evidence', 'audit'].map(mode => (
          <motion.button
            key={mode}
            onClick={() => setViewMode(mode as any)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === mode ? 'var(--primary)' : 'transparent',
              color: viewMode === mode ? 'white' : 'var(--text-primary)',
              transition: 'all 0.2s',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {mode === 'summary' && '📊 Ringkasan Error'}
            {mode === 'detailed' && '📋 Validasi 60 Kolom'}
            {mode === 'verification' && '📝 Verifikasi & Edit'}
            {mode === 'evidence' && '📄 Bukti Pendukung'}
            {mode === 'audit' && '🔍 Audit'}
          </motion.button>
        ))}
      </motion.div>

      {/* ─── View Mode: Summary ────────────────────────────────────────── */}
      {viewMode === 'summary' && (
        <>

      {/* ─── Toolbar ──────────────────────────────────────────────────── */}
      <div className="results-toolbar">
        <motion.div
          className="search-container"
          animate={{
            boxShadow: searchFocused
              ? '0 0 0 3px rgba(59, 130, 246, 0.15)'
              : '0 0 0 0px rgba(59, 130, 246, 0)',
          }}
          transition={{ duration: 0.2 }}
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Cari Nama, SEP, atau No. Kartu..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </motion.div>

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

        {/* Selection Counter & Batch Audit */}
        <AnimatePresence>
          {selectedRecords.size > 0 && (
            <motion.div
              className="filter-group"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}
            >
              <motion.div
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent-blue)',
                }}
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
              >
                📊 {selectedRecords.size} Rekam Dipilih
              </motion.div>

              <select
                value={batchAuditStyle}
                onChange={e => setBatchAuditStyle(e.target.value as any)}
                className="filter-select"
                style={{ fontSize: 11 }}
              >
                <option value="ponytail">Ponytail (Efisien)</option>
                <option value="caveman">Caveman (Terse)</option>
                <option value="neutral">Neutral (Standar)</option>
              </select>

              <motion.button
                onClick={handleBatchAudit}
                disabled={isBatchAuditing}
                className="btn-glass"
                style={{
                  background: isBatchAuditing ? 'var(--text-muted)' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  color: 'white',
                  border: 'none',
                  fontSize: 11,
                  padding: '6px 12px',
                  cursor: isBatchAuditing ? 'not-allowed' : 'pointer',
                }}
                whileHover={!isBatchAuditing ? { scale: 1.03 } : {}}
                whileTap={!isBatchAuditing ? { scale: 0.97 } : {}}
              >
                {isBatchAuditing ? '⏳ Auditing...' : '🪄 Audit Selected'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Comparison Table (Animated Expand/Collapse) ──────────────── */}
      <AnimatePresence>
        {showComparison && comparison && comparison.changes.length > 0 && (
          <motion.div
            className="card fade-in"
            style={{
              marginBottom: 20,
              border: '1px solid rgba(16, 185, 129, 0.3)',
              background: 'rgba(16, 185, 129, 0.02)',
              overflow: 'hidden',
            }}
            variants={comparisonVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                ✨ Perbandingan Perubahan Hasil Auto-Fix (Melihat Perbedaan File Asli vs Hasil Perbaikan)
              </h3>
              <motion.button
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => setShowComparison(false)}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                ✕ Close
              </motion.button>
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
                    <motion.tr
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.03 }}
                    >
                      <td><strong>{chg.row_number}</strong></td>
                      <td>{chg.nama_pasien}</td>
                      <td><span className="badge badge-secondary">{chg.mrn || '-'}</span></td>
                      <td><span className="badge badge-info">{chg.field_name}</span></td>
                      <td style={{ color: '#ef4444', textDecoration: 'line-through', fontFamily: 'monospace', fontSize: 11 }}>{chg.before}</td>
                      <td style={{ color: '#10b981', fontWeight: 700, fontFamily: 'monospace', fontSize: 11 }}>
                        {chg.after} <span style={{ fontSize: 9, fontStyle: 'italic', fontWeight: 'normal' }}>✓ OK</span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Split Layout ─────────────────────────────────────────────── */}
      <div className="split-layout">
        {/* ─── Left Panel: Records Table ──────────────────────────────── */}
        <div className="panel-left">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Data Validasi</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button
                  className="btn-glass"
                  disabled={isFixing || !records.some(r => r.errors.some(e => ['RV-01', 'RV-02'].includes(e.rule_id)))}
                  onClick={handleAutoFix}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
                  }}
                >
                  ✨ Auto-Fix Typo
                </motion.button>
                <motion.button
                  className="btn-glass"
                  onClick={handleExport}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                >
                  📥 Export Excel
                </motion.button>
                <motion.button
                  className="btn-glass"
                  onClick={handleDownloadFixed}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                >
                  💾 Download TXT for vClaim
                </motion.button>
              </div>
            </div>

            <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedRecords.size === records.length && records.length > 0}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th>Nama Pasien</th>
                    <th>No. SEP</th>
                    <th>Diagnosis (ICD-10)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {records.length === 0 ? (
                      <motion.tr
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                          Tidak ada data ditemukan
                        </td>
                      </motion.tr>
                    ) : (
                      records.map((rec, idx) => {
                        const isSelected = selectedRecordId === rec.id;
                        const isChecked = selectedRecords.has(rec.id);
                        return (
                          <motion.tr
                            key={rec.id}
                            className={isSelected ? 'selected-row' : ''}
                            style={{ cursor: 'pointer' }}
                            variants={tableRowVariants}
                            initial="hidden"
                            animate="visible"
                            exit={{ opacity: 0, x: -12, transition: { duration: 0.2 } }}
                            transition={{ delay: idx * 0.03 }}
                            whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.04)' }}
                          >
                            <td style={{ textAlign: 'center' }} onClick={e => { e.stopPropagation(); toggleRecordSelection(rec.id); }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleRecordSelection(rec.id)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td onClick={() => setSelectedRecordId(rec.id)}>
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
                          </motion.tr>
                        );
                      })
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Pagination ─────────────────────────────────────────────── */}
          <AnimatePresence>
            {totalPages > 1 && (
              <motion.div
                className="pagination"
                style={{ marginTop: 0 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
              >
                <motion.button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  whileHover={!page || page <= 1 ? {} : buttonHover}
                  whileTap={page <= 1 ? {} : buttonTap}
                >
                  ← Sebelumnya
                </motion.button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) pageNum = i + 1;
                  else if (page <= 4) pageNum = i + 1;
                  else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                  else pageNum = page - 3 + i;
                  return (
                    <motion.button
                      key={pageNum}
                      className={page === pageNum ? 'active' : ''}
                      onClick={() => setPage(pageNum)}
                      whileHover={buttonHover}
                      whileTap={buttonTap}
                      animate={page === pageNum ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.2 }}
                    >
                      {pageNum}
                    </motion.button>
                  );
                })}
                <motion.button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  whileHover={page >= totalPages ? {} : buttonHover}
                  whileTap={page >= totalPages ? {} : buttonTap}
                >
                  Selanjutnya →
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Right Panel: Error Detail ──────────────────────────────── */}
        <div className={`panel-right ${!selectedRecordId ? 'collapsed' : ''}`}>
          <AnimatePresence mode="wait">
            {selectedRecordId && selectedRecord && (
              <motion.div
                key={selectedRecordId}
                className="error-details-panel"
                variants={panelSlideVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="error-details-header">
                  <div>
                    <h3>Detail Error</h3>
                    <div className="sep-sub">SEP: {selectedRecord.sep}</div>
                  </div>
                  <motion.button
                    className="error-details-close"
                    onClick={() => setSelectedRecordId(null)}
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    ✕
                  </motion.button>
                </div>

                <div className="error-details-body">
                  <motion.div
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 12 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Nama Pasien:</span>
                      <span style={{ fontWeight: 600 }}>{selectedRecord.nama_pasien}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>No. Kartu:</span>
                      <span style={{ fontWeight: 600 }}>{selectedRecord.nokartu}</span>
                    </div>
                  </motion.div>

                  {hasErrors ? (
                    <motion.div
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                      style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
                    >
                      {selectedRecord.errors.map((err, idx) => (
                        <motion.div
                          key={idx}
                          className={`error-card-item ${err.severity || 'major'}`}
                          variants={errorCardVariants}
                          transition={{ delay: idx * 0.08 }}
                          whileHover={{ x: 2 }}
                        >
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
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.15, duration: 0.3 }}
                    >
                      <motion.span
                        style={{ fontSize: 24, display: 'block', marginBottom: 8 }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.25, type: 'spring', stiffness: 200 }}
                      >
                        ✅
                      </motion.span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)' }}>Rekam Valid</span>
                      <p style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>Tidak ditemukan masalah untuk data ini.</p>
                    </motion.div>
                  )}

                  {selectedRecord.ai_suggestions || (hasErrors && selectedRecord.errors[0]?.rule_id === 'RV-01') || (hasErrors && selectedRecord.errors[0]?.rule_id === 'RV-02') ? (
                    <motion.div
                      className="ai-fix-box"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.35 }}
                    >
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
                    </motion.div>
                  ) : hasAiAudit ? (
                    <motion.div
                      className="ai-fix-box"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.35 }}
                    >
                      <div className="ai-fix-header" style={{ color: '#10b981' }}>
                        <span>🤖</span> Catatan AI Auditor
                      </div>
                      <div className="ai-fix-body">
                        {selectedRecord.ai_notes || 'Validasi dokumen medis sesuai kriteria INACBG.'}
                      </div>
                    </motion.div>
                  ) : null}

                  {/* AI audit per-field — hanya untuk record yang gagal rules (hemat token) */}
                  {hasErrors && <AiFieldAuditPanel recordId={selectedRecord.id} />}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                  <motion.button
                    className="btn btn-secondary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setSelectedRecordId(null)}
                    whileHover={buttonHover}
                    whileTap={buttonTap}
                  >
                    Abaikan
                  </motion.button>
                  <motion.button
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setShowDetailedValidation(!showDetailedValidation)}
                    whileHover={buttonHover}
                    whileTap={buttonTap}
                  >
                    📋 {showDetailedValidation ? 'Sembunyikan' : 'Lihat'} Detil
                  </motion.button>
                </div>

                {/* Detailed Validation Results */}
                {showDetailedValidation && (
                  <motion.div
                    style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <DetailedValidationResults
                      recordId={selectedRecord.id}
                      recordData={selectedRecord}
                      validationErrors={selectedRecord.errors || []}
                    />
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
        </>
      )}

      {/* ─── View Mode: Detailed Validation ────────────────────────── */}
      {viewMode === 'detailed' && selectedRecordId && selectedRecord && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ padding: 24 }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {selectedRecord.nama_pasien} (SEP: {selectedRecord.sep})
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              MRN: {selectedRecord.mrn} | Status: <span style={{
                background: `${selectedRecord.validation_status === 'valid' ? '#10b981' : selectedRecord.validation_status === 'error' ? '#dc2626' : '#f59e0b'}15`,
                color: `${selectedRecord.validation_status === 'valid' ? '#10b981' : selectedRecord.validation_status === 'error' ? '#dc2626' : '#f59e0b'}`,
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 11,
              }}>
                {selectedRecord.validation_status.toUpperCase()}
              </span>
            </div>
          </div>

          <DetailedValidationResults
            recordId={selectedRecord.id}
            recordData={selectedRecord}
            validationErrors={selectedRecord.errors || []}
          />

          <motion.div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: 12,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.button
              className="btn btn-secondary"
              onClick={() => setViewMode('summary')}
              whileHover={buttonHover}
              whileTap={buttonTap}
            >
              ← Kembali ke Ringkasan
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {viewMode === 'detailed' && !selectedRecordId && (
        <motion.div
          className="card"
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Pilih data dari tabel kiri
          </div>
          <div style={{ fontSize: 12 }}>
            Klik salah satu baris untuk melihat validasi lengkap 60 kolom vClaim
          </div>
        </motion.div>
      )}

      {/* ─── View Mode: Verification & Edit ────────────────────────────── */}
      {viewMode === 'verification' && selectedRecordId && selectedRecord && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ padding: 24 }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {selectedRecord.nama_pasien} (SEP: {selectedRecord.sep})
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              MRN: {selectedRecord.mrn} | Status: <span style={{
                background: `${selectedRecord.validation_status === 'valid' ? '#10b981' : selectedRecord.validation_status === 'error' ? '#dc2626' : '#f59e0b'}15`,
                color: `${selectedRecord.validation_status === 'valid' ? '#10b981' : selectedRecord.validation_status === 'error' ? '#dc2626' : '#f59e0b'}`,
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 11,
              }}>
                {selectedRecord.validation_status.toUpperCase()}
              </span>
            </div>
          </div>

          <VerificationForm
            recordId={selectedRecord.id}
            recordData={selectedRecord}
            validationErrors={selectedRecord.errors || []}
            onSave={handleSaveRecordValues}
            isSaving={isSavingRecord}
          />

          <motion.div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: 12,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.button
              className="btn btn-secondary"
              onClick={() => setViewMode('summary')}
              whileHover={buttonHover}
              whileTap={buttonTap}
            >
              ← Kembali ke Ringkasan
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {viewMode === 'verification' && !selectedRecordId && (
        <motion.div
          className="card"
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Pilih data dari tabel kiri
          </div>
          <div style={{ fontSize: 12 }}>
            Klik salah satu baris untuk verifikasi dan edit data klaim
          </div>
        </motion.div>
      )}

      {/* ─── View Mode: Evidence (OCR) ────────────────────────────────── */}
      {viewMode === 'evidence' && selectedRecordId && selectedRecord && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ padding: 24 }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {selectedRecord.nama_pasien} (SEP: {selectedRecord.sep})
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              MRN: {selectedRecord.mrn} | Lihat bukti dokumen scan untuk verifikasi diagnosis dan prosedur
            </div>
          </div>

          <OcrViewer
            recordId={selectedRecord.id}
            pages={ocrPages}
            isLoading={loadingOcr}
            onLoadPages={handleLoadOcrPages}
          />

          <motion.div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: 12,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.button
              className="btn btn-secondary"
              onClick={() => setViewMode('summary')}
              whileHover={buttonHover}
              whileTap={buttonTap}
            >
              ← Kembali ke Ringkasan
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {viewMode === 'evidence' && !selectedRecordId && (
        <motion.div
          className="card"
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Pilih data dari tabel kiri
          </div>
          <div style={{ fontSize: 12 }}>
            Klik salah satu baris untuk melihat bukti dokumen scan
          </div>
        </motion.div>
      )}

      {/* ─── View Mode: Audit Logic ────────────────────────────────────── */}
      {viewMode === 'audit' && selectedRecordId && selectedRecord && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ padding: 24 }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {selectedRecord.nama_pasien} (SEP: {selectedRecord.sep})
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              MRN: {selectedRecord.mrn} | Audit kode diagnosis dan prosedur dengan bukti dari dokumen scan
            </div>
          </div>

          <AuditSuggestions recordId={selectedRecord.id} />

          <motion.div
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: 12,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <motion.button
              className="btn btn-secondary"
              onClick={() => setViewMode('summary')}
              whileHover={buttonHover}
              whileTap={buttonTap}
            >
              ← Kembali ke Ringkasan
            </motion.button>
            <motion.button
              className="btn btn-primary"
              onClick={() => setViewMode('evidence')}
              whileHover={buttonHover}
              whileTap={buttonTap}
              style={{ marginLeft: 'auto' }}
            >
              📄 Lihat Bukti Pendukung →
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {viewMode === 'audit' && !selectedRecordId && (
        <motion.div
          className="card"
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Pilih data dari tabel kiri
          </div>
          <div style={{ fontSize: 12 }}>
            Klik salah satu baris untuk audit kode diagnosis dan prosedur dengan bukti dokumen
          </div>
        </motion.div>
      )}

      {/* SIMRS Ingestion Modal */}
      <SimrsIngestionModal
        isOpen={showSimrsModal}
        onClose={() => setShowSimrsModal(false)}
        onSuccess={() => {
          loadFileInfo();
          loadRecords();
          addToast('✅ Data SIMRS berhasil diimport!', 'success');
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </motion.div>
  );
}
