'use client';
// Alur Menjawab Pending BPJS (backend /api/v1/pending-jawaban) — dashboard
// ringkasan. Beda dari "Pending BPJS" (import Excel + jawaban manual) di
// /pending-bpjs: alur ini otomatis menautkan SEP ke klaim di sistem,
// mengkategorikan alasan pending, menghitung "kotak" triase A/B/C/D, lalu
// menyiapkan draf jawaban berkutipan yang koder tinggal setujui/tolak.
//
// PENTING: per 1 Okt 2026 tabel rekap pending KOSONG di produksi (belum ada
// data yang lewat alur baru ini), jadi tampilan ini baru bisa diuji terhadap
// kontrak API, belum terhadap data asli. Semua state kosong di bawah akan
// benar-benar terlihat begitu halaman ini dibuka pertama kali di produksi.
//
// Aturan produk: TIDAK PERNAH menampilkan persentase/keyakinan di UI ini.
import { Header } from '@/components/dashboard/header';
import { ToastContainer,useToast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
Empty,
EmptyDescription,
EmptyHeader,EmptyMedia,EmptyTitle,
} from '@/components/ui/empty';
import {
Select,SelectContent,SelectItem,SelectTrigger,SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
Table,TableBody,TableCell,TableHead,TableHeader,TableRow,
} from '@/components/ui/table';
import { api,type KotakTriase,type PendingJawabanAlasanRingkasan,type PendingJawabanStatistik,type PendingJawabanTriaseRingkasan } from '@/lib/api';
import { motion,type Variants } from 'framer-motion';
import {
ArrowRight,
Boxes,
ClipboardList,
Link2,
ListFilter,
RefreshCw,
Tags,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback,useEffect,useState } from 'react';

interface PendingFileOption {
  id: string;
  file_name: string;
}

