'use client';
import { useDeferredEffect } from '@/lib/useDeferredEffect';

import { Header } from '@/components/dashboard/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
Dialog,
DialogContent,
DialogFooter,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
Table,
TableCell,
TableHead,
TableHeader,
TableRow
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/useRequireRole';
import { AnimatePresence,motion,type Variants } from 'framer-motion';
import { HeartPulse,Pencil,Trash2 } from 'lucide-react';
import { useCallback,useState } from 'react';

interface PrbExemption {
  id: string;
  mrn: string;
  nokartu: string | null;
  nama_pasien: string | null;
  alasan_exempt: string;
  dpjp: string | null;
  tanggal_exempt: string | null;
  berlaku_sampai: string | null;
  created_at: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

const emptyForm = { mrn: '', nokartu: '', nama_pasien: '', alasan_exempt: '', dpjp: '', tanggal_exempt: '', berlaku_sampai: '' };

function isExpired(berlakuSampai: string | null) {
  if (!berlakuSampai) return false;
  return new Date(berlakuSampai) < new Date(new Date().toDateString());
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <Skeleton className="h-7 w-56 rounded-md" />
        <Skeleton className="mt-2 h-4 w-96 rounded-md" />
      </div>
      <Card className="p-4 md:p-5">
        <Skeleton className="h-64 w-full rounded-md" />
      </Card>
    </div>
  );
}

export default function PrbExemptPage() {
  // Fitur Exempt PRB dinonaktifkan sementara (8 Sep 2026, permintaan user) —
  // data/tabel prb_exemption_list TIDAK dihapus, cuma UI-nya ditutup total
  // (roles: [] berarti tidak ada role yang lolos, semua diarahkan ke
  // /dashboard). Hapus baris ini & kembalikan ke ['admin'] untuk mengaktifkan lagi.
  const { checking, allowed } = useRequireRole([]);
  const [items, setItems] = useState<PrbExemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<PrbExemption | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setLoading(true); const d = await api.getPrbExemptions<{exemptions: PrbExemption[]}>(); setItems(d.exemptions); }
    catch (err) { console.error('[PrbExempt] Gagal memuat data:', err); }
    finally { setLoading(false); }
  }, []);

  useDeferredEffect(() => { if (allowed) load(); }, [allowed, load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      if (editItem) await api.updatePrbExemption(editItem.id, form);
      else await api.createPrbExemption(form);
      setShowModal(false); setEditItem(null); setForm(emptyForm);
      load();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Gagal menyimpan'); }
  };

  const handleEdit = (item: PrbExemption) => {
    setEditItem(item);
    setForm({
      mrn: item.mrn, nokartu: item.nokartu || '', nama_pasien: item.nama_pasien || '',
      alasan_exempt: item.alasan_exempt, dpjp: item.dpjp || '',
      tanggal_exempt: item.tanggal_exempt?.slice(0, 10) || '', berlaku_sampai: item.berlaku_sampai?.slice(0, 10) || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (item: PrbExemption) => {
    if (!confirm(`Hapus data exempt untuk MRN ${item.mrn} (${item.nama_pasien || '-'})? RV-15 akan kembali aktif untuk pasien ini setelah Scan Ulang berikutnya.`)) return;
    try { await api.deletePrbExemption(item.id); load(); }
    catch (err) { console.error('[PrbExempt] Gagal menghapus:', err); }
  };

  const openCreateModal = () => { setEditItem(null); setForm(emptyForm); setShowModal(true); };

  if (checking || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }
  if (loading) return <LoadingSkeleton />;

  return (
    <motion.div
      className="space-y-4 md:space-y-5"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Header
        title="Exempt PRB"
        description={`${items.length} pasien dikecualikan dari RV-15 (Program Rujuk Balik)`}
        actions={<Button onClick={openCreateModal}>+ Tambah Pasien Exempt</Button>}
      />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-foreground">
        Pasien kronis stabil &ge;3 bulan berturut wajib dialihkan ke Program Rujuk Balik (RV-15) — kecuali terdaftar di sini (mis. komplikasi berat, komorbid). Perubahan di halaman ini baru terlihat di klaim yang sudah ada setelah <strong>Scan Ulang Episode</strong> dijalankan di halaman Riwayat Upload.
      </div>

      <Card className="p-0 overflow-hidden">
        <Table className="table-zebra">
          <TableHeader>
            <TableRow>
              <TableHead>MRN</TableHead>
              <TableHead>Nama Pasien</TableHead>
              <TableHead>Alasan Exempt</TableHead>
              <TableHead>DPJP</TableHead>
              <TableHead>Berlaku Sampai</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
            <AnimatePresence>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <HeartPulse className="h-8 w-8 text-muted-foreground/50" />
                      Belum ada pasien yang dikecualikan dari RV-15
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {items.map((item) => (
                <motion.tr
                  key={item.id}
                  variants={rowVariants}
                  layout
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                  className="hover:bg-muted/50 border-b transition-colors last:border-0"
                >
                  <TableCell className="font-mono text-xs">{item.mrn}</TableCell>
                  <TableCell className="font-medium text-foreground">{item.nama_pasien || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={item.alasan_exempt}>{item.alasan_exempt}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.dpjp || '-'}</TableCell>
                  <TableCell>
                    {item.berlaku_sampai ? (
                      <Badge variant={isExpired(item.berlaku_sampai) ? 'destructive' : 'secondary'}>
                        {new Date(item.berlaku_sampai).toLocaleDateString('id-ID')}
                        {isExpired(item.berlaku_sampai) && ' (kadaluarsa)'}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Permanen</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="icon-sm" onClick={() => handleEdit(item)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline" size="icon-sm" onClick={() => handleDelete(item)} title="Hapus"
                        className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>
          </motion.tbody>
        </Table>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Pasien Exempt' : 'Tambah Pasien Exempt PRB'}</DialogTitle>
          </DialogHeader>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mrn">MRN</Label>
              <Input id="mrn" value={form.mrn} onChange={(e) => setForm({ ...form, mrn: e.target.value })} required disabled={!!editItem} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nokartu">No. Kartu BPJS</Label>
              <Input id="nokartu" value={form.nokartu} onChange={(e) => setForm({ ...form, nokartu: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nama_pasien">Nama Pasien</Label>
              <Input id="nama_pasien" value={form.nama_pasien} onChange={(e) => setForm({ ...form, nama_pasien: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alasan_exempt">Alasan Exempt</Label>
              <Input
                id="alasan_exempt" value={form.alasan_exempt}
                onChange={(e) => setForm({ ...form, alasan_exempt: e.target.value })}
                placeholder="mis. Komplikasi berat, komorbid ganda" required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dpjp">DPJP</Label>
              <Input id="dpjp" value={form.dpjp} onChange={(e) => setForm({ ...form, dpjp: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tanggal_exempt">Tanggal Exempt</Label>
                <Input id="tanggal_exempt" type="date" value={form.tanggal_exempt} onChange={(e) => setForm({ ...form, tanggal_exempt: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="berlaku_sampai">Berlaku Sampai</Label>
                <Input id="berlaku_sampai" type="date" value={form.berlaku_sampai} onChange={(e) => setForm({ ...form, berlaku_sampai: e.target.value })} />
                <p className="text-[11px] text-muted-foreground">Kosongkan untuk permanen</p>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Batal</Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
