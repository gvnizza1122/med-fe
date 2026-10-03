'use client';
// Progress upload/audit PDF dipindah ke context global (dipasang di layout
// dashboard) supaya verifikator BISA pindah halaman (cek Dashboard, Riwayat
// Upload, dst) sambil batch/single upload tetap jalan di background — koneksi
// socket & status tidak lagi terikat ke lifecycle halaman Extract PDF saja.
// Progress ringkas ditampilkan sebagai widget kecil di sidebar.
//
// Unggahan biasa memakai antrean server (POST /upload-pdf-antre): status
// tiap berkas tersimpan di server, jadi refresh/menutup tab tidak
// menggagalkan pembacaan -- saat halaman dibuka lagi, proses yang masih
// berjalan diambil dari server (GET /proses-unggah) dan dipantau ulang,
// lengkap dengan tahap dan perkiraan sisa waktu.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';

export interface JenisKlaimDetection {
  value: string;
  source: 'auto' | 'single-allowed' | 'detected-not-in-allowed-list' | 'undetected';
  confident: boolean;
}

export interface BatchFileStatus {
  fileName: string;
  status: 'waiting' | 'processing' | 'done' | 'failed';
  error?: string | null;
  jenisKlaim?: string | null;
  detection?: JenisKlaimDetection | null;
  // Unggahan berantrean (status dari server).
  prosesId?: string;
  batchId?: string | null;
  tahapLabel?: string;
  sisaDetik?: number;
  persen?: number;
  jumlahHalaman?: number | null;
  fileId?: string | null;
}

interface ProsesUnggah {
  id: string; batch_id: string | null; file_name: string;
  status: 'antre' | 'berjalan' | 'selesai' | 'gagal' | 'terputus';
  tahap: string; tahap_label: string; jumlah_halaman: number | null;
  sisa_detik: number; persen: number; file_id: string | null; pesan: string | null;
}

export interface UploadJob {
  type: 'single' | 'batch';
  testing?: boolean;
  jobId?: string;
  total: number;
  doneCount: number;
  failedCount: number;
  statuses: BatchFileStatus[];
  active: boolean; // masih berjalan (true) vs sudah selesai & masih ditampilkan (false)
  error: string | null;
  // Single: id record hasil, untuk link "Lihat Hasil". Batch: tidak ada link tunggal.
  resultFileId?: string | null;
  // Unggahan berantrean: batch yang dimulai di sesi ini & perkiraan sisa waktu total.
  batchId?: string | null;
  sisaDetik?: number;
  server?: boolean;
  // Persen keseluruhan (rata-rata berkas; selesai/gagal = 100).
  persen?: number;
}

/** Persen keseluruhan dari status berkas: berjalan memakai persen server, selesai/gagal 100. */
export function persenKeseluruhan(statuses: BatchFileStatus[]): number {
  if (!statuses.length) return 0;
  const total = statuses.reduce((n, s) => n + (s.status === 'done' || s.status === 'failed' ? 100 : s.persen || 0), 0);
  return Math.round(total / statuses.length);
}

const STATUS_DARI_SERVER: Record<ProsesUnggah['status'], BatchFileStatus['status']> = {
  antre: 'waiting', berjalan: 'processing', selesai: 'done', gagal: 'failed', terputus: 'failed',
};

/** Susun job dari daftar proses server. */
// Persen tertinggi yang pernah ditampilkan per proses: perkiraan dihitung
// ulang saat jumlah halaman diketahui, tetapi bar tidak boleh mundur.
const persenTertinggi = new Map<string, number>();

function jobDariServer(proses: ProsesUnggah[], batchId: string | null = null): UploadJob | null {
  if (!proses.length) return null;
  for (const p of proses) {
    const naik = Math.max(persenTertinggi.get(p.id) || 0, p.persen || 0);
    persenTertinggi.set(p.id, naik);
    p.persen = p.status === 'selesai' ? 100 : naik;
  }
  const statuses: BatchFileStatus[] = proses.map(p => ({
    fileName: p.file_name, status: STATUS_DARI_SERVER[p.status], error: p.pesan,
    prosesId: p.id, batchId: p.batch_id, tahapLabel: p.tahap_label, sisaDetik: p.sisa_detik,
    persen: p.persen, jumlahHalaman: p.jumlah_halaman, fileId: p.file_id,
  }));
  const active = statuses.some(x => x.status === 'waiting' || x.status === 'processing');
  const batchAktif = new Set(statuses.filter(x => x.status === 'waiting' || x.status === 'processing').map(x => x.batchId ?? null));
  const done = statuses.filter(x => x.status === 'done');
  return {
    type: statuses.length === 1 ? 'single' : 'batch', server: true, batchId,
    total: statuses.length, doneCount: done.length, failedCount: statuses.filter(x => x.status === 'failed').length,
    statuses, active, error: null,
    resultFileId: statuses.length === 1 ? done[0]?.fileId || null : null,
    // Persen keseluruhan hanya dari batch yang masih berjalan (unggahan lama
    // yang sudah selesai tetapi belum ditutup tidak ikut menaikkan angka).
    persen: persenKeseluruhan(active ? statuses.filter(x => batchAktif.has(x.batchId ?? null)) : statuses),
    sisaDetik: active ? Math.max(0, ...statuses.filter(x => x.status === 'waiting' || x.status === 'processing').map(x => x.sisaDetik || 0)) : 0,
  };
}

interface UploadJobContextValue {
  job: UploadJob | null;
  startSingleUpload: (file: File, jenisKlaim: string) => Promise<{ file_id: string } | null>;
  startBatchUpload: (files: File[], allowedCategories: string[], testing?: boolean) => Promise<void>;
  dismissJob: () => void;
}

const UploadJobContext = createContext<UploadJobContextValue | null>(null);

