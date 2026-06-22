'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface ClaimFile {
  id: string; file_name: string; period: string; status: string;
  total_records: number; valid_count: number; error_count: number; pending_count: number;
  created_at: string; uploaded_by_name: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFiles(); }, [page]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const d = await api.getFiles(page, 15);
      setFiles(d.files); setTotal(d.total);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus file ini?')) return;
    try { await api.deleteFile(id); loadFiles(); } catch { /* ignore */ }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  const totalPages = Math.ceil(total / 15);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h2>📁 Riwayat Upload</h2><p>{total} file telah diupload</p></div>
        <button className="btn btn-primary" onClick={() => router.push('/upload')}>📤 Upload Baru</button>
      </div>

      {files.length === 0 ? (
        <div className="card"><div className="empty-state"><div className="empty-state-icon">📁</div><h3>Belum ada file</h3><p>Upload file klaim untuk memulai validasi</p><button className="btn btn-primary" onClick={() => router.push('/upload')}>📤 Upload Sekarang</button></div></div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>File</th><th>Periode</th><th>Total</th><th>Valid</th><th>Error</th><th>Status</th><th>Diunggah</th><th>Aksi</th></tr></thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>{f.file_name}</td>
                  <td>{f.period || '-'}</td>
                  <td>{f.total_records}</td>
                  <td style={{ color: 'var(--accent-green)' }}>{f.valid_count}</td>
                  <td style={{ color: 'var(--accent-red)' }}>{f.error_count}</td>
                  <td><span className={`badge badge-${f.status === 'completed' ? 'completed' : f.status === 'validating' ? 'validating' : f.status === 'parsing' ? 'parsing' : f.status === 'approved' ? 'approved' : f.status === 'error' ? 'error' : f.status}`}>{f.status === 'completed' ? 'Selesai' : f.status === 'validating' ? 'Memvalidasi' : f.status === 'parsing' ? 'Membaca' : f.status === 'approved' ? 'Disetujui' : f.status === 'error' ? 'Error' : f.status.charAt(0).toUpperCase() + f.status.slice(1)}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.uploaded_by_name}<br/>{new Date(f.created_at).toLocaleDateString('id-ID')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/results/${f.id}`)}>📋 Detail</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>← Sebelumnya</button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Halaman {page} dari {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Selanjutnya →</button>
        </div>
      )}
    </div>
  );
}
