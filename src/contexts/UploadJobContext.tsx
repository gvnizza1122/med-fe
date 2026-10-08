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

import { jobDariServer, type ProsesUnggah, type UploadJob, type BatchFileStatus } from '@/lib/upload-progress';
export { persenKeseluruhan } from '@/lib/upload-progress';
export type { BatchFileStatus, UploadJob, JenisKlaimDetection } from '@/lib/upload-progress';

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
  const polling = useRef(false);
  const revision = useRef(0);
  const dismissed = useRef(new Set<string>());
  const trackedBatches = useRef(new Set<string>());
  const highest = useRef(new Map<string, number>());
  const mounted = useRef(false);

  const invalidateMonitoring = useCallback(() => { revision.current++; }, []);

  // One request at a time; old responses cannot overwrite a new upload.
  const pantauServer = useCallback(async () => {
    if (polling.current || !mounted.current) return;
    polling.current = true;
    const currentRevision = revision.current;
    try {
      const data = await api.getProsesUnggah<{proses:ProsesUnggah[]}>();
      if (!mounted.current || currentRevision !== revision.current) return;
      const j = jobDariServer(((data.proses || []) as ProsesUnggah[]).filter(p => !dismissed.current.has(p.id)), batchSesi.current, highest.current, trackedBatches.current);
      setJob(prev => prev && !prev.server ? prev : j);
    } catch {
      if (mounted.current && currentRevision === revision.current) {
        setJob(prev => prev?.server && prev.active ? { ...prev,
          error: 'Status sementara belum dapat diperbarui. Proses tetap berjalan di server.', sisaDetik: null } : prev);
      }
    } finally {
      polling.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    batchSesi.current = localStorage.getItem('eclaim-upload-batch');
    void pantauServer();
    const timer = setInterval(() => { void pantauServer(); }, 3000);
    return () => { mounted.current = false; invalidateMonitoring(); clearInterval(timer); };
  }, [pantauServer, invalidateMonitoring]);

  const dismissJob = useCallback(() => {
    if (job?.active) return;
    revision.current++;
    highest.current.clear();
    trackedBatches.current.clear();
    localStorage.removeItem('eclaim-upload-batch');
    if (job?.server) {
      const ids = job.statuses.filter(x => x.prosesId).map(x => x.prosesId as string);
      ids.forEach(id => dismissed.current.add(id));
      if (ids.length) void api.tutupProsesUnggah(ids).catch(() => {});
    }
    setJob(null);
    batchSesi.current = null;
  }, [job]);

  const monitorTestingJob = useCallback(async (jobId: string) => {
    if (monitoring.current.has(jobId)) return;
    monitoring.current.add(jobId);
    let failures = 0;
    for (;;) {
      try {
        const state = await api.getTestingJob<{total:number;statuses:BatchFileStatus[];successful:number;failed:number;active:boolean;error?:string}>(jobId);
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
    const res = await api.uploadPdfAntre<{batch_id:string;proses:ProsesUnggah[]}>(files, allowedCategories);
    revision.current++;
    batchSesi.current = res.batch_id;
    localStorage.setItem('eclaim-upload-batch', res.batch_id);
    const j = jobDariServer((res.proses || []) as ProsesUnggah[], res.batch_id, highest.current);
    if (j) setJob(j);
    void pantauServer();
    return res;
  }, [pantauServer]);

  const startSingleUpload = useCallback(async (file: File, jenisKlaim: string) => {
    revision.current++;
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
    if (!files.length) return;
    revision.current++;
    const initialStatuses: BatchFileStatus[] = files.map(f => ({ fileName: f.name, status: 'waiting' }));
    setJob({
      type: 'batch', testing, total: files.length, doneCount: 0, failedCount: 0,
      statuses: initialStatuses, active: true, error: null,
    });

    socketRef.current = null;

    try {
      if (testing) {
        const accepted = await api.uploadTestingBatch<{job_id:string}>(files, allowedCategories);
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
