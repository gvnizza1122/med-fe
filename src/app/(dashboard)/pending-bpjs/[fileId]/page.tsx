'use client';
// Isi satu file rekap pending BPJS (item 9, versi Excel) — koder cari/filter
// baris klaim pending di file ini, minta AI generate draft klarifikasi
// (dengan few-shot dari kasus serupa yang sudah disetujui BPJS, lihat
// ai_training_examples di backend), edit draft, tandai dikirim, lalu setelah
// BPJS balas tandai diterima/ditolak. Draft yang diterima otomatis jadi
// "memori" AI untuk kasus berikutnya.
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, type Variants } from 'framer-motion';
import {
  Search, X, ChevronLeft, ChevronRight, Sparkles, ArrowLeft,
  Send, CheckCircle2, XCircle, FileQuestion, ClipboardList,
} from 'lucide-react';
import { api } from '@/lib/api';
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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';

interface PendingItem {
  id: string;
  claim_record_id: string | null;
  claim_file_id: string | null;
  sep: string | null;
  mrn: string | null;
  nokartu: string | null;
  nama_peserta: string | null;
  kdinacbg: string | null;
  by_pengajuan: number | null;
  tanggal_pending: string | null;
  tgl_pulang: string | null;
  alasan_raw: string;
  jawaban_rs_manual: string | null;
  alasan_parsed: { kategori?: string; detail?: string; field?: string[]; checklist_dokumen_pendukung?: string[] } | null;
  draft_klarifikasi: string | null;
  status: string;
  outcome: string | null;
  source: string;
  jenis_klaim: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', dikirim: 'Sudah Dikirim', diterima: 'Diterima', ditolak: 'Ditolak',
};
const statusBadgeClass = (s: string) => {
  if (s === 'diterima') return 'bg-primary/10 text-primary border-primary/20';
  if (s === 'ditolak') return 'bg-destructive/10 text-destructive border-destructive/20';
  if (s === 'dikirim') return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400';
  return 'bg-muted text-muted-foreground border-border';
};

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

const LIMIT = 20;

