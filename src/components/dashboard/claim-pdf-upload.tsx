'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUploadJob } from '@/contexts/UploadJobContext';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  XCircle,
  X,
  ArrowRight,
  AlertTriangle,
  Siren,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSisa, gabungFileUnik } from '@/lib/upload-progress';
import { HistoryTabs } from '@/components/dashboard/history-tabs';
import { Header } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';


const MAX_BATCH_FILES = 300; // harus sinkron dengan MAX_BATCH_PDF_FILES di backend (claimFiles.js)

// Panel info di samping form — sebelumnya halaman ini cuma satu kartu form
// polos di tengah, terasa kosong/generik. Konten statis (tidak butuh fetch
// tambahan), fokus menjawab pertanyaan yang biasanya muncul saat upload.
const PROCESS_STEPS = [
  { icon: UploadCloud, title: 'Unggah Berkas', desc: 'Drag atau pilih PDF hasil scan/print dari SIMRS — boleh banyak file sekaligus.' },
  { icon: ScanSearch, title: 'Ekstraksi Otomatis', desc: 'AI membaca ~60 kolom data vClaim dari tiap dokumen (SEP, diagnosis, prosedur, tarif, dst).' },
  { icon: ShieldCheck, title: 'Validasi & Audit', desc: 'Dicek terhadap aturan BPJS/INA-CBG, hasilnya langsung terlihat di Riwayat Upload.' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ClaimPdfUpload({ testing = false }: { testing?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { job, startBatchUpload, dismissJob } = useUploadJob();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);
  const [error, setError] = useState('');

  // uploading/batchStatuses/batchDone sekarang bersumber dari job global (lihat
  // UploadJobContext) — supaya progress upload+audit tetap jalan & terlihat
  // (lewat widget sidebar) walau verifikator pindah ke halaman lain, tidak
  // terikat ke lifecycle komponen halaman ini lagi.
  const uploading = job?.active ?? false;
  const ownJob = (job?.type === 'batch' || job?.server) && !!job.testing === testing ? job : null;
  // Unggahan berantrean: status berkas di sesi ini dicocokkan per batch
  // (daftar server juga memuat unggahan lain yang belum ditutup).
  const batchStatuses = ownJob?.statuses || [];
  const batchDone = ownJob && !ownJob.active && !ownJob.error
    ? { successful: ownJob.doneCount, failed: ownJob.failedCount }
    : null;

  const [files, setFiles] = useState<File[]>([]);

  // Kalau verifikator TETAP di halaman ini sampai upload 1-file selesai,
  // pertahankan kebiasaan lama: langsung ke halaman hasil. Kalau sudah
  // pindah halaman, biarkan (widget sidebar sediakan link "Lihat Hasil" —
  // memaksa pindah halaman saat mereka sedang lihat halaman lain justru
  // mengulang masalah yang fitur ini coba perbaiki).
  useEffect(() => {
    // Hanya untuk unggahan yang dimulai di sesi ini (batchId); hasil yang
    // dilanjutkan setelah refresh ditampilkan di panel, tidak melompat sendiri.
    if (pathname === '/extract' && job?.type === 'single' && !job.active && job.resultFileId && (!job.server || job.batchId)) {
      router.push(`/results/${job.resultFileId}`);
      dismissJob();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, pathname]);

  useEffect(() => {
    if (testing && ownJob && !ownJob.active && !ownJob.error) setFiles([]);
  }, [testing, ownJob?.active]);

  const validateFile = (f: File): string | null => {
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext !== 'pdf') return `${f.name}: hanya file PDF yang diperbolehkan.`;
    if (f.size > 20 * 1024 * 1024) return `${f.name}: ukuran melebihi 20MB.`;
    return null;
  };

  const addBatchFiles = (incoming: FileList | File[]) => {
    if (ownJob && !ownJob.active) dismissJob();
    const incomingArr = Array.from(incoming);
    const errs: string[] = [];
    const valid: File[] = [];
    for (const f of incomingArr) {
      const err = validateFile(f);
      if (err) { errs.push(err); continue; }
      // Hindari duplikat (nama + ukuran sama) kalau user pilih file yang sama 2x
      valid.push(f);
    }
    const combined = gabungFileUnik(files, valid);
    if (combined.length > MAX_BATCH_FILES) {
      setError(`Maksimal ${MAX_BATCH_FILES} file per batch. ${combined.length - MAX_BATCH_FILES} file terakhir tidak ditambahkan.`);
      setFiles(combined.slice(0, MAX_BATCH_FILES));
    } else {
      setFiles(combined);
      setError(errs.length > 0 ? errs.join(' ') : '');
    }
  };

  const removeBatchFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadBatch = useCallback(async () => {
    if (files.length === 0) return;
    setError('');
    await startBatchUpload(files, ['RAWAT_JALAN', 'RAWAT_INAP'], testing);
  }, [files, startBatchUpload, testing]);

  const batchProgressDone = batchStatuses.filter(s => ['done','needs_review','failed'].includes(s.status)).length;
  const serverStatuses = ownJob?.server ? ownJob.statuses : [];
  const batchTotal = ownJob?.total ?? files.length;
  // Berantrean: persen halus dari server (rata-rata berkas); testing: per berkas selesai.
  const batchProgressPct = ownJob?.server && batchStatuses.length ? ownJob.persen ?? 0
    : batchTotal > 0 ? Math.round((batchProgressDone / batchTotal) * 100) : 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <Header
        title={testing ? "Upload Testing" : "Ekstrak PDF Klaim"}
        description={testing ? "Unggah banyak PDF klaim untuk pengujian. Evaluasi dengan catatan pending BPJS dilakukan di luar aplikasi." : "Unggah berkas PDF klaim dari SIMRS — sistem mengekstrak datanya secara otomatis untuk diperiksa dan divalidasi"}
      />

      {testing && <HistoryTabs />}
      {ownJob?.error && <Alert variant="destructive"><AlertDescription>{ownJob.error}</AlertDescription></Alert>}
      {/* Proses di server (tetap berjalan walau halaman di-refresh atau ditutup). */}
      {!testing && files.length === 0 && serverStatuses.length > 0 && (
        <Card className="mx-auto w-full max-w-5xl space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {ownJob?.active ? `Sedang diproses di server · ${serverStatuses.filter(s => ['done','needs_review','failed'].includes(s.status)).length}/${serverStatuses.length} diproses` : `Pemrosesan berakhir · ${ownJob?.doneCount} analisis selesai${ownJob?.reviewCount ? `, ${ownJob.reviewCount} belum lengkap` : ''}${ownJob?.failedCount ? `, ${ownJob.failedCount} gagal` : ''}`}
            </p>
            {ownJob?.active && <span className="text-sm text-muted-foreground"><strong className="text-foreground">Estimasi progres {ownJob.persen ?? 0}%</strong>{ownJob.sisaDetik ? ` · perkiraan sisa ±${formatSisa(ownJob.sisaDetik)}` : ownJob.server ? ' · waktu belum dapat diperkirakan' : ''}</span>}
          </div>
          {ownJob?.active && <Progress value={ownJob.persen ?? 0} className="h-2" />}
          <p className="text-xs text-muted-foreground">Halaman boleh di-refresh, dipindah, atau ditutup — pembacaan berkas tetap berjalan di server.</p>
          <p className="text-xs text-muted-foreground">Progres mengukur proses berkas. Hasil analisis tetap perlu diperiksa sebelum klaim dikirim.</p>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {serverStatuses.map(s => (
              <div key={s.prosesId} className="rounded-md border border-border p-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{s.fileName}</span>
                  <span className={cn('text-xs', s.status === 'failed' ? 'text-destructive' : s.status === 'needs_review' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                    {s.status === 'done' ? 'Analisis selesai' : s.status === 'needs_review' ? 'Berkas tersimpan · Analisis belum lengkap' : s.status === 'failed' ? 'Gagal' : `${s.persen ?? 0}% · ${s.tahapLabel || 'Memproses'}${s.sisaDetik ? ` · sisa ±${formatSisa(s.sisaDetik)}` : ' · waktu belum dapat diperkirakan'}`}
                  </span>
                </div>
                {(s.status === 'processing' || s.status === 'waiting') && <Progress value={s.persen || 0} className="mt-2 h-1.5" />}
                {s.jumlahHalaman ? <p className="mt-1 text-xs text-muted-foreground">{s.jumlahHalaman} halaman</p> : null}
                {(s.status === 'failed' || s.status === 'needs_review') && s.error && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{s.error}</p>}
                {(s.status === 'done' || s.status === 'needs_review') && s.fileId && <button type="button" onClick={() => router.push(`/results/${s.fileId}`)} className="mt-1 text-xs font-medium text-primary hover:underline">Lihat hasil →</button>}
              </div>
            ))}
          </div>
          {!ownJob?.active && <Button variant="secondary" size="sm" onClick={dismissJob}>Tutup daftar</Button>}
        </Card>
      )}
      {testing && files.length === 0 && batchStatuses.length > 0 && <Card className="p-5 space-y-3"><p className="text-sm font-medium">Batch testing: {batchProgressDone}/{batchTotal} berkas selesai</p><Progress value={batchProgressPct} /><div className="max-h-64 overflow-y-auto text-sm space-y-2">{batchStatuses.map((s, i) => <div key={i} className="flex flex-wrap justify-between gap-2"><span className="truncate">{s.fileName}</span><span>{s.status === "done" ? "Selesai" : s.status === "failed" ? "Gagal" : s.status === "processing" ? "Memproses…" : "Menunggu"}</span>{s.error && <p className="w-full text-destructive">{s.error}</p>}</div>)}</div><Button variant="secondary" onClick={() => router.push("/testing-pending")}>Lihat hasil testing</Button></Card>}
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <Card className="animate-slide-in-up">
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2 font-medium"><ScanSearch className="size-5 text-primary" />Kategori pelayanan otomatis</div>
              <p className="text-sm text-muted-foreground">Aplikasi membaca SEP, surat perintah rawat inap, dan resume medis untuk menempatkan setiap berkas ke Rawat Inap atau Rawat Jalan. Pasien dari IGD yang dilanjutkan rawat inap tetap masuk Rawat Inap.</p>
              <p className="text-xs text-muted-foreground">Boleh unggah berkas campuran. Jika dokumen berbeda atau belum terbaca, aplikasi memberi pemberitahuan untuk ditinjau.</p>
            </div>

            {/* ── Dropzone (batch) ── */}
            <>
              <div
                  role="button" tabIndex={uploading ? -1 : 0} aria-label="Pilih beberapa berkas PDF" aria-disabled={uploading}
                  onKeyDown={e => { if (!uploading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInputRef.current?.click(); } }}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); if (!uploading) setDragover(true); }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={e => { e.preventDefault(); setDragover(false); if (!uploading && e.dataTransfer.files.length) addBatchFiles(e.dataTransfer.files); }}
                  className={cn(
                    'flex min-h-[180px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                    uploading ? 'cursor-default' : 'cursor-pointer',
                    dragover ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  <div className="flex flex-col items-center gap-2">
                    <UploadCloud className="size-10 text-muted-foreground" />
                    <h3 className="font-display m-0 text-sm font-semibold text-foreground">Klik atau drag beberapa berkas PDF ke sini</h3>
                    <p className="m-0 text-xs text-muted-foreground">Maks {MAX_BATCH_FILES} file, masing-masing maks 20MB — kategori terdeteksi otomatis per file</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef} type="file" accept=".pdf" multiple hidden
                  onChange={e => { if (e.target.files?.length) addBatchFiles(e.target.files); e.target.value = ''; }}
                />

                {files.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>{files.length} file dipilih ({formatFileSize(files.reduce((s, f) => s + f.size, 0))})</span>
                      {uploading && <span className="font-mono-data">{ownJob?.server ? 'Estimasi ' : ''}{batchProgressPct}% · {batchProgressDone}/{batchTotal}</span>}
                    </div>
                    {uploading && <><Progress value={batchProgressPct} />{ownJob?.server && <p className="text-xs text-muted-foreground">{ownJob.sisaDetik == null ? 'Proses masih berjalan; waktu belum dapat diperkirakan.' : `Perkiraan sisa ±${formatSisa(ownJob.sisaDetik)}`}</p>}</>}
                    <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                      <AnimatePresence>
                        {files.map((f, i) => {
                          const status = batchStatuses.find(s => s.urutanFile === i) ?? (batchStatuses[i]?.fileName === f.name ? batchStatuses[i] : undefined);
                          return (
                            <motion.div
                              key={`${f.name}-${f.size}-${i}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              className="rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-2">
                              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate" title={f.name}>{f.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(f.size)}</span>
                              {/* Kategori TIDAK dipilih manual — badge di bawah baru
                                  muncul SETELAH proses selesai, menampilkan kategori
                                  yang berhasil dideteksi otomatis dari isi dokumen. */}
                              {status?.status === 'done' && status.jenisKlaim && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'shrink-0 text-xs',
                                    status.detection?.confident === false && 'border-amber-500/50 text-amber-700 dark:text-amber-400',
                                  )}
                                  title={status.detection?.confident === false ? 'Kategori tidak yakin terdeteksi — mohon cek manual di Riwayat Upload.' : undefined}
                                >
                                  {status.jenisKlaim === 'RAWAT_INAP' ? 'Rawat Inap' : status.jenisKlaim === 'RAWAT_JALAN' ? 'Rawat Jalan' : status.jenisKlaim}
                                  {status.detection?.confident === false && ' ⚠️'}
                                </Badge>
                              )}
                              {status && (
                                <Badge
                                  variant={
                                    status.status === 'done'
                                      ? 'default'
                                      : status.status === 'failed'
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                  className="shrink-0"
                                >
                                  {status.status === 'done' ? (
                                    <><CheckCircle2 className="size-3" /> Selesai</>
                                  ) : status.status === 'failed' ? (
                                    <><XCircle className="size-3" /> Gagal</>
                                  ) : status.status === 'processing' ? (
                                    status.tahapLabel ? `${status.persen ?? 0}% · ${status.tahapLabel}${status.sisaDetik ? ` · sisa ±${formatSisa(status.sisaDetik)}` : ' · waktu belum dapat diperkirakan'}` : 'Memproses...'
                                  ) : (
                                    status.sisaDetik ? `Menunggu · ±${formatSisa(status.sisaDetik)}` : ownJob?.server ? 'Menunggu · waktu belum dapat diperkirakan' : 'Mengunggah berkas'
                                  )}
                                </Badge>
                              )}
                              {!uploading && (
                                <button
                                  type="button"
                                  onClick={() => removeBatchFile(i)}
                                  aria-label={`Hapus ${f.name}`}
                                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <X className="size-3.5" />
                                </button>
                              )}
                              </div>
                              {/* Alasan gagal WAJIB ditampilkan: backend mengirim pesan yang
                                  jelas (mis. "SEP ... sudah pernah diupload ... pada ..."), tapi
                                  selama ini layar cuma menulis "Gagal". Koder jadi tidak tahu
                                  berkasnya ditolak karena duplikat atau sistemnya bermasalah. */}
                              {status?.status === 'failed' && status.error && (
                                <div className="mt-1 pl-6 text-xs leading-snug text-destructive/90">
                                  {status.error}
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {batchDone && (
                  <Alert className="border-primary/20 bg-primary/5">
                    <AlertDescription className="flex flex-wrap items-center gap-2 text-foreground">
                      <span>
                        Batch selesai — <strong className="text-primary">{batchDone.successful} berhasil</strong>
                        {batchDone.failed > 0 && (
                          <> · <strong className="text-destructive">{batchDone.failed} gagal</strong></>
                        )}
                        .
                      </span>
                      <Button type="button" variant="secondary" size="sm" onClick={() => router.push(testing ? '/testing-pending' : '/history')}>
                        {testing ? "Lihat hasil testing" : "Lihat di Riwayat Upload"} <ArrowRight className="size-3.5" />
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                >
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1"
                onClick={handleUploadBatch}
                disabled={files.length === 0 || uploading}
              >
                {uploading ? (
                  <><Spinner /> {ownJob?.server || ownJob?.jobId ? `Memproses ${batchProgressDone}/${batchTotal}...` : `Mengunggah ${batchTotal} berkas...`}</>
                ) : (
                  <><UploadCloud className="size-4" /> Unggah &amp; Ekstrak Semua ({files.length} file)</>
                )}
              </Button>
              {files.length > 0 && !uploading && (
                <Button variant="secondary" size="lg" onClick={() => { setFiles([]); dismissJob(); setError(''); }}>
                  Kosongkan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <h3 className="font-display text-sm font-semibold text-foreground">Alur Proses</h3>
          </div>
          <div className="space-y-4">
            {(testing ? [...PROCESS_STEPS.slice(0, 2), { icon: ShieldCheck, title: "Analisis Testing", desc: "Hasil awal disimpan di Testing Pending. Ekspor hasil untuk evaluasi bersama catatan pending BPJS di Codex atau Claude." }] : PROCESS_STEPS).map((step, i) => (
              <div key={step.title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <step.icon className="size-4" />
                  </div>
                  {i < PROCESS_STEPS.length - 1 && <div className="mt-1 h-full w-px flex-1 bg-border" />}
                </div>
                <div className="pb-1">
                  <p className="text-xs font-semibold text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="font-display text-sm font-semibold text-foreground">Tips</h3>
          </div>
          <ul className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
              1 file PDF = 1 klaim pasien — gabungkan semua dokumen pendukung (SEP, resume medis, dst) jadi satu berkas per klaim sebelum upload.
            </li>
            <li className="flex gap-2">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
              Boleh campur kategori Rawat Jalan & Rawat Inap dalam satu batch — sistem mendeteksi kategori tiap file otomatis.
            </li>
            {testing && <li className="flex gap-2"><span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />Gunakan PDF klaim asli. Simpan surat atau catatan pending BPJS terpisah untuk evaluasi di luar aplikasi.</li>}
            {testing && <li className="flex gap-2"><span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />Berkas testing terpisah dari klaim operasional. Analisis memakai token AI dan tercatat di Penggunaan AI.</li>}
            <li className="flex gap-2">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
              Hasil deteksi kategori yang ditandai &ldquo;tidak yakin&rdquo; sebaiknya dicek manual di {testing ? "Testing Pending" : "Riwayat Upload"}.
            </li>
          </ul>
        </Card>
      </motion.div>
      </div>
    </div>
  );
}
