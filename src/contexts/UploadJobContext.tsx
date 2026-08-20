'use client';
// Progress upload/audit PDF dipindah ke context global (dipasang di layout
// dashboard) supaya verifikator BISA pindah halaman (cek Dashboard, Riwayat
// Upload, dst) sambil batch/single upload tetap jalan di background — koneksi
// socket & status tidak lagi terikat ke lifecycle halaman Extract PDF saja.
// Progress ringkas ditampilkan sebagai widget kecil di sidebar.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
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
}

export interface UploadJob {
  type: 'single' | 'batch';
  total: number;
  doneCount: number;
  failedCount: number;
  statuses: BatchFileStatus[];
  active: boolean; // masih berjalan (true) vs sudah selesai & masih ditampilkan (false)
  error: string | null;
  // Single: id record hasil, untuk link "Lihat Hasil". Batch: tidak ada link tunggal.
  resultFileId?: string | null;
}

interface UploadJobContextValue {
  job: UploadJob | null;
  startSingleUpload: (file: File, jenisKlaim: string) => Promise<{ file_id: string } | null>;
  startBatchUpload: (files: File[], allowedCategories: string[]) => Promise<void>;
  dismissJob: () => void;
}

const UploadJobContext = createContext<UploadJobContextValue | null>(null);

export function UploadJobProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<UploadJob | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const dismissJob = useCallback(() => setJob(null), []);

  const startSingleUpload = useCallback(async (file: File, jenisKlaim: string) => {
    setJob({
      type: 'single', total: 1, doneCount: 0, failedCount: 0, statuses: [],
      active: true, error: null, resultFileId: null,
    });
    try {
      const res = await api.uploadPdf(file, jenisKlaim);
      setJob({
        type: 'single', total: 1, doneCount: 1, failedCount: 0, statuses: [],
        active: false, error: null, resultFileId: res.file_id,
      });
      return res;
    } catch (err: unknown) {
      setJob({
        type: 'single', total: 1, doneCount: 0, failedCount: 1, statuses: [],
        active: false, error: err instanceof Error ? err.message : 'Berkas gagal diunggah.', resultFileId: null,
      });
      return null;
    }
  }, []);

  const startBatchUpload = useCallback(async (files: File[], allowedCategories: string[]) => {
    const initialStatuses: BatchFileStatus[] = files.map(f => ({ fileName: f.name, status: 'waiting' }));
    setJob({
      type: 'batch', total: files.length, doneCount: 0, failedCount: 0,
      statuses: initialStatuses, active: true, error: null,
    });

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000');
    socketRef.current = socket;
    // Sinyal "mulai diproses" per file — tanpa ini status di UI cuma pernah
    // 'waiting' lalu langsung loncat ke 'done'/'failed', baris tidak pernah
    // sempat tampil "Memproses..." walau backend sedang benar-benar
    // mengerjakannya (antrean concurrency 5 di backend sudah ada duluan).
    socket.on('pdf-batch:file-start', (data: { fileName: string }) => {
      setJob(prev => {
        if (!prev || prev.type !== 'batch') return prev;
        const statuses = prev.statuses.map(s =>
          s.fileName === data.fileName && s.status === 'waiting'
            ? { ...s, status: 'processing' as BatchFileStatus['status'] }
            : s
        );
        return { ...prev, statuses };
      });
    });
    socket.on('pdf-batch:file-done', (data: {
      fileName: string; success: boolean; error?: string | null;
      jenis_klaim?: string | null; jenis_klaim_detection?: JenisKlaimDetection | null;
    }) => {
      setJob(prev => {
        if (!prev || prev.type !== 'batch') return prev;
        const statuses = prev.statuses.map(s =>
          s.fileName === data.fileName
            ? { ...s, status: (data.success ? 'done' : 'failed') as BatchFileStatus['status'], error: data.error, jenisKlaim: data.jenis_klaim, detection: data.jenis_klaim_detection }
            : s
        );
        return {
          ...prev,
          statuses,
          doneCount: statuses.filter(s => s.status === 'done').length,
          failedCount: statuses.filter(s => s.status === 'failed').length,
        };
      });
    });

    try {
      const res = await api.uploadPdfBatch(files, allowedCategories);
      // Jaring pengaman: sama seperti alur sebelumnya — baris yang belum
      // ke-update via socket (event terlewat) disamakan dari respons HTTP,
      // yang sudah pasti berisi hasil final semua file.
      type BatchResultItem = {
        original_name: string; success: boolean; error?: string | null;
        jenis_klaim?: string | null; jenis_klaim_detection?: JenisKlaimDetection | null;
      };
      const resultsByName = new Map<string, BatchResultItem>(
        (res.results as BatchResultItem[] | undefined)?.map((r) => [r.original_name, r]) || []
      );
      setJob(prev => {
        if (!prev || prev.type !== 'batch') return prev;
        const statuses = prev.statuses.map(s => {
          if (s.status !== 'waiting') return s;
          const r = resultsByName.get(s.fileName);
          if (!r) return s;
          return { ...s, status: (r.success ? 'done' : 'failed') as BatchFileStatus['status'], error: r.error, jenisKlaim: r.jenis_klaim, detection: r.jenis_klaim_detection };
        });
        return {
          ...prev,
          active: false,
          statuses,
          doneCount: statuses.filter(s => s.status === 'done').length,
          failedCount: statuses.filter(s => s.status === 'failed').length,
        };
      });
    } catch (err: unknown) {
      // Request HTTP utamanya bisa gagal (koneksi diputus di tengah jalan —
      // batch besar/lama rawan kena timeout infrastruktur di luar kendali
      // aplikasi ini, mis. proxy) TANPA berarti prosesnya sendiri gagal —
      // status per file SUDAH terupdate lewat socket (pdf-batch:file-done)
      // sepanjang batch berjalan. Cuma tampilkan error kalau BENAR-BENAR ada
      // file yang statusnya belum diketahui (socket juga tidak sempat
      // melaporkannya) — kalau semua file sudah kelar dari sisi socket,
      // anggap batch selesai secara diam-diam, jangan bikin panik verifikator
      // dengan pesan "gagal" padahal isinya sudah lengkap.
      setJob(prev => {
        if (!prev || prev.type !== 'batch') return prev;
        const stillUnknown = prev.statuses.some(s => s.status === 'waiting' || s.status === 'processing');
        return {
          ...prev,
          active: false,
          error: stillUnknown ? (err instanceof Error ? err.message : 'Batch gagal diunggah.') : null,
        };
      });
    } finally {
      socket.disconnect();
      socketRef.current = null;
    }
  }, []);

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
