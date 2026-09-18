'use client';
// Rekap Pending BPJS (item 9, versi Excel) — halaman ini cuma daftar FILE
// yang sudah diimpor (satu baris = satu file Excel rekap bulanan, seperti
// Riwayat Upload). Isi per-baris klaim + filter/pencarian ada di halaman
// detail [fileId]/page.tsx setelah file diklik.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, type Variants } from 'framer-motion';
import {
  UploadCloud, FileSpreadsheet, ChevronLeft, ChevronRight, ClipboardList, ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Header } from '@/components/dashboard/header';
import { ToastContainer, useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface PendingFile {
  id: string;
  file_name: string;
  total_rows: number;
  imported_rows: number;
  skipped_duplicate: number;
  matched_claim: number;
  created_at: string;
  draft_count: number;
  dikirim_count: number;
  diterima_count: number;
  ditolak_count: number;
}

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

const LIMIT = 20;

export default function PendingBpjsFilesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getPendingFiles({ page, limit: LIMIT });
      setFiles(res.files || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('[PendingBpjsFiles] gagal memuat:', err);
      addToast('Gagal memuat daftar file rekap pending.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadFiles(); }, [loadFiles]); // eslint-disable-line react-hooks/set-state-in-effect

  const handleImport = async (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      addToast('Hanya file Excel (.xlsx/.xls) yang diperbolehkan.', 'error');
      return;
    }
    setImporting(true);
    try {
      const res = await api.importPendingXlsx(file);
      if (!res.file_id) {
        addToast(
          `Semua ${res.total_rows} baris di file ini sudah pernah diimpor sebelumnya — tidak ada file baru dibuat.`,
          'info'
        );
        return;
      }
      addToast(
        `Impor selesai: ${res.imported} baris baru ditambahkan${res.matched_claim ? `, ${res.matched_claim} cocok dengan klaim di sistem` : ''}${res.skipped_duplicate ? `, ${res.skipped_duplicate} baris duplikat dilewati` : ''} (dari ${res.total_rows} baris total).`,
        'success'
      );
      router.push(`/pending-bpjs/${res.file_id}`);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal mengimpor file.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <motion.div className="space-y-4 md:space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <Header
        title="Rekap Pending BPJS"
        description={`${total} file rekap telah diimpor`}
        actions={
          <>
            <input
              ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden
              onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0]); e.target.value = ''; }}
            />
            <Button onClick={() => !importing && fileInputRef.current?.click()} disabled={importing} className="gap-2">
              <UploadCloud className="size-4" />
              {importing ? 'Mengimpor...' : 'Import Rekap Excel'}
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex border-b border-border px-4 py-3 gap-6">
            {['Nama File', 'Total', 'Cocok', 'Status', 'Diimpor'].map((h) => (
              <Skeleton key={h} className="h-3.5 w-16" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-border px-4 py-3.5 last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="size-7 text-muted-foreground" />
            </div>
            <h3 className="font-display text-base font-semibold text-foreground">Belum ada rekap pending</h3>
            <p className="text-sm text-muted-foreground">Import file Excel rekap pending BPJS bulanan untuk memulai.</p>
            <Button onClick={() => fileInputRef.current?.click()} className="mt-2 gap-2" disabled={importing}>
              <UploadCloud className="size-4" />
              Import Sekarang
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nama File</TableHead>
                <TableHead className="text-right">Total Baris</TableHead>
                <TableHead className="text-right">Cocok Klaim</TableHead>
                <TableHead>Ringkasan Status</TableHead>
                <TableHead>Diimpor</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map(f => (
                <TableRow key={f.id} className="cursor-pointer" onClick={() => router.push(`/pending-bpjs/${f.id}`)}>
                  <TableCell className="max-w-[260px] font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate" title={f.file_name}>{f.file_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono-data text-right">{f.imported_rows}</TableCell>
                  <TableCell className="font-mono-data text-right text-primary font-medium">{f.matched_claim}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {f.draft_count > 0 && <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px]">Draft {f.draft_count}</Badge>}
                      {f.dikirim_count > 0 && <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 text-[10px]">Dikirim {f.dikirim_count}</Badge>}
                      {f.diterima_count > 0 && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">Diterima {f.diterima_count}</Badge>}
                      {f.ditolak_count > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">Ditolak {f.ditolak_count}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString('id-ID')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" className="gap-1.5" onClick={(e) => { e.stopPropagation(); router.push(`/pending-bpjs/${f.id}`); }}>
                      Lihat Isi <ArrowRight className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="size-4" /> Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">Halaman {page} dari {totalPages}</span>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Selanjutnya <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </motion.div>
  );
}
