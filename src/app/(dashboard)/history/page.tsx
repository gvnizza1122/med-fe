'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { FileText, FolderOpen, Trash2, Upload, X, ChevronLeft, ChevronRight, ScanSearch, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Header } from '@/components/dashboard/header';
import { ToastContainer, useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ClaimFile {
  id: string; file_name: string; period: string; status: string;
  total_records: number; valid_count: number; error_count: number; pending_count: number;
  created_at: string; uploaded_by_name: string; jenis_klaim?: string | null;
  sep?: string | null; nama_pasien?: string | null;
}

const JENIS_KLAIM_LABELS: Record<string, string> = {
  RAWAT_JALAN: 'Rawat Jalan',
  RAWAT_INAP: 'Rawat Inap',
  GAWAT_DARURAT: 'IGD / Gawat Darurat',
};
const jenisKlaimLabel = (v?: string | null) => (v && JENIS_KLAIM_LABELS[v]) || '-';

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

// Maps backend status to a visual treatment: green (valid/approved), red (error), amber (in progress)
const statusBadgeClass = (s: string) => {
  if (s === 'completed' || s === 'approved') {
    return 'bg-primary/10 text-primary border-primary/20';
  }
  if (s === 'error') {
    return 'bg-destructive/10 text-destructive border-destructive/20';
  }
  // validating, parsing, pending, etc.
  return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400';
};

export default function HistoryPage() {
  const router = useRouter();
  const [files, setFiles] = useState<ClaimFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [jenisKlaimFilter, setJenisKlaimFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();
  const [scanPeriode, setScanPeriode] = useState('');
  const [scanning, setScanning] = useState(false);

  // RV-13/15/16 (episode konsul internal, PRB, iterasi obat kronis) cuma
  // otomatis nyala saat file BARU diupload — kalau pola barunya muncul dari
  // kombinasi file LAMA yang sudah lebih dulu ada, harus di-scan ulang manual.
  const handleScanEpisodes = async () => {
    if (!scanPeriode) { addToast('Pilih periode bulan dulu.', 'error'); return; }
    const [year, month] = scanPeriode.split('-');
    setScanning(true);
    try {
      const res = await api.scanEpisodes(`${month}/${year}`);
      addToast(`Scan selesai — ${res.pasien_discan} pasien dicek ulang untuk periode ${month}/${year}.`, 'success');
      loadFiles();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Scan ulang gagal.', 'error');
    } finally {
      setScanning(false);
    }
  };

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const d = await api.getFiles(page, 15, jenisKlaimFilter || undefined, fromDate || undefined, toDate || undefined, search || undefined);
      setFiles(d.files); setTotal(d.total);
    } catch (err) { console.error('[History] Gagal memuat file:', err); } finally { setLoading(false); }
  }, [page, jenisKlaimFilter, fromDate, toDate, search]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // Debounce input pencarian nama pasien/SEP supaya tidak request per-ketikan.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleDelete = async (id: string) => {
    try { await api.deleteFile(id); loadFiles(); } catch (err) { console.error('[History] Gagal hapus file:', err); }
  };

  const totalPages = Math.ceil(total / 15);
  const hasActiveFilters = Boolean(jenisKlaimFilter || fromDate || toDate || searchInput);

  return (
    <motion.div
      className="space-y-4 md:space-y-6"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <Header
        title="Riwayat Upload"
        description={`${total} file telah diupload`}
        actions={
          <Button onClick={() => router.push('/extract')} className="gap-2">
            <Upload className="size-4" />
            Upload Baru
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 md:p-4 animate-slide-in-up">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cari Nama Pasien / SEP</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari nama pasien atau nomor SEP..."
              className="w-full pl-8 sm:w-[240px]"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Kategori</label>
          <Select
            value={jenisKlaimFilter || 'ALL'}
            onValueChange={(v) => { setJenisKlaimFilter(v === 'ALL' ? '' : v); setPage(1); }}
          >
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kategori</SelectItem>
              {Object.entries(JENIS_KLAIM_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Dari</label>
          <DatePicker
            className="sm:w-[160px]"
            value={fromDate}
            max={toDate || undefined}
            onChange={(v) => { setFromDate(v); setPage(1); }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Sampai</label>
          <DatePicker
            className="sm:w-[160px]"
            value={toDate}
            min={fromDate || undefined}
            onChange={(v) => { setToDate(v); setPage(1); }}
          />
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => { setJenisKlaimFilter(''); setFromDate(''); setToDate(''); setSearchInput(''); setPage(1); }}
          >
            <X className="size-3.5" />
            Reset Filter
          </Button>
        )}

        <div className="ml-auto flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Scan Ulang Episode (RV-13/15/16)</label>
          <div className="flex gap-2">
            <Input
              type="month"
              className="w-[150px]"
              value={scanPeriode}
              onChange={e => setScanPeriode(e.target.value)}
            />
            <Button type="button" variant="secondary" size="default" className="gap-1.5" onClick={handleScanEpisodes} disabled={scanning}>
              <ScanSearch className="size-3.5" />
              {scanning ? 'Memindai...' : 'Scan Ulang'}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="size-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {files.length === 0 ? (
            <motion.div
              key="empty"
              variants={emptyVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
              className="rounded-xl border border-border bg-card"
            >
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <motion.div
                  className="flex size-16 items-center justify-center rounded-full bg-muted"
                  animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' as const }}
                >
                  <FolderOpen className="size-7 text-muted-foreground" />
                </motion.div>
                <h3 className="text-base font-semibold text-foreground">Belum ada file</h3>
                <p className="text-sm text-muted-foreground">Upload file klaim untuk memulai validasi</p>
                <Button onClick={() => router.push('/extract')} className="mt-2 gap-2">
                  <Upload className="size-4" />
                  Upload Sekarang
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.3 } }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>SEP</TableHead>
                    <TableHead>Nama Pasien</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Valid</TableHead>
                    <TableHead className="text-right">Error</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Diunggah</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
                  <AnimatePresence>
                    {files.map((f, i) => (
                      <motion.tr
                        key={f.id}
                        variants={rowVariants}
                        layout
                        whileHover={{
                          backgroundColor: 'var(--muted)',
                          transition: { duration: 0.15 },
                        }}
                        exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                        className="border-b border-border last:border-0"
                      >
                        <TableCell className="max-w-[160px] truncate font-mono text-xs text-foreground" title={f.file_name}>
                          {f.sep || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{f.nama_pasien || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {f.jenis_klaim ? (
                            <Badge variant="secondary" className="whitespace-nowrap text-[10px]">
                              {jenisKlaimLabel(f.jenis_klaim)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{f.period || '-'}</TableCell>
                        <TableCell className="text-right">{f.total_records}</TableCell>
                        <TableCell className="text-right font-medium text-primary">{f.valid_count}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">{f.error_count}</TableCell>
                        <TableCell>
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.03 + 0.15, type: 'spring', stiffness: 300, damping: 20 }}
                            whileHover={{ scale: 1.08 }}
                            className="inline-block"
                          >
                            <Badge variant="outline" className={statusBadgeClass(f.status)}>
                              {statusLabel(f.status)}
                            </Badge>
                          </motion.span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{f.uploaded_by_name}</div>
                          <div>{new Date(f.created_at).toLocaleDateString('id-ID')}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => router.push(`/results/${f.id}`)}
                            >
                              <FileText className="size-3.5" />
                              Detail
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => setPendingDeleteId(f.id)}
                              aria-label="Hapus file"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </motion.tbody>
              </Table>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {totalPages > 1 && (
          <motion.div
            className="flex items-center justify-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
              Sebelumnya
            </Button>
            <AnimatePresence mode="wait">
              <motion.span
                key={page}
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
              >
                Halaman {page} dari {totalPages}
              </motion.span>
            </AnimatePresence>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Selanjutnya
              <ChevronRight className="size-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={pendingDeleteId !== null} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus file ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. File beserta seluruh data klaim terkait akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (pendingDeleteId) handleDelete(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </motion.div>
  );
}
