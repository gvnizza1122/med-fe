'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { api } from '@/lib/api';

interface ClaimFile {
  id: string; file_name: string; period: string; status: string;
  total_records: number; valid_count: number; error_count: number; pending_count: number;
  created_at: string; uploaded_by_name: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

const emptyVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

const statusLabel = (s: string) =>
  s === 'completed' ? 'Selesai' :
  s === 'validating' ? 'Memvalidasi' :
  s === 'parsing' ? 'Membaca' :
  s === 'approved' ? 'Disetujui' :
  s === 'error' ? 'Error' :
  s.charAt(0).toUpperCase() + s.slice(1);

const statusClass = (s: string) =>
  s === 'completed' ? 'completed' :
  s === 'validating' ? 'validating' :
  s === 'parsing' ? 'parsing' :
  s === 'approved' ? 'approved' :
  s === 'error' ? 'error' : s;

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
    } catch (err) { console.error('[History] Gagal memuat file:', err); } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus file ini?')) return;
    try { await api.deleteFile(id); loadFiles(); } catch (err) { console.error('[History] Gagal hapus file:', err); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  const totalPages = Math.ceil(total / 15);

  return (
    <motion.div
      className="fade-in"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="page-header">
        <div><h2>📁 Riwayat Upload</h2><p>{total} file telah diupload</p></div>
        <motion.button
          className="btn btn-primary"
          onClick={() => router.push('/upload')}
          whileHover={{ scale: 1.04, boxShadow: '0 4px 16px rgba(59,130,246,0.3)' }}
          whileTap={{ scale: 0.96 }}
        >
          📤 Upload Baru
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {files.length === 0 ? (
          <motion.div
            className="card"
            key="empty"
            variants={emptyVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
          >
            <div className="empty-state">
              <motion.div
                className="empty-state-icon"
                animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' as const }}
              >
                📁
              </motion.div>
              <h3>Belum ada file</h3>
              <p>Upload file klaim untuk memulai validasi</p>
              <motion.button
                className="btn btn-primary"
                onClick={() => router.push('/upload')}
                whileHover={{ scale: 1.04, boxShadow: '0 4px 16px rgba(59,130,246,0.3)' }}
                whileTap={{ scale: 0.96 }}
              >
                📤 Upload Sekarang
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="table-container"
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <table>
              <thead><tr><th>File</th><th>Periode</th><th>Total</th><th>Valid</th><th>Error</th><th>Status</th><th>Diunggah</th><th>Aksi</th></tr></thead>
              <motion.tbody
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <AnimatePresence>
                  {files.map((f, i) => (
                    <motion.tr
                      key={f.id}
                      variants={rowVariants}
                      layout
                      whileHover={{
                        backgroundColor: 'rgba(59,130,246,0.04)',
                        y: -1,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        transition: { duration: 0.15 },
                      }}
                      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                      style={{ cursor: 'default' }}
                    >
                      <td style={{ fontWeight: 600 }}>{f.file_name}</td>
                      <td>{f.period || '-'}</td>
                      <td>{f.total_records}</td>
                      <td style={{ color: 'var(--accent-green)' }}>{f.valid_count}</td>
                      <td style={{ color: 'var(--accent-red)' }}>{f.error_count}</td>
                      <td>
                        <motion.span
                          className={`badge badge-${statusClass(f.status)}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.03 + 0.15, type: 'spring', stiffness: 300, damping: 20 }}
                          whileHover={{ scale: 1.08 }}
                        >
                          {statusLabel(f.status)}
                        </motion.span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.uploaded_by_name}<br/>{new Date(f.created_at).toLocaleDateString('id-ID')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <motion.button
                            className="btn btn-secondary btn-sm"
                            onClick={() => router.push(`/results/${f.id}`)}
                            whileHover={{ scale: 1.06, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                            whileTap={{ scale: 0.94 }}
                          >
                            📋 Detail
                          </motion.button>
                          <motion.button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(f.id)}
                            whileHover={{ scale: 1.1, boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}
                            whileTap={{ scale: 0.9 }}
                          >
                            🗑️
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </motion.tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {totalPages > 1 && (
          <motion.div
            className="pagination"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <motion.button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              whileHover={page > 1 ? { scale: 1.04 } : {}}
              whileTap={page > 1 ? { scale: 0.96 } : {}}
            >
              ← Sebelumnya
            </motion.button>
            <AnimatePresence mode="wait">
              <motion.span
                key={page}
                style={{ fontSize: 13, color: 'var(--text-secondary)' }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
              >
                Halaman {page} dari {totalPages}
              </motion.span>
            </AnimatePresence>
            <motion.button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              whileHover={page < totalPages ? { scale: 1.04 } : {}}
              whileTap={page < totalPages ? { scale: 0.96 } : {}}
            >
              Selanjutnya →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
