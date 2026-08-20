'use client';
// Widget kecil di sidebar yang menampilkan progress upload/audit PDF yang
// sedang/baru selesai berjalan — supaya verifikator tetap tahu progressnya
// walau sudah pindah ke halaman lain (Dashboard, Riwayat Upload, dst),
// tidak perlu terpaku di halaman Extract PDF sampai selesai.
import Link from 'next/link';
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import { useUploadJob } from '@/contexts/UploadJobContext';
import { cn } from '@/lib/utils';

export function UploadProgressWidget() {
  const { job, dismissJob } = useUploadJob();
  if (!job) return null;

  const processed = job.doneCount + job.failedCount;
  const pct = job.total > 0 ? Math.round((processed / job.total) * 100) : 0;
  const label = job.type === 'batch' ? `Upload Batch (${job.total} file)` : 'Upload PDF';

  return (
    <div className="mb-3 rounded-lg border border-border bg-secondary/40 p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 font-medium text-foreground min-w-0">
          {job.active ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          ) : job.error || job.failedCount > 0 ? (
            <XCircle className="size-3.5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
          )}
          <span className="truncate">{label}</span>
        </div>
        {!job.active && (
          <button
            onClick={dismissJob}
            aria-label="Tutup"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {job.active ? (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Memproses {processed}/{job.total} file — bisa sambil buka halaman lain.
          </p>
        </>
      ) : job.error ? (
        <p className="text-[10px] text-destructive">{job.error}</p>
      ) : (
        <div className="space-y-1">
          <p className={cn('text-[10px]', job.failedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
            {job.doneCount} berhasil{job.failedCount > 0 ? `, ${job.failedCount} gagal` : ''}.
          </p>
          {job.type === 'single' && job.resultFileId ? (
            <Link href={`/results/${job.resultFileId}`} className="text-[10px] font-medium text-primary hover:underline">
              Lihat Hasil →
            </Link>
          ) : job.type === 'batch' ? (
            <Link href="/history" className="text-[10px] font-medium text-primary hover:underline">
              Lihat di Riwayat Upload →
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
