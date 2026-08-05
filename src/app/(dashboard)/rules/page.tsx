'use client';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/useRequireRole';

interface Rule { 
  id: string; 
  rule_code: string; 
  rule_name: string; 
  description: string; 
  field_name: string; 
  priority: number; 
  is_active: boolean; 
  error_message: string; 
}

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

const priorityGlow = (p: number) =>
  p === 1 ? '0 0 12px rgba(239,68,68,0.35)' :
  p === 2 ? '0 0 12px rgba(245,158,11,0.3)' :
  '0 0 12px rgba(59,130,246,0.25)';

export default function RulesPage() {
  const { checking, allowed } = useRequireRole(['admin']);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState('');

  const loadRules = useCallback(async () => {
    try {
      const d = await api.getRules();
      setRules(d.rules);
    } catch (err) {
      console.error('[Rules] Gagal memuat aturan:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (allowed) loadRules(); }, [allowed, loadRules]);

  const handleToggle = async (rule: Rule) => {
    try { 
      await api.updateRule(rule.id, { is_active: !rule.is_active }); 
      loadRules(); 
    } catch (err) { 
      console.error('[Rules] Gagal toggle aturan:', err);
    }
  };

  const handleSaveMessage = async (ruleId: string) => {
    try { 
      await api.updateRule(ruleId, { error_message: editMsg }); 
      setEditId(null); 
      loadRules(); 
    } catch (err) { 
      console.error('[Rules] Gagal simpan pesan:', err);
    }
  };

  const priorityLabel = (p: number) => p === 1 ? 'Kritis' : p === 2 ? 'Mayor' : 'Minor';
  const priorityClass = (p: number) => p === 1 ? 'critical' : p === 2 ? 'major' : 'minor';

  if (checking || !allowed) return <div className="loading"><div className="spinner" /></div>;
  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <motion.div
      className="fade-in"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="page-header">
        <div>
          <h2>⚙️ Aturan Validasi</h2>
          <p>Kelola {rules.length} rule validasi klaim BPJS (BA 1247/2024)</p>
        </div>
      </div>

      <motion.div
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence>
          {rules.map(rule => (
            <motion.div
              key={rule.id}
              className="card"
              style={{ padding: 20 }}
              variants={cardVariants}
              layout
              whileHover={{
                y: -3,
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                transition: { duration: 0.2 },
              }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <motion.span
                      className="badge badge-error"
                      style={{ fontSize: 12 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      {rule.id}
                    </motion.span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{rule.rule_name}</span>
                    <motion.span
                      className={`badge badge-${priorityClass(rule.priority)}`}
                      whileHover={{
                        scale: 1.1,
                        boxShadow: priorityGlow(rule.priority),
                      }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.05 }}
                    >
                      {priorityLabel(rule.priority)}
                    </motion.span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>{rule.description}</p>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Field: <code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4 }}>{rule.field_name}</code>
                  </div>

                  <AnimatePresence mode="wait">
                    {editId === rule.id ? (
                      <motion.div
                        key="edit"
                        style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' as const }}
                      >
                        <motion.input
                          className="form-input"
                          value={editMsg}
                          onChange={e => setEditMsg(e.target.value)}
                          style={{ flex: 1, minWidth: 160 }}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 }}
                          autoFocus
                        />
                        <motion.button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveMessage(rule.id)}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                        >
                          💾
                        </motion.button>
                        <motion.button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditId(null)}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                        >
                          ✕
                        </motion.button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="view"
                        style={{ marginTop: 8, fontSize: 12 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>Pesan error: </span>
                        <span style={{ color: 'var(--accent-red)' }}>{rule.error_message}</span>
                        <motion.button
                          className="btn btn-secondary btn-sm"
                          style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
                          onClick={() => { setEditId(rule.id); setEditMsg(rule.error_message); }}
                          whileHover={{ scale: 1.06 }}
                          whileTap={{ scale: 0.94 }}
                        >
                          ✏️ Edit
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 4. PERUBAHAN: Evaluasi kondisi element tombol langsung mengecek boolean asli */}
                <motion.button
                  className={`btn btn-sm ${rule.is_active ? 'btn-success' : 'btn-secondary'}`}
                  onClick={() => handleToggle(rule)}
                  whileHover={{ scale: 1.06, boxShadow: rule.is_active ? '0 2px 12px rgba(34,197,94,0.3)' : '0 2px 8px rgba(0,0,0,0.1)' }}
                  whileTap={{ scale: 0.94 }}
                  layout
                >
                  <motion.span
                    key={rule.is_active ? 'active' : 'inactive'}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'inline-block' }}
                  >
                    {rule.is_active ? '✅ Aktif' : '⏸️ Nonaktif'}
                  </motion.span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
