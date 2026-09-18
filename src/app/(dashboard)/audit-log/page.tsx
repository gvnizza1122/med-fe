'use client';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/useRequireRole';
import { Header } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// Label manusiawi untuk tiap action yang ada di kode (lihat logAudit() calls
// di backend) — action baru yang belum ada di sini tetap tampil (fallback ke
// nama mentahnya), tidak disembunyikan.
const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  upload_and_validate: 'Upload & Validasi Klaim',
  approve: 'Setujui Klaim',
  callback_success: 'Callback vClaim Berhasil',
  callback_failure: 'Callback vClaim Gagal',
  export: 'Export Klaim',
  ai_audit: 'AI Audit',
  delete: 'Hapus Klaim',
  bulk_delete: 'Hapus Massal Klaim',
  bulk_delete_by_user: 'Hapus Massal (per User)',
  validate_pdf: 'Validasi PDF',
  create_prb_exemption: 'Tambah Exempt PRB',
  update_prb_exemption: 'Ubah Exempt PRB',
  delete_prb_exemption: 'Hapus Exempt PRB',
  create_user: 'Buat User',
  deactivate_user: 'Nonaktifkan User',
};

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-muted text-muted-foreground border-transparent',
  delete: 'bg-destructive/10 text-destructive border-destructive/20',
  bulk_delete: 'bg-destructive/10 text-destructive border-destructive/20',
  bulk_delete_by_user: 'bg-destructive/10 text-destructive border-destructive/20',
  delete_prb_exemption: 'bg-destructive/10 text-destructive border-destructive/20',
  deactivate_user: 'bg-destructive/10 text-destructive border-destructive/20',
  callback_failure: 'bg-destructive/10 text-destructive border-destructive/20',
  approve: 'bg-primary/10 text-primary border-primary/20',
  create_user: 'bg-primary/10 text-primary border-primary/20',
  create_prb_exemption: 'bg-primary/10 text-primary border-primary/20',
  callback_success: 'bg-primary/10 text-primary border-primary/20',
};

const actionLabel = (a: string) => ACTION_LABELS[a] || a;
const actionColor = (a: string) => ACTION_COLORS[a] || 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400';

