'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface DashboardData {
  total_files: number;
  total_claims: number;
  valid: number;
  error: number;
  pending: number;
  error_by_type: { rule_id: string; rule_name: string; count: number }[];
  recent_files: {
    id: string;
    file_name: string;
    period: string;
    status: string;
    total_records: number;
    valid_count: number;
    error_count: number;
    created_at: string;
    uploaded_by_name: string;
  }[];
  available_periods: string[];
}

/* ─── Animated Counter ──────────────────────────────────────────── */
function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf: number;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display.toLocaleString('id-ID')}</>;
}

/* ─── SVG Empty State Illustrations ─────────────────────────────── */
function EmptyErrorState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ margin: '0 auto 16px' }}>
        <rect x="10" y="16" width="60" height="48" rx="8" fill="var(--surface-2, #f1f5f9)" stroke="var(--border, #e2e8f0)" strokeWidth="1.5" />
        <path d="M30 36h20M30 44h14" stroke="var(--body-mid, #94a3b8)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="56" cy="56" r="14" fill="var(--surface, #f8fafc)" stroke="var(--green, #22c55e)" strokeWidth="2" />
        <path d="M50 56l4 4 8-8" stroke="var(--green, #22c55e)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p style={{ color: 'var(--mute)', fontSize: 13, fontWeight: 500 }}>Belum ada data error</p>
      <p style={{ color: 'var(--mute)', fontSize: 11, marginTop: 4, opacity: 0.7 }}>Semua klaim terproses dengan baik</p>
    </div>
  );
}

function EmptyUploadState() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ margin: '0 auto 16px' }}>
        <rect x="12" y="20" width="56" height="44" rx="8" fill="var(--surface-2, #f1f5f9)" stroke="var(--border, #e2e8f0)" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d="M40 34v16M32 42l8-8 8 8" stroke="var(--primary, #6366f1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="40" cy="14" r="4" fill="var(--primary, #6366f1)" opacity="0.2" />
      </svg>
      <p style={{ color: 'var(--mute)', fontSize: 13, fontWeight: 500 }}>Belum ada file yang diupload</p>
      <p style={{ color: 'var(--mute)', fontSize: 11, marginTop: 4, opacity: 0.7 }}>Upload file pertama Anda untuk memulai</p>
    </div>
  );
}

/* ─── Animation Variants ────────────────────────────────────────── */
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
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const statCardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const splitLayoutVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.5 } },
};

const columnVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const ruleStaggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const ruleItemVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const tableRowVariants = (index: number) => ({
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: index * 0.05, ease: 'easeOut' as const },
  },
});

/* ─── Loading Skeleton ──────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <motion.div
      className="fade-in dashboard-page-container"
      style={{ padding: 0 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="skeleton" style={{ width: 200, height: 28, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 300, height: 14, borderRadius: 6, marginTop: 8 }} />
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            className="dashboard-stat-card"
            style={{ padding: '16px 20px' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 60, height: 28, borderRadius: 6 }} />
          </motion.div>
        ))}
      </div>
      <div className="dashboard-split-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[1, 2].map(i => (
          <motion.div
            key={i}
            className="dashboard-table-card"
            style={{ padding: 20, height: 300 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
          >
            <div className="skeleton" style={{ width: '60%', height: 20, borderRadius: 6, marginBottom: 16 }} />
            <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 6 }} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Stat Card Component ───────────────────────────────────────── */
