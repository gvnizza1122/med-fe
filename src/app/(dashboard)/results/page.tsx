'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface ValidationError {
  rule_id: string;
  field_name: string;
  severity: string;
  error_message: string;
  expected?: string;
  actual?: string;
}

interface FileRecord {
  id: string;
  file_name: string;
  status: string;
  error_count: number;
  valid_count: number;
  pending_count: number;
  validated_at: string;
  error_summary?: Array<{ rule_id: string; rule_name: string; severity: string; count: number }>;
}

function ResultsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileId = searchParams.get('id');

  const [file, setFile] = useState<FileRecord | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [aiAudit, setAiAudit] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!fileId) {
      setError('File ID tidak ditemukan');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await api.getFile(fileId);
        setFile(res);

        if (res.error_count > 0) {
          const records = await api.getRecords(fileId);
          const allErrors: ValidationError[] = [];
          if (records.records) {
            records.records.forEach((r: { errors?: ValidationError[] }) => {
              if (r.errors && r.errors.length > 0) {
                allErrors.push(...r.errors);
              }
            });
          }
          setErrors(allErrors);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Gagal load file');
      } finally {
        setLoading(false);
      }
    })();
  }, [fileId]);

  const runAiAudit = async () => {
    setAiLoading(true);
    try {
      await api.runAiAudit(fileId!);
      // Re-fetch file to get updated AI data
      const res = await api.getFile(fileId!);
      setFile(res);
      setAiAudit([{ message: 'AI audit selesai' }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal run AI audit');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
        <p>Loading hasil validasi...</p>
      </div>
    );
  }

  if (!fileId || !file) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: 'var(--red)' }}>File tidak ditemukan</p>
        <button className="btn btn-primary" onClick={() => router.push('/upload-pdf')} style={{ marginTop: 16 }}>
          Kembali ke Upload
        </button>
      </div>
    );
  }

  const statusColor = file.status === 'completed' ? '#16a34a' : file.status === 'error' ? '#dc2626' : '#ca8a04';
  const statusIcon = file.status === 'completed' ? '✅' : file.status === 'error' ? '❌' : '⚠️';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="page-header">
        <div>
          <h2>Hasil Validasi Klaim</h2>
          <p>{file.file_name}</p>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--red-light, #fef2f2)', color: 'var(--red, #dc2626)', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Status Summary */}
      <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>{statusIcon}</div>
          <div>
            <h3 style={{ color: statusColor, margin: 0 }}>
              {file.status === 'completed' ? 'VALID ✨' : file.status === 'error' ? '❌ ERROR' : '⚠️ PENDING'}
            </h3>
            <p style={{ color: 'var(--body-mid)', fontSize: 13, margin: '4px 0 0 0' }}>
              {file.error_count} error | {file.valid_count} valid | {file.pending_count} pending
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24, padding: '16px 0', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{file.error_count}</div>
            <div style={{ fontSize: 12, color: 'var(--body-mid)' }}>Error</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{file.valid_count}</div>
            <div style={{ fontSize: 12, color: 'var(--body-mid)' }}>Valid</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ca8a04' }}>{file.pending_count}</div>
            <div style={{ fontSize: 12, color: 'var(--body-mid)' }}>Pending</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          {file.status === 'error' && (
            <button className="btn btn-warning" onClick={runAiAudit} disabled={aiLoading} style={{ flex: 1 }}>
              {aiLoading ? '🤖 Analyzing...' : '🤖 Run AI Audit'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => router.push('/upload-pdf')} style={{ flex: 1 }}>
            Upload File Baru
          </button>
        </div>
      </motion.div>

      {/* Error Summary */}
      {file.error_summary && file.error_summary.length > 0 && (
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h3 style={{ marginBottom: 16 }}>📋 Ringkasan Error</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {file.error_summary.map((item, idx) => (
              <div key={idx} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, borderLeft: `4px solid ${item.severity === 'critical' ? '#dc2626' : '#ea580c'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: 13 }}>{item.rule_id}: {item.rule_name}</strong>
                    <div style={{ fontSize: 12, color: 'var(--body-mid)' }}>{item.count} occurrence(s)</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: item.severity === 'critical' ? '#dc2626' : '#ea580c', textTransform: 'uppercase' }}>
                    {item.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Detail Errors */}
      {errors.length > 0 && (
        <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <h3 style={{ marginBottom: 16 }}>🔴 Detail Error ({errors.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {errors.slice(0, 10).map((err, idx) => (
              <div key={idx} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, borderLeft: `4px solid ${err.severity === 'critical' ? '#dc2626' : '#ea580c'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong style={{ fontSize: 13 }}>{err.rule_id}</strong>
                  <span style={{ fontSize: 10, fontWeight: 600, color: err.severity === 'critical' ? '#dc2626' : '#ea580c', textTransform: 'uppercase' }}>
                    {err.severity}
                  </span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>{err.error_message}</div>
                {err.actual && (
                  <div style={{ fontSize: 12, color: 'var(--body-mid)' }}>
                    <code>Actual: {err.actual} | Expected: {err.expected}</code>
                  </div>
                )}
              </div>
            ))}
            {errors.length > 10 && <p style={{ color: 'var(--body-mid)', fontSize: 12 }}>... dan {errors.length - 10} error lainnya</p>}
          </div>
        </motion.div>
      )}

      {/* AI Audit Success */}
      {aiAudit && (
        <motion.div className="card" style={{ background: 'var(--green-light, #f0fdf4)', borderLeft: '4px solid #16a34a' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 32 }}>🤖</div>
            <div>
              <h3 style={{ margin: 0, color: '#16a34a' }}>AI Audit Complete</h3>
              <p style={{ margin: '4px 0 0 0', color: 'var(--body-mid)', fontSize: 13 }}>AI analysis sudah dijalankan. Hasil disimpan ke database.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* No Errors */}
      {errors.length === 0 && file.status === 'completed' && (
        <motion.div className="card" style={{ textAlign: 'center', padding: 32, background: 'var(--green-light, #f0fdf4)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✨</div>
          <h3 style={{ color: '#16a34a' }}>Semua Valid!</h3>
          <p style={{ color: 'var(--body-mid)', marginBottom: 24 }}>Data klaim siap untuk dikirim ke vClaim.</p>
          <button className="btn btn-primary" onClick={() => router.push('/upload-pdf')}>
            Upload File Berikutnya
          </button>
        </motion.div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
          ← Dashboard
        </button>
        <button className="btn btn-secondary" onClick={() => router.push('/upload-pdf')}>
          ↻ Upload PDF
        </button>
      </div>
    </motion.div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center' }}><p>Loading...</p></div>}>
      <ResultsPageInner />
    </Suspense>
  );
}
