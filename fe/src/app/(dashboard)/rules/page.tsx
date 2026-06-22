'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState('');

  useEffect(() => { loadRules(); }, []);
  
  const loadRules = async () => { 
    try { 
      const d = await api.getRules(); 
      setRules(d.rules); 
    } catch { 
    } finally { 
      setLoading(false); 
    } 
  };

  const handleToggle = async (rule: Rule) => {
    try { 
      await api.updateRule(rule.id, { is_active: !rule.is_active }); 
      loadRules(); 
    } catch { 
    }
  };

  const handleSaveMessage = async (ruleId: string) => {
    try { 
      await api.updateRule(ruleId, { error_message: editMsg }); 
      setEditId(null); 
      loadRules(); 
    } catch { 
      
    }
  };

  const priorityLabel = (p: number) => p === 1 ? 'Kritis' : p === 2 ? 'Mayor' : 'Minor';
  const priorityClass = (p: number) => p === 1 ? 'critical' : p === 2 ? 'major' : 'minor';

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h2>⚙️ Aturan Validasi</h2>
          <p>Kelola {rules.length} rule validasi klaim BPJS (BA 1247/2024)</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rules.map(rule => (
          <div key={rule.id} className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span className="badge badge-error" style={{ fontSize: 12 }}>{rule.id}</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{rule.rule_name}</span>
                  <span className={`badge badge-${priorityClass(rule.priority)}`}>{priorityLabel(rule.priority)}</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>{rule.description}</p>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Field: <code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4 }}>{rule.field_name}</code>
                </div>

                {editId === rule.id ? (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                    <input className="form-input" value={editMsg} onChange={e => setEditMsg(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-primary btn-sm" onClick={() => handleSaveMessage(rule.id)}>💾</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>✕</button>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Pesan error: </span>
                    <span style={{ color: 'var(--accent-red)' }}>{rule.error_message}</span>
                    <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
                      onClick={() => { setEditId(rule.id); setEditMsg(rule.error_message); }}>✏️ Edit</button>
                  </div>
                )}
              </div>

              {/* 4. PERUBAHAN: Evaluasi kondisi element tombol langsung mengecek boolean asli */}
              <button
                className={`btn btn-sm ${rule.is_active ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => handleToggle(rule)}
              >
                {rule.is_active ? '✅ Aktif' : '⏸️ Nonaktif'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}