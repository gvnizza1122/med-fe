'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface User { id: string; email: string; full_name: string; nik: string; role: string; is_active: number; last_login: string; created_at: string; }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', nik: '', role: 'verifikator' });
  const [error, setError] = useState('');

  useEffect(() => { loadUsers(); }, []);
  const loadUsers = async () => { try { setLoading(true); const d = await api.getUsers(); setUsers(d.users); } catch { /* */ } finally { setLoading(false); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      if (editUser) {
        const data: Record<string, unknown> = { full_name: form.full_name, nik: form.nik, role: form.role };
        if (form.password) data.password = form.password;
        await api.updateUser(editUser.id, data);
      } else {
        await api.createUser(form);
      }
      setShowModal(false); setEditUser(null);
      setForm({ email: '', password: '', full_name: '', nik: '', role: 'verifikator' });
      loadUsers();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Gagal menyimpan'); }
  };

  const handleEdit = (u: User) => {
    setEditUser(u);
    setForm({ email: u.email, password: '', full_name: u.full_name, nik: u.nik || '', role: u.role });
    setShowModal(true);
  };

  const handleToggle = async (u: User) => {
    try { await api.updateUser(u.id, { is_active: !u.is_active }); loadUsers(); } catch { /* */ }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h2>👥 Manajemen User</h2><p>{users.length} user terdaftar</p></div>
        <button className="btn btn-primary" onClick={() => { setEditUser(null); setForm({ email: '', password: '', full_name: '', nik: '', role: 'verifikator' }); setShowModal(true); }}>➕ Tambah User</button>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>NIK</th><th>Role</th><th>Status</th><th>Login Terakhir</th><th>Aksi</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                <td>{u.email}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.nik || '-'}</td>
                <td><span className={`badge badge-${u.role === 'admin' ? 'approved' : u.role === 'supervisor' ? 'completed' : 'valid'}`}>{u.role}</span></td>
                <td><span className={`badge ${u.is_active ? 'badge-valid' : 'badge-error'}`}>{u.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.last_login ? new Date(u.last_login).toLocaleString('id-ID') : '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(u)}>✏️</button>
                    <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => handleToggle(u)}>{u.is_active ? '🚫' : '✅'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editUser ? 'Edit User' : 'Tambah User Baru'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {error && <div className="login-error">⚠️ {error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Nama Lengkap</label><input className="form-input" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required /></div>
              <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={!!editUser} /></div>
              <div className="form-group"><label className="form-label">{editUser ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}</label><input type="password" className="form-input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editUser} minLength={8} /></div>
              <div className="form-group"><label className="form-label">NIK</label><input className="form-input" value={form.nik} onChange={e => setForm({...form, nik: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Role</label><select className="form-select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}><option value="verifikator">Verifikator</option><option value="supervisor">Supervisor</option><option value="admin">Admin</option></select></div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button><button type="submit" className="btn btn-primary">💾 Simpan</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
