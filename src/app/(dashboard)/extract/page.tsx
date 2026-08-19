'use client';
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { io, type Socket } from 'socket.io-client';
import {
  FileText,
  Files,
  UploadCloud,
  CheckCircle2,
  XCircle,
  X,
  ArrowRight,
  AlertTriangle,
  Footprints,
  BedDouble,
  Siren,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const JENIS_KLAIM_OPTIONS: { value: string; label: string; icon: ReactNode; desc: string }[] = [
  { value: 'RAWAT_JALAN', label: 'Rawat Jalan', icon: <Footprints className="size-5" />, desc: 'Pasien tidak menginap' },
  { value: 'RAWAT_INAP', label: 'Rawat Inap', icon: <BedDouble className="size-5" />, desc: 'Pasien menginap di ruangan' },
  { value: 'GAWAT_DARURAT', label: 'IGD / Gawat Darurat', icon: <Siren className="size-5" />, desc: 'Kunjungan IGD, tidak lanjut rawat inap' },
];

const MAX_BATCH_FILES = 30; // harus sinkron dengan MAX_BATCH_PDF_FILES di backend (claimFiles.js)

interface BatchFileStatus {
  fileName: string;
  status: 'waiting' | 'processing' | 'done' | 'failed';
  error?: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function ExtractPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [jenisKlaim, setJenisKlaim] = useState('');
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Mode single
  const [file, setFile] = useState<File | null>(null);

  // Mode batch — kategori BISA BEDA per file (dulu 1 kategori dipaksa untuk
  // seluruh batch, verifikator harus upload 3x terpisah kalau berkasnya
  // campur RJ/RI/IGD). Dikunci per file (bukan per index) pakai fileKey()
  // supaya urutan tetap benar walau file dihapus/ditambah di tengah.
  const [files, setFiles] = useState<File[]>([]);
  const [fileCategories, setFileCategories] = useState<Record<string, string>>({});
  const [batchStatuses, setBatchStatuses] = useState<BatchFileStatus[]>([]);
  const [batchDone, setBatchDone] = useState<{ successful: number; failed: number } | null>(null);

  const fileKey = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

  const validateFile = (f: File): string | null => {
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext !== 'pdf') return `${f.name}: hanya file PDF yang diperbolehkan.`;
    if (f.size > 20 * 1024 * 1024) return `${f.name}: ukuran melebihi 20MB.`;
    return null;
  };

  const handleFile = (f: File) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setFile(f);
    setError('');
  };

  const addBatchFiles = (incoming: FileList | File[]) => {
    const incomingArr = Array.from(incoming);
    const errs: string[] = [];
    const valid: File[] = [];
    for (const f of incomingArr) {
      const err = validateFile(f);
      if (err) { errs.push(err); continue; }
      // Hindari duplikat (nama + ukuran sama) kalau user pilih file yang sama 2x
      if (files.some(existing => existing.name === f.name && existing.size === f.size)) continue;
      valid.push(f);
    }
    const combined = [...files, ...valid];
    if (combined.length > MAX_BATCH_FILES) {
      setError(`Maksimal ${MAX_BATCH_FILES} file per batch. ${combined.length - MAX_BATCH_FILES} file terakhir tidak ditambahkan.`);
      setFiles(combined.slice(0, MAX_BATCH_FILES));
    } else {
      setFiles(combined);
      setError(errs.length > 0 ? errs.join(' ') : '');
    }
  };

  const removeBatchFile = (index: number) => {
    setFiles(prev => {
      const removed = prev[index];
      if (removed) {
        setFileCategories(cats => {
          const next = { ...cats };
          delete next[fileKey(removed)];
          return next;
        });
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Set kategori 1 file, atau semua file sekaligus ("samakan semua kategori").
  const setCategoryFor = (target: File | 'all', value: string) => {
    setFileCategories(prev => {
      if (target === 'all') {
        const next = { ...prev };
        files.forEach(f => { next[fileKey(f)] = value; });
        return next;
      }
      return { ...prev, [fileKey(target)]: value };
    });
    setError('');
  };

  const switchMode = (next: 'single' | 'batch') => {
    if (uploading) return;
    setMode(next);
    setFile(null);
    setFiles([]);
    setFileCategories({});
    setBatchStatuses([]);
    setBatchDone(null);
    setError('');
  };

  const handleUploadSingle = async () => {
    if (!file) return;
    if (!jenisKlaim) { setError('Pilih kategori pelayanan (Rawat Jalan/Rawat Inap/IGD) terlebih dahulu.'); return; }
    setUploading(true);
    setError('');
    try {
      const res = await api.uploadPdf(file, jenisKlaim);
      // Langsung ke halaman hasil lengkap (rule engine + OCR bukti + audit AI +
      // edit field) — satu alur yang sama untuk semua PDF, sudah teruji.
      router.push(`/results/${res.file_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Berkas gagal diunggah. Silakan coba lagi.');
      setUploading(false);
    }
  };

  // Socket cuma dibuka selagi batch benar-benar berjalan — supaya tidak ada
  // koneksi menganggur saat user berada di mode batch tapi belum upload.
  const batchSocketRef = useRef<Socket | null>(null);
  useEffect(() => {
    return () => { batchSocketRef.current?.disconnect(); };
  }, []);

  const handleUploadBatch = useCallback(async () => {
    if (files.length === 0) return;
    const categories = files.map(f => fileCategories[fileKey(f)] || '');
    const missing = categories.filter(c => !c).length;
    if (missing > 0) {
      setError(`${missing} file belum diberi kategori pelayanan. Pilih kategori untuk tiap file (atau pakai tombol "samakan semua") sebelum upload.`);
      return;
    }
    setUploading(true);
    setError('');
    setBatchDone(null);
    setBatchStatuses(files.map(f => ({ fileName: f.name, status: 'waiting' })));

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000');
    batchSocketRef.current = socket;
    socket.on('pdf-batch:file-done', (data: { fileName: string; success: boolean; error?: string | null }) => {
      setBatchStatuses(prev => prev.map(s =>
        s.fileName === data.fileName ? { ...s, status: data.success ? 'done' : 'failed', error: data.error } : s
      ));
    });

    try {
      // Kategori dikirim per file (array, urutan sama dengan `files`) — bukan
      // 1 nilai untuk seluruh batch lagi, lihat api.uploadPdfBatch & endpoint
      // backend /upload-pdf-batch (jenis_klaim_list).
      const res = await api.uploadPdfBatch(files, categories);
      setBatchDone({ successful: res.successful, failed: res.failed });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Batch gagal diunggah. Silakan coba lagi.');
    } finally {
      socket.disconnect();
      batchSocketRef.current = null;
      setUploading(false);
    }
  }, [files, fileCategories]);

  const batchProgressDone = batchStatuses.filter(s => s.status === 'done' || s.status === 'failed').length;
  const batchProgressPct = files.length > 0 ? Math.round((batchProgressDone / files.length) * 100) : 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <Header
        title="Ekstrak PDF Klaim"
        description="Unggah berkas PDF klaim dari SIMRS — sistem mengekstrak datanya secara otomatis untuk diperiksa dan divalidasi"
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-2xl">
        <Card className="animate-slide-in-up">
          <CardContent className="space-y-6">
            {/* ── Mode toggle: Single / Batch ── */}
            <div
              role="tablist"
              aria-label="Mode upload"
              className="bg-muted text-muted-foreground inline-flex h-10 w-full items-center justify-center rounded-lg p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'single'}
                onClick={() => switchMode('single')}
                disabled={uploading}
                className={cn(
                  'inline-flex h-full flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50',
                  mode === 'single' ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
                )}
              >
                <FileText className="size-4" /> Satu File
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'batch'}
                onClick={() => switchMode('batch')}
                disabled={uploading}
                className={cn(
                  'inline-flex h-full flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50',
                  mode === 'batch' ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
                )}
              >
                <Files className="size-4" /> Banyak File (Batch)
              </button>
            </div>

            {/* ── Kategori pelayanan ──
                Mode single: 1 kategori untuk file itu (radio, seperti biasa).
                Mode batch: kategori BISA BEDA per file — tombol di sini cuma
                "terapkan ke semua file sekaligus" (shortcut kalau semua file
                dalam batch memang 1 kategori yang sama), kategori tiap file
                tetap bisa diubah individual di daftar file di bawah. */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {mode === 'batch' ? 'Terapkan Kategori ke Semua File' : 'Kategori Pelayanan'}
              </label>
              <div role={mode === 'single' ? 'radiogroup' : undefined} aria-label="Kategori Pelayanan" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {JENIS_KLAIM_OPTIONS.map(opt => {
                  const isSelected = mode === 'single' && jenisKlaim === opt.value;
                  return (
                    <motion.button
                      key={opt.value}
                      type="button"
                      role={mode === 'single' ? 'radio' : undefined}
                      aria-checked={mode === 'single' ? isSelected : undefined}
                      onClick={() => {
                        if (mode === 'single') { setJenisKlaim(opt.value); setError(''); }
                        else setCategoryFor('all', opt.value);
                      }}
                      disabled={mode === 'batch' && files.length === 0}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        'relative flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors disabled:opacity-50 disabled:pointer-events-none',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50',
                      )}
                    >
                      <span className={cn('mb-1', isSelected ? 'text-primary' : 'text-muted-foreground')}>{opt.icon}</span>
                      <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                      <AnimatePresence>
                        {isSelected && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                          >
                            <CheckCircle2 className="size-3.5" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {mode === 'batch'
                  ? 'Klik salah satu untuk menerapkan kategori itu ke SEMUA file yang sudah ditambahkan. Tiap file tetap bisa diberi kategori berbeda satu per satu di daftar file di bawah — jadi berkas RJ/RI/IGD yang bercampur bisa diupload sekaligus, tidak perlu dipisah 3x upload lagi.'
                  : 'Dipakai supaya AI tidak salah memberi saran (mis. saran ruangan rawat inap untuk klaim rawat jalan) dan untuk memudahkan pencarian di Riwayat Upload.'}
              </p>
            </div>

            {/* ── Dropzone ── */}
            {mode === 'single' ? (
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragover(true); }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={e => { e.preventDefault(); setDragover(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                  className={cn(
                    'flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                    dragover ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  <AnimatePresence mode="wait">
                    {file ? (
                      <motion.div
                        key="file-selected"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 px-6 py-4">
                          <FileText className="size-8 text-primary" />
                          <div className="text-left">
                            <h3 className="m-0 text-sm font-semibold break-all">{file.name}</h3>
                            <p className="m-0 mt-1 text-xs font-medium text-muted-foreground">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Klik atau drag untuk mengganti file</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty-state"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <UploadCloud className="size-10 text-muted-foreground" />
                        <h3 className="m-0 text-sm font-semibold text-foreground">Klik atau drag berkas PDF ke sini</h3>
                        <p className="m-0 text-xs text-muted-foreground">Mendukung file .PDF (maks 20MB)</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </>
            ) : (
              <>
                <div
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
                    <h3 className="m-0 text-sm font-semibold text-foreground">Klik atau drag beberapa berkas PDF ke sini</h3>
                    <p className="m-0 text-xs text-muted-foreground">Maks {MAX_BATCH_FILES} file, masing-masing maks 20MB — kategori bisa diatur per file, boleh campur RJ/RI/IGD</p>
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
                      {uploading && <span>{batchProgressDone}/{files.length}</span>}
                    </div>
                    {uploading && <Progress value={batchProgressPct} />}
                    <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                      <AnimatePresence>
                        {files.map((f, i) => {
                          const status = batchStatuses.find(s => s.fileName === f.name);
                          return (
                            <motion.div
                              key={`${f.name}-${f.size}-${i}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                            >
                              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate" title={f.name}>{f.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(f.size)}</span>
                              {/* Kategori per file — boleh beda-beda dalam 1 batch */}
                              <Select
                                value={fileCategories[fileKey(f)] || ''}
                                onValueChange={v => setCategoryFor(f, v)}
                                disabled={uploading}
                              >
                                <SelectTrigger className="h-7 w-[132px] shrink-0 text-xs" size="sm">
                                  <SelectValue placeholder="Pilih kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                  {JENIS_KLAIM_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
                                    'Memproses...'
                                  ) : (
                                    'Menunggu'
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
                      <Button type="button" variant="secondary" size="sm" onClick={() => router.push('/history')}>
                        Lihat di Riwayat Upload <ArrowRight className="size-3.5" />
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

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
              {mode === 'single' ? (
                <>
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={handleUploadSingle}
                    disabled={!file || !jenisKlaim || uploading}
                  >
                    {uploading ? (<><Spinner /> Memproses...</>) : (<><UploadCloud className="size-4" /> Unggah &amp; Ekstrak</>)}
                  </Button>
                  {file && !uploading && (
                    <Button variant="secondary" size="lg" onClick={() => { setFile(null); setError(''); }}>Batal</Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={handleUploadBatch}
                    disabled={files.length === 0 || uploading}
                  >
                    {uploading ? (
                      <><Spinner /> Memproses {batchProgressDone}/{files.length}...</>
                    ) : (
                      <><UploadCloud className="size-4" /> Unggah &amp; Ekstrak Semua ({files.length} file)</>
                    )}
                  </Button>
                  {files.length > 0 && !uploading && (
                    <Button variant="secondary" size="lg" onClick={() => { setFiles([]); setBatchStatuses([]); setBatchDone(null); setError(''); }}>
                      Kosongkan
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
