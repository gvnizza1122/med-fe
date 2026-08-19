'use client';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Settings2, Building2, Pencil, Check, X, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/useRequireRole';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

const KELAS_RS_OPTIONS = ['A', 'B', 'C', 'D'];

const priorityMeta = (p: number) =>
  p === 1
    ? { label: 'Kritis', className: 'bg-destructive/10 text-destructive border-destructive/20' }
    : p === 2
    ? { label: 'Mayor', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' }
    : { label: 'Minor', className: 'bg-primary/10 text-primary border-primary/20' };

export default function RulesPage() {
  const { checking, allowed } = useRequireRole(['admin']);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState('');

  const [hospitalCode, setHospitalCode] = useState('');
  const [kelasRs, setKelasRs] = useState('');
  const [kelasRsDraft, setKelasRsDraft] = useState('');
  const [kelasRsSaving, setKelasRsSaving] = useState(false);
  const [kelasRsSaved, setKelasRsSaved] = useState(false);

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

  const loadHospitalSettings = useCallback(async () => {
    try {
      const d = await api.getHospitalSettings();
      setHospitalCode(d.hospital_code || '');
      setKelasRs(d.kelas_rs || '');
      setKelasRsDraft(d.kelas_rs || '');
    } catch (err) {
      console.error('[Rules] Gagal memuat profil RS:', err);
    }
  }, []);

  useEffect(() => { if (allowed) { loadRules(); loadHospitalSettings(); } }, [allowed, loadRules, loadHospitalSettings]);

  const handleSaveKelasRs = async () => {
    if (!kelasRsDraft || kelasRsDraft === kelasRs) return;
    setKelasRsSaving(true);
    try {
      await api.updateHospitalSettings({ kelas_rs: kelasRsDraft });
      setKelasRs(kelasRsDraft);
      setKelasRsSaved(true);
      setTimeout(() => setKelasRsSaved(false), 2000);
    } catch (err) {
      console.error('[Rules] Gagal simpan Kelas RS:', err);
    } finally {
      setKelasRsSaving(false);
    }
  };

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

  if (checking || !allowed || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Header
        title="Aturan Validasi"
        description={`Kelola ${rules.length} rule validasi klaim BPJS (BA 1247/2024)`}
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings2 className="size-4" />
            <span>{rules.filter((r) => r.is_active).length} aktif dari {rules.length}</span>
          </div>
        }
      />

      <Card className="animate-slide-in-up">
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-sm">Profil Rumah Sakit</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                KODE_RS dan KELAS_RS adalah atribut rumah sakit itu sendiri, bukan per-klaim — keduanya
                tidak pernah tercetak di SEP atau Resume Medis pasien. Isi Kelas RS sekali di sini, sistem
                akan mengisinya otomatis untuk setiap berkas klaim yang diupload.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-5 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kode RS (BPJS)</Label>
              <code className="block rounded-md bg-muted px-3 py-1.5 text-sm font-mono">
                {hospitalCode || '—'}
              </code>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kelas RS (akreditasi)</Label>
              <Select value={kelasRsDraft} onValueChange={setKelasRsDraft}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="— Belum diisi —" />
                </SelectTrigger>
                <SelectContent>
                  {KELAS_RS_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>Kelas {k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSaveKelasRs}
              disabled={kelasRsSaving || !kelasRsDraft || kelasRsDraft === kelasRs}
            >
              <Save className="size-4" />
              {kelasRsSaving ? 'Menyimpan...' : kelasRsSaved ? 'Tersimpan' : 'Simpan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <motion.div
        className="flex flex-col gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <AnimatePresence>
          {rules.map((rule) => {
            const meta = priorityMeta(rule.priority);
            return (
              <motion.div
                key={rule.id}
                variants={cardVariants}
                layout
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-[220px] flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono">{rule.id}</Badge>
                          <span className="font-semibold text-sm text-foreground">{rule.rule_name}</span>
                          <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                        </div>

                        <p className="text-sm text-muted-foreground">{rule.description}</p>

                        <div className="text-xs text-muted-foreground">
                          Field:{' '}
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{rule.field_name}</code>
                        </div>

                        <AnimatePresence mode="wait">
                          {editId === rule.id ? (
                            <motion.div
                              key="edit"
                              className="flex flex-wrap items-center gap-2 pt-1"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: 'easeInOut' }}
                            >
                              <Input
                                value={editMsg}
                                onChange={(e) => setEditMsg(e.target.value)}
                                className="min-w-[180px] flex-1"
                                autoFocus
                              />
                              <Button size="icon-sm" onClick={() => handleSaveMessage(rule.id)}>
                                <Check className="size-4" />
                              </Button>
                              <Button size="icon-sm" variant="outline" onClick={() => setEditId(null)}>
                                <X className="size-4" />
                              </Button>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="view"
                              className="flex flex-wrap items-center gap-2 pt-1 text-xs"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <span className="text-muted-foreground">Pesan error:</span>
                              <span className="text-destructive">{rule.error_message}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => { setEditId(rule.id); setEditMsg(rule.error_message); }}
                              >
                                <Pencil className="size-3" />
                                Edit
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`text-xs font-medium ${rule.is_active ? 'text-primary' : 'text-muted-foreground'}`}>
                          {rule.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <Switch checked={rule.is_active} onCheckedChange={() => handleToggle(rule)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
