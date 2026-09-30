'use client';
// Daftar klaim pending hasil alur otomatis (SEP tertaut + alasan terpetakan +
// triase terhitung) — lihat src/app/(dashboard)/pending-jawaban/page.tsx untuk
// tombol yang menjalankan proses itu. Halaman ini murni menampilkan &
// menyaring hasilnya, lalu membuka detail per klaim di /item/[pendingId].
//
// Field `sep`/`nama_peserta` pada baris tabel adalah ASUMSI (kontrak API
// /daftar cuma menjamin id, kategori, jenis_rawat, kotak, draft_id,
// status_draft) — dibuat opsional dan ada fallback tampilan supaya tidak
// merusak render kalau backend ternyata tidak mengirimkannya. Perlu
// dikonfirmasi ke tim backend saat data asli sudah ada.
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, type Variants } from 'framer-motion';
import {
  Search, X, ChevronLeft, ChevronRight, ArrowLeft, ClipboardList, FileQuestion,
} from 'lucide-react';
import { api, type PendingJawabanItemRingkas } from '@/lib/api';
import { Header } from '@/components/dashboard/header';
import { ToastContainer, useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface PendingFileOption { id: string; file_name: string; }

const KOTAK_LABEL: Record<string, string> = {
  A: 'A — Bisa Dijawab',
  B: 'B — Butuh Dokumen',
  C: 'C — Revisi Koding',
  D: 'D — Tidak Dipertahankan',
  belum: 'Belum Diklasifikasi',
};
const KOTAK_BADGE_CLASS: Record<string, string> = {
  A: 'bg-primary/10 text-primary border-primary/20',
  B: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
  C: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  D: 'bg-destructive/10 text-destructive border-destructive/20',
};

const STATUS_DRAFT_LABEL: Record<string, string> = {
  draft: 'Draf', siap: 'Siap Kirim', ditolak: 'Ditolak', belum_ada: 'Belum Ada Draf',
};
const statusDraftBadgeClass = (s: string) => {
  if (s === 'siap') return 'bg-primary/10 text-primary border-primary/20';
  if (s === 'ditolak') return 'bg-destructive/10 text-destructive border-destructive/20';
  if (s === 'draft') return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400';
  return 'bg-muted text-muted-foreground border-border';
};

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

const LIMIT = 20;

export default function PendingJawabanDaftarPage() {
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();

  const [files, setFiles] = useState<PendingFileOption[]>([]);
  const [fileId, setFileId] = useState('');
  const [kategoriOptions, setKategoriOptions] = useState<string[]>([]);

  const [items, setItems] = useState<PendingJawabanItemRingkas[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [kotakFilter, setKotakFilter] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [jenisFilter, setJenisFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getPendingFiles({ page: 1, limit: 100 });
        setFiles((res.files || []).map((f: { id: string; file_name: string }) => ({ id: f.id, file_name: f.file_name })));
      } catch (err) {
        console.error('[PendingJawabanDaftar] gagal memuat daftar file:', err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getRingkasanAlasanPending({ pending_file_id: fileId || undefined });
        setKategoriOptions((res.per_kategori || []).map(k => k.kategori));
      } catch (err) {
        console.error('[PendingJawabanDaftar] gagal memuat kategori:', err);
      }
    })();
  }, [fileId]);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getDaftarPendingJawaban({
        pending_file_id: fileId || undefined,
        kotak: kotakFilter || undefined,
        kategori: kategoriFilter || undefined,
        jenis_rawat: jenisFilter || undefined,
        status_draft: statusFilter || undefined,
        search: search || undefined,
        page, limit: LIMIT,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (err: unknown) {
      console.error('[PendingJawabanDaftar] gagal memuat daftar:', err);
      addToast(err instanceof Error ? err.message : 'Gagal memuat daftar klaim.', 'error');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [fileId, kotakFilter, kategoriFilter, jenisFilter, statusFilter, search, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadItems(); }, [loadItems]); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.ceil(total / LIMIT);
  const hasActiveFilters = Boolean(kotakFilter || kategoriFilter || jenisFilter || statusFilter || searchInput);

  const resetFilters = () => {
    setKotakFilter(''); setKategoriFilter(''); setJenisFilter(''); setStatusFilter('');
    setSearchInput(''); setSearch(''); setPage(1);
  };

  return (
    <motion.div className="space-y-4 md:space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <Header
        title="Daftar Klaim Pending"
        description={`${total} klaim pending sesuai filter saat ini`}
        actions={
          <Button variant="secondary" className="gap-2" onClick={() => router.push('/pending-jawaban')}>
            <ArrowLeft className="size-4" />
            Kembali ke Ringkasan
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 md:p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">File Rekap</label>
          <Select value={fileId || 'ALL'} onValueChange={(v) => { setFileId(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Semua file" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua File</SelectItem>
              {files.map(f => <SelectItem key={f.id} value={f.id}>{f.file_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Kotak Triase</label>
          <Select value={kotakFilter || 'ALL'} onValueChange={(v) => { setKotakFilter(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[190px]"><SelectValue placeholder="Semua Kotak" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kotak</SelectItem>
              {(['A', 'B', 'C', 'D', 'belum'] as const).map(k => (
                <SelectItem key={k} value={k}>{KOTAK_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Kategori</label>
          <Select value={kategoriFilter || 'ALL'} onValueChange={(v) => { setKategoriFilter(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kategori</SelectItem>
              {kategoriOptions.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Jenis Rawat</label>
          <Select value={jenisFilter || 'ALL'} onValueChange={(v) => { setJenisFilter(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Semua Jenis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Jenis</SelectItem>
              <SelectItem value="RJ">Rawat Jalan</SelectItem>
              <SelectItem value="RI">Rawat Inap</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status Draf</label>
          <Select value={statusFilter || 'ALL'} onValueChange={(v) => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Semua Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              {Object.entries(STATUS_DRAFT_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cari</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text" placeholder="Nama peserta / SEP..."
              className="w-full pl-8 sm:w-[200px]"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={resetFilters}>
            <X className="size-3.5" /> Reset Filter
          </Button>
        )}
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex border-b border-border px-4 py-3 gap-6">
            {['Nama/SEP', 'Kategori', 'Jenis', 'Kotak', 'Status Draf'].map((h) => (
              <Skeleton key={h} className="h-3.5 w-16" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-border px-4 py-3.5 last:border-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="size-7 text-muted-foreground" />
            </div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {hasActiveFilters ? 'Tidak ada klaim yang cocok' : 'Belum ada klaim pending terproses'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {hasActiveFilters
                ? 'Coba ubah pencarian atau filter di atas.'
                : 'Jalankan tautkan SEP, petakan alasan, dan hitung triase dulu di halaman Ringkasan.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nama Peserta / SEP</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Kotak</TableHead>
                <TableHead>Status Draf</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/pending-jawaban/item/${item.id}`)}>
                  <TableCell className="max-w-[220px] truncate font-medium">
                    {item.nama_peserta || item.sep || (
                      <span className="text-muted-foreground/60 font-mono-data text-xs">{item.id}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground" title={item.kategori || undefined}>
                    {item.kategori || <span className="text-muted-foreground/60">Belum dipetakan</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {item.jenis_rawat === 'RI' ? 'Rawat Inap' : item.jenis_rawat === 'RJ' ? 'Rawat Jalan' : '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.kotak ? (
                      <Badge variant="outline" className={`text-[10px] ${KOTAK_BADGE_CLASS[item.kotak] || ''}`}>{item.kotak}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
                        <FileQuestion className="mr-1 size-3" />Belum
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${statusDraftBadgeClass(item.status_draft)}`}>
                      {STATUS_DRAFT_LABEL[item.status_draft] || item.status_draft}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/pending-jawaban/item/${item.id}`); }}>
                      Lihat Detail
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
