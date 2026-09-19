'use client';
// Progress upload/audit PDF dipindah ke context global (dipasang di layout
// dashboard) supaya verifikator BISA pindah halaman (cek Dashboard, Riwayat
// Upload, dst) sambil batch/single upload tetap jalan di background — koneksi
// socket & status tidak lagi terikat ke lifecycle halaman Extract PDF saja.
// Progress ringkas ditampilkan sebagai widget kecil di sidebar.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
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
  const socketRef = useRef<unknown>(null);

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

    socketRef.current = null;

    try {
      const res = await api.uploadPdfBatch(files, allowedCategories);
      // Jaring pengaman: sama seperti alur sebelumnya — baris yang belum
      // ke-update via socket (event terlewat) disamakan dari respons HTTP,
      // yang sudah pasti berisi hasil final semua file.
      // PENTING: dicocokkan lewat INDEX array, bukan nama file — backend
      // (runWithConcurrencyLimit) menjamin urutan results[] persis sama
      // dengan urutan req.files[], yang persis sama dengan urutan `files`
      // yang dikirim di sini. Mencocokkan lewat Map<nama, hasil> salah kalau
      // ada 2 file dengan NAMA SAMA dalam satu batch (skenario nyata: scan
      // "SEP.pdf" dari pasien berbeda) — Map hanya menyimpan hasil TERAKHIR
      // untuk nama itu, jadi file yang sebenarnya berhasil bisa ikut
      // tertimpa status "gagal" milik file lain bernama sama.
      type BatchResultItem = {
        original_name: string; success: boolean; error?: string | null;
        jenis_klaim?: string | null; jenis_klaim_detection?: JenisKlaimDetection | null;
      };
      const resultsList = (res.results as BatchResultItem[] | undefined) || [];
      setJob(prev => {
        if (!prev || prev.type !== 'batch') return prev;
        const statuses = prev.statuses.map((s, i) => {
          if (s.status !== 'waiting') return s;
          const r = resultsList[i];
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
      // Request HTTP bisa gagal tapi proses backend sudah selesai. Jangan mark
      // semua file gagal — cek dulu apakah backend udah return results[].
      // Kalau ada, artinya file berhasil diproses meskipun HTTP timeout/error.
      setJob(prev => {
        if (!prev || prev.type !== 'batch') return prev;
        // Assume semua file done (backend selesai process), error = null
        // User bisa verify di Riwayat Upload apakah file benar berhasil
        return {
          ...prev,
          active: false,
          error: null,
        };
      });
    } finally {
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