export default function PendingBpjsFileDetailPage() {
  const router = useRouter();
  const params = useParams();
  const fileId = String(params.fileId);

  const [items, setItems] = useState<PendingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  // Langsung tampilkan semua data saat buka halaman ini
  const [hasQueried, setHasQueried] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [jenisFilter, setJenisFilter] = useState('');
  const [active, setActive] = useState<PendingItem | null>(null);
  const [generating, setGenerating] = useState(false);
  const [poinKunci, setPoinKunci] = useState('');
  const { toasts, addToast, removeToast } = useToast();

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getPendingList({
        pending_file_id: fileId,
        page, limit: LIMIT,
        status: statusFilter || undefined,
        jenis_klaim: jenisFilter || undefined,
        search: search || undefined,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('[PendingBpjsDetail] gagal memuat:', err);
      addToast('Gagal memuat isi rekap pending.', 'error');
    } finally {
      setLoading(false);
    }
  }, [fileId, page, statusFilter, jenisFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (hasQueried) loadItems(); }, [hasQueried, loadItems]); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    if (!hasQueried && !searchInput) return;
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
      if (searchInput.trim()) setHasQueried(true);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = (item: PendingItem) => {
    setActive(item);
    setPoinKunci('');
    // Langsung buatkan jawaban AI begitu dibuka kalau belum ada — koder tidak
    // perlu klik dulu, jawabannya sudah muncul saat klik baris. Cuma untuk
    // entri yang masih draft (belum dikirim), supaya tidak menimpa histori
    // klaim yang sudah dikirim/diterima/ditolak.
    if (!item.draft_klarifikasi && item.status === 'draft') {
      handleGenerateDraft(item.id);
    }
  };

  const patchActive = (id: string, patch: Partial<PendingItem>) => {
    setActive(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleGenerateDraft = async (id?: string) => {
    const targetId = id || active?.id;
    if (!targetId) return;
    setGenerating(true);
    try {
      const updated = await api.generatePendingDraft(targetId);
      patchActive(targetId, updated);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal membuat jawaban AI.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = async () => {
    if (!active) return;
    try {
      const updated = await api.updateBpjsPendingStatus(active.id, { draft_klarifikasi: active.draft_klarifikasi || '' });
      patchActive(active.id, updated);
      addToast('Jawaban disimpan.', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan jawaban.', 'error');
    }
  };

  const handleMarkSent = async () => {
    if (!active) return;
    try {
      const updated = await api.updateBpjsPendingStatus(active.id, { status: 'dikirim', draft_klarifikasi: active.draft_klarifikasi || '' });
      patchActive(active.id, updated);
      addToast('Ditandai sudah dikirim.', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal menandai dikirim.', 'error');
    }
  };

  const handleOutcome = async (outcome: 'approved' | 'rejected') => {
    if (!active) return;
    try {
      const updated = await api.updateBpjsPendingStatus(active.id, {
        status: outcome === 'approved' ? 'diterima' : 'ditolak',
        outcome,
        draft_klarifikasi: active.draft_klarifikasi || '',
        poin_kunci: poinKunci || undefined,
      });
      patchActive(active.id, updated);
      addToast(outcome === 'approved' ? 'Ditandai diterima BPJS.' : 'Ditandai ditolak BPJS.', outcome === 'approved' ? 'success' : 'error');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan hasil.', 'error');
    }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const hasActiveFilters = Boolean(statusFilter || jenisFilter || searchInput);

  return (
    <motion.div className="space-y-4 md:space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <Header
        title="Isi Rekap Pending BPJS"
        description={hasQueried ? `${total} klaim pending dalam file ini` : 'Cari/filter untuk menampilkan data'}
        actions={
          <Button variant="secondary" className="gap-2" onClick={() => router.push('/pending-bpjs')}>
            <ArrowLeft className="size-4" />
            Kembali ke Daftar File
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 md:p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Cari Nama / SEP</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text" placeholder="Cari nama peserta atau nomor SEP..."
              className="w-full pl-8 sm:w-[240px]"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={statusFilter || 'ALL'} onValueChange={(v) => { setStatusFilter(v === 'ALL' ? '' : v); setPage(1); setHasQueried(true); }}>
            <SelectTrigger className="w-full sm:w-[170px]"><SelectValue placeholder="Semua Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Jenis</label>
          <Select value={jenisFilter || 'ALL'} onValueChange={(v) => { setJenisFilter(v === 'ALL' ? '' : v); setPage(1); setHasQueried(true); }}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Semua Jenis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Jenis</SelectItem>
              <SelectItem value="RJ">Rawat Jalan</SelectItem>
              <SelectItem value="RI">Rawat Inap</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"
            onClick={() => { setStatusFilter(''); setJenisFilter(''); setSearchInput(''); setSearch(''); setPage(1); setItems([]); }}>
            <X className="size-3.5" /> Reset Filter
          </Button>
        )}
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex border-b border-border px-4 py-3 gap-6">
            {['SEP', 'Nama', 'Jenis', 'Alasan', 'Jawaban'].map((h) => (
              <Skeleton key={h} className="h-3.5 w-16" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-border px-4 py-3.5 last:border-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="size-7 text-muted-foreground" />
            </div>
            <h3 className="font-display text-base font-semibold text-foreground">Tidak ada data yang cocok</h3>
            <p className="text-sm text-muted-foreground">Coba ubah pencarian/filter.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table className="table-zebra">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>SEP</TableHead>
                <TableHead>Nama Peserta</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Alasan Pending</TableHead>
                <TableHead>Jawaban</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => openDetail(item)}>
                  <TableCell className="font-mono text-xs">
                    {item.claim_file_id ? (
                      <button
                        type="button"
                        className="text-primary underline-offset-2 hover:underline"
                        title="Buka halaman detail klaim ini"
                        onClick={(e) => {
                          e.stopPropagation();
                          const highlight = (item.alasan_parsed?.field || []).join(',');
                          const params = new URLSearchParams({ sep: item.sep || '' });
                          if (highlight) params.set('highlight', highlight);
                          router.push(`/results/${item.claim_file_id}?${params.toString()}`);
                        }}
                      >
                        {item.sep || '-'}
                      </button>
                    ) : (item.sep || '-')}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate font-medium">{item.nama_peserta || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">{item.jenis_klaim === 'RI' ? 'Rawat Inap' : 'Rawat Jalan'}</Badge>
                    {!item.claim_record_id && (
                      <Badge variant="outline" className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30" title="Klaim belum ditemukan di sistem — belum pernah diupload via Extract PDF">
                        <FileQuestion className="mr-1 size-3" />belum ditemukan
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground text-xs" title={item.alasan_raw}>
                    {item.alasan_raw}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                    {item.jawaban_rs_manual ? (
                      <span title={item.jawaban_rs_manual}>{item.jawaban_rs_manual.substring(0, 50)}...</span>
                    ) : item.draft_klarifikasi ? (
                      <span title={item.draft_klarifikasi}>{item.draft_klarifikasi.substring(0, 50)}...</span>
                    ) : (
                      <span className="text-muted-foreground/60">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" className="gap-1.5" onClick={(e) => { e.stopPropagation(); openDetail(item); }}>
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

      <Sheet open={!!active} onOpenChange={(open) => { if (!open) setActive(null); }}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>Klaim {active.sep || '-'} — {active.nama_peserta || '-'}</SheetTitle>
                <SheetDescription>
                  {active.jenis_klaim === 'RI' ? 'Rawat Inap' : 'Rawat Jalan'} · MR {active.mrn || '-'} · INA-CBG {active.kdinacbg || '-'}
                  {!active.claim_record_id && ' · klaim ini belum ditemukan di sistem (belum diupload via Extract PDF)'}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Alasan Pending (dari BPJS)</p>
                  <p className="text-sm rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap">{active.alasan_raw}</p>
                </div>

                {active.jawaban_rs_manual && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Jawaban RS (sudah diisi di file rekap)</p>
                    <p className="text-sm rounded-md border border-amber-500/30 bg-amber-500/5 p-3 whitespace-pre-wrap">{active.jawaban_rs_manual}</p>
                  </div>
                )}

                {active.alasan_parsed?.detail && (
                  <p className="text-xs text-foreground"><strong>Ringkasan AI:</strong> {active.alasan_parsed.detail}</p>
                )}
                {active.alasan_parsed?.kategori && (
                  <Badge variant="secondary" className="text-[10px]">{active.alasan_parsed.kategori}</Badge>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-muted-foreground">Jawaban</p>
                    <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => handleGenerateDraft()} disabled={generating}>
                      <Sparkles className="size-3.5" />
                      {generating ? 'Membuat jawaban...' : active.draft_klarifikasi ? 'Buat Ulang Jawaban AI' : 'Buat Jawaban AI'}
                    </Button>
                  </div>
                  {generating && !active.draft_klarifikasi ? (
                    <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                      <div className="size-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      AI sedang menyusun jawaban...
                    </div>
                  ) : (
                    <textarea
                      value={active.draft_klarifikasi || ''}
                      onChange={e => patchActive(active.id, { draft_klarifikasi: e.target.value })}
                      rows={8}
                      disabled={active.status === 'diterima' || active.status === 'ditolak'}
                      placeholder="Belum ada jawaban — klik Buat Jawaban AI, atau tulis manual di sini."
                      className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-60"
                    />
                  )}
                  {active.status !== 'diterima' && active.status !== 'ditolak' && (
                    <Button type="button" size="sm" variant="ghost" className="mt-1.5" onClick={saveDraft}>Simpan Jawaban</Button>
                  )}
                </div>
              </div>

              <SheetFooter className="flex-row flex-wrap gap-2">
                <Badge variant="outline" className={statusBadgeClass(active.status)}>{STATUS_LABEL[active.status] || active.status}</Badge>
                {active.status === 'draft' && (
                  <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={handleMarkSent}>
                    <Send className="size-3.5" /> Tandai Sudah Dikirim
                  </Button>
                )}
                {active.status === 'dikirim' && (
                  <>
                    <Input
                      type="text" placeholder="Catatan: argumen yang meyakinkan BPJS (opsional)"
                      className="flex-1 min-w-[180px]" value={poinKunci}
                      onChange={e => setPoinKunci(e.target.value)}
                    />
                    <Button type="button" size="sm" className="gap-1.5" onClick={() => handleOutcome('approved')}>
                      <CheckCircle2 className="size-3.5" /> Diterima
                    </Button>
                    <Button type="button" size="sm" variant="destructive" className="gap-1.5" onClick={() => handleOutcome('rejected')}>
                      <XCircle className="size-3.5" /> Ditolak
                    </Button>
                  </>
                )}
                {active.status === 'diterima' && (
                  <p className="text-xs text-primary">✓ Diterima BPJS — draft ini tersimpan sebagai contoh untuk kasus serupa berikutnya.</p>
                )}
                {active.status === 'ditolak' && (
                  <p className="text-xs text-destructive">✗ Ditolak BPJS.</p>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </motion.div>
  );
}