// "Hapus Massal Klaim" (bulk_delete) menaruh SEMUA id klaim yang dihapus jadi
// satu string koma di resource_id (lihat resourceId: ids.join(',') di backend,
// routes/claimFiles.js) -- bisa 300+ UUID / ribuan karakter kalau bulk delete
// besar. Utk aksi non-bulk, resource_id cuma 1 id pendek; split koma tetap
// aman (hasil array 1 elemen). BULK_RESOURCE_THRESHOLD dari heuristik (bukan
// dari backend) -- >5 item dianggap "daftar panjang" yang butuh diringkas.
const BULK_RESOURCE_THRESHOLD = 5;
function parseResourceIds(resourceId: string | null): string[] {
  if (!resourceId) return [];
  return resourceId.split(',').map(s => s.trim()).filter(Boolean);
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

function LoadingSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex border-b border-border px-4 py-3 gap-6">
        {['Waktu', 'User', 'Aksi', 'Resource', 'IP'].map((h) => (
          <Skeleton key={h} className="h-3.5 w-16" />
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-border px-4 py-3.5 last:border-0">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function AuditLogPage() {
  const { checking, allowed } = useRequireRole(['superadmin', 'admin']);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userEmailInput, setUserEmailInput] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  // Modal "Lihat daftar lengkap" utk RESOURCE bulk (lihat parseResourceIds).
  const [resourceListDialog, setResourceListDialog] = useState<{ label: string; ids: string[] } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setUserEmail(userEmailInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [userEmailInput]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const d = await api.getAuditLogs(page, 30, {
        user_email: userEmail || undefined,
        action: actionFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setLogs(d.logs);
      setTotal(d.total);
      setAvailableActions(d.available_actions || []);
    } catch (err) {
      console.error('[AuditLog] Gagal memuat:', err);
    } finally {
      setLoading(false);
    }
  }, [page, userEmail, actionFilter, fromDate, toDate]);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  if (checking || !allowed) return null;

  const totalPages = Math.ceil(total / 30);
  const hasActiveFilters = !!(userEmail || actionFilter || fromDate || toDate);

  return (
    <div className="space-y-4">
      <Header title="Audit Log" description="Riwayat aktivitas semua user di sistem — siapa melakukan apa, kapan." />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
          <label className="text-xs font-medium text-muted-foreground">Cari Email User</label>
          <Input
            placeholder="mis. admin@rslestari.id"
            value={userEmailInput}
            onChange={e => setUserEmailInput(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Aksi</label>
          <Select
            value={actionFilter || 'ALL'}
            onValueChange={(v) => { setActionFilter(v === 'ALL' ? '' : v); setPage(1); }}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Semua Aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Aksi</SelectItem>
              {availableActions.map((a) => (
                <SelectItem key={a} value={a}>{actionLabel(a)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Dari</label>
          <DatePicker className="sm:w-[160px]" value={fromDate} max={toDate || undefined} onChange={(v) => { setFromDate(v); setPage(1); }} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Sampai</label>
          <DatePicker className="sm:w-[160px]" value={toDate} min={fromDate || undefined} onChange={(v) => { setToDate(v); setPage(1); }} />
        </div>

        {hasActiveFilters && (
          <Button
            type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"
            onClick={() => { setUserEmailInput(''); setUserEmail(''); setActionFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
          >
            <X className="size-3.5" />
            Reset Filter
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <ScrollText className="size-7 text-muted-foreground" />
            </div>
            <h3 className="font-display text-base font-semibold text-foreground">Belum ada aktivitas</h3>
            <p className="text-sm text-muted-foreground">Tidak ada log yang cocok dengan filter saat ini.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Waktu</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
              <AnimatePresence>
                {logs.map((l) => (
                  <motion.tr
                    key={l.id}
                    variants={rowVariants}
                    className="border-b border-border last:border-0"
                  >
                    <TableCell className="font-mono-data text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-foreground" title={l.user_email || undefined}>
                      {l.user_email || <span className="text-muted-foreground italic">sistem</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={actionColor(l.action)}>
                        {actionLabel(l.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                      {l.resource_type ? (() => {
                        const ids = parseResourceIds(l.resource_id);
                        // Bulk action (mis. Hapus Massal Klaim) -- ringkas jadi
                        // "N klaim" + tombol modal, jangan taruh ratusan UUID
                        // mentah langsung di sel tabel (berat & sulit dibaca).
                        if (ids.length > BULK_RESOURCE_THRESHOLD) {
                          return (
                            <span className="flex items-center gap-1.5">
                              <span className="text-foreground">{l.resource_type}</span>
                              <span>· {ids.length} klaim</span>
                              <button
                                type="button"
                                className="shrink-0 text-blue-600 hover:underline dark:text-blue-400"
                                onClick={() => setResourceListDialog({ label: actionLabel(l.action), ids })}
                              >
                                Lihat daftar lengkap
                              </button>
                            </span>
                          );
                        }
                        // Resource pendek (bukan bulk action) -- tampilan lama, tidak diubah.
                        return (
                          <span className="block truncate" title={l.resource_id || undefined}>
                            <span className="text-foreground">{l.resource_type}</span>
                            {l.resource_id && <span className="font-mono-data"> · {l.resource_id}</span>}
                          </span>
                        );
                      })() : '-'}
                    </TableCell>
                    <TableCell className="font-mono-data text-xs text-muted-foreground">
                      {l.ip_address || '-'}
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </motion.tbody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Menampilkan {(page - 1) * 30 + 1}-{Math.min(page * 30, total)} dari {total} log
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Halaman {page} dari {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Modal "Lihat daftar lengkap" utk RESOURCE bulk (Tugas 5) ─── */}
      <Dialog open={!!resourceListDialog} onOpenChange={(open) => !open && setResourceListDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{resourceListDialog?.label} — {resourceListDialog?.ids.length} klaim</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border">
            <ul className="divide-y divide-border">
              {resourceListDialog?.ids.map((id) => (
                <li key={id} className="px-3 py-1.5 font-mono-data text-xs text-muted-foreground">{id}</li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
