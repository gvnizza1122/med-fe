export interface JenisKlaimDetection {
  value: string;
  source: 'auto' | 'single-allowed' | 'detected-not-in-allowed-list' | 'undetected';
  confident: boolean;
}

export interface BatchFileStatus {
  fileName: string;
  status: 'waiting' | 'processing' | 'done' | 'needs_review' | 'failed';
  error?: string | null;
  jenisKlaim?: string | null;
  detection?: JenisKlaimDetection | null;
  // Unggahan berantrean (status dari server).
  prosesId?: string;
  batchId?: string | null;
  tahapLabel?: string;
  sisaDetik?: number | null;
  estimasiStatus?: string;
  urutanFile?: number | null;
  persen?: number;
  jumlahHalaman?: number | null;
  fileId?: string | null;
}

export interface ProsesUnggah {
  id: string; batch_id: string | null; file_name: string;
  status: 'antre' | 'berjalan' | 'selesai' | 'perlu_dicek' | 'gagal' | 'terputus';
  tahap: string; tahap_label: string; jumlah_halaman: number | null;
  sisa_detik: number | null; estimasi_status?: string; urutan_file?: number | null; persen: number; file_id: string | null; pesan: string | null;
}

export interface UploadJob {
  type: 'single' | 'batch';
  testing?: boolean;
  jobId?: string;
  total: number;
  doneCount: number;
  failedCount: number;
  reviewCount?: number;
  statuses: BatchFileStatus[];
  active: boolean; // masih berjalan (true) vs sudah selesai & masih ditampilkan (false)
  error: string | null;
  // Single: id record hasil, untuk link "Lihat Hasil". Batch: tidak ada link tunggal.
  resultFileId?: string | null;
  // Unggahan berantrean: batch yang dimulai di sesi ini & perkiraan sisa waktu total.
  batchId?: string | null;
  sisaDetik?: number | null;
  server?: boolean;
  // Persen keseluruhan (rata-rata berkas; selesai/gagal = 100).
  persen?: number;
}

/** Count, percentage and ETA always describe exactly the same set of files. */
export function persenKeseluruhan(statuses: BatchFileStatus[]): number {
  if (!statuses.length) return 0;
  const active = statuses.some(s => s.status === 'waiting' || s.status === 'processing');
  const total = statuses.reduce((n, s) => n + (['done','needs_review','failed'].includes(s.status) ? 100 : clampPercent(s.persen)), 0);
  return Math.min(active ? 99 : 100, Math.round(total / statuses.length));
}

function clampPercent(value?: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(99, Number(value))) : 0;
}

const STATUS_DARI_SERVER: Record<ProsesUnggah['status'], BatchFileStatus['status']> = {
  antre: 'waiting', berjalan: 'processing', selesai: 'done', perlu_dicek: 'needs_review', gagal: 'failed', terputus: 'failed',
};

export function jobDariServer(proses: ProsesUnggah[], batchId: string | null = null,
  highest = new Map<string, number>(), trackedBatches = new Set<string>()): UploadJob | null {
  const unique = [...new Map(proses.map(p => [p.id, p])).values()];
  const key = (p: ProsesUnggah) => p.batch_id || p.id;
  const activeBatches = new Set(unique.filter(p => p.status === 'antre' || p.status === 'berjalan').map(key));
  activeBatches.forEach(k => trackedBatches.add(k));
  const latest = unique.at(-1);
  const hasBatch = batchId != null && unique.some(p => p.batch_id === batchId);
  const selected = unique.filter(p => hasBatch ? p.batch_id === batchId
    : trackedBatches.size ? trackedBatches.has(key(p)) : latest && key(p) === key(latest));
  if (!selected.length) return null;
  selected.sort((a, b) => a.batch_id === b.batch_id && a.urutan_file != null && b.urutan_file != null
    ? a.urutan_file - b.urutan_file : 0);
  const statuses: BatchFileStatus[] = selected.map(p => {
    const status = STATUS_DARI_SERVER[p.status];
    const terminal = status === 'done' || status === 'needs_review' || status === 'failed';
    const percent = terminal ? 100 : Math.max(highest.get(p.id) || 0, clampPercent(p.persen));
    highest.set(p.id, percent);
    return { fileName: p.file_name, status, error: p.pesan, prosesId: p.id,
      batchId: p.batch_id, tahapLabel: p.tahap_label, sisaDetik: p.sisa_detik,
      estimasiStatus: p.estimasi_status, urutanFile: p.urutan_file,
      persen: percent, jumlahHalaman: p.jumlah_halaman, fileId: p.file_id };
  });
  const activeFiles = statuses.filter(s => s.status === 'waiting' || s.status === 'processing');
  const done = statuses.filter(s => s.status === 'done');
  return {
    type: statuses.length === 1 ? 'single' : 'batch', server: true, batchId: hasBatch ? batchId : null,
    total: statuses.length, doneCount: done.length, failedCount: statuses.filter(s => s.status === 'failed').length,
    reviewCount: statuses.filter(s => s.status === 'needs_review').length,
    statuses, active: activeFiles.length > 0, error: null,
    resultFileId: statuses.length === 1 && !activeFiles.length ? statuses[0]?.fileId || null : null,
    persen: persenKeseluruhan(statuses),
    sisaDetik: activeFiles.some(s => s.sisaDetik == null) ? null : Math.max(0, ...activeFiles.map(s => s.sisaDetik || 0)),
  };
}

export function formatSisa(detik: number | null | undefined): string {
  if (detik == null || !Number.isFinite(detik)) return 'waktu belum dapat diperkirakan';
  if (detik <= 0) return '0 detik';
  if (detik < 60) return `${Math.ceil(detik / 5) * 5} detik`;
  const menit = Math.ceil(detik / 60);
  return menit >= 60 ? `${Math.floor(menit / 60)} jam${menit % 60 ? ` ${menit % 60} menit` : ''}` : `${menit} menit`;
}

export function gabungFileUnik(existing: File[], incoming: File[]): File[] {
  const keys = new Set(existing.map(f => `${f.name}\0${f.size}\0${f.lastModified}`));
  return [...existing, ...incoming.filter(f => {
    const key = `${f.name}\0${f.size}\0${f.lastModified}`;
    if (keys.has(key)) return false;
    keys.add(key); return true;
  })];
}
