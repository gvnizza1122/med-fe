'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { api } from '@/lib/api';

interface User { id: string; email: string; full_name: string; nik: string; role: string; is_active: number; last_login: string; created_at: string; }

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 28, staggerChildren: 0.06, delayChildren: 0.1 },
  },
  exit: { opacity: 0, scale: 0.92, y: 10, transition: { duration: 0.2 } },
};

const fieldVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', nik: '', role: 'verifikator' });
  const [error, setError] = useState('');

  useEffect(() => { loadUsers(); }, []);
  const loadUsers = async () => { try { setLoading(true); const d = await api.getUsers(); setUsers(d.users); } catch (err) { console.error('[Users] Gagal memuat user:', err); } finally { setLoading(false); } };

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
    try { await api.updateUser(u.id, { is_active: !u.is_active }); loadUsers(); } catch (err) { console.error('[Users] Gagal toggle user:', err); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <motion.div
      className="fade-in"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="page-header">
        <div><h2>👥 Manajemen User</h2><p>{users.length} user terdaftar</p></div>
        <motion.button
          className="btn btn-primary"
          onClick={() => { setEditUser(null); setForm({ email: '', password: '', full_name: '', nik: '', role: 'verifikator' }); setShowModal(true); }}
          whileHover={{ scale: 1.04, boxShadow: '0 4px 16px rgba(59,130,246,0.3)' }}
          whileTap={{ scale: 0.96 }}
        >
          ➕ Tambah User
        </motion.button>
      </div>

      <motion.div
        className="table-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.1 } }}
      >
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>NIK</th><th>Role</th><th>Status</th><th>Login Terakhir</th><th>Aksi</th></tr></thead>
          <motion.tbody
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence>
              {users.map(u => (
                <motion.tr
                  key={u.id}
                  variants={rowVariants}
                  layout
                  whileHover={{
                    backgroundColor: 'rgba(59,130,246,0.04)',
                    y: -1,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    transition: { duration: 0.15 },
                  }}
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                >
                  <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.nik || '-'}</td>
                  <td>
                    <motion.span
                      className={`badge badge-${u.role === 'admin' ? 'approved' : u.role === 'supervisor' ? 'completed' : 'valid'}`}
                      whileHover={{ scale: 1.08 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      {u.role}
                    </motion.span>
                  </td>
                  <td>
                    <motion.span
                      className={`badge ${u.is_active ? 'badge-valid' : 'badge-error'}`}
                      key={u.is_active ? 'active' : 'inactive'}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </motion.span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.last_login ? new Date(u.last_login).toLocaleString('id-ID') : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <motion.button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(u)}
                        whileHover={{ scale: 1.1, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                        whileTap={{ scale: 0.9 }}
                      >
                        ✏️
                      </motion.button>
                      <motion.button
                        className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggle(u)}
                        whileHover={{ scale: 1.1, boxShadow: u.is_active ? '0 2px 8px rgba(239,68,68,0.3)' : '0 2px 8px rgba(34,197,94,0.3)' }}
                        whileTap={{ scale: 0.9 }}
                        layout
                      >
                        <motion.span
                          key={u.is_active ? 'on' : 'off'}
                          initial={{ opacity: 0, rotate: -90 }}
                          animate={{ opacity: 1, rotate: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ display: 'inline-block' }}
                        >
                          {u.is_active ? '🚫' : '✅'}
                        </motion.span>
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </motion.tbody>
        </table>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-overlay"
            onClick={() => setShowModal(false)}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="modal"
              onClick={e => e.stopPropagation()}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="modal-header">
                <motion.h3
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  {editUser ? 'Edit User' : 'Tambah User Baru'}
                </motion.h3>
                <motion.button
                  className="modal-close"
                  onClick={() => setShowModal(false)}
                  whileHover={{ scale: 1.15, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="login-error"
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                  >
                    ⚠️ {error}
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.form
                onSubmit={handleSubmit}
                variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
              >
                <motion.div className="form-group" variants={fieldVariants}>
                  <label className="form-label">Nama Lengkap</label>
                  <input className="form-input" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
                </motion.div>
                <motion.div className="form-group" variants={fieldVariants}>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required disabled={!!editUser} />
                </motion.div>
                <motion.div className="form-group" variants={fieldVariants}>
                  <label className="form-label">{editUser ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}</label>
                  <input type="password" className="form-input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editUser} minLength={8} />
                </motion.div>
                <motion.div className="form-group" variants={fieldVariants}>
                  <label className="form-label">NIK</label>
                  <input className="form-input" value={form.nik} onChange={e => setForm({...form, nik: e.target.value})} />
                </motion.div>
                <motion.div className="form-group" variants={fieldVariants}>
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="verifikator">Verifikator</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </motion.div>
                <motion.div
                  className="modal-footer"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <motion.button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Batal
                  </motion.button>
                  <motion.button
                    type="submit"
                    className="btn btn-primary"
                    whileHover={{ scale: 1.03, boxShadow: '0 4px 16px rgba(59,130,246,0.3)' }}
                    whileTap={{ scale: 0.97 }}
                  >
                    💾 Simpan
                  </motion.button>
                </motion.div>
              </motion.form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
