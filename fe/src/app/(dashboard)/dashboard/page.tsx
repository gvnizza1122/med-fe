'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('');
  const [uploadPage, setUploadPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setLoading(true);
      const d = await api.getDashboard(period || undefined);
      setData(d);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="fade-in dashboard-page-container" style={{ padding: 0 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="skeleton" style={{ width: 200, height: 28, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: 300, height: 14, borderRadius: 6, marginTop: 8 }} />
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="dashboard-stat-card" style={{ padding: '16px 20px' }}>
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 60, height: 28, borderRadius: 6 }} />
          </div>
        ))}
      </div>
      <div className="dashboard-split-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[1,2].map(i => (
          <div key={i} className="dashboard-table-card" style={{ padding: 20, height: 300 }}>
            <div className="skeleton" style={{ width: '60%', height: 20, borderRadius: 6, marginBottom: 16 }} />
            <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
  if (!data) return <div className="empty-state"><h3>Gagal memuat data</h3></div>;

  const validPct = data.total_claims > 0 ? ((data.valid / data.total_claims) * 100).toFixed(1) : '0';
  const errorPct = data.total_claims > 0 ? ((data.error / data.total_claims) * 100).toFixed(1) : '0';
  const pendingPct = data.total_claims > 0 ? ((data.pending / data.total_claims) * 100).toFixed(1) : '0';

  const itemsPerPage = 5;
  const totalPages = Math.ceil((data.recent_files?.length || 0) / itemsPerPage);
  const startIndex = (uploadPage - 1) * itemsPerPage;
  const endIndex = uploadPage * itemsPerPage;
  const paginatedFiles = (data.recent_files || []).slice(startIndex, endIndex);

  return (
    <div className="fade-in dashboard-page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20, alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Ringkasan</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Metrik validasi klaim real-time</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
      <div className="stats-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="dashboard-stat-card">
          <div className="stat-label-modern">Total Klaim</div>
          <div className="stat-value" style={{ fontSize: 28 }}>{data.total_claims.toLocaleString('id-ID')}</div>
          <div className="stat-footer">{data.total_files} file diupload</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="stat-label-modern">Valid</div>
          <div className="stat-value" style={{ color: 'var(--accent-green)', fontSize: 28 }}>
            {data.valid.toLocaleString('id-ID')}
          </div>
          <div className="stat-footer">{validPct}% dari total</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="stat-label-modern">Error</div>
          <div className="stat-value" style={{ color: 'var(--accent-red)', fontSize: 28 }}>
            {data.error.toLocaleString('id-ID')}
          </div>
          <div className="stat-footer">{errorPct}% dari total</div>
        </div>
        <div className="dashboard-stat-card">
          <div className="stat-label-modern">Pending</div>
          <div className="stat-value" style={{ color: 'var(--accent-orange)', fontSize: 28 }}>
            {data.pending.toLocaleString('id-ID')}
          </div>
          <div className="stat-footer">{pendingPct}% dari total</div>
        </div>
      </div>

      {/* Split Layout */}
      <div className="dashboard-split-layout">
        {/* Left Column: Top 5 Error Rules */}
        <div className="dashboard-card-column">
          <div className="dashboard-table-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>5 Aturan Error Tertinggi</h3>
              <span
                style={{ fontSize: 12, color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => router.push('/rules')}
              >
                Lihat Semua
              </span>
            </div>
            {data.error_by_type.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Belum ada data error</p>
            ) : (
              <div className="rule-list-scrollable">
                <div className="rule-list-container">
                  {data.error_by_type.slice(0, 5).map((e) => {
                    const totalErrors = data.error_by_type.reduce((sum, x) => sum + x.count, 0);
                    const pct = totalErrors > 0 ? Math.round((e.count / totalErrors) * 100) : 0;
                    return (
                      <div key={e.rule_id} className="rule-list-item-modern" style={{ padding: '10px 14px' }}>
                        <div className="rule-list-item-header">
                          <span className="rule-list-item-title" style={{ fontSize: 11 }}>
                            <span className="badge badge-error" style={{ marginRight: 8, borderRadius: 'var(--radius-sm)', padding: '2px 6px', fontSize: 9 }}>
                              {e.rule_id}
                            </span>
                            {e.rule_name}
                          </span>
                          <span className="rule-list-item-percent" style={{ fontSize: 10 }}>{pct}%</span>
                        </div>
                        <div className="rule-progress-track">
                          <div className="rule-progress-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ef4444, #ec4899)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Uploads Table */}
        <div className="dashboard-card-column">
          <div className="dashboard-table-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Upload Terbaru</h3>
              <button
                className="btn btn-primary"
                onClick={() => router.push('/upload')}
                style={{ padding: '6px 12px', fontSize: 11 }}
              >
                Upload Baru
              </button>
            </div>

            {data.recent_files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: 32, display: 'block', marginBottom: 12 }}>📁</span>
                <p style={{ fontSize: 13 }}>Belum ada file yang diupload</p>
              </div>
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
                      {paginatedFiles.map((f) => {
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
                          <tr key={f.id}>
                            <td style={{ padding: '10px 14px' }}>
                              <div className="file-cell" style={{ gap: 8 }}>
                                <div className="file-icon-modern" style={{ width: 28, height: 28, fontSize: 13 }}>📄</div>
                                <span style={{ fontWeight: 500, fontSize: 12 }}>{f.file_name}</span>
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-secondary)', padding: '10px 14px', fontSize: 12 }}>
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
                            <td style={{ color: 'var(--text-secondary)', padding: '10px 14px', fontSize: 12 }}>{f.period || '-'}</td>
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
                                <span style={{ color: 'var(--text-muted)', fontSize: 11, marginRight: 8 }}>
                                  Memvalidasi...
                                </span>
                              )}
                            </td>
                          </tr>
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
      </div>
    </div>
  );
}