const KOTAK_INFO: Record<KotakTriase, { label: string; deskripsi: string; className: string }> = {
  A: { label: 'A — Bisa Dijawab', deskripsi: 'Bukti sudah ada di berkas', className: 'bg-primary/10 text-primary border-primary/20' },
  B: { label: 'B — Butuh Dokumen', deskripsi: 'Perlu dokumen tambahan', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
  C: { label: 'C — Revisi Koding', deskripsi: 'Kode perlu direvisi', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
  D: { label: 'D — Tidak Dipertahankan', deskripsi: 'Tidak ada dasar kuat', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function PendingJawabanOverviewPage() {
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();

  const [files, setFiles] = useState<PendingFileOption[]>([]);
  const [fileId, setFileId] = useState<string>('');
  const [loadingFiles, setLoadingFiles] = useState(true);

  const [statistik, setStatistik] = useState<PendingJawabanStatistik | null>(null);
  const [ringkasanAlasan, setRingkasanAlasan] = useState<PendingJawabanAlasanRingkasan | null>(null);
  const [ringkasanTriase, setRingkasanTriase] = useState<PendingJawabanTriaseRingkasan | null>(null);
  const [loadingRingkasan, setLoadingRingkasan] = useState(true);
  const [errorRingkasan, setErrorRingkasan] = useState<string | null>(null);

  const [runningTautkan, setRunningTautkan] = useState(false);
  const [runningPetakan, setRunningPetakan] = useState(false);
  const [runningTriase, setRunningTriase] = useState(false);
  const [pakaiAi, setPakaiAi] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoadingFiles(true);
        const res = await api.getPendingFiles<{files:{id:string;file_name:string}[]}>({ page: 1, limit: 100 });
        setFiles((res.files || []).map((f: { id: string; file_name: string }) => ({ id: f.id, file_name: f.file_name })));
      } catch (err) {
        console.error('[PendingJawaban] gagal memuat daftar file:', err);
      } finally {
        setLoadingFiles(false);
      }
    })();
  }, []);

  const loadRingkasan = useCallback(async () => {
    try {
      setLoadingRingkasan(true);
      setErrorRingkasan(null);
      const params = fileId ? { pending_file_id: fileId } : {};
      const [statRes, alasanRes, triaseRes] = await Promise.all([
        api.getPendingJawabanStatistik(params),
        api.getRingkasanAlasanPending(params),
        api.getRingkasanTriasePending(fileId || undefined),
      ]);
      setStatistik(statRes);
      setRingkasanAlasan(alasanRes);
      setRingkasanTriase(triaseRes);
    } catch (err: unknown) {
      console.error('[PendingJawaban] gagal memuat ringkasan:', err);
      setErrorRingkasan(err instanceof Error ? err.message : 'Gagal memuat ringkasan.');
      setStatistik(null);
      setRingkasanAlasan(null);
      setRingkasanTriase(null);
    } finally {
      setLoadingRingkasan(false);
    }
  }, [fileId]);

  useEffect(() => { loadRingkasan(); }, [loadRingkasan]); // eslint-disable-line react-hooks/set-state-in-effect

  const handleTautkanUlang = async () => {
    setRunningTautkan(true);
    try {
      const res = await api.tautkanUlangSepPending(fileId || undefined);
      addToast(`SEP diperiksa: ${res.diperiksa}, berhasil ditautkan: ${res.tertaut}.`, 'success');
      await loadRingkasan();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal menautkan ulang SEP.', 'error');
    } finally {
      setRunningTautkan(false);
    }
  };

  const handlePetakan = async () => {
    setRunningPetakan(true);
    try {
      const res = await api.petakanAlasanPending<{oleh_aturan?:number;oleh_ai?:number;tidak_terpetakan?:number;dilewati_manual?:number}>({ pending_file_id: fileId || undefined, pakai_ai: pakaiAi });
      const bagian: string[] = [];
      if (typeof res?.oleh_aturan === 'number') bagian.push(`${res.oleh_aturan} dari aturan`);
      if (typeof res?.oleh_ai === 'number') bagian.push(`${res.oleh_ai} dari AI`);
      if (typeof res?.tidak_terpetakan === 'number') bagian.push(`${res.tidak_terpetakan} belum terpetakan`);
      if (typeof res?.dilewati_manual === 'number') bagian.push(`${res.dilewati_manual} dilewati (sudah dikoreksi manual)`);
      addToast(`Pemetaan alasan selesai${bagian.length ? `: ${bagian.join(', ')}.` : '.'}`, 'success');
      await loadRingkasan();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal memetakan alasan pending.', 'error');
    } finally {
      setRunningPetakan(false);
    }
  };

  const handleHitungTriase = async () => {
    setRunningTriase(true);
    try {
      await api.hitungTriasePending({ pending_file_id: fileId || undefined });
      addToast('Perhitungan triase selesai.', 'success');
      await loadRingkasan();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Gagal menghitung triase.', 'error');
    } finally {
      setRunningTriase(false);
    }
  };

  const belumAdaData = !loadingRingkasan && !errorRingkasan && statistik && statistik.total === 0;

  return (
    <motion.div className="space-y-4 md:space-y-6" variants={pageVariants} initial="hidden" animate="visible">
      <Header
        title="Alur Jawab Pending BPJS"
        description="Tautkan SEP, kategorikan alasan, hitung triase, lalu siapkan draf jawaban berkutipan."
        actions={
          <Button className="gap-2" onClick={() => router.push('/pending-jawaban/daftar')}>
            <ListFilter className="size-4" />
            Lihat Daftar Klaim
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 md:p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">File Rekap</label>
          <Select value={fileId || 'ALL'} onValueChange={(v) => setFileId(v === 'ALL' ? '' : v)} disabled={loadingFiles}>
            <SelectTrigger className="w-full sm:w-[260px]"><SelectValue placeholder="Semua file" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua File</SelectItem>
              {files.map(f => <SelectItem key={f.id} value={f.id}>{f.file_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleTautkanUlang} disabled={runningTautkan}>
            <Link2 className="size-3.5" />
            {runningTautkan ? 'Menautkan...' : 'Tautkan Ulang SEP'}
          </Button>

          <div className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5">
            <Checkbox id="pakai-ai" checked={pakaiAi} onCheckedChange={(v) => setPakaiAi(v === true)} />
            <label htmlFor="pakai-ai" className="text-xs text-muted-foreground cursor-pointer select-none">Pakai AI</label>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePetakan} disabled={runningPetakan}>
            <Tags className="size-3.5" />
            {runningPetakan ? 'Memetakan...' : 'Petakan Alasan'}
          </Button>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleHitungTriase} disabled={runningTriase}>
            <Boxes className="size-3.5" />
            {runningTriase ? 'Menghitung...' : 'Hitung Triase'}
          </Button>

          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={loadRingkasan} disabled={loadingRingkasan}>
            <RefreshCw className={`size-3.5 ${loadingRingkasan ? 'animate-spin' : ''}`} />
            Muat Ulang
          </Button>
        </div>
      </div>

      {loadingRingkasan ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : errorRingkasan ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorRingkasan}
        </div>
      ) : belumAdaData ? (
        <Empty className="rounded-xl border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyTitle>Belum ada rekap pending untuk diproses</EmptyTitle>
            <EmptyDescription>
              Import file Excel rekap pending BPJS dulu lewat halaman{' '}
              <button type="button" onClick={() => router.push('/pending-bpjs')} className="text-primary underline-offset-2 hover:underline">Pending BPJS</button>,
              baru jalankan tautkan SEP, petakan alasan, dan hitung triase di sini.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* SEP match */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kecocokan SEP</CardTitle>
              <CardDescription className="text-xs">Klaim pending yang tertaut ke SEP di sistem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono-data text-2xl font-bold text-foreground">{statistik?.cocok ?? 0}</span>
                <span className="text-xs text-muted-foreground">/ {statistik?.total ?? 0} total</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                  <p className="text-muted-foreground">Cocok Persis</p>
                  <p className="font-mono-data font-semibold text-foreground">{statistik?.cocok_persis ?? 0}</p>
                </div>
                <div className="rounded-md bg-muted/40 px-2 py-1.5">
                  <p className="text-muted-foreground">Cocok Normalisasi</p>
                  <p className="font-mono-data font-semibold text-foreground">{statistik?.cocok_normalisasi ?? 0}</p>
                </div>
                <div className="rounded-md bg-destructive/5 px-2 py-1.5 col-span-2">
                  <p className="text-muted-foreground">Klaim Tidak Ada di Sistem</p>
                  <p className="font-mono-data font-semibold text-destructive">{statistik?.klaim_tidak_ada ?? 0}</p>
                </div>
              </div>
              {statistik?.penjelasan && (
                <p className="text-[11px] leading-relaxed text-muted-foreground border-t border-border pt-2">{statistik.penjelasan}</p>
              )}
              {statistik?.per_periode && statistik.per_periode.length > 0 && (
                <div className="border-t border-border pt-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-7 text-[11px]">Periode</TableHead>
                        <TableHead className="h-7 text-right text-[11px]">Total</TableHead>
                        <TableHead className="h-7 text-right text-[11px]">Cocok</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statistik.per_periode.map(p => (
                        <TableRow key={p.periode} className="hover:bg-transparent">
                          <TableCell className="py-1.5 text-xs">{p.periode}</TableCell>
                          <TableCell className="py-1.5 text-right font-mono-data text-xs">{p.total}</TableCell>
                          <TableCell className="py-1.5 text-right font-mono-data text-xs text-primary">{p.cocok}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alasan kategori */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kategori Alasan Pending</CardTitle>
              <CardDescription className="text-xs">Rincian rawat jalan / rawat inap per kategori</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!ringkasanAlasan || ringkasanAlasan.per_kategori.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Belum ada alasan yang dipetakan. Jalankan &quot;Petakan Alasan&quot; di atas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-7 text-[11px]">Kategori</TableHead>
                      <TableHead className="h-7 text-right text-[11px]">Rajal</TableHead>
                      <TableHead className="h-7 text-right text-[11px]">Ranap</TableHead>
                      <TableHead className="h-7 text-right text-[11px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ringkasanAlasan.per_kategori.map(k => (
                      <TableRow key={k.kategori} className="hover:bg-transparent">
                        <TableCell className="py-1.5 text-xs max-w-[140px] truncate" title={k.kategori}>{k.kategori}</TableCell>
                        <TableCell className="py-1.5 text-right font-mono-data text-xs">{k.rawat_jalan}</TableCell>
                        <TableCell className="py-1.5 text-right font-mono-data text-xs">{k.rawat_inap}</TableCell>
                        <TableCell className="py-1.5 text-right font-mono-data text-xs font-semibold">{k.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {ringkasanAlasan?.alasan_teratas && ringkasanAlasan.alasan_teratas.length > 0 && (
                <div className="border-t border-border pt-2 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Alasan Paling Sering</p>
                  {ringkasanAlasan.alasan_teratas.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-muted-foreground" title={a.alasan}>{a.alasan}</span>
                      <span className="font-mono-data shrink-0 text-foreground">{a.jumlah}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Triase */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Triase Kotak</CardTitle>
              <CardDescription className="text-xs">A = bisa dijawab, B = butuh dokumen, C = revisi koding, D = tidak dipertahankan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!ringkasanTriase ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Belum ada triase. Jalankan &quot;Hitung Triase&quot; di atas.</p>
              ) : (
                <div className="space-y-2">
                  {(['A', 'B', 'C', 'D'] as KotakTriase[]).map(kode => {
                    const item = ringkasanTriase.kotak?.find(k => k.kode === kode);
                    const info = KOTAK_INFO[kode];
                    return (
                      <div key={kode} className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 ${info.className}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{info.label}</p>
                          <p className="text-[11px] opacity-80 truncate">{info.deskripsi}</p>
                        </div>
                        <span className="font-mono-data text-sm font-bold shrink-0">{item?.jumlah ?? 0}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Belum Diklasifikasi</p>
                    <span className="font-mono-data text-sm font-bold text-foreground">{ringkasanTriase.belum_diklasifikasi ?? 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!belumAdaData && !loadingRingkasan && !errorRingkasan && (
        <div className="flex justify-center">
          <Button variant="secondary" className="gap-2" onClick={() => router.push('/pending-jawaban/daftar')}>
            Buka Daftar Klaim &amp; Draf Jawaban <ArrowRight className="size-4" />
          </Button>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </motion.div>
  );
}