function StatCard({
  label,
  value,
  icon,
  accentClass,
  valueClass,
  iconBgClass,
  footer,
}: {
  label: string;
  value: number;
  icon: string;
  accentClass: string;
  valueClass: string;
  iconBgClass: string;
  footer: string;
}) {
  return (
    <motion.div
      className={`dashboard-stat-card ${accentClass}`}
      variants={statCardVariants}
      whileHover={{ y: -4, boxShadow: '0 8px 25px -5px rgba(0,0,0,0.1)', transition: { duration: 0.2 } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="stat-label-modern">{label}</div>
        <div
          className={iconBgClass}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          {icon}
        </div>
      </div>
      <div className={`stat-value ${valueClass}`} style={{ fontSize: 28 }}>
        <AnimatedCounter value={value} />
      </div>
      <div className="stat-footer">{footer}</div>
    </motion.div>
  );
}

/* ─── Main Dashboard Page ───────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('');
  const [uploadPage, setUploadPage] = useState(1);
  const [contentKey, setContentKey] = useState(0);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const d = await api.getDashboard(period || undefined);
      setData(d);
      setContentKey(k => k + 1);
    } catch (err) {
      console.error('[Dashboard] Gagal memuat data:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingSkeleton />;
  if (!data) return <div className="empty-state"><h3>Gagal memuat data</h3></div>;

  const validPct = data.total_claims > 0 ? ((data.valid / data.total_claims) * 100).toFixed(1) : '0';
  const errorPct = data.total_claims > 0 ? ((data.error / data.total_claims) * 100).toFixed(1) : '0';
  const pendingPct = data.total_claims > 0 ? ((data.pending / data.total_claims) * 100).toFixed(1) : '0';

  const itemsPerPage = 5;
  const totalPages = Math.ceil((data.recent_files?.length || 0) / itemsPerPage);
  const startIndex = (uploadPage - 1) * itemsPerPage;
  const endIndex = uploadPage * itemsPerPage;
  const paginatedFiles = (data.recent_files || []).slice(startIndex, endIndex);

  const totalErrors = data.error_by_type.reduce((sum, x) => sum + x.count, 0);

  return (
    <motion.div
      key={contentKey}
      className="fade-in dashboard-page-container"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.03em' }}>Ringkasan</h2>
          <p style={{ fontSize: 12, color: 'var(--body-mid)', marginTop: 4 }}>Metrik validasi klaim real-time</p>
        </div>
        <div className="filter-group">
          <label className="filter-label">Periode</label>
          <select
            className="select-glass"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setUploadPage(1);
            }}
          >
            <option value="">Semua Periode</option>
            {data.available_periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div
        className="stats-grid"
        style={{ marginBottom: 24, gridTemplateColumns: 'repeat(4, 1fr)' }}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <StatCard
          label="Total Klaim"
          value={data.total_claims}
          icon="📋"
          accentClass="card-accent-blue"
          valueClass="stat-value-blue"
          iconBgClass="icon-bg-blue"
          footer={`${data.total_files} file diupload`}
        />
        <StatCard
          label="Valid"
          value={data.valid}
          icon="✅"
          accentClass="card-accent-green"
          valueClass="stat-value-green"
          iconBgClass="icon-bg-green"
          footer={`${validPct}% dari total`}
        />
        <StatCard
          label="Error"
          value={data.error}
          icon="❌"
          accentClass="card-accent-red"
          valueClass="stat-value-red"
          iconBgClass="icon-bg-red"
          footer={`${errorPct}% dari total`}
        />
        <StatCard
          label="Pending"
          value={data.pending}
          icon="⏳"
          accentClass="card-accent-amber"
          valueClass="stat-value-amber"
          iconBgClass="icon-bg-amber"
          footer={`${pendingPct}% dari total`}
        />
      </motion.div>

      {/* Split Layout */}
      <motion.div
        className="dashboard-split-layout"
        variants={splitLayoutVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Left Column: Top 5 Error Rules */}
        <motion.div className="dashboard-card-column" variants={columnVariants}>
          <div className="dashboard-table-card">
            <div className="card-header">
              <h3><span className="text-gradient-indigo">📊</span> 5 Aturan Error Tertinggi</h3>
              <span
                style={{ fontSize: 12, color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => router.push('/rules')}
              >
                Lihat Semua →
              </span>
            </div>
            <div className="card-body">
              {data.error_by_type.length === 0 ? (
                <EmptyErrorState />
              ) : (
                <div className="rule-list-scrollable">
                  <motion.div
                    className="rule-list-container"
                    variants={ruleStaggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {data.error_by_type.slice(0, 5).map((e, index) => {
                      const pct = totalErrors > 0 ? Math.round((e.count / totalErrors) * 100) : 0;
                      return (
                        <motion.div
                          key={e.rule_id}
                          className="rule-list-item-modern"
                          style={{ padding: '10px 14px' }}
                          variants={ruleItemVariants}
                          whileHover={{
                            x: 4,
                            backgroundColor: 'rgba(99, 102, 241, 0.04)',
                            transition: { duration: 0.15 },
                          }}
                        >
                          <div className="rule-list-item-header">
                            <span className="rule-list-item-title" style={{ fontSize: 11 }}>
                              <span
                                className="badge badge-error"
                                style={{
                                  marginRight: 8,
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '2px 6px',
                                  fontSize: 9,
                                }}
                              >
                                {e.rule_id}
                              </span>
                              {e.rule_name}
                            </span>
                            <span className="rule-list-item-percent" style={{ fontSize: 10 }}>
                              {pct}%
                            </span>
                          </div>
                          <div className="rule-progress-track">
                            <motion.div
                              className="rule-progress-fill"
                              style={{ background: 'linear-gradient(90deg, #ef4444, #ec4899)' }}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{
                                duration: 0.8,
                                ease: [0.25, 0.46, 0.45, 0.94] as const,
                                delay: 0.3 + index * 0.08,
                              }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right Column: Recent Uploads Table */}
        <motion.div className="dashboard-card-column" variants={columnVariants}>
          <div className="dashboard-table-card">
            <div className="card-header">
              <h3><span className="text-gradient-teal">📁</span> Upload Terbaru</h3>
              <button
                className="btn btn-primary"
                onClick={() => router.push('/upload')}
                style={{ padding: '6px 12px', fontSize: 11 }}
              >
                Upload Baru
              </button>
            </div>
            <div className="card-body">
              {data.recent_files.length === 0 ? (
                <EmptyUploadState />
              ) : (
                <>
                  <div className="table-container-scrollable">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Nama File</th>
                          <th>Tanggal Upload</th>
                          <th>Periode</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedFiles.map((f, index) => {
                          const statusText =
                            f.status === 'completed'
                              ? 'Processed'
                              : f.status === 'validating'
                              ? 'Validating'
                              : f.status === 'failed'
                              ? 'Failed'
                              : f.status;
                          const badgeClass =
                            f.status === 'completed'
                              ? 'valid'
                              : f.status === 'validating'
                              ? 'pending'
                              : f.status === 'failed'
                              ? 'error'
                              : 'uploaded';

                          return (
                            <motion.tr
                              key={f.id}
                              custom={index}
                              variants={tableRowVariants(index)}
                              initial="hidden"
                              animate="visible"
                              whileHover={{
                                backgroundColor: 'rgba(99, 102, 241, 0.03)',
                                transition: { duration: 0.15 },
                              }}
                              style={{ borderRadius: 6 }}
                            >
                              <td style={{ padding: '10px 14px' }}>
                                <div className="file-cell" style={{ gap: 8 }}>
                                  <div className="file-icon-modern" style={{ width: 28, height: 28, fontSize: 13 }}>
                                    &#128196;
                                  </div>
                                  <span style={{ fontWeight: 500, fontSize: 12 }}>{f.file_name}</span>
                                </div>
                              </td>
                              <td style={{ color: 'var(--body-mid)', padding: '10px 14px', fontSize: 12 }}>
                                {new Date(f.created_at).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                                ,{' '}
                                {new Date(f.created_at).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td style={{ color: 'var(--body-mid)', padding: '10px 14px', fontSize: 12 }}>
                                {f.period || '-'}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <span
                                  className={`badge badge-${badgeClass}`}
                                  style={{ fontSize: 9, padding: '2px 6px', fontWeight: 600 }}
                                >
                                  {statusText}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                                {f.status === 'completed' && f.error_count === 0 ? (
                                  <button
                                    className="btn-table-action primary"
                                    onClick={() => router.push(`/results/${f.id}`)}
                                    style={{ padding: '4px 10px', fontSize: 11 }}
                                  >
                                    Lihat Laporan
                                  </button>
                                ) : f.status === 'completed' || f.status === 'failed' ? (
                                  <button
                                    className="btn-table-action danger"
                                    onClick={() => router.push(`/results/${f.id}`)}
                                    style={{ padding: '4px 10px', fontSize: 11 }}
                                  >
                                    Lihat Error
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--mute)', fontSize: 11, marginRight: 8 }}>
                                    Memvalidasi...
                                  </span>
                                )}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="table-footer-modern" style={{ marginTop: 'auto', paddingTop: 10 }}>
                    <div className="table-footer-info" style={{ fontSize: 11 }}>
                      Menampilkan {startIndex + 1}-{Math.min(endIndex, data.recent_files.length)} dari{' '}
                      {data.recent_files.length}
                    </div>
                    <div className="table-footer-pagination">
                      <button
                        className="btn-pagination-arrow"
                        disabled={uploadPage <= 1}
                        onClick={() => setUploadPage((p) => Math.max(1, p - 1))}
                        title="Halaman Sebelumnya"
                        style={{ width: 28, height: 28, fontSize: 11 }}
                      >
                        &lt;
                      </button>
                      <button
                        className="btn-pagination-arrow"
                        disabled={uploadPage >= totalPages}
                        onClick={() => setUploadPage((p) => Math.min(totalPages, p + 1))}
                        title="Halaman Berikutnya"
                        style={{ width: 28, height: 28, fontSize: 11 }}
                      >
                        &gt;
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
