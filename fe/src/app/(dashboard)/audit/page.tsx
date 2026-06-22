'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AuditLog { id: string; user_name: string; user_email: string; action: string; resource_type: string; resource_id: string; details: string; ip_address: string; created_at: string; }

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');

  useEffect(() => { loadLogs(); }, [page, action]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(page), limit: '30' };
      if (action) params.action = action;
      const d = await api.getAuditLogs(params);
      setLogs(d.logs); setTotal(d.total);
    } catch { /* */ } finally { setLoading(false); }
  };

  const actionEmoji = (a: string) => {
    switch (a) { case 'login': return '🔐'; case 'upload_and_validate': return '📤'; case 'export': return '📥'; case 'approve': return '✅'; case 'create_user': return '👤'; case 'delete': return '🗑️'; default: return '📋'; }
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="fade-in">
      <div className="page-header"><div><h2>📋 Log Audit</h2><p>Riwayat aktivitas sistem</p></div></div>

      <div className="filter-bar">
        <select className="form-select" value={action} onChange={e => { setAction(e.target.value); setPage(1); }}>
          <option value="">Semua Aksi</option>
          <option value="login">Login</option>
          <option value="upload_and_validate">Upload & Validasi</option>
          <option value="export">Export</option>
          <option value="approve">Setujui</option>
          <option value="create_user">Buat User</option>
          <option value="delete">Hapus</option>
        </select>
      </div>

      {loading ? <div className="loading"><div className="spinner" /></div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Resource</th><th>IP</th></tr></thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Tidak ada log</td></tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('id-ID')}</td>
                  <td><div style={{ fontWeight: 500 }}>{log.user_name || '-'}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.user_email}</div></td>
                  <td>{actionEmoji(log.action)} {log.action}</td>
                  <td style={{ fontSize: 12 }}>{log.resource_type} {log.resource_id ? `(${log.resource_id.substring(0, 8)}...)` : ''}</td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{log.ip_address || '-'}</td>
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
