'use client';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { api } from '@/lib/api';

interface AuditLog { id: string; user_name: string; user_email: string; action: string; resource_type: string; resource_id: string; details: string; ip_address: string; created_at: string; }

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.035 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

const filterVariants: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(page), limit: '30' };
      if (action) params.action = action;
      const d = await api.getAuditLogs(params);
      setLogs(d.logs); setTotal(d.total);
    } catch (err) { console.error('[Audit] Gagal memuat log:', err); } finally { setLoading(false); }
  }, [page, action]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const actionEmoji = (a: string) => {
    switch (a) { case 'login': return '🔐'; case 'upload_and_validate': return '📤'; case 'export': return '📥'; case 'approve': return '✅'; case 'create_user': return '👤'; case 'delete': return '🗑️'; default: return '📋'; }
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <motion.div
      className="fade-in"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="page-header"><div><h2>📋 Log Audit</h2><p>Riwayat aktivitas sistem</p></div></div>

      <motion.div
        className="filter-bar"
        variants={filterVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.select
          className="form-select"
          value={action}
          onChange={e => { setAction(e.target.value); setPage(1); }}
          whileHover={{ boxShadow: '0 2px 12px rgba(59,130,246,0.15)' }}
          whileFocus={{ boxShadow: '0 0 0 3px rgba(59,130,246,0.2)' }}
        >
          <option value="">Semua Aksi</option>
          <option value="login">Login</option>
          <option value="upload_and_validate">Upload & Validasi</option>
          <option value="export">Export</option>
          <option value="approve">Setujui</option>
          <option value="create_user">Buat User</option>
          <option value="delete">Hapus</option>
        </motion.select>
      </motion.div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            className="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="spinner" />
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
              <thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Resource</th><th>IP</th></tr></thead>
              <motion.tbody
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <AnimatePresence>
                  {logs.length === 0 ? (
                    <motion.tr
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' as const }}
                        >
                          Tidak ada log
                        </motion.div>
                      </td>
                    </motion.tr>
                  ) : logs.map((log, i) => (
                    <motion.tr
                      key={log.id}
                      variants={rowVariants}
                      layout
                      whileHover={{
                        backgroundColor: 'rgba(59,130,246,0.04)',
                        x: 2,
                        transition: { duration: 0.15 },
                      }}
                      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                      style={{ position: 'relative' }}
                    >
                      {/* Timeline dot indicator */}
                      <td style={{ position: 'relative' }}>
                        <motion.div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-blue, #3b82f6)',
                          }}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.03 + 0.2, type: 'spring', stiffness: 400, damping: 15 }}
                        />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingLeft: 12 }}>
                          {new Date(log.created_at).toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{log.user_name || '-'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.user_email}</div>
                      </td>
                      <td>
                        <motion.span
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          whileHover={{ scale: 1.05 }}
                        >
                          <motion.span
                            style={{ display: 'inline-block' }}
                            whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.4 } }}
                          >
                            {actionEmoji(log.action)}
                          </motion.span>
                          {log.action}
                        </motion.span>
                      </td>
                      <td style={{ fontSize: 12 }}>{log.resource_type} {log.resource_id ? `(${log.resource_id.substring(0, 8)}...)` : ''}</td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{log.ip_address || '-'}</td>
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