export function UploadJobProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<UploadJob | null>(null);
  const socketRef = useRef<unknown>(null);
  const monitoring = useRef(new Set<string>());

  const batchSesi = useRef<string | null>(null);
  const memantauServer = useRef(false);

  // Pantau proses di server sampai semuanya selesai. Dipanggil saat halaman
  // dibuka (melanjutkan proses yang masih berjalan setelah refresh) dan
  // setelah unggahan baru diterima.
  const pantauServer = useCallback(async () => {
    if (memantauServer.current) return;
    memantauServer.current = true;
    let gagalBeruntun = 0;
    try {
      for (;;) {
        try {
          const data = await api.getProsesUnggah();
          gagalBeruntun = 0;
          const j = jobDariServer((data.proses || []) as ProsesUnggah[], batchSesi.current);
          setJob(prev => (prev && !prev.server && prev.active ? prev : j));
          if (!j || !j.active) break;
        } catch {
          // Server sementara tidak terjangkau: proses tetap berjalan di server; coba lagi.
          if (++gagalBeruntun >= 20) break;
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } finally {
      memantauServer.current = false;
    }
  }, []);

  useEffect(() => { void pantauServer(); }, [pantauServer]);

  const dismissJob = useCallback(() => {
    setJob(prev => {
      if (prev?.server) {
        const ids = prev.statuses.filter(x => x.prosesId && (x.status === 'done' || x.status === 'failed')).map(x => x.prosesId as string);
        if (ids.length) void api.tutupProsesUnggah(ids).catch(() => {});
      }
      return null;
    });
    batchSesi.current = null;
  }, []);

  const monitorTestingJob = useCallback(async (jobId: string) => {
    if (monitoring.current.has(jobId)) return;
    monitoring.current.add(jobId);
    let failures = 0;
    for (;;) {
      try {
        const state = await api.getTestingJob(jobId);
        failures = 0;
        setJob({ type: 'batch', testing: true, jobId, total: state.total,
          statuses: state.statuses, doneCount: state.successful, failedCount: state.failed,
          active: state.active, error: state.error || null });
        if (!state.active) { localStorage.removeItem('eclaim-testing-job'); break; }
      } catch (err) {
        if (++failures >= 3) {
          setJob(prev => prev?.jobId === jobId ? { ...prev, active: false,
            error: err instanceof Error ? err.message : 'Progres terputus. Periksa Testing Pending sebelum upload ulang.' } : prev);
          break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    monitoring.current.delete(jobId);
  }, []);
  useEffect(() => {
    const jobId = localStorage.getItem('eclaim-testing-job');
    if (jobId) {
      setJob({ type: 'batch', testing: true, jobId, total: 0, statuses: [], doneCount: 0, failedCount: 0, active: true, error: null });
      void monitorTestingJob(jobId);
    }
  }, [monitorTestingJob]);

  // Kirim berkas ke antrean server; pembacaan lanjut walau halaman di-refresh.
  const kirimKeAntrean = useCallback(async (files: File[], allowedCategories: string[]) => {
    const res = await api.uploadPdfAntre(files, allowedCategories);
    batchSesi.current = res.batch_id;
    const j = jobDariServer((res.proses || []) as ProsesUnggah[], res.batch_id);
    if (j) setJob({ ...j, active: true });
    void pantauServer();
    return res;
  }, [pantauServer]);

  const startSingleUpload = useCallback(async (file: File, jenisKlaim: string) => {
    setJob({
      type: 'single', total: 1, doneCount: 0, failedCount: 0, statuses: [{ fileName: file.name, status: 'waiting', tahapLabel: 'Mengunggah berkas' }],
      active: true, error: null, resultFileId: null,
    });
    try {
      await kirimKeAntrean([file], [jenisKlaim]);
      return null;
    } catch (err: unknown) {
      setJob({
        type: 'single', total: 1, doneCount: 0, failedCount: 1, statuses: [],
        active: false, error: err instanceof Error ? err.message : 'Berkas gagal diunggah.', resultFileId: null,
      });
      return null;
    }
  }, [kirimKeAntrean]);

  const startBatchUpload = useCallback(async (files: File[], allowedCategories: string[], testing = false) => {
    const initialStatuses: BatchFileStatus[] = files.map(f => ({ fileName: f.name, status: 'waiting' }));
    setJob({
      type: 'batch', testing, total: files.length, doneCount: 0, failedCount: 0,
      statuses: initialStatuses, active: true, error: null,
    });

    socketRef.current = null;

    try {
      if (testing) {
        const accepted = await api.uploadTestingBatch(files, allowedCategories);
        localStorage.setItem('eclaim-testing-job', accepted.job_id);
        setJob(prev => prev ? { ...prev, jobId: accepted.job_id } : prev);
        await monitorTestingJob(accepted.job_id);
        return;
      }
      // Antrean server: balasan langsung, pembacaan berjalan di latar belakang
      // dan tetap jalan walau halaman di-refresh atau ditutup.
      await kirimKeAntrean(files, allowedCategories);
    } catch (err: unknown) {
      setJob(prev => prev?.type === 'batch' ? { ...prev, active: false,
        error: err instanceof Error ? err.message : 'Progres terputus. Periksa daftar berkas sebelum upload ulang.' } : prev);
    } finally {
      socketRef.current = null;
    }
  }, [monitorTestingJob, kirimKeAntrean]);

  return (
    <UploadJobContext.Provider value={{ job, startSingleUpload, startBatchUpload, dismissJob }}>
      {children}
    </UploadJobContext.Provider>
  );
}

export function useUploadJob() {
  const ctx = useContext(UploadJobContext);
  if (!ctx) throw new Error('useUploadJob harus dipakai di dalam UploadJobProvider');
  return ctx;
}
